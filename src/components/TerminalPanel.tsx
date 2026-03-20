import { useState, useEffect, useRef, useCallback, type FormEvent } from "react";
import { MessageList } from "./MessageList";
import { SUGGESTIONS } from "./DemoLayout";
import type { DemoMode, TokenMetrics } from "../types";
import type { useTicketAgent } from "../useAgentChat";

type AgentHook = ReturnType<typeof useTicketAgent>;

interface Props {
  mode: DemoMode;
  agent: AgentHook;
  isSplit: boolean;
  onMetrics: (m: TokenMetrics) => void;
  onSuggestion?: (text: string) => void;
  onReady?: () => void;
}

export function ChatPanel({ mode, agent, isSplit, onMetrics, onSuggestion, onReady }: Props) {
  const [input, setInput]       = useState("");
  const [elapsed, setElapsed]   = useState(0); // seconds since last message sent
  const messagesEndRef          = useRef<HTMLDivElement>(null);
  const inputRef                = useRef<HTMLInputElement>(null);
  const t0Ref                   = useRef(0);
  const elapsedTimerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const readyRef                = useRef(false);
  const [ready, setReady]       = useState(false);

  const { messages, sendMessage, status, switchMode } = agent;
  const busy  = status === "streaming" || status === "submitted";
  const isMcp = mode === "mcp";
  const color = isMcp ? "#FF4801" : "#7C3AED";
  const label = isMcp ? "MCP" : "Codemode";
  const icon  = isMcp ? "⚡" : "◆";

  useEffect(() => {
    if (!readyRef.current) {
      readyRef.current = true;
      switchMode(mode).then(() => {
        setReady(true);
        onReady?.();
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    if (messages.length === 0) { t0Ref.current = 0; return; }
    if (busy && t0Ref.current === 0) {
      t0Ref.current = Date.now();
      setElapsed(0);
      elapsedTimerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - t0Ref.current) / 1000));
      }, 1000);
    } else if (!busy && t0Ref.current > 0) {
      if (elapsedTimerRef.current) { clearInterval(elapsedTimerRef.current); elapsedTimerRef.current = null; }
      const durationMs = Date.now() - t0Ref.current;
      t0Ref.current = 0;
      if (messages.at(-1)?.role === "assistant") {
        const agentId = isMcp ? "demo-mcp" : "demo-codemode";
        fetch(`/agents/demo-agent/${agentId}/status`)
          .then(r => r.json())
          .then((s: unknown) => {
            const st = s as { totalInputTokens?: number; totalOutputTokens?: number; baselineInputTokens?: number };
            const inp = st.totalInputTokens ?? 0, out = st.totalOutputTokens ?? 0, baseline = st.baselineInputTokens ?? 0;
            onMetrics({ inputTokens: inp, outputTokens: out, totalTokens: inp + out, durationMs, baselineInputTokens: baseline });
          })
          .catch(() => onMetrics({ inputTokens: 0, outputTokens: 0, totalTokens: 0, durationMs }));
      }
    }
  }, [busy, messages]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clean up timer on unmount
  useEffect(() => () => { if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current); }, []);

  const submit = useCallback((e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    sendMessage({ text });
    setInput("");
    inputRef.current?.focus();
  }, [input, busy, sendMessage]);

  const handleSuggestion = useCallback((text: string) => {
    if (isSplit && onSuggestion) {
      // In split mode: fill the shared input bar and let user submit
      onSuggestion(text);
    } else {
      // In single mode: fill the local input and focus it
      setInput(text);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isSplit, onSuggestion]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "var(--cf-bg-page)" }}>

      {/* Panel header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 14px", height: 44, flexShrink: 0,
        background: "var(--cf-bg-100)", borderBottom: `2px solid ${color}22`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color }}>{icon}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color, letterSpacing: "-0.01em" }}>{label}</span>
          <span style={{
            fontSize: 10, padding: "2px 8px", borderRadius: 9999, fontWeight: 500,
            background: `${color}14`, color, border: `1px solid ${color}25`,
          }}>
            {isMcp ? "individual tool calls" : "LLM writes & runs code"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {busy && (
            <>
              <div style={{ display: "flex", gap: 3 }}>
                {[0,1,2].map(i => <div key={i} className={`dot-${i+1}`} style={{ width: 4, height: 4, borderRadius: 99, background: color }} />)}
              </div>
              {/* Live elapsed timer */}
              <span style={{
                fontSize: 10, color, fontVariantNumeric: "tabular-nums",
                fontFamily: "var(--font-mono)", opacity: 0.8,
              }}>
                {elapsed >= 60
                  ? `${Math.floor(elapsed / 60)}m${String(elapsed % 60).padStart(2, "0")}s`
                  : `${elapsed}s`}
              </span>
            </>
          )}
          {/* Step counter — count tool-call parts across all assistant messages */}
          {messages.length > 0 && (() => {
            const toolSteps = messages
              .filter(m => m.role === "assistant")
              .flatMap(m => (m.parts ?? []))
              .filter(p => (p as { type: string }).type?.startsWith("tool-")).length;
            const maxSteps = isMcp ? 25 : 1;
            return toolSteps > 0 ? (
              <span style={{
                fontSize: 10, color: "var(--cf-text-subtle)", fontVariantNumeric: "tabular-nums",
                padding: "1px 6px", borderRadius: 9999,
                background: "var(--cf-bg-300)", border: "1px solid var(--cf-border)",
              }}>
                {isMcp ? `${toolSteps} / ${maxSteps} steps` : `${toolSteps} call${toolSteps > 1 ? "s" : ""}`}
              </span>
            ) : null;
          })()}
          {messages.filter(m => m.role === "user").length > 0 && (
            <span style={{ fontSize: 10, color: "var(--cf-text-subtle)", fontVariantNumeric: "tabular-nums" }}>
              {messages.filter(m => m.role === "user").length} turn{messages.filter(m => m.role === "user").length > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ display: "flex", flexDirection: "column", padding: 16, gap: 4, minHeight: "100%" }}>
          {(() => {
            // Filter out empty assistant messages (no parts or all-empty text parts)
            // that can appear as stale shells after a Reset before the server clears.
            const visibleMessages = messages.filter(m => {
              if (m.role === "user") return true;
              const parts = m.parts ?? [];
              return parts.some(p => {
                const t = (p as { type: string }).type;
                if (t === "text") return !!((p as { text: string }).text?.trim());
                if (t?.startsWith("tool-")) return true;
                return false;
              });
            });
            return visibleMessages.length === 0 ? (
              <WelcomeScreen mode={mode} isSplit={isSplit} onSend={handleSuggestion} color={color} ready={ready} />
            ) : (
              <MessageList messages={visibleMessages} mode={mode} busy={busy} />
            );
          })()}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input (single mode only) */}
      {!isSplit && (
        <div style={{ flexShrink: 0, padding: "10px 14px", background: "var(--cf-bg-100)", borderTop: "1px solid var(--cf-border)" }}>
          <form onSubmit={submit}>
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 14px", borderRadius: 9999,
              background: "var(--cf-bg-200)",
              border: `1px solid ${input ? color + "60" : "var(--cf-border)"}`,
              transition: "border-color 0.15s",
            }}>
              <span style={{ fontSize: 11, color: "var(--cf-text-subtle)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>
                {isMcp ? "mcp ~" : "code ~"}
              </span>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                disabled={busy || !ready}
                placeholder={!ready ? "connecting…" : busy ? "responding…" : "Ask about tickets…"}
                autoFocus
                style={{
                  flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none",
                  fontSize: 13, color: "var(--cf-text)", fontFamily: "var(--font-sans)", caretColor: color,
                }}
              />
              <PanelSendBtn active={!!input.trim() && !busy && ready} color={color} />
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function PanelSendBtn({ active, color }: { active: boolean; color: string }) {
  return (
    <button
      type="submit" disabled={!active}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 26, height: 26, borderRadius: 9999, flexShrink: 0,
        background: active ? color : "var(--cf-border)", border: "none",
        cursor: active ? "pointer" : "not-allowed",
        transition: "all 0.15s var(--ease-button)",
      }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
        stroke={active ? "#fff" : "var(--cf-text-subtle)"}
        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
      </svg>
    </button>
  );
}

function WelcomeScreen({ mode, isSplit, onSend, color, ready }: { mode: DemoMode; isSplit: boolean; onSend: (t: string) => void; color: string; ready: boolean }) {
  const isMcp = mode === "mcp";
  return (
    <div className="anim-fade-in" style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", gap: 20, padding: "8px 4px" }}>
      <div>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          padding: "5px 12px", borderRadius: 9999, marginBottom: 10,
          background: `${color}10`, border: `1px solid ${color}25`,
        }}>
          <span style={{ fontSize: 13, color }}>{isMcp ? "⚡" : "◆"}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color, letterSpacing: "-0.01em" }}>{isMcp ? "MCP Mode" : "Codemode"}</span>
          {!ready && (
            <span style={{ fontSize: 11, color: "var(--cf-text-subtle)", fontFamily: "var(--font-mono)" }}>
              initializing…
            </span>
          )}
        </div>
        <p style={{ fontSize: 13, color: "var(--cf-text-muted)", lineHeight: 1.65, maxWidth: 440 }}>
          {isMcp
            ? "The LLM calls tools one at a time. Each call is an individual round-trip — watch every invocation appear one by one."
            : "The LLM writes JavaScript that runs in a sandboxed Worker. All operations execute in a single call."}
        </p>
      </div>

      {!isSplit && !ready && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", gap: 4 }}>
            {[0, 1, 2].map(i => (
              <div key={i} className={`dot-${i + 1}`} style={{ width: 5, height: 5, borderRadius: 99, background: color }} />
            ))}
          </div>
          <span style={{ fontSize: 12, color: "var(--cf-text-subtle)" }}>Connecting to agent…</span>
        </div>
      )}

      {!isSplit && ready && (
        <div>
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--cf-text-subtle)", marginBottom: 8 }}>
            Try a prompt
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {SUGGESTIONS.map((s, i) => <SuggestionBtn key={i} s={s} color={color} onSend={onSend} />)}
          </div>
        </div>
      )}

      {isSplit && ready && (
        <p style={{ fontSize: 12, color: "var(--cf-text-subtle)" }}>
          Use the suggestions below to fire both agents simultaneously.
        </p>
      )}

      {isSplit && !ready && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", gap: 4 }}>
            {[0, 1, 2].map(i => (
              <div key={i} className={`dot-${i + 1}`} style={{ width: 5, height: 5, borderRadius: 99, background: color }} />
            ))}
          </div>
          <span style={{ fontSize: 12, color: "var(--cf-text-subtle)" }}>Connecting to agent…</span>
        </div>
      )}
    </div>
  );
}

function SuggestionBtn({ s, color, onSend }: { s: { label: string; text: string }; color: string; onSend: (t: string) => void }) {
  const [hovered, setHovered] = useState(false);
  const isComplex = s.label === "Complex";
  return (
    <button
      onClick={() => onSend(s.text)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        textAlign: "left", padding: "8px 12px", borderRadius: 8,
        border: `1px solid ${hovered ? color + "50" : "var(--cf-border)"}`,
        background: hovered ? `${color}08` : "var(--cf-bg-200)",
        color: hovered ? "var(--cf-text)" : "var(--cf-text-muted)",
        fontFamily: "var(--font-sans)", fontSize: 13, cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      <span style={{
        fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em",
        marginRight: 8, padding: "1px 6px", borderRadius: 9999,
        background: isComplex ? "rgba(124,58,237,0.1)" : "rgba(255,72,1,0.1)",
        color: isComplex ? "#7C3AED" : "var(--cf-orange)",
      }}>{s.label}</span>
      {s.text}
    </button>
  );
}

export { ChatPanel as TerminalPanel };
