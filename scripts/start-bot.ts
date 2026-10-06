import "./env-loader";
import fs from "node:fs";
import path from "node:path";
import { handleIncomingMessages } from "../src/lib/baileys/handler";
import { startBaileys, type BaileysHandle } from "../src/lib/baileys/client";
import { getPendingOutbox, markOutboxSent, setConnectionState } from "../src/lib/db";

const dataDir = path.resolve(process.cwd(), "data");
const authDir = path.resolve(process.cwd(), "auth");
const restartFlag = path.join(dataDir, ".restart");
let handle: BaileysHandle | null = null;
let stopping = false;
let busy = false;
let lastOutboxPoll = 0;

async function start(): Promise<void> {
  handle = await startBaileys((messages, type) => handleIncomingMessages(messages, type, async (jid, content) => {
    if (!handle) throw new Error("El cliente de WhatsApp no está disponible");
    await handle.sendMessage(jid, content);
  }));
}

async function poll(): Promise<void> {
  if (busy || stopping) return;
  busy = true;
  try {
    if (fs.existsSync(restartFlag)) {
      fs.unlinkSync(restartFlag);
      await handle?.shutdown();
      handle = null;
      fs.rmSync(authDir, { recursive: true, force: true });
      setConnectionState({ status: "disconnected", qr_string: null, phone: null });
      await start();
      return;
    }
    if (!handle) return;
    if (Date.now() - lastOutboxPoll < 2_000) return;
    lastOutboxPoll = Date.now();
    for (const item of getPendingOutbox()) {
      try {
        await handle.sendMessage(item.phone, item.content);
        markOutboxSent(item.id);
      } catch (error) {
        console.error(`[bot] No se pudo enviar el mensaje ${item.id}:`, error);
        break;
      }
    }
  } catch (error) {
    console.error("[bot] Error en el ciclo de tareas:", error);
  } finally {
    busy = false;
  }
}

async function main(): Promise<void> {
  fs.mkdirSync(dataDir, { recursive: true });
  await start();
  const timer = setInterval(() => void poll(), 1_000);
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    clearInterval(timer);
    await handle?.shutdown();
    process.exit(0);
  };
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

main().catch((error) => {
  console.error("[bot] No se pudo iniciar:", error);
  process.exitCode = 1;
});
