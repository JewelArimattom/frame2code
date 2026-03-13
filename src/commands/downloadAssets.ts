/**
 * Download Assets Command
 * Downloads all extracted assets (images, icons, vectors) from Figma
 */

import * as vscode from 'vscode';
import { FigmaClient } from '../figma/figmaClient';
import { AssetManager } from '../figma/assetManager';
import { Logger } from '../utils/logger';
import type { AssetReference } from '../types/design';

export async function downloadAssets(
  client: FigmaClient,
  fileKey: string,
  assets: AssetReference[],
  onDownloaded: (assets: AssetReference[]) => void
): Promise<void> {
  try {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage(
        'Frame2Code: No workspace folder open. Open a folder first.'
      );
      return;
    }

    if (assets.length === 0) {
      vscode.window.showWarningMessage(
        'Frame2Code: No assets to download. Sync a design first.'
      );
      return;
    }

    // Ask user for format preference
    const config = vscode.workspace.getConfiguration('frame2code');
    const defaultFormat = config.get<string>('assetFormat', 'svg');
    const defaultScale = config.get<number>('assetScale', 2);

    const format = await vscode.window.showQuickPick(
      [
        { label: 'SVG', description: 'Vector format — best for icons and simple graphics', value: 'svg' },
        { label: 'PNG', description: `Raster format at ${defaultScale}x — best for complex images`, value: 'png' },
        { label: 'JPG', description: `Compressed raster at ${defaultScale}x — best for photos`, value: 'jpg' },
      ],
      {
        title: 'Frame2Code: Choose Asset Format',
        placeHolder: 'Select the export format for design assets',
      }
    );

    if (!format) {
      return; // User cancelled
    }

    const selectedFormat = format.value as 'svg' | 'png' | 'jpg';
    const workspaceFolder = workspaceFolders[0].uri.fsPath;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Frame2Code: Downloading assets...',
        cancellable: false,
      },
      async (progress) => {
        const assetManager = new AssetManager(client);

        const downloadedAssets = await assetManager.downloadAssets(
          fileKey,
          assets,
          workspaceFolder,
          {
            format: selectedFormat,
            scale: defaultScale,
            onProgress: (current, total, name) => {
              const pct = Math.round((current / total) * 100);
              progress.report({
                message: `${name} (${current}/${total})`,
                increment: pct > 0 ? 100 / total : 0,
              });
            },
          }
        );

        const iconCount = downloadedAssets.filter(a => a.type === 'icon' || a.type === 'vector').length;
        const imageCount = downloadedAssets.filter(a => a.type === 'image').length;

        Logger.info(`Assets downloaded: ${iconCount} icons, ${imageCount} images`);

        vscode.window.showInformationMessage(
          `✅ Frame2Code: Downloaded ${downloadedAssets.length} assets (${iconCount} icons, ${imageCount} images)`
        );

        onDownloaded(downloadedAssets);
      }
    );
  } catch (error) {
    Logger.error('Failed to download assets', error);
    vscode.window.showErrorMessage(
      `Frame2Code: Failed to download assets — ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
