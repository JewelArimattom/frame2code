import * as vscode from 'vscode';
import type { ExtensionState } from '../types/design';

type SidebarMessage = {
  type: 'runCommand';
  command: string;
};

/** Commands the sidebar is permitted to invoke. */
const ALLOWED_COMMANDS = new Set([
  'frame2code.connectFigma',
  'frame2code.disconnectFigma',
  'frame2code.selectFile',
  'frame2code.selectFrame',
  'frame2code.syncDesign',
  'frame2code.downloadAssets',
  'frame2code.generatePrompt',
  'frame2code.showStatus',
]);

export class Frame2CodeSidebarViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'frame2code.sidebar';

  private view?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly getState: () => ExtensionState
  ) {}

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    try {
      webviewView.webview.options = {
        enableScripts: true,
        localResourceRoots: [this.extensionUri],
      };
      webviewView.webview.html = this.getHtml(webviewView.webview);

      webviewView.webview.onDidReceiveMessage(async (message: SidebarMessage | unknown) => {
        if (!message || typeof message !== 'object') {
          return;
        }
        const candidate = message as SidebarMessage;
        if (candidate.type !== 'runCommand' || typeof candidate.command !== 'string') {
          return;
        }
        // Security: Only allow whitelisted extension commands
        if (!ALLOWED_COMMANDS.has(candidate.command)) {
          return;
        }
        await vscode.commands.executeCommand(candidate.command);
      });

      this.postState();
    } catch (error) {
      webviewView.webview.html = this.getFallbackHtml();
      void vscode.window.showErrorMessage('Frame2Code: Failed to load sidebar view.');
    }
  }

  public refresh(): void {
    this.postState();
  }

  private postState(): void {
    if (!this.view) {
      return;
    }

    const state = this.getState();
    const colorTokens = state.syncedData?.designTokens?.colors?.length ?? 0;
    const typographyTokens = state.syncedData?.designTokens?.typography?.length ?? 0;
    void this.view.webview.postMessage({
      type: 'state',
      state: {
        isConnected: state.isConnected,
        hasFile: Boolean(state.currentFileKey),
        hasFrame: Boolean(state.selectedFrameId),
        isSynced: Boolean(state.syncedData),
        hasAssets: Boolean(state.downloadedAssets?.length),
        fileName: state.currentFileName ?? '',
        frameName: state.selectedFrameName ?? '',
        lastSync: state.lastSyncTime ?? '',
        assetCount: state.downloadedAssets?.length ?? 0,
        tokenCount: colorTokens + typographyTokens,
      },
    });
  }

  private getFallbackHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      padding: 12px;
      line-height: 1.5;
    }
    .title {
      font-weight: 700;
      margin-bottom: 8px;
    }
    .muted {
      color: var(--vscode-descriptionForeground);
      margin-bottom: 12px;
    }
  </style>
</head>
<body>
  <div class="title">Frame2Code</div>
  <div class="muted">Sidebar failed to initialize. Reload VS Code and try again.</div>
