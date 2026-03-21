import { AIChatAgent } from "@cloudflare/ai-chat";
import { createCodeTool } from "@cloudflare/codemode/ai";
import { DynamicWorkerExecutor } from "@cloudflare/codemode";
import { streamText, convertToModelMessages, stepCountIs, tool } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { z } from "zod";
import {
  initDb, resetDb, dispatchTool,
} from "./db";

export type DemoMode = "mcp" | "codemode";

interface DemoState {
  mode: DemoMode;
  mcpConnected: boolean;
  totalInputTokens: number;
  totalOutputTokens: number;
  baselineInputTokens: number;
}

// Build AI SDK tools backed by D1 directly.
// Both MCP and codemode use the same D1 database — guaranteed consistency.
function buildTicketTools(db: D1Database) {
  const call = (name: string, args: Record<string, unknown>) =>
    dispatchTool(db, name, args);

  return {
    create_ticket: tool({
      description: "Create a new support/task ticket",
      inputSchema: z.object({
        title: z.string().describe("Short title for the ticket"),
        description: z.string().describe("Detailed description of the issue"),
        priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
      }),
      execute: async (args) => call("create_ticket", args as Record<string, unknown>),
    }),

    list_tickets: tool({
      description: "List tickets, optionally filtered by status",
      inputSchema: z.object({
        status: z.enum(["open", "in_progress", "resolved", "all"]).default("all"),
      }),
      execute: async (args) => call("list_tickets", args as Record<string, unknown>),
    }),

    list_recent_tickets: tool({
      description: "List the most recently created tickets",
      inputSchema: z.object({
        limit: z.number().min(1).max(50).default(10),
        status: z.enum(["open", "in_progress", "resolved", "all"]).default("all"),
      }),
      execute: async (args) => call("list_recent_tickets", args as Record<string, unknown>),
    }),

    get_ticket: tool({
      description: "Get a single ticket by ID",
      inputSchema: z.object({
        id: z.string().describe("The ticket ID"),
      }),
      execute: async (args) => call("get_ticket", args as Record<string, unknown>),
    }),

    resolve_ticket: tool({
      description: "Mark a ticket as resolved",
      inputSchema: z.object({
        id: z.string(),
        resolution: z.string().optional(),
      }),
      execute: async (args) => call("resolve_ticket", args as Record<string, unknown>),
    }),

    update_ticket_status: tool({
      description: "Update the status of a ticket",
      inputSchema: z.object({
        id: z.string(),
        status: z.enum(["open", "in_progress", "resolved"]),
      }),
      execute: async (args) => call("update_ticket_status", args as Record<string, unknown>),
    }),

    bulk_update_status: tool({
      description: "Update the status of multiple tickets at once",
      inputSchema: z.object({
        ids: z.array(z.string()).describe("Array of ticket IDs"),
        status: z.enum(["open", "in_progress", "resolved"]),
      }),
      execute: async (args) => call("bulk_update_status", args as Record<string, unknown>),
    }),

    search_tickets: tool({
      description: "Search tickets by keyword in title or description",
      inputSchema: z.object({
        query: z.string(),
      }),
      execute: async (args) => call("search_tickets", args as Record<string, unknown>),
    }),

    get_ticket_stats: tool({
      description: "Get ticket counts grouped by status and priority",
      inputSchema: z.object({}),
      execute: async (args) => call("get_ticket_stats", args as Record<string, unknown>),
    }),

    get_tickets_by_priority: tool({
      description: "List tickets filtered by priority and/or status. Use priority='all' to list all tickets of a given status regardless of priority.",
      inputSchema: z.object({
        priority: z.enum(["low", "medium", "high", "critical", "all"]).default("all"),
        status: z.enum(["open", "in_progress", "resolved", "all"]).default("all"),
      }),
      execute: async (args) => call("get_tickets_by_priority", args as Record<string, unknown>),
    }),

    get_sprint_summary: tool({
      description: "Get a full sprint health summary: counts by status/priority, open critical tickets, in-progress tickets",
      inputSchema: z.object({}),
      execute: async (args) => call("get_sprint_summary", args as Record<string, unknown>),
    }),

    add_comment: tool({
      description: "Add a comment to a single ticket",
      inputSchema: z.object({
        id: z.string().describe("The ticket ID"),
        body: z.string().describe("The comment text"),
        author: z.string().default("agent"),
      }),
      execute: async (args) => call("add_comment", args as Record<string, unknown>),
    }),

    bulk_add_comment: tool({
      description: "Add the same comment to multiple tickets in one call. Always use this instead of calling add_comment multiple times.",
      inputSchema: z.object({
        ids: z.array(z.string()).describe("Array of ticket IDs to comment on"),
        body: z.string().describe("The comment text to add to all tickets"),
        author: z.string().default("agent"),
      }),
      execute: async (args) => call("bulk_add_comment", args as Record<string, unknown>),
    }),

    get_ticket_comments: tool({
      description: "Get all comments on a ticket",
      inputSchema: z.object({
        id: z.string(),
      }),
      execute: async (args) => call("get_ticket_comments", args as Record<string, unknown>),
    }),

    update_ticket_priority: tool({
      description: "Change the priority of a single ticket. Use this to escalate or de-escalate — it does NOT change the ticket status.",
      inputSchema: z.object({
        id: z.string().describe("The ticket ID"),
        priority: z.enum(["low", "medium", "high", "critical"]).describe("New priority level"),
      }),
      execute: async (args) => call("update_ticket_priority", args as Record<string, unknown>),
    }),

    bulk_update_priority: tool({
      description: "Change the priority of multiple tickets at once. Use this to escalate or de-escalate a batch — does NOT change ticket status.",
      inputSchema: z.object({
        ids: z.array(z.string()).describe("Array of ticket IDs"),
        priority: z.enum(["low", "medium", "high", "critical"]).describe("New priority level to apply to all"),
      }),
      execute: async (args) => call("bulk_update_priority", args as Record<string, unknown>),
    }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export class DemoAgent extends AIChatAgent<Cloudflare.Env, DemoState> {
  initialState: DemoState = {
    mode: "mcp",
    mcpConnected: false,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    baselineInputTokens: 0,
  };

  // Give the MCP reconnect + discovery more time after DO hibernation wakeup.
  // The default (true → 10 s) is too tight when the triage prompt fires many
  // tool calls and the TicketMCP DO is cold.
  waitForMcpConnections = { timeout: 30_000 };

  async onStart() {
    // addMcpServer requires this.name to be set (DO must be named).
    // onStart() fires before the name is guaranteed, so we connect lazily
    // in onChatMessage instead. Nothing to do here.
  }

  async onChatMessage(
    onFinish: Parameters<AIChatAgent["onChatMessage"]>[0],
    options?: Parameters<AIChatAgent["onChatMessage"]>[1]
  ) {
    const mode = this.state.mode ?? "mcp";
    // Each agent gets its own isolated D1 database so MCP and Codemode
    // never see each other's writes during a simultaneous split-view run.
    const db = this.name === "demo-codemode" ? this.env.DB_CODE : this.env.DB;
    const workersai = createWorkersAI({ binding: this.env.AI });

    // GLM-4.7-flash for both modes.
    //
    // MCP mode settings (all documented GLM API parameters):
    //   - parallel_tool_calls: false — GLM fires parallel tool calls by default;
    //     the MCP DO serializes RPC so concurrent calls queue up and time out.
    //   - chat_template_kwargs.enable_thinking: false — disables GLM's built-in
    //     reasoning between tool steps, reducing tokens and latency.
    //   - x-session-affinity — routes all MCP inference calls to the same model
    //     instance for prompt caching across sequential tool round-trips.
    //
    // Codemode settings:
    //   - x-session-affinity — same benefit: prompt caching across turns.
    //   - parallel_tool_calls: true (default) — fine in Codemode since all tool
    //     calls run inside a single sandboxed JS function, not through MCP RPC.
    // GLM-4.7-flash for both modes, with session affinity for prompt caching.
    // x-session-affinity is a documented GLM parameter that routes all calls
    // in this DO session to the same model instance, reducing latency.
    const model = workersai("@cf/zai-org/glm-4.7-flash", {
      extraHeaders: { "x-session-affinity": this.name },
    } as Record<string, unknown>);

    // For MCP mode: inject parallel_tool_calls:false and enable_thinking:false
    // into every request body. These are documented GLM API parameters but
    // workers-ai-provider passes settings as run *options* (3rd arg to binding.run),
    // not as request *body* params (2nd arg) — so they don't reach the model via
    // normal settings. The Proxy intercepts binding.run to inject them into the
    // body directly, which is the only reliable path.
    //
    // parallel_tool_calls:false — GLM fires parallel tool calls by default;
    //   the MCP DO serializes RPC so concurrent calls queue up and time out.
    // enable_thinking:false — disables GLM's built-in reasoning between tool
    //   steps, saving tokens and reducing per-step latency.
    if (mode === "mcp") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cfg = (model as any).config;
      if (cfg?.binding) {
        const origRun = cfg.binding.run.bind(cfg.binding);
        cfg.binding = new Proxy(cfg.binding, {
          get(target, prop) {
            if (prop === "run") {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              return async (modelId: string, inputs: any, opts: any) => {
                if (inputs) {
                  inputs.parallel_tool_calls = false;
                  inputs.chat_template_kwargs = { ...(inputs.chat_template_kwargs ?? {}), enable_thinking: false };
                }
                return origRun(modelId, inputs, opts);
              };
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const v = (target as any)[prop];
            return typeof v === "function" ? v.bind(target) : v;
          },
        });
      }
    }



    const systemPrompt = `You are a helpful assistant for a Jira-like ticketing system demo.
You help users create, list, resolve, and manage support tickets.
Current mode: ${mode === "mcp" ? "MCP Tool Calling" : "Codemode (code execution)"}
${mode === "codemode"
  ? `In Codemode, write a SINGLE complete async arrow function that does EVERYTHING in one execution.
IMPORTANT:
- All function names are snake_case: codemode.search_tickets, codemode.get_tickets_by_priority, etc.
- Tool results are wrapped objects. Always access the nested array: (await codemode.get_tickets_by_priority({...})).tickets
- search_tickets returns: { success, count, tickets: [{id, title, status, priority}] } — use .tickets
- get_tickets_by_priority returns: { success, priority, count, tickets: [...] } — use .tickets
- bulk_update_status returns: { success, updated_count, updated_ids } — not a tickets array
- Do ALL work in one function. Never return early or partially.`
  : `In MCP mode, you MUST call tools to complete EVERY step before writing any text.
RULES — follow exactly:
1. Never write any text between tool calls. Call the next tool immediately after receiving a result.
2. Complete ALL requested actions with tools first, then write ONE final summary at the end.
3. To search for auth AND login tickets: call search_tickets ONCE with query "auth login" — do not make two separate search calls.
4. To add the same comment to multiple tickets: call bulk_add_comment ONCE with all ticket IDs — never call add_comment multiple times in a loop.
4. Only use ticket IDs returned by a tool. Never invent IDs.
5. If a tool returns success:false, log it mentally and move to the next step immediately.`}
When creating tickets, confirm what was created with the ticket ID.`;

    const modelMessages = await convertToModelMessages(this.messages);
    if (modelMessages.length === 0) return new Response(null, { status: 204 });

    // Capture the first-step input tokens as the baseline (system prompt +
    // tool schemas + user message only, before any tool results inflate it).
    let firstStepInputTokens = 0;
    const onStep: Parameters<typeof streamText>[0]["onStepFinish"] = (step) => {
      if (firstStepInputTokens === 0) {
        firstStepInputTokens = step.usage.inputTokens ?? 0;
      }
    };

    const wrappedOnFinish: typeof onFinish = async (event) => {
      const inp = event.totalUsage.inputTokens ?? 0;
      const out = event.totalUsage.outputTokens ?? 0;
      const isFirstTurn = (this.state.totalInputTokens ?? 0) === 0;
      const baseline = isFirstTurn
        ? (firstStepInputTokens || inp)
        : (this.state.baselineInputTokens ?? 0);
      await this.setState({
        ...this.state,
        totalInputTokens:    (this.state.totalInputTokens  ?? 0) + inp,
        totalOutputTokens:   (this.state.totalOutputTokens ?? 0) + out,
        baselineInputTokens: baseline,
      });
      return onFinish(event);
    };

    if (mode === "mcp") {
      // Connect lazily — addMcpServer needs this.name which is only guaranteed
      // after a named fetch() has completed (not always in onStart on cold RPC wake).
      if (Object.keys(this.mcp.getAITools()).length === 0) {
        try {
          await this.addMcpServer("tickets", this.env.TICKET_MCP);
        } catch {
          // TicketMCP may be cold — its onStart races with the RPC wake-up.
          // Wait briefly and retry once.
          await new Promise(r => setTimeout(r, 1500));
          try {
            await this.addMcpServer("tickets", this.env.TICKET_MCP);
          } catch { /* handled below */ }
        }
      }

      const mcpTools = this.mcp.getAITools();

      // If still no tools after retry, stream a fixed warm-up message instead
      // of a raw 503 — prevents the model from hallucinating a recovery plan.
      if (Object.keys(mcpTools).length === 0) {
        return streamText({
          model, messages: modelMessages,
          system: `Respond with exactly this message and nothing else:
"The MCP server is warming up after a cold start. Please send your message again in a few seconds."`,
          onFinish: wrappedOnFinish, abortSignal: options?.abortSignal,
        }).toUIMessageStreamResponse();
      }

      return streamText({
        model, system: systemPrompt, messages: modelMessages,
        tools: mcpTools, stopWhen: stepCountIs(25),
        onStepFinish: onStep,
        onFinish: wrappedOnFinish, abortSignal: options?.abortSignal,
      }).toUIMessageStreamResponse();
    }

    await initDb(db);
    const ticketTools = buildTicketTools(db);

    // Raise executor timeout from 30s default to 120s — the full triage prompt
    // chains 8+ tool calls inside a single JS function and can take >30s to run.
    const executor = new DynamicWorkerExecutor({ loader: this.env.LOADER, timeout: 120_000 });

    // Custom description that works reliably with glm-4.7-flash.
    // The model tends to generate bare function calls instead of async arrow
    // functions when using the default description — be very explicit.
    const codemodeDescription = `Write and execute JavaScript code to manage tickets.

You MUST write a complete async arrow function. The code field must ALWAYS start with "async () => {" and end with "}".

Available functions on the codemode object (all snake_case):
{{types}}

RULES:
- code must be: async () => { ... }
- all function names are snake_case (list_tickets, search_tickets, etc.)
- always await every call: const r = await codemode.list_tickets({})
- always return a value at the end: return r;

CORRECT example:
async () => {
  const r = await codemode.list_recent_tickets({ limit: 5 });
  return r;
}

WRONG (never do this):
codemode.list_tickets({})`;

    const codemode = createCodeTool({ tools: ticketTools, executor, description: codemodeDescription });

    return streamText({
      model, system: systemPrompt, messages: modelMessages,
      tools: { codemode }, stopWhen: stepCountIs(10),
      onStepFinish: onStep,
      onFinish: wrappedOnFinish, abortSignal: options?.abortSignal,
    }).toUIMessageStreamResponse();
  }

  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.endsWith("/mode") && request.method === "POST") {
      const { mode } = (await request.json()) as { mode: DemoMode };
      if (mode !== "mcp" && mode !== "codemode")
        return Response.json({ error: "Invalid mode" }, { status: 400 });
      await this.setState({ ...this.state, mode, mcpConnected: false });
      return Response.json({ success: true, mode });
    }

    if (url.pathname.endsWith("/status") && request.method === "GET") {
      return Response.json({
        mode:                this.state.mode,
        mcpConnected:        this.state.mcpConnected,
        totalInputTokens:    this.state.totalInputTokens    ?? 0,
        totalOutputTokens:   this.state.totalOutputTokens   ?? 0,
        baselineInputTokens: this.state.baselineInputTokens ?? 0,
      });
    }

    if (url.pathname.endsWith("/clear") && request.method === "POST") {
      await this.saveMessages([]);
      await this.setState({
        ...this.state,
        mcpConnected:      false,
        totalInputTokens:  this.state.baselineInputTokens ?? 0,
        totalOutputTokens: 0,
      });
      return Response.json({ success: true });
    }

    if (url.pathname.endsWith("/reset-db") && request.method === "POST") {
      const db = this.name === "demo-codemode" ? this.env.DB_CODE : this.env.DB;
      await resetDb(db);
      await this.saveMessages([]);
      await this.setState({
        ...this.state,
        mcpConnected:        false,
        totalInputTokens:    0,
        totalOutputTokens:   0,
        baselineInputTokens: 0,
      });
      return Response.json({ success: true });
    }

    return new Response("Not found", { status: 404 });
  }
}
