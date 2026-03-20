/**
 * Shared D1 database layer.
 * Used by both TicketMCP (MCP mode) and DemoAgent (codemode) so they
 * always read and write the same tickets.
 */

export type TicketStatus   = "open" | "in_progress" | "resolved";
export type TicketPriority = "low" | "medium" | "high" | "critical";

export interface Ticket {
  id:          string;
  title:       string;
  description: string;
  status:      TicketStatus;
  priority:    TicketPriority;
  created_at:  string;
  updated_at:  string;
}

export interface Comment {
  id:         string;
  ticket_id:  string;
  author:     string;
  body:       string;
  created_at: string;
}

// ── Schema + seed ─────────────────────────────────────────────────────────────

const DDL_TICKETS  = "CREATE TABLE IF NOT EXISTS tickets (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', priority TEXT NOT NULL DEFAULT 'medium', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)";
const DDL_COMMENTS = "CREATE TABLE IF NOT EXISTS comments (id TEXT PRIMARY KEY, ticket_id TEXT NOT NULL, author TEXT NOT NULL DEFAULT 'agent', body TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY (ticket_id) REFERENCES tickets(id))";

function makeDate(day: number, hour = 9, min = 0): string {
  return new Date(2026, 2, day, hour, min, 0).toISOString();
}

