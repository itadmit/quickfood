import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { createCourierMagicLink } from "@/lib/courier-magic-link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireMerchant(["owner", "manager"]);
    if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
    const { id } = await params;
    const courier = await prisma.courier.findUnique({
      where: { id },
      select: { tenantId: true, active: true },
    });
    if (!courier) return apiError("not_found", "שליח לא נמצא", 404);
    if (courier.tenantId !== session.tenantId) {
      return apiError("forbidden", "אין הרשאה", 403);
    }
    if (!courier.active) {
      return apiError("validation_error", "השליח מושבת", 422);
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
    const { url, expiresAt, ttlMinutes } = await createCourierMagicLink(id, baseUrl);
    return apiJson({ url, expires_at: expiresAt.toISOString(), ttl_minutes: ttlMinutes });
  },
);
