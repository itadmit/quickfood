import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { resolveTenantBySlug } from "@/lib/slug";
import { KioskApp } from "./KioskApp";

export const dynamic = "force-dynamic";

export default async function KioskPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const tenant = await resolveTenantBySlug(tenantSlug);
  if (!tenant) notFound();
  if (!tenant.kioskEnabled) notFound();

  const [categories, items] = await Promise.all([
    prisma.menuCategory.findMany({
      where: { tenantId: tenant.id, active: true },
      orderBy: { position: "asc" },
      select: { id: true, name: true },
    }),
    prisma.menuItem.findMany({
      where: { tenantId: tenant.id, available: true },
      orderBy: [{ featured: "desc" }, { position: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        basePrice: true,
        artType: true,
        images: true,
        imageUrl: true,
        tags: true,
        categoryId: true,
      },
    }),
  ]);

  return (
    <KioskApp
      tenantSlug={tenant.slug}
      tenantName={tenant.name}
      logoUrl={tenant.logoUrl ?? null}
      welcomeText={tenant.kioskWelcomeText}
      idleSeconds={tenant.kioskIdleSeconds}
      categories={categories}
      items={items.map((it) => ({
        id: it.id,
        name: it.name,
        description: it.description ?? null,
        basePrice: it.basePrice,
        artType: it.artType,
        imageUrl: it.images?.[0] ?? it.imageUrl ?? null,
        tags: it.tags,
        categoryId: it.categoryId,
      }))}
    />
  );
}
