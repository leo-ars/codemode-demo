import { useState, useEffect } from "react";

const STORAGE_KEY = "cf-demo-intro-v4";

interface Props {
  forceOpen?: boolean;
  onClose: () => void;
}

export function IntroModal({ forceOpen, onClose }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (forceOpen) { setOpen(true); return; }
    if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
  }, [forceOpen]);

  const dismiss = () => {
    if (!forceOpen) localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
    onClose();
  };

  if (!open) return null;

  return (
    <div
      onClick={dismiss}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(82,16,0,0.25)",
        backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24, animation: "fade-in 0.2s ease-out",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--cf-bg-100)",
          border: "1px solid var(--cf-border)",
          borderRadius: 16,
          maxWidth: 520, width: "100%",
          boxShadow: "0 24px 64px rgba(82,16,0,0.12)",
          animation: "slide-down 0.25s cubic-bezier(0.16,1,0.3,1)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Corner brackets */}
        {(["tl","tr","bl","br"] as const).map(pos => (
          <div key={pos} style={{
            position: "absolute",
            top:    pos.startsWith("t") ? -4 : "auto",
            bottom: pos.startsWith("b") ? -4 : "auto",
            left:   pos.endsWith("l")   ? -4 : "auto",
            right:  pos.endsWith("r")   ? -4 : "auto",
            width: 8, height: 8,
            border: "1px solid var(--cf-border)",
            borderRadius: 1.5,
            background: "var(--cf-bg-100)",
            zIndex: 2,
          }} />
        ))}

        {/* Orange top stripe */}
        <div style={{ height: 3, background: "var(--cf-orange)" }} />

        <div style={{ padding: "24px 28px 28px" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <CFFlame size={20} />
                <span style={{ fontSize: 11, fontWeight: 500, color: "var(--cf-orange)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Cloudflare Agents Demo
                </span>
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--cf-text)", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                MCP vs Codemode
              </h1>
              <p style={{ fontSize: 13, color: "var(--cf-text-muted)", marginTop: 4 }}>
                Two ways an AI agent can use tools — compared live
              </p>
            </div>
            <button
              onClick={dismiss}
              style={{ background: "none", border: "1px solid var(--cf-border)", borderRadius: 8, padding: "4px 6px", cursor: "pointer", color: "var(--cf-text-muted)", flexShrink: 0, marginTop: 2 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Concept */}
          <p style={{ fontSize: 13, color: "var(--cf-text-muted)", lineHeight: 1.65, marginBottom: 16 }}>
            A Jira-like ticketing system rebuilt entirely on{" "}
            <strong style={{ color: "var(--cf-text)" }}>Cloudflare Workers</strong> — Durable Objects, D1, Workers AI.
            No REST API, no UI backend. The agent <em>is</em> the interface.
          </p>

          {/* Two modes */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
            <ModeCard
              icon="⚡" label="MCP" color="var(--cf-orange)"
              desc="Sequential tool calls, one round-trip each"
            />
            <ModeCard
              icon="◆" label="Codemode" color="#7C3AED"
              desc="LLM writes JS, executed in a Worker sandbox"
            />
          </div>

          {/* Credits */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--cf-text-subtle)", marginBottom: 8 }}>
              Inspired by
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <CreditLink name="Rita Kozlov" desc="Fluma demo" url="https://fluma-demo.rita.workers.dev/" />
              <CreditLink name="Matt Carey" desc="Code Mode + MCP" url="https://blog.cloudflare.com/code-mode-mcp/" />
              <CreditLink name="Kenton Varda & Sunil Pai" desc="Code Mode" url="https://blog.cloudflare.com/code-mode/" />
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={dismiss}
            style={{
              width: "100%", padding: "11px 0", borderRadius: 9999,
              background: "var(--cf-orange)", color: "#fff",
              border: "none", cursor: "pointer",
              fontSize: 14, fontWeight: 500,
              fontFamily: "var(--font-sans)",
              transition: "opacity 0.15s",
              letterSpacing: "-0.01em",
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.9")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            Launch Demo
          </button>
        </div>
      </div>
    </div>
  );
}

function ModeCard({ icon, label, color, desc }: { icon: string; label: string; color: string; desc: string }) {
  return (
    <div style={{
      background: "var(--cf-bg-300)", border: "1px solid var(--cf-border)",
      borderRadius: 10, padding: "12px 14px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 13, color }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color }}>{label}</span>
      </div>
      <p style={{ fontSize: 12, color: "var(--cf-text-muted)", lineHeight: 1.5, margin: 0 }}>{desc}</p>
    </div>
  );
}

function CreditLink({ name, desc, url }: { name: string; desc?: string; url: string }) {
  return (
    <a
      href={url} target="_blank" rel="noopener noreferrer"
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "6px 10px", borderRadius: 8,
        background: "var(--cf-bg-200)", border: "1px solid var(--cf-border)",
        textDecoration: "none", transition: "border-color 0.15s",
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--cf-orange)")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--cf-border)")}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--cf-text)" }}>{name}</span>
          {desc && <span style={{ fontSize: 11, color: "var(--cf-text-muted)" }}>{desc}</span>}
        </div>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: "var(--cf-text-subtle)", flexShrink: 0 }}>
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
      </svg>
    </a>
  );
}

function CFFlame({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size * 30 / 24} viewBox="0 0 66 30" fill="none">
      <path d="M52.688 13.028c-.22 0-.437.008-.654.015a.3.3 0 0 0-.102.024.37.37 0 0 0-.236.255l-.93 3.249c-.401 1.397-.252 2.687.422 3.634.618.876 1.646 1.39 2.894 1.45l5.045.306a.45.45 0 0 1 .435.41.5.5 0 0 1-.025.223.64.64 0 0 1-.547.426l-5.242.306c-2.848.132-5.912 2.456-6.987 5.29l-.378 1a.28.28 0 0 0 .248.382h18.054a.48.48 0 0 0 .464-.35c.32-1.153.482-2.344.48-3.54 0-7.22-5.79-13.072-12.933-13.072M44.807 29.578l.334-1.175c.402-1.397.253-2.687-.42-3.634-.62-.876-1.647-1.39-2.896-1.45l-23.665-.306a.47.47 0 0 1-.374-.199.5.5 0 0 1-.052-.434.64.64 0 0 1 .552-.426l23.886-.306c2.836-.131 5.9-2.456 6.975-5.29l1.362-3.6a.9.9 0 0 0 .04-.477C48.997 5.259 42.789 0 35.367 0c-6.842 0-12.647 4.462-14.73 10.665a6.92 6.92 0 0 0-4.911-1.374c-3.28.33-5.92 3.002-6.246 6.318a7.2 7.2 0 0 0 .18 2.472C4.3 18.241 0 22.679 0 28.133q0 .74.106 1.453a.46.46 0 0 0 .457.402h43.704a.57.57 0 0 0 .54-.418" fill="#FF4801"/>
    </svg>
  );
}
