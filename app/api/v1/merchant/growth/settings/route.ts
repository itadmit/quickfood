import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { resolveGrowthSettings } from "@/lib/growth/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  commissionRate: z.number().min(0).max(100).optional(),
  perSourceRates: z.record(z.number().min(0).max(100)).optional(),
});

export const GET = handler(async () => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { growthSettings: true },
  });
  return apiJson({ settings: resolveGrowthSettings(tenant?.growthSettings) });
});

export const PATCH = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const body = Body.parse(await req.json());
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { growthSettings: true },
  });
  const current = resolveGrowthSettings(tenant?.growthSettings);
  const next = {
    commissionRate: body.commissionRate ?? current.commissionRate,
    perSourceRates: body.perSourceRates ?? current.perSourceRates,
  };
  await prisma.tenant.update({
    where: { id: session.tenantId },
    data: { growthSettings: next },
  });
  return apiJson({ settings: next });
});
