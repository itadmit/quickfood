import { handler, apiJson, apiError } from "@/lib/api-response";
import { resolveTenantBySlug } from "@/lib/slug";
import { prisma } from "@/lib/db/client";
import { PaymentProvider } from "@prisma/client";

export const runtime = "nodejs";

export const GET = handler(async (_req, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params;
  const tenant = await resolveTenantBySlug(slug);
  if (!tenant) return apiError("not_found", "מסעדה לא נמצאה", 404);
  const branch = tenant.branches[0] ?? null;

  // Payment methods this tenant accepts. Cash is just a tenant-level boolean;
  // anything else (card/bit/apple_pay/google_pay) is gated by an active Grow
  // PaymentProviderConfig. The customer picks from this list at checkout.
  const growConfig = await prisma.paymentProviderConfig.findUnique({
    where: {
      tenantId_provider: { tenantId: tenant.id, provider: PaymentProvider.grow },
    },
    select: { isActive: true },
  });
  const growActive = growConfig?.isActive === true;

  const paymentMethods: string[] = [];
  if (tenant.acceptsCash) paymentMethods.push("cash");
  if (growActive) {
    paymentMethods.push("card", "bit", "apple_pay", "google_pay");
  }

  return apiJson({
    restaurant: {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      logo_letter: tenant.logoLetter,
      logo_url: tenant.logoUrl,
      theme_id: tenant.themeId,
      business_type: tenant.businessType,
      cuisine_type: tenant.cuisineType,
      payment_methods: paymentMethods,
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
