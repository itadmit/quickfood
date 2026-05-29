import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireCourier } from "@/lib/auth/courier-session";
import { uploadBytes } from "@/lib/storage/r2";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 4 * 1024 * 1024;

export const POST = handler(async (req: Request) => {
  const session = await requireCourier();
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.startsWith("multipart/form-data")) {
    return apiError("validation_error", "נדרש multipart/form-data", 415);
  }
  const form = await req.formData();
  const file = form.get("file");
  const orderId = form.get("order_id");
  if (!(file instanceof Blob)) return apiError("validation_error", "חסר קובץ", 422);
  if (typeof orderId !== "string" || !orderId) {
    return apiError("validation_error", "חסר order_id", 422);
  }
  if (file.size > MAX_BYTES) {
    return apiError("payload_too_large", "התמונה גדולה מ-4MB", 413);
  }
  const type = file.type || "image/jpeg";
  if (!type.startsWith("image/")) {
    return apiError("validation_error", "סוג קובץ לא נתמך", 422);
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { courierId: true },
  });
  if (!order || order.courierId !== session.courierId) {
    return apiError("forbidden", "ההזמנה אינה משויכת לך", 403);
  }

  const ext = type.split("/")[1]?.split(";")[0] ?? "jpg";
  const key = `delivery-proof/${session.courierId}/${orderId}/${Date.now()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const url = await uploadBytes({
    key,
    body: bytes,
    contentType: type,
    cacheControl: "private, max-age=86400",
  });
  return apiJson({ url });
});
