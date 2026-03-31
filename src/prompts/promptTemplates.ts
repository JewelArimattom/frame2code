/**
 * AI Prompt Templates
 * Generates structured, optimized prompts for AI coding agents
 * to produce accurate UI code from design specifications
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

You are a senior frontend engineer specializing in ${frameworkName} and ${stylingName}. Your task is to convert a Figma design specification into production-ready code that is **100% visually identical** to the original design.

**IMPORTANT: You must CREATE NEW FILES or EDIT/UPDATE EXISTING FILES** as needed to implement this design. Do not just provide code snippets — generate complete, ready-to-use files that can be saved directly to the project.

**Technology Stack:**
- Framework: ${frameworkName}
- Styling: ${stylingName}
- Responsive: ${opts.responsive ? 'Yes' : 'No'}

**Your Goal:**
Produce code that renders a UI **indistinguishable from the Figma design**. Every pixel, every spacing value, every color, every font size, every shadow, every border radius must match exactly. The generated UI should look like a screenshot of the Figma design.`;
}

function generateDesignSection(frame: DesignFrame): string {
  // Create a clean version of the frame data for the prompt
  const cleanFrame = JSON.stringify(frame, null, 2);
  const elementCount = countAllElements(frame);
  const hasSmallElements = detectSmallElements(frame);

  let section = `# Design Specification

\`\`\`json
${cleanFrame}
\`\`\`

**Frame Details:**
- Name: \`${frame.name}\`
- Dimensions: ${frame.width} × ${frame.height}px
- Layout: ${frame.layout.mode === 'none' ? 'Absolute positioning' : `Flex ${frame.layout.mode}`}
- Total Elements: ${elementCount} (including nested children)
- Children: ${frame.children.length} direct children`;

  if (hasSmallElements) {
    section += `

## ⚠️ COMPLEX COMPOSITE DESIGN DETECTED

This design contains **small or intricate components** that are composed of many small parts (icons, badges, micro-layouts, etc.). Pay extra attention to:

1. **Precise Positioning**: Small elements (< 32px) must be positioned with pixel-perfect accuracy. Use exact \`x\` and \`y\` coordinates from the specification.
2. **Composite Icons/Graphics**: Some "images" are actually made up of multiple vector shapes or small elements layered together. Preserve their exact arrangement.
3. **Z-Index Ordering**: Respect the order of elements in the \`children\` array — earlier elements are below, later elements are on top.
4. **Micro-Spacing**: Tiny gaps (1-4px) between elements are intentional. Do NOT round or approximate these values.
5. **Grouped Elements**: Small parts that form a single visual unit should be wrapped in a container with \`position: relative\` and children use \`position: absolute\` with exact coordinates.
6. **Scale Accuracy**: Do not scale, resize, or "improve" small element sizes. Use the EXACT dimensions from the spec.`;
  }

  return section;
}

/**
 * Count all elements including deeply nested children
 */
function countAllElements(frame: DesignFrame): number {
  let count = 0;
  function countChildren(children: DesignElement[]) {
    for (const child of children) {
      count++;
      if (child.children && child.children.length > 0) {
        countChildren(child.children);
      }
    }
  }
  countChildren(frame.children);
  return count;
}

/**
 * Detect if the design has small/intricate elements that need special handling
 */
function detectSmallElements(frame: DesignFrame): boolean {
  let hasSmall = false;
  const SMALL_THRESHOLD = 32;
  const MICRO_THRESHOLD = 16;
  let microCount = 0;

  function checkChildren(children: DesignElement[]) {
    for (const child of children) {
      if (child.width < SMALL_THRESHOLD || child.height < SMALL_THRESHOLD) {
        hasSmall = true;
      }
      if (child.width < MICRO_THRESHOLD || child.height < MICRO_THRESHOLD) {
        microCount++;
      }
      if (child.children && child.children.length > 0) {
        checkChildren(child.children);
      }
    }
  }
  checkChildren(frame.children);

  // Consider complex if there are many micro elements or any small element
  return hasSmall || microCount > 5;
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

## 🎯 CRITICAL: 100% Design Fidelity

**The generated code MUST produce a UI that is visually IDENTICAL to the Figma design.** This means:

- **Every measurement is exact**: Do not round 17px to 16px, do not approximate 23px to 24px. Use the EXACT values from the specification.
- **Every color is exact**: Use the exact hex/rgba values provided. No "close enough" colors.
- **Every font property is exact**: Font family, size, weight, line-height, letter-spacing — all must match precisely.
- **Every spacing is exact**: Margins, padding, gaps between elements — pixel-perfect accuracy required.
- **Every shadow is exact**: Box shadows with correct offset, blur, spread, and color.
- **Every border is exact**: Border width, style, color, and radius — no approximations.

**If you compare a screenshot of your rendered code to the Figma design, they should be indistinguishable.**

## File Operations

**You must CREATE or EDIT files to implement this design:**
- If the file doesn't exist → CREATE a new file with the complete code
- If the file exists → EDIT/UPDATE the existing file to match the new design
- Always output complete, runnable code — not partial snippets
- Include ALL imports, exports, and type definitions needed

## General
- Production-quality, clean, readable code
- Proper component hierarchy matching the design structure
- Accessible (ARIA labels, semantic HTML, keyboard navigation where appropriate)
- No placeholder or TODO comments — everything must be fully implemented
- No approximations, estimates, or "close enough" values

## Layout Precision
- Implement auto-layout as CSS Flexbox (direction, gap, padding, alignment)
- For \`layout.mode: "none"\` (absolute positioning), use \`position: absolute\` with exact \`top\`/\`left\` values from \`x\`/\`y\` coordinates
- Respect sizing modes precisely:
  - \`fixed\`: Use exact pixel width/height
  - \`hug\`: Use \`width: fit-content\` or \`width: auto\`
  - \`fill\`: Use \`flex: 1\` or \`width: 100%\` (context-dependent)
- Preserve the EXACT gap values from \`layout.gap\`
- Preserve the EXACT padding values from \`layout.padding\`

## Handling Small & Composite Elements

When dealing with small elements (icons, badges, decorations) or composite designs made of many parts:

1. **Use exact coordinates**: Small elements with \`x\` and \`y\` values must be positioned using those exact coordinates
2. **Preserve layering**: The order of children in the JSON represents z-order. Maintain this stacking order in your code.
3. **Don't "optimize" small values**: If spacing is 3px, use 3px. Don't round to 4px for "cleaner" code.
4. **Group related small parts**: Wrap tightly-coupled small elements in a positioned container
5. **Icons and vectors**: If an icon is composed of multiple shapes, consider using the exported SVG asset or recreating the exact structure

${frameworkReqs}

${stylingReqs}`;

  if (opts.responsive) {
    text += `

## Responsive Design
- Mobile-first approach
- Breakpoints: 640px (sm), 768px (md), 1024px (lg), 1280px (xl)
- Stack layouts vertically on small screens where appropriate
- Maintain readability and touch targets
- **Note**: The design specification shows the desktop/base design. Adapt thoughtfully for smaller screens while preserving the design's visual intent.`;
  }

  if (opts.additionalInstructions) {
    text += `\n\n## Additional Instructions\n${opts.additionalInstructions}`;
  }

  return text;
}

