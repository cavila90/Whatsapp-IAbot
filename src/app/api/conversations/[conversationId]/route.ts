import { NextResponse, type NextRequest } from "next/server";
import { deleteConversation } from "@/lib/db";

interface Context { params: Promise<{ conversationId: string }> }

export async function DELETE(_request: NextRequest, { params }: Context) {
  const id = Number((await params).conversationId);
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  deleteConversation(id);
  return NextResponse.json({ ok: true });
}
