/// <reference types="@cloudflare/workers-types/2023-07-01" />

declare namespace Cloudflare {
  interface Env {
    AI: Ai;
    DB: D1Database;
    /** Isolated D1 database for Codemode agent — prevents MCP writes from affecting Codemode state */
    DB_CODE: D1Database;
    LOADER: WorkerLoader;
    DEMO_AGENT: DurableObjectNamespace;
    TICKET_MCP: DurableObjectNamespace<import("./src/mcp-server").TicketMCP>;
    ASSETS: Fetcher;
    /** Self-referential origin for MCP HTTP connection. Set in wrangler vars. */
    ORIGIN: string;
  }
}
