import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export type Mode = "AI" | "HUMAN";
export type MessageRole = "user" | "assistant" | "human";
export type ConnectionStatus = "disconnected" | "qr" | "connecting" | "connected";

export interface Conversation {
  id: number;
  phone: string;
  name: string | null;
  mode: Mode;
  last_message_at: number | null;
  created_at: number;
}

export interface Message {
  id: number;
  conversation_id: number;
  role: MessageRole;
  content: string;
  created_at: number;
}

export interface ConnectionState {
  status: ConnectionStatus;
  qr_string: string | null;
  phone: string | null;
  updated_at: number;
}

export interface OutboxItem {
  id: number;
  conversation_id: number;
  phone: string;
  content: string;
  sent: number;
  created_at: number;
}

const dataDir = path.resolve(process.cwd(), "data");
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, "messages.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE NOT NULL,
    name TEXT,
    mode TEXT CHECK(mode IN ('AI','HUMAN')) NOT NULL DEFAULT 'AI',
    last_message_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id),
    role TEXT CHECK(role IN ('user','assistant','human')) NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS inbound_events (
    event_key TEXT PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);
  CREATE TABLE IF NOT EXISTS connection_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    status TEXT CHECK(status IN ('disconnected','qr','connecting','connected')) NOT NULL DEFAULT 'disconnected',
    qr_string TEXT,
    phone TEXT,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  INSERT OR IGNORE INTO connection_state (id, status) VALUES (1, 'disconnected');
  CREATE TABLE IF NOT EXISTS outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    phone TEXT NOT NULL,
    content TEXT NOT NULL,
    sent INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox(sent, created_at);
  CREATE TABLE IF NOT EXISTS sent_message_payloads (
    message_id TEXT PRIMARY KEY,
    payload_base64 TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
`);

export function getOrCreateConversation(phone: string, name?: string | null): Conversation {
  db.prepare(`INSERT INTO conversations (phone, name) VALUES (?, ?)
    ON CONFLICT(phone) DO UPDATE SET name = COALESCE(excluded.name, conversations.name)`).run(phone, name ?? null);
  return db.prepare("SELECT * FROM conversations WHERE phone = ?").get(phone) as Conversation;
}

export function getConversationById(id: number): Conversation | null {
  return (db.prepare("SELECT * FROM conversations WHERE id = ?").get(id) as Conversation | undefined) ?? null;
}

export function insertMessage(conversationId: number, role: MessageRole, content: string): Message {
  const insert = db.prepare("INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)");
  const update = db.prepare("UPDATE conversations SET last_message_at = unixepoch() WHERE id = ?");
  const transaction = db.transaction(() => {
    const result = insert.run(conversationId, role, content);
    update.run(conversationId);
    return db.prepare("SELECT * FROM messages WHERE id = ?").get(result.lastInsertRowid) as Message;
  });
  return transaction();
}

export function insertIncomingMessage(
  phone: string,
  name: string | null,
  eventKey: string | null,
  content: string,
): { conversation: Conversation; inserted: boolean } {
  const transaction = db.transaction(() => {
    db.prepare(`INSERT INTO conversations (phone, name) VALUES (?, ?)
      ON CONFLICT(phone) DO UPDATE SET name = COALESCE(excluded.name, conversations.name)`).run(phone, name);
    const conversation = db.prepare("SELECT * FROM conversations WHERE phone = ?").get(phone) as Conversation;

    if (eventKey) {
      const claim = db.prepare("INSERT INTO inbound_events (event_key, conversation_id) VALUES (?, ?) ON CONFLICT(event_key) DO NOTHING")
        .run(eventKey, conversation.id);
      if (claim.changes === 0) return { conversation, inserted: false };
    }

    db.prepare("INSERT INTO messages (conversation_id, role, content) VALUES (?, 'user', ?)")
      .run(conversation.id, content);
    db.prepare("UPDATE conversations SET last_message_at = unixepoch() WHERE id = ?").run(conversation.id);
    const updated = db.prepare("SELECT * FROM conversations WHERE id = ?").get(conversation.id) as Conversation;
    return { conversation: updated, inserted: true };
  });
  return transaction();
}

export function getMessages(conversationId: number, limit = 50): Message[] {
  return db.prepare("SELECT * FROM (SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC, id DESC LIMIT ?) ORDER BY created_at ASC, id ASC")
    .all(conversationId, Math.max(1, Math.min(limit, 500))) as Message[];
}

export function getRecentHistory(conversationId: number, limit = 20): Message[] {
  return (db.prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC, id DESC LIMIT ?")
    .all(conversationId, Math.max(1, Math.min(limit, 100))) as Message[]).reverse();
}

export function setMode(conversationId: number, mode: Mode): void {
  db.prepare("UPDATE conversations SET mode = ? WHERE id = ?").run(mode, conversationId);
}

export function listConversations(): Array<Conversation & { last_message_preview: string | null }> {
  return db.prepare(`SELECT c.*,
      (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_message_preview
    FROM conversations c ORDER BY COALESCE(c.last_message_at, c.created_at) DESC, c.id DESC`).all() as Array<Conversation & { last_message_preview: string | null }>;
}

export function getConnectionState(): ConnectionState {
  return db.prepare("SELECT status, qr_string, phone, updated_at FROM connection_state WHERE id = 1").get() as ConnectionState;
}

export function setConnectionState(state: Partial<Pick<ConnectionState, "status" | "qr_string" | "phone">> & { status: ConnectionStatus }): void {
  const current = getConnectionState();
  db.prepare("UPDATE connection_state SET status = ?, qr_string = ?, phone = ?, updated_at = unixepoch() WHERE id = 1")
    .run(state.status, state.qr_string === undefined ? current.qr_string : state.qr_string,
      state.phone === undefined ? current.phone : state.phone);
}

export function enqueueOutbox(conversationId: number, phone: string, content: string): void {
  db.prepare("INSERT INTO outbox (conversation_id, phone, content) VALUES (?, ?, ?)").run(conversationId, phone, content);
}

export function getPendingOutbox(limit = 20): OutboxItem[] {
  return db.prepare("SELECT * FROM outbox WHERE sent = 0 ORDER BY created_at ASC, id ASC LIMIT ?")
    .all(Math.max(1, Math.min(limit, 100))) as OutboxItem[];
}

export function markOutboxSent(id: number): void {
  db.prepare("UPDATE outbox SET sent = 1 WHERE id = ?").run(id);
}

export function saveSentMessagePayload(messageId: string, payload: Uint8Array): void {
  const payloadBase64 = Buffer.from(payload).toString("base64");
  db.prepare(`INSERT INTO sent_message_payloads (message_id, payload_base64)
    VALUES (?, ?) ON CONFLICT(message_id) DO UPDATE SET payload_base64 = excluded.payload_base64,
      created_at = unixepoch()`).run(messageId, payloadBase64);
  db.exec(`DELETE FROM sent_message_payloads WHERE message_id NOT IN
    (SELECT message_id FROM sent_message_payloads ORDER BY created_at DESC LIMIT 500)`);
}

export function getSentMessagePayload(messageId: string): Buffer | undefined {
  const row = db.prepare("SELECT payload_base64 FROM sent_message_payloads WHERE message_id = ?")
    .get(messageId) as { payload_base64: string } | undefined;
  return row ? Buffer.from(row.payload_base64, "base64") : undefined;
}

export function deleteConversation(id: number): void {
  const transaction = db.transaction(() => {
    db.prepare("DELETE FROM messages WHERE conversation_id = ?").run(id);
    db.prepare("DELETE FROM outbox WHERE conversation_id = ? AND sent = 0").run(id);
    db.prepare("DELETE FROM conversations WHERE id = ?").run(id);
  });
  transaction();
}
