import { tool } from "ai";
import { z } from "zod";
import type { Ticket, TicketStatus, TicketPriority } from "./mcp-server";

// ── ID generation ────────────────────────────────────────────────────────────
// crypto.randomUUID() is only available inside request handlers in Workers,
// not at global scope. We use a Math.random-based fallback for seeding,
// and crypto.randomUUID() inside the tool execute() handlers.

function randomHex(len: number): string {
  let s = "";
  while (s.length < len) s += Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, "0");
  return s.slice(0, len).toUpperCase();
}

/** Safe to call anywhere (global scope + handlers) */
function generateSeedId(): string {
  return "T-" + randomHex(8);
}

/** Only call inside request handlers (crypto.randomUUID requires handler scope) */
function generateId(): string {
  try {
    return "T-" + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  } catch {
    // Fallback — should not happen inside a handler but just in case
    return "T-" + randomHex(8);
  }
}

// ── Ticket store (module-level singleton, shared across all calls) ──────────
export const ticketStore = new Map<string, Ticket>();

interface Comment {
  id: string;
  ticket_id: string;
  author: string;
  body: string;
  created_at: string;
}
export const commentStore = new Map<string, Comment[]>();

// ── Seed with 52 realistic-looking tickets dated March 2026 ────────────────
function makeDate(day: number, hour = 9, min = 0): string {
  return new Date(2026, 2, day, hour, min, 0).toISOString();
}

