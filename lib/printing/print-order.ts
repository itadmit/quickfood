// Auto-print an order ticket on the tenant's cloud printer. Called post-
// response (inside after()) from order creation (cash) and the payment
// callback (card) - it must NEVER throw into the order flow, so every
// failure is swallowed into an order_events row + console.error.

import { prisma } from "@/lib/db/client";
import { fullName } from "@/lib/format";
import {
  buildReceiptLines,
  resolveReceiptSettings,
  type ReceiptOrder,
} from "@/lib/receipt-print";
import {
  resolvePrinterSettings,
  renderTicket,
  publishToPrinter,
} from "@/lib/printing/cloud-printer";

export type PrintTrigger = "cash_created" | "card_paid" | "manual";

const RETRY_DELAYS_MS = [0, 2_000, 5_000];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function printOrderTicket(orderId: string, trigger: PrintTrigger): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        deliveryAddress: true,
        customer: { select: { firstName: true, lastName: true, phone: true } },
        tenant: { select: { name: true, printerSettings: true, receiptSettings: true } },
      },
    });
    if (!order) return;

    const printer = resolvePrinterSettings(order.tenant.printerSettings);
    if (!printer.enabled || !printer.deviceTopic) return;
    if (trigger === "cash_created" && !printer.printCashOnCreate) return;
    if (trigger === "card_paid" && !printer.printCardOnPaid) return;

    const name =
      fullName(order.customerFirstNameSnap, order.customerLastNameSnap) ||
      fullName(order.customer?.firstName, order.customer?.lastName);
    const receiptOrder: ReceiptOrder = {
      number: order.number,
      created_at: order.createdAt.toISOString(),
      method: order.method as "delivery" | "pickup",
      total: order.total,
      subtotal: order.subtotal,
      delivery_fee: order.deliveryFee,
      service_fee: order.serviceFee,
      cutlery_count: order.cutleryCount,
      cutlery_fee: order.cutleryFee,
      tip: order.tip,
      discount: order.discount,
      payment_method: order.paymentMethod,
      customer_notes: order.customerNotes,
      delivery_notes: order.deliveryNotes,
      customer: {
        name: name || null,
        phone: order.customerPhoneSnap ?? order.customer?.phone ?? null,
      },
      delivery_address: order.deliveryAddress
        ? {
            street: order.deliveryAddress.street,
            city: order.deliveryAddress.city,
            floor: order.deliveryAddress.floor,
            apartment: order.deliveryAddress.apartment,
            notes: order.deliveryAddress.notes,
          }
        : null,
      items: order.items.map((it) => ({
        name: it.nameSnapshot,
        quantity: it.quantity,
        total_price: it.totalPrice,
        size: it.sizeSnapshot,
        options: it.selectedOptions,
        notes: it.notes,
      })),
    };

    const ticket = renderTicket(
      buildReceiptLines(receiptOrder, resolveReceiptSettings(order.tenant.receiptSettings)),
    );

    let lastError: unknown = null;
    for (const delay of RETRY_DELAYS_MS) {
      if (delay > 0) await sleep(delay);
      try {
        for (let c = 0; c < printer.copies; c++) {
          await publishToPrinter(printer.deviceTopic, ticket);
        }
        lastError = null;
        break;
      } catch (err) {
        lastError = err;
      }
    }

    await prisma.orderEvent.create({
      data: {
        orderId,
        type: lastError ? "print_failed" : "printed",
        payload: {
          trigger,
          device_topic: printer.deviceTopic,
          ...(lastError ? { error: String(lastError) } : {}),
        },
      },
    });
    if (lastError) {
      console.error("[printing] ticket delivery failed", { orderId, trigger }, lastError);
    }
  } catch (err) {
    console.error("[printing] printOrderTicket crashed", { orderId, trigger }, err);
  }
}
