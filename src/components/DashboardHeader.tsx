"use client";

export function DashboardHeader({ phone, onDisconnect }: { phone: string | null; onDisconnect: () => void }) {
  return (
    <header className="flex items-center justify-between border-b border-stone-200 bg-white px-5 py-3 md:px-8">
      <div className="flex items-center gap-3">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
        <div><p className="text-sm font-semibold">WhatsApp conectado</p><p className="text-xs text-stone-500">{phone ? `+${phone}` : "Sesión activa"}</p></div>
      </div>
      <button type="button" onClick={onDisconnect} className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50">Desconectar</button>
    </header>
  );
}
