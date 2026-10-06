import { NextResponse, type NextRequest } from "next/server";
import { enqueueOutbox, getConversationById, getMessages, insertMessage } from "@/lib/db";

interface Context { params: Promise<{ conversationId: string }> }

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: Context) {
  const id = Number((await params).conversationId);
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  if (!getConversationById(id)) return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  return NextResponse.json(getMessages(id));
}

export async function POST(request: NextRequest, { params }: Context) {
  const id = Number((await params).conversationId);
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const conversation = getConversationById(id);
  if (!conversation) return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  if (conversation.mode !== "HUMAN") return NextResponse.json({ error: "Activa el modo HUMAN para responder" }, { status: 409 });
  const body = await request.json().catch(() => null) as { content?: unknown } | null;
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!content || content.length > 10_000) return NextResponse.json({ error: "Mensaje vacío o demasiado largo" }, { status: 400 });
  const message = insertMessage(id, "human", content);
  enqueueOutbox(id, conversation.phone, content);
  return NextResponse.json(message, { status: 201 });
}
