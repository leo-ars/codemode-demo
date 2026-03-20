import { useState } from "react";
import type { ViewMode } from "../types";

interface Props {
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
  onReset: () => void;
  onShowIntro: () => void;
}

export function Header({ viewMode, onViewModeChange, onReset, onShowIntro }: Props) {
  return (
    <header style={{
      height: 52,
      background: "var(--cf-bg-100)",
      borderBottom: "1px solid var(--cf-border)",
      display: "flex", alignItems: "center",
      justifyContent: "space-between",
      padding: "0 16px",
      flexShrink: 0,
      userSelect: "none",
    }}>
      {/* Left: logo */}
      <button
        onClick={onShowIntro}
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
        title="About"
      >
        <CFFlame />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1 }}>
          <span style={{ fontSize: 9, fontWeight: 500, color: "var(--cf-text-subtle)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Cloudflare
          </span>
          <span style={{ fontSize: 15, fontWeight: 600, color: "var(--cf-text)", letterSpacing: "-0.02em" }}>
            MCP vs Codemode
          </span>
        </div>
      </button>

      {/* Center: view tabs */}
      <div style={{
        display: "flex", alignItems: "center", padding: 3,
        background: "var(--cf-bg-300)", border: "1px solid var(--cf-border)",
        borderRadius: 9999,
      }}>
        <ViewTab label="⚡ MCP"      active={viewMode === "single-mcp"}      onClick={() => onViewModeChange("single-mcp")}      color="var(--cf-orange)" />
        <ViewTab label="◆ Codemode" active={viewMode === "single-codemode"} onClick={() => onViewModeChange("single-codemode")} color="#7C3AED" />
        <ViewTab label="Split"       active={viewMode === "split"}            onClick={() => onViewModeChange("split")}            color="var(--cf-success)" />
      </div>

      {/* Right: actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <HeaderBtn onClick={onReset} title="Reset everything — clears chat and resets the database" hoverColor="var(--cf-orange)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 .49-3.51" />
          </svg>
          Reset
        </HeaderBtn>
        <HeaderBtn onClick={onShowIntro} title="About" hoverColor="var(--cf-orange)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          About
        </HeaderBtn>
      </div>
    </header>
  );
}

function ViewTab({ label, active, onClick, color }: { label: string; active: boolean; onClick: () => void; color: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "5px 14px",
        borderRadius: 9999,
        border: "none",
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        fontFamily: "var(--font-sans)",
        cursor: "pointer",
        transition: "all 0.15s var(--ease-button)",
        background: active ? "var(--cf-bg-100)" : "transparent",
        color: active ? color : hovered ? "var(--cf-text)" : "var(--cf-text-muted)",
        boxShadow: active ? "0 1px 3px rgba(82,16,0,0.08)" : "none",
      }}
    >
      {label}
    </button>
  );
}

function HeaderBtn({ onClick, title, hoverColor, children }: {
  onClick: () => void; title: string; hoverColor: string;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "5px 10px", borderRadius: 9999,
        fontSize: 12, fontWeight: 500, fontFamily: "var(--font-sans)",
        cursor: "pointer",
        transition: "all 0.15s var(--ease-button)",
        background: hovered ? "var(--cf-bg-300)" : "transparent",
        border: `1px solid ${hovered ? "var(--cf-border)" : "transparent"}`,
        color: hovered ? hoverColor : "var(--cf-text-muted)",
      }}
    >
      {children}
    </button>
  );
}

function CFFlame() {
  return (
    <svg width="22" height="14" viewBox="0 0 66 30" fill="none">
      <path d="M52.688 13.028c-.22 0-.437.008-.654.015a.3.3 0 0 0-.102.024.37.37 0 0 0-.236.255l-.93 3.249c-.401 1.397-.252 2.687.422 3.634.618.876 1.646 1.39 2.894 1.45l5.045.306a.45.45 0 0 1 .435.41.5.5 0 0 1-.025.223.64.64 0 0 1-.547.426l-5.242.306c-2.848.132-5.912 2.456-6.987 5.29l-.378 1a.28.28 0 0 0 .248.382h18.054a.48.48 0 0 0 .464-.35c.32-1.153.482-2.344.48-3.54 0-7.22-5.79-13.072-12.933-13.072M44.807 29.578l.334-1.175c.402-1.397.253-2.687-.42-3.634-.62-.876-1.647-1.39-2.896-1.45l-23.665-.306a.47.47 0 0 1-.374-.199.5.5 0 0 1-.052-.434.64.64 0 0 1 .552-.426l23.886-.306c2.836-.131 5.9-2.456 6.975-5.29l1.362-3.6a.9.9 0 0 0 .04-.477C48.997 5.259 42.789 0 35.367 0c-6.842 0-12.647 4.462-14.73 10.665a6.92 6.92 0 0 0-4.911-1.374c-3.28.33-5.92 3.002-6.246 6.318a7.2 7.2 0 0 0 .18 2.472C4.3 18.241 0 22.679 0 28.133q0 .74.106 1.453a.46.46 0 0 0 .457.402h43.704a.57.57 0 0 0 .54-.418" fill="#FF4801"/>
    </svg>
  );
}