function generateOutputSection(opts: PromptOptions): string {
  const ext = getFileExtension(opts.framework);
  const componentPath = opts.framework === 'nextjs' ? 'components/' : 'src/components/';

  return `# Expected Output

## 📁 FILE OPERATIONS REQUIRED

**CREATE or EDIT the following files to implement this design:**

### Primary Files:
1. **Component file** (\`${componentPath}[ComponentName].${ext}\`)
   - The main UI component with full implementation
   - Include ALL imports at the top
   - Include ALL TypeScript types/interfaces
   - Export the component properly

2. **Styles file** (if applicable)
   - For CSS Modules: \`${componentPath}[ComponentName].module.css\`
   - For Vanilla CSS: \`${componentPath}[ComponentName].css\`
   - Include ALL style rules needed to match the design exactly

3. **Type definitions** (if TypeScript and complex props)
   - \`${componentPath}[ComponentName].types.ts\` (optional, can be inline)

### File Output Format:

For EACH file, output a code block with the filepath on the first line as a comment:

\`\`\`${ext}
// filepath: ${componentPath}MyComponent.${ext}
import React from 'react';
// ... complete component code ...
\`\`\`

\`\`\`css
/* filepath: ${componentPath}MyComponent.module.css */
.container {
  /* ... complete styles ... */
}
\`\`\`

## Quality Checklist

Before finishing, verify your code meets these criteria:
- [ ] All dimensions match the spec exactly (no rounding)
- [ ] All colors match the spec exactly (use provided hex values)
- [ ] All spacing (padding, margin, gap) matches exactly
- [ ] All typography (font-family, size, weight, line-height) matches exactly
- [ ] All borders and shadows match exactly
- [ ] Small elements are positioned precisely
- [ ] Component hierarchy reflects the design structure
- [ ] Code is complete and runnable (no TODOs or placeholders)

## Do NOT Generate:
- Package installation commands or setup instructions
- Routing logic (unless explicitly shown in the design)
- API calls or data fetching logic
- Global state management
- Build configuration changes`;
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
- **CRITICAL: Use arbitrary values \`[Xpx]\` for EXACT measurements** that don't match Tailwind defaults
  - Example: \`w-[347px]\` instead of rounding to \`w-80\` (320px)
  - Example: \`gap-[13px]\` instead of approximating to \`gap-3\` (12px)
  - Example: \`text-[17px]\` instead of rounding to \`text-lg\` (18px)
- Use arbitrary colors for exact hex values: \`bg-[#1E40AF]\`, \`text-[#6B7280]\`
- Group related utilities logically (layout → sizing → spacing → colors → typography)
- Use \`@apply\` sparingly, only for highly reused patterns
- For absolute positioning within flex containers, use \`relative\` parent + \`absolute\` children`;
    case 'css-modules':
      return `## CSS Modules Requirements
- Use \`.module.css\` files
- camelCase class names in JavaScript: \`styles.containerWrapper\`
- **Use exact pixel values**: \`width: 347px;\` not \`width: 350px;\`
- Define CSS custom properties for repeated values (colors, spacing)
- Avoid global styles — all styles should be scoped`;
    case 'styled-components':
      return `## Styled Components Requirements
- Use tagged template literals
- Create focused, single-purpose styled components
- Use props for dynamic styling variations
- **Use exact pixel values from the spec** — no rounding
- Define theme constants for colors and typography from the design tokens
- Example: \`padding: 17px 23px;\` not \`padding: 16px 24px;\``;
    case 'vanilla-css':
      return `## CSS Requirements
- Use CSS custom properties (variables) for design tokens (colors, spacing, typography)
- **Use exact pixel values**: \`width: 347px;\` not \`width: 350px;\`
- BEM naming convention: \`.block__element--modifier\`
- Logical property grouping in declarations (display → position → size → spacing → visual)
- Mobile-first media queries (if responsive is enabled)
- Example of exactness required: \`margin: 17px 23px 19px 21px;\` — use the EXACT values from spec`;
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
