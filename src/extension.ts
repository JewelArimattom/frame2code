/**
 * Frame2Code — VS Code Extension Entry Point
 *
 * Connects Figma designs to AI coding agents via the Model Context Protocol (MCP).
 * Extracts structured design data, downloads assets, and generates optimized AI prompts
 * so agents can produce pixel-perfect UI code.
 */

import * as vscode from 'vscode';
import { Logger } from './utils/logger';
import { FigmaClient } from './figma/figmaClient';
import { Frame2CodeMcpServer } from './mcp/mcpServer';
import { connectFigma, disconnectFigma } from './commands/connectFigma';
import { selectFile } from './commands/selectFile';
import { selectFrame } from './commands/selectFrame';
import { syncDesign } from './commands/syncDesign';
import { downloadAssets } from './commands/downloadAssets';
import { generatePromptCommand } from './commands/generatePrompt';
import { Frame2CodeSidebarViewProvider } from './ui/sidebarViewProvider';
import type { DesignSpecification, AssetReference, ExtensionState } from './types/design';

// ─── Extension State ────────────────────────────────────────────────────────

let figmaClient: FigmaClient | null = null;
let mcpServer: Frame2CodeMcpServer | null = null;
let statusBarItem: vscode.StatusBarItem;
let sidebarViewProvider: Frame2CodeSidebarViewProvider | null = null;

const state: ExtensionState = {
  isConnected: false,
};