const SEED_TICKETS: Omit<Ticket, "id">[] = [
  // Sprint 24 — Auth & Onboarding
  { title: "Login bug: SSO fails for Okta users after token refresh", description: "Critical login bug — users authenticated via Okta are being logged out unexpectedly after their session token refreshes. The OIDC callback is returning a 401. Affects ~200 enterprise accounts.", status: "open", priority: "critical", created_at: makeDate(1, 8, 12), updated_at: makeDate(1, 8, 12) },
  { title: "Signup email confirmation not delivered to @icloud.com addresses", description: "Transactional emails sent via SendGrid are being silently dropped for iCloud addresses. SPF/DKIM records look correct. Possibly an Apple-side filtering issue.", status: "in_progress", priority: "high", created_at: makeDate(1, 9, 5), updated_at: makeDate(3, 14, 22) },
  { title: "Add SAML 2.0 support for enterprise SSO", description: "Several enterprise customers (Accenture, Deloitte) have requested SAML 2.0 as an alternative to OIDC. Need to integrate with passport-saml and add IdP metadata upload UI.", status: "open", priority: "high", created_at: makeDate(2, 10, 30), updated_at: makeDate(2, 10, 30) },
  { title: "Password reset link expires too quickly (5 min)", description: "Users on slow connections or mobile are hitting the reset link after it expires. Industry standard is 30–60 min. Extend to 30 minutes.", status: "resolved", priority: "medium", created_at: makeDate(1, 11, 0), updated_at: makeDate(4, 16, 45) },
  { title: "Login bug: mobile app shows invalid credentials error", description: "Login bug on mobile — users get 'Invalid credentials' on the iOS and Android apps despite correct password. The login bug appears to be in the OAuth2 PKCE flow; desktop login works fine.", status: "open", priority: "high", created_at: makeDate(2, 14, 30), updated_at: makeDate(2, 14, 30) },
  { title: "Onboarding wizard skips step 3 on Safari 17.3", description: "The multi-step onboarding form jumps from step 2 directly to step 4 on Safari 17.3 (macOS Sequoia). Likely a CSS :has() selector issue.", status: "in_progress", priority: "high", created_at: makeDate(3, 9, 15), updated_at: makeDate(5, 11, 0) },

  // Sprint 24 — Dashboard & UI
  { title: "Dashboard chart shows wrong date range after timezone change", description: "If a user changes their timezone in settings, the activity chart continues to render data in the old timezone until a hard refresh. Should recompute on timezone update.", status: "open", priority: "medium", created_at: makeDate(3, 13, 0), updated_at: makeDate(3, 13, 0) },
  { title: "Dark mode: modal overlays appear with incorrect z-index", description: "When a confirmation modal is open in dark mode, dropdown menus from the parent page render on top of the modal overlay. z-index stacking context issue.", status: "open", priority: "medium", created_at: makeDate(4, 10, 45), updated_at: makeDate(4, 10, 45) },
  { title: "Export to CSV truncates cells with commas in the value", description: "Ticket titles containing commas break the CSV column alignment. Values need to be wrapped in double-quotes per RFC 4180.", status: "resolved", priority: "low", created_at: makeDate(2, 15, 20), updated_at: makeDate(6, 9, 10) },
  { title: "Sidebar nav collapses unexpectedly on 1280px viewport", description: "At exactly 1280px width, the sidebar enters mobile-collapse mode even though it should display in desktop layout. The Tailwind `xl:` breakpoint boundary is off by 1px.", status: "open", priority: "low", created_at: makeDate(5, 8, 0), updated_at: makeDate(5, 8, 0) },
  { title: "Add keyboard shortcut (Cmd+K) for global search", description: "Power users have requested a command palette similar to Linear / Notion. Should open a search overlay that allows fuzzy-finding tickets, users, and settings pages.", status: "open", priority: "medium", created_at: makeDate(6, 11, 30), updated_at: makeDate(6, 11, 30) },

  // Sprint 24 — API & Integrations
  { title: "Webhooks not retrying on 503 responses", description: "When a customer's webhook endpoint returns 503, the system marks the delivery as failed immediately instead of retrying with exponential backoff. Should retry up to 5 times over 24h.", status: "in_progress", priority: "high", created_at: makeDate(4, 9, 0), updated_at: makeDate(7, 10, 30) },
  { title: "GitHub integration: PR status not syncing after repo rename", description: "When a GitHub repository is renamed, the webhook URL changes and existing installations stop receiving events. Need to handle the `repository.renamed` webhook event.", status: "open", priority: "high", created_at: makeDate(5, 14, 15), updated_at: makeDate(5, 14, 15) },
  { title: "Rate limiting returns 500 instead of 429", description: "When a client exceeds the API rate limit, the server throws an unhandled exception and returns 500. Should return 429 with Retry-After header.", status: "resolved", priority: "critical", created_at: makeDate(3, 7, 55), updated_at: makeDate(5, 16, 0) },
  { title: "Slack integration: notifications sent twice for same event", description: "Users with Slack integration enabled are receiving duplicate notifications for ticket status changes. Appears to be a race condition in the event emitter.", status: "in_progress", priority: "high", created_at: makeDate(6, 9, 20), updated_at: makeDate(8, 11, 45) },
  { title: "Add Jira sync: bidirectional ticket status updates", description: "Enterprise customers using Jira alongside our tool want two-way sync. When a ticket is resolved in Jira, it should auto-resolve here, and vice versa.", status: "open", priority: "medium", created_at: makeDate(7, 10, 0), updated_at: makeDate(7, 10, 0) },

  // Sprint 25 — Performance
  { title: "Ticket list loads slowly (>3s) for accounts with 10k+ tickets", description: "The main ticket list endpoint is doing a full table scan instead of using the indexed `created_at` column. Add cursor-based pagination and ensure the composite index is used.", status: "in_progress", priority: "critical", created_at: makeDate(8, 8, 30), updated_at: makeDate(10, 9, 15) },
  { title: "Search indexing falls behind during bulk imports", description: "When customers import more than 500 tickets via CSV, the Elasticsearch indexer queue backs up and search results are stale for up to 30 minutes.", status: "open", priority: "high", created_at: makeDate(9, 11, 0), updated_at: makeDate(9, 11, 0) },
  { title: "Reduce cold start time for Edge Functions", description: "The `/api/search` edge function has a 1.2s cold start due to importing the full Zod bundle. Tree-shake and lazy-load schemas to target <100ms cold start.", status: "open", priority: "medium", created_at: makeDate(10, 13, 30), updated_at: makeDate(10, 13, 30) },
  { title: "Add Redis caching layer for user permissions", description: "Permission checks on every API request are causing redundant DB queries. Cache user role/permission data in Redis with a 5-minute TTL and invalidate on role change.", status: "in_progress", priority: "high", created_at: makeDate(9, 9, 0), updated_at: makeDate(11, 14, 0) },
  { title: "Image uploads over 5MB cause worker OOM crash", description: "Uploading large images (logos, screenshots) via the attachments endpoint causes the Node worker to run out of memory. Need to use streaming upload to S3 instead of buffering.", status: "resolved", priority: "critical", created_at: makeDate(7, 7, 45), updated_at: makeDate(9, 10, 20) },

  // Sprint 25 — Security
  { title: "Audit log missing entries for bulk delete operations", description: "When a user performs a bulk delete of tickets via the API, only the first deletion is written to the audit log. The rest are silently omitted.", status: "open", priority: "high", created_at: makeDate(10, 9, 30), updated_at: makeDate(10, 9, 30) },
  { title: "CORS policy allows * origin in production", description: "The API is returning `Access-Control-Allow-Origin: *` in production, which violates our security policy. Should be restricted to the allow-listed customer domains.", status: "resolved", priority: "critical", created_at: makeDate(8, 6, 30), updated_at: makeDate(8, 18, 0) },
  { title: "Session tokens not invalidated on password change", description: "When a user changes their password, existing session tokens remain valid. All active sessions should be invalidated immediately to prevent session hijacking.", status: "in_progress", priority: "critical", created_at: makeDate(11, 8, 0), updated_at: makeDate(12, 10, 30) },
  { title: "Add CSP headers to prevent XSS injection", description: "The app is missing Content-Security-Policy headers. Need to add a strict CSP that restricts script sources to our CDN and blocks inline scripts.", status: "open", priority: "high", created_at: makeDate(12, 10, 0), updated_at: makeDate(12, 10, 0) },
  { title: "Admin impersonation should require MFA re-verification", description: "When an admin uses the 'impersonate user' feature, there's no additional auth challenge. This is a privilege escalation risk. Require TOTP confirmation.", status: "open", priority: "high", created_at: makeDate(13, 11, 15), updated_at: makeDate(13, 11, 15) },

  // Sprint 25 — Billing
  { title: "Stripe webhook: invoice.paid not updating subscription status", description: "After a successful payment, the subscription status in our DB stays as 'past_due' until the next cron job runs (24h delay). The `invoice.paid` webhook handler is not updating the record.", status: "in_progress", priority: "critical", created_at: makeDate(11, 9, 0), updated_at: makeDate(13, 14, 0) },
  { title: "Proration calculation incorrect for mid-cycle plan upgrades", description: "When a customer upgrades from Starter to Pro mid-billing-cycle, the proration amount is calculated from the billing period start instead of the upgrade date.", status: "open", priority: "high", created_at: makeDate(12, 13, 0), updated_at: makeDate(12, 13, 0) },
  { title: "Add support for annual billing discount (20% off)", description: "Sales has approved offering a 20% discount for annual plan commitments. Need to add annual price IDs in Stripe, update the pricing page, and handle the checkout flow.", status: "open", priority: "medium", created_at: makeDate(14, 10, 0), updated_at: makeDate(14, 10, 0) },
  { title: "Invoice PDF not generated for EU customers (VAT required)", description: "EU customers are required by law to receive VAT invoices. Our current Stripe invoice template doesn't include VAT number or the required EU disclosure text.", status: "in_progress", priority: "high", created_at: makeDate(13, 9, 30), updated_at: makeDate(15, 11, 0) },
  { title: "Free trial users can access paid features via direct URL", description: "Users on a free trial can access Pro-tier features by navigating directly to the URL. The feature gate middleware is only applied at the UI routing level, not the API.", status: "resolved", priority: "critical", created_at: makeDate(10, 7, 0), updated_at: makeDate(12, 16, 30) },

  // Sprint 26 — Mobile & Notifications
  { title: "Push notifications not delivered on iOS 17.4+ (background fetch)", description: "Since iOS 17.4, background fetch for push notifications has changed. Our service worker registration is failing silently. Needs investigation with APNs logs.", status: "open", priority: "high", created_at: makeDate(15, 10, 0), updated_at: makeDate(15, 10, 0) },
  { title: "Android app: back button closes app instead of navigating back", description: "On Android, pressing the hardware back button exits the app instead of going back to the previous screen. Need to override the back press handler in React Native.", status: "in_progress", priority: "medium", created_at: makeDate(15, 11, 30), updated_at: makeDate(17, 9, 0) },
  { title: "Email digest: links redirect to login instead of the ticket", description: "Deep links in the daily email digest are not preserving the redirect target after login. Users land on the dashboard instead of the specific ticket.", status: "resolved", priority: "medium", created_at: makeDate(14, 8, 45), updated_at: makeDate(16, 15, 30) },
  { title: "Add @mention notifications for ticket comments", description: "Users want to be able to @mention teammates in ticket comments and have them receive an in-app + email notification. Similar to GitHub issue comments.", status: "open", priority: "medium", created_at: makeDate(16, 9, 0), updated_at: makeDate(16, 9, 0) },
  { title: "Notification preferences page resets on page reload", description: "Changes to notification preferences (email, push, Slack) are saved to the API correctly but the UI reverts to the previous state after a page reload. Cache invalidation issue.", status: "open", priority: "low", created_at: makeDate(17, 10, 15), updated_at: makeDate(17, 10, 15) },

  // Sprint 26 — Data & Exports
  { title: "CSV import rejects valid UTF-8 encoded files", description: "The CSV importer is throwing a parse error for files with UTF-8 BOM (common in Excel exports from Windows). Need to strip BOM before parsing.", status: "resolved", priority: "medium", created_at: makeDate(16, 13, 0), updated_at: makeDate(18, 10, 0) },
  { title: "Data retention policy: auto-archive tickets older than 2 years", description: "Per compliance requirements, tickets older than 2 years must be moved to cold storage and removed from the active DB. Need a scheduled job + archival API.", status: "open", priority: "low", created_at: makeDate(18, 9, 0), updated_at: makeDate(18, 9, 0) },
  { title: "GDPR right-to-erasure: full data deletion not working for SSO users", description: "When a user requests data deletion, the job removes their profile but doesn't delete SSO identity mappings. These orphaned records can block future signups with the same email.", status: "in_progress", priority: "critical", created_at: makeDate(17, 8, 30), updated_at: makeDate(19, 11, 0) },
  { title: "Add Looker Studio data connector for custom reporting", description: "Several customers have requested the ability to connect their Looker Studio dashboards to our data. Need to implement a Looker Studio Community Connector (OAuth + REST).", status: "open", priority: "medium", created_at: makeDate(19, 10, 30), updated_at: makeDate(19, 10, 30) },
  { title: "Ticket activity timeline missing merge/split events", description: "When tickets are merged or split, the activity timeline shows a gap. These operations need to emit audit events that appear in the timeline view.", status: "open", priority: "low", created_at: makeDate(20, 9, 0), updated_at: makeDate(20, 9, 0) },

  // Sprint 26 — Infrastructure
  { title: "Postgres connection pool exhausted during traffic spikes", description: "During peak hours, the PgBouncer connection pool maxes out at 100 connections and new requests timeout. Need to tune pool_size, increase DB instance size, or add read replicas.", status: "in_progress", priority: "critical", created_at: makeDate(18, 7, 30), updated_at: makeDate(20, 10, 15) },
  { title: "Cloudflare WAF blocking legitimate API requests with 403", description: "Some API clients are getting 403 responses from Cloudflare's WAF. The rule matching appears to be triggered by large JSON payloads. Need to tune WAF rules for API paths.", status: "open", priority: "high", created_at: makeDate(19, 9, 0), updated_at: makeDate(19, 9, 0) },
  { title: "Add multi-region failover for US-East primary database", description: "The primary Postgres instance is in us-east-1 with no auto-failover. Set up streaming replication to eu-west-1 and configure automatic failover with a 30s RTO target.", status: "open", priority: "high", created_at: makeDate(20, 10, 0), updated_at: makeDate(20, 10, 0) },
  { title: "Deploy canary release pipeline for Worker deployments", description: "Currently all Worker deployments go to 100% of traffic at once. Set up a canary pipeline that rolls out to 5% → 25% → 100% with automatic rollback on error rate spike.", status: "open", priority: "medium", created_at: makeDate(21, 9, 30), updated_at: makeDate(21, 9, 30) },
  { title: "R2 bucket lifecycle rule deleting attachments prematurely", description: "A misconfigured R2 lifecycle rule is deleting ticket attachments after 7 days instead of 365 days. Files from the past week have been permanently deleted.", status: "resolved", priority: "critical", created_at: makeDate(19, 6, 15), updated_at: makeDate(19, 14, 30) },

  // Sprint 27 — AI & Agents
  { title: "AI ticket categorization model misclassifying billing issues as bugs", description: "The fine-tuned classification model has low precision on the 'billing' category (62%). Most billing tickets are being labelled as 'bug'. Need to expand training data for billing category.", status: "in_progress", priority: "high", created_at: makeDate(21, 10, 0), updated_at: makeDate(23, 9, 30) },
  { title: "Agent tool calls timing out on Durable Object cold starts", description: "When a Durable Object handling an agent session has been idle, the first tool call in a new session times out (15s). Implement DO warmup pings or reduce the time-to-first-byte for cold starts.", status: "open", priority: "high", created_at: makeDate(22, 9, 0), updated_at: makeDate(22, 9, 0) },
  { title: "MCP server tool schema not respecting Zod .default() values", description: "Optional fields with .default() in the Zod schema are being marked as required in the generated JSON Schema passed to the LLM. This causes the model to include unnecessary args.", status: "resolved", priority: "medium", created_at: makeDate(21, 11, 30), updated_at: makeDate(23, 15, 0) },
  { title: "Implement streaming responses for AI-generated ticket summaries", description: "The AI summary feature waits for the full response before rendering. Implement SSE streaming so users see the summary being generated word-by-word.", status: "in_progress", priority: "medium", created_at: makeDate(23, 10, 0), updated_at: makeDate(25, 9, 0) },
  { title: "Add LLM-powered smart reply suggestions for support agents", description: "Build a feature that suggests 3 reply templates based on the ticket content and conversation history. Use Workers AI with context from similar resolved tickets.", status: "open", priority: "medium", created_at: makeDate(24, 9, 0), updated_at: makeDate(24, 9, 0) },
  { title: "Codemode executor: parallel tool calls not respecting variable bindings", description: "When the LLM generates code that calls multiple tools in parallel with Promise.all(), variable bindings from parallel calls are not correctly isolated. Leads to result collisions.", status: "open", priority: "high", created_at: makeDate(25, 10, 30), updated_at: makeDate(25, 10, 30) },
  { title: "AI agent generating hallucinated ticket IDs in resolve calls", description: "In multi-step agentic tasks, the model sometimes generates plausible-looking but non-existent ticket IDs when calling resolve_ticket. Need to add a validation step.", status: "in_progress", priority: "high", created_at: makeDate(26, 9, 0), updated_at: makeDate(27, 11, 0) },
];

