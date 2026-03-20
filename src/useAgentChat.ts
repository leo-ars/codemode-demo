import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import type { DemoMode } from "./types";

export function useTicketAgent(agentId: string) {
  const agent = useAgent({
    agent: "demo-agent",
    name: agentId,
  });

  const chat = useAgentChat({ agent });

  const switchMode = async (newMode: DemoMode) => {
    try {
      await fetch(`/agents/demo-agent/${agentId}/mode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: newMode }),
      });
    } catch (e) {
      console.error("Failed to switch mode:", e);
    }
  };

  const clearMessages = async () => {
    try {
      // 1. Clear server-side message history in the DO
      await fetch(`/agents/demo-agent/${agentId}/clear`, { method: "POST" });
    } catch (e) {
      console.error("Failed to clear server messages:", e);
    }
    // 2. Clear client-side message array immediately
    chat.clearHistory();
  };

  return {
    agent,
    ...chat,
    switchMode,
    clearMessages,
  };
}

export { useAgent, useAgentChat };
