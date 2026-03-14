/**
 * Design Parser
 * Converts raw Figma JSON nodes into AI-friendly structured design data.
 * This is the heart of Frame2Code — it translates complex Figma data
 * into clean, semantic design specs that AI agents can understand.
 */

import { Logger } from '../utils/logger';
import type { FigmaNode, FigmaColor, FigmaPaint, FigmaEffect } from '../types/figma';
import type {
  DesignFrame,
  DesignElement,
  DesignElementType,
  LayoutInfo,
  LayoutSelfInfo,
  ColorValue,
  BorderInfo,
  BorderRadius,
  ShadowInfo,
  TextInfo,
  DesignTokens,
  ColorToken,
  TypographyToken,
  AssetReference,
} from '../types/design';

export class DesignParser {
  /** Maximum recursion depth to prevent stack overflows on deeply nested designs */
  private static readonly MAX_DEPTH = 10;
  /** Cap total parsed elements to keep AI prompts within reasonable context limits */
  private static readonly MAX_ELEMENTS = 500;

  private colorTokens: Map<string, ColorToken> = new Map();
  private typographyTokens: Map<string, TypographyToken> = new Map();
  private spacingValues: Set<number> = new Set();
  private borderRadiusValues: Set<number> = new Set();
  private assetReferences: AssetReference[] = [];
  private elementCount = 0;

  /**
   * Parse a Figma frame node into a DesignFrame
   */
  parseFrame(node: FigmaNode): DesignFrame {
    Logger.info(`Parsing frame: ${node.name} (${node.id})`);

    // Reset token collectors
    this.colorTokens.clear();
    this.typographyTokens.clear();
    this.spacingValues.clear();
    this.borderRadiusValues.clear();
    this.assetReferences = [];
    this.elementCount = 0;

    const bounds = node.absoluteBoundingBox;
    const frame: DesignFrame = {
      id: node.id,
      name: node.name,
      width: bounds?.width ?? 0,
      height: bounds?.height ?? 0,
      layout: this.parseLayout(node),
      background: this.parseBackground(node.fills),
      borderRadius: this.parseBorderRadius(node),
      overflow: node.clipsContent ? 'hidden' : 'visible',
      opacity: node.opacity,
      children: this.parseChildren(node.children ?? [], node, 0),
    };

    return frame;
  }

  /**
   * Extract design tokens from the parsed data
   */
  extractDesignTokens(): DesignTokens {
    return {
      colors: Array.from(this.colorTokens.values()),
      typography: Array.from(this.typographyTokens.values()),
      spacing: Array.from(this.spacingValues).sort((a, b) => a - b),
      borderRadii: Array.from(this.borderRadiusValues).sort((a, b) => a - b),
    };
  }

  /**
   * Get collected asset references
   */
  getAssetReferences(): AssetReference[] {
    return this.assetReferences;
  }

  /**
   * Total elements parsed (may be capped at MAX_ELEMENTS for very large designs)
   */
  getTotalElementCount(): number {
    return this.elementCount;
  }

  isTruncated(): boolean {
    return this.elementCount >= DesignParser.MAX_ELEMENTS;
  }

  // ─── Children Parsing ──────────────────────────────────────────────────────

  private parseChildren(children: FigmaNode[], parent: FigmaNode, depth: number): DesignElement[] {
    if (depth >= DesignParser.MAX_DEPTH) {
      Logger.debug(`Max depth (${DesignParser.MAX_DEPTH}) reached at node ${parent.name} — subtree truncated`);
      return [];
    }
    return children
      .filter(child => child.visible !== false)
      .map(child => this.parseElement(child, parent, depth))
      .filter((el): el is DesignElement => el !== null);
  }

