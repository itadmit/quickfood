import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SmsSenderRegex = /^[A-Za-z0-9]{1,11}$/;

const Schema = z.object({
  enabled: z.boolean().optional(),
  public: z.boolean().optional(),
  channel: z.enum(["off", "email", "sms", "whatsapp"]).optional(),
  // Bounded between 5 minutes and 24 hours
  delay_minutes: z.number().int().min(5).max(1440).optional(),
  sms_sender: z
    .string()
    .max(11)
    .regex(SmsSenderRegex, "אותיות באנגלית או ספרות בלבד, עד 11 תווים")
    .nullable()
    .optional(),
});

export const GET = handler(async () => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const t = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: {
      reviewsEnabled: true,
      reviewsPublic: true,
      reviewsChannel: true,
      reviewsDelayMinutes: true,
      smsSender: true,
    },
  });
  if (!t) return apiError("not_found", "tenant not found", 404);
  return apiJson({
    settings: {
      enabled: t.reviewsEnabled,
      public: t.reviewsPublic,
      channel: t.reviewsChannel,
      delay_minutes: t.reviewsDelayMinutes,
      sms_sender: t.smsSender,
    },
  });
});

export const PATCH = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const body = Schema.parse(await req.json());

  const updated = await prisma.tenant.update({
    where: { id: session.tenantId },
    data: {
      ...(body.enabled !== undefined && { reviewsEnabled: body.enabled }),
      ...(body.public !== undefined && { reviewsPublic: body.public }),
      ...(body.channel !== undefined && { reviewsChannel: body.channel }),
      ...(body.delay_minutes !== undefined && { reviewsDelayMinutes: body.delay_minutes }),
      ...(body.sms_sender !== undefined && { smsSender: body.sms_sender }),
    },
    select: {
      reviewsEnabled: true,
      reviewsPublic: true,
      reviewsChannel: true,
      reviewsDelayMinutes: true,
      smsSender: true,
    },
  });

  return apiJson({
    settings: {
      enabled: updated.reviewsEnabled,
      public: updated.reviewsPublic,
      channel: updated.reviewsChannel,
      delay_minutes: updated.reviewsDelayMinutes,
      sms_sender: updated.smsSender,
    },
  });
});
