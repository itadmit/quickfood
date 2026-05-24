import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { TenantPatchSchema } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
  });
  return apiJson({ tenant });
});

export const PATCH = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const body = TenantPatchSchema.parse(await req.json());
  const tenant = await prisma.tenant.update({
    where: { id: session.tenantId },
    data: {
      name: body.name,
      logoLetter: body.logo_letter,
      logoUrl: body.logo_url,
      coverImage: body.cover_image,
      themeId: body.theme_id,
      businessType: body.business_type,
      cuisineType: body.cuisine_type,
      vatNumber: body.vat_number,
      checkoutShowTracking: body.checkout_show_tracking,
      scheduledOrdersEnabled: body.scheduled_orders_enabled,
    },
  });
  return apiJson({
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      logo_letter: tenant.logoLetter,
      theme_id: tenant.themeId,
    },
  });
});
