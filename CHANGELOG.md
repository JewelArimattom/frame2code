# Changelog

All notable changes to **Frame2Code** are documented here.
This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
and [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) conventions.

---

## [1.1.0] — 2026-03-14

### ✨ Improvements

#### Large & Complex Figma Design Support
- **Depth-limited parsing** — recursion is now capped at **10 levels** deep, preventing stack overflows and hangs on deeply nested component trees
- **Element count cap** — parser stops at **500 elements** and attaches a `_truncatedChildren` note so the prompt remains usable for very large screens
- **Large-design prompt summary** — when a design has > 60 visible elements the generated AI prompt now includes a plain-text **Component Hierarchy** tree (4 levels deep) alongside the JSON spec, giving AI agents a readable overview without overwhelming context windows
- **Smart JSON compaction** — the design JSON embedded in prompts is depth-capped at **7 levels** and strips all `null`/`undefined` values, reducing prompt size by up to 70 % on complex designs

#### Asset Path & Filename Accuracy
- **Unique, collision-free filenames** — downloaded assets are now named `sanitized-name-NODEID8.ext` (e.g. `icon-arrow-00000123.svg`). Two nodes that share a display name will no longer silently overwrite each other's file
- **Workspace-relative paths** — every `AssetReference` now carries a `relativePath` field (e.g. `assets/icons/icon-arrow-00000123.svg`) in addition to the absolute `localPath`
- **Automatic path merge** — after Download Assets completes, the workspace-relative paths are merged back into the design spec so they are immediately available to the prompt generator without re-syncing
- **AI prompt asset guidance** — the *Assets* section of the generated prompt now shows the exact workspace-relative path the AI **must** use in `import` / `src` / `url()` references, with framework-specific import examples (React, Next.js `next/image`, Vue, HTML)
- **Pending-asset reminder** — if assets haven't been downloaded yet the prompt now clearly says "Run Frame2Code: Download Assets to get exact paths" instead of showing `pending`
- **Batch deduplication** — duplicate node IDs are filtered before calling the Figma Images API, reducing redundant network requests

#### Sync Feedback
- Progress notification now shows `500+ (large design)` for truncated frames so users know a large frame was partially parsed

---

## [1.0.3] — 2026-03-14

### 🐛 Bug Fixes

#### Figma Token Guide
- Corrected sidebar header badge from `v1.0.0` to `v1.0.3`

### ✨ Improvements

#### Generate Code Step
- Step 6 description now reads **"Copy & paste the generated prompt to your AI"** so users know exactly what to do after clicking Go — no more guessing

#### Marketplace & Discoverability
- Added 16 new search keywords to `package.json` (figma mcp, figma ai, design automation, tailwind css, ai agent, copilot agent, windsurf, bolt, lovable, v0, ui builder, no code, low code, auto layout, figma export, figma api, design handoff)
- Added **Screenshots** section to `README.md`

---

## [1.0.2] — 2026-03-14

### 🐛 Bug Fixes

#### Figma Token Guide
- Corrected the token navigation path: **Settings → Security → Personal access tokens** (was incorrectly pointing to the top-level Settings page without the Security step)
- Updated required token scopes to match Figma's current UI:
  - **File content — Read** *(required)*
  - **File metadata — Read** *(required, was incorrectly listed as "Files — Read")*
  - **current_user:read** *(required, was missing)*

### ✨ Improvements

#### AI Prompt Copy-Paste Instructions
- The "Generate AI Prompt" success notification now provides clear step-by-step instructions: select all text in the prompt document, copy it, and paste it into your AI agent (GitHub Copilot Chat, Claude, Cursor, ChatGPT, etc.)

#### Marketplace & Discoverability
- Added more search keywords to `package.json` for VS Code Marketplace search optimization
- Added **Keywords** section to `README.md`
- Updated README install command to reference current version
- Bumped sidebar footer version to 1.0.2

---

## [1.0.0] — 2026-03-13

### ✨ New Features

#### Figma Connection
- Secure Figma Personal Access Token authentication via VS Code `SecretStorage` (OS keychain — token is never written to disk or exposed to AI)
- Auto-reconnect on extension activation using the stored token
- Token validation on startup with graceful fallback if expired

#### Sidebar Panel (Activity Bar)
- Brand new professional sidebar UI with step-by-step workflow guide
- Live connection status indicator with animated pulse when connected
- Numbered workflow steps that reflect current progress (Connect → File → Frame → Sync → Assets → Generate)
- Built-in Figma setup guide: how to generate a Personal Access Token, required scopes, and file URL instructions
- MCP agent configuration guide embedded in the sidebar
- Command whitelist security hardening — only known Frame2Code commands can be triggered by the webview

#### Design Parsing
- Recursive Figma node traversal that handles deeply nested components
- Auto-layout → CSS Flexbox mapping (direction, gap, padding, alignment)
- Heuristic component-type detection: buttons, text inputs, images, icons
- Design token extraction: colors, typography styles, spacing values, border radii
- Border, drop shadow, and linear/radial gradient parsing
- Smart deduplication of extracted design tokens

#### Asset Management
- Batch image and icon export driven by the Figma Images API
- Format support: SVG, PNG, JPEG
- Configurable scale factor for raster exports (1×, 2×, 3×, 4×)
- Configurable output directory (relative to workspace root)
- Assets saved to `.frame2code/assets/` by default

#### MCP Server (6 Tools)
| Tool | Description |
|---|---|
| `get_figma_data` | Full structured design specification of the synced frame |
| `get_frame_list` | List all top-level frames in the selected Figma file |
| `get_frame_design` | Structured design data for a specific frame by ID or name |
| `get_design_tokens` | Extracted colors, typography, spacing, and radius tokens |
| `get_assets` | Downloaded asset references with local file paths |
| `generate_code_prompt` | AI-optimized code generation prompt with framework requirements |

#### AI Prompt Generator
- Framework-aware prompt templates: React (TypeScript), Next.js (App Router), Vue 3, Svelte 5, HTML/CSS
- Styling modes: Tailwind CSS, CSS Modules, Styled Components, Vanilla CSS
- Embeds responsive design requirements, accessibility hints, and component hierarchy
- Framework-specific conventions (e.g. `className` vs `class`, Composition API, Runes)

#### Figma API Client
- Retry logic with exponential back-off for transient network errors
- Automatic rate-limit handling (respects Figma's 429 responses)
- In-memory response cache with per-entry TTL to minimize API calls

#### Developer Experience
- Status bar item showing current connection and sync state at a glance
- Design spec persisted to `.frame2code/design-spec.json` for inspection / version control
- Structured logging via a dedicated VS Code Output Channel (`Frame2Code`)

### 🔒 Security
- Figma API tokens stored exclusively in VS Code `SecretStorage` (OS keychain)
- Tokens are **never** passed to MCP tools or AI agents
- Sidebar webview enforces strict Content Security Policy (CSP) with per-load nonces
- Webview message handler validates both message shape and command whitelist before execution
- All Figma API requests run locally inside the extension host — no third-party relay

### 📦 Configuration

| Setting | Default | Description |
|---|---|---|
| `frame2code.defaultFramework` | `react` | Default framework for code generation prompts |
| `frame2code.defaultStyling` | `tailwind` | Default styling approach |
| `frame2code.assetFormat` | `svg` | Default asset export format |
| `frame2code.assetScale` | `2` | Scale factor for raster assets |
| `frame2code.assetsDirectory` | `assets` | Asset output directory (workspace-relative) |
