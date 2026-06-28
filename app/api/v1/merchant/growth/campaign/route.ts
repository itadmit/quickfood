import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { renderRtlEmail } from "@/lib/email/templates";
import { sendPoplyEmail, sendPoplySms, poplyFrom, poplyConfigured } from "@/lib/poply/client";
import { sendWhatsApp } from "@/lib/whatsapp/send";
import {
  reserveSmsCredit,
  refundSmsCredit,
  getSmsCredits,
  getWhatsappCredits,
} from "@/lib/messaging/credits";
import { getSegmentRecipients, GROWTH_SEGMENTS } from "@/lib/growth/segments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_RECIPIENTS = 2000;

async function chunkedSend<T>(items: T[], size: number, fn: (item: T) => Promise<boolean>) {
  let sent = 0;
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size);
    const results = await Promise.all(batch.map((it) => fn(it).catch(() => false)));
    sent += results.filter(Boolean).length;
  }
  return sent;
}

// Preview: how many consented recipients the segment+channel reaches, and the
// merchant's relevant credit balance.
export const GET = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const url = new URL(req.url);
  const segment = url.searchParams.get("segment") ?? "";
  const channel = url.searchParams.get("channel") ?? "sms";
  if (!(GROWTH_SEGMENTS as readonly string[]).includes(segment)) {
    return apiError("validation_error", "bad segment", 422);
  }
  if (!["email", "sms", "whatsapp"].includes(channel)) {
    return apiError("validation_error", "bad channel", 422);
  }
  const recipients = await getSegmentRecipients(
    session.tenantId,
    segment as never,
    channel as never,
  );
  const remaining =
    channel === "whatsapp"
      ? await getWhatsappCredits(session.tenantId)
      : channel === "sms"
        ? await getSmsCredits(session.tenantId)
        : null;
  return apiJson({ recipients: recipients.length, remaining });
});

const Body = z.object({
  segment: z.enum(GROWTH_SEGMENTS),
  channel: z.enum(["email", "sms", "whatsapp"]),
  subject: z.string().max(160).optional(),
  body: z.string().min(1).max(2000),
});

export const POST = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const tenantId = session.tenantId;
  const input = Body.parse(await req.json());

  if ((input.channel === "email" || input.channel === "sms") && !poplyConfigured()) {
    return apiError("not_configured", "ספק הדיוור אינו מחובר עדיין", 503);
  }

  const [smsCredits, waCredits] = await Promise.all([
    getSmsCredits(tenantId),
    getWhatsappCredits(tenantId),
  ]);
  const channelCredits =
    input.channel === "whatsapp"
      ? waCredits
      : input.channel === "sms"
        ? smsCredits
        : Math.max(smsCredits, waCredits);
  if (channelCredits <= 0) {
    return apiError(
      "no_credits",
      input.channel === "whatsapp"
        ? "הדיוור בוואטסאפ נפתח לאחר רכישת חבילת וואטסאפ."
        : "הדיוור נפתח לאחר רכישת חבילת הודעות.",
      402,
    );
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, smsSender: true },
  });
  const businessName = tenant?.name ?? "המסעדה";

  const recipients = (await getSegmentRecipients(tenantId, input.segment, input.channel)).slice(
    0,
    MAX_RECIPIENTS,
  );
  if (recipients.length === 0) {
    return apiJson({ sent: 0, total: 0, skipped: 0, remaining: smsCredits });
  }

  let sent = 0;
  if (input.channel === "email") {
    const subject = input.subject?.trim() || `עדכון מ-${businessName}`;
    const { html } = renderRtlEmail({
      brand: businessName,
      subject,
      heading: subject,
      paragraphs: input.body.split("\n").filter((l) => l.trim().length > 0),
      footerNote: "קיבלת מייל זה כלקוח/ה שאישר/ה דיוור.",
    });
    const from = poplyFrom(businessName);
    sent = await chunkedSend(recipients, 20, async (r) => {
      const res = await sendPoplyEmail({ to: r.email!, subject, html, from });
      return res.ok;
    });
  } else if (input.channel === "sms") {
    const sender = tenant?.smsSender ?? undefined;
    sent = await chunkedSend(recipients, 20, async (r) => {
      const reserved = await reserveSmsCredit(tenantId);
      if (!reserved) return false;
      const res = await sendPoplySms({ to: r.phone, message: input.body, sender });
      if (!res.ok) {
        await refundSmsCredit(tenantId);
        return false;
      }
      return true;
    });
  } else {
    sent = await chunkedSend(recipients, 10, async (r) => {
      const res = await sendWhatsApp({
        tenantId,
        to: r.phone,
        body: input.body,
        kind: "growth_campaign",
      });
      return res.status === "sent";
    });
  }

  return apiJson({
    sent,
    total: recipients.length,
    skipped: recipients.length - sent,
    remaining:
      input.channel === "whatsapp"
        ? await getWhatsappCredits(tenantId)
        : await getSmsCredits(tenantId),
  });
});
