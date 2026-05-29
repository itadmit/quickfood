import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";
import { hashToken, issueCourierSession, setCourierCookie } from "@/lib/auth/courier-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ token: z.string().min(16) });

export const POST = handler(async (req: Request) => {
  const { token } = Body.parse(await req.json());
  const tokenHash = hashToken(token);
  const record = await prisma.courierMagicLinkToken.findUnique({
    where: { tokenHash },
    include: {
      courier: { select: { id: true, active: true } },
    },
  });
  if (!record) return apiError("invalid_token", "קישור לא תקף", 401);
  if (record.usedAt) return apiError("invalid_token", "הקישור כבר נוצל", 401);
  if (record.expiresAt < new Date()) return apiError("invalid_token", "פג תוקף הקישור", 401);
  if (!record.courier.active) return apiError("forbidden", "החשבון מושבת", 403);

  await prisma.courierMagicLinkToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });
  await prisma.courier.update({
    where: { id: record.courierId },
    data: { lastSeenAt: new Date() },
  });
  const raw = await issueCourierSession(record.courierId);
  await setCourierCookie(raw);
  return apiJson({ ok: true });
});
