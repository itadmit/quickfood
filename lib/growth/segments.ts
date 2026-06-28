import { prisma } from "@/lib/db/client";
import { loadRealOrders, aggregateByCustomer } from "./analytics";

const DAY_MS = 24 * 60 * 60 * 1000;

export const GROWTH_SEGMENTS = [
  "inactive_30d",
  "inactive_60d",
  "repeat",
  "birthday_today",
  "all_direct",
] as const;
export type GrowthSegment = (typeof GROWTH_SEGMENTS)[number];

export const SEGMENT_LABELS: Record<GrowthSegment, string> = {
  inactive_30d: "לא הזמינו 30 יום",
  inactive_60d: "לא הזמינו 60 יום",
  repeat: "לקוחות חוזרים (2+)",
  birthday_today: "ימי הולדת היום",
  all_direct: "כל הלקוחות הישירים",
};

export interface Recipient {
  customerId: string;
  name: string;
  phone: string;
  email: string | null;
}

/**
 * Resolve the recipients for a Growth segment. ALWAYS filters by
 * Customer.marketingConsent === true - we only message customers who opted in,
 * never the whole order history. Also filters to those who have the contact
 * field for the chosen channel (phone for sms/whatsapp, email for email).
 */
export async function getSegmentRecipients(
  tenantId: string,
  segment: GrowthSegment,
  channel: "email" | "sms" | "whatsapp",
): Promise<Recipient[]> {
  const now = Date.now();
  const orders = await loadRealOrders(tenantId);
  const byCustomer = aggregateByCustomer(orders);

  // Candidate customer ids per segment (before consent / contact filtering).
  const candidates: string[] = [];
  for (const [id, agg] of byCustomer) {
    const days = (now - agg.lastOrderAt.getTime()) / DAY_MS;
    switch (segment) {
      case "inactive_30d":
        if (days >= 30) candidates.push(id);
        break;
      case "inactive_60d":
        if (days >= 60) candidates.push(id);
        break;
      case "repeat":
        if (agg.orderCount > 1) candidates.push(id);
        break;
      case "all_direct":
        candidates.push(id);
        break;
      case "birthday_today":
        candidates.push(id); // birthday match applied below (needs Customer.birthday)
        break;
    }
  }
  if (candidates.length === 0) return [];

  const customers = await prisma.customer.findMany({
    where: { id: { in: candidates }, marketingConsent: true },
    select: { id: true, firstName: true, lastName: true, phone: true, email: true, birthday: true },
  });

  const today = new Date(now);
  const mmdd = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return customers
    .filter((c) => {
      if (segment === "birthday_today") {
        return c.birthday && c.birthday.slice(5) === mmdd;
      }
      return true;
    })
    .filter((c) => (channel === "email" ? !!c.email : !!c.phone))
    .map((c) => ({
      customerId: c.id,
      name: [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || "לקוח/ה",
      phone: c.phone,
      email: c.email,
    }));
}
