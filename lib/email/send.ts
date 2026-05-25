/**
 * Email sender — wraps Resend (https://resend.com).
 *
 * Same shape as `lib/sms/send.ts`: pre-create a `pending` EmailLog row, call
 * the provider, mark the row sent/failed. No per-message billing model on
 * QuickFood's side (emails are unmetered).
 */
import { prisma } from "@/lib/db/client";

const RESEND_URL = "https://api.resend.com/emails";
const RESEND_KEY = process.env.RESEND_API_KEY ?? "";
const FROM = process.env.RESEND_FROM ?? "QuickFood <noreply@quickfood.co.il>";

const CONSOLE_FALLBACK = process.env.EMAIL_PROVIDER === "console";

export interface SendEmailInput {
  /** Tenant the email belongs to. Null for platform-level sends (e.g. test emails). */
  tenantId: string | null;
  to: string;
  subject: string;
  /** Plain-text body (always required — used as fallback + stored in EmailLog). */
  body: string;
  /** Optional pre-rendered HTML body. Must already be RTL-wrapped (see lib/email/templates.ts). */
  html?: string;
  fromName?: string;
  /** Optional Reply-To header — used when an inbound lead/contact form should
   *  let the recipient hit "Reply" and reach the submitter directly. */
  replyTo?: string;
  kind?: string;
  refKind?: string;
  refId?: string;
}

export interface SendEmailResult {
  status: "sent" | "invalid_recipient" | "failed";
  logId: string;
  providerId?: string;
  providerMsg?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const to = input.to.trim();
  const from = input.fromName ? `${input.fromName} <${stripFromEmail(FROM)}>` : FROM;

  const log = await prisma.emailLog.create({
    data: {
      tenantId: input.tenantId,
      to,
      fromName: input.fromName ?? "",
      subject: input.subject,
      body: input.body,
      kind: input.kind ?? "generic",
      refKind: input.refKind,
      refId: input.refId,
      status: "pending",
    },
    select: { id: true },
  });

  if (!isValidEmail(to)) {
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: "invalid_recipient", providerMsg: "bad email format" },
    });
    return { status: "invalid_recipient", logId: log.id };
  }

  if (CONSOLE_FALLBACK) {
    // eslint-disable-next-line no-console
    console.log(`[email:console] to=${to} subject=${input.subject}\n${input.body}`);
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: "sent", sentAt: new Date(), providerMsg: "console fallback" },
    });
    return { status: "sent", logId: log.id };
  }

  if (!RESEND_KEY) {
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: "failed", providerMsg: "RESEND_API_KEY missing" },
    });
    return { status: "failed", logId: log.id, providerMsg: "RESEND_API_KEY missing" };
  }

  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${RESEND_KEY}`,
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: input.subject,
        text: input.body,
        ...(input.html ? { html: input.html } : {}),
        ...(input.replyTo && isValidEmail(input.replyTo) ? { reply_to: input.replyTo } : {}),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      name?: string;
    };
    if (!res.ok) {
      const providerMsg = data.message ?? data.name ?? `resend ${res.status}`;
      await prisma.emailLog.update({
        where: { id: log.id },
        data: { status: "failed", providerMsg },
      });
      return { status: "failed", logId: log.id, providerMsg };
    }
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: "sent", sentAt: new Date(), providerId: data.id ?? null },
    });
    return { status: "sent", logId: log.id, providerId: data.id };
  } catch (err) {
    const providerMsg = err instanceof Error ? err.message : "fetch_failed";
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: "failed", providerMsg },
    });
    return { status: "failed", logId: log.id, providerMsg };
  }
}

function isValidEmail(s: string): boolean {
  // RFC isn't pretty; this is a pragmatic check.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function stripFromEmail(fromHeader: string): string {
  const m = /<([^>]+)>/.exec(fromHeader);
  return m?.[1] ?? fromHeader;
}
