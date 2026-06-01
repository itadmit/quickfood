/**
 * POST /api/payments/invoice-callback
 *
 * Async server-to-server callback fired by Grow Payments AFTER the regular
 * transaction callback, ONCE an invoice/receipt PDF has been generated for
 * the transaction. Routed by ?provider=<type>. Only fires for tenants that
 * have invoice generation enabled in their Grow control panel.
 *
 * Body shape (per grow-il.readme.io/reference/invoice-server-response):
 *   [
 *     {
 *       "transactionId": "6111677",
 *       "processId":     "211111",
 *       "invoiceNumber": "4111",
 *       "invoiceUrl":    "https://meshulam.co.il/s/...."
 *     }
 *   ]
 *
 * Match by processId (== PendingPayment.providerRequestId), fall back to
 * transactionId (== PaymentTransaction.providerTransactionId). Always
 * returns 200 so Grow stops retrying.
 */

import { apiError, apiJson, handler } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";
import { getConfiguredProvider } from "@/lib/payments/factory";
import { PaymentProvider } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface InvoiceCallbackEntry {
  transactionId?: string;
  processId?: string;
  invoiceNumber?: string;
  invoiceUrl?: string;
}

function extractHeaders(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  req.headers.forEach((v, k) => (out[k.toLowerCase()] = v));
  return out;
}

async function parseBody(req: Request): Promise<InvoiceCallbackEntry[]> {
  const text = await req.text();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed as InvoiceCallbackEntry[];
    // Defensive: in case Grow changes shape to a bare object.
    if (parsed && typeof parsed === "object") return [parsed as InvoiceCallbackEntry];
    return [];
  } catch {
    return [];
  }
}

export const POST = handler(async (req: Request) => {
  const url = new URL(req.url);
  const providerParam = url.searchParams.get("provider");
  const tenantSlug = url.searchParams.get("tenant");

  if (!providerParam) return apiError("missing_provider", "missing ?provider", 400);
  if (!tenantSlug) return apiError("missing_tenant", "missing ?tenant", 400);

  const providerType = providerParam as PaymentProvider;
  if (providerType !== PaymentProvider.grow) {
    return apiError("unknown_provider", `provider not supported: ${providerParam}`, 400);
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, slug: true },
  });
  if (!tenant) return apiError("tenant_not_found", "unknown tenant", 404);

  const provider = await getConfiguredProvider(tenant.id, providerType);
  if (!provider) return apiError("provider_unavailable", "provider not configured", 503);

  // Reuse the existing IP whitelist — Grow ships invoice callbacks from
  // the same IP range as transaction callbacks.
  const headers = extractHeaders(req);
  const validation = provider.validateWebhook({}, headers);
  if (!validation.isValid) {
    console.warn("[payments/invoice-callback] validation failed", validation.error);
    return apiError("invalid_webhook", validation.error || "invalid webhook", 401);
  }

  const entries = await parseBody(req);
  if (entries.length === 0) {
    return apiJson({ received: true, matched: 0 });
  }

  let matched = 0;
  for (const e of entries) {
    const invoiceUrl = (e.invoiceUrl ?? "").trim();
    const invoiceNumber = (e.invoiceNumber ?? "").trim();
    if (!invoiceUrl && !invoiceNumber) continue;

    // Match by processId first (more specific). Fall back to transactionId.
    let orderId: string | null = null;
    if (e.processId) {
      const pending = await prisma.pendingPayment.findFirst({
        where: { tenantId: tenant.id, providerRequestId: e.processId },
        orderBy: { createdAt: "desc" },
        select: { orderId: true },
      });
      if (pending) orderId = pending.orderId;
    }
    if (!orderId && e.transactionId) {
      const txn = await prisma.paymentTransaction.findFirst({
        where: {
          tenantId: tenant.id,
          provider: providerType,
          providerTransactionId: e.transactionId,
        },
        orderBy: { createdAt: "desc" },
        select: { orderId: true },
      });
      if (txn) orderId = txn.orderId;
    }

    if (!orderId) {
      console.warn("[payments/invoice-callback] no order matched", {
        processId: e.processId,
        transactionId: e.transactionId,
      });
      continue;
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        invoiceNumber: invoiceNumber || null,
        invoiceUrl: invoiceUrl || null,
      },
    });
    matched++;
  }

  return apiJson({ received: true, matched });
});
