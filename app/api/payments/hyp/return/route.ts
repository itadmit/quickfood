/**
 * GET|POST /api/payments/hyp/return?tenant=<slug>
 *
 * WHY A DEDICATED ROUTE (and why it isn't /api/payments/callback):
 * Hyp has NO server-to-server webhook, and it does not accept a per-request
 * return URL - the post-transaction address is configured on the terminal
 * (Masof) in the Hyp portal. Each merchant sets BOTH the success and the
 * failure address to the URL shown on /dashboard/settings/payments:
 *
 *     https://<app>/api/payments/hyp/return?tenant=<slug>
 *
 * So the customer's browser redirect IS the only result channel we get.
 *
 * FLOW:
 *  1. Hyp redirects the browser here with the result as params: Order (our
 *     reference), Id (Hyp txn), CCode, ACode, Amount, L4digit, Fild1, Sign…
 *  2. We resolve the tenant from ?tenant= (or Fild1, which we echoed through
 *     Hyp, for merchants who pasted the URL without the query).
 *  3. HypProvider.parseCallback replays those params to Hyp as `What=VERIFY`.
 *     The redirect params are client-controlled and forgeable, so a success is
 *     NEVER recorded off the redirect alone - only a VERIFY CCode=0 counts.
 *  4. finalizeProviderCallback runs the exact same finalization as the Grow /
 *     CardCom webhook path (transaction row, order paid, status advance,
 *     commission, kitchen ticket). Idempotent, so a refresh is harmless.
 *  5. We bounce the browser to /checkout/thank-you|failed, which resolves the
 *     concrete storefront destination and breaks out of the payment iframe if
 *     the merchant chose embedded display.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getConfiguredProvider } from "@/lib/payments/factory";
import { finalizeProviderCallback } from "@/lib/payments/finalize-callback";
import { PaymentProvider } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOG = "[payments/hyp/return]";

/**
 * Absolute base for every redirect below. NextResponse.redirect rejects
 * relative URLs, so falling back to the incoming request's own origin keeps a
 * paying customer moving even if NEXT_PUBLIC_APP_URL is unset (which is what
 * broke the Grow callback once).
 */
function appBase(req: NextRequest): string {
  const configured = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  return configured || req.nextUrl.origin;
}

function see(url: string): NextResponse {
  // 303 so a POSTed return lands on the thank-you page as a GET.
  return NextResponse.redirect(url, { status: 303 });
}

/**
 * Resolve the tenant. `?tenant=` is what we tell merchants to configure; Fild1
 * is the slug we echoed through Hyp at sign time and survives a merchant who
 * pasted the bare URL. Either way the VERIFY that follows runs against THAT
 * tenant's Masof, so pointing the hint at someone else's store just fails the
 * signature check.
 */
async function resolveTenant(
  params: Record<string, string | undefined>,
): Promise<{ id: string; slug: string } | null> {
  const slug = params.tenant || params.Fild1;
  if (slug) {
    const bySlug = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, slug: true },
    });
    if (bySlug) return bySlug;
  }

  // Last resort: Order is unique per tenant, not globally - only usable when
  // exactly one tenant has a pending payment under that reference.
  const order = params.Order;
  if (!order) return null;
  const pending = await prisma.pendingPayment.findMany({
    where: { orderReference: order },
    orderBy: { createdAt: "desc" },
    take: 2,
    select: { tenant: { select: { id: true, slug: true } } },
  });
  if (pending.length !== 1) return null;
  return pending[0].tenant;
}

async function handle(
  params: Record<string, string | undefined>,
  base: string,
): Promise<NextResponse> {
  const order = params.Order ?? "";
  const ccode = String(params.CCode ?? "");

  console.log(`${LOG} HIT`, {
    tenant: params.tenant ?? params.Fild1 ?? null,
    Order: order,
    CCode: ccode,
    Id: params.Id,
    Amount: params.Amount,
  });

  const tenant = await resolveTenant(params);
  if (!tenant) {
    console.error(`${LOG} could not resolve tenant`, { order, hint: params.tenant });
    return see(`${base}/`);
  }

  const refQuery = `ref=${encodeURIComponent(order)}&cField2=${encodeURIComponent(tenant.id)}`;
  const failureUrl = `${base}/checkout/failed?${refQuery}`;
  const successUrl = `${base}/checkout/thank-you?${refQuery}`;

  // getConfiguredProvider throws when the stored credentials are incomplete
  // (validateConfig). This route is customer-facing, so a thrown error must
  // become a redirect, never a 500 page mid-payment.
  let provider;
  try {
    provider = await getConfiguredProvider(tenant.id, PaymentProvider.hyp);
  } catch (err) {
    console.error(`${LOG} hyp config invalid`, { tenant: tenant.slug, err });
    return see(failureUrl);
  }
  if (!provider) {
    console.error(`${LOG} hyp not configured for tenant`, { tenant: tenant.slug });
    return see(failureUrl);
  }

  // Runs the server-side VERIFY. A declined or forged redirect comes back
  // success:false and takes the failure path below.
  let parsed;
  let result;
  try {
    parsed = await provider.parseCallback(params);
    result = await finalizeProviderCallback({
      tenant,
      providerType: PaymentProvider.hyp,
      provider,
      parsed,
      logPrefix: LOG,
    });
  } catch (err) {
    // The charge may well have gone through at Hyp - log loudly, because
    // there is no webhook retry to save us here.
    console.error(`${LOG} FINALIZATION THREW - possible unrecorded charge`, {
      tenant: tenant.slug,
      order,
      ccode,
      Id: params.Id,
      err,
    });
    return see(failureUrl);
  }

  if (!parsed.success) {
    console.warn(`${LOG} not paid`, {
      order,
      ccode,
      code: parsed.errorCode,
      message: parsed.errorMessage,
    });
    return see(failureUrl);
  }

  if (result.error) {
    // Verified at Hyp but we refused to apply it (amount mismatch, kiosk
    // snapshot gone). Treat as a failure for the customer - ops has the log.
    console.error(`${LOG} verified but not applied`, { order, error: result.error });
    return see(failureUrl);
  }

  console.log(`${LOG} settled`, {
    order,
    tenant: tenant.slug,
    kind: result.kind,
    orderId: result.orderId,
    matched: result.matched,
  });
  return see(successUrl);
}

/**
 * Collect params preserving the order Hyp sent them in - VERIFY validates the
 * `Sign` positionally, so reordering breaks it.
 */
function fromSearch(req: NextRequest): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  req.nextUrl.searchParams.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

export async function GET(req: NextRequest) {
  return handle(fromSearch(req), appBase(req));
}

export async function POST(req: NextRequest) {
  // Some terminal configs POST the result instead. Accept form-encoded or
  // JSON, merged over the query params (which carry our ?tenant= hint).
  const params = fromSearch(req);
  try {
    const text = await req.text();
    if (text) {
      try {
        const json = JSON.parse(text) as Record<string, unknown>;
        for (const [k, v] of Object.entries(json)) params[k] = v == null ? undefined : String(v);
      } catch {
        new URLSearchParams(text).forEach((value, key) => {
          params[key] = value;
        });
      }
    }
  } catch {
    // Body unreadable - the query params may still be enough.
  }
  return handle(params, appBase(req));
}
