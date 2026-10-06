import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  serverExternalPackages: ["better-sqlite3", "@whiskeysockets/baileys"],
  turbopack: { root: process.cwd() },
};

export default nextConfig;
