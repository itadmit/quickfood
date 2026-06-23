import { handler, apiJson, apiError } from "@/lib/api-response";
import { OtpRequestSchema } from "@/lib/validate";
import { issueOtp } from "@/lib/auth/otp";
import { sendOtpWhatsApp } from "@/lib/auth/send-otp-whatsapp";
import { findMerchantByPhone } from "@/lib/auth/merchant-by-phone";
import { prisma } from "@/lib/db/client";
import { toE164 } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Don't re-issue + re-send if a fresh code already went out this recently.
const RESEND_THROTTLE_MS = 45_000;

export const POST = handler(async (req: Request) => {
  const body = OtpRequestSchema.parse(await req.json());
  const phone = toE164(body.phone);
  if (!phone) return apiError("validation_error", "מספר טלפון לא תקין", 422, "phone");

  // Only merchants get a code. We always answer `sent:true` regardless, so the
  // endpoint can't be used to probe which numbers have an account.
  const merchant = await findMerchantByPhone(phone);
  if (!merchant) return apiJson({ sent: true });

  const recent = await prisma.otpCode.findFirst({
    where: {
      phone,
      usedAt: null,
      createdAt: { gt: new Date(Date.now() - RESEND_THROTTLE_MS) },
    },
    orderBy: { createdAt: "desc" },
  });
  if (recent) return apiJson({ sent: true });

  const { code } = await issueOtp(phone);
  await sendOtpWhatsApp(phone, code);

  return apiJson({ sent: true });
});
