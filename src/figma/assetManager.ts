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
        workspaceFolder,
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
        workspaceFolder,
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
    workspaceFolder: string,
    format: 'svg' | 'png' | 'jpg',
    scale: number,
    onDownloaded: (name: string) => void
  ): Promise<AssetReference[]> {
    // Deduplicate by nodeId
    const uniqueAssets = Array.from(new Map(assets.map(a => [a.nodeId, a])).values());
    // Get image URLs from Figma (batch request)
    const nodeIds = uniqueAssets.map(a => a.nodeId);
    const batchSize = 50; // Figma API limit
    const updatedAssets: AssetReference[] = [];

    for (let i = 0; i < nodeIds.length; i += batchSize) {
      const batch = nodeIds.slice(i, i + batchSize);
      const batchAssets = uniqueAssets.slice(i, i + batchSize);

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
            // Build unique, deterministic filename: sanitizedName-shortNodeId.ext
            // This prevents collisions when multiple nodes share the same display name.
            const fileName = this.sanitizeFileName(asset.nodeName, asset.nodeId) + `.${format}`;
            const filePath = path.join(outputDir, fileName);
            // Workspace-relative forward-slash path (used in generated code)
            const relativePath = path
              .relative(workspaceFolder, filePath)
              .replace(/\\/g, '/');

            const imageBuffer = await this.client.downloadImage(imageUrl);
            fs.writeFileSync(filePath, imageBuffer);

            updatedAssets.push({
              ...asset,
              format,
              localPath: filePath,
              relativePath,
              fileName,
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
   * Sanitize a file name and append a short nodeId suffix to guarantee uniqueness.
   * Two nodes with identical display names will get different filenames.
   */
  private sanitizeFileName(name: string, nodeId: string): string {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9_\-. ]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 60) || 'asset';

    // 8-char hex suffix derived from nodeId (e.g. "1:23" → "00000123")
    const shortId = nodeId
      .replace(/[^a-z0-9]/gi, '')
      .substring(0, 8)
      .toLowerCase()
      .padEnd(8, '0');

    return `${base}-${shortId}`;
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
