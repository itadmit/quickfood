import { handler, apiJson, apiError } from "@/lib/api-response";
import { resolveTenantBySlug } from "@/lib/slug";

export const runtime = "nodejs";

export const GET = handler(async (_req, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params;
  const tenant = await resolveTenantBySlug(slug);
  if (!tenant) return apiError("not_found", "מסעדה לא נמצאה", 404);
  const branch = tenant.branches[0] ?? null;
  return apiJson({
    restaurant: {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      logo_letter: tenant.logoLetter,
      logo_url: tenant.logoUrl,
      theme_id: tenant.themeId,
      cuisine_type: tenant.cuisineType,
      branch: branch
        ? {
            id: branch.id,
            name: branch.name,
            address: branch.address,
            phone: branch.phone,
            status: branch.status,
            hours: branch.hours,
            min_order: branch.minOrder,
            delivery_fee: branch.deliveryFee,
            service_fee: branch.serviceFee,
          }
        : null,
    },
  });
});
