/**
 * GET /api/v1/merchant/customers/export
 *
 * Downloads the restaurant's customer list as CSV (opens in Excel, Hebrew-safe
 * via a UTF-8 BOM). Same population as the Boost → לקוחות screen: every
 * customer with a real order at THIS tenant. Customers are platform-global, so
 * the list is always derived from the tenant's own orders - never from the
 * global customers table.
 *
 * Owner/manager only: the file carries personal data (phone, email).
 */
import { handler, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { getRepeatCustomers } from "@/lib/growth/customers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);

  const [{ rows }, tenant] = await Promise.all([
    getRepeatCustomers(session.tenantId, Number.MAX_SAFE_INTEGER),
    prisma.tenant.findUnique({ where: { id: session.tenantId }, select: { slug: true } }),
  ]);

  const extra = await prisma.customer.findMany({
    where: { id: { in: rows.map((r) => r.customerId) } },
    select: { id: true, marketingConsent: true, birthday: true },
  });
  const extraById = new Map(extra.map((c) => [c.id, c]));

  const headers = [
    "שם",
    "טלפון",
    "אימייל",
    "מספר הזמנות",
    "סה״כ הזמנות (₪)",
    "הזמנה ראשונה",
    "הזמנה אחרונה",
    "ימים מההזמנה האחרונה",
    "חבר מועדון",
    "אישר דיוור",
    "יום הולדת",
    "מקור הגעה",
  ];

  const lines = rows
    .slice()
    .sort((a, b) => b.lastOrderAt.localeCompare(a.lastOrderAt))
    .map((r) => {
      const x = extraById.get(r.customerId);
      return [
        r.name,
        r.phone,
        r.email ?? "",
        String(r.orderCount),
        String(r.totalSpent),
        day(r.firstOrderAt),
        day(r.lastOrderAt),
        String(r.daysSinceOrder),
        r.isMember ? "כן" : "לא",
        x?.marketingConsent ? "כן" : "לא",
        x?.birthday ?? "",
        r.sourceLabel ?? "",
      ];
    });

  const body = [headers, ...lines].map((r) => r.map(csvCell).join(",")).join("\r\n");
  const csv = "﻿" + body;

  const stamp = new Date().toISOString().slice(0, 10);
  const base = (tenant?.slug || "store").replace(/[^a-z0-9-]/gi, "-");
  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="customers-${base}-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
});

function day(iso: string): string {
  return new Date(iso).toLocaleDateString("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Quote for CSV and neutralise spreadsheet formulas: a name like `=HYPERLINK(...)`
 * typed by a customer must not execute when the merchant opens the file.
 * Phone numbers such as `+972...` are left as-is.
 */
function csvCell(v: string): string {
  let s = v ?? "";
  if (/^[=+\-@\t\r]/.test(s) && !/^\+?\d[\d\s-]*$/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
