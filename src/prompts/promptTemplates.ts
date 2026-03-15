/**
 * AI Prompt Templates
 * Generates structured, optimized prompts for AI coding agents
 * to produce accurate UI code from design specifications.
 *
 * v1.1.0 improvements:
 *  - Smart JSON compaction: strips null/undefined, limits child depth for large designs
 *  - Exact asset paths: AI receives the deterministic filenames it must use in imports
 *  - Large-design summary: hierarchy overview when total elements > 60
 */

import type { DesignSpecification, DesignFrame, DesignElement, DesignTokens, AssetReference } from '../types/design';

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

// Maximum depth for the JSON tree in the prompt.  Subtrees beyond this depth
// are collapsed to { name, type, childCount } to keep the prompt manageable.
const JSON_MAX_DEPTH = 7;
// When the total visible element count exceeds this threshold we also inject a
// plain-text hierarchy overview so AI can understand the structure without
// parsing thousands of lines of JSON.
const LARGE_DESIGN_THRESHOLD = 60;

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

  // Assets — include whenever assets exist, but show "pending download" if paths are missing
  if (opts.includeAssets && spec.assets.length > 0) {
    sections.push(generateAssetsSection(spec.assets, opts.framework));
  }

  // Requirements
  sections.push(generateRequirements(opts));

  // Output format
  sections.push(generateOutputSection(opts));

  return sections.join('\n\n---\n\n');
}

// ─── Design Section ────────────────────────────────────────────────────────────

function generateDesignSection(frame: DesignFrame): string {
  const totalElements = countAllElements(frame.children);

  // Produce a compact JSON tree that stays within reasonable prompt size limits.
  const compactFrame = compactDesignTree(frame as unknown as Record<string, unknown>, JSON_MAX_DEPTH);
  const jsonStr = JSON.stringify(compactFrame, null, 2);

  const isLarge = totalElements > LARGE_DESIGN_THRESHOLD;
  const truncationNote = isLarge
    ? `\n> ⚠️  **Large design** — ${totalElements}+ elements detected. The JSON tree below is depth-limited to ${JSON_MAX_DEPTH} levels. Review the **Component Hierarchy** section below for the full structure overview.\n`
    : '';

  let section = `# Design Specification
${truncationNote}
\`\`\`json
${jsonStr}
\`\`\`

**Frame Details:**
- Name: \`${frame.name}\`
- Dimensions: ${frame.width} × ${frame.height}px
- Layout: ${frame.layout.mode === 'none' ? 'Absolute positioning' : `Flex ${frame.layout.mode}`}
- Top-level children: ${frame.children.length}
- Total visible elements: ${totalElements}`;

  // For large designs, add a plain-text hierarchy overview
  if (isLarge) {
    section += '\n\n## Component Hierarchy\n\n```\n' + buildHierarchy(frame.children, 0, 4) + '\n```';
  }

  return section;
}

/**
 * Recursively compact a design tree for AI prompts.
 * - Removes null / undefined values at every level.
 * - Beyond maxDepth, collapses children to a short summary object.
 */
function compactDesignTree(node: Record<string, unknown>, maxDepth: number, depth = 0): Record<string, unknown> {
  if (depth > maxDepth) {
    // Return minimal stub for truncated subtrees
    const stub: Record<string, unknown> = {
      name: node['name'],
      type: node['type'],
    };
    const children = node['children'];
    if (Array.isArray(children) && children.length > 0) {
      stub._childCount = children.length;
      stub._note = `Subtree truncated at depth ${maxDepth}`;
    }
    return stub;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (value === null || value === undefined) {
      continue;
    }
    if (key === 'children' && Array.isArray(value)) {
      const kids = (value as Record<string, unknown>[]).map(
        child => compactDesignTree(child, maxDepth, depth + 1)
      );
      if (kids.length > 0) {
        result.children = kids;
      }
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      const compacted = compactDesignTree(value as Record<string, unknown>, maxDepth, depth + 1);
      if (Object.keys(compacted).length > 0) {
        result[key] = compacted;
      }
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Build a plain-text indented hierarchy for large-design overviews
 */
function buildHierarchy(
  children: DesignElement[],
  depth: number,
  maxDepth: number
): string {
  const indent = '  '.repeat(depth);
  const lines: string[] = [];
  for (const child of children) {
    const label = `${indent}[${child.type}] ${child.name} (${child.width}×${child.height})`;
    lines.push(label);
    if (child.children && child.children.length > 0 && depth < maxDepth) {
      lines.push(buildHierarchy(child.children, depth + 1, maxDepth));
    } else if (child.children && child.children.length > 0) {
      lines.push(`${indent}  ... ${child.children.length} child element(s)`);
    }
  }
  return lines.join('\n');
}

function countAllElements(children: DesignElement[]): number {
  let count = children.length;
  for (const child of children) {
    if (child.children) {
      count += countAllElements(child.children);
    }
  }
  return count;
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

function generateAssetsSection(assets: AssetReference[], framework: Framework): string {
  const downloaded = assets.filter(a => a.relativePath);
  const pending = assets.filter(a => !a.relativePath);

  const lines: string[] = ['# Assets'];

  if (downloaded.length > 0) {
    lines.push('\n## Downloaded Assets — use EXACTLY these paths in your generated code\n');
    lines.push('> ⚠️  **Important:** Use the `Path` column value verbatim when writing `import`, `src=`, or `url()` references. Do NOT guess or invent filenames — they include a unique ID suffix to avoid collisions.\n');
    lines.push('| Asset Name | Type | Format | Path (workspace-relative) |');
    lines.push('|------------|------|--------|--------------------------|');
    downloaded.forEach(a => {
      lines.push(`| ${a.nodeName} | ${a.type} | ${a.format} | \`${a.relativePath}\` |`);
    });

    // Framework-specific import examples
    const example = downloaded[0];
    if (example) {
      lines.push('\n**Import example:**');
      if (framework === 'react' || framework === 'nextjs') {
        if (framework === 'nextjs' && example.type === 'image') {
          lines.push('```tsx');
          lines.push(`import Image from 'next/image';`);
          lines.push(`// <Image src="/${example.relativePath}" alt="${example.nodeName}" width={...} height={...} />`);
          lines.push('```');
        } else {
          lines.push('```tsx');
          lines.push(`import assetName from '../../${example.relativePath}'; // adjust relative path from component file`);
          lines.push('```');
        }
      } else if (framework === 'vue') {
        lines.push('```vue');
        lines.push(`<img :src="'/' + '${example.relativePath}'" alt="${example.nodeName}" />`);
        lines.push('```');
      } else {
        lines.push('```html');
        lines.push(`<img src="/${example.relativePath}" alt="${example.nodeName}" />`);
        lines.push('```');
      }
    }
  }

  if (pending.length > 0) {
    lines.push('\n## Pending Assets — not yet downloaded\n');
    lines.push('Run **Frame2Code: Download Assets** to get exact paths before generating code.\n');
    lines.push('| Asset Name | Type | Node ID |');
    lines.push('|------------|------|---------|');
    pending.forEach(a => {
      lines.push(`| ${a.nodeName} | ${a.type} | \`${a.nodeId}\` |`);
    });
  }

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