const SEED: Omit<Ticket, "id">[] = [
  // Auth & Onboarding
  { title: "Login bug: SSO fails for Okta users after token refresh", description: "Critical login bug — users authenticated via Okta are being logged out unexpectedly after their session token refreshes. The OIDC callback is returning a 401. Affects ~200 enterprise accounts.", status: "open", priority: "critical", created_at: makeDate(1, 8, 12), updated_at: makeDate(1, 8, 12) },
  { title: "Signup email confirmation not delivered to @icloud.com addresses", description: "Transactional emails sent via SendGrid are being silently dropped for iCloud addresses. SPF/DKIM records look correct. Possibly an Apple-side filtering issue.", status: "in_progress", priority: "high", created_at: makeDate(1, 9, 5), updated_at: makeDate(3, 14, 22) },
  { title: "Add SAML 2.0 support for enterprise SSO", description: "Several enterprise customers (Accenture, Deloitte) have requested SAML 2.0 as an alternative to OIDC. Need to integrate with passport-saml and add IdP metadata upload UI.", status: "open", priority: "high", created_at: makeDate(2, 10, 30), updated_at: makeDate(2, 10, 30) },
  { title: "Password reset link expires too quickly (5 min)", description: "Users on slow connections or mobile are hitting the reset link after it expires. Industry standard is 30–60 min. Extend to 30 minutes.", status: "resolved", priority: "medium", created_at: makeDate(1, 11, 0), updated_at: makeDate(4, 16, 45) },
  { title: "Login bug: mobile app shows invalid credentials error", description: "Login bug on mobile — users get 'Invalid credentials' on the iOS and Android apps despite correct password. The login bug appears to be in the OAuth2 PKCE flow; desktop login works fine.", status: "open", priority: "high", created_at: makeDate(2, 14, 30), updated_at: makeDate(2, 14, 30) },
  { title: "Onboarding wizard skips step 3 on Safari 17.3", description: "The multi-step onboarding form jumps from step 2 directly to step 4 on Safari 17.3 (macOS Sequoia). Likely a CSS :has() selector issue.", status: "in_progress", priority: "high", created_at: makeDate(3, 9, 15), updated_at: makeDate(5, 11, 0) },
  // Dashboard & UI
  { title: "Dashboard chart shows wrong date range after timezone change", description: "If a user changes their timezone in settings, the activity chart continues to render data in the old timezone until a hard refresh. Should recompute on timezone update.", status: "open", priority: "medium", created_at: makeDate(3, 13, 0), updated_at: makeDate(3, 13, 0) },
  { title: "Dark mode: modal overlays appear with incorrect z-index", description: "When a confirmation modal is open in dark mode, dropdown menus from the parent page render on top of the modal overlay. z-index stacking context issue.", status: "open", priority: "medium", created_at: makeDate(4, 10, 45), updated_at: makeDate(4, 10, 45) },
  { title: "Export to CSV truncates cells with commas in the value", description: "Ticket titles containing commas break the CSV column alignment. Values need to be wrapped in double-quotes per RFC 4180.", status: "resolved", priority: "low", created_at: makeDate(2, 15, 20), updated_at: makeDate(6, 9, 10) },
  { title: "Sidebar nav collapses unexpectedly on 1280px viewport", description: "At exactly 1280px width, the sidebar enters mobile-collapse mode even though it should display in desktop layout. The Tailwind xl: breakpoint boundary is off by 1px.", status: "open", priority: "low", created_at: makeDate(5, 8, 0), updated_at: makeDate(5, 8, 0) },
  { title: "Add keyboard shortcut (Cmd+K) for global search", description: "Power users have requested a command palette similar to Linear / Notion. Should open a search overlay that allows fuzzy-finding tickets, users, and settings pages.", status: "open", priority: "medium", created_at: makeDate(6, 11, 30), updated_at: makeDate(6, 11, 30) },
  // API & Integrations
  { title: "Webhooks not retrying on 503 responses", description: "When a customer's webhook endpoint returns 503, the system marks the delivery as failed immediately instead of retrying with exponential backoff. Should retry up to 5 times over 24h.", status: "in_progress", priority: "high", created_at: makeDate(4, 9, 0), updated_at: makeDate(7, 10, 30) },
  { title: "GitHub integration: PR status not syncing after repo rename", description: "When a GitHub repository is renamed, the webhook URL changes and existing installations stop receiving events. Need to handle the repository.renamed webhook event.", status: "open", priority: "high", created_at: makeDate(5, 14, 15), updated_at: makeDate(5, 14, 15) },
  { title: "Rate limiting returns 500 instead of 429", description: "When a client exceeds the API rate limit, the server throws an unhandled exception and returns 500. Should return 429 with Retry-After header.", status: "resolved", priority: "critical", created_at: makeDate(3, 7, 55), updated_at: makeDate(5, 16, 0) },
  { title: "Slack integration: notifications sent twice for same event", description: "Users with Slack integration enabled are receiving duplicate notifications for ticket status changes. Appears to be a race condition in the event emitter.", status: "in_progress", priority: "high", created_at: makeDate(6, 9, 20), updated_at: makeDate(8, 11, 45) },
  // Performance
  { title: "Ticket list loads slowly (>3s) for accounts with 10k+ tickets", description: "The main ticket list endpoint is doing a full table scan instead of using the indexed created_at column. Add cursor-based pagination and ensure the composite index is used.", status: "in_progress", priority: "critical", created_at: makeDate(8, 8, 30), updated_at: makeDate(10, 9, 15) },
  { title: "Search indexing falls behind during bulk imports", description: "When customers import more than 500 tickets via CSV, the Elasticsearch indexer queue backs up and search results are stale for up to 30 minutes.", status: "open", priority: "high", created_at: makeDate(9, 11, 0), updated_at: makeDate(9, 11, 0) },
  { title: "Reduce cold start time for Edge Functions", description: "The /api/search edge function has a 1.2s cold start due to importing the full Zod bundle. Tree-shake and lazy-load schemas to target <100ms cold start.", status: "open", priority: "medium", created_at: makeDate(10, 13, 30), updated_at: makeDate(10, 13, 30) },
  { title: "Add Redis caching layer for user permissions", description: "Permission checks on every API request are causing redundant DB queries. Cache user role/permission data in Redis with a 5-minute TTL and invalidate on role change.", status: "in_progress", priority: "high", created_at: makeDate(9, 9, 0), updated_at: makeDate(11, 14, 0) },
  { title: "Image uploads over 5MB cause worker OOM crash", description: "Uploading large images (logos, screenshots) via the attachments endpoint causes the Node worker to run out of memory. Need to use streaming upload to S3 instead of buffering.", status: "resolved", priority: "critical", created_at: makeDate(7, 7, 45), updated_at: makeDate(9, 10, 20) },
  // Security
  { title: "Audit log missing entries for bulk delete operations", description: "When a user performs a bulk delete of tickets via the API, only the first deletion is written to the audit log. The rest are silently omitted.", status: "open", priority: "high", created_at: makeDate(10, 9, 30), updated_at: makeDate(10, 9, 30) },
  { title: "CORS policy allows * origin in production", description: "The API is returning Access-Control-Allow-Origin: * in production, which violates our security policy. Should be restricted to the allow-listed customer domains.", status: "resolved", priority: "critical", created_at: makeDate(8, 6, 30), updated_at: makeDate(8, 18, 0) },
  { title: "Session tokens not invalidated on password change", description: "When a user changes their password, existing session tokens remain valid. All active sessions should be invalidated immediately to prevent session hijacking.", status: "in_progress", priority: "critical", created_at: makeDate(11, 8, 0), updated_at: makeDate(12, 10, 30) },
  { title: "Add CSP headers to prevent XSS injection", description: "The app is missing Content-Security-Policy headers. Need to add a strict CSP that restricts script sources to our CDN and blocks inline scripts.", status: "open", priority: "high", created_at: makeDate(12, 10, 0), updated_at: makeDate(12, 10, 0) },
  { title: "Admin impersonation should require MFA re-verification", description: "When an admin uses the 'impersonate user' feature, there's no additional auth challenge. This is a privilege escalation risk. Require TOTP confirmation.", status: "open", priority: "high", created_at: makeDate(13, 11, 15), updated_at: makeDate(13, 11, 15) },
  // Billing
  { title: "Stripe webhook: invoice.paid not updating subscription status", description: "After a successful payment, the subscription status in our DB stays as 'past_due' until the next cron job runs (24h delay). The invoice.paid webhook handler is not updating the record.", status: "in_progress", priority: "critical", created_at: makeDate(11, 9, 0), updated_at: makeDate(13, 14, 0) },
  { title: "Proration calculation incorrect for mid-cycle plan upgrades", description: "When a customer upgrades from Starter to Pro mid-billing-cycle, the proration amount is calculated from the billing period start instead of the upgrade date.", status: "open", priority: "high", created_at: makeDate(12, 13, 0), updated_at: makeDate(12, 13, 0) },
  { title: "Add support for annual billing discount (20% off)", description: "Sales has approved offering a 20% discount for annual plan commitments. Need to add annual price IDs in Stripe, update the pricing page, and handle the checkout flow.", status: "open", priority: "medium", created_at: makeDate(14, 10, 0), updated_at: makeDate(14, 10, 0) },
  { title: "Invoice PDF not generated for EU customers (VAT required)", description: "EU customers are required by law to receive VAT invoices. Our current Stripe invoice template doesn't include VAT number or the required EU disclosure text.", status: "in_progress", priority: "high", created_at: makeDate(13, 9, 30), updated_at: makeDate(15, 11, 0) },
  { title: "Free trial users can access paid features via direct URL", description: "Users on a free trial can access Pro-tier features by navigating directly to the URL. The feature gate middleware is only applied at the UI routing level, not the API.", status: "resolved", priority: "critical", created_at: makeDate(10, 7, 0), updated_at: makeDate(12, 16, 30) },
  // Mobile & Notifications
  { title: "Push notifications not delivered on iOS 17.4+ (background fetch)", description: "Since iOS 17.4, background fetch for push notifications has changed. Our service worker registration is failing silently. Needs investigation with APNs logs.", status: "open", priority: "high", created_at: makeDate(15, 10, 0), updated_at: makeDate(15, 10, 0) },
  { title: "Android app: back button closes app instead of navigating back", description: "On Android, pressing the hardware back button exits the app instead of going back to the previous screen. Need to override the back press handler in React Native.", status: "in_progress", priority: "medium", created_at: makeDate(15, 11, 30), updated_at: makeDate(17, 9, 0) },
  { title: "Email digest: links redirect to login instead of the ticket", description: "Deep links in the daily email digest are not preserving the redirect target after login. Users land on the dashboard instead of the specific ticket.", status: "resolved", priority: "medium", created_at: makeDate(14, 8, 45), updated_at: makeDate(16, 15, 30) },
  { title: "Add @mention notifications for ticket comments", description: "Users want to be able to @mention teammates in ticket comments and have them receive an in-app + email notification. Similar to GitHub issue comments.", status: "open", priority: "medium", created_at: makeDate(16, 9, 0), updated_at: makeDate(16, 9, 0) },
  { title: "Notification preferences page resets on page reload", description: "Changes to notification preferences (email, push, Slack) are saved to the API correctly but the UI reverts to the previous state after a page reload. Cache invalidation issue.", status: "open", priority: "low", created_at: makeDate(17, 10, 15), updated_at: makeDate(17, 10, 15) },
  // Infrastructure
  { title: "Postgres connection pool exhausted during traffic spikes", description: "During peak hours, the PgBouncer connection pool maxes out at 100 connections and new requests timeout. Need to tune pool_size, increase DB instance size, or add read replicas.", status: "in_progress", priority: "critical", created_at: makeDate(18, 7, 30), updated_at: makeDate(20, 10, 15) },
  { title: "Cloudflare WAF blocking legitimate API requests with 403", description: "Some API clients are getting 403 responses from Cloudflare's WAF. The rule matching appears to be triggered by large JSON payloads. Need to tune WAF rules for API paths.", status: "open", priority: "high", created_at: makeDate(19, 9, 0), updated_at: makeDate(19, 9, 0) },
  { title: "Add multi-region failover for US-East primary database", description: "The primary Postgres instance is in us-east-1 with no auto-failover. Set up streaming replication to eu-west-1 and configure automatic failover with a 30s RTO target.", status: "open", priority: "high", created_at: makeDate(20, 10, 0), updated_at: makeDate(20, 10, 0) },
  { title: "Deploy canary release pipeline for Worker deployments", description: "Currently all Worker deployments go to 100% of traffic at once. Set up a canary pipeline that rolls out to 5% → 25% → 100% with automatic rollback on error rate spike.", status: "open", priority: "medium", created_at: makeDate(21, 9, 30), updated_at: makeDate(21, 9, 30) },
  { title: "R2 bucket lifecycle rule deleting attachments prematurely", description: "A misconfigured R2 lifecycle rule is deleting ticket attachments after 7 days instead of 365 days. Files from the past week have been permanently deleted.", status: "resolved", priority: "critical", created_at: makeDate(19, 6, 15), updated_at: makeDate(19, 14, 30) },
  // AI & Agents
  { title: "AI ticket categorization model misclassifying billing issues as bugs", description: "The fine-tuned classification model has low precision on the 'billing' category (62%). Most billing tickets are being labelled as 'bug'. Need to expand training data for billing category.", status: "in_progress", priority: "high", created_at: makeDate(21, 10, 0), updated_at: makeDate(23, 9, 30) },
  { title: "Agent tool calls timing out on Durable Object cold starts", description: "When a Durable Object handling an agent session has been idle, the first tool call in a new session times out (15s). Implement DO warmup pings or reduce the time-to-first-byte for cold starts.", status: "open", priority: "high", created_at: makeDate(22, 9, 0), updated_at: makeDate(22, 9, 0) },
  { title: "MCP server tool schema not respecting Zod .default() values", description: "Optional fields with .default() in the Zod schema are being marked as required in the generated JSON Schema passed to the LLM. This causes the model to include unnecessary args.", status: "resolved", priority: "medium", created_at: makeDate(21, 11, 30), updated_at: makeDate(23, 15, 0) },
  { title: "Implement streaming responses for AI-generated ticket summaries", description: "The AI summary feature waits for the full response before rendering. Implement SSE streaming so users see the summary being generated word-by-word.", status: "in_progress", priority: "medium", created_at: makeDate(23, 10, 0), updated_at: makeDate(25, 9, 0) },
  { title: "Add LLM-powered smart reply suggestions for support agents", description: "Build a feature that suggests 3 reply templates based on the ticket content and conversation history. Use Workers AI with context from similar resolved tickets.", status: "open", priority: "medium", created_at: makeDate(24, 9, 0), updated_at: makeDate(24, 9, 0) },
  { title: "Codemode executor: parallel tool calls not respecting variable bindings", description: "When the LLM generates code that calls multiple tools in parallel with Promise.all(), variable bindings from parallel calls are not correctly isolated. Leads to result collisions.", status: "open", priority: "high", created_at: makeDate(25, 10, 30), updated_at: makeDate(25, 10, 30) },
  { title: "AI agent generating hallucinated ticket IDs in resolve calls", description: "In multi-step agentic tasks, the model sometimes generates plausible-looking but non-existent ticket IDs when calling resolve_ticket. Need to add a validation step.", status: "in_progress", priority: "high", created_at: makeDate(26, 9, 0), updated_at: makeDate(27, 11, 0) },
];

