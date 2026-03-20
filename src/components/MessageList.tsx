/**
 * MessageList — renders chat messages with always-visible tool call cards.
 *
 * IMPORTANT: The AI SDK v6 UIMessage part types for tool calls are:
 *   type: "tool-{sanitizedToolName}"   (e.g. "tool-codemode", "tool-list_tickets")
 *   input: { ... }     ← the arguments (NOT args/arguments)
 *   output: { ... }    ← the result    (NOT result)
 *   state: "input-available" | "output-available"
 *   toolName: string   (the original tool name)
 */

import { useState, useMemo } from "react";
import React from "react";
import { marked } from "marked";
import type { UIMessage } from "ai";
import type { DemoMode } from "../types";


interface Props { messages: UIMessage[]; mode: DemoMode; busy: boolean; }

export function MessageList({ messages, mode, busy }: Props) {
  const color = mode === "mcp" ? "var(--cf-orange)" : "#7C3AED";
  return (
    <div className="flex flex-col gap-5 w-full">
      {messages.map((msg, i) => (
        <Msg key={msg.id} msg={msg} mode={mode} latest={i === messages.length - 1 && !busy} />
      ))}
      {busy && <ThinkingBubble color={color} mode={mode} />}
    </div>
  );
}

/* ── Message ─────────────────────────────────────────────── */
function Msg({ msg, mode, latest }: { msg: UIMessage; mode: DemoMode; latest: boolean }) {
  const isUser = msg.role === "user";
  const color  = mode === "mcp" ? "var(--cf-orange)" : "#7C3AED";
  const icon   = mode === "mcp" ? "⚡" : "◆";

  if (isUser) {
    return (
      <div className="flex justify-end anim-fade-up">
        <div
          className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed"
          style={{ background: color + "12", border: `1px solid ${color}30`, color: "var(--cf-text)", fontFamily: "var(--font-sans)" }}
        >
          {extractText(msg)}
        </div>
      </div>
    );
  }

  const parts = msg.parts ?? [];

  return (
    <div className="flex gap-3 items-start anim-fade-up">
      <div
        className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg text-xs mt-0.5 font-bold"
        style={{ background: color + "14", border: `1px solid ${color}35`, color }}
      >
        {icon}
      </div>

      <div className="flex flex-col gap-3 flex-1 min-w-0">
        {parts.map((p, i) => {
          const t = ptype(p);
          if (t.startsWith("tool-")) {
            return <ToolCard key={i} part={p as AnyPart} mode={mode} color={color} />;
          }
          if (t === "text") {
            const text = (p as { text: string }).text?.trim();
            if (!text) return null;
            return <Markdown key={i} text={text} />;
          }
          return null;
        })}
        {latest && (
          <span className="text-[10px]" style={{ color: "var(--cf-text-subtle)" }}>{now()}</span>
        )}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPart = any;

function isErrorOutput(output: unknown): boolean {
  if (!output) return false;
  try {
    // MCP output: array of {type:"text", text: '{"success":false,...}'}
    if (Array.isArray(output)) {
      return output.some(r => {
        if (typeof r?.text === "string") {
          const parsed = JSON.parse(r.text);
          return parsed?.success === false || typeof parsed?.error === "string";
        }
        return false;
      });
    }
    if (typeof output === "object") {
      const o = output as Record<string, unknown>;
      return o.success === false || typeof o.error === "string";
    }
  } catch { /* ignore */ }
  return false;
}

function ToolCard({ part, mode, color }: { part: AnyPart; mode: DemoMode; color: string }) {
  const toolName: string = part.toolName
    ?? (ptype(part).startsWith("tool-") ? ptype(part).slice(5) : ptype(part));
  const input  = part.input  ?? part.args ?? part.arguments ?? {};
  const output = part.output ?? part.result;
  const done   = part.state === "output-available" || output !== undefined;
  const isErr  = done && isErrorOutput(output);
  if (toolName === "execute" || toolName === "codemode") {
    return <CodemodeCard input={input} output={output} color={color} done={done} isErr={isErr} />;
  }
  return <McpCard toolName={toolName} input={input} output={output} color={color} done={done} mode={mode} isErr={isErr} />;
}

/* ══════════════════════════════════════════════════════════
   MCP CARD — always expanded, shows the round-trip clearly
   ══════════════════════════════════════════════════════════ */
function McpCard({ toolName, input, output, color, done, mode, isErr }: {
  toolName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: any; output: any; color: string; done: boolean; mode: DemoMode; isErr: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);

  // MCP output is an array of content parts: [{ type: "text", text: "..." }]
  const parsedOutput = (() => {
    try {
      if (Array.isArray(output)) {
        const texts = output.map((r: { text?: string }) => r.text ? JSON.parse(r.text) : r);
        return texts.length === 1 ? texts[0] : texts;
      }
      return output;
    } catch { return output; }
  })();

  // Clean tool name for display (remove sanitized prefix like "tool_0u_dsYzR_")
  const displayName = toolName.replace(/^tool_[a-zA-Z0-9]+_/, "");

  const borderColor = isErr ? "#ef444440" : `${color}35`;
  const headerBg    = isErr ? "#ef444410" : color + "0e";
  const headerBorder = isErr ? "#ef444425" : `${color}20`;
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: `1px solid ${borderColor}`, background: "var(--cf-bg-200)" }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2.5"
        style={{ background: headerBg, borderBottom: collapsed ? "none" : `1px solid ${headerBorder}` }}
      >
        <StatusDot done={done} />
        <span className="font-semibold text-xs" style={{ color }}>{displayName}</span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded font-medium"
          style={{ background: color + "22", color }}
        >
          {mode === "mcp" ? "MCP tool call" : "tool call"}
        </span>
        {done && isErr
          ? <span className="text-[10px] font-medium" style={{ color: "#ef4444" }}>✗ error</span>
          : done
          ? <span className="text-[10px] font-medium" style={{ color: "var(--cf-success)" }}>✓ done</span>
          : <span className="text-[10px] animate-pulse font-medium" style={{ color: "var(--cf-warning)" }}>running…</span>
        }
        <button
          onClick={() => setCollapsed(c => !c)}
          className="ml-auto text-[10px] cursor-pointer"
          style={{ background: "transparent", border: "none", color: "var(--text-3)", fontFamily: "inherit" }}
        >
          {collapsed ? "show ▼" : "hide ▲"}
        </button>
      </div>

      {!collapsed && (
        <div className="p-3 flex flex-col gap-3">
          {/* Input */}
          <div className="flex flex-col gap-1">
            <RowLabel color={color} dot>Input</RowLabel>
            <JsonBlock content={input} borderColor={color + "28"} textColor="var(--text-2)" />
          </div>

          {/* Output */}
          {done && parsedOutput !== undefined && (
            <div className="flex flex-col gap-1">
              <RowLabel color={color} dot>Output</RowLabel>
              <JsonBlock content={parsedOutput} borderColor={color + "30"} textColor={color} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   CODEMODE CARD — generated code + execution trace
   ══════════════════════════════════════════════════════════ */
function CodemodeCard({ input, output, color, done, isErr }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: any; output: any; color: string; done: boolean; isErr: boolean;
}) {
  const [codeOpen,  setCodeOpen]  = useState(true);
  const [traceOpen, setTraceOpen] = useState(true);

  const rawCode = String(input?.code ?? "");
  const code    = stripWrapper(rawCode);
  const logs    = (output?.logs ?? []) as string[];
  const retVal  = output?.result;

  const borderColor  = isErr ? "#ef444440" : `${color}35`;
  const headerBg     = isErr ? "#ef444410" : color + "0e";
  const headerBorder = isErr ? "#ef444425" : `${color}20`;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: `1px solid ${borderColor}`, background: "var(--cf-bg-200)" }}
    >
      {/* Top bar */}
      <div
        className="flex items-center gap-2 px-3 py-2.5"
        style={{ background: headerBg, borderBottom: `1px solid ${headerBorder}` }}
      >
        <StatusDot done={done} />
        <span className="font-semibold text-xs" style={{ color }}>Generated JavaScript</span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded font-medium"
          style={{ background: color + "18", color }}
        >
          executed in Worker
        </span>
        {done && isErr
          ? <span className="text-[10px] font-medium" style={{ color: "#ef4444" }}>✗ error</span>
          : done
          ? <span className="text-[10px] font-medium" style={{ color: "var(--cf-success)" }}>✓ 1 call</span>
          : <span className="text-[10px] animate-pulse font-medium" style={{ color: "var(--cf-warning)" }}>running…</span>
        }
      </div>

      {/* Code section */}
      <div style={{ borderBottom: `1px solid ${color}18` }}>
        <SectionToggle
          label="Code written by LLM"
          icon="✦"
          iconColor={color}
          open={codeOpen}
          onToggle={() => setCodeOpen(o => !o)}
        />
        {codeOpen && code && (
          <div className="px-3 pb-3">
            <pre
              className="text-[11px] p-3 rounded-lg overflow-x-auto leading-relaxed m-0"
              style={{ background: "var(--cf-bg-300)", border: `1px solid ${color}25`, fontFamily: "var(--font-mono)" }}
            >
              <Highlight code={code} />
            </pre>
          </div>
        )}
      </div>

      {/* Execution section */}
      {(done || logs.length > 0) && (
        <div>
          <SectionToggle
            label={done ? "Execution" : "Executing…"}
            icon="▶"
            iconColor={color}
            open={traceOpen}
            onToggle={() => setTraceOpen(o => !o)}
          />
          {traceOpen && (
            <div className="px-3 pb-3 flex flex-col gap-2">
              {logs.length > 0 && (
                <div className="flex flex-col gap-1">
                  <RowLabel color="var(--cf-text-subtle)">console</RowLabel>
                  <pre
                    className="text-[11px] p-3 rounded-lg overflow-x-auto leading-relaxed m-0"
                    style={{ background: "var(--cf-bg-300)", border: `1px solid ${color}18`, color: "var(--cf-text-muted)", fontFamily: "var(--font-mono)" }}
                  >
                    {logs.join("\n")}
                  </pre>
                </div>
              )}
              {done && retVal !== undefined && (
                <div className="flex flex-col gap-1 pt-1">
                  <RowLabel color={color} dot>↩ Return value</RowLabel>
                  <JsonBlock content={retVal} borderColor={color + "30"} textColor={color} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}



/* ── Shared atoms ────────────────────────────────────────── */
function StatusDot({ done }: { done: boolean }) {
  return done ? (
    <div className="flex items-center justify-center w-4 h-4 rounded-full shrink-0" style={{ background: "var(--cf-success)" }}>
      <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
        <polyline points="2,6 5,9 10,3" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/>
      </svg>
    </div>
  ) : (
    <div className="w-4 h-4 rounded-full shrink-0 dot-1" style={{ background: "var(--cf-warning)", opacity: 0.9 }} />
  );
}

function RowLabel({ color, dot, children }: { color: string; dot?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      {dot && <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />}
      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color, fontFamily: "var(--font-sans)", letterSpacing: "0.06em" }}>{children}</span>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function JsonBlock({ content, borderColor, textColor }: { content: any; borderColor: string; textColor: string }) {
  return (
    <pre
      className="text-[11px] p-3 rounded-lg overflow-x-auto leading-relaxed m-0"
      style={{ background: "var(--cf-bg-300)", border: `1px solid ${borderColor}`, color: textColor, fontFamily: "var(--font-mono)" }}
    >
      {JSON.stringify(content, null, 2)}
    </pre>
  );
}

function SectionToggle({ label, icon, iconColor, open, onToggle }: {
  label: string; icon: string; iconColor: string; open: boolean; onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2 px-3 py-2 text-left cursor-pointer"
      style={{ background: "transparent", border: "none", fontFamily: "var(--font-sans)" }}
    >
      <span className="text-[11px]" style={{ color: iconColor }}>{icon}</span>
      <span className="text-[11px] font-medium" style={{ color: "var(--cf-text-muted)" }}>{label}</span>
      <span className="ml-auto text-[10px]" style={{ color: "var(--cf-text-subtle)" }}>{open ? "hide ▲" : "show ▼"}</span>
    </button>
  );
}

/* ── Thinking bubble ─────────────────────────────────────── */
function ThinkingBubble({ color, mode }: { color: string; mode: DemoMode }) {
  return (
    <div className="flex items-start gap-3 anim-fade-up">
      <div
        className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
        style={{ background: color + "20", border: `1px solid ${color}50`, color }}
      >
        {mode === "mcp" ? "⚡" : "◆"}
      </div>
      <div
        className="flex items-center gap-1.5 px-4 py-3 rounded-2xl rounded-tl-sm"
        style={{ background: "var(--cf-bg-200)", border: "1px solid var(--cf-border)" }}
      >
          {[0, 1, 2].map(i => (
          <div key={i} className={`rounded-full dot-${i + 1}`}
            style={{ width: 5, height: 5, background: "var(--cf-text-subtle)" }} />
        ))}
      </div>
    </div>
  );
}

/* ── Syntax highlighter ──────────────────────────────────── */
function Highlight({ code }: { code: string }) {
  return (
    <>
      {code.split("\n").map((line, i, arr) => (
        <span key={i}>
          <HLine line={line} />
          {i < arr.length - 1 && "\n"}
        </span>
      ))}
    </>
  );
}

function HLine({ line }: { line: string }) {
  if (/^\s*\/\//.test(line)) return <span className="tok-cmt">{line}</span>;

  type Tok = { s: number; e: number; cls: string; txt: string };
  const toks: Tok[] = [];
  let m: RegExpExecArray | null;

  const kr = /\b(async|await|const|let|var|function|return|if|else|for|of|in|true|false|null|undefined|import|from|export|try|catch|throw|new)\b/g;
  while ((m = kr.exec(line)) !== null)
    toks.push({ s: m.index, e: m.index + m[0].length, cls: "tok-kw", txt: m[0] });
  const sr = /(["'`])(?:(?!\1)[^\\]|\\.)*?\1/g;
  while ((m = sr.exec(line)) !== null)
    toks.push({ s: m.index, e: m.index + m[0].length, cls: "tok-str", txt: m[0] });

  toks.sort((a, b) => a.s - b.s);
  const filt = toks.filter((t, i) => i === 0 || t.s >= toks[i - 1].e);

  const out: React.ReactElement[] = [];
  let cur = 0;
  for (const t of filt) {
    if (t.s > cur) out.push(<span key={cur}>{line.slice(cur, t.s)}</span>);
    out.push(<span key={t.s} className={t.cls}>{t.txt}</span>);
    cur = t.e;
  }
  if (cur < line.length) out.push(<span key={cur}>{line.slice(cur)}</span>);
  return <>{out}</>;
}

/* ── Markdown renderer ───────────────────────────────────── */
function Markdown({ text }: { text: string }) {
  const html = useMemo(() => {
    // Configure marked for clean output
    marked.setOptions({ breaks: true, gfm: true });
    return marked.parse(text) as string;
  }, [text]);

  return (
    <div
      className="md-body text-sm leading-relaxed"
      // dangerouslySetInnerHTML is safe here — content comes only from our LLM,
      // not from user input, and is rendered client-side only.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/* ── Helpers ─────────────────────────────────────────────── */
function ptype(p: unknown) { return (p as { type: string }).type; }

function extractText(msg: UIMessage): string {
  return (msg.parts ?? [])
    .filter(p => ptype(p) === "text")
    .map(p => (p as { text: string }).text)
    .join("") || "";
}

function now() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function stripWrapper(code: string): string {
  const trimmed = code.trim();
  const m = trimmed.match(/^async\s*\(\s*\)\s*=>\s*\{([\s\S]*)\}\s*$/);
  if (m) return m[1].trim();
  return trimmed;
}
