/**
 * Asset Manager
 * Handles downloading and managing design assets (images, icons, vectors)
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { FigmaClient } from './figmaClient';
import { Logger } from '../utils/logger';
import type { AssetReference } from '../types/design';

export class AssetManager {
  private client: FigmaClient;

  constructor(client: FigmaClient) {
    this.client = client;
  }

  /**
   * Download all assets for a file
   */
  async downloadAssets(
    fileKey: string,
    assets: AssetReference[],
    workspaceFolder: string,
    options?: {
      format?: 'svg' | 'png' | 'jpg';
      scale?: number;
      onProgress?: (current: number, total: number, name: string) => void;
    }
  ): Promise<AssetReference[]> {
    const format = options?.format ?? 'svg';
    const scale = options?.scale ?? 2;

    if (assets.length === 0) {
      Logger.info('No assets to download');
      return [];
    }

    Logger.info(`Downloading ${assets.length} assets in ${format} format`);

    // Create asset directories
    const config = vscode.workspace.getConfiguration('frame2code');
    const assetsDir = config.get<string>('assetsDirectory', 'assets');
    const iconsDir = path.join(workspaceFolder, assetsDir, 'icons');
    const imagesDir = path.join(workspaceFolder, assetsDir, 'images');

    await this.ensureDir(iconsDir);
    await this.ensureDir(imagesDir);

    // Group assets by type for batch export
    const iconAssets = assets.filter(a => a.type === 'icon' || a.type === 'vector');
    const imageAssets = assets.filter(a => a.type === 'image');

    const updatedAssets: AssetReference[] = [];
    let processed = 0;

    // Download icons (prefer SVG)
    if (iconAssets.length > 0) {
      const iconFormat = format === 'jpg' ? 'svg' : format; // Always use SVG for icons if possible
      const downloaded = await this.batchDownload(
        fileKey,
        iconAssets,
        iconsDir,
        iconFormat === 'svg' ? 'svg' : format,
        scale,
        (name) => {
          processed++;
          options?.onProgress?.(processed, assets.length, name);
        }
      );
      updatedAssets.push(...downloaded);
    }

    // Download images
    if (imageAssets.length > 0) {
      const imgFormat = format === 'svg' ? 'png' : format; // Don't use SVG for raster images
      const downloaded = await this.batchDownload(
        fileKey,
        imageAssets,
        imagesDir,
        imgFormat,
        scale,
        (name) => {
          processed++;
          options?.onProgress?.(processed, assets.length, name);
        }
      );
      updatedAssets.push(...downloaded);
    }

    Logger.info(`Downloaded ${updatedAssets.length} assets successfully`);
    return updatedAssets;
  }

  /**
   * Batch download a set of assets
   */
  private async batchDownload(
    fileKey: string,
    assets: AssetReference[],
    outputDir: string,
    format: 'svg' | 'png' | 'jpg',
    scale: number,
    onDownloaded: (name: string) => void
  ): Promise<AssetReference[]> {
    // Get image URLs from Figma (batch request)
    const nodeIds = assets.map(a => a.nodeId);
    const batchSize = 50; // Figma API limit
    const updatedAssets: AssetReference[] = [];

    for (let i = 0; i < nodeIds.length; i += batchSize) {
      const batch = nodeIds.slice(i, i + batchSize);
      const batchAssets = assets.slice(i, i + batchSize);

      try {
        const imageResponse = await this.client.getImages(fileKey, batch, format, scale);

        if (imageResponse.err) {
          Logger.error(`Figma image export error: ${imageResponse.err}`);
          continue;
        }

        // Download each image
        for (const asset of batchAssets) {
          const imageUrl = imageResponse.images[asset.nodeId];
          if (!imageUrl) {
            Logger.warn(`No image URL for asset: ${asset.nodeName} (${asset.nodeId})`);
            continue;
          }

          try {
            const fileName = this.sanitizeFileName(asset.nodeName) + `.${format}`;
            const filePath = path.join(outputDir, fileName);

            const imageBuffer = await this.client.downloadImage(imageUrl);
            fs.writeFileSync(filePath, imageBuffer);

            updatedAssets.push({
              ...asset,
              format,
              localPath: filePath,
              downloadUrl: imageUrl,
            });

            onDownloaded(asset.nodeName);
            Logger.debug(`Downloaded: ${fileName}`);
          } catch (error) {
            Logger.error(`Failed to download asset: ${asset.nodeName}`, error);
          }
        }
      } catch (error) {
        Logger.error(`Failed to export batch of images`, error);
      }
    }

    return updatedAssets;
  }

  /**
   * Sanitize a file name to be safe for the filesystem
   */
  private sanitizeFileName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9_\-. ]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 100) || 'asset';
  }

  /**
   * Ensure a directory exists
   */
  private async ensureDir(dirPath: string): Promise<void> {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      Logger.debug(`Created directory: ${dirPath}`);
    }
  }
}
