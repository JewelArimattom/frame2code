/**
 * Sync Design Command
 * Fetches the selected frame from Figma and parses it into structured design data
 */

import * as vscode from 'vscode';
import { FigmaClient } from '../figma/figmaClient';
import { DesignParser } from '../figma/designParser';
import { Logger } from '../utils/logger';
import type { DesignSpecification } from '../types/design';

export async function syncDesign(
  client: FigmaClient,
  fileKey: string,
  fileName: string,
  frameId: string,
  frameName: string,
  onSynced: (spec: DesignSpecification) => void
): Promise<void> {
  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Frame2Code: Syncing design data...',
        cancellable: false,
      },
      async (progress) => {
        // Step 1: Fetch the frame node from Figma
        progress.report({ message: 'Fetching frame data from Figma...', increment: 10 });

        const nodesResponse = await client.getNodes(fileKey, [frameId]);
        const nodeData = nodesResponse.nodes[frameId];

        if (!nodeData?.document) {
          throw new Error(`Frame "${frameName}" not found in the file. It may have been deleted or renamed.`);
        }

        // Step 2: Parse the design
        progress.report({ message: 'Parsing design structure...', increment: 30 });

        const parser = new DesignParser();
        const frame = parser.parseFrame(nodeData.document);
        const designTokens = parser.extractDesignTokens();
        const assets = parser.getAssetReferences();

        // Step 3: Build the design specification
        progress.report({ message: 'Building design specification...', increment: 30 });

        const spec: DesignSpecification = {
          file: {
            name: fileName,
            key: fileKey,
            lastModified: nodesResponse.lastModified,
            version: nodesResponse.version,
          },
          frame,
          designTokens,
          assets,
        };

        // Step 4: Save to workspace (optional)
        progress.report({ message: 'Saving design data...', increment: 20 });

        await saveDesignSpec(spec);

        // Statistics
        const stats = {
          elements: countElements(frame.children ?? []),
          colors: designTokens.colors.length,
          typography: designTokens.typography.length,
          assets: assets.length,
        };

        Logger.info(`Design synced: ${stats.elements} elements, ${stats.colors} colors, ${stats.typography} text styles, ${stats.assets} assets`);

        vscode.window.showInformationMessage(
          `✅ Frame2Code: Design synced — ${stats.elements} elements, ${stats.colors} colors, ${stats.assets} assets`
        );

        progress.report({ message: 'Done!', increment: 10 });

        onSynced(spec);
      }
    );
  } catch (error) {
    Logger.error('Failed to sync design', error);
    vscode.window.showErrorMessage(
      `Frame2Code: Failed to sync design — ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Count total elements recursively
 */
function countElements(children: unknown[]): number {
  let count = children.length;
  for (const child of children) {
    const element = child as { children?: unknown[] };
    if (element.children) {
      count += countElements(element.children);
    }
  }
  return count;
}

/**
 * Save design spec to workspace .frame2code directory
 */
async function saveDesignSpec(spec: DesignSpecification): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return;
  }

  try {
    const outputDir = vscode.Uri.joinPath(workspaceFolders[0].uri, '.frame2code');
    await vscode.workspace.fs.createDirectory(outputDir);

    const outputFile = vscode.Uri.joinPath(outputDir, 'design-spec.json');
    const content = Buffer.from(JSON.stringify(spec, null, 2), 'utf-8');
    await vscode.workspace.fs.writeFile(outputFile, content);

    Logger.debug(`Design spec saved to ${outputFile.fsPath}`);
  } catch (error) {
    Logger.warn('Could not save design spec to workspace', error);
  }
}
