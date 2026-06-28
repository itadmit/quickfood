import { z } from "zod";
import { after } from "next/server";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { resolveTenantBySlug } from "@/lib/slug";
import { toE164 } from "@/lib/format";
import { ensureLoyaltyMember } from "@/lib/loyalty/membership";
import { recordAttribution } from "@/lib/growth/attribution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JoinSchema = z.object({
  tenant_slug: z.string().min(1),
  phone: z.string().optional(),
  first_name: z.string().max(40).optional(),
  last_name: z.string().max(40).optional(),
  email: z.string().email().optional(),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  marketing_consent: z.boolean().optional(),
  // Growth attribution captured at the loyalty-join (signup) moment.
  attribution_source: z.string().max(40).optional(),
  attribution_campaign_code: z.string().max(32).optional(),
});

/**
 * Storefront loyalty-club join (from the entry popup). Resolves or creates the
 * Customer by phone (or uses the logged-in customer session) and enrols them
 * into the tenant's club. Consent is required - the form's submit is gated on
 * the privacy/terms/marketing checkbox.
 */
export const POST = handler(async (req: Request) => {
  const body = JoinSchema.parse(await req.json());
  const session = await getSession();
  const isCustomer = session?.type === "customer";

  const tenant = await resolveTenantBySlug(body.tenant_slug);
  if (!tenant) return apiError("not_found", "מסעדה לא נמצאה", 404);

  let customerId: string | null = isCustomer ? session.userId : null;

  if (!customerId) {
    if (!body.phone) {
      return apiError("phone_required", "נדרש מספר טלפון", 422, "phone");
    }
    const phone = toE164(body.phone);
    if (!phone) {
      return apiError("invalid_phone", "מספר הטלפון אינו תקין. דוגמה: 050-1234567", 422, "phone");
    }
    const existing = await prisma.customer.findUnique({
      where: { phone },
      select: { id: true, firstName: true, lastName: true, email: true, birthday: true },
    });
    if (existing) {
      customerId = existing.id;
      const updates: Record<string, string> = {};
      if (!existing.firstName && body.first_name) updates.firstName = body.first_name;
      if (!existing.lastName && body.last_name) updates.lastName = body.last_name;
      if (!existing.email && body.email) updates.email = body.email.trim();
      if (!existing.birthday && body.birthday) updates.birthday = body.birthday;
      if (Object.keys(updates).length) {
        await prisma.customer.update({ where: { id: existing.id }, data: updates }).catch(() => {});
      }
    } else {
      try {
        const created = await prisma.customer.create({
          data: {
            phone,
            firstName: body.first_name ?? "",
            lastName: body.last_name ?? "",
            email: body.email?.trim() ?? null,
            birthday: body.birthday ?? null,
            marketingConsent: body.marketing_consent === true,
          },
          select: { id: true },
        });
        customerId = created.id;
      } catch {
        const retry = await prisma.customer.findUnique({
          where: { phone },
          select: { id: true },
        });
        if (retry) customerId = retry.id;
      }
    }
  }

  if (!customerId) return apiError("join_failed", "ההצטרפות נכשלה, נסו שוב", 500);

  await ensureLoyaltyMember({
    tenantId: tenant.id,
    customerId,
    joinSource: "popup",
    marketingConsent: body.marketing_consent === true,
  });

  // Attribution at the signup (loyalty-join) moment - sticky first-touch.
  if (body.attribution_source || body.attribution_campaign_code) {
    const cid = customerId;
    after(async () => {
      try {
        let campaignId: string | null = null;
        if (body.attribution_campaign_code) {
          const c = await prisma.qrCampaign.findUnique({
            where: { code: body.attribution_campaign_code },
            select: { id: true, tenantId: true },
          });
          if (c && c.tenantId === tenant.id) campaignId = c.id;
        }
        await recordAttribution({
          tenantId: tenant.id,
          source: body.attribution_source ?? "flyer",
          sourceLabel: body.attribution_source ? undefined : "QR",
          firstTouchType: "loyalty",
          customerId: cid,
          campaignId,
          selfReported: !body.attribution_campaign_code,
        });
      } catch {
        /* best-effort */
      }
    });
  }

  return apiJson({ ok: true }, 201);
});
