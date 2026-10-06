import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { setConnectionState } from "@/lib/db";

export async function POST() {
  const authDir = path.resolve(process.cwd(), "auth");
  const dataDir = path.resolve(process.cwd(), "data");
  setConnectionState({ status: "disconnected", qr_string: null, phone: null });
  fs.rmSync(authDir, { recursive: true, force: true });
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, ".restart"), "");
  return NextResponse.json({ ok: true });
}
