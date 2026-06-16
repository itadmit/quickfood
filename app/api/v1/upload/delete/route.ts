import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/guards";
import { deleteObject, keyFromPublicUrl } from "@/lib/storage/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 25;

/**
 * Permanently delete an uploaded image from R2. Authorized by key scope:
 * upload keys are `${tenantId|userId}/${type}/...`, so a caller may only
 * delete objects under their own scope.
 */
export const POST = handler(async (req: Request) => {
  const session = await requireSession();
  const body = (await req.json().catch(() => ({}))) as { url?: string };
  const key = body.url ? keyFromPublicUrl(body.url) : null;
  if (!key) return apiError("validation_error", "כתובת תמונה לא תקינה", 422, "url");

  const scope = session.tenantId ?? session.userId;
  if (!key.startsWith(`${scope}/`)) {
    return apiError("forbidden", "אין הרשאה למחוק תמונה זו", 403);
  }

  await deleteObject(key);
  return apiJson({ ok: true });
});
