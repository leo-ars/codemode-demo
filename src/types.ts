export type DemoMode = "mcp" | "codemode";
export type ViewMode = "single-mcp" | "single-codemode" | "split";

export interface TokenMetrics {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  durationMs: number;
  firstTokenMs?: number;
  /** Input tokens used by system prompt + tool schemas on every request */
  baselineInputTokens?: number;
}

export interface PanelMetrics {
  mcp: TokenMetrics;
  codemode: TokenMetrics;
}