  private parseElement(node: FigmaNode, parent: FigmaNode, depth: number): DesignElement | null {
    this.elementCount++;
    if (this.elementCount > DesignParser.MAX_ELEMENTS) {
      // Hard cap — return a sentinel so the caller can summarize
      return null;
    }
    const bounds = node.absoluteBoundingBox;
    const parentBounds = parent.absoluteBoundingBox;

    // Calculate relative position
    const x = (bounds?.x ?? 0) - (parentBounds?.x ?? 0);
    const y = (bounds?.y ?? 0) - (parentBounds?.y ?? 0);

    const element: DesignElement = {
      id: node.id,
      name: node.name,
      type: this.detectElementType(node),
      visible: node.visible !== false,
      width: bounds?.width ?? 0,
      height: bounds?.height ?? 0,
      x: Math.round(x),
      y: Math.round(y),
    };

    // Layout properties
    const layout = this.parseLayout(node);
    if (layout.mode !== 'none') {
      element.layout = layout;
    }

    // Layout self (how this element behaves inside parent's auto layout)
    const layoutSelf = this.parseLayoutSelf(node);
    if (layoutSelf) {
      element.layoutSelf = layoutSelf;
    }

    // Background
    const bg = this.parseBackground(node.fills);
    if (bg) {
      element.background = bg;
    }

    // Border
    const border = this.parseBorder(node);
    if (border) {
      element.border = border;
    }

    // Border radius
    const radius = this.parseBorderRadius(node);
    if (radius) {
      element.borderRadius = radius;
    }

    // Shadows
    const shadows = this.parseShadows(node.effects);
    if (shadows.length > 0) {
      element.shadow = shadows;
    }

    // Opacity
    if (node.opacity !== undefined && node.opacity !== 1) {
      element.opacity = node.opacity;
    }

    // Blur
    const blur = this.parseBlur(node.effects);
    if (blur) {
      element.blur = blur;
    }

    // Text properties
    if (node.type === 'TEXT' && node.characters) {
      element.text = this.parseText(node);
    }

    // Image detection
    if (this.isImageNode(node)) {
      element.imageRef = this.getImageRef(node);
      this.assetReferences.push({
        nodeId: node.id,
        nodeName: node.name,
        type: 'image',
        format: 'png',
      });
    }

    // Icon / Vector detection
    if (this.isIconNode(node)) {
      this.assetReferences.push({
        nodeId: node.id,
        nodeName: node.name,
        type: 'icon',
        format: 'svg',
      });
    }

    // Component info
    if (node.type === 'INSTANCE' && node.componentId) {
      element.isInstance = true;
      element.componentId = node.componentId;
    }
    if (node.type === 'COMPONENT') {
      element.componentName = node.name;
    }

    // Recursive children
    if (node.children && node.children.length > 0) {
      if (this.elementCount < DesignParser.MAX_ELEMENTS) {
        const parsed = this.parseChildren(node.children, node, depth + 1);
        if (parsed.length > 0) {
          element.children = parsed;
        }
        // Note when we couldn't parse all children due to the element cap
        const unparsed = node.children.filter(c => c.visible !== false).length - parsed.length;
        if (unparsed > 0) {
          (element as DesignElement & { _truncatedChildren?: number })._truncatedChildren = unparsed;
        }
      } else {
        // At element cap — just record how many children were skipped
        (element as DesignElement & { _truncatedChildren?: number })._truncatedChildren =
          node.children.filter(c => c.visible !== false).length;
      }
    }

    return element;
  }

  // ─── Element Type Detection ────────────────────────────────────────────────

  private detectElementType(node: FigmaNode): DesignElementType {
    const name = node.name.toLowerCase();

    // Text node
    if (node.type === 'TEXT') {
      return 'text';
    }

    // Component or instance
    if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
      return 'component';
    }
    if (node.type === 'INSTANCE') {
      // Try to detect specific component types from name
      if (this.matchesPattern(name, ['button', 'btn', 'cta'])) {
        return 'button';
      }
      if (this.matchesPattern(name, ['input', 'textfield', 'text field', 'text-field', 'textarea', 'search'])) {
        return 'input';
      }
      return 'component';
    }

    // Vector/icon
    if (node.type === 'VECTOR' || node.type === 'BOOLEAN_OPERATION' ||
        node.type === 'STAR' || node.type === 'LINE' ||
        node.type === 'ELLIPSE' || node.type === 'REGULAR_POLYGON') {
      if (this.isIconNode(node)) {
        return 'icon';
      }
      return 'vector';
    }

    // Image fill detection
    if (this.isImageNode(node)) {
      return 'image';
    }

    // Name-based heuristics for frames/groups
    if (node.type === 'FRAME' || node.type === 'GROUP' || node.type === 'RECTANGLE') {
      if (this.matchesPattern(name, ['button', 'btn', 'cta'])) {
        return 'button';
      }
      if (this.matchesPattern(name, ['input', 'textfield', 'text field', 'text-field', 'textarea', 'search bar'])) {
        return 'input';
      }
      if (this.matchesPattern(name, ['image', 'img', 'photo', 'avatar', 'thumbnail', 'hero'])) {
        return 'image';
      }
      if (this.matchesPattern(name, ['icon', 'ico', 'svg'])) {
        return 'icon';
      }
    }

