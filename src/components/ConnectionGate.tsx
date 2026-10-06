"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Conversation, Message, Mode } from "@/lib/db";
import { ConversationList } from "@/components/ConversationList";
import { ConversationPanel } from "@/components/ConversationPanel";
import { DashboardHeader } from "@/components/DashboardHeader";
import { QRScreen } from "@/components/QRScreen";

type ListedConversation = Conversation & { last_message_preview: string | null };
type Status = { status: string; phone?: string | null; qrPng?: string | null };

export function ConnectionGate({ initialStatus }: { initialStatus: Status }) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [conversations, setConversations] = useState<ListedConversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const lastStatus = useRef<string | null>(initialStatus.status);

  const refresh = useCallback(async () => {
    try {
      const [statusResponse, conversationsResponse] = await Promise.all([
        fetch("/api/connection/status", { cache: "no-store" }),
        fetch("/api/conversations", { cache: "no-store" }),
      ]);
      if (statusResponse.ok) {
        const nextStatus = await statusResponse.json() as Status;
        setStatus(nextStatus);
        if (lastStatus.current !== nextStatus.status) {
          lastStatus.current = nextStatus.status;
          setElapsedSeconds(0);
        }
      }
      if (conversationsResponse.ok) {
        const nextConversations = await conversationsResponse.json() as ListedConversation[];
        setConversations(nextConversations);
        setActiveId((current) => current && nextConversations.some((item) => item.id === current) ? current : nextConversations[0]?.id ?? null);
      }
    } catch { /* El siguiente ciclo de polling volverá a consultar el servidor. */ }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 2_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => setElapsedSeconds((current) => current + 1), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    const loadMessages = async () => {
      try {
        const response = await fetch(`/api/messages/${activeId}`, { cache: "no-store" });
        if (response.ok && !cancelled) setMessages(await response.json() as Message[]);
      } catch { /* El siguiente ciclo volverá a consultar los mensajes. */ }
    };
    void loadMessages();
    const timer = window.setInterval(() => void loadMessages(), 2_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [activeId]);

  async function changeMode(mode: Mode) {
    if (!activeId) return;
    const response = await fetch(`/api/mode/${activeId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "No se pudo cambiar el modo");
    setConversations((current) => current.map((item) => item.id === activeId ? { ...item, mode } : item));
  }

  async function disconnect() {
    if (!window.confirm("¿Desconectar el número de WhatsApp? Tendrás que escanear un nuevo QR para conectarlo.")) return;
    const response = await fetch("/api/connection/disconnect", { method: "POST" });
    if (response.ok) { setStatus({ status: "disconnected" }); setElapsedSeconds(0); }
  }

  function deleted(id: number) {
    const remaining = conversations.filter((item) => item.id !== id);
    setConversations(remaining); setActiveId(remaining[0]?.id ?? null); setMessages([]);
  }

  if (status.status !== "connected") return <QRScreen status={status.status} qrPng={status.qrPng ?? null} elapsedSeconds={elapsedSeconds} />;

  return (
    <main className="flex h-screen flex-col overflow-hidden">
      <DashboardHeader phone={status.phone ?? null} onDisconnect={() => void disconnect()} />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <ConversationList conversations={conversations} activeId={activeId} onSelect={setActiveId} />
        <ConversationPanel key={activeId ?? "none"} conversation={conversations.find((item) => item.id === activeId) ?? null} messages={messages.filter((message) => message.conversation_id === activeId)} onModeChange={changeMode} onRefresh={() => void refresh()} onDeleted={deleted} />
      </div>
    </main>
  );
}