function newId(): string {
  try {
    return "T-" + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  } catch {
    return "T-" + Math.random().toString(16).slice(2, 10).toUpperCase();
  }
}

// ── D1 helpers ────────────────────────────────────────────────────────────────

export async function initDb(db: D1Database): Promise<void> {
  // Use prepare().run() instead of exec() — more robust in bundled Workers
  await db.prepare(DDL_TICKETS).run();
  await db.prepare(DDL_COMMENTS).run();

  // Seed only if empty
  const { results } = await db.prepare("SELECT COUNT(*) as count FROM tickets").all<{ count: number }>();
  if ((results[0]?.count ?? 0) > 0) return;

  // Batch insert all seed tickets
  const stmts = SEED.map(t =>
    db.prepare(
      "INSERT OR IGNORE INTO tickets (id, title, description, status, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(newId(), t.title, t.description, t.status, t.priority, t.created_at, t.updated_at)
  );
  await db.batch(stmts);
}

export async function resetDb(db: D1Database): Promise<void> {
  // Wipe all data and re-seed from scratch
  await db.batch([
    db.prepare("DELETE FROM comments"),
    db.prepare("DELETE FROM tickets"),
  ]);
  const stmts = SEED.map(t =>
    db.prepare(
      "INSERT OR IGNORE INTO tickets (id, title, description, status, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(newId(), t.title, t.description, t.status, t.priority, t.created_at, t.updated_at)
  );
  await db.batch(stmts);
}

// ── CRUD operations ───────────────────────────────────────────────────────────

export async function dbCreateTicket(
  db: D1Database,
  args: { title: string; description: string; priority?: string }
): Promise<{ success: true; ticket: Ticket }> {
  const id  = newId();
  const now = new Date().toISOString();
  const priority = args.priority ?? "medium";
  await db.prepare(
    "INSERT INTO tickets (id, title, description, status, priority, created_at, updated_at) VALUES (?, ?, ?, 'open', ?, ?, ?)"
  ).bind(id, args.title, args.description, priority, now, now).run();
  return { success: true, ticket: { id, title: args.title, description: args.description, status: "open", priority: priority as TicketPriority, created_at: now, updated_at: now } };
}

export async function dbListTickets(
  db: D1Database,
  args: { status?: string }
): Promise<{ success: true; count: number; tickets: Pick<Ticket, "id" | "title" | "status" | "priority">[] }> {
  const status = args.status ?? "all";
  const { results } = status === "all"
    ? await db.prepare("SELECT id, title, status, priority FROM tickets ORDER BY created_at DESC").all<Pick<Ticket, "id" | "title" | "status" | "priority">>()
    : await db.prepare("SELECT id, title, status, priority FROM tickets WHERE status = ? ORDER BY created_at DESC").bind(status).all<Pick<Ticket, "id" | "title" | "status" | "priority">>();
  return { success: true, count: results.length, tickets: results };
}

export async function dbListRecentTickets(
  db: D1Database,
  args: { limit?: number; status?: string }
): Promise<{ success: true; count: number; tickets: Ticket[] }> {
  const limit  = Math.min(args.limit ?? 10, 50);
  const status = args.status ?? "all";
  const { results } = status === "all"
    ? await db.prepare("SELECT * FROM tickets ORDER BY created_at DESC LIMIT ?").bind(limit).all<Ticket>()
    : await db.prepare("SELECT * FROM tickets WHERE status = ? ORDER BY created_at DESC LIMIT ?").bind(status, limit).all<Ticket>();
  return { success: true, count: results.length, tickets: results };
}

export async function dbGetTicket(
  db: D1Database,
  args: { id: string }
): Promise<{ success: true; ticket: Ticket } | { success: false; error: string }> {
  const ticket = await db.prepare("SELECT * FROM tickets WHERE id = ?").bind(args.id).first<Ticket>();
  if (!ticket) return { success: false, error: `Ticket ${args.id} not found` };
  return { success: true, ticket };
}

export async function dbResolveTicket(
  db: D1Database,
  args: { id: string; resolution?: string }
): Promise<{ success: true; ticket: Ticket; resolution: string } | { success: false; error: string }> {
  const now = new Date().toISOString();
  const { meta } = await db.prepare("UPDATE tickets SET status = 'resolved', updated_at = ? WHERE id = ?").bind(now, args.id).run();
  if (meta.changes === 0) return { success: false, error: `Ticket ${args.id} not found` };
  const ticket = await db.prepare("SELECT * FROM tickets WHERE id = ?").bind(args.id).first<Ticket>() as Ticket;
  return { success: true, ticket, resolution: args.resolution ?? "Marked as resolved" };
}

export async function dbUpdateTicketStatus(
  db: D1Database,
  args: { id: string; status: string }
): Promise<{ success: true; id: string; status: string } | { success: false; error: string }> {
  const now = new Date().toISOString();
  const { meta } = await db.prepare("UPDATE tickets SET status = ?, updated_at = ? WHERE id = ?").bind(args.status, now, args.id).run();
  if (meta.changes === 0) return { success: false, error: `Ticket ${args.id} not found` };
  return { success: true, id: args.id, status: args.status };
}

export async function dbBulkUpdateStatus(
  db: D1Database,
  args: { ids: string[]; status: string }
): Promise<{ success: true; updated_count: number; not_found: string[]; updated_ids: string[] }> {
  const now      = new Date().toISOString();
  const updatedIds: string[] = [];
  const notFound: string[] = [];
  for (const id of args.ids) {
    const { meta } = await db.prepare("UPDATE tickets SET status = ?, updated_at = ? WHERE id = ?").bind(args.status, now, id).run();
    if (meta.changes === 0) { notFound.push(id); continue; }
    updatedIds.push(id);
  }
  return { success: true, updated_count: updatedIds.length, not_found: notFound, updated_ids: updatedIds };
}

export async function dbUpdateTicketPriority(
  db: D1Database,
  args: { id: string; priority: string }
): Promise<{ success: true; ticket: Ticket } | { success: false; error: string }> {
  const now = new Date().toISOString();
  const { meta } = await db.prepare("UPDATE tickets SET priority = ?, updated_at = ? WHERE id = ?").bind(args.priority, now, args.id).run();
  if (meta.changes === 0) return { success: false, error: `Ticket ${args.id} not found` };
  const ticket = await db.prepare("SELECT * FROM tickets WHERE id = ?").bind(args.id).first<Ticket>() as Ticket;
  return { success: true, ticket };
}

export async function dbBulkUpdatePriority(
  db: D1Database,
  args: { ids: string[]; priority: string }
): Promise<{ success: true; updated_count: number; not_found: string[]; updated_ids: string[] }> {
  const now      = new Date().toISOString();
  const updatedIds: string[] = [];
  const notFound: string[] = [];
  for (const id of args.ids) {
    const { meta } = await db.prepare("UPDATE tickets SET priority = ?, updated_at = ? WHERE id = ?").bind(args.priority, now, id).run();
    if (meta.changes === 0) { notFound.push(id); continue; }
    updatedIds.push(id);
  }
  return { success: true, updated_count: updatedIds.length, not_found: notFound, updated_ids: updatedIds };
}

export async function dbSearchTickets(
  db: D1Database,
  args: { query: string }
): Promise<{ success: true; count: number; query: string; tickets: Pick<Ticket, "id" | "title" | "status" | "priority">[] }> {
  // Support multi-word queries: split on whitespace and OR each term so that
  // e.g. "auth login" finds tickets matching "auth" OR "login".
  const terms = args.query.trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return { success: true, count: 0, query: args.query, tickets: [] };

  const conditions = terms.map(() => "(title LIKE ? OR description LIKE ?)").join(" OR ");
  const bindings   = terms.flatMap(t => [`%${t}%`, `%${t}%`]);
  const { results } = await db.prepare(
    `SELECT id, title, status, priority FROM tickets WHERE ${conditions} ORDER BY created_at DESC`
  ).bind(...bindings).all<Pick<Ticket, "id" | "title" | "status" | "priority">>();

  // Deduplicate (a ticket may match multiple terms)
  const seen = new Set<string>();
  const unique = results.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });
  return { success: true, count: unique.length, query: args.query, tickets: unique };
}

