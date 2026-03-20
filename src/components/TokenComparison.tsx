import type { TokenMetrics } from "../types";

interface Props { mcp: TokenMetrics; code: TokenMetrics; }

function fmtDuration(ms: number): string {
  if (ms <= 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m${String(Math.round(s % 60)).padStart(2, "0")}s`;
}

export function TokenComparison({ mcp, code }: Props) {
  const maxTotal = Math.max(mcp.totalTokens, code.totalTokens, 1);
  const mcpPct   = mcp.totalTokens  > 0 ? (mcp.totalTokens  / maxTotal) * 100 : 0;
  const codePct  = code.totalTokens > 0 ? (code.totalTokens / maxTotal) * 100 : 0;

  const mcpB    = mcp.baselineInputTokens  ?? 0;
  const codeB   = code.baselineInputTokens ?? 0;
  const mcpBPct  = mcp.totalTokens  > 0 ? (mcpB  / mcp.totalTokens)  * mcpPct  : 0;
  const codeBPct = code.totalTokens > 0 ? (codeB / code.totalTokens) * codePct : 0;

  const hasData = mcp.totalTokens > 0 || code.totalTokens > 0;
  const saving  = mcp.totalTokens > 0 && code.totalTokens > 0
    ? Math.round(((mcp.totalTokens - code.totalTokens) / mcp.totalTokens) * 100)
    : null;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "8px 16px", borderBottom: "1px solid var(--cf-border)",
    }}>
      {/* Label */}
      <div style={{ flexShrink: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--cf-text-subtle)" }}>
          Tokens
        </span>
        {hasData && (
          <div style={{ fontSize: 9, color: "var(--cf-text-subtle)", marginTop: 1 }}>faded = schema</div>
        )}
      </div>

      {/* Bars */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1, minWidth: 0 }}>
        <TokenRow label="⚡ MCP"  value={mcp.totalTokens}  input={mcp.inputTokens}  output={mcp.outputTokens}  pct={mcpPct}  bPct={mcpBPct}  color="var(--cf-orange)" hasData={hasData} durationMs={mcp.durationMs  ?? 0} />
        <TokenRow label="◆ Code" value={code.totalTokens} input={code.inputTokens} output={code.outputTokens} pct={codePct} bPct={codeBPct} color="#7C3AED"           hasData={hasData} durationMs={code.durationMs ?? 0} />
      </div>

      {/* Savings badge */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        flexShrink: 0, borderRadius: 9999, padding: "4px 10px", minWidth: 60,
        background: "var(--cf-bg-300)", border: "1px solid var(--cf-border)",
      }}>
        {saving !== null && saving > 0 ? (
          <>
            <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1, color: "var(--cf-success)" }}>-{saving}%</span>
            <span style={{ fontSize: 9, color: "var(--cf-text-subtle)", marginTop: 1 }}>tokens</span>
          </>
        ) : saving !== null && saving < 0 ? (
          <>
            <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1, color: "#D97706" }}>+{Math.abs(saving)}%</span>
            <span style={{ fontSize: 9, color: "var(--cf-text-subtle)", marginTop: 1 }}>tokens</span>
          </>
        ) : (
          <span style={{ fontSize: 10, color: "var(--cf-text-subtle)" }}>—</span>
        )}
      </div>
    </div>
  );
}

function TokenRow({ label, value, input, output, pct, bPct, color, hasData, durationMs }: {
  label: string; value: number; input: number; output: number;
  pct: number; bPct: number; color: string; hasData: boolean; durationMs: number;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 11, width: 56, flexShrink: 0, fontWeight: 500, color }}>{label}</span>

      {/* Progress bar */}
      <div style={{ flex: 1, height: 5, borderRadius: 9999, background: "var(--cf-border)", overflow: "hidden", display: "flex" }}>
        {hasData && bPct > 0 && (
          <div style={{ height: "100%", width: `${bPct}%`, background: color, opacity: 0.22, borderRight: bPct < pct ? "1px solid var(--cf-bg-100)" : "none", transition: "width 0.5s ease-out", flexShrink: 0 }} />
        )}
        {hasData && (pct - bPct) > 0 && (
          <div style={{ height: "100%", width: `${pct - bPct}%`, background: color, borderRadius: "0 9999px 9999px 0", transition: "width 0.5s ease-out" }} />
        )}
        {hasData && pct > 0 && (pct - bPct) <= 0 && (
          <div style={{ height: "100%", width: `${pct}%`, background: color, opacity: 0.22, borderRadius: 9999, transition: "width 0.5s ease-out" }} />
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontVariantNumeric: "tabular-nums", fontWeight: 500, width: 40, textAlign: "right", color: "var(--cf-text-muted)" }}>
          {value > 0 ? value.toLocaleString() : "—"}
        </span>
        {value > 0 && (
          <span style={{ fontSize: 9, fontVariantNumeric: "tabular-nums", color: "var(--cf-text-subtle)" }}>
            {input}↑ {output}↓
          </span>
        )}
        <span style={{
          fontSize: 9, fontVariantNumeric: "tabular-nums", color: "var(--cf-text-subtle)",
          minWidth: 28, textAlign: "right", fontFamily: "var(--font-mono)",
        }}>
          {fmtDuration(durationMs)}
        </span>
      </div>
    </div>
  );
}
