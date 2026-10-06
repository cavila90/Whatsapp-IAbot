"use client";

import Image from "next/image";

export function QRScreen({ status, qrPng, elapsedSeconds }: { status: string; qrPng: string | null; elapsedSeconds: number }) {
  const isQr = Boolean(qrPng);
  const connecting = status === "connecting" && !qrPng;
  const failed = status === "disconnected" && elapsedSeconds > 10;
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-100 px-5 py-10">
      <section className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-2xl">⌁</div>
        <p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-700">Agente WhatsApp</p>
        <h1 className="mt-2 text-2xl font-semibold">Conectar número</h1>
        {isQr ? <>
          <p className="mt-3 text-sm text-stone-500">Abre WhatsApp en tu teléfono y escanea este código desde Dispositivos vinculados.</p>
          <div className="mx-auto mt-6 inline-flex rounded-2xl border border-stone-200 bg-white p-3"><Image src={qrPng!} alt="Código QR de conexión de WhatsApp" width={320} height={320} unoptimized /></div>
          <p className="mt-4 flex items-center justify-center gap-2 text-sm text-amber-700"><span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />Esperando escaneo…</p>
        </> : connecting ? <p className="mt-6 flex items-center justify-center gap-3 text-sm text-blue-700"><span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />Conectando con WhatsApp…</p>
          : failed ? <div className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800"><p className="font-semibold">No se pudo obtener el código QR.</p><p className="mt-1">Revisa que el proceso del bot esté activo y vuelve a cargar esta página.</p></div>
            : <p className="mt-6 flex items-center justify-center gap-3 text-sm text-stone-600"><span className="h-5 w-5 animate-spin rounded-full border-2 border-stone-200 border-t-emerald-600" />Esperando al proceso del bot…</p>}
      </section>
    </main>
  );
}
