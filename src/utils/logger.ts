/**
 * Logger Utility
 * Centralized logging for the Frame2Code extension
 */

import * as vscode from 'vscode';

export class Logger {
  private static outputChannel: vscode.OutputChannel;

  static initialize(): void {
    if (!this.outputChannel) {
      this.outputChannel = vscode.window.createOutputChannel('Frame2Code');
    }
  }

  static info(message: string, ...args: unknown[]): void {
    this.log('INFO', message, ...args);
  }

  static warn(message: string, ...args: unknown[]): void {
    this.log('WARN', message, ...args);
  }

  static error(message: string, error?: unknown): void {
    const errorMsg = error instanceof Error ? error.message : String(error ?? '');
    this.log('ERROR', `${message} ${errorMsg}`.trim());
    if (error instanceof Error && error.stack) {
      this.outputChannel?.appendLine(`  Stack: ${error.stack}`);
    }
  }

  static debug(message: string, ...args: unknown[]): void {
    this.log('DEBUG', message, ...args);
  }

  private static log(level: string, message: string, ...args: unknown[]): void {
    const timestamp = new Date().toISOString();
    const formatted = args.length > 0
      ? `[${timestamp}] [${level}] ${message} ${args.map(a => JSON.stringify(a)).join(' ')}`
      : `[${timestamp}] [${level}] ${message}`;

    this.outputChannel?.appendLine(formatted);

    if (level === 'ERROR') {
      console.error(formatted);
    }
  }

  static show(): void {
    this.outputChannel?.show();
  }

  static dispose(): void {
    this.outputChannel?.dispose();
  }
}
