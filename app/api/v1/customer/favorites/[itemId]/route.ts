import { handler, apiJson, apiError } from "@/lib/api-response";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Toggle a favorite. Customers-only - guests don't have anywhere to
 * persist the favorite to. The composite (customerId, itemId) PK on
 * Favorite means we can use a single upsert / delete without an
 * existence-check round-trip; we use deleteMany so a "remove" call is
 * a no-op if it wasn't there to begin with.
 */
export const POST = handler(async (_req, { params }: { params: Promise<{ itemId: string }> }) => {
  const session = await getSession();
  if (!session || session.type !== "customer") {
    return apiError("auth_required", "צריך להתחבר כדי לסמן מועדפים", 401);
  }
  const { itemId } = await params;

  // Item must exist - protects against a spam attacker creating phantom
  // favorites for IDs that don't belong to any tenant.
  const item = await prisma.menuItem.findUnique({
    where: { id: itemId },
    select: { id: true },
  });
  if (!item) return apiError("not_found", "פריט לא נמצא", 404);

  // Toggle: add if missing, remove if present. Two short queries beat a
  // race-prone "check then act."
  const existing = await prisma.favorite.findUnique({
    where: { customerId_itemId: { customerId: session.userId, itemId } },
    select: { customerId: true },
  });

  if (existing) {
    await prisma.favorite.delete({
      where: { customerId_itemId: { customerId: session.userId, itemId } },
    });
    return apiJson({ favorited: false });
  }

  await prisma.favorite.create({
    data: { customerId: session.userId, itemId },
  });
  return apiJson({ favorited: true });
});

export const DELETE = handler(async (_req, { params }: { params: Promise<{ itemId: string }> }) => {
  const session = await getSession();
  if (!session || session.type !== "customer") {
    return apiError("auth_required", "צריך להתחבר", 401);
  }
  const { itemId } = await params;
  await prisma.favorite.deleteMany({
    where: { customerId: session.userId, itemId },
  });
  return apiJson({ ok: true });
});
