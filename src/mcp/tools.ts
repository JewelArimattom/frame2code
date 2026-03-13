/**
 * MCP Tool Definitions
 * Defines all tools exposed to AI agents via the MCP server
 */

import { z } from 'zod';

// ─── Tool Schemas ─────────────────────────────────────────────────────────────

export const GetFigmaDataSchema = z.object({
  frameId: z.string().optional().describe('Optional specific frame ID. If omitted, returns data for the currently selected frame.'),
});

export const GetFrameListSchema = z.object({});

export const GetFrameDesignSchema = z.object({
  frameId: z.string().describe('The ID of the frame to get the design for'),
});

export const GetDesignTokensSchema = z.object({});

export const GetAssetsSchema = z.object({
  format: z.enum(['svg', 'png', 'jpg']).optional().describe('Filter assets by format'),
});

export const GenerateCodePromptSchema = z.object({
  framework: z.enum(['react', 'nextjs', 'vue', 'svelte', 'html'])
    .default('react')
    .describe('Target framework for code generation'),
  styling: z.enum(['tailwind', 'css-modules', 'styled-components', 'vanilla-css'])
    .default('tailwind')
    .describe('Styling approach for generated code'),
  frameId: z.string().optional()
    .describe('Optional specific frame ID. If omitted, uses the currently selected frame.'),
  responsive: z.boolean().default(true)
    .describe('Whether to include responsive design requirements'),
  additionalInstructions: z.string().optional()
    .describe('Additional custom instructions for the AI'),
});

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const TOOL_DEFINITIONS = [
  {
    name: 'get_figma_data',
    description: 'Get the full structured design data for the synced Figma file. Returns the parsed design specification including layout, components, styles, and hierarchy. Use this as the primary source of design information.',
    schema: GetFigmaDataSchema,
  },
  {
    name: 'get_frame_list',
    description: 'List all top-level frames (pages/screens) in the synced Figma file. Returns frame names and IDs. Use this to discover available frames before requesting specific frame designs.',
    schema: GetFrameListSchema,
  },
  {
    name: 'get_frame_design',
    description: 'Get the parsed design for a specific frame by ID. Returns the complete design specification for that frame including all child elements, layout, and styles.',
    schema: GetFrameDesignSchema,
  },
  {
    name: 'get_design_tokens',
    description: 'Extract design tokens (colors, typography, spacing, border radii) from the synced design. Use these tokens to maintain design consistency in generated code.',
    schema: GetDesignTokensSchema,
  },
  {
    name: 'get_assets',
    description: 'List all exported design assets (images, icons, vectors) with their local file paths. Use these paths to reference assets in generated code.',
    schema: GetAssetsSchema,
  },
  {
    name: 'generate_code_prompt',
    description: 'Generate an optimized AI prompt for code generation based on the design specification. The prompt includes the design spec, design tokens, asset references, and framework-specific requirements. You can use this prompt directly or adapt it.',
    schema: GenerateCodePromptSchema,
  },
] as const;
