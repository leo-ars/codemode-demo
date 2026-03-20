/// <reference types="@cloudflare/workers-types/2023-07-01" />

declare namespace Cloudflare {
  interface Env {
    AI: Ai;
    DB: D1Database;
    LOADER: WorkerLoader;
    DEMO_AGENT: DurableObjectNamespace;
    TICKET_MCP: DurableObjectNamespace<import("./src/mcp-server").TicketMCP>;
    ASSETS: Fetcher;
    /** Self-referential origin for MCP HTTP connection. Set in wrangler vars. */
    ORIGIN: string;
  }
}
