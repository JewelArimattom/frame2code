# Frame2Code — Figma to Code with AI

**Turn Figma designs into production UI code using AI agents.**

Frame2Code is a VS Code extension that bridges Figma design files with AI coding agents — GitHub Copilot, Claude, Cursor AI, and any MCP-compatible agent — using the **Model Context Protocol (MCP)**. It extracts structured design data from Figma and exposes it through MCP tools so your AI agent can generate pixel-perfect frontend code.

---

## What's New in v1.1.1

🎯 **100% Design Fidelity** — AI prompts now enforce exact pixel-perfect matching. No more "close enough" approximations.

📁 **File Operations** — Prompts explicitly instruct AI to CREATE or EDIT files with proper file paths.

🔍 **Smart Small Element Detection** — Automatically detects intricate designs with small components and adds special handling instructions.

✅ **Quality Checklist** — Built-in verification checklist ensures all design properties are matched.

---

## Features

- **🔗 One-click Figma connection** — Secure Personal Access Token authentication stored in VS Code's OS keychain
- **🎨 Smart design parsing** — Converts Figma's complex JSON into a clean, AI-friendly structure
- **📐 Auto-layout → Flexbox** — Automatic mapping of Figma auto-layout to CSS flexbox properties
- **🎯 Component detection** — Heuristic identification of buttons, inputs, images, and icons
- **🎨 Design token extraction** — Colors, typography styles, spacing, border radii, shadows, gradients
- **📦 Asset export** — Batch download images and icons as SVG, PNG, or JPEG at configurable scale
- **🤖 MCP server** — 6 tools that AI agents can call to read your design data
- **📝 Multi-framework prompts** — React, Next.js, Vue 3, Svelte 5, HTML/CSS
- **🔒 Secure by design** — Tokens stored in the OS keychain, never passed to AI, strict webview CSP
- **✨ 100% design fidelity** — Prompts enforce exact pixel values, no rounding or approximations

---

## Quick Start

### 1 — Install

Install from the VS Code Marketplace, or from a VSIX:

```bash
code --install-extension frame2code-1.1.1.vsix
```

Or: **Extensions** → **⋯** → **Install from VSIX…**

### 2 — Get a Figma Personal Access Token

