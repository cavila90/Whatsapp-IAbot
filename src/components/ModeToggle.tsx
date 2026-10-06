"use client";

import type { Mode } from "@/lib/db";

export function ModeToggle({ mode, onChange, disabled = false }: { mode: Mode; onChange: (mode: Mode) => void; disabled?: boolean }) {
  return (
    <div className="flex rounded-xl bg-stone-100 p-1" aria-label="Modo de respuesta">
      {(["AI", "HUMAN"] as const).map((item) => (
        <button key={item} type="button" disabled={disabled} onClick={() => onChange(item)}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${mode === item ? item === "AI" ? "bg-emerald-600 text-white shadow-sm" : "bg-amber-500 text-white shadow-sm" : "text-stone-500 hover:text-stone-800"}`}>
          {item === "AI" ? "IA" : "Humano"}
        </button>
      ))}
    </div>
  );
}
