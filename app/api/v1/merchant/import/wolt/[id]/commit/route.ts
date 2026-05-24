import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { commitImport } from "@/lib/wolt-import/commit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stay well under Vercel's default 60s ceiling — the importer's image
// loop respects a parallelism cap so a 50-item menu typically finishes
// in 20-30s. Larger catalogs that exceed this should be re-architected
// onto QStash; not in scope for v1.
export const maxDuration = 60;

export const POST = handler(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const session = await requireMerchant(["owner", "manager"]);
    if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
    const { id } = await ctx.params;

    const row = await prisma.woltImport.findUnique({
      where: { id },
      select: { tenantId: true, status: true },
    });
    if (!row || row.tenantId !== session.tenantId) {
      return apiError("not_found", "ייבוא לא נמצא", 404);
    }
    if (row.status === "committed") {
      return apiError("already_committed", "הייבוא הזה כבר בוצע", 409);
    }
    if (row.status === "failed") {
      return apiError("failed_state", "הייבוא הזה כשל ויש לצור תצוגה חדשה", 409);
    }

    try {
      const result = await commitImport(id);
      return apiJson({ import_id: id, ...result });
    } catch (err) {
      await prisma.woltImport.update({
        where: { id },
        data: {
          status: "failed",
          errors: [
            {
              context: "commit",
              message: err instanceof Error ? err.message : String(err),
            },
          ] as unknown as object,
        },
      });
      throw err;
    }
  },
);
