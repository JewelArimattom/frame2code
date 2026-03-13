/**
 * Figma REST API Type Definitions
 * Comprehensive types for Figma API responses
 */

// ─── Color ────────────────────────────────────────────────────────────────────

export interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

// ─── Paint & Effects ──────────────────────────────────────────────────────────

export type FigmaPaintType = 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'GRADIENT_ANGULAR' | 'IMAGE' | 'EMOJI';

export interface FigmaPaint {
  type: FigmaPaintType;
  visible?: boolean;
  opacity?: number;
  color?: FigmaColor;
  gradientStops?: FigmaGradientStop[];
  gradientHandlePositions?: FigmaVector[];
  scaleMode?: string;
  imageRef?: string;
  blendMode?: string;
}

export interface FigmaGradientStop {
  position: number;
  color: FigmaColor;
}

export interface FigmaVector {
  x: number;
  y: number;
}

export interface FigmaEffect {
  type: 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR';
  visible: boolean;
  radius: number;
  color?: FigmaColor;
  offset?: FigmaVector;
  spread?: number;
  blendMode?: string;
}

// ─── Typography ───────────────────────────────────────────────────────────────

export interface FigmaTypeStyle {
  fontFamily: string;
  fontPostScriptName?: string;
  fontWeight: number;
  fontSize: number;
  textAlignHorizontal?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
  textAlignVertical?: 'TOP' | 'CENTER' | 'BOTTOM';
  letterSpacing?: number;
  lineHeightPx?: number;
  lineHeightPercent?: number;
  lineHeightUnit?: string;
  textDecoration?: string;
  textCase?: string;
  italic?: boolean;
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export type FigmaLayoutMode = 'NONE' | 'HORIZONTAL' | 'VERTICAL';
export type FigmaLayoutAlign = 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'INHERIT';
export type FigmaPrimaryAxisAlignItems = 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
export type FigmaCounterAxisAlignItems = 'MIN' | 'CENTER' | 'MAX' | 'BASELINE';
export type FigmaLayoutSizingMode = 'FIXED' | 'HUG' | 'FILL';

export interface FigmaLayoutConstraint {
  vertical: 'TOP' | 'BOTTOM' | 'CENTER' | 'TOP_BOTTOM' | 'SCALE';
  horizontal: 'LEFT' | 'RIGHT' | 'CENTER' | 'LEFT_RIGHT' | 'SCALE';
}

// ─── Node Types ───────────────────────────────────────────────────────────────

export type FigmaNodeType =
  | 'DOCUMENT'
  | 'CANVAS'
  | 'FRAME'
  | 'GROUP'
  | 'VECTOR'
  | 'BOOLEAN_OPERATION'
  | 'STAR'
  | 'LINE'
  | 'ELLIPSE'
  | 'REGULAR_POLYGON'
  | 'RECTANGLE'
  | 'TEXT'
  | 'SLICE'
  | 'COMPONENT'
  | 'COMPONENT_SET'
  | 'INSTANCE'
  | 'STICKY'
  | 'SHAPE_WITH_TEXT'
  | 'CONNECTOR'
  | 'SECTION';

// ─── Figma Node ───────────────────────────────────────────────────────────────

export interface FigmaNode {
  id: string;
  name: string;
  type: FigmaNodeType;
  visible?: boolean;
  children?: FigmaNode[];

  // Geometry
  absoluteBoundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  absoluteRenderBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  // Style
  fills?: FigmaPaint[];
  strokes?: FigmaPaint[];
  strokeWeight?: number;
  strokeAlign?: 'INSIDE' | 'OUTSIDE' | 'CENTER';
  cornerRadius?: number;
  rectangleCornerRadii?: [number, number, number, number];
  opacity?: number;
  effects?: FigmaEffect[];
  blendMode?: string;

  // Layout
  layoutMode?: FigmaLayoutMode;
  primaryAxisSizingMode?: string;
  counterAxisSizingMode?: string;
  primaryAxisAlignItems?: FigmaPrimaryAxisAlignItems;
  counterAxisAlignItems?: FigmaCounterAxisAlignItems;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
  counterAxisSpacing?: number;
  layoutAlign?: FigmaLayoutAlign;
  layoutGrow?: number;
  layoutSizingHorizontal?: FigmaLayoutSizingMode;
  layoutSizingVertical?: FigmaLayoutSizingMode;
  constraints?: FigmaLayoutConstraint;

  // Text specific
  characters?: string;
  style?: FigmaTypeStyle;
  characterStyleOverrides?: number[];
  styleOverrideTable?: Record<string, Partial<FigmaTypeStyle>>;

  // Component
  componentId?: string;
  componentProperties?: Record<string, unknown>;
  overrides?: unknown[];

  // Clipping
  clipsContent?: boolean;

  // Export settings
  exportSettings?: FigmaExportSetting[];

  // Image
  imageRef?: string;
}

export interface FigmaExportSetting {
  suffix: string;
  format: 'JPG' | 'PNG' | 'SVG' | 'PDF';
  constraint: {
    type: 'SCALE' | 'WIDTH' | 'HEIGHT';
    value: number;
  };
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface FigmaFileResponse {
  name: string;
  role: string;
  lastModified: string;
  editorType: string;
  thumbnailUrl: string;
  version: string;
  document: FigmaNode;
  components: Record<string, FigmaComponent>;
  componentSets: Record<string, FigmaComponentSet>;
  styles: Record<string, FigmaStyle>;
  schemaVersion: number;
}

export interface FigmaComponent {
  key: string;
  name: string;
  description: string;
  componentSetId?: string;
  documentationLinks?: string[];
}

export interface FigmaComponentSet {
  key: string;
  name: string;
  description: string;
}

export interface FigmaStyle {
  key: string;
  name: string;
  styleType: 'FILL' | 'TEXT' | 'EFFECT' | 'GRID';
  description: string;
}

export interface FigmaNodesResponse {
  name: string;
  lastModified: string;
  thumbnailUrl: string;
  version: string;
  nodes: Record<string, {
    document: FigmaNode;
    components: Record<string, FigmaComponent>;
    styles: Record<string, FigmaStyle>;
  }>;
}

export interface FigmaImageResponse {
  err: string | null;
  images: Record<string, string | null>;
}

export interface FigmaProjectFile {
  key: string;
  name: string;
  thumbnail_url: string;
  last_modified: string;
}

export interface FigmaProjectFilesResponse {
  name: string;
  files: FigmaProjectFile[];
}

export interface FigmaUserResponse {
  id: string;
  email: string;
  handle: string;
  img_url: string;
}
