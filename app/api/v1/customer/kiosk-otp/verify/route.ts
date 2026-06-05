/**
 * POST /api/v1/customer/kiosk-otp/verify
 *
 * Validates the 6-digit OTP code the customer typed on the kiosk after
 * receiving it via WhatsApp/SMS. UNLIKE the storefront `/api/v1/auth/otp/verify`,
 * this endpoint does NOT create a session or attach the order to a
 * Customer row - the kiosk runs anonymously. We only return `{ ok: true }`
 * so the client can proceed to the next step (Customer-by-phone lookup
 * + name screen).
 */

import { z } from "zod";
import { apiError, apiJson, handler } from "@/lib/api-response";
import { toE164 } from "@/lib/format";
import { verifyOtp } from "@/lib/auth/otp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  phone: z.string().min(3).max(20),
  code: z.string().regex(/^\d{4,6}$/, "קוד חייב להיות 4-6 ספרות"),
});

export const POST = handler(async (req: Request) => {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return apiError("invalid_body", "פרטים לא תקינים", 422);
  }
  const e164 = toE164(parsed.data.phone);
  if (!e164) {
    return apiError("invalid_phone", "מספר טלפון לא תקין", 422, "phone");
  }

  const ok = await verifyOtp(e164, parsed.data.code);
  if (!ok) {
    return apiError("invalid_otp", "קוד שגוי או פג תוקף", 401, "code");
  }
  return apiJson({ ok: true });
});
