import type * as Baileys from "@whiskeysockets/baileys";

type BaileysModule = typeof Baileys;

// Baileys v7 is ESM-only. Preserve a native dynamic import when this bot is
// started through tsx/cjs so Node 22 and 24 can load the ESM package.
const nativeImport = new Function("specifier", "return import(specifier)") as (
  specifier: string,
) => Promise<BaileysModule>;

let modulePromise: Promise<BaileysModule> | null = null;

export function loadBaileysModule(): Promise<BaileysModule> {
  modulePromise ??= nativeImport("@whiskeysockets/baileys");
  return modulePromise;
}
