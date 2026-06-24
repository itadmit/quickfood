/**
 * Birthday-coupon automation. Run once a day (QStash → /api/internal/loyalty/
 * birthday-coupons). For every loyalty member whose birthday is today and whose
 * club has the birthday benefit enabled, issue a unique single-use percent
 * coupon valid for one month, and - if the tenant has messaging credits - send
 * the configured birthday greeting over WhatsApp with the coupon code.
 *
 * Idempotent: the coupon code is deterministic per customer+year, so a re-run
 * (or a double daily tick) finds the existing coupon and skips it - no
 * duplicate coupons, no double greetings.
 */
import { CouponType } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { resolveLoyaltyConfig, renderBirthdayGreeting } from "@/lib/loyalty/config";
import { sendWhatsApp } from "@/lib/whatsapp/send";
import { formatDate } from "@/lib/format";

export interface BirthdayRunResult {
  date: string;
  matched: number;
  couponsCreated: number;
  greetingsSent: number;
}

/** Today as YYYY-MM-DD in Israel time, plus the bare MM-DD for matching. */
function israelToday(): { year: number; mmdd: string } {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [y, m, d] = ymd.split("-");
  return { year: Number(y), mmdd: `${m}-${d}` };
}

function birthdayCouponCode(customerId: string, year: number): string {
  const hex = customerId.replace(/-/g, "").slice(0, 8).toUpperCase();
  return `BDAY-${hex}-${year}`;
}

export async function issueBirthdayCoupons(): Promise<BirthdayRunResult> {
  const { year, mmdd } = israelToday();

  const members = await prisma.loyaltyMember.findMany({
    where: { customer: { birthday: { endsWith: `-${mmdd}` } } },
    select: {
      marketingConsent: true,
      customer: { select: { id: true, firstName: true, phone: true } },
      tenant: { select: { id: true, name: true, loyaltyConfig: true } },
    },
  });

  let couponsCreated = 0;
  let greetingsSent = 0;

  for (const m of members) {
    const config = resolveLoyaltyConfig(m.tenant.loyaltyConfig, m.tenant.name);
    if (!config.birthdayBenefit) continue;

    const code = birthdayCouponCode(m.customer.id, year);
    const tenantId = m.tenant.id;

    const already = await prisma.coupon.findUnique({
      where: { tenantId_code: { tenantId, code } },
      select: { id: true },
    });
    if (already) continue; // already issued this year - don't duplicate or re-send

    const validUntil = new Date();
    validUntil.setMonth(validUntil.getMonth() + 1);

    await prisma.coupon.create({
      data: {
        tenantId,
        code,
        description: "מתנת יום הולדת",
        type: CouponType.percent,
        value: config.birthdayDiscountPercent,
        usageLimit: 1,
        perCustomerLimit: 1,
        validUntil,
        active: true,
      },
    });
    couponsCreated++;

    // Send the greeting only with the member's marketing consent. sendWhatsApp
    // self-gates on the tenant's credit balance ("active messaging package"),
    // so when there are no credits it cleanly no-ops.
    if (m.marketingConsent && m.customer.phone) {
      const body = renderBirthdayGreeting(config.birthdayGreeting, {
        name: m.customer.firstName,
        business: m.tenant.name,
        coupon: code,
        expiry: formatDate(validUntil),
      });
      const res = await sendWhatsApp({
        tenantId,
        to: m.customer.phone,
        body,
        kind: "birthday",
      }).catch(() => null);
      if (res?.status === "sent") greetingsSent++;
    }
  }

  return { date: `${year}-${mmdd}`, matched: members.length, couponsCreated, greetingsSent };
}

/**
 * Delete birthday coupons that have expired (past validUntil) WITHOUT being
 * used. Redeemed ones (usageCount > 0) are kept so they stay in the merchant's
 * purchase/coupon history. Run on the same daily tick as issuing.
 */
export async function purgeExpiredBirthdayCoupons(): Promise<number> {
  const res = await prisma.coupon.deleteMany({
    where: {
      code: { startsWith: "BDAY-" },
      usageCount: 0,
      validUntil: { lt: new Date() },
    },
  });
  return res.count;
}