export async function dbGetTicketStats(
  db: D1Database
): Promise<{ success: true; stats: { total: number; by_status: Record<string, number>; by_priority: Record<string, number> } }> {
  const { results: all } = await db.prepare("SELECT * FROM tickets").all<Ticket>();
  const by_status:   Record<string, number> = {};
  const by_priority: Record<string, number> = {};
  for (const t of all) {
    by_status[t.status]     = (by_status[t.status]     ?? 0) + 1;
    by_priority[t.priority] = (by_priority[t.priority] ?? 0) + 1;
  }
  return { success: true, stats: { total: all.length, by_status, by_priority } };
}

export async function dbGetTicketsByPriority(
  db: D1Database,
  args: { priority: string; status?: string }
): Promise<{ success: true; priority: string; count: number; tickets: Pick<Ticket, "id" | "title" | "status" | "priority">[] }> {
  const priority = args.priority ?? "all";
  const status   = args.status   ?? "all";
  let results: Pick<Ticket, "id" | "title" | "status" | "priority">[];
  const sel = "SELECT id, title, status, priority FROM tickets";
  if (priority === "all" && status === "all") {
    ({ results } = await db.prepare(`${sel} ORDER BY created_at DESC`).all());
  } else if (priority === "all") {
    ({ results } = await db.prepare(`${sel} WHERE status = ? ORDER BY created_at DESC`).bind(status).all());
  } else if (status === "all") {
    ({ results } = await db.prepare(`${sel} WHERE priority = ? ORDER BY created_at DESC`).bind(priority).all());
  } else {
    ({ results } = await db.prepare(`${sel} WHERE priority = ? AND status = ? ORDER BY created_at DESC`).bind(priority, status).all());
  }
  return { success: true, priority, count: results.length, tickets: results };
}

