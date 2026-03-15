/**
 * Parsed Design Types
 * AI-friendly structured design data output from the Figma parser
 */

// ─── Design Specification ─────────────────────────────────────────────────────

export interface DesignSpecification {
  /** File metadata */
  file: {
    name: string;
    key: string;
    lastModified: string;
    version: string;
  };
  /** Root frame data */
  frame: DesignFrame;
  /** Extracted design tokens */
  designTokens: DesignTokens;
  /** Asset references */
  assets: AssetReference[];
}

// ─── Design Frame ─────────────────────────────────────────────────────────────

export interface DesignFrame {
  id: string;
  name: string;
  width: number;
  height: number;
  layout: LayoutInfo;
  background?: ColorValue;
  borderRadius?: BorderRadius;
  overflow?: 'hidden' | 'visible';
  opacity?: number;
  children: DesignElement[];
}

// ─── Design Elements ──────────────────────────────────────────────────────────

export type DesignElementType =
  | 'container'
  | 'text'
  | 'image'
  | 'icon'
  | 'button'
  | 'input'
  | 'vector'
  | 'group'
  | 'component'
  | 'unknown';

export interface DesignElement {
  id: string;
  name: string;
  type: DesignElementType;
  visible: boolean;

  // Position & Size
  width: number;
  height: number;
  x: number;
  y: number;

  // Auto Layout / Flex properties
  layout?: LayoutInfo;
  layoutSelf?: LayoutSelfInfo;

  // Styling
  background?: ColorValue;
  border?: BorderInfo;
  borderRadius?: BorderRadius;
  shadow?: ShadowInfo[];
  opacity?: number;
  blur?: number;

  // Text-specific
  text?: TextInfo;

  // Image-specific
  imageRef?: string;
  assetPath?: string;

  // Component info
  componentName?: string;
  componentId?: string;
  isInstance?: boolean;

  // Children
  children?: DesignElement[];
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export interface LayoutInfo {
  mode: 'none' | 'horizontal' | 'vertical';
  justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between';
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'baseline' | 'stretch';
  gap?: number;
  counterAxisGap?: number;
  padding?: PaddingInfo;
  wrap?: boolean;
}

export interface LayoutSelfInfo {
  align?: 'auto' | 'flex-start' | 'center' | 'flex-end' | 'stretch';
  flexGrow?: number;
  sizing?: {
    horizontal: 'fixed' | 'hug' | 'fill';
    vertical: 'fixed' | 'hug' | 'fill';
  };
}

export interface PaddingInfo {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// ─── Colors ───────────────────────────────────────────────────────────────────

export interface ColorValue {
  type: 'solid' | 'gradient' | 'image';
  /** hex string for solid, gradient string for gradients */
  value: string;
  opacity?: number;
}

// ─── Border ───────────────────────────────────────────────────────────────────

export interface BorderInfo {
  color: string;
  width: number;
  style: 'solid' | 'dashed' | 'dotted';
  position: 'inside' | 'outside' | 'center';
}

export interface BorderRadius {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
}

// ─── Shadow ───────────────────────────────────────────────────────────────────

export interface ShadowInfo {
  type: 'drop' | 'inner';
  color: string;
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
}

// ─── Text ─────────────────────────────────────────────────────────────────────

export interface TextInfo {
  content: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight?: number;
  letterSpacing?: number;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  verticalAlign?: 'top' | 'center' | 'bottom';
  color: string;
  textDecoration?: 'none' | 'underline' | 'line-through';
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  italic?: boolean;
}

// ─── Design Tokens ────────────────────────────────────────────────────────────

export interface DesignTokens {
  colors: ColorToken[];
  typography: TypographyToken[];
  spacing: number[];
  borderRadii: number[];
}

export interface ColorToken {
  name: string;
  hex: string;
  rgba: string;
  usage: 'background' | 'text' | 'border' | 'fill' | 'other';
}

export interface TypographyToken {
  name: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight?: number;
  letterSpacing?: number;
}

// ─── Assets ───────────────────────────────────────────────────────────────────

export interface AssetReference {
  nodeId: string;
  nodeName: string;
  type: 'image' | 'icon' | 'vector';
  format: 'svg' | 'png' | 'jpg';
  /** Absolute path on disk (set after download) */
  localPath?: string;
  /** Workspace-relative forward-slash path, e.g. "assets/icons/icon-arrow-1a2b3c4d.svg" (set after download) */
  relativePath?: string;
  /** The sanitized filename on disk, e.g. "icon-arrow-1a2b3c4d.svg" */
  fileName?: string;
  downloadUrl?: string;
}

// ─── Extension State ──────────────────────────────────────────────────────────

export interface ExtensionState {
  isConnected: boolean;
  currentFileKey?: string;
  currentFileName?: string;
  selectedFrameId?: string;
  selectedFrameName?: string;
  lastSyncTime?: string;
  syncedData?: DesignSpecification;
  downloadedAssets?: AssetReference[];
}
