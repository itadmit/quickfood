# Grow Payments Integration

**Provider name in code**: `grow`
**Vendor brand**: Grow Payments (formerly Meshulam)
**Reference docs**: https://grow-il.readme.io
**Support**: apisupport@grow.business

---

## TL;DR

Grow is an Israeli payment gateway. QuickFood integrates it via Grow's
**Growin Wallet SDK** - a JS library loaded from `cdn.meshulam.co.il/sdk/gs.min.js`
that renders the wallet inline on our checkout page (no redirect, no iframe
modal). A server-to-server callback finalizes the order. The integration is
multi-tenant via a single platform `apiKey` + `pageCode`; each restaurant
(tenant) has its own `userId` stored in `PaymentProviderConfig.credentials`.

The customer never leaves QuickFood. Grow's SDK fires
`onSuccess` / `onFailure` / `onError` / `onTimeout` / `onWalletChange`. The
S2S callback at `/api/payments/callback?provider=grow&tenant=<slug>` is what
actually marks the Order as `paid` and advances it to `confirmed`.

---

## Auth model

| Identifier   | Where it lives                                     | Per-merchant? |
|--------------|----------------------------------------------------|---------------|
| `userId`     | `payment_provider_configs.credentials.userId`      | ✅ yes        |
| `apiKey`     | env `GROW_API_KEY`                                 | ❌ shared     |
| `pageCode`   | env `GROW_PAGE_CODE` (or override in credentials)  | ❌ shared     |

The `apiKey` is sent both as a body param (every call) and as `X-API-KEY`
header (only on `createPaymentProcess`).

The `pageCode` **must** be configured on Grow's backend for **SDK Wallet
mode**. The test pageCode they ship is already in this mode.

### Environment variables

```bash
GROW_API_KEY=                # platform apiKey (server-side only)
GROW_PAGE_CODE=              # platform default pageCode (SDK Wallet mode)
GROW_COMPANY_COMMISSION=     # optional, ₪ excl. VAT, per transaction
NEXT_PUBLIC_GROW_ENV=        # optional: DEV | PRODUCTION (defaults to DEV in non-prod)
GROW_API_URL=                # informational; provider auto-picks sandbox/prod from PaymentProviderConfig.testMode
```

`NEXT_PUBLIC_APP_URL` is reused to construct the callback URL.

---

## Endpoints

