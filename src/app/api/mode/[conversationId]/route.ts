import { NextResponse, type NextRequest } from "next/server";
import { getConversationById, setMode, type Mode } from "@/lib/db";

interface Context { params: Promise<{ conversationId: string }> }

export async function POST(request: NextRequest, { params }: Context) {
  const id = Number((await params).conversationId);
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  if (!getConversationById(id)) return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  const body = await request.json().catch(() => null) as { mode?: unknown } | null;
  if (body?.mode !== "AI" && body?.mode !== "HUMAN") return NextResponse.json({ error: "Modo inválido" }, { status: 400 });
  setMode(id, body.mode as Mode);
  return NextResponse.json({ ok: true, mode: body.mode });
}
