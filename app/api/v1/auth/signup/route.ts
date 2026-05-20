import { z } from "zod";
import bcrypt from "bcryptjs";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";
import { isValidSlug } from "@/lib/slug";
import { issueTokensForMerchant, setSessionCookies } from "@/lib/auth/session";

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
    return apiJson({ user: userPayload, redirect: "/dashboard/orders" }, 201);
  }
  return apiJson(
    { access_token: accessToken, refresh_token: refreshToken, user: userPayload },
    201,
  );
});
