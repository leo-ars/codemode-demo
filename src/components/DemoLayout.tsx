import { useState, useCallback, useRef, type FormEvent } from "react";
import { Header } from "./Header";
import { ChatPanel } from "./TerminalPanel";
import { TokenComparison } from "./TokenComparison";
import { IntroModal } from "./IntroModal";
import { useTicketAgent } from "../useAgentChat";
import type { ViewMode, TokenMetrics } from "../types";

interface Props {
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
}

const ZERO: TokenMetrics = { inputTokens: 0, outputTokens: 0, totalTokens: 0, durationMs: 0 };

export const SUGGESTIONS = [
  { label: "Simple",  text: "Show me the sprint summary — open criticals and what's in progress" },
  { label: "Simple",  text: "Search for all tickets about the login bug and show me their status" },
  { label: "Simple",  text: "List the 5 most recent tickets" },
  { label: "Complex", text: "Give me a full sprint health report: stats by priority, all critical open tickets, and what's in progress. Then escalate every high-priority open ticket to critical." },
  { label: "Complex", text: "Find all open login bug tickets, mark them in progress, add a comment 'Investigating root cause' to each, then show me the updated list." },
  { label: "Complex", text: "Create 3 new tickets for this sprint (a critical security issue, a high-priority perf bug, and a medium UI fix), mark the security one in progress, then show me all open critical tickets." },
  { label: "Complex", text: "End-of-sprint triage: get the sprint summary, escalate all open critical tickets to in_progress, search for any open tickets related to 'auth' or 'login' and add a comment 'Flagged for priority review by sprint lead' to each, bulk-resolve all in_progress tickets with low or medium priority, create a new ticket titled 'Post-sprint retrospective: review SLA breaches' with high priority, then return a final report: how many tickets changed status, how many comments were added, and the ID of the new ticket." },
];

