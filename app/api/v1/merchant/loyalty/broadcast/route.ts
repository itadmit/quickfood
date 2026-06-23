import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { loadLoyaltyData } from "@/lib/loyalty/members";
import { renderRtlEmail } from "@/lib/email/templates";
import { sendPoplyEmail, sendPoplySms, poplyConfigured } from "@/lib/poply/client";
import { sendWhatsApp } from "@/lib/whatsapp/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_RECIPIENTS = 2000;

const BroadcastSchema = z.object({
  channel: z.enum(["email", "sms", "whatsapp"]),
  tier: z.enum(["all", "silver", "gold", "platinum"]).default("all"),
  subject: z.string().max(160).optional(),
  body: z.string().min(1).max(2000),
});

// Mailing is wired end-to-end but stays gated until the paid mailing packages
// ship. Flip LOYALTY_MAILING_ENABLED=true to go live - no code change.
function mailingEnabled(): boolean {
  return process.env.LOYALTY_MAILING_ENABLED === "true";
}

async function chunkedSend<T>(items: T[], size: number, fn: (item: T) => Promise<boolean>) {
  let sent = 0;
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size);
    const results = await Promise.all(batch.map((it) => fn(it).catch(() => false)));
    sent += results.filter(Boolean).length;
  }
  return sent;
}

export const POST = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);

  const body = BroadcastSchema.parse(await req.json());

  if (!mailingEnabled()) {
    return apiError("coming_soon", "הדיוור ייפתח בקרוב עם חבילות הדיוור", 403);
  }
  if (body.channel === "email" && !poplyConfigured()) {
    return apiError("not_configured", "ספק הדיוור אינו מחובר עדיין", 503);
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { name: true },
  });
  const { rows } = await loadLoyaltyData(session.tenantId, tenant?.name ?? "העסק");

  // Only club members, matching the chosen tier, that have the contact field
  // the channel needs.
  const audience = rows
    .filter((r) => r.isMember)
    .filter((r) => body.tier === "all" || r.tier === body.tier)
    .filter((r) => (body.channel === "email" ? !!r.email : !!r.phone))
    .slice(0, MAX_RECIPIENTS);

  if (audience.length === 0) {
    return apiJson({ sent: 0, total: 0, skipped: 0 });
  }

  let sent = 0;
  if (body.channel === "email") {
    const subject = body.subject?.trim() || `עדכון מ-${tenant?.name ?? "המסעדה"}`;
    const { html } = renderRtlEmail({
      subject,
      heading: subject,
      paragraphs: body.body.split("\n").filter((l) => l.trim().length > 0),
      footerNote: "קיבלת מייל זה כחבר/ה במועדון הלקוחות.",
    });
    sent = await chunkedSend(audience, 20, async (r) => {
      const res = await sendPoplyEmail({ to: r.email!, subject, html });
      return res.ok;
    });
  } else if (body.channel === "sms") {
    sent = await chunkedSend(audience, 20, async (r) => {
      const res = await sendPoplySms({ to: r.phone, message: body.body });
      return res.ok;
    });
  } else {
    sent = await chunkedSend(audience, 10, async (r) => {
      const res = await sendWhatsApp({
        tenantId: session.tenantId!,
        to: r.phone,
        body: body.body,
        kind: "loyalty_broadcast",
      });
      return res.status === "sent";
    });
  }

  return apiJson({ sent, total: audience.length, skipped: audience.length - sent });
});