// Seed the store once at module load — uses Math.random (safe at global scope)
for (const seed of SEED_TICKETS) {
  const id = generateSeedId();
  ticketStore.set(id, { id, ...seed });
}

// ── Tool definitions ─────────────────────────────────────────────────────────

export const ticketTools = {
  create_ticket: tool({
    description: "Create a new support/task ticket in the ticketing system",
    inputSchema: z.object({
      title: z.string().describe("Short title for the ticket"),
      description: z.string().describe("Detailed description of the issue or task"),
      priority: z
        .enum(["low", "medium", "high", "critical"])
        .default("medium")
        .describe("Priority level of the ticket"),
    }),
    execute: async ({ title, description, priority }) => {
      const id = generateId();
      const now = new Date().toISOString();
      const ticket: Ticket = {
        id,
        title,
        description,
        status: "open" as TicketStatus,
        priority: (priority ?? "medium") as TicketPriority,
        created_at: now,
        updated_at: now,
      };
      ticketStore.set(id, ticket);
      return { success: true, ticket };
    },
  }),

  list_tickets: tool({
    description: "List all tickets, optionally filtered by status",
    inputSchema: z.object({
      status: z
        .enum(["open", "in_progress", "resolved", "all"])
        .default("all")
        .describe("Filter tickets by status. Use 'all' to get every ticket."),
    }),
    execute: async ({ status }) => {
      const all = Array.from(ticketStore.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const tickets = status === "all" ? all : all.filter(t => t.status === status);
      return { success: true, count: tickets.length, tickets };
    },
  }),

  get_ticket: tool({
    description: "Get a single ticket by its ID",
    inputSchema: z.object({
      id: z.string().describe("The ticket ID (e.g. T-A1B2C3D4)"),
    }),
    execute: async ({ id }) => {
      const ticket = ticketStore.get(id);
      if (!ticket) return { success: false, error: `Ticket ${id} not found` };
      return { success: true, ticket };
    },
  }),

  resolve_ticket: tool({
    description: "Mark a ticket as resolved",
    inputSchema: z.object({
      id: z.string().describe("The ticket ID to resolve"),
      resolution: z.string().optional().describe("Optional resolution notes"),
    }),
    execute: async ({ id, resolution }) => {
      const ticket = ticketStore.get(id);
      if (!ticket) return { success: false, error: `Ticket ${id} not found` };
      ticket.status = "resolved";
      ticket.updated_at = new Date().toISOString();
      ticketStore.set(id, ticket);
      return { success: true, ticket, resolution: resolution || "Marked as resolved" };
    },
  }),

  update_ticket_status: tool({
    description: "Update the status of a ticket",
    inputSchema: z.object({
      id: z.string().describe("The ticket ID"),
      status: z
        .enum(["open", "in_progress", "resolved"])
        .describe("New status for the ticket"),
    }),
    execute: async ({ id, status }) => {
      const ticket = ticketStore.get(id);
      if (!ticket) return { success: false, error: `Ticket ${id} not found` };
      ticket.status = status as TicketStatus;
      ticket.updated_at = new Date().toISOString();
      ticketStore.set(id, ticket);
      return { success: true, ticket };
    },
  }),
  list_recent_tickets: tool({
    description: "List the most recently created tickets, up to a specified limit",
    inputSchema: z.object({
      limit: z.number().min(1).max(50).default(10).describe("Number of most recent tickets to return (max 50)"),
      status: z.enum(["open", "in_progress", "resolved", "all"]).default("all").describe("Filter by status"),
    }),
    execute: async ({ limit, status }) => {
      const all = Array.from(ticketStore.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const filtered = status === "all" ? all : all.filter(t => t.status === status);
      const tickets = filtered.slice(0, limit ?? 10);
      return { success: true, count: tickets.length, tickets };
    },
  }),

  search_tickets: tool({
    description: "Search tickets by keyword in title or description",
    inputSchema: z.object({
      query: z.string().describe("Search term to look for in ticket titles and descriptions"),
    }),
    execute: async ({ query }) => {
      const q = query.toLowerCase();
      const tickets = Array.from(ticketStore.values())
        .filter(t => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return { success: true, count: tickets.length, query, tickets };
    },
  }),

  get_ticket_stats: tool({
    description: "Get a summary of ticket counts grouped by status and priority",
    inputSchema: z.object({}),
    execute: async () => {
      const all = Array.from(ticketStore.values());
      const byStatus: Record<string, number> = {};
      const byPriority: Record<string, number> = {};
      for (const t of all) {
        byStatus[t.status]     = (byStatus[t.status]     ?? 0) + 1;
        byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;
      }
      return { success: true, stats: { total: all.length, by_status: byStatus, by_priority: byPriority } };
    },
  }),

  bulk_update_status: tool({
    description: "Update the status of multiple tickets at once",
    inputSchema: z.object({
      ids: z.array(z.string()).describe("Array of ticket IDs to update"),
      status: z.enum(["open", "in_progress", "resolved"]).describe("New status to apply to all specified tickets"),
    }),
    execute: async ({ ids, status }) => {
      const now = new Date().toISOString();
      const updated: Ticket[] = [];
      const notFound: string[] = [];
      for (const id of ids) {
        const ticket = ticketStore.get(id);
        if (!ticket) { notFound.push(id); continue; }
        ticket.status = status as TicketStatus;
        ticket.updated_at = now;
        ticketStore.set(id, ticket);
        updated.push(ticket);
      }
      return { success: true, updated_count: updated.length, not_found: notFound, tickets: updated };
    },
  }),

  get_tickets_by_priority: tool({
    description: "List tickets filtered by priority level, optionally also filtered by status",
    inputSchema: z.object({
      priority: z.enum(["low", "medium", "high", "critical"]).describe("Priority level to filter by"),
      status: z.enum(["open", "in_progress", "resolved", "all"]).default("all").describe("Also filter by status"),
    }),
    execute: async ({ priority, status }) => {
      const all = Array.from(ticketStore.values())
        .filter(t => t.priority === priority)
        .filter(t => status === "all" || t.status === status)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return { success: true, priority, count: all.length, tickets: all };
    },
  }),

  get_sprint_summary: tool({
    description: "Get a full sprint health summary: ticket counts by status and priority, list of all open critical tickets, and in-progress tickets",
    inputSchema: z.object({}),
    execute: async () => {
      const all = Array.from(ticketStore.values());
      const byStatus: Record<string, number> = {};
      const byPriority: Record<string, number> = {};
      for (const t of all) {
        byStatus[t.status]     = (byStatus[t.status]     ?? 0) + 1;
        byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;
      }
      const criticalOpen = all.filter(t => t.priority === "critical" && t.status === "open");
      const inProgress   = all.filter(t => t.status === "in_progress");
      return {
        success: true,
        summary: {
          total: all.length,
          by_status: byStatus,
          by_priority: byPriority,
          critical_open: criticalOpen,
          in_progress: inProgress,
        },
      };
    },
  }),

  add_comment: tool({
    description: "Add a comment to a ticket",
    inputSchema: z.object({
      id: z.string().describe("The ticket ID to comment on"),
      author: z.string().default("agent").describe("Author name for the comment"),
      body: z.string().describe("The comment text"),
    }),
    execute: async ({ id, author, body }) => {
      const ticket = ticketStore.get(id);
      if (!ticket) return { success: false, error: `Ticket ${id} not found` };
      const comment = {
        id: "C-" + Math.random().toString(36).slice(2, 10).toUpperCase(),
        ticket_id: id,
        author: author ?? "agent",
        body,
        created_at: new Date().toISOString(),
      };
      if (!commentStore.has(id)) commentStore.set(id, []);
      commentStore.get(id)!.push(comment);
      return { success: true, comment };
    },
  }),

  get_ticket_comments: tool({
    description: "Get all comments on a ticket",
    inputSchema: z.object({
      id: z.string().describe("The ticket ID"),
    }),
    execute: async ({ id }) => {
      const ticket = ticketStore.get(id);
      if (!ticket) return { success: false, error: `Ticket ${id} not found` };
      const comments = commentStore.get(id) ?? [];
      return { success: true, ticket_id: id, count: comments.length, comments };
    },
  }),
};

export type TicketTools = typeof ticketTools;
