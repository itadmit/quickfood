import { z } from "zod";
import bcrypt from "bcryptjs";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";
import { isValidSlug } from "@/lib/slug";
import { issueTokensForMerchant, setSessionCookies } from "@/lib/auth/session";
import { createCustomer, BillingHubError } from "@/lib/billing-hub/client";
import { sendEmail } from "@/lib/email/send";
import { welcomeEmail } from "@/lib/email/templates";

const TRIAL_DAYS = 7;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SignupSchema = z.object({
  business_name: z.string().min(2).max(120),
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "slug: lowercase letters, digits and hyphens only"),
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
    .enum(["fresh", "basil", "forest", "olive", "tomato", "charcoal", "cobalt"])
    .default("fresh"),
  cuisine_type: z.string().max(60).optional(),
  branch_address: z.string().min(2).max(200),
  branch_phone: z.string().min(7).max(20),
  owner_name: z.string().min(1).max(80),
  owner_email: z.string().email(),
  owner_password: z.string().min(8).max(128),
  client_type: z.enum(["web", "mobile"]).default("web"),
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

  const tenant = await prisma.tenant.create({
    data: {
      slug: body.slug,
      name: body.business_name,
      logoLetter,
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
            status: "closed", // start closed until they finish setup
            hours: {
              sunday: { open: "11:00", close: "23:00", active: true },
              monday: { open: "11:00", close: "23:00", active: true },
              tuesday: { open: "11:00", close: "23:00", active: true },
              wednesday: { open: "11:00", close: "23:00", active: true },
              thursday: { open: "11:00", close: "00:00", active: true },
              friday: { open: "11:00", close: "16:00", active: true },
              saturday: { open: "20:00", close: "01:00", active: true },
            },
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
            role: "owner",
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

  // Create the billing-hub customer up-front so we have an id to reference
  // when the merchant later clicks "complete billing setup". Best-effort —
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
      data: { billingCustomerId: customer.id, trialEndsAt },
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
      data: { trialEndsAt },
    });
  }

  // Welcome email — fire-and-forget; signup must not fail if Resend hiccups.
  void (async () => {
    try {
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://quickfood.co.il").replace(/\/$/, "");
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
  })();

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
