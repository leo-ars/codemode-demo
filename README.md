# MCP vs Codemode — Cloudflare Agents Demo

A side-by-side comparison of two AI agent tool-calling strategies built on Cloudflare Workers, Durable Objects, and Workers AI.

**Live Demo:** [https://codemode-demo.leoarsenin.workers.dev](https://codemode-demo.leoarsenin.workers.dev)

Inspired by [Rita Kozlov's MCP Night demo](https://github.com/rita3ko/mcp-demo-night) and the Cloudflare blog posts on [MCP + Codemode](https://blog.cloudflare.com/code-mode-mcp/) and [Codemode](https://blog.cloudflare.com/code-mode/).

---

## Overview

Both agents operate on the same Jira-like ticket management system backed by a Cloudflare D1 database. The same query is sent to both simultaneously so you can compare token usage, number of tool calls, and response time.

### MCP Mode — individual tool calls

The LLM calls tools one at a time via the Model Context Protocol. Each tool invocation is a separate round-trip: the model decides which tool to call, waits for the result, then decides the next step.

```
User: "Resolve all open critical tickets"
    ↓
Model → get_tickets_by_priority() → [results]
      → update_ticket_status(T-001) → done
      → update_ticket_status(T-002) → done
      → update_ticket_status(T-003) → done
      → "Done. Resolved 3 tickets."
```

Every step re-sends the full tool schema — token cost grows with each round-trip.

### Codemode — LLM writes and runs code

The LLM writes a single JavaScript function that orchestrates all operations. The code runs in an isolated sandboxed Worker; tool calls dispatch back to the host via Workers RPC.

```
User: "Resolve all open critical tickets"
    ↓
Model → writes async () => {
          const tickets = await codemode.get_tickets_by_priority({ priority: "critical", status: "open" });
          await codemode.bulk_update_status({ ids: tickets.tickets.map(t => t.id), status: "resolved" });
          return { resolved: tickets.count };
        }
      → executes in sandbox → "Done. Resolved 3 tickets."
```

Always 1 tool call regardless of complexity — dramatically lower token cost for multi-step tasks.

---

## Architecture

```
Browser
  └── React UI (split view — MCP | Codemode | Both)
        │
        ├── WebSocket → DemoAgent (demo-mcp)     [Durable Object]
        │                    │
        │                    ├── MCP Client → TicketMCP [Durable Object]
        │                    │                    └── D1 Database
        │                    └── streamText (GLM-4.7-flash)
        │
        └── WebSocket → DemoAgent (demo-codemode) [Durable Object]
                             │
                             ├── createCodeTool → DynamicWorkerExecutor (sandboxed Worker)
                             │                    └── ToolDispatcher (Workers RPC → D1)
                             └── streamText (GLM-4.7-flash)
```

---

## Project Structure

```
src/
├── server.ts           # Worker entrypoint — routes /mcp, /agents/*, static assets
├── agent.ts            # DemoAgent (AIChatAgent DO) — inference, mode switching
├── mcp-server.ts       # TicketMCP (McpAgent DO) — MCP protocol tool server
├── db.ts               # D1 database layer + seed data (47 tickets, 16 tools)
├── types.ts            # Shared types: DemoMode, ViewMode, TokenMetrics
├── useAgentChat.ts     # React hook — WebSocket connection to DemoAgent
├── main.tsx            # React entry point
├── App.tsx             # Root — manages ViewMode state
└── components/
    ├── DemoLayout.tsx      # Two ChatPanels + shared split input bar
    ├── Header.tsx          # View tabs (MCP | Codemode | Split), Reset, About
    ├── TerminalPanel.tsx   # Per-mode panel — messages, step counter, elapsed timer
    ├── MessageList.tsx     # Tool call cards (McpCard / CodemodeCard) + Markdown
    ├── TokenComparison.tsx # Bar chart comparing cumulative token usage + duration
    └── IntroModal.tsx      # First-run onboarding modal
```

---

## Available Tools (16 total)

`create_ticket`, `list_tickets`, `list_recent_tickets`, `get_ticket`, `resolve_ticket`,
`update_ticket_status`, `bulk_update_status`, `search_tickets`, `get_ticket_stats`,
`get_tickets_by_priority`, `get_sprint_summary`, `add_comment`, `bulk_add_comment`,
`get_ticket_comments`, `update_ticket_priority`, `bulk_update_priority`

---

## Quick Start

### Prerequisites

- Node.js 18+
- Cloudflare account with Workers AI enabled
- Wrangler CLI (`npm install -g wrangler`)

### Local Development

```bash
git clone https://github.com/leo-ars/codemode-demo.git
cd codemode-demo
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### Deploy

```bash
npm run deploy
```

This builds the client + Worker bundle and deploys via Wrangler. D1 tables and seed data are created automatically on first boot.

---

## Try This Prompt

Paste into the **Split** view to see both agents tackle the same complex multi-step task simultaneously:

> End-of-sprint triage: get the sprint summary, escalate all open critical tickets to in_progress, search for any open tickets related to 'auth' or 'login' and add a comment 'Flagged for priority review by sprint lead' to each, bulk-resolve all in_progress tickets with low or medium priority, create a new ticket titled 'Post-sprint retrospective: review SLA breaches' with high priority, then return a final report: how many tickets changed status, how many comments were added, and the ID of the new ticket.

MCP will make 6–8 sequential tool calls. Codemode will do it in 1.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Cloudflare Workers + Durable Objects |
| AI | GLM-4.7-flash via Workers AI binding |
| MCP | `@modelcontextprotocol/sdk` over Workers RPC |
| Codemode | `@cloudflare/codemode` — `createCodeTool` + `DynamicWorkerExecutor` |
| Agent framework | `agents` — `AIChatAgent`, `McpAgent` |
| AI SDK | Vercel AI SDK v5 (`streamText`, `convertToModelMessages`) |
| Database | Cloudflare D1 (SQLite) |
| Frontend | React 19 + Vite + Tailwind CSS v4 |

---

## Credits

- Inspired by [Rita Kozlov's MCP Night demo](https://github.com/rita3ko/mcp-demo-night)
- [MCP + Codemode blog post](https://blog.cloudflare.com/code-mode-mcp/) — Cloudflare
- [Codemode intro blog post](https://blog.cloudflare.com/code-mode/) — Cloudflare
- [Codemode API reference](https://developers.cloudflare.com/agents/api-reference/codemode/)

---

## License

MIT
