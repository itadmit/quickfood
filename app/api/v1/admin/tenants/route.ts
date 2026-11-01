import bcrypt from "bcryptjs";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { TenantCreateSchema } from "@/lib/validate";
import { isValidSlug } from "@/lib/slug";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  await requireAdmin();
  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      plan: { select: { name: true } },
      _count: { select: { orders: true } },
    },
  });
  return apiJson({
    tenants: tenants.map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      status: t.status,
      theme_id: t.themeId,
      cuisine_type: t.cuisineType,
      plan: t.plan?.name ?? null,
      orders_count: t._count.orders,
      created_at: t.createdAt.toISOString(),
    })),
  });
});

export const POST = handler(async (req: Request) => {
  await requireAdmin();
  const body = TenantCreateSchema.parse(await req.json());
  if (!isValidSlug(body.slug)) {
    return apiError("validation_error", "slug לא תקין", 422, "slug");
  }

  const existing = await prisma.tenant.findUnique({ where: { slug: body.slug } });
  if (existing) return apiError("validation_error", "slug כבר קיים", 409, "slug");

  // Owner email is globally unique (one merchant account per email). Guard it
  // the same way as the slug so a reused email returns a clear message instead
  // of a raw 500 from the nested create's P2002.
  const ownerEmail = body.owner.email.toLowerCase();
  const existingOwner = await prisma.merchantUser.findUnique({
    where: { email: ownerEmail },
  });
  if (existingOwner) {
    return apiError(
      "validation_error",
      "אימייל הבעלים כבר קיים במערכת (כל חנות דורשת אימייל ייחודי)",
      409,
      "email",
    );
  }

  const passwordHash = await bcrypt.hash(body.owner.password, 10);

  // Match self-serve signup: give the store a 7-day local trial and mark the
  // owner's email verified (an admin creating the store vouches for it).
  // Without these the tenant is born "ניסיון הסתיים" / "מייל לא אומת".
  const TRIAL_DAYS = 7;
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  const tenant = await prisma.tenant.create({
    data: {
      slug: body.slug,
      name: body.name,
      logoLetter: body.logo_letter,
      themeId: body.theme_id,
      businessType: body.business_type,
      cuisineType: body.cuisine_type,
      status: "active",
      trialEndsAt,
      branches: {
        create: [
          {
            name: body.branch.name,
            address: body.branch.address,
            phone: body.branch.phone,
            isPrimary: true,
            status: "open",
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
            serviceFee: 3,
          },
        ],
      },
      merchantUsers: {
        create: [
          {
            email: ownerEmail,
            passwordHash,
            name: body.owner.name,
            role: "owner",
            emailVerifiedAt: new Date(),
          },
        ],
      },
    },
  });

  return apiJson(
    {
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        status: tenant.status,
      },
    },
    201,
  );
});
