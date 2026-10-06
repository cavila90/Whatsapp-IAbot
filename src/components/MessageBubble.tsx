import type { Message } from "@/lib/db";

export function MessageBubble({ message }: { message: Message }) {
  const mine = message.role !== "user";
  const style = message.role === "assistant" ? "bg-emerald-100 text-emerald-950" : message.role === "human" ? "bg-amber-100 text-amber-950" : "border border-stone-200 bg-white text-stone-800";
  const label = message.role === "assistant" ? "IA" : message.role === "human" ? "Tú" : "Cliente";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <article className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${style}`}>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide opacity-60">{label}</p>
        <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.content}</p>
        <time className="mt-1 block text-right text-[10px] opacity-55" dateTime={new Date(message.created_at * 1000).toISOString()}>
          {new Date(message.created_at * 1000).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
        </time>
      </article>
    </div>
  );
}
