import QRCode from "qrcode";
import { ConnectionGate } from "@/components/ConnectionGate";
import { getConnectionState } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const state = getConnectionState();
  const shouldShowQr = !!state.qr_string && (state.status === "qr" || state.status === "connecting");
  const qrPng = shouldShowQr && state.qr_string
    ? await QRCode.toDataURL(state.qr_string, { width: 360, margin: 2 })
    : null;
  return <ConnectionGate initialStatus={{ status: shouldShowQr ? "qr" : state.status, phone: state.phone, qrPng }} />;
}
