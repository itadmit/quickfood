import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { CampaignCreateSchema } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const campaigns = await prisma.campaign.findMany({
    where: { tenantId: session.tenantId },
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
  });
  return apiJson({ campaigns });
});

export const POST = handler(async (req: Request) => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const body = CampaignCreateSchema.parse(await req.json());
  const campaign = await prisma.campaign.create({
    data: {
      tenantId: session.tenantId,
      title: body.title,
      imageUrl: body.image_url,
      isActive: body.is_active ?? true,
      linkUrl: body.link_url ?? null,
    },
  });
  return apiJson({ campaign }, 201);
});