export async function dbGetSprintSummary(db: D1Database): Promise<{
  success: true;
  summary: {
    total: number;
    by_status:    Record<string, number>;
    by_priority:  Record<string, number>;
    critical_open: Pick<Ticket, "id" | "title" | "status" | "priority">[];
    in_progress_count: number;
    in_progress_by_priority: Record<string, number>;
  };
}> {
  const { results: all }          = await db.prepare("SELECT * FROM tickets").all<Ticket>();
  const { results: criticalOpen } = await db.prepare(
    "SELECT id, title, status, priority FROM tickets WHERE priority = 'critical' AND status = 'open' ORDER BY created_at DESC"
  ).all<Pick<Ticket, "id" | "title" | "status" | "priority">>();
  const { results: inProgress }   = await db.prepare(
    "SELECT priority FROM tickets WHERE status = 'in_progress'"
  ).all<{ priority: string }>();
  const by_status:   Record<string, number> = {};
  const by_priority: Record<string, number> = {};
  const in_progress_by_priority: Record<string, number> = {};
  for (const t of all) {
    by_status[t.status]     = (by_status[t.status]     ?? 0) + 1;
    by_priority[t.priority] = (by_priority[t.priority] ?? 0) + 1;
  }
  for (const t of inProgress) {
    in_progress_by_priority[t.priority] = (in_progress_by_priority[t.priority] ?? 0) + 1;
  }
  return {
    success: true,
    summary: {
      total: all.length,
      by_status,
      by_priority,
      critical_open: criticalOpen,
      in_progress_count: inProgress.length,
      in_progress_by_priority,
    },
  };
}

