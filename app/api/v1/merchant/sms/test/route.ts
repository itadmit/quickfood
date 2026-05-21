/**
 * SMS test send — used by the merchant dashboard to verify sms4free credentials
 * and sender approval before the merchant buys a credit package. Bypasses the
 * per-tenant credit gate (platform absorbs the cost), but still rate-limited
 * via a 60-second cooldown per tenant.
 */
import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { sendSms } from "@/lib/sms/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  to: z.string().min(7).max(20),
});

export const POST = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const { to } = Schema.parse(await req.json());

  // Cooldown: at most one test SMS per minute per tenant. Sliding window over
  // the SmsLog table for `kind: "test"`.
  const cutoff = new Date(Date.now() - 60_000);
  const recent = await prisma.smsLog.count({
    where: {
      tenantId: session.tenantId,
      kind: "test",
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

  const body = `הודעת בדיקה מ-${tenant?.name ?? "QuickFood"}. אם קיבלת אותה — הכל מחובר.`;
  const result = await sendSms({
    tenantId: session.tenantId,
    to,
    body,
    kind: "test",
    skipCredit: true,
  });

  return apiJson({ result });
});
