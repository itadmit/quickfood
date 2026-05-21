/**
 * WhatsApp test send — used by the merchant dashboard to verify the iBot
 * connection (token + instance_id) before the merchant relies on it for
 * customer messages. Bypasses the per-tenant credit gate (platform absorbs
 * the cost), but rate-limited via a 60-second cooldown per tenant.
 */
import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { sendWhatsApp } from "@/lib/whatsapp/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  to: z.string().min(7).max(20),
});

export const POST = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const { to } = Schema.parse(await req.json());

  // Cooldown: at most one test send per minute per tenant per channel.
  // Sliding window over the unified sms_logs table.
  const cutoff = new Date(Date.now() - 60_000);
  const recent = await prisma.smsLog.count({
    where: {
      tenantId: session.tenantId,
      kind: "test",
      channel: "whatsapp",
      createdAt: { gt: cutoff },
    },
  });
  if (recent > 0) {
    return apiError(
      "rate_limited",
      "המתן דקה לפני שליחת הודעת בדיקה נוספת",
      429,
    );
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { name: true },
  });

  const body = `הודעת בדיקה מ-${tenant?.name ?? "QuickFood"}. אם קיבלת אותה — ה-WhatsApp מחובר.`;
  const result = await sendWhatsApp({
    tenantId: session.tenantId,
    to,
    body,
    kind: "test",
    skipCredit: true,
  });

  return apiJson({ result });
});
