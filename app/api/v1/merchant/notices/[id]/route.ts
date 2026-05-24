import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { NoticePatchSchema } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = handler(async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const { id } = await params;

  const existing = await prisma.notice.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!existing) return apiError("not_found", "notice not found", 404);

  const body = NoticePatchSchema.parse(await req.json());
  const nextScope = body.scope ?? existing.scope;

  const notice = await prisma.notice.update({
    where: { id },
    data: {
      scope: body.scope,
      categoryId:
        body.scope !== undefined
          ? nextScope === "category"
            ? body.category_id ?? null
            : null
          : body.category_id !== undefined
            ? body.category_id ?? null
            : undefined,
      itemId:
        body.scope !== undefined
          ? nextScope === "item"
            ? body.item_id ?? null
            : null
          : body.item_id !== undefined
            ? body.item_id ?? null
            : undefined,
      kind: body.kind,
      title: body.title,
      body: body.body ?? undefined,
      icon: body.icon ?? undefined,
      active: body.active,
      position: body.position,
    },
  });
  return apiJson({ notice });
});

export const DELETE = handler(async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const { id } = await params;

  const existing = await prisma.notice.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!existing) return apiError("not_found", "notice not found", 404);

  await prisma.notice.delete({ where: { id } });
  return apiJson({ ok: true });
});
