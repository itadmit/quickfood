import { z } from "zod";
import { headers } from "next/headers";
import { handler, apiJson } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";
import { sendEmail } from "@/lib/email/send";
import { courierMagicLinkEmail } from "@/lib/email/templates";
import { generateRawToken, hashToken } from "@/lib/auth/courier-session";
import { checkRate } from "@/lib/api/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  email: z.string().email(),
});

const TTL_MINUTES = 15;

export const POST = handler(async (req: Request) => {
  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    hdrs.get("x-real-ip") ||
    "unknown";
  checkRate(`courier-magic:${ip}`, 10);

  const body = Body.parse(await req.json());
  const email = body.email.trim().toLowerCase();

  const courier = await prisma.courier.findFirst({
    where: { email, active: true },
    select: {
      id: true,
      name: true,
      tenant: { select: { name: true } },
    },
  });
  if (!courier) {
    return apiJson({ ok: true });
  }

  const raw = generateRawToken();
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60 * 1000);
  await prisma.courierMagicLinkToken.create({
    data: { courierId: courier.id, tokenHash, expiresAt },
  });

  const origin = process.env.APP_BASE_URL?.replace(/\/$/, "") ?? "https://app.quickfood.co.il";
  const loginUrl = `${origin}/courier/login/verify?token=${encodeURIComponent(raw)}`;
  const businessName = courier.tenant.name ?? "QuickFood";
  const { html, text } = courierMagicLinkEmail({
    courierName: courier.name,
    businessName,
    loginUrl,
    expiresInMinutes: TTL_MINUTES,
  });
  await sendEmail({
    tenantId: null,
    to: email,
    subject: `התחברות לאפליקציית השליחים של ${businessName}`,
    body: text,
    html,
    kind: "courier_magic_link",
    refKind: "courier",
    refId: courier.id,
  });

  return apiJson({ ok: true });
});
