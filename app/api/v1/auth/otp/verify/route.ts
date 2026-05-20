import { handler, apiJson, apiError } from "@/lib/api-response";
import { OtpVerifySchema } from "@/lib/validate";
import { verifyOtp } from "@/lib/auth/otp";
import { toE164 } from "@/lib/format";
import { prisma } from "@/lib/db/client";
import { issueTokensForCustomer, setSessionCookies } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req: Request) => {
  const body = OtpVerifySchema.parse(await req.json());
  const phone = toE164(body.phone);
  if (!phone) return apiError("validation_error", "מספר טלפון לא תקין", 422, "phone");

  const ok = await verifyOtp(phone, body.code);
  if (!ok) return apiError("invalid_otp", "קוד שגוי או פג תוקף", 401, "code");

  const customer = await prisma.customer.upsert({
    where: { phone },
    update: { lastSeenAt: new Date() },
    create: { phone, firstName: "", lastName: "" },
  });

  const { accessToken, refreshToken } = await issueTokensForCustomer(customer.id);
  const customerPayload = {
    id: customer.id,
    phone: customer.phone,
    first_name: customer.firstName,
    last_name: customer.lastName,
  };

  if (body.client_type === "web") {
    await setSessionCookies(accessToken, refreshToken);
    return apiJson({ customer: customerPayload });
  }
  return apiJson({
    access_token: accessToken,
    refresh_token: refreshToken,
    customer: customerPayload,
  });
});
