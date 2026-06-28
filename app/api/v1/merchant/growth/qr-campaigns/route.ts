import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { createQrCampaign, QR_TYPES, DESTINATION_TYPES } from "@/lib/growth/qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  type: z.enum(QR_TYPES),
  destinationType: z.enum(DESTINATION_TYPES).default("menu"),
  destinationUrl: z.string().url().optional().nullable(),
  landingTemplate: z.string().max(40).optional().nullable(),
  landingCopy: z.record(z.unknown()).optional().nullable(),
  couponId: z.string().uuid().optional().nullable(),
});

export const GET = handler(async () => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const campaigns = await prisma.qrCampaign.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { createdAt: "desc" },
  });
  return apiJson({ campaigns });
});

export const POST = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const body = CreateSchema.parse(await req.json());
  const campaign = await createQrCampaign({ tenantId: session.tenantId, ...body });
  return apiJson({ campaign }, 201);
});
