import type { Conversation } from "@/lib/db";

function relativeTime(timestamp: number | null): string {
  if (!timestamp) return "Sin mensajes";
  const minutes = Math.max(0, Math.floor(Date.now() / 1000 - timestamp) / 60);
  if (minutes < 1) return "Ahora";
  if (minutes < 60) return `Hace ${Math.floor(minutes)} min`;
  if (minutes < 1440) return `Hace ${Math.floor(minutes / 60)} h`;
  return `Hace ${Math.floor(minutes / 1440)} d`;
}

export function ConversationList({ conversations, activeId, onSelect }: {
  conversations: Array<Conversation & { last_message_preview: string | null }>;
  activeId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <aside className="flex max-h-[38vh] min-h-0 flex-col border-r border-stone-200 bg-white md:max-h-none md:w-[330px] md:shrink-0">
      <div className="border-b border-stone-100 px-5 py-4">
        <h2 className="font-semibold">Conversaciones</h2>
        <p className="mt-1 text-xs text-stone-500">{conversations.length} chats</p>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto">
        {conversations.length === 0 ? <p className="p-5 text-sm text-stone-500">Aún no hay conversaciones.</p> : conversations.map((conversation) => (
          <button type="button" key={conversation.id} onClick={() => onSelect(conversation.id)}
            className={`w-full border-b border-stone-100 px-4 py-4 text-left hover:bg-stone-50 ${activeId === conversation.id ? "bg-emerald-50/70" : ""}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium">{conversation.name || conversation.phone.split("@")[0].split(":")[0]}</span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${conversation.mode === "AI" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{conversation.mode === "AI" ? "IA" : "HUMAN"}</span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 text-xs text-stone-500">
              <span className="truncate">{conversation.last_message_preview || "Sin mensajes"}</span>
              <span className="shrink-0">{relativeTime(conversation.last_message_at)}</span>
            </div>
          </button>
        ))}
      </nav>
    </aside>
  );
}
