import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { topItems, type Range } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RANGES: Range[] = ["today", "yesterday", "7d", "30d", "custom"];

export const GET = handler(async (req: Request) => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const url = new URL(req.url);
  const range = (url.searchParams.get("range") ?? "today") as Range;
  if (!RANGES.includes(range)) return apiError("validation_error", "range invalid", 422, "range");
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "5", 10)));
  return apiJson({ items: await topItems(session.tenantId, range, limit) });
});
