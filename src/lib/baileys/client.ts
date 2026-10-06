import type { WAMessage, WASocket } from "@whiskeysockets/baileys";
import fs from "node:fs";
import path from "node:path";
import pino from "pino";
import qrcode from "qrcode-terminal";
import { getSentMessagePayload, saveSentMessagePayload, setConnectionState } from "@/lib/db";
import { loadBaileysModule } from "@/lib/baileys/module";

const logger = pino({ level: "silent" });

export interface BaileysHandle {
  shutdown(): Promise<void>;
  sendMessage(jid: string, content: string): Promise<void>;
  getSocket(): WASocket | null;
}

export async function startBaileys(onMessages: (messages: WAMessage[], type: "notify" | "append") => Promise<void>): Promise<BaileysHandle> {
  const baileys = await loadBaileysModule();
  const makeWASocket = baileys.default;
  const { Browsers, DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState: loadAuthState } = baileys;
  const authDir = path.resolve(process.cwd(), "auth");
  fs.mkdirSync(authDir, { recursive: true });
  let sock: WASocket | null = null;
  let reconnectTimer: NodeJS.Timeout | null = null;
  let stopped = false;

  const connect = async (): Promise<void> => {
    if (stopped) return;
    const { state, saveCreds } = await loadAuthState(authDir);
    let version: [number, number, number] | undefined;
    try {
      const fetched = await fetchLatestBaileysVersion();
      version = fetched.version;
    } catch (error) {
      console.warn("[bot] No se pudo obtener la última versión de WhatsApp:", error);
    }

    const current = makeWASocket({
      version,
      auth: state,
      logger,
      browser: Browsers.macOS("Desktop"),
      markOnlineOnConnect: false,
      syncFullHistory: false,
      getMessage: async ({ id }) => {
        if (!id) return undefined;
        const payload = getSentMessagePayload(id);
        return payload ? baileys.proto.Message.decode(payload) : undefined;
      },
    });
    sock = current;
    current.ev.on("creds.update", saveCreds);
    current.ev.on("messages.upsert", async ({ messages, type }) => {
      console.info(`[bot] messages.upsert: tipo=${type}, cantidad=${messages.length}`);
      if (type !== "notify" && type !== "append") return;
      try { await onMessages(messages, type); }
      catch (error) { console.error("[bot] Error procesando mensajes:", error); }
    });
    current.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        setConnectionState({ status: "qr", qr_string: qr, phone: null });
        qrcode.generate(qr, { small: true });
      }
      if (connection === "connecting") {
        setConnectionState({ status: "connecting" });
        console.info("[bot] Abriendo conexión con WhatsApp.");
      }
      if (connection === "open") {
        const rawPhone = current.user?.id?.split(":")[0]?.split("@")[0] ?? null;
        setConnectionState({ status: "connected", qr_string: null, phone: rawPhone });
        console.info(`[bot] WhatsApp conectado${rawPhone ? `: ${rawPhone}` : ""}`);
      }
      if (connection === "close") {
        const disconnectError = lastDisconnect?.error as { output?: { statusCode?: number } } | undefined;
        const code = disconnectError?.output?.statusCode;
        const errorMessage = lastDisconnect?.error instanceof Error ? lastDisconnect.error.message : "sin detalle";
        const errorCode = (lastDisconnect?.error as NodeJS.ErrnoException | undefined)?.code;
        console.warn("[bot] Detalle del cierre:", { code, errorMessage, errorCode });
        if (code === DisconnectReason.loggedOut) {
          setConnectionState({ status: "disconnected", qr_string: null, phone: null });
          console.warn("[bot] Sesión cerrada en WhatsApp; se requiere un nuevo QR.");
          return;
        }
        setConnectionState({ status: "disconnected", qr_string: null });
        if (stopped || reconnectTimer) return;
        const delay = code === 440 ? 15_000 : 5_000;
        console.warn(`[bot] Conexión cerrada (código ${code ?? "desconocido"}); reintentando en ${delay / 1000}s.`);
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          try { current.end(undefined); } catch { /* Socket ya cerrado. */ }
          if (sock === current) sock = null;
          void connect().catch((error) => console.error("[bot] Error al reconectar:", error));
        }, delay);
      }
    });
  };

  await connect();
  return {
    async shutdown() {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = null;
      const oldSocket = sock;
      sock = null;
      if (oldSocket) {
        try { oldSocket.end(undefined); } catch { /* Socket ya cerrado. */ }
      }
    },
    async sendMessage(jid, content) {
      if (!sock) throw new Error("WhatsApp no está conectado");
      const sent = await sock.sendMessage(jid, { text: content });
      if (sent.key.id && sent.message) {
        const payload = baileys.proto.Message.encode(sent.message).finish();
        saveSentMessagePayload(sent.key.id, payload);
      }
    },
    getSocket: () => sock,
  };
}
