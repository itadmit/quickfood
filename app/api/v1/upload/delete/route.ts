import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { deleteObject, keyFromPublicUrl } from "@/lib/storage/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 25;

/**
 * Permanently delete an uploaded image from R2. Authorized by key scope:
 * direct uploads live under `${tenantId|userId}/${type}/...`, while
 * Wolt-imported images live under `tenants/${tenantId}/wolt-import/...`
 * (see lib/wolt-import/commit). A caller may only delete objects under
 * their own tenant/user scope, in either form.
 */
export const POST = handler(async (req: Request) => {
  const session = await requireSession();
  const body = (await req.json().catch(() => ({}))) as { url?: string };
  const url = body.url ?? "";
  const key = url ? keyFromPublicUrl(url) : null;
  if (!key) return apiError("validation_error", "כתובת תמונה לא תקינה", 422, "url");

  const scope = session.tenantId ?? session.userId;
  const allowed =
    key.startsWith(`${scope}/`) ||
    (!!session.tenantId && key.startsWith(`tenants/${session.tenantId}/`));
  if (!allowed) {
    return apiError("forbidden", "אין הרשאה למחוק תמונה זו", 403);
  }

  // Duplicated items (and older duplicates that predate copy-on-duplicate)
  // can share one R2 object. The uploader calls this BEFORE the record
  // saves, so the caller's own reference is still in the DB - more than one
  // referencing record means someone else still needs the file: drop only
  // the caller's reference (client side) and keep the object.
  if (session.tenantId) {
    const [itemRefs, optionRefs, setOptionRefs] = await Promise.all([
      prisma.menuItem.count({
        where: {
          tenantId: session.tenantId,
          OR: [{ imageUrl: url }, { images: { has: url } }],
        },
      }),
      prisma.itemOption.count({
        where: { imageUrl: url, group: { item: { tenantId: session.tenantId } } },
      }),
      prisma.modifierSetOption.count({
        where: { imageUrl: url, set: { tenantId: session.tenantId } },
      }),
    ]);
    if (itemRefs + optionRefs + setOptionRefs > 1) {
      return apiJson({ ok: true, kept: true });
    }
  }

  await deleteObject(key);
  return apiJson({ ok: true });
});
