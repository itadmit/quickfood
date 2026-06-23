/**
 * Resolve the merchant account to log into from a normalised E.164 phone.
 *
 * phoneE164 is NOT unique - a handful of owners run more than one store off
 * the same number. When several accounts share a number we pick deterministically:
 * a linked tenant beats a tenant-less row, then most-recently-active, then newest.
 * A future enhancement can return the full list and let the user pick a store.
 */
import { prisma } from "@/lib/db/client";

export interface ResolvedMerchant {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string | null;
  tenant: { id: string; slug: string; name: string; themeId: string } | null;
}

export async function findMerchantByPhone(
  phoneE164: string,
): Promise<ResolvedMerchant | null> {
  const candidates = await prisma.merchantUser.findMany({
    where: { phoneE164 },
    orderBy: [{ lastLoginAt: "desc" }, { createdAt: "desc" }],
    include: {
      tenant: { select: { id: true, slug: true, name: true, themeId: true } },
    },
  });
  if (candidates.length === 0) return null;

  const best =
    candidates.find((c) => c.tenantId !== null) ?? candidates[0];

  return {
    id: best.id,
    email: best.email,
    name: best.name,
    role: best.role,
    tenantId: best.tenantId,
    tenant: best.tenant,
  };
}
