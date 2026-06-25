/**
 * Pure, client-safe text helpers for order notifications. No DB / server
 * imports - the merchant dashboard imports `defaultBody` to preview the
 * built-in default per channel, and lib/orders/notify-order-event.ts imports
 * the same functions so the preview and the real send never drift.
 */
import type { NotifyChannel, OrderNotifyEvent } from "@/lib/messaging/notify-settings";

export interface BodyCtx {
  name: string;
  number: number | string;
  method: "delivery" | "pickup";
  courier: { name: string; phone: string | null } | null;
  waze: string | null;
}

export const TEXT_TOKENS: Array<{ token: string; label: string }> = [
  { token: "{business}", label: "שם העסק" },
  { token: "{order}", label: "מספר הזמנה" },
  { token: "{courier}", label: "שם השליח" },
  { token: "{courier_phone}", label: "טלפון השליח" },
  { token: "{waze}", label: "לינק Waze" },
];

/** Tokens a merchant may use in an override text. */
export function templateVars(ctx: BodyCtx): Record<string, string> {
  return {
    business: ctx.name,
    order: String(ctx.number),
    courier: ctx.courier?.name ?? "",
    courier_phone: ctx.courier?.phone ?? "",
    waze: ctx.waze ?? "",
  };
}

export function renderTemplate(text: string, vars: Record<string, string>): string {
  return text
    .replace(/\{(\w+)\}/g, (m, key: string) => (key in vars ? vars[key] : m))
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

/**
 * Built-in defaults. SMS stays short and plain (every char is billed). WhatsApp
 * gets a richer copy: a light emoji, a Waze link on pickup-ready, no long dashes.
 */
export function defaultBody(
  event: OrderNotifyEvent,
  ctx: BodyCtx,
  channel: NotifyChannel,
): string {
  const { name, number } = ctx;
  const rich = channel === "whatsapp" || channel === "whatsapp_managed";
  switch (event) {
    case "confirmed":
      return rich
        ? `${name}\nהזמנה ${number} התקבלה ואושרה ✅\nנעדכן אותך כשהיא מוכנה.`
        : `${name}: הזמנה ${number} התקבלה ואושרה. נעדכן אותך כשהיא מוכנה.`;
    case "ready":
      if (ctx.method === "pickup") {
        if (rich) {
          const wazeLine = ctx.waze ? `\nניווט במפה: ${ctx.waze}` : "";
          return `${name}\nהזמנה ${number} מוכנה לאיסוף 🛍️\nאפשר לבוא לקחת!${wazeLine}`;
        }
        return `${name}: הזמנה ${number} מוכנה לאיסוף! אפשר לבוא לקחת.`;
      }
      return rich
        ? `${name}\nהזמנה ${number} מוכנה 🛍️\nתצא אליך בקרוב.`
        : `${name}: הזמנה ${number} מוכנה ותצא אליך בקרוב.`;
    case "on_the_way": {
      const courierLine = ctx.courier
        ? `השליח ${ctx.courier.name}${ctx.courier.phone ? ` (${ctx.courier.phone})` : ""}`
        : "השליח שלך";
      return rich
        ? `${name}\n${courierLine} יצא אליך עם הזמנה ${number} 🛵`
        : `${name}: ${courierLine} יצא אליך עם הזמנה ${number}.`;
    }
    case "delivered":
      return rich
        ? `${name}\nהזמנה ${number} נמסרה בהצלחה 🎉\nבתאבון!`
        : `${name}: הזמנה ${number} נמסרה בהצלחה. בתאבון!`;
  }
}
