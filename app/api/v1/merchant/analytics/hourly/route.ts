import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { hourly, parseCustomBounds, type Range } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RANGES: Range[] = ["today", "yesterday", "7d", "30d", "this_month", "last_month", "custom"];

export const GET = handler(async (req: Request) => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const url = new URL(req.url);
  const range = (url.searchParams.get("range") ?? "today") as Range;
  if (!RANGES.includes(range)) return apiError("validation_error", "range invalid", 422, "range");
  let custom;
  if (range === "custom") {
    custom = parseCustomBounds(url.searchParams.get("from"), url.searchParams.get("to"));
    if (!custom) return apiError("validation_error", "from/to invalid (YYYY-MM-DD, from <= to, not future)", 422, "from");
  }
  return apiJson(await hourly(session.tenantId, range, custom ?? undefined));
});
