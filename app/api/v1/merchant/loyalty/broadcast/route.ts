import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { loadLoyaltyData } from "@/lib/loyalty/members";
import { renderRtlEmail } from "@/lib/email/templates";
import { sendPoplyEmail, sendPoplySms, poplyFrom, poplyConfigured } from "@/lib/poply/client";
import { sendWhatsApp } from "@/lib/whatsapp/send";
import { reserveSmsCredit, refundSmsCredit, getSmsCredits } from "@/lib/messaging/credits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_RECIPIENTS = 2000;

const BroadcastSchema = z.object({
  channel: z.enum(["email", "sms", "whatsapp"]),
  tier: z.enum(["all", "silver", "gold", "platinum"]).default("all"),
  subject: z.string().max(160).optional(),
  body: z.string().min(1).max(2000),
});

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

  // Marketing mailing unlocks once the merchant has bought a messaging
  // package (credits > 0). This is the single "buy first, then mail" gate.
  const balance = await getSmsCredits(session.tenantId);
  if (balance <= 0) {
    return apiError(
      "no_credits",
      "הדיוור נפתח לאחר רכישת חבילת הודעות. רכשו חבילה כדי לשלוח.",
      402,
    );
  }
  // Email + SMS both run through Poply; WhatsApp via iBot.
  if ((body.channel === "email" || body.channel === "sms") && !poplyConfigured()) {
    return apiError("not_configured", "ספק הדיוור אינו מחובר עדיין", 503);
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { name: true, smsSender: true },
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
    return apiJson({ sent: 0, total: 0, skipped: 0, remaining: await getSmsCredits(session.tenantId) });
  }

  // SMS + WhatsApp draw the single messaging balance. Block early on empty so
  // the merchant gets a clear message instead of an all-skipped result.
  if (body.channel === "sms" || body.channel === "whatsapp") {
    const credits = await getSmsCredits(session.tenantId);
    if (credits <= 0) {
      return apiError("no_credits", "אין יתרת הודעות לשליחה. ניתן לרכוש חבילת הודעות.", 402);
    }
  }

  const businessName = tenant?.name ?? "המסעדה";

  let sent = 0;
  if (body.channel === "email") {
    const subject = body.subject?.trim() || `עדכון מ-${businessName}`;
    const { html } = renderRtlEmail({
      brand: businessName,
      subject,
      heading: subject,
      paragraphs: body.body.split("\n").filter((l) => l.trim().length > 0),
      footerNote: "קיבלת מייל זה כחבר/ה במועדון הלקוחות.",
    });
    // Sender display name = the merchant's business name, over QuickFood's
    // verified Poply address (POPLY_FROM_EMAIL). Falls back to the workspace
    // default when that env isn't set.
    const from = poplyFrom(businessName);
    sent = await chunkedSend(audience, 20, async (r) => {
      const res = await sendPoplyEmail({ to: r.email!, subject, html, from });
      return res.ok;
    });
  } else if (body.channel === "sms") {
    // SMS through Poply with a per-message sender = the merchant's business
    // name (tenant.smsSender). QuickFood owns the meter: reserve one credit
    // from the single balance before each send, refund if Poply rejects it.
    const sender = tenant?.smsSender ?? undefined;
    sent = await chunkedSend(audience, 20, async (r) => {
      const reserved = await reserveSmsCredit(session.tenantId!);
      if (!reserved) return false;
      const res = await sendPoplySms({ to: r.phone, message: body.body, sender });
      if (!res.ok) {
        await refundSmsCredit(session.tenantId!);
        return false;
      }
      return true;
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

  return apiJson({
    sent,
    total: audience.length,
    skipped: audience.length - sent,
    remaining: await getSmsCredits(session.tenantId),
  });
});
