import { z } from "zod";
import bcrypt from "bcryptjs";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";
import { isValidSlug } from "@/lib/slug";
import { issueTokensForMerchant, setSessionCookies } from "@/lib/auth/session";
import { createCustomer, BillingHubError } from "@/lib/billing-hub/client";
import { sendEmail } from "@/lib/email/send";
import { welcomeEmail, merchantSignupAdminEmail } from "@/lib/email/templates";
import { verifyPhoneVerify } from "@/lib/auth/jwt";
import { toE164 } from "@/lib/format";
import { publish } from "@/lib/qstash/client";
import { readFbCookies } from "@/lib/fb/capi";
import { after } from "next/server";

const TRIAL_DAYS = 7;

// Platform owner addresses notified on every new merchant signup. Env override
// (comma-separated) wins; otherwise fall back to the two default inboxes.
const ADMIN_SIGNUP_NOTIFY = (
  process.env.ADMIN_SIGNUP_NOTIFY_EMAILS ?? "itadmit@gmail.com,0547359@gmail.com"
)
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DayHoursSchema = z.object({
  open: z.string().regex(/^\d{2}:\d{2}$/),
  close: z.string().regex(/^\d{2}:\d{2}$/),
  active: z.boolean(),
});
const HoursMapSchema = z.object({
  sunday: DayHoursSchema,
  monday: DayHoursSchema,
  tuesday: DayHoursSchema,
  wednesday: DayHoursSchema,
  thursday: DayHoursSchema,
  friday: DayHoursSchema,
  saturday: DayHoursSchema,
});

// Hebrew error messages on every constraint - the generic Zod fallback
// ("String must contain at least 2 character(s)") used to surface raw
// into the signup UI, and a merchant who forgot to fill business_name
// would see that English string under the phone field with no clue
// which input was wrong.
const SignupSchema = z.object({
  business_name: z
    .string({ required_error: "שם העסק חסר" })
    .min(2, "שם העסק חייב להכיל לפחות 2 תווים")
    .max(120, "שם העסק ארוך מדי"),
  slug: z
    .string({ required_error: "כתובת באתר חסרה" })
    .min(2, "כתובת באתר חייבת להכיל לפחות 2 תווים")
    .max(40, "כתובת באתר ארוכה מדי")
    .regex(/^[a-z0-9-]+$/, "כתובת באתר באנגלית בלבד - אותיות קטנות, ספרות ומקפים"),
  business_type: z
    .enum([
      "pizza",
      "burger",
      "falafel",
      "shawarma",
      "sushi",
      "asian",
      "bakery",
      "cafe",
      "icecream",
      "mediterranean",
      "general",
    ])
    .default("general"),
  theme_id: z
    .enum(["fresh", "basil", "forest", "olive", "tomato", "charcoal", "cobalt", "sunflower", "apricot"])
    .default("fresh"),
  cuisine_type: z.string().max(60, "סוג מטבח ארוך מדי").optional(),
  branch_address: z
    .string({ required_error: "כתובת הסניף חסרה" })
    .min(2, "כתובת הסניף חייבת להכיל לפחות 2 תווים")
    .max(200, "כתובת הסניף ארוכה מדי"),
  branch_phone: z
    .string({ required_error: "מספר טלפון חסר" })
    .min(7, "מספר טלפון חייב להכיל לפחות 7 ספרות")
    .max(20, "מספר טלפון ארוך מדי"),
  owner_name: z
    .string({ required_error: "שם הבעלים חסר" })
    .min(1, "שם הבעלים חסר")
    .max(80, "שם ארוך מדי"),
  owner_phone: z
    .string({ required_error: "מספר נייד חסר" })
    .min(7, "מספר טלפון חייב להכיל לפחות 7 ספרות")
    .max(20, "מספר טלפון ארוך מדי"),
  owner_email: z
    .string({ required_error: "כתובת מייל חסרה" })
    .email("כתובת מייל לא תקינה"),
  owner_password: z
    .string({ required_error: "סיסמה חסרה" })
    .min(8, "סיסמה חייבת להכיל לפחות 8 תווים")
    .max(128, "סיסמה ארוכה מדי"),
  // Proof the owner's mobile passed SMS-OTP (from /auth/signup-otp/verify).
  // The account cannot be created without it.
  phone_verify_token: z
    .string({ required_error: "יש לאמת את מספר הנייד" })
    .min(10, "יש לאמת את מספר הנייד"),
  client_type: z.enum(["web", "mobile"]).default("web"),

  // Optional fields populated by the signup wizard's Wolt pre-step.
  // Each field is opt-in (the mapping UI lets the merchant tick which
  // fields to keep from Wolt) - anything omitted falls back to either
  // an empty value or the signup default (e.g. default hours).
  logo_url: z.string().url().optional().nullable(),
  cover_image_url: z.string().url().optional().nullable(),
  about: z.string().max(2000).optional().nullable(),
  hours: HoursMapSchema.optional().nullable(),
});

