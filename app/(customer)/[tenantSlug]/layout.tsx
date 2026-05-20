import { notFound } from "next/navigation";
import { resolveTenantBySlug } from "@/lib/slug";
import { ThemeProvider } from "@/components/shared/ThemeProvider";
import { CartProvider } from "@/components/customer/CartProvider";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const tenant = await resolveTenantBySlug(tenantSlug);
  if (!tenant) return { title: "QuickFood" };
  return {
    title: `${tenant.name} · הזמנות אונליין`,
    description: tenant.cuisineType ?? "הזמנות אונליין דרך QuickFood",
  };
}

export default async function CustomerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const tenant = await resolveTenantBySlug(tenantSlug);
  if (!tenant) notFound();
  const branch = tenant.branches[0];

  return (
    <ThemeProvider themeId={tenant.themeId} className="min-h-screen bg-qf-bg">
      <CartProvider
        tenant={{
          id: tenant.id,
          slug: tenant.slug,
          name: tenant.name,
          logoLetter: tenant.logoLetter,
          themeId: tenant.themeId,
        }}
        branch={
          branch
            ? {
                deliveryFee: branch.deliveryFee,
                serviceFee: branch.serviceFee,
                minOrder: branch.minOrder,
              }
            : null
        }
      >
        <div className="max-w-md mx-auto bg-qf-bg min-h-screen relative shadow-md">
          {children}
        </div>
      </CartProvider>
    </ThemeProvider>
  );
}
