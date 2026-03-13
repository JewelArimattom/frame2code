/**
 * Connect Figma Command
 * Prompts user for their Figma personal access token and verifies it
 */

import * as vscode from 'vscode';
import { FigmaClient } from '../figma/figmaClient';
import { Logger } from '../utils/logger';

export async function connectFigma(
  context: vscode.ExtensionContext,
  onConnected: (client: FigmaClient, userName: string) => void
): Promise<void> {
  try {
    // Check for existing token
    const existingToken = await context.secrets.get('frame2code.figmaToken');

    let token: string | undefined;

    if (existingToken) {
      const action = await vscode.window.showInformationMessage(
        'Frame2Code: You are already connected to Figma. What would you like to do?',
        'Reconnect with new token',
        'Use existing token',
        'Cancel'
      );

      if (action === 'Cancel' || !action) {
        return;
      }

      if (action === 'Use existing token') {
        token = existingToken;
      }
    }

    if (!token) {
      // Prompt for token
      token = await vscode.window.showInputBox({
        title: 'Frame2Code: Connect Figma',
        prompt: 'Enter your Figma Personal Access Token',
        placeHolder: 'figd_xxxxxxxxxxxxxxxxxxxxxx',
        password: true,
        ignoreFocusOut: true,
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Token is required';
          }
          if (value.trim().length < 10) {
            return 'Token seems too short. Get your token from Figma → Settings → Personal Access Tokens';
          }
          return undefined;
        },
      });

      if (!token) {
        return; // User cancelled
      }

      token = token.trim();
    }

    // Verify token
    const client = new FigmaClient(token);

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Frame2Code: Verifying Figma token...',
        cancellable: false,
      },
      async () => {
        const user = await client.verifyToken();

        // Store token securely
        await context.secrets.store('frame2code.figmaToken', token!);

        Logger.info(`Connected to Figma as: ${user.handle} (${user.email})`);

        vscode.window.showInformationMessage(
          `✅ Frame2Code: Connected to Figma as ${user.handle}`
        );

        onConnected(client, user.handle);
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    Logger.error('Failed to connect to Figma', error);

    if (message.includes('403') || message.includes('401')) {
      vscode.window.showErrorMessage(
        'Frame2Code: Invalid Figma token. Please check your token and try again. Get a new token from Figma → Settings → Personal Access Tokens.'
      );
    } else {
      vscode.window.showErrorMessage(
        `Frame2Code: Failed to connect to Figma — ${message}`
      );
    }
  }
}

export async function disconnectFigma(
  context: vscode.ExtensionContext,
  onDisconnected: () => void
): Promise<void> {
  const confirm = await vscode.window.showWarningMessage(
    'Frame2Code: Are you sure you want to disconnect from Figma?',
    'Yes, Disconnect',
    'Cancel'
  );

  if (confirm !== 'Yes, Disconnect') {
    return;
  }

  await context.secrets.delete('frame2code.figmaToken');
  onDisconnected();

  Logger.info('Disconnected from Figma');
  vscode.window.showInformationMessage('Frame2Code: Disconnected from Figma');
}