// ─── Activation ─────────────────────────────────────────────────────────────

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  Logger.initialize();
  Logger.info('Frame2Code extension activating...');

  // Create status bar
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'frame2code.showStatus';
  updateStatusBar();
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Initialize MCP server
  mcpServer = new Frame2CodeMcpServer();

  // Register sidebar panel
  sidebarViewProvider = new Frame2CodeSidebarViewProvider(context.extensionUri, () => state);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      Frame2CodeSidebarViewProvider.viewType,
      sidebarViewProvider
    )
  );

  // Try to restore connection from stored token
  const storedToken = await context.secrets.get('frame2code.figmaToken');
  if (storedToken) {
    try {
      figmaClient = new FigmaClient(storedToken);
      const user = await figmaClient.verifyToken();
      state.isConnected = true;
      mcpServer.setFigmaClient(figmaClient);
      mcpServer.updateState(state);
      Logger.info(`Auto-connected to Figma as ${user.handle}`);
      updateStatusBar();
    } catch {
      Logger.warn('Stored Figma token is invalid or expired');
      figmaClient = null;
    }
  }

  // ─── Register Commands ─────────────────────────────────────────────────

  // Connect Figma
  context.subscriptions.push(
    vscode.commands.registerCommand('frame2code.connectFigma', () => {
      connectFigma(context, (client, userName) => {
        figmaClient = client;
        state.isConnected = true;
        mcpServer?.setFigmaClient(client);
        mcpServer?.updateState(state);
        updateStatusBar();
      });
    })
  );

  // Disconnect Figma
  context.subscriptions.push(
    vscode.commands.registerCommand('frame2code.disconnectFigma', () => {
      disconnectFigma(context, () => {
        figmaClient = null;
        state.isConnected = false;
        state.currentFileKey = undefined;
        state.currentFileName = undefined;
        state.selectedFrameId = undefined;
        state.selectedFrameName = undefined;
        state.syncedData = undefined;
        state.downloadedAssets = undefined;
        mcpServer?.updateState(state);
        updateStatusBar();
      });
    })
  );

  // Select File
  context.subscriptions.push(
    vscode.commands.registerCommand('frame2code.selectFile', () => {
      if (!figmaClient) {
        vscode.window.showWarningMessage(
          'Frame2Code: Connect to Figma first. Run "Frame2Code: Connect Figma Account".'
        );
        return;
      }

      selectFile(figmaClient, (fileKey, fileName) => {
        state.currentFileKey = fileKey;
        state.currentFileName = fileName;
        state.selectedFrameId = undefined;
        state.selectedFrameName = undefined;
        state.syncedData = undefined;
        state.downloadedAssets = undefined;
        mcpServer?.updateState(state);
        updateStatusBar();
      });
    })
  );

  // Select Frame
  context.subscriptions.push(
    vscode.commands.registerCommand('frame2code.selectFrame', () => {
      if (!figmaClient) {
        vscode.window.showWarningMessage(
          'Frame2Code: Connect to Figma first.'
        );
        return;
      }
      if (!state.currentFileKey) {
        vscode.window.showWarningMessage(
          'Frame2Code: Select a Figma file first. Run "Frame2Code: Select Figma File".'
        );
        return;
      }

      selectFrame(figmaClient, state.currentFileKey, (frameId, frameName) => {
        state.selectedFrameId = frameId;
        state.selectedFrameName = frameName;
        state.syncedData = undefined;
        mcpServer?.updateState(state);
        updateStatusBar();
      });
    })
  );

  // Sync Design
  context.subscriptions.push(
    vscode.commands.registerCommand('frame2code.syncDesign', () => {
      if (!figmaClient) {
        vscode.window.showWarningMessage('Frame2Code: Connect to Figma first.');
        return;
      }
      if (!state.currentFileKey || !state.currentFileName) {
        vscode.window.showWarningMessage('Frame2Code: Select a Figma file first.');
        return;
      }
      if (!state.selectedFrameId || !state.selectedFrameName) {
        vscode.window.showWarningMessage('Frame2Code: Select a frame first.');
        return;
      }

      syncDesign(
        figmaClient,
        state.currentFileKey,
        state.currentFileName,
        state.selectedFrameId,
        state.selectedFrameName,
        (spec: DesignSpecification) => {
          state.syncedData = spec;
          state.lastSyncTime = new Date().toISOString();
          mcpServer?.updateState(state);
          mcpServer?.cacheFrame(spec.frame.id, spec.frame);
          updateStatusBar();
        }
      );
    })
  );

  // Download Assets
  context.subscriptions.push(
    vscode.commands.registerCommand('frame2code.downloadAssets', () => {
      if (!figmaClient) {
        vscode.window.showWarningMessage('Frame2Code: Connect to Figma first.');
        return;
      }
      if (!state.currentFileKey) {
        vscode.window.showWarningMessage('Frame2Code: Select a Figma file first.');
        return;
      }
      if (!state.syncedData) {
        vscode.window.showWarningMessage('Frame2Code: Sync design data first.');
        return;
      }

        downloadAssets(
          figmaClient,
          state.currentFileKey,
          state.syncedData.assets,
          (downloadedAssets: AssetReference[]) => {
            state.downloadedAssets = downloadedAssets;
            mcpServer?.updateState(state);
            sidebarViewProvider?.refresh();
          }
        );
      })
  );

  // Generate AI Prompt
  context.subscriptions.push(
    vscode.commands.registerCommand('frame2code.generatePrompt', () => {
      if (!state.syncedData) {
        vscode.window.showWarningMessage(
          'Frame2Code: No design data synced. Run "Frame2Code: Sync Design" first.'
        );
        return;
      }

      generatePromptCommand(state.syncedData);
    })
  );

  // Show Status
  context.subscriptions.push(
    vscode.commands.registerCommand('frame2code.showStatus', () => {
      showStatusInfo();
    })
  );

  // ─── Start MCP Server ─────────────────────────────────────────────────

  try {
    // Note: MCP server with stdio transport should only be started when
    // explicitly configured as an MCP server by the AI agent client.
    // For now, we keep it available but don't auto-start stdio
    // since that would interfere with the extension host's stdio.
    Logger.info('Frame2Code MCP server initialized (ready for connections)');
  } catch (error) {
    Logger.error('Failed to initialize MCP server', error);
  }

  Logger.info('Frame2Code extension activated successfully');
}