export async function dbAddComment(
  db: D1Database,
  args: { id: string; body: string; author?: string }
): Promise<{ success: true; comment: Comment } | { success: false; error: string }> {
  const ticket = await db.prepare("SELECT id FROM tickets WHERE id = ?").bind(args.id).first();
  if (!ticket) return { success: false, error: `Ticket ${args.id} not found` };
  const cid    = "C-" + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  const now    = new Date().toISOString();
  const author = args.author ?? "agent";
  await db.prepare("INSERT INTO comments (id, ticket_id, author, body, created_at) VALUES (?, ?, ?, ?, ?)").bind(cid, args.id, author, args.body, now).run();
  return { success: true, comment: { id: cid, ticket_id: args.id, author, body: args.body, created_at: now } };
}

export async function dbBulkAddComment(
  db: D1Database,
  args: { ids: string[]; body: string; author?: string }
): Promise<{ success: true; added_count: number; not_found: string[]; comment_ids: string[] }> {
  const author = args.author ?? "agent";
  const now    = new Date().toISOString();
  const commentIds: string[] = [];
  const notFound: string[]   = [];
  for (const id of args.ids) {
    const ticket = await db.prepare("SELECT id FROM tickets WHERE id = ?").bind(id).first();
    if (!ticket) { notFound.push(id); continue; }
    const cid = "C-" + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
    await db.prepare("INSERT INTO comments (id, ticket_id, author, body, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(cid, id, author, args.body, now).run();
    commentIds.push(cid);
  }
  return { success: true, added_count: commentIds.length, not_found: notFound, comment_ids: commentIds };
}

export async function dbGetTicketComments(
  db: D1Database,
  args: { id: string }
): Promise<{ success: true; ticket_id: string; count: number; comments: Comment[] } | { success: false; error: string }> {
  const ticket = await db.prepare("SELECT id FROM tickets WHERE id = ?").bind(args.id).first();
  if (!ticket) return { success: false, error: `Ticket ${args.id} not found` };
  const { results } = await db.prepare("SELECT * FROM comments WHERE ticket_id = ? ORDER BY created_at ASC").bind(args.id).all<Comment>();
  return { success: true, ticket_id: args.id, count: results.length, comments: results };
}

// ── dispatchTool — single entry point for codemode DO calls ──────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyArgs = any;

export async function dispatchTool(db: D1Database, toolName: string, args: AnyArgs): Promise<unknown> {
  switch (toolName) {
    case "create_ticket":           return dbCreateTicket(db, args);
    case "list_tickets":            return dbListTickets(db, args);
    case "list_recent_tickets":     return dbListRecentTickets(db, args);
    case "get_ticket":              return dbGetTicket(db, args);
    case "resolve_ticket":          return dbResolveTicket(db, args);
    case "update_ticket_status":    return dbUpdateTicketStatus(db, args);
    case "bulk_update_status":      return dbBulkUpdateStatus(db, args);
    case "search_tickets":          return dbSearchTickets(db, args);
    case "get_ticket_stats":        return dbGetTicketStats(db);
    case "get_tickets_by_priority": return dbGetTicketsByPriority(db, args);
    case "get_sprint_summary":      return dbGetSprintSummary(db);
    case "add_comment":             return dbAddComment(db, args);
    case "bulk_add_comment":        return dbBulkAddComment(db, args);
    case "get_ticket_comments":      return dbGetTicketComments(db, args);
    case "update_ticket_priority":   return dbUpdateTicketPriority(db, args);
    case "bulk_update_priority":     return dbBulkUpdatePriority(db, args);
    default: return { success: false, error: `Unknown tool: ${toolName}` };
  }
}