| Environment | Base URL |
|-------------|----------|
| Sandbox     | `https://sandbox.meshulam.co.il/api/light/server/1.0` |
| Production  | `https://secure.meshulam.co.il/api/light/server/1.0` (granted only after Grow's site review) |

All requests are `application/x-www-form-urlencoded` (NOT JSON).
Server-side only - Grow blocks browser-originated requests.

---

## Flow

### 1. Initiate (server)

Client POSTs to `/api/v1/customer/orders/[id]/pay/initiate`. The server:

1. Loads the Order and looks up the tenant's [`PaymentProviderConfig`](../prisma/schema.prisma).
2. Creates a [`PendingPayment`](../prisma/schema.prisma) row up-front.
3. Calls Grow's `/createPaymentProcess` with `cField1` = `Order.number` so
   it round-trips back to us via the S2S callback.
4. Returns `sdk_auth_code` to the client.

Response:
```json
{
  "pending_payment_id": "uuid",
  "provider": "grow",
  "sdk_auth_code": "f01644c3f19b30h825eg5g5g5g3b0",
  "payment_url": null,
  "provider_request_id": "332002",
  "success_url": "https://…/checkout/thank-you?ref=QF-…",
  "cancel_url": "https://…/checkout/cancel?ref=QF-…"
}
```

### 2. Render the wallet (client)

```html
<script src="https://cdn.meshulam.co.il/sdk/gs.min.js"></script>
<script>
  window.growPayment.init({
    environment: 'DEV',   // or 'PRODUCTION'
    version: 1,
    events: {
      onSuccess: () => { window.location.href = successUrl; },
      onFailure: (r) => alert(r.message),
      onError:   (r) => alert(r.message),
      onTimeout: ()  => alert('פג תוקף הטופס'),
      onWalletChange: (state) => { /* "open" | "close" */ },
    },
  });
  window.growPayment.renderPaymentOptions(sdkAuthCode);
</script>
```

> Frontend SDK component is not yet built in QuickFood. When checkout UI
> lands, port [`grow-payment-sdk.tsx`](../../quickshop10/src/components/checkout/grow-payment-sdk.tsx)
> from QuickShop10.

### 3. Server-to-Server callback

Grow POSTs `application/x-www-form-urlencoded` to:

```
POST {NEXT_PUBLIC_APP_URL}/api/payments/callback?provider=grow&tenant=<slug>
```

[`route.ts`](../app/api/payments/callback/route.ts):

1. Validates the request - Grow has no HMAC; we check the source IP against
   `GROW_TEST_IPS` / `GROW_LIVE_IPS` (warn-only in dev, fail-closed in prod).
2. Parses the body (handles flat form-urlencoded *and* nested JSON shapes).
3. Locates `PendingPayment` by `providerRequestId` (Grow `processId`), with
   `orderReference` (= `Order.number`) as a fallback match.
4. Amount sanity check (tolerates 1 agora rounding).
5. Creates a `PaymentTransaction`, marks `PendingPayment.status = confirmed`,
   sets `Order.paymentStatus = paid`, advances Order to `confirmed`
   (fires `order.status_changed` webhook).
6. Non-blocking `POST /approveTransaction` back to Grow - required, else
   Grow retries the callback up to 6 more times. Our handler is idempotent,
   so retries are safe but wasteful.

### Status codes (Grow ← us)

| Grow `statusCode` | Meaning                          | Our status   |
|-------------------|----------------------------------|--------------|
| `0`               | Not paid                         | `failed`     |
| `2`               | Paid                             | `success`    |
| `4`               | Canceled before transmission     | `cancelled`  |
| `6`               | Refund transaction               | `success`    |
| `9`               | Transaction denied               | `failed`     |

---

## Field requirements (Grow's rules)

| Field      | Rule                                                                 |
|------------|----------------------------------------------------------------------|
| `fullName` | At least 2 space-separated tokens (first + last). We pad with `.` if needed. |
| `phone`    | Israeli mobile - exactly 10 digits starting with `05`. We normalize `+972`, `972`, `00972`, dashes, spaces. Fallback: `0500000000`. |
| `description` | No "special characters" - Grow rejects silently. We strip everything but letters/digits/space/`.-_@`. |

`fullName` and `phone` are **required** by Grow.

---

## Test data

### Sandbox credentials (already configured)

- `userId` (per tenant): `814d52344861c4a3` - currently seeded for `pizzeria-verde`.
- `apiKey` (platform): `7018a83ce5b9`
- `pageCode` (platform, SDK Wallet mode): `239ed72cde47`

### Test cards

```
4580458045804580   ← single payment only (use to test FAIL on installments)
4580000000000000
4580111111111121
```

### Test bank transfer

```
bank   : 41
branch : 410
account: 411111111
```

### ⚠️ No sandbox for Bit / Apple Pay / Google Pay

These are **real transactions** even in test. Smoke-test with ₪1 amounts and
issue a full refund afterward.

### Simulate a callback to localhost

```
GET https://sandbox.meshulam.co.il/api/light/server/1.0/updateMyUrl/?url=<YOUR_LOCAL_TUNNEL_URL>
```

---

## Refunds

`POST /refundTransaction` with `userId + transactionId + transactionToken + refundSum`.

**Critical rule**: same-day refunds must be **FULL only** - Grow rejects
partial same-day refunds with error 130
("לא ניתן לבצע זיכוי חלקי על עסקה שבוצעה היום"). Partial refunds work from
the next day onward.

We persist `transactionToken` on the `PaymentTransaction.providerToken`
column at callback time - must be passed back on every refund call.

---

## Apple Pay (post-deploy checklist)

To accept Apple Pay, the **production domain** must be verified with Apple:

1. Add to checkout page `<head>`:
   ```html
   <script src="https://meshulam.co.il/_media/js/apple_pay_sdk/sdk.min.js"></script>
   ```
2. Get the verification file (`development_domain_verification.txt` /
   `production_domain_verification.txt`) from Grow's onboarding email.
3. Rename to `apple-developer-merchantid-domain-association` and serve at:
   ```
   https://my-quickfood-domain.com/.well-known/apple-developer-merchantid-domain-association
   ```
4. Verify the file is publicly readable.
5. Register the domain in Grow's merchant dashboard.

---

## Google Pay

Standard Grow Wallet - but Google Pay only renders in **Chrome / Chromium**
browsers (security restriction enforced by Grow's SDK).

---

## PayBox

If a customer pays via PayBox, the callback returns `transactionTypeId=5`.
Our `parseCallback` does not branch on this - the payment is treated like
any other successful transaction. The raw field is preserved in
`PaymentTransaction.providerResponse` for accounting.

---

## Multi-merchant platform terms

Per Grow's
[platforms guide](https://grow-il.readme.io/reference/api-guidelines-for-platforms-system-integrators):

- `apiKey` is mandatory on every call and identifies QuickFood as the platform.
- `companyCommission` (₪ excl. VAT - **not %**) routes a per-transaction
  cut to us. Env: `GROW_COMPANY_COMMISSION`.
- Settlement is monthly via invoice we issue Grow.
- Min thresholds: ₪100K monthly volume + ₪1K monthly platform commission.
- There is no platform-owner dashboard from Grow - track via our own
  `PaymentTransaction` / `PendingPayment` rows.

Each merchant still passes Grow's individual site review before getting
production credentials.

---

## Files

| File                                                                     | Purpose                                       |
|--------------------------------------------------------------------------|-----------------------------------------------|
| [`lib/payments/providers/grow.ts`](../lib/payments/providers/grow.ts)     | Grow provider - initiate / parseCallback / acknowledge / refund |
| [`lib/payments/factory.ts`](../lib/payments/factory.ts)                   | Loads `PaymentProviderConfig` and returns a configured provider |
| [`lib/payments/types.ts`](../lib/payments/types.ts)                       | Interfaces                                   |
| [`lib/payments/base.ts`](../lib/payments/base.ts)                         | Base class                                   |
| [`app/api/v1/customer/orders/[id]/pay/initiate/route.ts`](../app/api/v1/customer/orders/[id]/pay/initiate/route.ts) | Returns `sdk_auth_code` |
| [`app/api/payments/callback/route.ts`](../app/api/payments/callback/route.ts) | S2S callback handler |
| `prisma/schema.prisma` (models `PaymentProviderConfig`, `PendingPayment`, `PaymentTransaction`) | DB schema |

---

## Known gaps & follow-ups

- **No HMAC on callbacks** - security relies on Grow's IP whitelist + the
  unguessable `notifyUrl`. Watch for IP-list changes.
- **Frontend SDK component** - checkout UI doesn't exist yet; port from QuickShop10 when it does.
- **Idempotency on retries** - we de-dupe on `(provider, providerTransactionId)` unique index, so Grow's 6× retries are safe.
- **Bit / Apple Pay / Google Pay** - no sandbox; first deploy requires real ₪1 smoke tests per method.
- **Same-day partial refunds** - return Grow error 130; surface a clearer message in any future admin UI.
- **`payerBankAccountDetails`** - Grow's callback can carry bank-account fields for ההעברה בנקאית flow. Not parsed today (we don't expose bank transfer).
