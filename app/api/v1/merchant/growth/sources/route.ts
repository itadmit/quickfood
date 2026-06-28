import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { getSourcesForTenant } from "@/lib/growth/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { country: true },
  });
  const sources = await getSourcesForTenant(session.tenantId, tenant?.country ?? "IL");
  return apiJson({ sources });
});

const PutSchema = z.object({
  sources: z
    .array(
      z.object({
        sourceKey: z.string().min(1).max(40),
        sourceLabel: z.string().min(1).max(120),
        isActive: z.boolean(),
        sortOrder: z.number().int().min(0),
      }),
    )
    .max(40),
});

export const PUT = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const { sources } = PutSchema.parse(await req.json());
  await prisma.$transaction(
    sources.map((s) =>
      prisma.sourceSetting.updateMany({
        where: { tenantId: session.tenantId!, sourceKey: s.sourceKey },
        data: { sourceLabel: s.sourceLabel, isActive: s.isActive, sortOrder: s.sortOrder },
      }),
    ),
  );
  const updated = await getSourcesForTenant(session.tenantId);
  return apiJson({ sources: updated });
});
