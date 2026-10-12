import { timingSafeEqual } from "node:crypto";
import { monitorWalletPayments } from "@/lib/billing/wallet/monitor";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request) {
  const expected = process.env.CRYPTO_MONITOR_SECRET, supplied = request.headers.get("authorization") || "";
  if (!expected || expected.length < 32) return Response.json({ error: "Monitor is not configured" }, { status: 503 });
  const a = Buffer.from(supplied), b = Buffer.from(`Bearer ${expected}`);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (process.env.WALLET_CRYPTO_ENABLED !== "true") return Response.json({ error: "Wallet checkout is not enabled" }, { status: 503 });
  try { return Response.json(await monitorWalletPayments()); } catch { return Response.json({error: "Wallet monitor failed; payment remains unconfirmed"}, {status: 503}); }
}
export const GET = POST;