const RESERVED_SLUGS = new Set([
  "admin",
  "dashboard",
  "api",
  "signup",
  "login",
  "about",
  "pricing",
  "support",
  "help",
  "docs",
  "www",
  "app",
  "auth",
  "pay",
  "_next",
]);

export const POST = handler(async (req: Request) => {
  const body = SignupSchema.parse(await req.json());

  if (!isValidSlug(body.slug) || RESERVED_SLUGS.has(body.slug)) {
    return apiError("validation_error", "Slug שמור או לא תקין", 422, "slug");
  }

  // Hard gate: the personal mobile must have passed SMS-OTP, and the verified
  // number must be the same one we're about to store on the owner account.
  const phoneClaims = await verifyPhoneVerify(body.phone_verify_token);
  const ownerE164 = toE164(body.owner_phone);
  if (!phoneClaims || !ownerE164 || phoneClaims.phone !== ownerE164) {
    return apiError(
      "phone_not_verified",
      "יש לאמת את מספר הנייד בקוד שנשלח ב-SMS",
      422,
      "owner_phone",
    );
  }

  // Uniqueness checks
  const [existingTenant, existingUser] = await Promise.all([
    prisma.tenant.findUnique({ where: { slug: body.slug } }),
    prisma.merchantUser.findUnique({ where: { email: body.owner_email.toLowerCase() } }),
  ]);
  if (existingTenant) {
    return apiError("validation_error", "ה-slug תפוס כבר", 409, "slug");
  }
  if (existingUser) {
    return apiError("validation_error", "אימייל כבר רשום במערכת", 409, "owner_email");
  }

  const passwordHash = await bcrypt.hash(body.owner_password, 10);
  const logoLetter = body.business_name.trim().slice(0, 1);

  const branchHours = body.hours ?? {
    sunday: { open: "11:00", close: "23:00", active: true },
    monday: { open: "11:00", close: "23:00", active: true },
    tuesday: { open: "11:00", close: "23:00", active: true },
    wednesday: { open: "11:00", close: "23:00", active: true },
    thursday: { open: "11:00", close: "00:00", active: true },
    friday: { open: "11:00", close: "16:00", active: true },
    saturday: { open: "20:00", close: "01:00", active: true },
  };

  const tenant = await prisma.tenant.create({
    data: {
      slug: body.slug,
      name: body.business_name,
      logoLetter,
      logoUrl: body.logo_url ?? undefined,
      coverImage: body.cover_image_url ?? undefined,
      about: body.about ?? undefined,
      themeId: body.theme_id,
      businessType: body.business_type,
      cuisineType: body.cuisine_type,
      status: "active",
      branches: {
        create: [
          {
            name: "סניף ראשי",
            address: body.branch_address,
            phone: body.branch_phone,
            isPrimary: true,
            status: "open",
            hours: branchHours,
            minOrder: 60,
            deliveryFee: 14,
            serviceFee: 0,
          },
        ],
      },
      merchantUsers: {
        create: [
          {
            email: body.owner_email.toLowerCase(),
            passwordHash,
            name: body.owner_name,
            phone: body.owner_phone,
            role: "owner",
            // Identity is now proven by SMS-OTP on the mobile, not by an
            // email round-trip. Mark verified so the email-verification
            // gate (dashboard banner / billing) treats the account as live.
            emailVerifiedAt: new Date(),
          },
        ],
      },
    },
    include: {
      merchantUsers: { take: 1 },
    },
  });

  const owner = tenant.merchantUsers[0];
  const { accessToken, refreshToken } = await issueTokensForMerchant(
    owner.id,
    tenant.id,
    "owner",
  );

  // Start a 7-day local trial. The merchant gets full dashboard access
  // immediately; SMS purchases are gated behind billing setup, and after
  // the trial expires the whole dashboard locks until they pay.
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  // Stash the Meta browser/click ids so the server-side Purchase event (fired
  // later from the billing webhook, which has no browser context) can match
  // the payment back to this signup.
  const { fbp, fbc } = readFbCookies(req.headers.get("cookie"));

  // Create the billing-hub customer up-front so we have an id to reference
  // when the merchant later clicks "complete billing setup". Best-effort -
  // signup must not fail just because the hub is briefly unreachable.
  try {
    const customer = await createCustomer({
      email: body.owner_email.toLowerCase(),
      name: body.business_name,
      external_id: tenant.id,
      external_slug: tenant.slug,
      metadata: { tenant_id: tenant.id },
    });
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { billingCustomerId: customer.id, trialEndsAt, fbp, fbc },
    });
  } catch (err) {
    if (err instanceof BillingHubError) {
      console.warn("[signup] billing-hub customer create failed", err.status, err.code, err.message);
    } else {
      console.warn("[signup] billing-hub customer create threw", err);
    }
    // Even if the hub call failed, we still want the local trial to start.
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { trialEndsAt, fbp, fbc },
    });
  }

  // Welcome + admin-notify emails - fire-and-forget; signup must not fail
  // if Resend hiccups. The account is already active (phone verified via
  // SMS-OTP), so the email is a plain contact channel - no "activate" link.
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://quickfood.co.il").replace(/\/$/, "");
  after(async () => {
    try {
      const { html, text } = welcomeEmail({
        ownerName: owner.name,
        businessName: tenant.name,
        dashboardUrl: `${appUrl}/dashboard`,
      });
      await sendEmail({
        tenantId: tenant.id,
        to: owner.email,
        subject: `ברוכים הבאים ל-QuickFood, ${tenant.name}!`,
        body: text,
        html,
        kind: "welcome",
        refKind: "merchant_user",
        refId: owner.id,
      });
    } catch (err) {
      console.warn("[signup] welcome email failed", err);
    }
    try {
      const { html, text } = merchantSignupAdminEmail({
        businessName: tenant.name,
        slug: tenant.slug,
        ownerName: owner.name,
        ownerEmail: owner.email,
        ownerPhone: body.owner_phone,
        branchAddress: body.branch_address,
        branchPhone: body.branch_phone,
        businessType: body.business_type,
        storeUrl: `${appUrl}/s/${tenant.slug}`,
      });
      for (const to of ADMIN_SIGNUP_NOTIFY) {
        await sendEmail({
          tenantId: null,
          to,
          subject: `סוחר חדש נרשם: ${tenant.name}`,
          body: text,
          html,
          kind: "admin_signup_notify",
          refKind: "tenant",
          refId: tenant.id,
        });
      }
    } catch (err) {
      console.warn("[signup] admin notify email failed", err);
    }
    // One hour after signup, a QStash job checks where the merchant got to
    // (menu started? clearing connected?) and sends a tailored follow-up.
    try {
      await publish({
        url: `${appUrl}/api/internal/jobs/send-signup-followup`,
        body: { tenantId: tenant.id },
        delay: 60 * 60,
        deduplicationId: `signup-followup:${tenant.id}`,
      });
    } catch (err) {
      console.warn("[signup] follow-up email schedule failed", err);
    }
  });

  const userPayload = {
    id: owner.id,
    email: owner.email,
    name: owner.name,
    role: owner.role,
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      themeId: tenant.themeId,
    },
  };

  if (body.client_type === "web") {
    await setSessionCookies(accessToken, refreshToken);
    return apiJson(
      { user: userPayload, redirect: "/dashboard" },
      201,
    );
  }
  return apiJson(
    { access_token: accessToken, refresh_token: refreshToken, user: userPayload },
    201,
  );
});
