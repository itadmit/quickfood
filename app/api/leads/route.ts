import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { checkRate } from "@/lib/api/rate-limit";
import { prisma } from "@/lib/db/client";
import { sendEmail } from "@/lib/email/send";
import { leadEmail } from "@/lib/email/templates";

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

  const stored = await prisma.marketingLead.create({
    data: {
      name: data.name,
      restaurant: data.restaurant || null,
      phone: data.phone || null,
      email: data.email,
      message: data.message || null,
      source: data.source,
      ip,
    },
    select: { id: true },
  });

  const { html, text } = leadEmail({
    name: data.name,
    restaurant: data.restaurant || undefined,
    email: data.email,
    phone: data.phone || undefined,
    message: data.message || undefined,
    source: data.source,
    ip,
  });

  const result = await sendEmail({
    tenantId: null,
    to: LEAD_TO,
    subject: `ליד חדש: ${data.name}${data.restaurant ? ` · ${data.restaurant}` : ""}`,
    body: text,
    html,
    replyTo: data.email,
    kind: "lead",
    refKind: "lead_source",
    refId: data.source,
  });

  await prisma.marketingLead.update({
    where: { id: stored.id },
    data: { emailStatus: result.status },
  });

  if (result.status !== "sent") {
    throw apiError("send_failed", "לא הצלחנו לשלוח את הפנייה, נסה שוב", 502);
  }

  return apiJson({ ok: true });
});
