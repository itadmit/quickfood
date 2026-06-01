/**
 * POST /api/v1/customer/kiosk-lookup
 *
 * Used by the kiosk's phone-entry step to pre-fill the name screen. Body:
 *   { tenant_slug: string, phone: string }
 *
 * Only returns identifying info when the phone matches an existing
 * Customer row that has ALREADY ordered from THIS tenant — otherwise we
 * would leak a name to any kiosk that punched in a stranger's number.
 * The tenant must also have kioskEnabled=true.
 *
 * No PII is returned for "no match" — just `{ found: false }`. Even on a
 * match we return only first/last name; the email stays server-side and
 * is consumed by the invoice dispatcher.
 */

import { z } from "zod";
import { apiError, apiJson, handler } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";
import { toE164 } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  tenant_slug: z.string().min(1),
  phone: z.string().min(3).max(20),
});

export const POST = handler(async (req: Request) => {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return apiError("invalid_body", "פרטים לא תקינים", 422);

  const e164 = toE164(parsed.data.phone);
  if (!e164) {
    return apiError("invalid_phone", "מספר טלפון לא תקין", 422, "phone");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: parsed.data.tenant_slug },
    select: { id: true, kioskEnabled: true },
  });
  if (!tenant) return apiError("tenant_not_found", "מסעדה לא נמצאה", 404);
  if (!tenant.kioskEnabled) {
    return apiError("kiosk_disabled", "קיוסק לא פעיל", 403);
  }

  const customer = await prisma.customer.findUnique({
    where: { phone: e164 },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!customer) return apiJson({ found: false });

  // Privacy gate: only return the name if this customer has previously
  // placed at least one order at THIS tenant. A drive-by stranger's
  // number must NOT leak their name into a random kiosk.
  const hasPriorOrder = await prisma.order.findFirst({
    where: { customerId: customer.id, tenantId: tenant.id },
    select: { id: true },
  });
  if (!hasPriorOrder) return apiJson({ found: false });

  return apiJson({
    found: true,
    first_name: customer.firstName ?? "",
    last_name: customer.lastName ?? "",
  });
});
