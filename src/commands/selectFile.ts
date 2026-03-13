/**
 * Select File Command
 * Allows user to enter a Figma file URL or key to select a design file
 */

import * as vscode from 'vscode';
import { FigmaClient } from '../figma/figmaClient';
import { Logger } from '../utils/logger';

/**
 * Extract file key from a Figma URL or raw key
 * Supports formats:
 *   - https://www.figma.com/file/FILEKEY/FileName
 *   - https://www.figma.com/design/FILEKEY/FileName
 *   - FILEKEY (raw key)
 */
function extractFileKey(input: string): string | null {
  input = input.trim();

  // Try URL pattern
  const urlPatterns = [
    /figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/,
    /figma\.com\/proto\/([a-zA-Z0-9]+)/,
  ];

  for (const pattern of urlPatterns) {
    const match = input.match(pattern);
    if (match) {
      return match[1];
    }
  }

  // Try raw key (alphanumeric, typically 22+ chars)
  if (/^[a-zA-Z0-9]{10,}$/.test(input)) {
    return input;
  }

  return null;
}

export async function selectFile(
  client: FigmaClient,
  onSelected: (fileKey: string, fileName: string) => void
): Promise<void> {
  try {
    // Ask for file URL or key
    const input = await vscode.window.showInputBox({
      title: 'Frame2Code: Select Figma File',
      prompt: 'Paste a Figma file URL or file key',
      placeHolder: 'https://www.figma.com/design/fileKey/FileName or fileKey',
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'File URL or key is required';
        }
        const key = extractFileKey(value);
        if (!key) {
          return 'Invalid Figma URL or file key. Paste a link from your Figma file or the file key.';
        }
        return undefined;
      },
    });

    if (!input) {
      return; // User cancelled
    }

    const fileKey = extractFileKey(input);
    if (!fileKey) {
      vscode.window.showErrorMessage('Frame2Code: Could not extract file key from input.');
      return;
    }

    // Fetch file metadata to validate
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Frame2Code: Loading Figma file...',
        cancellable: false,
      },
      async () => {
        const file = await client.getFile(fileKey);

        Logger.info(`Selected file: ${file.name} (${fileKey})`);
        vscode.window.showInformationMessage(
          `✅ Frame2Code: Loaded file "${file.name}"`
        );

        onSelected(fileKey, file.name);
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    Logger.error('Failed to select Figma file', error);

    if (message.includes('404')) {
      vscode.window.showErrorMessage(
        'Frame2Code: File not found. Make sure the file exists and your token has access.'
      );
    } else {
      vscode.window.showErrorMessage(`Frame2Code: Failed to load file — ${message}`);
    }
  }
}
