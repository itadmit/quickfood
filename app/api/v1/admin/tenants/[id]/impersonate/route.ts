import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { signAccess } from "@/lib/auth/jwt";
import {
  issueTokensForMerchant,
  setSessionCookies,
  setAdminReturnCookie,
} from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Start impersonating a tenant - the platform admin "logs in as" the store's
 * owner. The admin's own session is stashed (signed) in a separate cookie so
 * they can return; the live session cookies are swapped to the owner. The
 * dashboard shows a banner with a "return to admin" action.
 */
export const POST = handler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireAdmin();
    const { id } = await params;

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!tenant) return apiError("not_found", "מסעדה לא נמצאה", 404);

    const owner =
      (await prisma.merchantUser.findFirst({
        where: { tenantId: id, role: "owner" },
        select: { id: true, role: true, tenantId: true },
      })) ??
      (await prisma.merchantUser.findFirst({
        where: { tenantId: id },
        select: { id: true, role: true, tenantId: true },
      }));
    if (!owner) return apiError("not_found", "אין משתמש מחובר לחנות הזו", 404);

    // Stash the admin's identity (signed) so /impersonate/stop can restore it.
    const adminToken = await signAccess({
      sub: session.userId,
      typ: "merchant",
      role: session.role ?? "platform_admin",
      tid: session.tenantId,
    });
    await setAdminReturnCookie(adminToken);

    const { accessToken, refreshToken } = await issueTokensForMerchant(
      owner.id,
      owner.tenantId ?? null,
      owner.role,
    );
    await setSessionCookies(accessToken, refreshToken);

    return apiJson({ redirect: "/dashboard" });
  },
);
