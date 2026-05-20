import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireSession } from "@/lib/auth/guards";
import { objectExists, publicUrlFor } from "@/lib/storage/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req: Request, { params }: { params: Promise<{ fileId: string }> }) => {
  await requireSession();
  const { fileId } = await params;
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  if (!key || !key.includes(fileId)) {
    return apiError("validation_error", "key parameter missing or mismatched", 422, "key");
  }
  const exists = await objectExists(key);
  if (!exists) return apiError("not_found", "קובץ לא נמצא ב-R2", 404);
  return apiJson({ url: publicUrlFor(key) });
});
