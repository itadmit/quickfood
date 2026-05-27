import { handler, apiJson, apiError } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";
import { resolveTenantBySlug } from "@/lib/slug";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (req: Request) => {
  const url = new URL(req.url);
  const slug = url.searchParams.get("tenant");
  const idsRaw = url.searchParams.get("ids");
  if (!slug || !idsRaw) return apiError("validation_error", "missing tenant or ids", 422);
  const tenant = await resolveTenantBySlug(slug);
  if (!tenant) return apiError("not_found", "tenant not found", 404);

  const ids = idsRaw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 8);
  if (ids.length === 0) return apiJson({ items: [] });

  const rows = await prisma.menuItem.findMany({
    where: { id: { in: ids }, tenantId: tenant.id, available: true },
    select: {
      id: true,
      name: true,
      description: true,
      basePrice: true,
      images: true,
    },
  });

  const items = ids
    .map((id) => rows.find((r) => r.id === id))
    .filter((r): r is NonNullable<typeof r> => !!r)
    .map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      basePrice: r.basePrice,
      imageUrl: r.images?.[0] ?? null,
      href: `/s/${slug}/menu/${r.id}`,
    }));

  return apiJson({ items });
});
