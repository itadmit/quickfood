/**
 * PATCH /api/v1/merchant/menu/items/[id]/featured
 *
 * Toggles whether a menu item is in the storefront's "popular" / featured
 * section. Mirrors the availability endpoint — narrow, fast, optimistic-update
 * friendly.
 */

import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchSchema = z.object({ featured: z.boolean() });

export const PATCH = handler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireMerchant();
    if (!session.tenantId) return apiError("forbidden", "no tenant", 403);

    const { id } = await params;
    const body = PatchSchema.parse(await req.json());

    const item = await prisma.menuItem.findUnique({
      where: { id },
      select: { tenantId: true },
    });
    if (!item) return apiError("not_found", "פריט לא נמצא", 404);
    if (item.tenantId !== session.tenantId) {
      return apiError("forbidden", "אין הרשאה", 403);
    }

    const updated = await prisma.menuItem.update({
      where: { id },
      data: { featured: body.featured },
      select: { id: true, featured: true },
    });
    return apiJson({ item: updated });
  },
);
