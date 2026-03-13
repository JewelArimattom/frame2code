/**
 * MCP Server
 * Exposes design data to AI agents via the Model Context Protocol.
 * Uses stdio transport — lifecycle is tied to the VS Code extension process.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Logger } from '../utils/logger';
import { DesignParser } from '../figma/designParser';
import { FigmaClient } from '../figma/figmaClient';
import { generatePrompt, type Framework, type Styling } from '../prompts/promptTemplates';
import {
  GetFigmaDataSchema,
  GetFrameListSchema,
  GetFrameDesignSchema,
  GetDesignTokensSchema,
  GetAssetsSchema,
  GenerateCodePromptSchema,
} from './tools';
import type {
  DesignSpecification,
  DesignFrame,
  AssetReference,
  ExtensionState,
} from '../types/design';
import type { FigmaNode } from '../types/figma';

export class Frame2CodeMcpServer {
  private server: McpServer;
  private transport: StdioServerTransport | null = null;
  private isRunning = false;

  // Shared state from the extension
  private state: ExtensionState = { isConnected: false };
  private figmaClient: FigmaClient | null = null;
  private parser: DesignParser;

  // Cached parsed frames
  private parsedFrames: Map<string, DesignFrame> = new Map();

  constructor() {
    this.parser = new DesignParser();

    this.server = new McpServer({
      name: 'frame2code',
      version: '1.0.0',
    });

    this.registerTools();
  }

  /**
   * Start the MCP server with stdio transport
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      Logger.warn('MCP server is already running');
      return;
    }

    try {
      this.transport = new StdioServerTransport();
      await this.server.connect(this.transport);
      this.isRunning = true;
      Logger.info('MCP server started (stdio transport)');
    } catch (error) {
      Logger.error('Failed to start MCP server', error);
      throw error;
    }
  }

  /**
   * Stop the MCP server
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      await this.server.close();
      this.isRunning = false;
      this.transport = null;
      Logger.info('MCP server stopped');
    } catch (error) {
      Logger.error('Failed to stop MCP server', error);
    }
  }

  /**
   * Update shared state from the extension
   */
  updateState(state: Partial<ExtensionState>): void {
    this.state = { ...this.state, ...state };
  }

  /**
   * Update the Figma client reference
   */
  setFigmaClient(client: FigmaClient): void {
    this.figmaClient = client;
  }

  /**
   * Store a parsed frame
   */
  cacheFrame(frameId: string, frame: DesignFrame): void {
    this.parsedFrames.set(frameId, frame);
  }

  get running(): boolean {
    return this.isRunning;
  }

  // ─── Tool Registration ────────────────────────────────────────────────────

  private registerTools(): void {
    // get_figma_data
    this.server.tool(
      'get_figma_data',
      'Get the full structured design data for the synced Figma file. Returns the parsed design specification including layout, components, styles, and hierarchy.',
      GetFigmaDataSchema.shape,
      async (params) => {
        try {
          const spec = this.getDesignSpec(params.frameId);
          if (!spec) {
            return {
              content: [{ type: 'text' as const, text: 'No design data available. Please sync a Figma file first using the "Frame2Code: Sync Design" command.' }],
            };
          }
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(spec, null, 2) }],
          };
        } catch (error) {
          return this.errorResponse(error);
        }
      }
    );

    // get_frame_list
    this.server.tool(
      'get_frame_list',
      'List all top-level frames (pages/screens) in the synced Figma file.',
      async () => {
        try {
          if (!this.state.syncedData) {
            return {
              content: [{ type: 'text' as const, text: 'No file synced. Use "Frame2Code: Sync Design" first.' }],
            };
          }

          const frames = this.getTopLevelFrames();
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(frames, null, 2) }],
          };
        } catch (error) {
          return this.errorResponse(error);
        }
      }
    );

    // get_frame_design
    this.server.tool(
      'get_frame_design',
      'Get the parsed design for a specific frame by ID.',
      GetFrameDesignSchema.shape,
      async (params) => {
        try {
          const frame = this.parsedFrames.get(params.frameId);
          if (!frame) {
            // Try to parse on-the-fly if we have the file data
            const parsed = await this.parseFrameById(params.frameId);
            if (!parsed) {
              return {
                content: [{ type: 'text' as const, text: `Frame not found: ${params.frameId}. Use get_frame_list to see available frames.` }],
              };
            }
            return {
              content: [{ type: 'text' as const, text: JSON.stringify(parsed, null, 2) }],
            };
          }
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(frame, null, 2) }],
          };
        } catch (error) {
          return this.errorResponse(error);
        }
      }
    );

    // get_design_tokens
    this.server.tool(
      'get_design_tokens',
      'Extract design tokens (colors, typography, spacing, border radii) from the synced design.',
      async () => {
        try {
          if (!this.state.syncedData) {
            return {
              content: [{ type: 'text' as const, text: 'No design data available. Sync a Figma file first.' }],
            };
          }
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(this.state.syncedData.designTokens, null, 2) }],
          };
        } catch (error) {
          return this.errorResponse(error);
        }
      }
    );

    // get_assets
    this.server.tool(
      'get_assets',
      'List all exported design assets (images, icons, vectors) with their local file paths.',
      GetAssetsSchema.shape,
      async (params) => {
        try {
          let assets = this.state.downloadedAssets ?? this.state.syncedData?.assets ?? [];
          if (params.format) {
            assets = assets.filter(a => a.format === params.format);
          }

          if (assets.length === 0) {
            return {
              content: [{ type: 'text' as const, text: 'No assets available. Use "Frame2Code: Download Assets" to export design assets.' }],
            };
          }

          return {
            content: [{ type: 'text' as const, text: JSON.stringify(assets, null, 2) }],
          };
        } catch (error) {
          return this.errorResponse(error);
        }
      }
    );

    // generate_code_prompt
    this.server.tool(
      'generate_code_prompt',
      'Generate an optimized AI prompt for code generation based on the design specification.',
      GenerateCodePromptSchema.shape,
      async (params) => {
        try {
          const spec = this.getDesignSpec(params.frameId);
          if (!spec) {
            return {
              content: [{ type: 'text' as const, text: 'No design data available. Sync a Figma file first.' }],
            };
          }

          const prompt = generatePrompt(spec, {
            framework: params.framework as Framework,
            styling: params.styling as Styling,
            responsive: params.responsive,
            additionalInstructions: params.additionalInstructions,
          });

          return {
            content: [{ type: 'text' as const, text: prompt }],
          };
        } catch (error) {
          return this.errorResponse(error);
        }
      }
    );

    Logger.info('MCP tools registered: get_figma_data, get_frame_list, get_frame_design, get_design_tokens, get_assets, generate_code_prompt');
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private getDesignSpec(frameId?: string): DesignSpecification | null {
    if (!this.state.syncedData) {
      return null;
    }

    if (frameId) {
      const frame = this.parsedFrames.get(frameId);
      if (frame) {
        return {
          ...this.state.syncedData,
          frame,
        };
      }
    }

    return this.state.syncedData;
  }

  private getTopLevelFrames(): Array<{ id: string; name: string; width: number; height: number }> {
    const frames: Array<{ id: string; name: string; width: number; height: number }> = [];

    // Return cached parsed frames
    for (const [id, frame] of this.parsedFrames) {
      frames.push({
        id,
        name: frame.name,
        width: frame.width,
        height: frame.height,
      });
    }

    // Also include the main synced frame if not already listed
    if (this.state.syncedData?.frame) {
      const mainFrame = this.state.syncedData.frame;
      if (!frames.some(f => f.id === mainFrame.id)) {
        frames.push({
          id: mainFrame.id,
          name: mainFrame.name,
          width: mainFrame.width,
          height: mainFrame.height,
        });
      }
    }

    return frames;
  }

  private async parseFrameById(frameId: string): Promise<DesignFrame | null> {
    if (!this.figmaClient || !this.state.currentFileKey) {
      return null;
    }

    try {
      const nodesResponse = await this.figmaClient.getNodes(this.state.currentFileKey, [frameId]);
      const nodeData = nodesResponse.nodes[frameId];
      if (!nodeData?.document) {
        return null;
      }

      const frame = this.parser.parseFrame(nodeData.document);
      this.parsedFrames.set(frameId, frame);
      return frame;
    } catch (error) {
      Logger.error(`Failed to parse frame ${frameId}`, error);
      return null;
    }
  }

  private errorResponse(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text' as const, text: `Error: ${message}` }],
      isError: true,
    };
  }
}
