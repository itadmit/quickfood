import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { commitMenuFileImport } from "@/lib/menu-import/commit";
import { ExtractedMenuSchema } from "@/lib/menu-import/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const POST = handler(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const session = await requireMerchant(["owner", "manager"]);
    if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
    const { id } = await ctx.params;

    const parsed = ExtractedMenuSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return apiError("validation_error", "התפריט לעריכה אינו תקין", 422);
    }
    if (parsed.data.items.length === 0) {
      return apiError("empty_menu", "אין מנות לייבוא", 422);
    }

    const row = await prisma.menuFileImport.findUnique({
      where: { id },
      select: { tenantId: true, status: true },
    });
    if (!row || row.tenantId !== session.tenantId) {
      return apiError("not_found", "ייבוא לא נמצא", 404);
    }
    if (row.status === "committed") {
      return apiError("already_committed", "התפריט כבר יובא", 409);
    }

    try {
      const result = await commitMenuFileImport(id, parsed.data, {
        importedByUserId: session.userId,
      });
      return apiJson({ import_id: id, ...result });
    } catch (err) {
      await prisma.menuFileImport.update({
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