// ─── Deactivation ───────────────────────────────────────────────────────────

export async function deactivate(): Promise<void> {
  Logger.info('Frame2Code extension deactivating...');

  if (mcpServer?.running) {
    await mcpServer.stop();
  }

  Logger.dispose();
}

// ─── Status Bar ─────────────────────────────────────────────────────────────

function updateStatusBar(): void {
  if (!state.isConnected) {
    statusBarItem.text = '$(plug) Frame2Code';
    statusBarItem.tooltip = 'Click to view Frame2Code status. Not connected to Figma.';
    statusBarItem.backgroundColor = undefined;
    sidebarViewProvider?.refresh();
    return;
  }

  if (state.syncedData) {
    statusBarItem.text = `$(check) F2C: ${state.selectedFrameName ?? 'Synced'}`;
    statusBarItem.tooltip = `Frame2Code: ${state.currentFileName} → ${state.selectedFrameName}\nLast sync: ${state.lastSyncTime ?? 'Unknown'}`;
    statusBarItem.backgroundColor = undefined;
    sidebarViewProvider?.refresh();
    return;
  }

  if (state.currentFileKey) {
    statusBarItem.text = `$(file) F2C: ${state.currentFileName ?? 'File Selected'}`;
    statusBarItem.tooltip = `Frame2Code: ${state.currentFileName}${state.selectedFrameName ? ` → ${state.selectedFrameName}` : ''}`;
    sidebarViewProvider?.refresh();
    return;
  }

  statusBarItem.text = '$(check) F2C: Connected';
  statusBarItem.tooltip = 'Frame2Code: Connected to Figma. Select a file to get started.';
  sidebarViewProvider?.refresh();
}

function showStatusInfo(): void {
  const lines: string[] = [
    '# Frame2Code Status\n',
    `**Connected:** ${state.isConnected ? '✅ Yes' : '❌ No'}`,
  ];

  if (state.currentFileName) {
    lines.push(`**File:** ${state.currentFileName}`);
  }
  if (state.selectedFrameName) {
    lines.push(`**Frame:** ${state.selectedFrameName}`);
  }
  if (state.lastSyncTime) {
    lines.push(`**Last Sync:** ${new Date(state.lastSyncTime).toLocaleString()}`);
  }
  if (state.syncedData) {
    const tokens = state.syncedData.designTokens;
    lines.push(`**Design Tokens:** ${tokens.colors.length} colors, ${tokens.typography.length} text styles`);
    lines.push(`**Assets:** ${state.syncedData.assets.length} total`);
  }
  if (state.downloadedAssets) {
    lines.push(`**Downloaded Assets:** ${state.downloadedAssets.length}`);
  }

  lines.push(`\n**MCP Server:** ${mcpServer?.running ? '🟢 Running' : '⚪ Ready'}`);

  lines.push('\n---\n');
  lines.push('**Commands:**');
  lines.push('- `Frame2Code: Connect Figma Account` — Connect with token');
  lines.push('- `Frame2Code: Select Figma File` — Choose a file');
  lines.push('- `Frame2Code: Select Frame` — Choose a frame');
  lines.push('- `Frame2Code: Sync Design` — Extract design data');
  lines.push('- `Frame2Code: Download Assets` — Export images/icons');
  lines.push('- `Frame2Code: Generate AI Prompt` — Create AI prompt');

  // Show in output channel
  Logger.show();

  // Also show as notification with key info
  const statusText = state.isConnected
    ? state.syncedData
      ? `Connected ✅ | File: ${state.currentFileName} | Frame: ${state.selectedFrameName} | Synced ✅`
      : state.currentFileKey
        ? `Connected ✅ | File: ${state.currentFileName} | Not synced yet`
        : 'Connected ✅ | No file selected'
    : 'Not connected to Figma';

  vscode.window.showInformationMessage(`Frame2Code: ${statusText}`);
}
