/**
 * AI Prompt Templates
 * Generates structured, optimized prompts for AI coding agents
 * to produce accurate UI code from design specifications
 */

import type { DesignSpecification, DesignFrame, DesignTokens, AssetReference } from '../types/design';

export type Framework = 'react' | 'nextjs' | 'vue' | 'svelte' | 'html';
export type Styling = 'tailwind' | 'css-modules' | 'styled-components' | 'vanilla-css';

interface PromptOptions {
  framework: Framework;
  styling: Styling;
  responsive: boolean;
  includeDesignTokens: boolean;
  includeAssets: boolean;
  additionalInstructions?: string;
}

const DEFAULT_OPTIONS: PromptOptions = {
  framework: 'react',
  styling: 'tailwind',
  responsive: true,
  includeDesignTokens: true,
  includeAssets: true,
};

/**
 * Generate a comprehensive AI prompt from a design specification
 */
export function generatePrompt(
  spec: DesignSpecification,
  options: Partial<PromptOptions> = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const sections: string[] = [];

  // Header
  sections.push(generateHeader(opts));

  // Design Specification
  sections.push(generateDesignSection(spec.frame));

  // Design Tokens
  if (opts.includeDesignTokens) {
    sections.push(generateTokensSection(spec.designTokens));
  }

  // Assets
  if (opts.includeAssets && spec.assets.length > 0) {
    sections.push(generateAssetsSection(spec.assets));
  }

  // Requirements
  sections.push(generateRequirements(opts));

  // Output format
  sections.push(generateOutputSection(opts));

  return sections.join('\n\n---\n\n');
}

function generateHeader(opts: PromptOptions): string {
  const frameworkName = getFrameworkName(opts.framework);
  const stylingName = getStylingName(opts.styling);

  return `# UI Code Generation Task

You are a senior frontend engineer specializing in ${frameworkName} and ${stylingName}.

Generate production-ready, pixel-perfect UI code based on the following design specification extracted from a Figma design file.

**Technology Stack:**
- Framework: ${frameworkName}
- Styling: ${stylingName}
- Responsive: ${opts.responsive ? 'Yes' : 'No'}`;
}

function generateDesignSection(frame: DesignFrame): string {
  // Create a clean version of the frame data for the prompt
  const cleanFrame = JSON.stringify(frame, null, 2);

  return `# Design Specification

\`\`\`json
${cleanFrame}
\`\`\`

**Frame Details:**
- Name: \`${frame.name}\`
- Dimensions: ${frame.width} × ${frame.height}px
- Layout: ${frame.layout.mode === 'none' ? 'Absolute positioning' : `Flex ${frame.layout.mode}`}
- Children: ${frame.children.length} elements`;
}

function generateTokensSection(tokens: DesignTokens): string {
  const lines: string[] = ['# Design Tokens'];

  // Colors
  if (tokens.colors.length > 0) {
    lines.push('\n## Colors');
    lines.push('| Token | Hex | Usage |');
    lines.push('|-------|-----|-------|');
    tokens.colors.forEach(c => {
      lines.push(`| ${c.name} | ${c.hex} | ${c.usage} |`);
    });
  }

  // Typography
  if (tokens.typography.length > 0) {
    lines.push('\n## Typography');
    lines.push('| Token | Font | Size | Weight | Line Height |');
    lines.push('|-------|------|------|--------|-------------|');
    tokens.typography.forEach(t => {
      lines.push(`| ${t.name} | ${t.fontFamily} | ${t.fontSize}px | ${t.fontWeight} | ${t.lineHeight ?? 'auto'}px |`);
    });
  }

  // Spacing
  if (tokens.spacing.length > 0) {
    lines.push(`\n## Spacing Scale\n${tokens.spacing.join(', ')}px`);
  }

  // Border Radii
  if (tokens.borderRadii.length > 0) {
    lines.push(`\n## Border Radii Scale\n${tokens.borderRadii.join(', ')}px`);
  }

  return lines.join('\n');
}

function generateAssetsSection(assets: AssetReference[]): string {
  const lines: string[] = ['# Assets'];
  lines.push('\nThe following assets have been exported and saved locally:\n');
  lines.push('| Asset | Type | Format | Path |');
  lines.push('|-------|------|--------|------|');

  assets.forEach(a => {
    lines.push(`| ${a.nodeName} | ${a.type} | ${a.format} | ${a.localPath ?? 'pending'} |`);
  });

  lines.push('\nUse these asset paths in your generated code. Reference them relative to the component file.');

  return lines.join('\n');
}

