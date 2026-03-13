/**
 * Select Frame Command
 * Shows a QuickPick of all frames in the file for user to choose from
 */

import * as vscode from 'vscode';
import { FigmaClient } from '../figma/figmaClient';
import { Logger } from '../utils/logger';
import type { FigmaNode } from '../types/figma';

interface FrameInfo {
  id: string;
  name: string;
  width: number;
  height: number;
  pageName: string;
}

/**
 * Recursively find all FRAME and COMPONENT nodes in a Figma document
 */
function findFrames(node: FigmaNode, pageName: string = '', depth: number = 0): FrameInfo[] {
  const frames: FrameInfo[] = [];

  // Pages (CANVAS nodes) — recurse but don't add them as frames
  if (node.type === 'CANVAS') {
    for (const child of node.children ?? []) {
      frames.push(...findFrames(child, node.name, depth + 1));
    }
    return frames;
  }

  // Top-level frames, components
  if (
    depth <= 2 &&
    (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'COMPONENT_SET' || node.type === 'SECTION')
  ) {
    const bounds = node.absoluteBoundingBox;
    frames.push({
      id: node.id,
      name: node.name,
      width: bounds?.width ?? 0,
      height: bounds?.height ?? 0,
      pageName,
    });
  }

  // DOCUMENT node — recurse into pages
  if (node.type === 'DOCUMENT') {
    for (const child of node.children ?? []) {
      frames.push(...findFrames(child, '', depth + 1));
    }
  }

  return frames;
}

export async function selectFrame(
  client: FigmaClient,
  fileKey: string,
  onSelected: (frameId: string, frameName: string) => void
): Promise<void> {
  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Frame2Code: Loading frames...',
        cancellable: false,
      },
      async () => {
        const file = await client.getFile(fileKey);
        const frames = findFrames(file.document);

        if (frames.length === 0) {
          vscode.window.showWarningMessage(
            'Frame2Code: No frames found in this file. Make sure your Figma file has at least one frame.'
          );
          return;
        }

        // Show QuickPick
        const items: vscode.QuickPickItem[] = frames.map(f => ({
          label: f.name,
          description: `${f.width} × ${f.height}px`,
          detail: f.pageName ? `Page: ${f.pageName}` : undefined,
        }));

        const selected = await vscode.window.showQuickPick(items, {
          title: 'Frame2Code: Select a Frame',
          placeHolder: 'Choose a frame to extract design data from',
          matchOnDescription: true,
          matchOnDetail: true,
        });

        if (!selected) {
          return; // User cancelled
        }

        const frame = frames.find(f => f.name === selected.label);
        if (!frame) {
          return;
        }

        Logger.info(`Selected frame: ${frame.name} (${frame.id})`);
        vscode.window.showInformationMessage(
          `✅ Frame2Code: Selected frame "${frame.name}" (${frame.width}×${frame.height}px)`
        );

        onSelected(frame.id, frame.name);
      }
    );
  } catch (error) {
    Logger.error('Failed to load frames', error);
    vscode.window.showErrorMessage(
      `Frame2Code: Failed to load frames — ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
