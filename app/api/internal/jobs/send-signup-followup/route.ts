/**
 * QStash-invoked job: one hour after signup, check in with the merchant.
 *
 * Scheduled from /api/v1/auth/signup with `{ tenantId }` and a 60-minute
 * delay. The copy adapts to where the merchant actually is - menu already
 * started vs. empty, clearing provider connected vs. not (Grow pitch).
 */
import { handler, apiJson, apiError } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";
import { PaymentProvider } from "@prisma/client";
import { verifySignature } from "@/lib/qstash/client";
import { sendEmail } from "@/lib/email/send";
import { signupFollowupEmail } from "@/lib/email/templates";
import { GROW_SIGNUP_URL } from "@/lib/grow-signup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req: Request) => {
  const rawBody = await req.text();
  const ok = await verifySignature(req, rawBody);
  if (!ok) {
    return apiError("unauthorized", "invalid qstash signature", 401);
  }

  const { tenantId } = JSON.parse(rawBody) as { tenantId: string };
  if (!tenantId) return apiError("bad_request", "missing tenantId", 400);

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      status: true,
      merchantUsers: {
        where: { role: "owner" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { id: true, name: true, email: true },
      },
    },
  });
  const owner = tenant?.merchantUsers[0];
  if (!tenant || !owner) return apiJson({ ok: true, skipped: "tenant_or_owner_missing" });
  if (tenant.status === "suspended") return apiJson({ ok: true, skipped: "tenant_suspended" });

  // QStash retries on 5xx - don't double-send if a previous attempt got
  // through but the response was lost.
  const already = await prisma.emailLog.findFirst({
    where: { tenantId: tenant.id, kind: "signup_followup", status: "sent" },
    select: { id: true },
  });
  if (already) return apiJson({ ok: true, skipped: "already_sent" });

  const [menuItemCount, growConfig] = await Promise.all([
    prisma.menuItem.count({ where: { tenantId: tenant.id } }),
    prisma.paymentProviderConfig.findUnique({
      where: { tenantId_provider: { tenantId: tenant.id, provider: PaymentProvider.grow } },
      select: { isActive: true },
    }),
  ]);

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://quickfood.co.il").replace(/\/$/, "");
  const { html, text } = signupFollowupEmail({
    ownerName: owner.name,
    businessName: tenant.name,
    dashboardUrl: `${appUrl}/dashboard`,
    hasMenuItems: menuItemCount > 0,
    hasPayments: growConfig?.isActive ?? false,
    growSignupUrl: GROW_SIGNUP_URL,
  });

  const result = await sendEmail({
    tenantId: tenant.id,
    to: owner.email,
    subject: `${owner.name}, איך מתקדמת ההקמה של ${tenant.name}?`,
    body: text,
    html,
    kind: "signup_followup",
    refKind: "merchant_user",
    refId: owner.id,
  });

  return apiJson({ ok: true, status: result.status });
});