    // Group
    if (node.type === 'GROUP') {
      return 'group';
    }

    // Default to container for frames with children
    if (node.children && node.children.length > 0) {
      return 'container';
    }

    return 'unknown';
  }

  private matchesPattern(name: string, patterns: string[]): boolean {
    return patterns.some(p => name.includes(p));
  }

  // ─── Layout Parsing ────────────────────────────────────────────────────────

  private parseLayout(node: FigmaNode): LayoutInfo {
    const layout: LayoutInfo = {
      mode: 'none',
    };

    if (!node.layoutMode || node.layoutMode === 'NONE') {
      return layout;
    }

    layout.mode = node.layoutMode === 'HORIZONTAL' ? 'horizontal' : 'vertical';

    // Justify content (primary axis)
    switch (node.primaryAxisAlignItems) {
      case 'MIN': layout.justifyContent = 'flex-start'; break;
      case 'CENTER': layout.justifyContent = 'center'; break;
      case 'MAX': layout.justifyContent = 'flex-end'; break;
      case 'SPACE_BETWEEN': layout.justifyContent = 'space-between'; break;
    }

    // Align items (counter axis)
    switch (node.counterAxisAlignItems) {
      case 'MIN': layout.alignItems = 'flex-start'; break;
      case 'CENTER': layout.alignItems = 'center'; break;
      case 'MAX': layout.alignItems = 'flex-end'; break;
      case 'BASELINE': layout.alignItems = 'baseline'; break;
    }

    // Gap
    if (node.itemSpacing !== undefined && node.itemSpacing > 0) {
      layout.gap = node.itemSpacing;
      this.spacingValues.add(node.itemSpacing);
    }

    if (node.counterAxisSpacing !== undefined && node.counterAxisSpacing > 0) {
      layout.counterAxisGap = node.counterAxisSpacing;
      this.spacingValues.add(node.counterAxisSpacing);
    }

    // Padding
    const pt = node.paddingTop ?? 0;
    const pr = node.paddingRight ?? 0;
    const pb = node.paddingBottom ?? 0;
    const pl = node.paddingLeft ?? 0;

    if (pt > 0 || pr > 0 || pb > 0 || pl > 0) {
      layout.padding = { top: pt, right: pr, bottom: pb, left: pl };
      [pt, pr, pb, pl].forEach(v => { if (v > 0) { this.spacingValues.add(v); } });
    }

    return layout;
  }

  private parseLayoutSelf(node: FigmaNode): LayoutSelfInfo | undefined {
    const hasLayoutProps =
      node.layoutAlign !== undefined ||
      node.layoutGrow !== undefined ||
      node.layoutSizingHorizontal !== undefined ||
      node.layoutSizingVertical !== undefined;

    if (!hasLayoutProps) {
      return undefined;
    }

    const self: LayoutSelfInfo = {};

    // Alignment
    switch (node.layoutAlign) {
      case 'MIN': self.align = 'flex-start'; break;
      case 'CENTER': self.align = 'center'; break;
      case 'MAX': self.align = 'flex-end'; break;
      case 'STRETCH': self.align = 'stretch'; break;
      case 'INHERIT': self.align = 'auto'; break;
    }

    // Flex grow
    if (node.layoutGrow !== undefined && node.layoutGrow > 0) {
      self.flexGrow = node.layoutGrow;
    }

    // Sizing
    if (node.layoutSizingHorizontal || node.layoutSizingVertical) {
      self.sizing = {
        horizontal: (node.layoutSizingHorizontal?.toLowerCase() as 'fixed' | 'hug' | 'fill') ?? 'fixed',
        vertical: (node.layoutSizingVertical?.toLowerCase() as 'fixed' | 'hug' | 'fill') ?? 'fixed',
      };
    }

    return self;
  }

  // ─── Color Parsing ─────────────────────────────────────────────────────────

  private parseBackground(fills?: FigmaPaint[]): ColorValue | undefined {
    if (!fills || fills.length === 0) {
      return undefined;
    }

    const visibleFills = fills.filter(f => f.visible !== false);
    if (visibleFills.length === 0) {
      return undefined;
    }

    const fill = visibleFills[0];

    if (fill.type === 'SOLID' && fill.color) {
      const hex = this.colorToHex(fill.color);
      const opacity = fill.opacity ?? fill.color.a;

      this.collectColorToken(hex, 'background');

      return {
        type: 'solid',
        value: hex,
        opacity: opacity < 1 ? opacity : undefined,
      };
    }

    if (fill.type === 'IMAGE') {
      return {
        type: 'image',
        value: fill.imageRef ?? '',
      };
    }

    if (fill.type.startsWith('GRADIENT_') && fill.gradientStops) {
      const gradientCSS = this.gradientToCSS(fill);
      return {
        type: 'gradient',
        value: gradientCSS,
      };
    }

    return undefined;
  }

  private colorToHex(color: FigmaColor): string {
    const r = Math.round(color.r * 255);
    const g = Math.round(color.g * 255);
    const b = Math.round(color.b * 255);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  private colorToRGBA(color: FigmaColor, opacity?: number): string {
    const r = Math.round(color.r * 255);
    const g = Math.round(color.g * 255);
    const b = Math.round(color.b * 255);
    const a = opacity ?? color.a;
    return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
  }

  private gradientToCSS(fill: FigmaPaint): string {
    if (!fill.gradientStops || fill.gradientStops.length === 0) {
      return 'transparent';
    }

    const stops = fill.gradientStops
      .map(s => `${this.colorToHex(s.color)} ${Math.round(s.position * 100)}%`)
      .join(', ');

    if (fill.type === 'GRADIENT_LINEAR') {
      return `linear-gradient(180deg, ${stops})`;
    }
    if (fill.type === 'GRADIENT_RADIAL') {
      return `radial-gradient(circle, ${stops})`;
    }
    return `linear-gradient(180deg, ${stops})`;
  }

  private collectColorToken(hex: string, usage: ColorToken['usage']): void {
    if (!this.colorTokens.has(hex)) {
      this.colorTokens.set(hex, {
        name: `color-${this.colorTokens.size + 1}`,
        hex,
        rgba: hex, // simplified
        usage,
      });
    }
  }

  // ─── Border Parsing ────────────────────────────────────────────────────────

  private parseBorder(node: FigmaNode): BorderInfo | undefined {
    if (!node.strokes || node.strokes.length === 0 || !node.strokeWeight) {
      return undefined;
    }

    const visibleStrokes = node.strokes.filter(s => s.visible !== false);
    if (visibleStrokes.length === 0) {
      return undefined;
    }

    const stroke = visibleStrokes[0];
    if (stroke.type !== 'SOLID' || !stroke.color) {
      return undefined;
    }

    const hex = this.colorToHex(stroke.color);
    this.collectColorToken(hex, 'border');

    return {
      color: hex,
      width: node.strokeWeight,
      style: 'solid',
      position: (node.strokeAlign?.toLowerCase() as 'inside' | 'outside' | 'center') ?? 'inside',
    };
  }

  private parseBorderRadius(node: FigmaNode): BorderRadius | undefined {
    if (node.rectangleCornerRadii) {
      const [tl, tr, br, bl] = node.rectangleCornerRadii;
      if (tl > 0 || tr > 0 || br > 0 || bl > 0) {
        [tl, tr, br, bl].forEach(v => { if (v > 0) { this.borderRadiusValues.add(v); } });
        return { topLeft: tl, topRight: tr, bottomRight: br, bottomLeft: bl };
      }
    }

    if (node.cornerRadius && node.cornerRadius > 0) {
      this.borderRadiusValues.add(node.cornerRadius);
      return {
        topLeft: node.cornerRadius,
        topRight: node.cornerRadius,
        bottomRight: node.cornerRadius,
        bottomLeft: node.cornerRadius,
      };
    }

    return undefined;
  }

  // ─── Shadow & Effect Parsing ───────────────────────────────────────────────

  private parseShadows(effects?: FigmaEffect[]): ShadowInfo[] {
    if (!effects) {
      return [];
    }

    return effects
      .filter(e => e.visible && (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW'))
      .map(e => {
        const color = e.color ? this.colorToRGBA(e.color) : 'rgba(0,0,0,0.25)';
        if (e.color) {
          this.collectColorToken(this.colorToHex(e.color), 'other');
        }

        return {
          type: e.type === 'DROP_SHADOW' ? 'drop' as const : 'inner' as const,
          color,
          offsetX: e.offset?.x ?? 0,
          offsetY: e.offset?.y ?? 0,
          blur: e.radius,
          spread: e.spread ?? 0,
        };
      });
  }

  private parseBlur(effects?: FigmaEffect[]): number | undefined {
    if (!effects) {
      return undefined;
    }

    const blur = effects.find(e => e.visible && (e.type === 'LAYER_BLUR' || e.type === 'BACKGROUND_BLUR'));
    return blur?.radius;
  }

  // ─── Text Parsing ──────────────────────────────────────────────────────────

  private parseText(node: FigmaNode): TextInfo {
    const style = node.style;
    const fills = node.fills;

    let color = '#000000';
    if (fills && fills.length > 0) {
      const fill = fills.find(f => f.visible !== false && f.type === 'SOLID');
      if (fill?.color) {
        color = this.colorToHex(fill.color);
        this.collectColorToken(color, 'text');
      }
    }

    const fontFamily = style?.fontFamily ?? 'Inter';
    const fontSize = style?.fontSize ?? 16;
    const fontWeight = style?.fontWeight ?? 400;

    // Collect typography token
    const typKey = `${fontFamily}-${fontSize}-${fontWeight}`;
    if (!this.typographyTokens.has(typKey)) {
      this.typographyTokens.set(typKey, {
        name: `text-${this.typographyTokens.size + 1}`,
        fontFamily,
        fontSize,
        fontWeight,
        lineHeight: style?.lineHeightPx,
        letterSpacing: style?.letterSpacing,
      });
    }

    // Map text alignment
    let textAlign: TextInfo['textAlign'] = 'left';
    switch (style?.textAlignHorizontal) {
      case 'CENTER': textAlign = 'center'; break;
      case 'RIGHT': textAlign = 'right'; break;
      case 'JUSTIFIED': textAlign = 'justify'; break;
    }

    let verticalAlign: TextInfo['verticalAlign'] = 'top';
    switch (style?.textAlignVertical) {
      case 'CENTER': verticalAlign = 'center'; break;
      case 'BOTTOM': verticalAlign = 'bottom'; break;
    }

    // Map text decoration
    let textDecoration: TextInfo['textDecoration'] = 'none';
    if (style?.textDecoration === 'UNDERLINE') {
      textDecoration = 'underline';
    } else if (style?.textDecoration === 'STRIKETHROUGH') {
      textDecoration = 'line-through';
    }

    // Map text transform
    let textTransform: TextInfo['textTransform'] = 'none';
    if (style?.textCase === 'UPPER') {
      textTransform = 'uppercase';
    } else if (style?.textCase === 'LOWER') {
      textTransform = 'lowercase';
    } else if (style?.textCase === 'TITLE') {
      textTransform = 'capitalize';
    }

    return {
      content: node.characters ?? '',
      fontFamily,
      fontSize,
      fontWeight,
      lineHeight: style?.lineHeightPx,
      letterSpacing: style?.letterSpacing,
      textAlign,
      verticalAlign,
      color,
      textDecoration,
      textTransform,
      italic: style?.italic,
    };
  }

  // ─── Image & Icon Detection ────────────────────────────────────────────────

  private isImageNode(node: FigmaNode): boolean {
    // Check for image fills
    if (node.fills) {
      return node.fills.some(f => f.visible !== false && f.type === 'IMAGE');
    }
    return false;
  }

  private isIconNode(node: FigmaNode): boolean {
    const bounds = node.absoluteBoundingBox;
    if (!bounds) {
      return false;
    }

    // Small vectors are likely icons (< 64px)
    const isSmallVector =
      (node.type === 'VECTOR' || node.type === 'BOOLEAN_OPERATION') &&
      bounds.width <= 64 && bounds.height <= 64;

    // Name-based detection
    const name = node.name.toLowerCase();
    const isNamedIcon = this.matchesPattern(name, ['icon', 'ico', 'arrow', 'chevron', 'close', 'check', 'menu']);

    return isSmallVector || isNamedIcon;
  }

  private getImageRef(node: FigmaNode): string | undefined {
    if (node.fills) {
      const imageFill = node.fills.find(f => f.visible !== false && f.type === 'IMAGE');
      return imageFill?.imageRef;
    }
    return undefined;
  }
}
