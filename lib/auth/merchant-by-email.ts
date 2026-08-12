import { prisma } from "@/lib/db/client";

export interface ResolvedMerchant {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string | null;
  tenant: { id: string; slug: string; name: string; themeId: string } | null;
}

export async function findMerchantByEmail(email: string): Promise<ResolvedMerchant | null> {
  const merchant = await prisma.merchantUser.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: {
      tenant: { select: { id: true, slug: true, name: true, themeId: true } },
    },
  });
  if (!merchant) return null;

  return {
    id: merchant.id,
    email: merchant.email,
    name: merchant.name,
    role: merchant.role,
    tenantId: merchant.tenantId,
    tenant: merchant.tenant,
  };
}
