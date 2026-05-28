import { NextResponse } from "next/server";
import { consumeVerificationToken } from "@/lib/auth/email-verification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://quickfood.co.il").replace(/\/$/, "");
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await consumeVerificationToken(token);
  const base = appBaseUrl();
  const status = result.ok ? "success" : result.reason;
  return NextResponse.redirect(`${base}/verify-email?status=${status}`, 302);
}
