import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  initDb, dispatchTool,
  dbCreateTicket, dbListTickets, dbListRecentTickets, dbGetTicket,
  dbResolveTicket, dbUpdateTicketStatus, dbBulkUpdateStatus,
  dbSearchTickets, dbGetTicketStats, dbGetTicketsByPriority,
  dbGetSprintSummary, dbAddComment, dbBulkAddComment, dbGetTicketComments,
  dbUpdateTicketPriority, dbBulkUpdatePriority,
} from "./db";

export type { TicketStatus, TicketPriority, Ticket } from "./db";

export class TicketMCP extends McpAgent<Cloudflare.Env> {
  server = new McpServer({ name: "JiraLike Ticketing", version: "1.0.0" });
  private initialized = false;

  async init() {
    // McpServer throws "Tool X is already registered" if init() runs twice.
    // Guard with a flag so tools are only registered once per DO lifetime.
    if (this.initialized) return;
    this.initialized = true;

    const db = this.env.DB;
    await initDb(db);

    // ─── create_ticket ────────────────────────────────────────────────────────
    this.server.tool("create_ticket", "Create a new support/task ticket in the ticketing system",
      {
        title:       z.string().describe("Short title for the ticket"),
        description: z.string().describe("Detailed description of the issue or task"),
        priority:    z.enum(["low", "medium", "high", "critical"]).default("medium"),
      },
      async (args) => {
        const r = await dbCreateTicket(db, args);
        return { content: [{ type: "text" as const, text: JSON.stringify(r) }] };
      }
    );

    // ─── list_tickets ─────────────────────────────────────────────────────────
    this.server.tool("list_tickets", "List all tickets, optionally filtered by status",
      { status: z.enum(["open", "in_progress", "resolved", "all"]).default("all") },
      async (args) => {
        const r = await dbListTickets(db, args);
        return { content: [{ type: "text" as const, text: JSON.stringify(r) }] };
      }
    );

    // ─── list_recent_tickets ──────────────────────────────────────────────────
    this.server.tool("list_recent_tickets", "List the most recently created tickets",
      {
        limit:  z.number().min(1).max(50).default(10),
        status: z.enum(["open", "in_progress", "resolved", "all"]).default("all"),
      },
      async (args) => {
        const r = await dbListRecentTickets(db, args);
        return { content: [{ type: "text" as const, text: JSON.stringify(r) }] };
      }
    );

    // ─── get_ticket ───────────────────────────────────────────────────────────
    this.server.tool("get_ticket", "Get a single ticket by its ID",
      { id: z.string().describe("The ticket ID") },
      async (args) => {
        const r = await dbGetTicket(db, args);
        return { content: [{ type: "text" as const, text: JSON.stringify(r) }] };
      }
    );

    // ─── resolve_ticket ───────────────────────────────────────────────────────
    this.server.tool("resolve_ticket", "Mark a ticket as resolved",
      { id: z.string(), resolution: z.string().optional() },
      async (args) => {
        const r = await dbResolveTicket(db, args);
        return { content: [{ type: "text" as const, text: JSON.stringify(r) }] };
      }
    );

    // ─── update_ticket_status ─────────────────────────────────────────────────
    this.server.tool("update_ticket_status", "Update the status of a ticket",
      { id: z.string(), status: z.enum(["open", "in_progress", "resolved"]) },
      async (args) => {
        const r = await dbUpdateTicketStatus(db, args);
        return { content: [{ type: "text" as const, text: JSON.stringify(r) }] };
      }
    );

    // ─── bulk_update_status ───────────────────────────────────────────────────
    this.server.tool("bulk_update_status", "Update the status of multiple tickets at once",
      { ids: z.array(z.string()), status: z.enum(["open", "in_progress", "resolved"]) },
      async (args) => {
        const r = await dbBulkUpdateStatus(db, args);
        return { content: [{ type: "text" as const, text: JSON.stringify(r) }] };
      }
    );

    // ─── search_tickets ───────────────────────────────────────────────────────
    this.server.tool("search_tickets", "Search tickets by keyword in title or description",
      { query: z.string() },
      async (args) => {
        const r = await dbSearchTickets(db, args);
        return { content: [{ type: "text" as const, text: JSON.stringify(r) }] };
      }
    );

    // ─── get_ticket_stats ─────────────────────────────────────────────────────
    this.server.tool("get_ticket_stats", "Get ticket counts grouped by status and priority",
      {},
      async () => {
        const r = await dbGetTicketStats(db);
        return { content: [{ type: "text" as const, text: JSON.stringify(r) }] };
      }
    );

    // ─── get_tickets_by_priority ──────────────────────────────────────────────
    this.server.tool("get_tickets_by_priority",
      "List tickets filtered by priority and/or status. Use priority='all' to get all tickets of a given status regardless of priority.",
      {
        priority: z.enum(["low", "medium", "high", "critical", "all"]).default("all"),
        status:   z.enum(["open", "in_progress", "resolved", "all"]).default("all"),
      },
      async (args) => {
        const r = await dbGetTicketsByPriority(db, args);
        return { content: [{ type: "text" as const, text: JSON.stringify(r) }] };
      }
    );

    // ─── get_sprint_summary ───────────────────────────────────────────────────
    this.server.tool("get_sprint_summary",
      "Get a full sprint health summary: counts by status/priority, open critical tickets, in-progress tickets",
      {},
      async () => {
        const r = await dbGetSprintSummary(db);
        return { content: [{ type: "text" as const, text: JSON.stringify(r) }] };
      }
    );

    // ─── add_comment ──────────────────────────────────────────────────────────
    this.server.tool("add_comment", "Add a comment to a single ticket",
      { id: z.string(), body: z.string(), author: z.string().default("agent") },
      async (args) => {
        const r = await dbAddComment(db, args);
        return { content: [{ type: "text" as const, text: JSON.stringify(r) }] };
      }
    );

    // ─── bulk_add_comment ─────────────────────────────────────────────────────
    this.server.tool("bulk_add_comment",
      "Add the same comment to multiple tickets in one call. Use this instead of calling add_comment repeatedly.",
      { ids: z.array(z.string()), body: z.string(), author: z.string().default("agent") },
      async (args) => {
        const r = await dbBulkAddComment(db, args);
        return { content: [{ type: "text" as const, text: JSON.stringify(r) }] };
      }
    );

    // ─── get_ticket_comments ──────────────────────────────────────────────────
    this.server.tool("get_ticket_comments", "Get all comments on a ticket",
      { id: z.string() },
      async (args) => {
        const r = await dbGetTicketComments(db, args);
        return { content: [{ type: "text" as const, text: JSON.stringify(r) }] };
      }
    );

    // ─── update_ticket_priority ───────────────────────────────────────────────
    this.server.tool("update_ticket_priority",
      "Change the priority of a single ticket (separate from status)",
      { id: z.string(), priority: z.enum(["low", "medium", "high", "critical"]) },
      async (args) => {
        const r = await dbUpdateTicketPriority(db, args);
        return { content: [{ type: "text" as const, text: JSON.stringify(r) }] };
      }
    );

    // ─── bulk_update_priority ─────────────────────────────────────────────────
    this.server.tool("bulk_update_priority",
      "Change the priority of multiple tickets at once (does not change their status)",
      { ids: z.array(z.string()), priority: z.enum(["low", "medium", "high", "critical"]) },
      async (args) => {
        const r = await dbBulkUpdatePriority(db, args);
        return { content: [{ type: "text" as const, text: JSON.stringify(r) }] };
      }
    );
  }

  // Override fetch to intercept /tool requests BEFORE partyserver processes them.
  // partyserver's fetch() calls onStart() → getTransportType() on this.name,
  // but for the codemode path the name is "shared" which is not a valid
  // McpAgent transport name and throws. By overriding fetch we handle /tool
  // entirely outside the partyserver lifecycle.
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/tool" && request.method === "POST") {
      try {
        await initDb(this.env.DB);
        const { tool, args } = await request.json() as { tool: string; args: Record<string, unknown> };
        const result = await dispatchTool(this.env.DB, tool, args);
        return Response.json(result);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return Response.json({ success: false, error: msg }, { status: 500 });
      }
    }
    return super.fetch(request);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async onRequest(_request: Request): Promise<Response> {
    return new Response("Not found", { status: 404 });
  }
}
