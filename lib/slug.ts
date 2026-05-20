import { cache } from "react";
import { prisma } from "@/lib/db/client";

/**
 * Resolve tenant by slug — cached per request via React `cache()`.
 * Returns null if not found.
 */
export const resolveTenantBySlug = cache(async (slug: string) => {
  if (!slug) return null;
  return prisma.tenant.findUnique({
    where: { slug },
    include: {
      branches: { where: { isPrimary: true }, take: 1 },
    },
  });
});

/**
 * Validate a slug string (used in admin onboarding).
 */
export function isValidSlug(s: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(s);
}
