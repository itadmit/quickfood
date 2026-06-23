import { handler, apiJson, apiError, apiEmpty } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { ensureLoyaltyMember } from "@/lib/loyalty/membership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Merchant adds a customer (typically an existing purchaser) to the club.
export const POST = handler(
  async (_req: Request, { params }: { params: Promise<{ customerId: string }> }) => {
    const session = await requireMerchant(["owner", "manager"]);
    if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
    const { customerId } = await params;
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });
    if (!customer) return apiError("not_found", "לקוח לא נמצא", 404);
    await ensureLoyaltyMember({
      tenantId: session.tenantId,
      customerId,
      joinSource: "manual",
      marketingConsent: false,
    });
    return apiJson({ ok: true }, 201);
  },
);

// Merchant removes a customer from the club. The customer + their orders
// stay; only the membership row is deleted.
export const DELETE = handler(
  async (_req: Request, { params }: { params: Promise<{ customerId: string }> }) => {
    const session = await requireMerchant(["owner", "manager"]);
    if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
    const { customerId } = await params;
    await prisma.loyaltyMember.deleteMany({
      where: { tenantId: session.tenantId, customerId },
    });
    return apiEmpty();
  },
);
