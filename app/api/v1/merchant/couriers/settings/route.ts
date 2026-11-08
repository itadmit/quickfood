import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { resolveCourierSkipAllowed } from "@/lib/messaging/notify-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({ allow_skip: z.boolean() });

export const GET = handler(async () => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { notifySettings: true },
  });
  return apiJson({ allow_skip: resolveCourierSkipAllowed(tenant?.notifySettings) });
});

export const PATCH = handler(async (req: Request) => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError("validation_error", "קלט לא תקין", 422);

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { notifySettings: true },
  });
  const stored =
    tenant?.notifySettings && typeof tenant.notifySettings === "object" && !Array.isArray(tenant.notifySettings)
      ? (tenant.notifySettings as Record<string, unknown>)
      : {};
  const prev =
    stored.courier_picker && typeof stored.courier_picker === "object"
      ? (stored.courier_picker as Record<string, unknown>)
      : {};
  await prisma.tenant.update({
    where: { id: session.tenantId },
    data: { notifySettings: { ...stored, courier_picker: { ...prev, allow_skip: parsed.data.allow_skip } } },
  });
  return apiJson({ allow_skip: parsed.data.allow_skip });
});
