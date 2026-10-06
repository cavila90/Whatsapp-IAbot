import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agente WhatsApp",
  description: "Panel local para gestionar conversaciones de WhatsApp",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
