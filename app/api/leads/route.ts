import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { checkRate } from "@/lib/api/rate-limit";
import { sendEmail } from "@/lib/email/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LEAD_TO = process.env.LEAD_INBOX ?? "hello@quickfood.co.il";

const LeadSchema = z.object({
  name: z.string().trim().min(2, "שם קצר מדי").max(120),
  restaurant: z.string().trim().max(160).optional().default(""),
  phone: z
    .string()
    .trim()
    .max(40)
    .regex(/^[\d+\-()\s]{7,}$/, "טלפון לא תקין")
    .optional()
    .or(z.literal("")),
  email: z.string().trim().email("מייל לא תקין").max(200),
  message: z.string().trim().max(2000).optional().default(""),
  source: z.string().trim().max(60).optional().default("unknown"),
  website: z.string().max(0, "bot").optional().default(""),
});

export const POST = handler(async (req: Request) => {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  try {
    checkRate(`lead:${ip}`, 5);
  } catch (err) {
    if (err instanceof Response) throw err;
    throw apiError("rate_limited", "יותר מדי ניסיונות, נסה שוב בעוד דקה", 429);
  }

  const raw = (await req.json().catch(() => null)) as unknown;
  if (!raw || typeof raw !== "object") {
    throw apiError("bad_request", "גוף בקשה לא תקין", 400);
  }
  const data = LeadSchema.parse(raw);

  if (data.website) {
    return apiJson({ ok: true });
  }

  const lines = [
    `שם: ${data.name}`,
    data.restaurant ? `מסעדה: ${data.restaurant}` : null,
    `מייל: ${data.email}`,
    data.phone ? `טלפון: ${data.phone}` : null,
    data.message ? `\nהודעה:\n${data.message}` : null,
    `\n— מקור: ${data.source} · IP: ${ip}`,
  ].filter(Boolean) as string[];

  const html = `<div dir="rtl" style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;color:#0a0a0a">
    <h2 style="margin:0 0 12px;font-size:18px">ליד חדש מ-${escapeHtml(data.source)}</h2>
    <table style="border-collapse:collapse">
      <tr><td style="padding:4px 12px 4px 0;color:#6e6e6e">שם</td><td>${escapeHtml(data.name)}</td></tr>
      ${data.restaurant ? `<tr><td style="padding:4px 12px 4px 0;color:#6e6e6e">מסעדה</td><td>${escapeHtml(data.restaurant)}</td></tr>` : ""}
      <tr><td style="padding:4px 12px 4px 0;color:#6e6e6e">מייל</td><td><a href="mailto:${escapeHtml(data.email)}">${escapeHtml(data.email)}</a></td></tr>
      ${data.phone ? `<tr><td style="padding:4px 12px 4px 0;color:#6e6e6e">טלפון</td><td><a href="tel:${escapeHtml(data.phone)}">${escapeHtml(data.phone)}</a></td></tr>` : ""}
    </table>
    ${data.message ? `<div style="margin-top:16px;padding:12px;background:#faf8f2;border-radius:8px;white-space:pre-wrap">${escapeHtml(data.message)}</div>` : ""}
    <p style="margin-top:20px;color:#6e6e6e;font-size:12px">IP: ${escapeHtml(ip)}</p>
  </div>`;

  const result = await sendEmail({
    tenantId: null,
    to: LEAD_TO,
    subject: `ליד חדש: ${data.name}${data.restaurant ? ` · ${data.restaurant}` : ""}`,
    body: lines.join("\n"),
    html,
    replyTo: data.email,
    kind: "lead",
    refKind: "lead_source",
    refId: data.source,
  });

  if (result.status !== "sent") {
    throw apiError("send_failed", "לא הצלחנו לשלוח את הפנייה, נסה שוב", 502);
  }

  return apiJson({ ok: true });
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
