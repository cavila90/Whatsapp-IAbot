import type { WAMessage } from "@whiskeysockets/baileys";
import {
  getRecentHistory,
  insertIncomingMessage,
  insertMessage,
} from "@/lib/db";
import { generateReply } from "@/lib/openai";
import { loadBaileysModule } from "@/lib/baileys/module";

export async function handleIncomingMessages(
  messages: WAMessage[],
  type: "notify" | "append",
  sendMessage: (jid: string, content: string) => Promise<void>,
): Promise<void> {
  const { normalizeMessageContent } = await loadBaileysModule();
  let saved = 0;
  let duplicates = 0;
  let sentByUs = 0;
  let groups = 0;
  let unsupported = 0;

  for (const message of messages) {
    if (message.key.fromMe) { sentByUs++; continue; }
    const jid = message.key.remoteJid;
    if (!jid || jid === "status@broadcast") continue;
    if (jid.endsWith("@g.us")) { groups++; continue; }
    const alternateJid = message.key.remoteJidAlt;
    const conversationJid = jid.endsWith("@lid") && alternateJid?.endsWith("@s.whatsapp.net")
      ? alternateJid
      : jid;
    if (conversationJid !== jid) {
      console.info("[bot] JID LID detectado; usaré el JID telefónico alternativo para responder.");
    }

    const content = normalizeMessageContent(message.message);
    const text = content?.conversation
      ?? content?.extendedTextMessage?.text
      ?? content?.imageMessage?.caption
      ?? content?.videoMessage?.caption
      ?? content?.documentMessage?.caption
      ?? content?.buttonsResponseMessage?.selectedDisplayText
      ?? content?.listResponseMessage?.title
      ?? content?.templateButtonReplyMessage?.selectedDisplayText;
    const mediaPlaceholder = content?.imageMessage ? "[El usuario envió una imagen]"
      : content?.videoMessage ? "[El usuario envió un video]"
      : content?.audioMessage ? "[El usuario envió un audio]"
      : content?.documentMessage ? "[El usuario envió un documento]"
      : content?.stickerMessage ? "[El usuario envió un sticker]"
      : content?.locationMessage ? "[El usuario compartió una ubicación]"
      : content?.contactMessage || content?.contactsArrayMessage ? "[El usuario compartió un contacto]"
      : null;
    const body = text?.trim() || mediaPlaceholder;
    if (!body) {
      unsupported++;
      const contentTypes = content ? Object.keys(content).join(",") || "vacío" : "sin_cuerpo";
      const stubType = typeof message.messageStubType === "number" ? message.messageStubType : "ninguno";
      console.warn(`[bot] Mensaje entrante sin contenido compatible: tipos=${contentTypes}, stub=${stubType}.`);
      continue;
    }

    const eventKey = message.key.id
      ? `${jid}|${message.key.participant ?? ""}|${message.key.id}`
      : null;
    const result = insertIncomingMessage(conversationJid, message.pushName ?? null, eventKey, body);
    if (!result.inserted) { duplicates++; continue; }
    const conversation = result.conversation;
    saved++;
    console.info(`[bot] Mensaje guardado en conversación ${conversation.id}.`);
    if (type === "append" || conversation.mode !== "AI") continue;

    try {
      const history = getRecentHistory(conversation.id, 20);
      const reply = await generateReply(history);
      insertMessage(conversation.id, "assistant", reply);
      await sendMessage(conversationJid, reply);
    } catch (error) {
      const status = typeof error === "object" && error !== null && "status" in error
        ? (error as { status?: unknown }).status
        : undefined;
      const message = status === 401
        ? "La clave OPENAI_API_KEY no es válida para OpenAI. Configura una clave creada en platform.openai.com."
        : error instanceof Error ? error.message : "Error desconocido";
      console.error(`[bot] No se pudo generar o enviar la respuesta: ${message}`);
    }
  }
  console.info(`[bot] Resumen entrante: tipo=${type}, guardados=${saved}, duplicados=${duplicates}, propios=${sentByUs}, grupos_omitidos=${groups}, sin_contenido_compatible=${unsupported}.`);
}
