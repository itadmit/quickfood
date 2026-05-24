import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { NoticeInputSchema } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const notices = await prisma.notice.findMany({
    where: { tenantId: session.tenantId },
    orderBy: [{ active: "desc" }, { position: "asc" }, { updatedAt: "desc" }],
  });
  return apiJson({ notices });
});

export const POST = handler(async (req: Request) => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const body = NoticeInputSchema.parse(await req.json());

  if (body.scope === "category" && !body.category_id) {
    return apiError("validation_error", "category_id required for category scope", 400);
  }
  if (body.scope === "item" && !body.item_id) {
    return apiError("validation_error", "item_id required for item scope", 400);
  }

  const notice = await prisma.notice.create({
    data: {
      tenantId: session.tenantId,
      scope: body.scope,
      categoryId: body.scope === "category" ? body.category_id ?? null : null,
      itemId: body.scope === "item" ? body.item_id ?? null : null,
      kind: body.kind,
      title: body.title,
      body: body.body ?? null,
      icon: body.icon ?? null,
      active: body.active,
      position: body.position,
    },
  });
  return apiJson({ notice }, 201);
});
