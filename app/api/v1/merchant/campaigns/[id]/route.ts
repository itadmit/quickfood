import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { CampaignPatchSchema } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = handler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireMerchant();
    if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
    const { id } = await params;
    const existing = await prisma.campaign.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== session.tenantId) {
      return apiError("not_found", "קמפיין לא נמצא", 404);
    }
    const body = CampaignPatchSchema.parse(await req.json());
    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        ...(body.kind !== undefined && { kind: body.kind }),
        ...(body.style !== undefined && { style: body.style }),
        ...(body.title !== undefined && { title: body.title }),
        ...(body.subtitle !== undefined && { subtitle: body.subtitle }),
        ...(body.icon !== undefined && { icon: body.icon }),
        ...(body.color !== undefined && { color: body.color }),
        ...(body.image_url !== undefined && { imageUrl: body.image_url }),
        ...(body.is_active !== undefined && { isActive: body.is_active }),
        ...(body.link_url !== undefined && { linkUrl: body.link_url }),
      },
    });
    return apiJson({ campaign });
  },
);

export const DELETE = handler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireMerchant();
    if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
    const { id } = await params;
    const existing = await prisma.campaign.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== session.tenantId) {
      return apiError("not_found", "קמפיין לא נמצא", 404);
    }
    await prisma.campaign.delete({ where: { id } });
    return apiJson({ ok: true });
  },
);
