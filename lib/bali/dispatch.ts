import { prisma } from "@/lib/db/client";

const ENDPOINT =
  process.env.BALI_CREATE_ORDER_URL ??
  "https://6sald4neod.execute-api.eu-central-1.amazonaws.com/default/bali-create-new-order";
const TIMEOUT_MS = 8000;

export interface BaliConfig {
  shopId: string;
  apiKey: string;
  prepMinutes: number;
}

export function resolveBaliConfig(raw: unknown): BaliConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  if (c.enabled !== true) return null;
  const shopId = typeof c.shopId === "string" ? c.shopId.trim() : "";
  const apiKey = typeof c.apiKey === "string" ? c.apiKey.trim() : "";
  if (!shopId || !apiKey) return null;
  const prep = Number(c.prepMinutes);
  return { shopId, apiKey, prepMinutes: Number.isFinite(prep) && prep > 0 ? Math.round(prep) : 15 };
}

async function recordEvent(orderId: string, type: string, payload: Record<string, unknown>) {
  await prisma.orderEvent
    .create({ data: { orderId, type, payload: payload as never } })
    .catch((err) => console.warn("[bali] event log failed", err));
}

export async function pushOrderToBali(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { deliveryAddress: true, tenant: { select: { baliConfig: true } } },
  });
  if (!order || order.method !== "delivery") return;

  const cfg = resolveBaliConfig(order.tenant.baliConfig);
  if (!cfg) return;

  const already = await prisma.orderEvent.findFirst({
    where: { orderId, type: "bali_dispatched" },
    select: { id: true },
  });
  if (already) return;

  const addr = order.deliveryAddress;
  const name = [order.customerFirstNameSnap, order.customerLastNameSnap]
    .filter(Boolean)
    .join(" ")
    .trim();
  const address = [addr?.street, addr?.city]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(", ");
  const remarks = [addr?.notes, order.deliveryNotes, order.customerNotes]
    .filter((s): s is string => !!s && s.trim().length > 0)
    .join(" · ");

  const body: Record<string, unknown> = {
    shopID: cfg.shopId,
    orderID: order.number,
    name,
    phone: order.customerPhoneSnap ?? "",
    address,
    entrance: addr?.entrance ?? "",
    flatNumber: addr?.apartment ?? "",
    floor: addr?.floor ?? "",
    remarks,
    prepTime: cfg.prepMinutes,
  };
  if (addr?.lat != null && addr?.lng != null) {
    body.latitude = Number(addr.lat);
    body.longitude = Number(addr.lng);
  }

  let status = 0;
  let text = "";
  let error: string | null = null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": cfg.apiKey },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    status = res.status;
    text = (await res.text().catch(() => "")).slice(0, 500);
    if (!res.ok) error = `http_${res.status}`;
  } catch (err) {
    error = err instanceof Error ? err.message : "fetch_failed";
  } finally {
    clearTimeout(timer);
  }

  if (error) console.warn("[bali] create failed", order.number, status, error);
  await recordEvent(order.id, error ? "bali_failed" : "bali_dispatched", {
    action: "create",
    http_status: status,
    error,
    response: text,
  });
}