</body>
</html>`;
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    /* ── Reset & Base ──────────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size, 13px);
      color: var(--vscode-foreground);
      background: transparent;
      padding: 0;
      overflow-x: hidden;
    }

    /* ── Layout ──────────────────────────────────────────── */
    .container { padding: 12px 12px 20px; display: flex; flex-direction: column; gap: 12px; }

    /* ── Header ──────────────────────────────────────────── */
    .header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      background: var(--vscode-sideBarSectionHeader-background, rgba(255,255,255,0.03));
      border-bottom: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.1));
      margin: 0 -12px;
    }
    .header-icon {
      width: 28px;
      height: 28px;
      flex-shrink: 0;
    }
    .header-text { flex: 1; min-width: 0; }
    .header-title {
      font-weight: 700;
      font-size: 13px;
      color: var(--vscode-foreground);
      letter-spacing: 0.02em;
    }
    .header-sub {
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
      margin-top: 1px;
    }
    .header-badge {
      font-size: 10px;
      padding: 2px 5px;
      border-radius: 4px;
      background: var(--vscode-badge-background, rgba(90,184,255,0.15));
      color: var(--vscode-badge-foreground, #5AB8FF);
      font-weight: 600;
      flex-shrink: 0;
    }

    /* ── Status Card ──────────────────────────────────────── */
    .status-card {
      border-radius: 6px;
      border: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.08));
      padding: 10px 12px;
      background: var(--vscode-editor-inactiveSelectionBackground, rgba(255,255,255,0.04));
    }
    .status-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
      background: var(--f2c-dot, #6b7280);
      box-shadow: 0 0 0 2px rgba(107,114,128,0.2);
      transition: background 0.2s, box-shadow 0.2s;
    }
    .status-dot.connected {
      background: #22c55e;
      box-shadow: 0 0 0 3px rgba(34,197,94,0.2);
      animation: pulse 2.5s infinite;
    }
    .status-dot.error {
      background: #ef4444;
      box-shadow: 0 0 0 3px rgba(239,68,68,0.2);
    }
    @keyframes pulse {
      0%, 100% { box-shadow: 0 0 0 2px rgba(34,197,94,0.3); }
      50%       { box-shadow: 0 0 0 5px rgba(34,197,94,0.1); }
    }
    .status-label {
      font-size: 12px;
      font-weight: 600;
      flex: 1;
    }
    .status-info {
      margin-top: 8px;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .status-info-row {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }
    .info-key { opacity: 0.7; flex-shrink: 0; }
    .info-val {
      color: var(--vscode-foreground);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 500;
    }
    .info-chip {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 10px;
      padding: 1px 5px;
      border-radius: 9px;
      background: rgba(90,184,255,0.12);
      color: #5AB8FF;
      font-weight: 600;
    }

    /* ── Action Buttons ───────────────────────────────────── */
    .btn {
      display: flex;
      align-items: center;
      gap: 7px;
      width: 100%;
      padding: 7px 10px;
      border: 1px solid var(--vscode-button-border, transparent);
      border-radius: 5px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      font-family: var(--vscode-font-family);
      text-align: left;
      transition: background 0.15s, opacity 0.15s;
    }
    .btn:hover:not(:disabled) { background: var(--vscode-button-hoverBackground); }
    .btn:active:not(:disabled) { transform: translateY(1px); }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-secondary {
      background: transparent;
      border-color: var(--vscode-panel-border, rgba(255,255,255,0.12));
      color: var(--vscode-foreground);
    }
    .btn-secondary:hover:not(:disabled) {
      background: var(--vscode-list-hoverBackground);
      border-color: var(--vscode-focusBorder, #5AB8FF);
    }
    .btn-danger {
      background: transparent;
      border-color: rgba(239,68,68,0.35);
      color: #ef4444;
    }
    .btn-danger:hover:not(:disabled) {
      background: rgba(239,68,68,0.08);
      border-color: rgba(239,68,68,0.6);
    }
    .btn-icon { width: 14px; height: 14px; flex-shrink: 0; opacity: 0.85; }
    .btn-label { flex: 1; }
    .btn-check { margin-left: auto; opacity: 0.8; }

    /* ── Workflow Steps ───────────────────────────────────── */
    .section-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 6px;
      padding-left: 2px;
    }
    .steps { display: flex; flex-direction: column; gap: 3px; }
    .step {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 10px;
      border-radius: 5px;
      border: 1px solid transparent;
      cursor: default;
      transition: background 0.12s;
    }
    .step.active {
      border-color: var(--vscode-focusBorder, rgba(90,184,255,0.3));
      background: rgba(90,184,255,0.06);
    }
    .step.done {
      border-color: rgba(34,197,94,0.2);
      background: rgba(34,197,94,0.04);
    }
    .step-num {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: 700;
      background: var(--vscode-badge-background, rgba(255,255,255,0.08));
      color: var(--vscode-descriptionForeground);
      transition: background 0.15s, color 0.15s;
    }
    .step.done .step-num {
      background: rgba(34,197,94,0.18);
      color: #22c55e;
    }
    .step.active .step-num {
      background: rgba(90,184,255,0.2);
      color: #5AB8FF;
    }
    .step-body { flex: 1; min-width: 0; }
    .step-name {
      font-size: 12px;
      font-weight: 500;
      color: var(--vscode-foreground);
    }
    .step.done .step-name { color: var(--vscode-foreground); opacity: 0.8; }
    .step-detail {
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
      margin-top: 1px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .step-action {
      flex-shrink: 0;
    }
    .step-btn {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 9px;
      border-radius: 4px;
      border: 1px solid var(--vscode-button-border, transparent);
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      font-size: 11px;
      font-weight: 500;
      font-family: var(--vscode-font-family);
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.12s, opacity 0.12s;
    }
    .step-btn:hover:not(:disabled) { background: var(--vscode-button-hoverBackground); }
    .step-btn:disabled { opacity: 0.35; cursor: not-allowed; }
    .step-check {
      color: #22c55e;
      font-size: 14px;
      line-height: 1;
    }

    /* ── Divider ─────────────────────────────────────────────*/
    .divider {
      height: 1px;
      background: var(--vscode-panel-border, rgba(255,255,255,0.07));
    }

    /* ── Guide Section ────────────────────────────────────── */
    details { border-radius: 6px; overflow: hidden; }
    details + details { margin-top: 4px; }
    summary {
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 8px 10px;
      border-radius: 5px;
      border: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.08));
      background: var(--vscode-editor-inactiveSelectionBackground, rgba(255,255,255,0.03));
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      color: var(--vscode-foreground);
      list-style: none;
      user-select: none;
      transition: background 0.12s;
    }
    summary:hover { background: var(--vscode-list-hoverBackground); }
    summary::-webkit-details-marker { display: none; }
    .summary-icon { font-size: 13px; flex-shrink: 0; }
    .summary-label { flex: 1; }
    .summary-arrow {
      font-size: 10px;
      opacity: 0.5;
      transition: transform 0.2s;
      flex-shrink: 0;
    }
    details[open] .summary-arrow { transform: rotate(90deg); }
    .guide-body {
      padding: 10px 12px 12px;
      border: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.08));
      border-top: none;
      border-radius: 0 0 5px 5px;
      background: var(--vscode-editor-inactiveSelectionBackground, rgba(255,255,255,0.02));
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .guide-step {
      display: flex;
      gap: 10px;
    }
    .guide-num {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      flex-shrink: 0;
      background: rgba(162,89,255,0.2);
      color: #A259FF;
      font-size: 10px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: 1px;
    }
    .guide-content { flex: 1; }
    .guide-title {
      font-size: 11px;
      font-weight: 600;
      color: var(--vscode-foreground);
      margin-bottom: 3px;
    }
    .guide-desc {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      line-height: 1.55;
    }
    .guide-link {
      color: var(--vscode-textLink-foreground, #5AB8FF);
      text-decoration: none;
      font-weight: 500;
    }
    .guide-link:hover { text-decoration: underline; }
    .guide-code {
      display: inline-block;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 10px;
      background: var(--vscode-textCodeBlock-background, rgba(255,255,255,0.07));
      border: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.1));
      border-radius: 3px;
      padding: 0 4px;
      color: var(--vscode-foreground);
    }
    .guide-tip {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
      background: rgba(90,184,255,0.06);
      border: 1px solid rgba(90,184,255,0.15);
      border-radius: 4px;
      padding: 6px 8px;
      line-height: 1.5;
    }
    .guide-tip-icon { flex-shrink: 0; margin-top: 0px; }
    .guide-warn {
      background: rgba(234,179,8,0.06);
      border-color: rgba(234,179,8,0.2);
      color: var(--vscode-descriptionForeground);
    }
    .scope-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-top: 4px;
    }
    .scope-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
    }
    .scope-badge {
      font-size: 9px;
      padding: 1px 5px;
      border-radius: 9px;
      font-weight: 700;
      flex-shrink: 0;
    }
    .scope-required {
      background: rgba(162,89,255,0.15);
      color: #A259FF;
    }
    .scope-optional {
      background: rgba(90,184,255,0.12);
      color: #5AB8FF;
    }

    /* ── MCP Config ───────────────────────────────────────── */
    .code-block {
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 10px;
      background: var(--vscode-textCodeBlock-background, rgba(0,0,0,0.25));
      border: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.1));
      border-radius: 4px;
      padding: 8px 10px;
      color: var(--vscode-foreground);
      word-break: break-all;
      white-space: pre-wrap;
      line-height: 1.6;
      overflow-x: auto;
    }
    .code-key { color: #A259FF; }
    .code-str { color: #5AB8FF; }
    .code-comment { color: var(--vscode-descriptionForeground); font-style: italic; }

    /* ── Footer ──────────────────────────────────────────── */
    .footer {
      text-align: center;
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
      padding-top: 4px;
      opacity: 0.6;
    }
    .footer-links {
      margin-top: 6px;
      display: flex;
      justify-content: center;
      gap: 10px;
      opacity: 0.95;
    }
    .footer-link {
      color: var(--vscode-textLink-foreground, #5AB8FF);
      text-decoration: none;
      font-size: 10px;
      font-weight: 600;
    }
    .footer-link:hover {
      text-decoration: underline;
    }

    /* ── Hidden utility ───────────────────────────────────── */
    .hidden { display: none !important; }
  </style>
</head>
<body>

  <!-- ── Header ─────────────────────────────────────────── -->
  <div class="header">
    <svg class="header-icon" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="28" height="28" rx="6" fill="#A259FF" opacity="0.15"/>
      <path d="M4 10V4H10" stroke="#A259FF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M18 4H24V10" stroke="#A259FF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M4 18V24H10" stroke="#A259FF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M24 18V24H18" stroke="#A259FF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M11 19L17 9" stroke="#5AB8FF" stroke-width="2.2" stroke-linecap="round"/>
    </svg>
    <div class="header-text">
      <div class="header-title">Frame2Code</div>
      <div class="header-sub">Figma → AI → Code</div>
    </div>
    <span class="header-badge">v1.0.0</span>
  </div>

  <div class="container">

    <!-- ── Status Card ──────────────────────────────────── -->
    <div class="status-card">
      <div class="status-row">
        <div class="status-dot" id="status-dot"></div>
        <span class="status-label" id="status-label">Not connected to Figma</span>
      </div>
      <div class="status-info" id="status-info" style="display:none">
        <div class="status-info-row">
          <span class="info-key">File</span>
          <span class="info-val" id="info-file">—</span>
        </div>
        <div class="status-info-row" id="info-frame-row" style="display:none">
          <span class="info-key">Frame</span>
          <span class="info-val" id="info-frame">—</span>
        </div>
        <div class="status-info-row" id="info-sync-row" style="display:none">
          <span class="info-key">Synced</span>
          <span class="info-val" id="info-sync">—</span>
          <span class="info-chip" id="info-tokens" style="display:none">0 tokens</span>
        </div>
      </div>
    </div>

    <!-- ── Connect / Disconnect Buttons ─────────────────── -->
    <div id="connect-section">
      <button class="btn" id="btn-connect" data-command="frame2code.connectFigma">
        <svg class="btn-icon" viewBox="0 0 16 16" fill="none">
          <path d="M6 2a4 4 0 0 0 0 8h4a4 4 0 0 0 0-8H6z" stroke="currentColor" stroke-width="1.4" fill="none"/>
          <path d="M10 6a4 4 0 0 1 0 8H6a4 4 0 0 1 0-8" stroke="currentColor" stroke-width="1.4" fill="none" opacity="0.4"/>
        </svg>
        <span class="btn-label">Connect Figma Account</span>
      </button>
    </div>
    <div id="disconnect-section" style="display:none">
      <button class="btn btn-danger" id="btn-disconnect" data-command="frame2code.disconnectFigma">
        <svg class="btn-icon" viewBox="0 0 16 16" fill="none">
          <path d="M10 6H6M13 3 3 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span class="btn-label">Disconnect Figma</span>
      </button>
    </div>

    <div class="divider"></div>

    <!-- ── Workflow Steps ────────────────────────────────── -->
    <div>
      <div class="section-title">Workflow</div>
      <div class="steps">

        <!-- Step 1: Connect -->
        <div class="step" id="step-1">
          <div class="step-num">1</div>
          <div class="step-body">
            <div class="step-name">Connect Figma</div>
            <div class="step-detail" id="step-1-detail">Authenticate with your token</div>
          </div>
          <div class="step-action">
            <span class="step-check hidden" id="step-1-check">✓</span>
          </div>
        </div>

        <!-- Step 2: Select File -->
        <div class="step" id="step-2">
          <div class="step-num">2</div>
          <div class="step-body">
            <div class="step-name">Select File</div>
            <div class="step-detail" id="step-2-detail">No file selected</div>
          </div>
          <div class="step-action">
            <button class="step-btn" id="btn-file" data-command="frame2code.selectFile" disabled>
              Browse
            </button>
          </div>
        </div>

        <!-- Step 3: Select Frame -->
        <div class="step" id="step-3">
          <div class="step-num">3</div>
          <div class="step-body">
            <div class="step-name">Select Frame</div>
            <div class="step-detail" id="step-3-detail">No frame selected</div>
          </div>
          <div class="step-action">
            <button class="step-btn" id="btn-frame" data-command="frame2code.selectFrame" disabled>
              Pick ▾
            </button>
          </div>
        </div>

        <!-- Step 4: Sync Design -->
        <div class="step" id="step-4">
          <div class="step-num">4</div>
          <div class="step-body">
            <div class="step-name">Sync Design</div>
            <div class="step-detail" id="step-4-detail">Extract design data</div>
          </div>
          <div class="step-action">
            <button class="step-btn" id="btn-sync" data-command="frame2code.syncDesign" disabled>
              Sync ↺
            </button>
          </div>
        </div>

        <!-- Step 5: Download Assets -->
        <div class="step" id="step-5">
          <div class="step-num">5</div>
          <div class="step-body">
            <div class="step-name">Download Assets</div>
            <div class="step-detail" id="step-5-detail">Export images &amp; icons</div>
          </div>
          <div class="step-action">
            <button class="step-btn" id="btn-assets" data-command="frame2code.downloadAssets" disabled>
              ↓ Get
            </button>
          </div>
        </div>

        <!-- Step 6: Generate Code -->
        <div class="step" id="step-6">
          <div class="step-num">6</div>
          <div class="step-body">
            <div class="step-name">Generate Code</div>
            <div class="step-detail">Create AI-optimized prompt</div>
          </div>
          <div class="step-action">
            <button class="step-btn" id="btn-generate" data-command="frame2code.generatePrompt" disabled>
              ⚡ Go
            </button>
          </div>
        </div>

      </div>
    </div>

    <div class="divider"></div>

    <!-- ── GUIDE: Get Figma Token ─────────────────────────── -->
    <details id="guide-token">
      <summary>
        <span class="summary-icon">🔑</span>
        <span class="summary-label">How to get a Figma token</span>
        <span class="summary-arrow">›</span>
      </summary>
      <div class="guide-body">

        <div class="guide-step">
          <div class="guide-num">1</div>
          <div class="guide-content">
            <div class="guide-title">Log in to Figma</div>
            <div class="guide-desc">
              Open <a class="guide-link" href="https://www.figma.com">figma.com</a> in your browser and sign in to your account.
            </div>
          </div>
        </div>

        <div class="guide-step">
          <div class="guide-num">2</div>
          <div class="guide-content">
            <div class="guide-title">Open Account Settings</div>
            <div class="guide-desc">
              Click your <strong>profile picture</strong> (top-left corner) → click <strong>"Settings"</strong> from the menu that appears.
            </div>
          </div>
        </div>

        <div class="guide-step">
          <div class="guide-num">3</div>
          <div class="guide-content">
            <div class="guide-title">Navigate to Personal Access Tokens</div>
            <div class="guide-desc">
              Scroll down to the <strong>"Personal access tokens"</strong> section (or select it in the left sidebar). Click <strong>"Generate new token"</strong>.
            </div>
          </div>
        </div>

        <div class="guide-step">
          <div class="guide-num">4</div>
          <div class="guide-content">
            <div class="guide-title">Name your token &amp; set expiry</div>
            <div class="guide-desc">
              Enter a descriptive name like <span class="guide-code">Frame2Code</span>. Set an expiry — 30 or 90 days is recommended. For long-term use, choose "No expiration" (rotate manually when needed).
            </div>
          </div>
        </div>

        <div class="guide-step">
          <div class="guide-num">5</div>
          <div class="guide-content">
            <div class="guide-title">Set required scopes</div>
            <div class="guide-desc">Enable the following permissions:</div>
            <div class="scope-list">
              <div class="scope-item">
                <span class="scope-badge scope-required">Required</span>
                <span><strong>File content</strong> — Read access (read design data &amp; nodes)</span>
              </div>
              <div class="scope-item">
                <span class="scope-badge scope-required">Required</span>
                <span><strong>Files</strong> — Read access (list and open files)</span>
              </div>
              <div class="scope-item">
                <span class="scope-badge scope-optional">Optional</span>
                <span><strong>File comments</strong> — Read (if you use comments in designs)</span>
              </div>
            </div>
          </div>
        </div>

        <div class="guide-step">
          <div class="guide-num">6</div>
          <div class="guide-content">
            <div class="guide-title">Copy &amp; paste your token</div>
            <div class="guide-desc">
              Click <strong>"Generate token"</strong>, then <strong>copy it immediately</strong> — it won't be shown again. Come back here and click <strong>"Connect Figma Account"</strong> to paste it.
            </div>
          </div>
        </div>

        <div class="guide-tip">
          <span class="guide-tip-icon">🔒</span>
          <span>Your token is stored exclusively in VS Code's built-in SecretStorage (OS keychain) and is <strong>never</strong> sent to any third-party server or exposed to AI agents.</span>
        </div>

      </div>
    </details>

    <!-- ── GUIDE: Find Figma File URL ─────────────────────── -->
    <details>
      <summary>
        <span class="summary-icon">📁</span>
        <span class="summary-label">How to find your Figma file URL</span>
        <span class="summary-arrow">›</span>
      </summary>
      <div class="guide-body">

        <div class="guide-step">
          <div class="guide-num">1</div>
          <div class="guide-content">
            <div class="guide-title">Open the Figma file</div>
            <div class="guide-desc">
              Open the design file you want to use in Figma (in the browser or desktop app).
            </div>
          </div>
        </div>

        <div class="guide-step">
          <div class="guide-num">2</div>
          <div class="guide-content">
            <div class="guide-title">Copy the URL from your browser</div>
            <div class="guide-desc">
              The URL looks like:<br/>
              <span class="guide-code">https://www.figma.com/design/<strong>AbCdEf123</strong>/My-Design</span><br/><br/>
              The bold part is your <strong>file key</strong>. You can paste the full URL — Frame2Code will extract the key automatically.
            </div>
          </div>
        </div>

        <div class="guide-tip guide-warn">
          <span class="guide-tip-icon">⚠️</span>
          <span>Make sure you have at least <strong>View access</strong> to the file. Files in team libraries or private drafts require the correct permissions.</span>
        </div>

      </div>
    </details>

    <!-- ── GUIDE: MCP Agent Setup ─────────────────────────── -->
    <details>
      <summary>
        <span class="summary-icon">🤖</span>
        <span class="summary-label">Connect to AI agents (MCP)</span>
        <span class="summary-arrow">›</span>
      </summary>
      <div class="guide-body">

        <div class="guide-desc" style="font-size:11px; line-height:1.6; color:var(--vscode-descriptionForeground)">
          Frame2Code exposes a <strong>Model Context Protocol (MCP)</strong> server that AI agents use to read your design data. Add the following to your agent's MCP configuration:
        </div>

        <div>
          <div class="guide-title" style="font-size:11px; margin-bottom:4px;">Claude Desktop / Claude Code</div>
          <div class="code-block"><span class="code-comment">// claude_desktop_config.json or .mcp.json</span>
<span class="code-key">"mcpServers"</span>: {
  <span class="code-key">"frame2code"</span>: {
    <span class="code-key">"command"</span>: <span class="code-str">"node"</span>,
    <span class="code-key">"args"</span>: [<span class="code-str">"\${extensionPath}/dist/extension.js"</span>,
             <span class="code-str">"--mcp"</span>]
  }
}</div>
        </div>

        <div>
          <div class="guide-title" style="font-size:11px; margin-bottom:4px;">Available MCP Tools</div>
          <div class="scope-list">
            <div class="scope-item"><span class="guide-code">get_figma_data</span> — Full design specification</div>
            <div class="scope-item"><span class="guide-code">get_frame_list</span> — List all frames</div>
            <div class="scope-item"><span class="guide-code">get_frame_design</span> — Single frame data</div>
            <div class="scope-item"><span class="guide-code">get_design_tokens</span> — Colors, typography, spacing</div>
            <div class="scope-item"><span class="guide-code">get_assets</span> — Exported asset paths</div>
            <div class="scope-item"><span class="guide-code">generate_code_prompt</span> — AI-ready code prompt</div>
          </div>
        </div>

        <div class="guide-tip">
          <span class="guide-tip-icon">💡</span>
          <span>After syncing a design, ask your AI agent: <em>"Using the Frame2Code MCP tools, generate a React component for the synced frame."</em></span>
        </div>

      </div>
    </details>

    <!-- ── Footer ─────────────────────────────────────────── -->
    <div class="footer">
      <div>Frame2Code v1.0.1 · MIT License</div>
      <div class="footer-links">
        <a class="footer-link" href="https://www.linkedin.com/in/jewel-thomas50/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
        <a class="footer-link" href="https://github.com/JewelArimattom/frame2code" target="_blank" rel="noopener noreferrer">GitHub</a>
      </div>
    </div>

  </div><!-- /container -->

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    // ── Wire up all buttons with data-command ──────────────
    document.querySelectorAll('[data-command]').forEach(el => {
      el.addEventListener('click', () => {
        const cmd = el.getAttribute('data-command');
        if (cmd) vscode.postMessage({ type: 'runCommand', command: cmd });
      });
    });

    // ── State elements ─────────────────────────────────────
    const $ = id => document.getElementById(id);
    const els = {
      dot:             $('status-dot'),
      label:           $('status-label'),
      statusInfo:      $('status-info'),
      infoFile:        $('info-file'),
      infoFrameRow:    $('info-frame-row'),
      infoFrame:       $('info-frame'),
      infoSyncRow:     $('info-sync-row'),
      infoSync:        $('info-sync'),
      infoTokens:      $('info-tokens'),
      connectSection:  $('connect-section'),
      disconnectSection: $('disconnect-section'),
      // step elements
      step1: $('step-1'), step1Detail: $('step-1-detail'), step1Check: $('step-1-check'),
      step2: $('step-2'), step2Detail: $('step-2-detail'),
      step3: $('step-3'), step3Detail: $('step-3-detail'),
      step4: $('step-4'), step4Detail: $('step-4-detail'),
      step5: $('step-5'), step5Detail: $('step-5-detail'),
      step6: $('step-6'),
      btnFile:     $('btn-file'),
      btnFrame:    $('btn-frame'),
      btnSync:     $('btn-sync'),
      btnAssets:   $('btn-assets'),
      btnGenerate: $('btn-generate'),
    };

    function setStepState(stepEl, state) {
      stepEl.classList.remove('done', 'active');
      if (state === 'done')   stepEl.classList.add('done');
      if (state === 'active') stepEl.classList.add('active');
    }

    // ── Handle incoming state ──────────────────────────────
    window.addEventListener('message', event => {
      const msg = event.data;
      if (!msg || msg.type !== 'state') return;
      const s = msg.state;

      // --- Status dot & label ---
      els.dot.classList.toggle('connected', s.isConnected);
      els.label.textContent = s.isConnected ? 'Connected to Figma' : 'Not connected to Figma';

      // --- Connect / Disconnect visibility ---
      els.connectSection.style.display    = s.isConnected ? 'none' : '';
      els.disconnectSection.style.display = s.isConnected ? '' : 'none';

      // --- Status info rows ---
      els.statusInfo.style.display = s.isConnected ? '' : 'none';
      if (s.fileName) {
        els.infoFile.textContent = s.fileName;
      }
      els.infoFrameRow.style.display = s.hasFrame ? '' : 'none';
      if (s.frameName) els.infoFrame.textContent = s.frameName;

      if (s.isSynced) {
        els.infoSyncRow.style.display = '';
        const d = new Date(s.lastSync);
        els.infoSync.textContent = s.lastSync
          ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : 'Yes';
        if (s.tokenCount > 0) {
          els.infoTokens.style.display = '';
          els.infoTokens.textContent = s.tokenCount + ' tokens';
        }
      } else {
        els.infoSyncRow.style.display = 'none';
      }

      // --- Step states ---
      setStepState(els.step1, s.isConnected ? 'done' : 'active');
      els.step1Check.classList.toggle('hidden', !s.isConnected);
      els.step1Detail.textContent = s.isConnected ? 'Authenticated ✓' : 'Authenticate with your token';

      setStepState(els.step2, s.hasFile ? 'done' : s.isConnected ? 'active' : '');
      els.step2Detail.textContent = s.fileName || 'No file selected';

      setStepState(els.step3, s.hasFrame ? 'done' : s.hasFile ? 'active' : '');
      els.step3Detail.textContent = s.frameName || 'No frame selected';

      setStepState(els.step4, s.isSynced ? 'done' : s.hasFrame ? 'active' : '');
      if (s.isSynced && s.lastSync) {
        const d = new Date(s.lastSync);
        els.step4Detail.textContent = 'Synced at ' + d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
      } else {
        els.step4Detail.textContent = 'Extract design data';
      }

      setStepState(els.step5, s.hasAssets ? 'done' : s.isSynced ? 'active' : '');
      els.step5Detail.textContent = s.hasAssets
        ? s.assetCount + (s.assetCount === 1 ? ' asset downloaded' : ' assets downloaded')
        : 'Export images & icons';

      setStepState(els.step6, s.isSynced ? 'active' : '');

      // --- Button enabled states ---
      els.btnFile.disabled     = !s.isConnected;
      els.btnFrame.disabled    = !s.hasFile;
      els.btnSync.disabled     = !s.hasFrame;
      els.btnAssets.disabled   = !s.isSynced;
      els.btnGenerate.disabled = !s.isSynced;

      // Open the token guide automatically when not connected
      if (!s.isConnected) {
        document.getElementById('guide-token').setAttribute('open', '');
      }
    });
  </script>

</body>
</html>`;
  }
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let value = '';
  // Use a fixed-length loop; no user input involved
  for (let i = 0; i < 32; i++) {
    value += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return value;
}
