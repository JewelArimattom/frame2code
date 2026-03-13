# Figma MCP Extension – Project Plan

## Overview

Figma MCP Extension is a VS Code extension that connects Figma design files with AI coding agents such as GitHub Copilot, Claude Code, Cursor AI, and Codex agents using the Model Context Protocol (MCP).

The extension extracts structured design information from Figma and provides it to AI agents in an optimized format so they can generate frontend code that accurately reproduces the design.

Goal:
Enable developers to convert Figma designs into working UI code using AI with minimal manual effort.

---

# Objectives

1. One-click connection to Figma
2. Secure token storage
3. Extract structured design data
4. Download design assets automatically
5. Expose design data through MCP tools
6. Generate optimized AI prompts
7. Enable AI agents to recreate UI designs

---

# Core Features

## 1. Figma Connection

Users connect their Figma account using a personal access token.

Features:

* Connect Figma account
* Select design file
* Select frame
* Sync design data

Security:

* Store tokens using VS Code SecretStorage
* Never expose tokens to AI agents

---

## 2. Design Data Extraction

Use the Figma REST API to retrieve design information.

Key endpoints:

GET /v1/files/{file_key}

GET /v1/files/{file_key}/nodes

GET /v1/images/{file_key}

Extract:

* Layout
* Frame hierarchy
* Text content
* Font properties
* Colors
* Spacing
* Components
* Auto layout properties
* Images
* Icons

---

## 3. Design Parser

Raw Figma JSON is complex.
The extension must convert it into AI-friendly structured data.

Example output format:

{
"frame": "LoginPage",
"width": 400,
"height": 600,
"layout": "vertical",
"gap": 16,
"components": [
{
"type": "text",
"content": "Welcome back",
"fontSize": 24,
"weight": "bold"
},
{
"type": "input",
"label": "Email"
},
{
"type": "button",
"text": "Login"
}
]
}

This structure helps AI agents easily understand the design.

---

# Asset Extraction

Automatically export images and icons.

Supported formats:

* SVG
* PNG
* JPG

Assets saved to project folder:

/assets/icons
/assets/images

Example API:

GET /v1/images/{file_key}?ids=node_id&format=svg

---

# MCP Server

The extension runs a local MCP server to expose design data.

AI agents interact with the MCP server to retrieve design context.

Example tools exposed:

get_figma_files
get_frame_list
get_frame_design
get_assets
generate_ai_prompt

Example tool response:

{
"frame": "LoginPage",
"layout": "vertical",
"gap": 16,
"components": [...]
}

AI agents use this data to generate UI code.

---

# AI Prompt Generator

The extension generates structured prompts optimized for AI coding agents.

Prompt Template:

You are a senior frontend engineer.

Generate a responsive UI based on the following design specification.

Framework:
React / Next.js

Styling:
TailwindCSS

Requirements:

* Pixel perfect layout
* Maintain spacing
* Reusable components
* Responsive design

Design Specification:
{structured_design_json}

Assets:
{asset_paths}

Output:
Production ready UI code.

---

# VS Code Extension Commands

Commands available in command palette:

Connect Figma

Select Figma File

Select Frame

Sync Design

Download Assets

Generate AI Prompt

Generate UI Code

---

# User Workflow

Step 1
Install extension

Step 2
Run command:

Connect Figma

Step 3
Select design file

Step 4
Select frame

Step 5
Run:

Sync Design

Step 6
Run:

Generate AI Prompt

Step 7
Send prompt to AI agent (Copilot, Cursor, Claude)

Step 8
AI generates UI code

---

# Extension Architecture

Figma File
↓
Figma API
↓
Design Parser
↓
Structured Design JSON
↓
MCP Server
↓
AI Agent
↓
Generated UI Code

---

# Tech Stack

VS Code Extension
TypeScript
Node.js
VS Code Extension API

Backend
Node.js

Figma Integration
Figma REST API

MCP Integration
Model Context Protocol SDK

---

# Folder Structure

project-root

extension

src

commands

connectFigma.ts
syncDesign.ts
generatePrompt.ts

figma

figmaClient.ts
designParser.ts

mcp

mcpServer.ts
tools.ts

assets

icons
images

prompts

promptTemplate.ts

package.json
extension.ts

---

# Security

Use VS Code SecretStorage for tokens.

Token storage example:

context.secrets.store("figmaToken", token)

Never send tokens to AI agents.

All Figma requests must run locally.

---

# MVP Features

Initial version should include:

* Figma connection
* Frame selection
* Design parsing
* Asset export
* AI prompt generator
* MCP server with basic tools

---

# Future Features

Design system extraction

Auto component detection

Full page generation

Code generation templates

Support for multiple frameworks

React

Next.js

Vue

Svelte

---

# Success Metrics

Extension installs

Daily active users

Time saved in UI development

AI code accuracy compared to Figma design

---

# Final Goal

Enable developers to turn Figma designs into working frontend UI using AI agents with minimal manual coding.

Workflow:

Figma → MCP → AI Agent → UI Code

This enables rapid UI development and improves collaboration between designers and developers.
