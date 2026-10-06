"use client";

import { useEffect, useRef, useState } from "react";
import type { Conversation, Message, Mode } from "@/lib/db";
import { MessageBubble } from "@/components/MessageBubble";
import { ModeToggle } from "@/components/ModeToggle";

export function ConversationPanel({
  conversation, messages, onModeChange, onRefresh, onDeleted,
}: {
  conversation: Conversation | null;
  messages: Message[];
  onModeChange: (mode: Mode) => Promise<void>;
  onRefresh: () => void;
  onDeleted: (id: number) => void;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [changingMode, setChangingMode] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!conversation || !draft.trim() || sending) return;
    setSending(true); setError("");
    try {
      const response = await fetch(`/api/messages/${conversation.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: draft.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo enviar el mensaje");
      setDraft(""); onRefresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Error al enviar"); }
    finally { setSending(false); }
  }

  async function changeMode(mode: Mode) {
    if (changingMode || !conversation) return;
    setChangingMode(true); setError("");
    try { await onModeChange(mode); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo cambiar el modo"); }
    finally { setChangingMode(false); }
  }

  async function removeConversation() {
    if (!conversation || !window.confirm("¿Borrar esta conversación y su historial?")) return;
    const response = await fetch(`/api/conversations/${conversation.id}`, { method: "DELETE" });
    if (response.ok) onDeleted(conversation.id);
    else setError("No se pudo borrar la conversación.");
  }

  if (!conversation) return <section className="flex min-h-0 flex-1 items-center justify-center bg-stone-50 p-8 text-center text-sm text-stone-500">Selecciona una conversación para ver los mensajes.</section>;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-stone-50">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-white px-5 py-3">
        <div className="min-w-0"><h2 className="truncate font-semibold">{conversation.name || conversation.phone.split("@")[0].split(":")[0]}</h2><p className="text-xs text-stone-500">{conversation.phone.split("@")[0].split(":")[0]}</p></div>
        <div className="flex items-center gap-2"><ModeToggle mode={conversation.mode} onChange={changeMode} disabled={changingMode} /><button type="button" onClick={removeConversation} className="rounded-lg px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50">Borrar</button></div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-5 md:px-8">
        {messages.map((message) => <MessageBubble key={message.id} message={message} />)}
        <div ref={bottomRef} />
      </div>
      <footer className="border-t border-stone-200 bg-white p-4">
        {error && <p role="alert" className="mb-2 text-xs text-red-600">{error}</p>}
        {conversation.mode === "AI" ? <p className="rounded-xl bg-stone-100 px-4 py-3 text-center text-sm text-stone-500">El bot responde automáticamente.</p> :
          <form onSubmit={send} className="flex gap-2">
            <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Escribe un mensaje…" maxLength={10_000} className="min-w-0 flex-1 rounded-xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-amber-400" />
            <button type="submit" disabled={!draft.trim() || sending} className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-600">{sending ? "Enviando…" : "Enviar"}</button>
          </form>}
      </footer>
    </section>
  );
}