export function DemoLayout({ viewMode, onViewModeChange }: Props) {
  const [mcpMetrics,  setMcpMetrics]  = useState<TokenMetrics>(ZERO);
  const [codeMetrics, setCodeMetrics] = useState<TokenMetrics>(ZERO);
  const [splitInput,  setSplitInput]  = useState("");
  const [showIntro,   setShowIntro]   = useState(false);
  const [mcpReady,    setMcpReady]    = useState(false);
  const [codeReady,   setCodeReady]   = useState(false);
  const [resetKey,    setResetKey]    = useState(0);
  const splitRef = useRef<HTMLInputElement>(null);

  const mcpAgent  = useTicketAgent("demo-mcp");
  const codeAgent = useTicketAgent("demo-codemode");

  const addMcpMetrics  = useCallback((m: TokenMetrics) => setMcpMetrics(m),  []);
  const addCodeMetrics = useCallback((m: TokenMetrics) => setCodeMetrics(m), []);

  // Single Reset action: wipes DB, clears chat history, resets metrics.
  // Bumping resetKey remounts both ChatPanels so they re-run their switchMode
  // handshake and set ready=true again cleanly.
  const handleReset = useCallback(async () => {
    setMcpReady(false);
    setCodeReady(false);
    setMcpMetrics(ZERO);
    setCodeMetrics(ZERO);
    await Promise.all([
      fetch("/agents/demo-agent/demo-mcp/reset-db",      { method: "POST" }),
      fetch("/agents/demo-agent/demo-codemode/reset-db", { method: "POST" }),
    ]);
    mcpAgent.clearHistory();
    codeAgent.clearHistory();
    setResetKey(k => k + 1);
  }, [mcpAgent, codeAgent]);



  const isSplit      = viewMode === "split";
  const isSingleMcp  = viewMode === "single-mcp";
  const isSingleCode = viewMode === "single-codemode";
  const mcpBusy      = mcpAgent.status  === "streaming" || mcpAgent.status  === "submitted";
  const codeBusy     = codeAgent.status === "streaming" || codeAgent.status === "submitted";
  const bothReady    = mcpReady && codeReady;
  const splitBusy    = mcpBusy || codeBusy || !bothReady;

  const fireBoth = useCallback((text: string) => {
    if (splitBusy) return;
    mcpAgent.sendMessage({ text });
    codeAgent.sendMessage({ text });
  }, [splitBusy, mcpAgent, codeAgent]);

  const onSplitSubmit = useCallback((e: FormEvent) => {
    e.preventDefault();
    const text = splitInput.trim();
    if (!text || splitBusy) return;
    fireBoth(text);
    setSplitInput("");
    splitRef.current?.focus();
  }, [splitInput, splitBusy, fireBoth]);

  return (
    <>
      {showIntro && <IntroModal forceOpen onClose={() => setShowIntro(false)} />}
      {!showIntro && <IntroModal onClose={() => {}} />}

      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--cf-bg-page)", overflow: "hidden" }}>
        <Header
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          onReset={handleReset}
          onShowIntro={() => setShowIntro(true)}
        />

        {/* Panels */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>
          {(isSplit || isSingleMcp) && (
            <div style={{
              display: "flex", flexDirection: "column", overflow: "hidden",
              width: isSplit ? "50%" : "100%",
              borderRight: isSplit ? "1px solid var(--cf-border)" : "none",
            }}>
              <ChatPanel key={`mcp-${resetKey}`} mode="mcp" agent={mcpAgent} isSplit={isSplit} onMetrics={addMcpMetrics} onSuggestion={isSplit ? fireBoth : undefined} onReady={() => setMcpReady(true)} />
            </div>
          )}
          {(isSplit || isSingleCode) && (
            <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", width: isSplit ? "50%" : "100%" }}>
              <ChatPanel key={`code-${resetKey}`} mode="codemode" agent={codeAgent} isSplit={isSplit} onMetrics={addCodeMetrics} onSuggestion={isSplit ? fireBoth : undefined} onReady={() => setCodeReady(true)} />
            </div>
          )}
        </div>

        {/* Split bottom bar */}
        {isSplit && (
          <div style={{ borderTop: "1px solid var(--cf-border)", background: "var(--cf-bg-100)", flexShrink: 0 }}>
            <TokenComparison mcp={mcpMetrics} code={codeMetrics} />

            {/* Shared suggestions */}
            <div style={{ padding: "10px 16px 8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--cf-text-subtle)" }}>
                  Suggestions
                </span>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "var(--cf-orange)" }}>⚡</span>
                  <span style={{ fontSize: 10, color: "var(--cf-text-subtle)" }}>+</span>
                  <span style={{ fontSize: 12, color: "#7C3AED" }}>◆</span>
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {SUGGESTIONS.map((s, i) => (
                  <SplitPill key={i} s={s} onSend={fireBoth} busy={splitBusy} />
                ))}
              </div>
            </div>

            {/* Shared input */}
            <div style={{ padding: "0 16px 12px" }}>
              <form onSubmit={onSplitSubmit}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 12px", borderRadius: 9999,
                  background: "var(--cf-bg-200)", border: "1px solid var(--cf-border)",
                }}>
                  <span style={{ fontSize: 12, color: "var(--cf-text-subtle)", whiteSpace: "nowrap", fontFamily: "var(--font-mono)" }}>⚡ + ◆</span>
                  <input
                    ref={splitRef}
                    type="text"
                    value={splitInput}
                    onChange={e => setSplitInput(e.target.value)}
                    disabled={splitBusy}
                    placeholder={!bothReady ? "Initializing agents…" : splitBusy ? "Responding…" : "Send to both agents…"}
                    autoFocus
                    style={{
                      flex: 1, minWidth: 0, background: "transparent", border: "none",
                      outline: "none", fontSize: 13, color: "var(--cf-text)",
                      fontFamily: "var(--font-sans)", caretColor: "var(--cf-orange)",
                    }}
                  />
                  {(mcpBusy || codeBusy) && (
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      {mcpBusy  && <span style={{ fontSize: 12, color: "var(--cf-orange)", animation: "dot-bounce 1.4s ease-in-out infinite" }}>⚡</span>}
                      {codeBusy && <span style={{ fontSize: 12, color: "#7C3AED", animation: "dot-bounce 1.4s ease-in-out 0.2s infinite" }}>◆</span>}
                    </div>
                  )}
                  <SendBtn active={!!splitInput.trim() && !splitBusy} />
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function SplitPill({ s, onSend, busy }: { s: { label: string; text: string }; onSend: (t: string) => void; busy: boolean }) {
  const [hovered, setHovered] = useState(false);
  const isComplex = s.label === "Complex";
  const color = isComplex ? "#7C3AED" : "var(--cf-orange)";
  return (
    <button
      onClick={() => !busy && onSend(s.text)}
      disabled={busy}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "4px 10px", borderRadius: 9999, fontSize: 12,
        fontFamily: "var(--font-sans)",
        border: `1px solid ${hovered && !busy ? color : "var(--cf-border)"}`,
        background: hovered && !busy ? (isComplex ? "rgba(124,58,237,0.06)" : "rgba(255,72,1,0.06)") : "var(--cf-bg-200)",
        color: hovered && !busy ? color : "var(--cf-text-muted)",
        cursor: busy ? "not-allowed" : "pointer",
        opacity: busy ? 0.5 : 1,
        transition: "all 0.15s",
        maxWidth: 260, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}
    >
      <span style={{
        fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em",
        padding: "1px 5px", borderRadius: 9999,
        background: isComplex ? "rgba(124,58,237,0.1)" : "rgba(255,72,1,0.1)",
        color: isComplex ? "#7C3AED" : "var(--cf-orange)",
        flexShrink: 0,
      }}>
        {s.label}
      </span>
      {s.text}
    </button>
  );
}

function SendBtn({ active }: { active: boolean }) {
  return (
    <button
      type="submit" disabled={!active}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 28, height: 28, borderRadius: 9999, flexShrink: 0,
        background: active ? "var(--cf-orange)" : "var(--cf-border)",
        border: "none", cursor: active ? "pointer" : "not-allowed",
        transition: "all 0.15s",
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
        stroke={active ? "#fff" : "var(--cf-text-subtle)"}
        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
      </svg>
    </button>
  );
}
