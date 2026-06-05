import { z } from "zod";
import bcrypt from "bcryptjs";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { createCourierMagicLink } from "@/lib/courier-magic-link";
import { sendEmail } from "@/lib/email/send";
import { courierWelcomeEmail } from "@/lib/email/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CourierInput = z.object({
  name: z.string().min(1).max(80),
  phone: z.string().min(7).max(20),
  email: z.string().email().max(160),
  pin: z.string().regex(/^\d{4,6}$/, "PIN חייב להיות 4-6 ספרות"),
  vehicle: z.enum(["scooter", "bike", "car", "walking"]).default("scooter"),
  max_concurrent: z.number().int().min(1).max(10).optional(),
  branch_id: z.string().uuid().optional(),
});

export const GET = handler(async () => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const couriers = await prisma.courier.findMany({
    where: { tenantId: session.tenantId, active: true },
    orderBy: { createdAt: "desc" },
  });
  return apiJson({
    couriers: couriers.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      has_login: !!c.pinHash,
      vehicle: c.vehicle,
      status: c.status,
      current_order_id: c.currentOrderId,
      max_concurrent: c.maxConcurrent,
      cash_on_hand: c.cashOnHand,
      tips_on_hand: c.tipsOnHand,
      tips_owed: c.tipsOwed,
      last_seen_at: c.lastSeenAt?.toISOString() ?? null,
      rating_avg: Number(c.ratingAvg),
      deliveries_today: c.deliveriesToday,
      created_at: c.createdAt.toISOString(),
    })),
  });
});

export const POST = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const body = CourierInput.parse(await req.json());
  const email = body.email.trim().toLowerCase();
  const phone = body.phone.replace(/[^\d]/g, "");

  const dup = await prisma.courier.findFirst({
    where: { email },
    select: { id: true },
  });
  if (dup) return apiError("conflict", "כבר קיים שליח עם המייל הזה", 409, "email");

  let branchId = body.branch_id;
  if (!branchId) {
    const primary = await prisma.branch.findFirst({
      where: { tenantId: session.tenantId, isPrimary: true },
      select: { id: true },
    });
    branchId = primary?.id;
  }

  const pinHash = await bcrypt.hash(body.pin, 10);
  const courier = await prisma.courier.create({
    data: {
      tenantId: session.tenantId,
      branchId: branchId ?? null,
      name: body.name.trim(),
      phone,
      email,
      pinHash,
      vehicle: body.vehicle,
      maxConcurrent: body.max_concurrent ?? 3,
      status: "offline",
      active: true,
    },
  });

  // Best-effort welcome email - magic-link (single-click sign-in) +
  // long-term credentials so the courier always has the PIN on file.
  // Failures here never block courier creation.
  if (courier.email) {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: session.tenantId },
        select: { name: true },
      });
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
      const { url: loginUrl, ttlMinutes } = await createCourierMagicLink(courier.id, baseUrl);
      const { html, text } = courierWelcomeEmail({
        courierName: courier.name,
        businessName: tenant?.name ?? "QuickFood",
        loginUrl,
        loginIdentifier: courier.email,
        pin: body.pin,
        ttlMinutes,
        appUrl: `${baseUrl.replace(/\/$/, "")}/courier/login`,
      });
      await sendEmail({
        tenantId: session.tenantId,
        to: courier.email,
        subject: `נוצר לך חשבון שליח אצל ${tenant?.name ?? "QuickFood"}`,
        body: text,
        html,
        fromName: tenant?.name ?? "QuickFood",
        kind: "courier_welcome",
        refKind: "courier",
        refId: courier.id,
      });
    } catch (err) {
      console.warn("[couriers] welcome email failed", err);
    }
  }

  return apiJson(
    { courier: { id: courier.id, name: courier.name, email: courier.email, status: courier.status } },
    201,
  );
});
