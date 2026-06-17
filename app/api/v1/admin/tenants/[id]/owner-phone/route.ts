import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  phone: z.string().trim().min(6).max(20),
});

export const POST = handler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    await requireAdmin();
    const { id } = await params;
    const { phone } = Schema.parse(await req.json());

    const owner =
      (await prisma.merchantUser.findFirst({
        where: { tenantId: id, role: "owner" },
        select: { id: true },
      })) ??
      (await prisma.merchantUser.findFirst({
        where: { tenantId: id },
        select: { id: true },
      }));
    if (!owner) return apiError("not_found", "לא נמצא משתמש למסעדה", 404);

    await prisma.merchantUser.update({
      where: { id: owner.id },
      data: { phone },
    });

    return apiJson({ ok: true, phone });
  },
);
