import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { hourly, type Range } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RANGES: Range[] = ["today", "yesterday", "7d", "30d", "custom"];

export const GET = handler(async (req: Request) => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const range = (new URL(req.url).searchParams.get("range") ?? "today") as Range;
  if (!RANGES.includes(range)) return apiError("validation_error", "range invalid", 422, "range");
  return apiJson(await hourly(session.tenantId, range));
});