1. Log in to [figma.com](https://www.figma.com)
2. Click your **profile picture** (top-left) → **Settings**
3. In the Settings sidebar, click **Security**
4. Scroll to **Personal access tokens** → **Generate new token**
5. Name it (e.g. `Frame2Code`), set an expiry, and enable:
   - **File content** — Read *(required)*
   - **File metadata** — Read *(required)*
   - **current_user:read** — Read *(required)*
6. Copy the token immediately — it won't be shown again

> **Security note:** Frame2Code stores your token exclusively in VS Code's built-in `SecretStorage` (the OS keychain). It is never written to disk, logged, or sent to any external service.

### 3 — Connect & Set Up

Open the **Frame2Code** panel in the VS Code Activity Bar (left sidebar) and follow the six-step workflow:

| Step | Action |
|------|--------|
| 1 | **Connect Figma** — paste your Personal Access Token |
| 2 | **Select File** — paste the Figma file URL |
| 3 | **Select Frame** — pick a frame from the QuickPick list |
| 4 | **Sync Design** — extract all layout, style, and component data |
| 5 | **Download Assets** — export images and icons to your workspace |
| 6 | **Generate Code** — create an AI-optimized prompt |

### 4 — Generate & Use the AI Prompt

After syncing your design, click **Generate Code** (Step 6 in the sidebar). Frame2Code opens a ready-to-use prompt document in the editor. To use it:

1. **Select all** text in the prompt document (`Ctrl+A` / `Cmd+A`)
2. **Copy** it (`Ctrl+C` / `Cmd+C`)
3. **Paste** it into your AI agent chat (GitHub Copilot Chat, Claude, Cursor, ChatGPT, etc.)
4. The AI will read the design specification and generate production-ready UI code

> **Tip:** The MCP server also exposes 6 tools that AI agents can call automatically when connected via MCP. Example prompt:
>
> *"Using the Frame2Code MCP tools, inspect the synced design data and generate a production-ready React + Tailwind component."*

---

## MCP Tools

| Tool | Description |
|------|-------------|
| `get_figma_data` | Full structured design specification for the synced frame |
| `get_frame_list` | List all top-level frames in the selected file |
| `get_frame_design` | Design data for a specific frame by ID or name |
| `get_design_tokens` | Extracted colors, typography, spacing, and radius tokens |
| `get_assets` | Downloaded asset references with local file paths |
| `generate_code_prompt` | AI-optimized prompt with framework-specific requirements |

---

## Commands

| Command | Description |
|---------|-------------|
| `Frame2Code: Connect Figma Account` | Authenticate with your Figma token |
| `Frame2Code: Disconnect Figma Account` | Remove stored credentials |
| `Frame2Code: Select Figma File` | Choose a file by URL or file key |
| `Frame2Code: Select Frame` | Pick a frame from the QuickPick list |
| `Frame2Code: Sync Design` | Extract structured design + token data |
| `Frame2Code: Download Assets` | Export images and icons to your workspace |
| `Frame2Code: Generate AI Prompt` | Create a framework-specific AI prompt |
| `Frame2Code: Show Status` | View connection, file, and sync status |

All commands are also accessible from the sidebar panel.

---

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `frame2code.defaultFramework` | `react` | Default output framework (`react`, `nextjs`, `vue`, `svelte`, `html`) |
| `frame2code.defaultStyling` | `tailwind` | Default styling (`tailwind`, `css-modules`, `styled-components`, `vanilla-css`) |
| `frame2code.assetFormat` | `svg` | Asset export format (`svg`, `png`, `jpg`) |
| `frame2code.assetScale` | `2` | Raster asset scale factor (1–4×) |
| `frame2code.assetsDirectory` | `assets` | Asset output path, relative to workspace root |

---

## Supported Frameworks & Styling

**Frameworks:** React (TypeScript), Next.js (App Router, TypeScript), Vue 3 (Composition API), Svelte 5 (Runes), HTML/CSS/JS

**Styling:** Tailwind CSS, CSS Modules, Styled Components (React), Vanilla CSS

---

## How It Works

```
Figma File
    │
    ▼  (Figma REST API)
Frame2Code fetches the raw design graph
    │
    ▼  (Design Parser)
Converts to clean, AI-friendly JSON structure
    │
    ▼  (MCP Server — 6 tools)
AI agent reads design data via MCP tool calls
    │
    ▼  (AI Agent — Copilot / Claude / Cursor / etc.)
Generates production-ready UI component code
```

---

## Data Privacy & Security

- **Token storage:** VS Code `SecretStorage` (OS keychain — not the workspace or settings files)
- **No relay servers:** All Figma API requests run inside the extension host process; no data passes through any third-party server
- **Tokens never reach AI:** MCP tools return design data only — credentials are never included
- **Webview CSP:** Strict Content Security Policy with per-load script nonces prevents code injection
- **Command whitelist:** The sidebar only triggers a fixed set of whitelisted commands

---

## Requirements

- VS Code 1.85 or later
- A Figma account with access to the design file you want to use
- Node.js 18+ (for development or MCP server mode)

---

## Release Notes

See [CHANGELOG.md](CHANGELOG.md) for the full history.

**1.1.1** — Enhanced AI prompts for 100% design fidelity. Smart detection of small/intricate elements with special handling. File operation instructions (CREATE/EDIT). Quality checklist. Detailed styling requirements for Tailwind, CSS Modules, Styled Components.

**1.0.2** — Fixed Figma token guide (correct navigation: Settings → Security → Personal access tokens; updated required scopes: File content, File metadata, current_user:read). Added AI prompt copy-paste instructions. Marketplace page improvements.

**1.0.0** — Initial release: Figma connection, design parsing, asset export, MCP server, AI prompt generator, professional sidebar UI with built-in Figma setup guide.

---

## Keywords

figma, figma to code, design to code, ai code generation, mcp, model context protocol, react, nextjs, vue, svelte, tailwind, typescript, ui generation, component generation, pixel perfect, design tokens, github copilot, cursor, claude, chatgpt, vibe coding, frontend, design system

---

## License

MIT — see [LICENSE.md](LICENSE.md)

---

## Developer

- Name: Jewel Thomas
- GitHub: https://github.com/JewelArimattom/frame2code
- LinkedIn: https://www.linkedin.com/in/jewel-thomas50/

---

*Frame2Code — Design to code, powered by AI.*
