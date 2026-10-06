import OpenAI from "openai";
import { SYSTEM_PROMPT } from "@/lib/system-prompt";
import type { Message } from "@/lib/db";

export async function generateReply(history: Message[]): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("Falta OPENAI_API_KEY en .env.local");
  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.map((message) => ({
        role: message.role === "user" ? "user" as const : "assistant" as const,
        content: message.content,
      })),
    ],
  });
  const content = response.choices[0]?.message?.content;
  if (!content || typeof content !== "string") throw new Error("OpenAI devolvió una respuesta vacía");
  return content.trim();
}