function generateRequirements(opts: PromptOptions): string {
  const frameworkReqs = getFrameworkRequirements(opts.framework);
  const stylingReqs = getStylingRequirements(opts.styling);

  let text = `# Requirements

## General
- Pixel-perfect layout matching the design specification
- Maintain exact spacing, font sizes, and colors from the design tokens
- Clean, readable, production-quality code
- Proper component hierarchy matching the design structure
- Accessible (ARIA labels, semantic HTML, keyboard navigation)
- No placeholder or TODO comments — everything must be implemented

## Layout
- Implement auto-layout as CSS Flexbox (direction, gap, padding, alignment)
- Respect fixed vs. fill vs. hug sizing modes
- Use relative units where appropriate

${frameworkReqs}

${stylingReqs}`;

  if (opts.responsive) {
    text += `

## Responsive Design
- Mobile-first approach
- Breakpoints: 640px (sm), 768px (md), 1024px (lg), 1280px (xl)
- Stack layouts vertically on small screens
- Maintain readability and touch targets`;
  }

  if (opts.additionalInstructions) {
    text += `\n\n## Additional Instructions\n${opts.additionalInstructions}`;
  }

  return text;
}

function generateOutputSection(opts: PromptOptions): string {
  const ext = getFileExtension(opts.framework);

  return `# Expected Output

Generate complete, ready-to-use code files:

1. **Component file** (\`.${ext}\`) — The main UI component
2. **Styles file** (if applicable) — CSS / module styles
3. **Type definitions** (if TypeScript) — Props and types

Output each file in a separate code block with the filename as a comment on the first line.

Do NOT generate:
- Package installations or setup instructions
- Routing logic (unless shown in the design)
- API calls or data fetching
- State management beyond local UI state`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getFrameworkName(fw: Framework): string {
  switch (fw) {
    case 'react': return 'React (TypeScript)';
    case 'nextjs': return 'Next.js (App Router, TypeScript)';
    case 'vue': return 'Vue 3 (Composition API, TypeScript)';
    case 'svelte': return 'Svelte 5';
    case 'html': return 'Vanilla HTML/CSS/JS';
  }
}

function getStylingName(styling: Styling): string {
  switch (styling) {
    case 'tailwind': return 'Tailwind CSS v4';
    case 'css-modules': return 'CSS Modules';
    case 'styled-components': return 'Styled Components';
    case 'vanilla-css': return 'Vanilla CSS';
  }
}

function getFrameworkRequirements(fw: Framework): string {
  switch (fw) {
    case 'react':
      return `## React Requirements
- Functional components with TypeScript
- Proper prop types and interfaces
- Use \`React.FC\` or explicit return types
- Decompose into reusable sub-components where logical`;
    case 'nextjs':
      return `## Next.js Requirements
- Use App Router conventions
- Mark client components with "use client" where needed
- Use next/image for images
- Use next/font for Google Fonts
- Decompose into reusable sub-components where logical`;
    case 'vue':
      return `## Vue Requirements
- Use Composition API with \`<script setup lang="ts">\`
- Proper TypeScript props with defaults
- Decompose into reusable sub-components where logical`;
    case 'svelte':
      return `## Svelte Requirements
- Use Svelte 5 runes syntax (\`$state\`, \`$derived\`)
- TypeScript in \`<script lang="ts">\`
- Decompose into reusable sub-components where logical`;
    case 'html':
      return `## HTML Requirements
- Semantic HTML5 elements
- Separate CSS file or scoped \`<style>\`
- Minimal vanilla JavaScript for interactions
- BEM naming convention for CSS classes`;
  }
}

function getStylingRequirements(styling: Styling): string {
  switch (styling) {
    case 'tailwind':
      return `## Tailwind CSS Requirements
- Use utility classes directly in markup
- Use custom values via arbitrary notation \`[value]\` when design tokens don't match defaults
- Group related utilities logically
- Use \`@apply\` sparingly, only for highly reused patterns`;
    case 'css-modules':
      return `## CSS Modules Requirements
- Use \`.module.css\` files
- camelCase class names
- Avoid global styles`;
    case 'styled-components':
      return `## Styled Components Requirements
- Use tagged template literals
- Create focused, single-purpose styled components
- Use props for dynamic styling
- Theme tokens via ThemeProvider`;
    case 'vanilla-css':
      return `## CSS Requirements
- Use CSS custom properties for design tokens
- BEM naming convention
- Logical nesting
- Mobile-first media queries`;
  }
}

function getFileExtension(fw: Framework): string {
  switch (fw) {
    case 'react':
    case 'nextjs': return 'tsx';
    case 'vue': return 'vue';
    case 'svelte': return 'svelte';
    case 'html': return 'html';
  }
}
