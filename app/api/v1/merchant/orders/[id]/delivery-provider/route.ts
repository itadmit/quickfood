import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { providerMeta, type DeliveryProviderId } from "@/lib/delivery-providers/catalog";
import { dispatchOrderToProvider } from "@/lib/delivery-providers/dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({ provider: z.string() });

export const POST = handler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireMerchant();
    const { id } = await params;
    const parsed = Schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success || !providerMeta(parsed.data.provider)) {
      return apiError("validation_error", "חברת משלוחים לא מוכרת", 422, "provider");
    }

    const order = await prisma.order.findUnique({ where: { id }, select: { tenantId: true } });
    if (!order) return apiError("not_found", "הזמנה לא נמצאה", 404);
    if (session.role !== "platform_admin" && order.tenantId !== session.tenantId) {
      return apiError("forbidden", "אין הרשאה", 403);
    }

    const result = await dispatchOrderToProvider(id, parsed.data.provider as DeliveryProviderId, "manual");
    if (!result.ok) {
      const status = result.code === "not_found" ? 404 : result.code === "send_failed" ? 502 : 422;
      return apiError(result.code, result.message, status);
    }
    return apiJson({ ok: true, already_sent: result.alreadySent, provider: parsed.data.provider });
  },
);
