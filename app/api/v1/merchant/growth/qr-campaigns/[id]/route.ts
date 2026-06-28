import { z } from "zod";
import { Prisma } from "@prisma/client";
import { handler, apiJson, apiError, apiEmpty } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { DESTINATION_TYPES } from "@/lib/growth/qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Patch = z.object({
  name: z.string().min(1).max(120).optional(),
  destinationType: z.enum(DESTINATION_TYPES).optional(),
  destinationUrl: z.string().url().nullable().optional(),
  landingTemplate: z.string().max(40).nullable().optional(),
  landingCopy: z.record(z.unknown()).nullable().optional(),
  couponId: z.string().uuid().nullable().optional(),
  cost: z.number().int().min(0).max(1000000).optional(),
  status: z.enum(["active", "paused"]).optional(),
});

async function ownCampaign(id: string, tenantId: string) {
  const c = await prisma.qrCampaign.findUnique({ where: { id }, select: { tenantId: true } });
  return c && c.tenantId === tenantId ? c : null;
}

export const PATCH = handler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireMerchant(["owner", "manager"]);
    if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
    const { id } = await params;
    if (!(await ownCampaign(id, session.tenantId))) return apiError("not_found", "campaign not found", 404);
    const body = Patch.parse(await req.json());
    const campaign = await prisma.qrCampaign.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.destinationType !== undefined ? { destinationType: body.destinationType } : {}),
        ...(body.destinationUrl !== undefined ? { destinationUrl: body.destinationUrl } : {}),
        ...(body.landingTemplate !== undefined ? { landingTemplate: body.landingTemplate } : {}),
        ...(body.landingCopy !== undefined
          ? {
              landingCopy:
                body.landingCopy === null
                  ? Prisma.DbNull
                  : (body.landingCopy as Prisma.InputJsonValue),
            }
          : {}),
        ...(body.couponId !== undefined ? { couponId: body.couponId } : {}),
        ...(body.cost !== undefined ? { cost: body.cost } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
      },
    });
    return apiJson({ campaign });
  },
);

export const DELETE = handler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireMerchant(["owner", "manager"]);
    if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
    const { id } = await params;
    if (!(await ownCampaign(id, session.tenantId))) return apiError("not_found", "campaign not found", 404);
    await prisma.qrCampaign.delete({ where: { id } });
    return apiEmpty();
  },
);
