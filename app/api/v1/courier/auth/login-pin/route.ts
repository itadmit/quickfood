import { z } from "zod";
import bcrypt from "bcryptjs";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";
import { issueCourierSession, setCourierCookie } from "@/lib/auth/courier-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  identifier: z.string().min(3).max(120),
  pin: z.string().regex(/^\d{4,6}$/, "PIN חייב להיות 4-6 ספרות"),
});

function normalizeIdentifier(raw: string): { email?: string; phone?: string } {
  const trimmed = raw.trim();
  if (trimmed.includes("@")) return { email: trimmed.toLowerCase() };
  const digits = trimmed.replace(/[^\d]/g, "");
  return { phone: digits };
}

export const POST = handler(async (req: Request) => {
  const body = Body.parse(await req.json());
  const { email, phone } = normalizeIdentifier(body.identifier);

  const courier = await prisma.courier.findFirst({
    where: {
      active: true,
      OR: [
        ...(email ? [{ email }] : []),
        ...(phone ? [{ phone }] : []),
      ],
    },
    select: { id: true, pinHash: true },
  });
  if (!courier || !courier.pinHash) {
    return apiError("invalid_credentials", "טלפון/מייל או PIN שגויים", 401);
  }
  const ok = await bcrypt.compare(body.pin, courier.pinHash);
  if (!ok) {
    return apiError("invalid_credentials", "טלפון/מייל או PIN שגויים", 401);
  }

  await prisma.courier.update({
    where: { id: courier.id },
    data: { lastSeenAt: new Date() },
  });
  const raw = await issueCourierSession(courier.id);
  await setCourierCookie(raw);
  return apiJson({ ok: true });
});
