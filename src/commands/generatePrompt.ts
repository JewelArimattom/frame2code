/**
 * Generate Prompt Command
 * Generates an AI-optimized prompt from the synced design data
 * and opens it in a new editor tab
 */

import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { generatePrompt, type Framework, type Styling } from '../prompts/promptTemplates';
import type { DesignSpecification } from '../types/design';

export async function generatePromptCommand(
  spec: DesignSpecification
): Promise<void> {
  try {
    // Ask for framework
    const frameworkChoice = await vscode.window.showQuickPick(
      [
        { label: 'React', description: 'React with TypeScript', value: 'react' },
        { label: 'Next.js', description: 'Next.js App Router with TypeScript', value: 'nextjs' },
        { label: 'Vue', description: 'Vue 3 Composition API with TypeScript', value: 'vue' },
        { label: 'Svelte', description: 'Svelte 5 with runes', value: 'svelte' },
        { label: 'HTML', description: 'Vanilla HTML/CSS/JS', value: 'html' },
      ],
      {
        title: 'Frame2Code: Choose Framework',
        placeHolder: 'Select the target framework for code generation',
      }
    );

    if (!frameworkChoice) {
      return;
    }

    // Ask for styling approach
    const stylingChoice = await vscode.window.showQuickPick(
      [
        { label: 'Tailwind CSS', description: 'Utility-first CSS framework', value: 'tailwind' },
        { label: 'CSS Modules', description: 'Scoped CSS with .module.css files', value: 'css-modules' },
        { label: 'Styled Components', description: 'CSS-in-JS with tagged templates', value: 'styled-components' },
        { label: 'Vanilla CSS', description: 'Plain CSS with custom properties', value: 'vanilla-css' },
      ],
      {
        title: 'Frame2Code: Choose Styling',
        placeHolder: 'Select the styling approach for generated code',
      }
    );

    if (!stylingChoice) {
      return;
    }

    // Generate the prompt
    const prompt = generatePrompt(spec, {
      framework: frameworkChoice.value as Framework,
      styling: stylingChoice.value as Styling,
      responsive: true,
      includeDesignTokens: true,
      includeAssets: true,
    });

    // Open in a new editor tab
    const doc = await vscode.workspace.openTextDocument({
      content: prompt,
      language: 'markdown',
    });

    await vscode.window.showTextDocument(doc, {
      viewColumn: vscode.ViewColumn.Beside,
      preview: false,
    });

    // Also save to workspace
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      try {
        const outputDir = vscode.Uri.joinPath(workspaceFolders[0].uri, '.frame2code');
        await vscode.workspace.fs.createDirectory(outputDir);

        const fileName = `prompt-${spec.frame.name.toLowerCase().replace(/\s+/g, '-')}.md`;
        const outputFile = vscode.Uri.joinPath(outputDir, fileName);
        const content = Buffer.from(prompt, 'utf-8');
        await vscode.workspace.fs.writeFile(outputFile, content);

        Logger.debug(`Prompt saved to ${outputFile.fsPath}`);
      } catch {
        // Non-critical — just log
        Logger.debug('Could not save prompt file to workspace');
      }
    }

    Logger.info(`Generated AI prompt for ${frameworkChoice.label} + ${stylingChoice.label}`);
    vscode.window.showInformationMessage(
      `✅ Frame2Code: AI prompt generated! Select all text in the editor (Ctrl+A / Cmd+A), copy it, and paste it into your AI agent (GitHub Copilot Chat, Claude, Cursor, ChatGPT, etc.) to generate the UI code.`,
      'Got it'
    );
  } catch (error) {
    Logger.error('Failed to generate prompt', error);
    vscode.window.showErrorMessage(
      `Frame2Code: Failed to generate prompt — ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
