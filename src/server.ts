/**
 * Main Worker entrypoint.
 *
 * MCP mode:    addMcpServer(url) via HTTP — shared canonical session routes
 *              all clients to one TicketMCP DO ("shared" instance).
 * Codemode:    direct DO stub fetch to /tool — bypasses MCP protocol, no HTTP
 *              self-reference deadlock, no workerd#2240 RPC bug.
 *
 * Routes:
 *   /mcp      — TicketMCP streamable HTTP (shared session)
 *   /agents/* — DemoAgent
 *   /*        — Static assets
 */

import { routeAgentRequest } from "agents";
import { DemoAgent } from "./agent";
import { TicketMCP } from "./mcp-server";

export { DemoAgent, TicketMCP };

// The canonical DO name — set once the first MCP session is established
// Codemode uses the same DO name so both modes share one ticket store
let canonicalDoName = "shared"; // fallback before first MCP session

// Shared session ID for MCP HTTP transport — all clients hit the same DO
let sharedSessionId: string | null = null;

const ticketMcpHandler = TicketMCP.serve("/mcp", { binding: "TICKET_MCP" });

export default {
  async fetch(
    request: Request,
    env: Cloudflare.Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    // MCP streamable HTTP (used by MCP mode via addMcpServer)
    if (url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")) {
      const clientSession = request.headers.get("mcp-session-id");

      if (!clientSession) {
        // Initialize: reuse shared session if we have one
        if (sharedSessionId) {
          return new Response(
            `event: message\ndata: {"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{"listChanged":true}},"serverInfo":{"name":"JiraLike Ticketing","version":"1.0.0"}},"jsonrpc":"2.0","id":1}\n\n`,
            {
              status: 200,
              headers: {
                "Content-Type":             "text/event-stream",
                "mcp-session-id":           sharedSessionId,
                "Cache-Control":            "no-cache",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Expose-Headers": "mcp-session-id",
              },
            }
          );
        }
        // First initialize: create the canonical session
        const resp = await ticketMcpHandler.fetch(request, env, ctx);
        if (resp.status === 200) {
          const sid = resp.headers.get("mcp-session-id");
          if (sid) {
            sharedSessionId = sid;
            // The McpAgent.serve() names the DO "streamable-http:<sessionId>"
            // We expose this name so codemode can use the exact same DO instance
            canonicalDoName = `streamable-http:${sid}`;
          }
        }
        return resp;
      }

      // Route all sessions to the shared one
      if (sharedSessionId && clientSession !== sharedSessionId) {
        const headers = new Headers(request.headers);
        headers.set("mcp-session-id", sharedSessionId);
        return ticketMcpHandler.fetch(new Request(request, { headers }), env, ctx);
      }

      return ticketMcpHandler.fetch(request, env, ctx);
    }

    // Internal endpoint: returns the canonical TicketMCP DO name
    // Used by DemoAgent to ensure codemode calls the same DO as MCP mode
    if (url.pathname === "/internal/do-name") {
      return Response.json({ doName: canonicalDoName });
    }

    if (url.pathname.startsWith("/agents/")) {
      const agentResponse = await routeAgentRequest(request, env);
      if (agentResponse) return agentResponse;
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Cloudflare.Env>;
