import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Read status — used by the dashboard to render the most recent import
    and (less often) to poll mid-commit. */
export const GET = handler(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const session = await requireMerchant();
    if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
    const { id } = await ctx.params;

    const row = await prisma.woltImport.findUnique({
      where: { id },
      // rawMenu is megabytes — never ship it back to the dashboard.
      select: {
        id: true,
        tenantId: true,
        sourceUrl: true,
        venueId: true,
        venueName: true,
        status: true,
        categoriesTotal: true,
        itemsTotal: true,
        categoriesImported: true,
        itemsImported: true,
        imagesUploaded: true,
        errors: true,
        createdAt: true,
        committedAt: true,
      },
    });
    if (!row || row.tenantId !== session.tenantId) {
      return apiError("not_found", "ייבוא לא נמצא", 404);
    }
    const { tenantId: _, ...rest } = row;
    return apiJson({ import: rest });
  },
);
