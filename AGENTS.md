# AGENTS.md — codemode-demo

Guidance for AI coding agents working in this repository.

---

## Project Overview

**codemode-demo** is a side-by-side comparison demo of two AI agent tool-calling strategies:
**MCP mode** (traditional one-tool-at-a-time via Model Context Protocol) vs **Codemode**
(the LLM writes JavaScript that is executed in a sandboxed Cloudflare Worker). Both modes
operate on the same Jira-like ticket management system backed by a Cloudflare D1 database.

The app runs two independent `DemoAgent` Durable Object instances simultaneously, fires the
same user query at both, and displays a token usage comparison to show Codemode's efficiency gains.

### Codemode References

- GitHub: https://github.com/cloudflare/mcp
- Blog (MCP + Codemode): https://blog.cloudflare.com/code-mode-mcp/
- Blog (Codemode intro): https://blog.cloudflare.com/code-mode/
- API reference: https://developers.cloudflare.com/agents/api-reference/codemode/

---

## Commands

```bash
npm run dev       # Start dev server (Vite + Cloudflare Workers plugin)
npm run build     # Production build (client + Worker bundles)
npm run deploy    # Build + deploy via Wrangler
npm run lint      # ESLint
npm run cf-typegen  # Regenerate worker-configuration.d.ts from wrangler.jsonc
```

---

## Architecture

```
src/
├── server.ts           Worker entrypoint — routes /mcp, /agents/*, static assets
├── agent.ts            DemoAgent (AIChatAgent Durable Object) — inference, mode switching
├── mcp-server.ts       TicketMCP (McpAgent Durable Object) — MCP protocol tool server
├── db.ts               D1 database layer + seed data (41 tickets, 15 tool functions)
├── tools.ts            Legacy in-memory tool definitions (superseded by db.ts)
├── types.ts            Shared types: DemoMode, ViewMode, TokenMetrics
├── useAgentChat.ts     React hook — WebSocket/SSE connection to DemoAgent
├── main.tsx            React entry point
├── App.tsx             Root — manages ViewMode state
└── components/
    ├── DemoLayout.tsx      Two ChatPanels + shared split input bar
    ├── Header.tsx          View tabs (MCP | Codemode | Split), Clear/Reset/About
    ├── TerminalPanel.tsx   Per-mode chat panel — messages, input, welcome screen
    ├── MessageList.tsx     Tool call cards (McpCard vs CodemodeCard) + Markdown
    ├── TokenComparison.tsx Bar chart comparing cumulative token usage
    └── IntroModal.tsx      First-run onboarding modal
```

---

## Mode Mechanics

### MCP Mode (`"mcp"`)
- Tools are served by the `TicketMCP` McpAgent Durable Object over streamable HTTP.
- The LLM calls tools **one at a time**, up to `stepCountIs(10)` steps.
- Each round-trip re-sends all tool schemas → higher token cost for multi-step tasks.

### Codemode (`"codemode"`)
- A single `codemode` tool is exposed via `@cloudflare/codemode` → `createCodeTool`.
- The LLM writes an `async () => { ... }` function using the `codemode` object.
- Code runs in a `DynamicWorkerExecutor` — an isolated sandboxed Worker (`globalOutbound: null`).
- Tool functions dispatch back to the host via `ToolDispatcher` (Workers RPC).
- **Always 1 tool call regardless of complexity** → lower token cost, fewer round-trips.

### Available Tools (both modes, 15 total)
`create_ticket`, `list_tickets`, `list_recent_tickets`, `get_ticket`, `resolve_ticket`,
`update_ticket_status`, `bulk_update_status`, `search_tickets`, `get_ticket_stats`,
`get_tickets_by_priority`, `get_sprint_summary`, `add_comment`, `get_ticket_comments`,
`update_ticket_priority`, `bulk_update_priority`

### Mode Switching
- Each `TerminalPanel` calls `POST /agents/demo-agent/{id}/mode` on mount to lock its agent.
- Agent state (`DemoState`) is persisted in the Durable Object: `mode`, `mcpConnected`,
  `totalInputTokens`, `totalOutputTokens`, `baselineInputTokens`.

---

## Key Dependencies

| Package | Purpose |
|---|---|
| `agents` | `AIChatAgent`, `McpAgent` base classes for Durable Object agents |
| `@cloudflare/codemode` | `createCodeTool`, `DynamicWorkerExecutor`, `buildTypes` |
| `ai` (Vercel AI SDK) | `streamText`, `tool`, `convertToModelMessages` |
| `workers-ai-provider` | `createWorkersAI` — binds Workers AI to the AI SDK |
| `@modelcontextprotocol/sdk` | MCP client/server protocol |
| React 19 + Vite | Frontend framework + build tool |
| Tailwind CSS v4 | Styling |

---

## AI Model

`@cf/zai-org/glm-4.7-flash` — used for both MCP and Codemode, set in `src/agent.ts`.
To change: update the `workersai(...)` call and redeploy with `npm run deploy`.

---

## Seed Data

41 tickets are pre-loaded into D1 on first boot (when `tickets` table is empty) covering:
Auth & Onboarding, Dashboard & UI, API & Integrations, Performance, Security, Billing,
Mobile & Notifications, Infrastructure, AI & Agents — all dated March 2026.

---

## Code Style

- TypeScript strict mode, 2-space indentation, single quotes.
- Tool function names are always **snake_case** (critical for Codemode correctness).
- Agent code: never use `camelCase` for `codemode.*` calls — the sandbox will fail silently.
- No test framework is configured. No linter beyond ESLint + TypeScript strict.
