"use client";

import { useState, useCallback } from "react";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Hook that manages project chat messages (Story 40.4).
 *
 * Sends questions to POST /api/chat and manages the message history.
 */
export function useProjectChat(): {
  messages: ChatMessage[];
  sendMessage: (question: string) => void;
  loading: boolean;
} {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const sendMessage = useCallback((question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;

    // Add user message immediately
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setLoading(true);

    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: trimmed }),
    })
      .then(async (res) => {
        const data = (await res.json()) as { answer?: string };
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.answer ?? "No response." },
        ]);
      })
      .catch(() => {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Chat temporarily unavailable." },
        ]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return { messages, sendMessage, loading };
}
