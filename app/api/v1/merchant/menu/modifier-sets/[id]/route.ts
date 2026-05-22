import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { ModifierSetInputSchema } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const { id } = await params;

  const set = await prisma.modifierSet.findFirst({
    where: { id, tenantId: session.tenantId },
    include: {
      options: { orderBy: { position: "asc" } },
      _count: { select: { attachedTo: true } },
    },
  });
  if (!set) return apiError("not_found", "קטלוג לא נמצא", 404);

  return apiJson({
    set: {
      id: set.id,
      name: set.name,
      type: set.type,
      required: set.required,
      min_select: set.minSelect,
      max_select: set.maxSelect,
      included_free: set.includedFree,
      help_text: set.helpText,
      position: set.position,
      attached_count: set._count.attachedTo,
      options: set.options.map((o) => ({
        id: o.id,
        name: o.name,
        price_delta: o.priceDelta,
        is_default: o.isDefault,
        available: o.available,
      })),
    },
  });
});

export const PUT = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const { id } = await params;
  const body = ModifierSetInputSchema.parse(await req.json());

  const existing = await prisma.modifierSet.findFirst({
    where: { id, tenantId: session.tenantId },
    select: { id: true },
  });
  if (!existing) return apiError("not_found", "קטלוג לא נמצא", 404);

  await prisma.$transaction([
    prisma.modifierSet.update({
      where: { id },
      data: {
        name: body.name,
        type: body.type,
        required: body.required,
        minSelect: body.min_select,
        maxSelect: body.max_select,
        includedFree: body.included_free,
        helpText: body.help_text ?? null,
        position: body.position,
      },
    }),
    prisma.modifierSetOption.deleteMany({ where: { setId: id } }),
    prisma.modifierSetOption.createMany({
      data: body.options.map((o, oi) => ({
        setId: id,
        name: o.name,
        priceDelta: o.price_delta,
        isDefault: o.is_default,
        available: o.available,
        position: oi,
      })),
    }),
  ]);

  return apiJson({ set: { id } });
});

export const DELETE = handler(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const { id } = await params;

  const existing = await prisma.modifierSet.findFirst({
    where: { id, tenantId: session.tenantId },
    select: { id: true },
  });
  if (!existing) return apiError("not_found", "קטלוג לא נמצא", 404);

  // ItemOptionGroup.templateSetId is ON DELETE SET NULL — attached groups
  // become inline again but their inline options are preserved, so the
  // attached items keep working.
  await prisma.modifierSet.delete({ where: { id } });
  return apiJson({ ok: true });
});
