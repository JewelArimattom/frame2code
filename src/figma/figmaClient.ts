/**
 * Figma REST API Client
 * Handles all communication with the Figma API
 */

import fetch from 'node-fetch';
import { Cache } from '../utils/cache';
import { Logger } from '../utils/logger';
import type {
  FigmaFileResponse,
  FigmaNodesResponse,
  FigmaImageResponse,
  FigmaUserResponse,
} from '../types/figma';

const FIGMA_API_BASE = 'https://api.figma.com/v1';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export class FigmaClient {
  private token: string;
  private cache: Cache;

  constructor(token: string) {
    this.token = token;
    this.cache = new Cache(5 * 60 * 1000); // 5 min cache
  }

  /**
   * Update the access token (e.g. after reconnection)
   */
  setToken(token: string): void {
    this.token = token;
    this.cache.clear();
  }

  /**
   * Verify the token is valid by fetching user info
   */
  async verifyToken(): Promise<FigmaUserResponse> {
    const response = await this.request<FigmaUserResponse>('/me');
    return response;
  }

  /**
   * Get a full Figma file
   */
  async getFile(fileKey: string): Promise<FigmaFileResponse> {
    const cacheKey = `file:${fileKey}`;
    const cached = this.cache.get<FigmaFileResponse>(cacheKey);
    if (cached) {
      Logger.debug(`Cache hit for file ${fileKey}`);
      return cached;
    }

    const response = await this.request<FigmaFileResponse>(`/files/${fileKey}`);
    this.cache.set(cacheKey, response);
    return response;
  }

  /**
   * Get specific nodes from a file
   */
  async getNodes(fileKey: string, nodeIds: string[]): Promise<FigmaNodesResponse> {
    const ids = nodeIds.join(',');
    const cacheKey = `nodes:${fileKey}:${ids}`;
    const cached = this.cache.get<FigmaNodesResponse>(cacheKey);
    if (cached) {
      Logger.debug(`Cache hit for nodes ${ids}`);
      return cached;
    }

    const response = await this.request<FigmaNodesResponse>(
      `/files/${fileKey}/nodes?ids=${encodeURIComponent(ids)}`
    );
    this.cache.set(cacheKey, response);
    return response;
  }

  /**
   * Export nodes as images
   */
  async getImages(
    fileKey: string,
    nodeIds: string[],
    format: 'svg' | 'png' | 'jpg' = 'svg',
    scale: number = 2
  ): Promise<FigmaImageResponse> {
    const ids = nodeIds.join(',');
    const cacheKey = `images:${fileKey}:${ids}:${format}:${scale}`;
    const cached = this.cache.get<FigmaImageResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const response = await this.request<FigmaImageResponse>(
      `/images/${fileKey}?ids=${encodeURIComponent(ids)}&format=${format}&scale=${scale}`
    );
    this.cache.set(cacheKey, response, 15 * 60 * 1000); // 15 min for images
    return response;
  }

  /**
   * Download an image from a URL
   */
  async downloadImage(url: string): Promise<Buffer> {
    Logger.debug(`Downloading image from ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Get image fills used in a file
   */
  async getImageFills(fileKey: string): Promise<{ images: Record<string, string> }> {
    const cacheKey = `imageFills:${fileKey}`;
    const cached = this.cache.get<{ images: Record<string, string> }>(cacheKey);
    if (cached) {
      return cached;
    }

    const response = await this.request<{ meta: { images: Record<string, string> } }>(
      `/files/${fileKey}/images`
    );
    const result = { images: response.meta?.images ?? {} };
    this.cache.set(cacheKey, result, 15 * 60 * 1000);
    return result;
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  private async request<T>(endpoint: string, retries = MAX_RETRIES): Promise<T> {
    const url = `${FIGMA_API_BASE}${endpoint}`;
    Logger.debug(`Figma API request: ${url}`);

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          headers: {
            'X-Figma-Token': this.token,
            'Content-Type': 'application/json',
          },
        });

        if (response.status === 429) {
          // Rate limited
          const retryAfter = parseInt(response.headers.get('retry-after') ?? '30', 10);
          Logger.warn(`Rate limited. Waiting ${retryAfter}s before retry ${attempt}/${retries}`);
          await this.sleep(retryAfter * 1000);
          continue;
        }

        if (!response.ok) {
          const body = await response.text();
          throw new Error(`Figma API error ${response.status}: ${body}`);
        }

        const data = (await response.json()) as T;
        return data;
      } catch (error) {
        if (attempt === retries) {
          Logger.error(`Figma API request failed after ${retries} attempts`, error);
          throw error;
        }

        Logger.warn(`Figma API request failed (attempt ${attempt}/${retries}), retrying...`);
        await this.sleep(RETRY_DELAY_MS * attempt);
      }
    }

    throw new Error('Figma API request failed: max retries exceeded');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
