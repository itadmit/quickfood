"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { IcoChev, IcoArrowLeft, IcoBag, IcoPin, IcoClose, IcoCheck } from "@/components/shared/Icons";
import { CustomerOtpLogin, type OtpCustomer } from "@/components/customer/CustomerOtpLogin";
import { Modal, ModalBody } from "@/components/shared/Modal";
import { LegalText } from "@/components/shared/LegalText";
import { THEMES, type ThemeId } from "@/lib/themes";
import { MenuItemImage, type BusinessType } from "@/components/shared/MenuItemImage";
import { useCart } from "@/components/customer/CartProvider";
import { CartLineOptions } from "@/components/customer/CartLineOptions";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";
import { recordRecentOrder } from "@/lib/recent-orders-storage";
import { recordOrderToken } from "@/lib/order-access-storage";
import { takeCheckoutPrefill } from "@/lib/checkout-prefill";
import { readDeliveryChoice, writeDeliveryChoice } from "@/lib/delivery-city-storage";
import { getTodayScheduleWindowMin } from "@/lib/branch-hours";
import { CitySelect } from "@/components/customer/CitySelect";
import { Toggle } from "@/components/shared/Toggle";
import { GrowPaymentSdk, renderGrowWallet } from "@/components/customer/GrowPaymentSdk";
import { HostedPaymentFrame } from "@/components/customer/HostedPaymentFrame";
import { BusyAlertModal } from "@/components/customer/BranchStatusModal";
import { AttributionPrompt } from "@/components/customer/AttributionPrompt";

type CustomerPaymentMethod = "cash" | "card" | "bit" | "apple_pay" | "google_pay";

const PAYMENT_METHOD_LABELS: Record<CustomerPaymentMethod, string> = {
  cash: "מזומן בעת המסירה",
  card: "כרטיס אשראי",
  bit: "Bit",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
};

export function CustomerCheckout({
  tenantSlug,
  initialCustomer = null,
  requireEmail = false,
  cardEnabled = false,
  provider = null,
  testMode = true,
  displayMode = null,
  showAttribution = true,
  deliveryCities = [],
  pickupEnabled = true,
  termsText = "",
  loyaltyCheckout = { show: false, text: "" },
}: {
  tenantSlug: string;
  /** Prefill + "logged in as" state for an already-authenticated customer. */
  initialCustomer?: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
  } | null;
  requireEmail?: boolean;
  /** Tenant has an active card provider (grow OR cardcom). */
  cardEnabled?: boolean;
  provider?: "grow" | "cardcom" | null;
  testMode?: boolean;
  displayMode?: "iframe" | "redirect" | null;
  /** Show the "how did you hear about us?" attribution prompt. */
  showAttribution?: boolean;
  deliveryCities?: string[];
  pickupEnabled?: boolean;
  termsText?: string;
  loyaltyCheckout?: { show: boolean; text: string };
}) {
  const router = useRouter();
  const { lines, method, subtotal, deliveryFee, branch, tenant, clear, setMethod, hydrated, acceptedBundles, bundleDiscount } = useCart();

  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [floor, setFloor] = useState("");
  const [apartment, setApartment] = useState("");
  const [phone, setPhone] = useState(initialCustomer?.phone ?? "");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [firstName, setFirstName] = useState(initialCustomer?.firstName ?? "");
  const [lastName, setLastName] = useState(initialCustomer?.lastName ?? "");
  const [email, setEmail] = useState(initialCustomer?.email ?? "");
  const [emailTouched, setEmailTouched] = useState(false);
  // Client-side auth state. Starts from the SSR session; can flip true when a
  // guest logs in via the checkout OTP sheet (which also sets the cookies).
  const [loggedIn, setLoggedIn] = useState(!!initialCustomer);
  const [loginName, setLoginName] = useState(
    [initialCustomer?.firstName, initialCustomer?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim(),
  );
  const [loginOpen, setLoginOpen] = useState(false);

  // Guest logged in via the checkout sheet - the verify call already set the
  // cookies, so we just prefill from the returned customer and flip state.
  function handleLoginSuccess(c: OtpCustomer) {
    setPhone(c.phone || "");
    setFirstName((cur) => cur || c.first_name || "");
    setLastName((cur) => cur || c.last_name || "");
    setLoggedIn(true);
    setLoginName([c.first_name, c.last_name].filter(Boolean).join(" ").trim());
    setLoginOpen(false);
  }
  // Flipped on the first failed submit attempt: from then on EVERY invalid
  // field shows its red error (Shopify-style), not just touched ones.
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loyaltyConsent, setLoyaltyConsent] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [availableMethods, setAvailableMethods] = useState<CustomerPaymentMethod[]>([]);
  // Tri-state: while true, render a skeleton instead of the "merchant has
  // no payment methods" empty state. Without this, the empty copy flashes
  // for the few hundred ms between mount and when the restaurants endpoint
  // resolves - looks broken.
  const [methodsLoading, setMethodsLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<CustomerPaymentMethod | null>(null);
  const [tip, setTip] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyAlertOpen, setBusyAlertOpen] = useState(false);

  // Schedule-for-later. asap = deliver as soon as possible (the default);
  // scheduledTime is a "HH:mm" string for today only (no multi-day picker
  // for V1 - the most common use is "אסוף בעוד שעתיים" / "תספיק להגיע
  // בשמונה"). The merchant's open hours could be enforced server-side
  // later; for now we just let the merchant decline if it's outside hours.
  const [scheduledTime, setScheduledTime] = useState<string>("");
  const [cutleryCount, setCutleryCount] = useState<number>(0);
  // Once the user taps "תזמן" we reveal the slot row even before they pick
  // a specific time. Without this the only signal of "schedule mode" would
  // be a non-empty scheduledTime, so the user can't browse slots without
  // committing to one.
  const [showSlots, setShowSlots] = useState(false);

  // Coupon. couponCode is what the user typed; couponApplied is the result
  // of the last successful /coupons/validate call. They're separate so the
  // user can edit the code without losing the active discount until they
  // re-apply.
  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState<
    | { code: string; discount: number; message: string }
    | null
  >(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);

  // Loyalty points redemption. Balance + terms come from the server for the
  // logged-in member; the preview here mirrors lib/loyalty/points.redeemQuote
  // and the server re-validates on submit, so the shown discount is exactly
  // what the order will charge.
  const [loyalty, setLoyalty] = useState<{
    balance: number;
    pointValueAgorot: number;
    maxPercentOfOrder: number;
    minPoints: number;
  } | null>(null);
  const [usePoints, setUsePoints] = useState(false);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/v1/customer/loyalty/points?tenant=${encodeURIComponent(tenantSlug)}`, {
      signal: ctrl.signal,
      credentials: "include",
    })
      .then((r) => r.json())
      .then(
        (d: {
          member?: boolean;
          balance?: number;
          redemption?: {
            enabled: boolean;
            point_value_agorot: number;
            max_percent_of_order: number;
            min_points: number;
          };
        }) => {
          if (d.member && d.redemption?.enabled && (d.balance ?? 0) >= d.redemption.min_points) {
            setLoyalty({
              balance: d.balance ?? 0,
              pointValueAgorot: d.redemption.point_value_agorot,
              maxPercentOfOrder: d.redemption.max_percent_of_order,
              minPoints: d.redemption.min_points,
            });
          }
        },
      )
      .catch(() => {});
    return () => ctrl.abort();
  }, [tenantSlug]);
  // True once the POST /orders call has succeeded - even though we clear()
  // the cart immediately afterward, this stays true until the browser
  // finishes navigating to /orders/[id], so we can show a "processing"
  // screen instead of the "הסל ריק" empty-state flashing for ~250ms.
  const [submitted, setSubmitted] = useState(false);

  // Grow SDK orchestration. The SDK only loads/initializes when there's an
  // active pending payment, and the wallet is rendered once both the SDK is
  // ready and we have an authCode from /pay/initiate. We also receive the
  // `testMode` flag from the server so the SDK's environment matches the
  // mode the authCode was issued under (sandbox vs production).
  const [pendingPayment, setPendingPayment] = useState<
    | { orderId: string; authCode: string; thankYouUrl: string; testMode: boolean }
    | null
  >(null);
  // CardCom hosted-page equivalent. Redirect mode navigates away immediately;
  // iframe mode shows an overlay with the embedded LowProfile page.
  const [hostedPayment, setHostedPayment] = useState<
    { paymentUrl: string; displayMode: "iframe" | "redirect" } | null
  >(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  useEffect(() => {
    if (pendingPayment && sdkReady) {
      renderGrowWallet(pendingPayment.authCode);
    }
  }, [pendingPayment, sdkReady]);

  // Load the restaurant's accepted payment methods. The server returns
  // them in the merchant's chosen order (defaultPaymentMethod first),
  // so we just pick the first one as the initial selection. If a
  // prefill from "הזמן שוב" already picked a method, we keep it as long
  // as it's still allowed.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/restaurants/${encodeURIComponent(tenantSlug)}`)
      .then((r) => r.json())
      .then((d: { restaurant?: { payment_methods?: CustomerPaymentMethod[] } }) => {
        if (cancelled) return;
        const methods = d.restaurant?.payment_methods ?? [];
        setAvailableMethods(methods);
        const first = methods[0] ?? null;
        setPaymentMethod((cur) => (cur && methods.includes(cur) ? cur : first));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setMethodsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantSlug]);

  // Consume any "הזמן שוב" prefill the home rail dropped in sessionStorage
  // on mount. takeCheckoutPrefill() clears the entry so a refresh doesn't
  // replay it. Each field is only applied if the customer hasn't already
  // typed something - we never clobber active edits.
  useEffect(() => {
    const choice = readDeliveryChoice(tenantSlug);
    if (choice?.kind !== "delivery") return;
    const match = deliveryCities.find(
      (c) => c.toLocaleLowerCase("he-IL") === choice.city.toLocaleLowerCase("he-IL"),
    );
    if (match) setCity((cur) => cur || match);
  }, [tenantSlug, deliveryCities]);

  useEffect(() => {
    const prefill = takeCheckoutPrefill(tenantSlug);
    if (!prefill) return;
    if (prefill.firstName) setFirstName((cur) => cur || prefill.firstName!);
    if (prefill.lastName) setLastName((cur) => cur || prefill.lastName!);
    if (prefill.phone) setPhone((cur) => cur || prefill.phone!);
    if (prefill.address) setAddress((cur) => cur || prefill.address!);
    if (prefill.floor) setFloor((cur) => cur || prefill.floor!);
    if (prefill.apartment) setApartment((cur) => cur || prefill.apartment!);
    if (prefill.deliveryNotes)
      setDeliveryNotes((cur) => cur || prefill.deliveryNotes!);
    if (prefill.customerNotes)
      setCustomerNotes((cur) => cur || prefill.customerNotes!);
    if (typeof prefill.tip === "number") setTip(prefill.tip);
    if (prefill.method) setMethod(prefill.method);
    if (prefill.paymentMethod) setPaymentMethod(prefill.paymentMethod);
  }, [tenantSlug, setMethod]);

  const serviceFee = branch?.serviceFee ?? 0;
  const couponDiscount = couponApplied?.discount ?? 0;
  const cutleryUnitPrice = tenant.cutleryPrice ?? 0;
  const cutleryFreeAbove = tenant.cutleryFreeAbove ?? null;
  const cutleryFreeUnlocked =
    cutleryFreeAbove !== null && cutleryFreeAbove !== undefined && subtotal >= cutleryFreeAbove;
  const cutleryFee =
    tenant.cutleryEnabled && cutleryCount > 0 && !cutleryFreeUnlocked
      ? cutleryUnitPrice * cutleryCount
      : 0;
  // Mirror of the server quote: points cover the remainder after coupon +
  // bundle savings, capped by the club's percent-of-order and the balance.
  const pointsBase = Math.max(0, subtotal - couponDiscount - bundleDiscount);
  const pointsQuote = (() => {
    if (!loyalty || !usePoints) return { points: 0, valueShekels: 0 };
    const balanceValue = Math.floor((loyalty.balance * loyalty.pointValueAgorot) / 100);
    const cap = Math.floor((pointsBase * loyalty.maxPercentOfOrder) / 100);
    const valueShekels = Math.max(0, Math.min(balanceValue, cap));
    if (valueShekels === 0) return { points: 0, valueShekels: 0 };
    return {
      points: Math.ceil((valueShekels * 100) / loyalty.pointValueAgorot),
      valueShekels,
    };
  })();
  const pointsDiscount = pointsQuote.valueShekels;
  const total = Math.max(
    0,
    subtotal + deliveryFee + serviceFee + cutleryFee + tip - couponDiscount - bundleDiscount - pointsDiscount,
  );

  /**
   * Re-validate when subtotal changes (line added/removed), since a coupon
   * with min_order or maxDiscount could become invalid or change amount.
   */
  useEffect(() => {
    if (!couponApplied) return;
    void revalidateCoupon(couponApplied.code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal]);

  async function revalidateCoupon(code: string) {
    try {
      const res = await fetch("/api/v1/customer/coupons/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant_slug: tenantSlug, code, subtotal }),
      });
      const data = await res.json();
      if (data.valid) {
        setCouponApplied({ code, discount: data.discount, message: data.message });
        setCouponError(null);
      } else {
        setCouponApplied(null);
        setCouponError(data.message ?? "הקופון כבר לא תקף");
      }
    } catch {
      setCouponApplied(null);
      setCouponError("בעיה בבדיקת הקוד");
    }
  }

  async function applyCoupon() {
    const code = couponCode.trim();
    if (!code) return;
    setCouponBusy(true);
    setCouponError(null);
    try {
      await revalidateCoupon(code);
    } finally {
      setCouponBusy(false);
    }
  }

  function clearCoupon() {
    setCouponCode("");
    setCouponApplied(null);
    setCouponError(null);
  }

  // Pre-computed time slots for today, every 15 min starting from now+30min
  // (kitchen prep buffer) up to 23:00. Computed once per mount - a checkout
  // session is short enough that drift doesn't matter, and scheduledIso()
  // below already pushes past-times to tomorrow as a safety net.
  const scheduleSlots = useMemo(() => {
    const window = branch?.hours
      ? getTodayScheduleWindowMin(branch.hours)
      : { openMin: 0, closeMin: 23 * 60 };
    if (!window) return [];

    const now = new Date();
    let startMin = now.getHours() * 60 + now.getMinutes() + 30;
    const overshoot = startMin % 15;
    if (overshoot !== 0) startMin += 15 - overshoot;
    startMin = Math.max(startMin, window.openMin);

    const out: string[] = [];
    for (let m = startMin; m < window.closeMin && m < 24 * 60; m += 15) {
      out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
    }
    return out;
  }, [branch?.hours]);

  /** Convert "HH:mm" to today's ISO datetime so the server gets a real
      timestamp. Returns null if the input is empty/invalid. */
  function scheduledIso(): string | null {
    if (!scheduledTime) return null;
    const [h, m] = scheduledTime.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    const d = new Date();
    d.setHours(h, m, 0, 0);
    // If the merchant chose a time that's already past, push to tomorrow -
    // the customer probably typo'd; let them confirm before submit.
    if (d.getTime() < Date.now() - 60_000) {
      d.setDate(d.getDate() + 1);
    }
    return d.toISOString();
  }
  const itemCount = lines.reduce((n, l) => n + l.quantity, 0);
  const businessType = (tenant.businessType as BusinessType) ?? "general";

  // While we wait for the route transition to /orders/[id], the cart is
  // already empty - show a friendly processing screen instead of the
  // "הסל ריק" empty state that would flash for the route-change frame.
  if (submitted && !pendingPayment) {
    return <ProcessingScreen />;
  }

  // NOTE: when there's an active pendingPayment, we keep the checkout form
  // visible underneath. Grow's wallet appears as its own overlay on top -
  // replacing the page used to break the SDK's z-index. The SDK component
  // is mounted at the end of the render tree below.

  // Suppress the empty-state during the brief window between the client
  // mounting and the cart finishing localStorage hydration. Otherwise a
  // refresh on /checkout flashes "הסל ריק" before the lines appear (most
  // visible on desktop where the loading.tsx skeleton is taller and the
  // empty-state contrast is sharper).
  if (!hydrated) {
    return <ProcessingScreen />;
  }

  if (lines.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="px-5 pt-5 pb-3 flex items-center gap-3">
          <Link
            href={`/s/${tenantSlug}`}
            className="w-9 h-9 rounded-full bg-white border border-qf-line grid place-items-center"
            aria-label="חזרה"
          >
            <IcoChev s={18} />
          </Link>
          <h1 className="font-bold text-lg">סיום הזמנה</h1>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center -mt-12">
          <div className="w-20 h-20 rounded-full bg-qf-green-soft grid place-items-center mb-4">
            <IcoBag c="var(--qf-primary)" s={36} />
          </div>
          <h2 className="font-semibold text-lg mb-1">הסל ריק</h2>
          <p className="text-sm text-qf-mute mb-5">הוסף פריטים מהתפריט וחזור הנה לסיום ההזמנה</p>
          <Link
            href={`/s/${tenantSlug}`}
            className="px-5 py-3 rounded-full bg-(--qf-primary) text-white font-medium text-sm"
          >
            לתפריט
          </Link>
        </div>
      </div>
    );
  }

  // The pay-button handler. Shows the busy-alert modal once per session
  // when the branch is busy, then defers to `place()` after the customer
  // acknowledges. Session-scoped so the alert doesn't reappear on a retry.
  function onPlaceClick() {
    if (branch?.status === "busy") {
      const ackKey = `qf:busy-ack:${tenantSlug}`;
      const acked = typeof window !== "undefined" && window.sessionStorage.getItem(ackKey);
      if (!acked) {
        setBusyAlertOpen(true);
        return;
      }
    }
    void place();
  }

  function ackBusyAndPlace() {
    window.sessionStorage.setItem(`qf:busy-ack:${tenantSlug}`, "1");
    setBusyAlertOpen(false);
    void place();
  }

  // Scroll to and focus the first invalid field. Selector-based because a
  // few targets (terms, payment) render twice (desktop sidebar + mobile
  // fixed bar) - we pick the visible instance.
  function focusInvalidField(selector: string) {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(selector));
    const el = candidates.find((c) => c.offsetParent !== null) ?? candidates[0];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => el.focus({ preventScroll: true }), 300);
  }

  async function place() {
    // Shopify-style: the button is always pressable; a failed attempt marks
    // every invalid field in red and jumps to the first one.
    const failures: Array<{ sel: string; msg: string }> = [];
    if (!firstName.trim()) failures.push({ sel: "#co-first-name", msg: "נא למלא שם פרטי" });
    if (lastNameRequired && !lastName.trim())
      failures.push({ sel: "#co-last-name", msg: "נא למלא שם משפחה" });
    if (!phone.trim() || !phoneLooksValid)
      failures.push({ sel: "#co-phone", msg: "מספר הטלפון אינו תקין. דוגמה: 0501234567" });
    if (method === "delivery" && !address.trim())
      failures.push({ sel: "#co-address", msg: "נא למלא רחוב ומספר" });
    if (method === "delivery" && !city)
      failures.push({ sel: "[data-co-city]", msg: "נא לבחור עיר" });
    if (emailRequired && !emailLooksValid)
      failures.push({ sel: "#co-email", msg: "כתובת המייל אינה תקינה" });
    if (!paymentMethod) failures.push({ sel: "[data-co-payment]", msg: "נא לבחור אמצעי תשלום" });
    if (!termsAccepted)
      failures.push({ sel: "[data-co-terms]", msg: "יש לאשר את התקנון ותנאי השימוש" });
    if (belowMin)
      failures.push({
        sel: "[data-co-payment]",
        msg: `חסר ${formatPrice(minOrder - subtotal)} לסכום המינימום להזמנה`,
      });

    if (failures.length > 0) {
      setSubmitAttempted(true);
      setPhoneTouched(true);
      setEmailTouched(true);
      setError(failures.length === 1 ? failures[0].msg : "יש להשלים את השדות המסומנים באדום");
      focusInvalidField(failures[0].sel);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/customer/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          tenant_slug: tenantSlug,
          method,
          delivery_city: method === "delivery" ? city || undefined : undefined,
          payment_method: paymentMethod,
          tip,
          cutlery_count: cutleryCount,
          scheduled_for: scheduledIso() ?? undefined,
          coupon_code: couponApplied?.code ?? undefined,
          applied_bundle_ids: acceptedBundles.length > 0 ? acceptedBundles.map((b) => b.id) : undefined,
          customer_notes: customerNotes || undefined,
          delivery_notes:
            method === "delivery" && (address || city || floor || apartment)
              ? [
                  [address, city].filter(Boolean).join(", "),
                  apartment ? `דירה ${apartment}` : "",
                  floor ? `קומה ${floor}` : "",
                  deliveryNotes,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : undefined,
          guest_phone: phone || undefined,
          guest_first_name: firstName || undefined,
          guest_last_name: lastName || undefined,
          customer_email: email.trim() || undefined,
          terms_accepted: termsAccepted,
          loyalty_consent: loyaltyCheckout.show ? loyaltyConsent : undefined,
          use_points: usePoints && pointsDiscount > 0 ? true : undefined,
          attribution_source:
            (typeof window !== "undefined" &&
              window.sessionStorage.getItem("qf:src-choice")) ||
            undefined,
          attribution_campaign_code:
            (typeof window !== "undefined" &&
              (window.sessionStorage.getItem("qf:src") ?? "").startsWith("qr_")
              ? window.sessionStorage.getItem("qf:src")!.slice(3)
              : undefined) || undefined,
          lines: lines
            .filter((l) => !l.deal)
            .map((l) => {
              const placements: Record<string, "left" | "right" | "full"> = {};
              for (const o of l.options) {
                if (o.half) placements[o.optionId] = o.half;
              }
              return {
                item_id: l.itemId,
                quantity: l.quantity,
                size_id: l.sizeId,
                option_ids: l.options.map((o) => o.optionId),
                option_placements: Object.keys(placements).length > 0 ? placements : undefined,
                notes: l.notes,
                source: l.source ?? "menu",
              };
            }),
          deals: lines
            .filter((l) => !!l.deal)
            .map((l) => ({
              deal_id: l.deal!.dealId,
              quantity: l.quantity,
              notes: l.notes,
              units: l.deal!.units.map((u) => ({
                slot_id: u.slotId,
                item_id: u.itemId,
                size_id: u.sizeId ?? null,
                option_ids: u.optionIds,
              })),
            })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(asErrorString(data?.error?.message, "שגיאה ביצירת הזמנה"));
        return;
      }
      const orderId = data.order.id as string;
      // Remember this order so guests can re-order it later from the
      // home screen rail. Logged-in customers see the same rail
      // server-rendered from the DB, but storing the id is harmless.
      recordRecentOrder(tenantSlug, orderId);
      if (typeof data.review_token === "string") {
        recordOrderToken(tenantSlug, orderId, data.review_token);
      }

      // For non-cash payments we need to render the Grow wallet inline
      // before navigating away. Initiate the payment and stash the
      // authCode - the SDK mount (rendered at the bottom of the form) will
      // overlay the wallet on top of the existing checkout view.
      if (data.needs_payment) {
        // Fast path: the create response already initiated payment inline
        // (saves a second round-trip). Use it when present.
        const inline = data.payment;
        if (inline?.sdk_auth_code) {
          setPendingPayment({
            orderId,
            authCode: inline.sdk_auth_code,
            thankYouUrl: `/s/${tenantSlug}/orders/${orderId}`,
            testMode: inline.test_mode !== false,
          });
          return;
        }
        if (inline?.payment_url) {
          setHostedPayment({
            paymentUrl: inline.payment_url,
            displayMode: inline.display_mode === "iframe" ? "iframe" : "redirect",
          });
          return;
        }
        // Fallback: initiate in a second call (inline path failed/skipped).
        try {
          const initRes = await fetch(
            `/api/v1/customer/orders/${orderId}/pay/initiate`,
            { method: "POST", credentials: "include" },
          );
          const initData = await initRes.json();
          if (!initRes.ok || (!initData?.sdk_auth_code && !initData?.payment_url)) {
            setError(
              asErrorString(
                initData?.error?.message,
                "לא הצלחנו לפתוח את שדה התשלום",
              ),
            );
            return;
          }
          if (initData.payment_url && !initData.sdk_auth_code) {
            setHostedPayment({
              paymentUrl: initData.payment_url,
              displayMode: initData.display_mode === "iframe" ? "iframe" : "redirect",
            });
            return;
          }
          // Keep the form intact + cart full so the user can retry if the
          // wallet errors. Cart is cleared by the SDK's onSuccess handler.
          setPendingPayment({
            orderId,
            authCode: initData.sdk_auth_code,
            thankYouUrl: `/s/${tenantSlug}/orders/${orderId}`,
            // Default to sandbox if the server didn't echo it back (safer
            // than assuming production).
            testMode: initData.test_mode !== false,
          });
          return;
        } catch {
          setError("שגיאה ביצירת תשלום");
          return;
        }
      }

      // Cash flow: skip straight to tracking.
      setSubmitted(true);
      clear();
      router.push(`/s/${tenantSlug}/orders/${orderId}`);
      // Don't fall through to `setBusy(false)` in finally - the route
      // change tears the component down anyway, and letting `busy` flip
      // back briefly would re-enable the CTA for one frame.
      return;
    } catch {
      setError("שגיאת רשת");
    } finally {
      setBusy(false);
    }
  }

  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  // Email is only required when the tenant needs it (reviews-by-email or the
  // "require email" checkout setting) - NOT just because the order is paid by
  // card. The payment provider (Grow/CardCom) issues and sends the tax invoice
  // and collects the email on its own page, so forcing it here is just friction.
  const onlinePayment = !!paymentMethod && paymentMethod !== "cash";
  const emailRequired = requireEmail;
  const lastNameRequired = onlinePayment;

  function validateIsraeliPhone(raw: string): boolean {
    const digits = raw.replace(/[^\d+]/g, "");
    if (/^\+?972[5][0-9]{8}$/.test(digits)) return true;
    if (/^05[0-9]{8}$/.test(digits)) return true;
    return false;
  }
  const phoneLooksValid = validateIsraeliPhone(phone);
  const phoneError =
    (phoneTouched || submitAttempted) && phone.trim() && !phoneLooksValid
      ? "מספר טלפון לא תקין - למשל 0501234567"
      : (phoneTouched || submitAttempted) && !phone.trim()
        ? "נדרש מספר טלפון"
        : null;
  const emailError =
    emailRequired && (emailTouched || submitAttempted) && email.trim() && !emailLooksValid
      ? "כתובת מייל לא תקינה"
      : emailRequired && submitAttempted && !email.trim()
        ? "נדרש דוא״ל"
        : null;
  const firstNameError =
    submitAttempted && !firstName.trim() ? "נא למלא שם פרטי" : null;
  const lastNameError =
    submitAttempted && lastNameRequired && !lastName.trim() ? "נא למלא שם משפחה" : null;
  const addressError =
    submitAttempted && method === "delivery" && !address.trim() ? "נא למלא רחוב ומספר" : null;
  const cityError =
    submitAttempted && method === "delivery" && !city ? "נא לבחור עיר" : null;
  const paymentError =
    submitAttempted && !paymentMethod ? "נא לבחור אמצעי תשלום" : null;
  const termsError =
    submitAttempted && !termsAccepted ? "יש לאשר את התקנון ותנאי השימוש" : null;

  const paymentInFlight = !!pendingPayment;
  // Zone-aware minimum (branch.minOrder already resolves to the customer's
  // zone via the cart). Block placing the order below it - matches the
  // server's min_order_not_met guard so the customer is told up-front.
  const minOrder = branch?.minOrder ?? 0;
  const belowMin = minOrder > 0 && subtotal < minOrder;
  // The button stays pressable while the form is incomplete - place()
  // paints the missing fields red and focuses the first one. Only an
  // in-flight submit/payment locks it (double-submit guard).
  const submitLocked = busy || paymentInFlight;

  // The terms modal is portaled to <body>, outside the storefront's
  // ThemeProvider, so CSS vars like --qf-primary fall back to the default
  // theme there. Resolve the tenant's actual theme colors to hex instead.
  const themeColors = THEMES[(tenant?.themeId as ThemeId)] ?? THEMES.fresh;

  const termsConsent = (
    <div>
    <label
      data-co-terms
      tabIndex={-1}
      className={cn(
        "flex items-start gap-2 text-xs leading-relaxed cursor-pointer outline-none rounded-lg",
        termsError ? "text-qf-tomato" : "text-qf-ink2",
      )}
    >
      <input
        type="checkbox"
        checked={termsAccepted}
        onChange={(e) => setTermsAccepted(e.target.checked)}
        aria-invalid={!!termsError || undefined}
        className={cn(
          "mt-0.5 w-4 h-4 shrink-0 accent-(--qf-primary)",
          termsError && "ring-2 ring-qf-tomato/60 rounded",
        )}
      />
      <span>
        קראתי ואני מאשר/ת את{" "}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setTermsOpen(true);
          }}
          className="font-medium text-(--qf-deep) underline underline-offset-2"
        >
          התקנון ותנאי השימוש
        </button>
      </span>
    </label>
    {termsError && (
      <div className="mt-1 text-xs font-medium text-qf-tomato" role="alert">
        {termsError}
      </div>
    )}
    </div>
  );

  const loyaltyConsentEl = loyaltyCheckout.show ? (
    <label className="flex items-start gap-2 text-xs text-qf-ink2 leading-relaxed cursor-pointer">
      <input
        type="checkbox"
        checked={loyaltyConsent}
        onChange={(e) => setLoyaltyConsent(e.target.checked)}
        className="mt-0.5 w-4 h-4 shrink-0 accent-(--qf-primary)"
      />
      <span>{loyaltyCheckout.text}</span>
    </label>
  ) : null;

  return (
    <div className="pb-32 bg-qf-bg/40 min-h-screen lg:bg-transparent lg:pb-12">
      <header className="px-5 pt-5 pb-3 flex items-center gap-3 bg-white border-b border-qf-line sticky top-0 z-10 lg:static lg:bg-transparent lg:border-0 lg:max-w-6xl lg:mx-auto lg:px-6 lg:pt-6 lg:pb-2">
        <Link
          href={`/s/${tenantSlug}/cart`}
          className="w-9 h-9 rounded-full border border-qf-line grid place-items-center lg:hidden"
          aria-label="חזרה"
        >
          <IcoChev s={18} />
        </Link>
        <h1 className="font-bold text-lg lg:text-3xl">סיום הזמנה</h1>
      </header>

      <div className="px-4 mt-4 space-y-3 lg:max-w-6xl lg:mx-auto lg:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6 lg:space-y-0 lg:mt-4"><div className="lg:col-start-1 space-y-3">
        {/* 1. Contact - promoted to the top */}
        <Card>
          <CardTitle>פרטי קשר</CardTitle>
          {loggedIn ? (
            <div className="mt-2 flex items-center gap-2 text-sm bg-qf-green-soft border border-qf-green-line text-qf-green-deep rounded-xl px-3 py-2">
              <IcoCheck c="currentColor" s={16} />
              <span className="font-medium truncate">
                מחובר{loginName ? ` כ${loginName}` : ""}
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setLoginOpen(true)}
              className="mt-2 w-full text-start text-sm bg-(--qf-soft) border border-qf-line rounded-xl px-3 py-2 hover:border-(--qf-primary)/40 transition"
            >
              כבר לקוח שלנו? <span className="font-bold text-(--qf-deep)">התחברו</span> והפרטים ימולאו אוטומטית
            </button>
          )}
          <div className="grid grid-cols-2 gap-3 mt-3">
            <Field label="שם פרטי" required error={firstNameError} errorId="co-first-name-error">
              <Input
                id="co-first-name"
                value={firstName}
                onChange={setFirstName}
                placeholder="ישראל"
                autoComplete="given-name"
                invalid={!!firstNameError}
                describedBy="co-first-name-error"
              />
            </Field>
            <Field label="שם משפחה" required={lastNameRequired} error={lastNameError} errorId="co-last-name-error">
              <Input
                id="co-last-name"
                value={lastName}
                onChange={setLastName}
                placeholder="ישראלי"
                autoComplete="family-name"
                invalid={!!lastNameError}
                describedBy="co-last-name-error"
              />
            </Field>
            <div className="col-span-2">
              <Field label="טלפון" required error={phoneError} errorId="co-phone-error">
                <Input
                  id="co-phone"
                  value={phone}
                  onChange={(v) => {
                    setPhone(v);
                    if (!phoneTouched) setPhoneTouched(true);
                  }}
                  onBlur={() => setPhoneTouched(true)}
                  placeholder="0501234567"
                  dir="ltr"
                  inputMode="tel"
                  autoComplete="tel"
                  invalid={!!phoneError}
                  describedBy="co-phone-error"
                />
              </Field>
            </div>
          </div>
        </Card>

        {/* 2. Fulfillment method. Only shown when the merchant offers BOTH
            delivery (has zones) and pickup - otherwise the method is fixed
            and a single-option toggle is just noise. Switching here flips
            the cart method, which re-renders the address/pickup card below
            and drops the delivery fee for pickup. */}
        {deliveryCities.length > 0 && pickupEnabled && (
          <Card>
            <CardTitle>שיטת קבלה</CardTitle>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <Pill active={method === "delivery"} onClick={() => setMethod("delivery")}>
                <span className="inline-flex items-center gap-1.5">
                  <IcoPin c="currentColor" s={15} />
                  משלוח
                </span>
              </Pill>
              <Pill active={method === "pickup"} onClick={() => setMethod("pickup")}>
                <span className="inline-flex items-center gap-1.5">
                  <IcoBag c="currentColor" s={15} />
                  איסוף עצמי
                </span>
              </Pill>
            </div>
          </Card>
        )}

        {/* 3. Delivery / pickup */}
        {method === "delivery" ? (
          <Card>
            <CardTitle>כתובת משלוח</CardTitle>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="col-span-2">
                <Field label="רחוב ומספר" required error={addressError} errorId="co-address-error">
                  <Input
                    id="co-address"
                    value={address}
                    onChange={setAddress}
                    placeholder="הרצל 12"
                    autoComplete="street-address"
                    invalid={!!addressError}
                    describedBy="co-address-error"
                  />
                </Field>
              </div>
              <div className="col-span-2" data-co-city tabIndex={-1}>
                <Field label="עיר" required error={cityError} errorId="co-city-error">
                  <CitySelect
                    cities={deliveryCities}
                    value={city}
                    onChange={(c) => {
                      setCity(c);
                      // Keep the remembered delivery choice in sync so the cart
                      // summary's zone-based fee/minimum matches what the server
                      // will charge for this city.
                      if (c) writeDeliveryChoice(tenantSlug, { kind: "delivery", city: c });
                    }}
                  />
                </Field>
              </div>
              <Field label="דירה">
                <Input value={apartment} onChange={setApartment} placeholder="12" />
              </Field>
              <Field label="קומה">
                <Input value={floor} onChange={setFloor} placeholder="3" />
              </Field>
              <div className="col-span-2">
                <Field label="הוראות לשליח">
                  <Input
                    value={deliveryNotes}
                    onChange={setDeliveryNotes}
                    placeholder="השאר ליד הדלת, להתקשר בהגעה"
                  />
                </Field>
              </div>
            </div>
          </Card>
        ) : (
          <Card>
            <CardTitle>פרטי איסוף</CardTitle>
            <p className="text-sm text-qf-ink2 mt-2">
              ההזמנה תהיה מוכנה לאיסוף מהסניף ברגע שתאושר על ידי המסעדה.
            </p>
          </Card>
        )}

        {/* Payment - collapsed to two top-level choices. All online methods
              (card / Bit / Apple Pay / Google Pay) are picked inside Grow's
              wallet when it opens, so showing them all here is noise. */}
        <Card>
          <div data-co-payment tabIndex={-1} className="outline-none">
          <CardTitle>אמצעי תשלום</CardTitle>
          {paymentError && (
            <div className="mt-2 text-xs font-medium text-qf-tomato" role="alert">
              {paymentError}
            </div>
          )}
          {methodsLoading ? (
            <div className="grid grid-cols-2 gap-2 mt-3" aria-hidden>
              <div className="h-14 rounded-2xl bg-qf-line-soft animate-pulse" />
              <div className="h-14 rounded-2xl bg-qf-line-soft animate-pulse" />
            </div>
          ) : availableMethods.length === 0 ? (
            <div className="text-xs text-qf-mute bg-qf-line-soft border border-qf-line-dash rounded-lg px-3 py-2 mt-3">
              המסעדה עוד לא הגדירה אמצעי תשלום. צור איתם קשר ישירות.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 mt-3">
                {availableMethods.includes("cash") && (
                  <Pill
                    active={paymentMethod === "cash"}
                    onClick={() => setPaymentMethod("cash")}
                  >
                    {PAYMENT_METHOD_LABELS.cash}
                  </Pill>
                )}
                {availableMethods.some((m) => m !== "cash") && (
                  <Pill
                    active={!!paymentMethod && paymentMethod !== "cash"}
                    onClick={() => {
                      // Always advertise as `card`; Grow's wallet shows
                      // whatever payment options the merchant has enabled
                      // (card form, Bit, Apple Pay, Google Pay) once it opens.
                      setPaymentMethod("card");
                    }}
                  >
                    תשלום אונליין
                  </Pill>
                )}
              </div>
              {paymentMethod && paymentMethod !== "cash" && (
                <div className="mt-2 text-xs text-qf-mute">
                  ניתן לשלם בכרטיס אשראי, Bit, Apple Pay ו-Google Pay.
                </div>
              )}
              {emailRequired && (
                <div className="mt-3">
                  <Field label="דוא״ל" required error={emailError} errorId="co-email-error">
                    <Input
                      id="co-email"
                      value={email}
                      onChange={(v) => {
                        setEmail(v);
                        if (!emailTouched) setEmailTouched(true);
                      }}
                      onBlur={() => setEmailTouched(true)}
                      placeholder="you@example.com"
                      dir="ltr"
                      inputMode="email"
                      autoComplete="email"
                      invalid={!!emailError}
                      describedBy="co-email-error"
                    />
                  </Field>
                  <div className="text-xs text-qf-mute mt-1">
                    נשלח אליך מייל קצר עם עדכונים על ההזמנה
                  </div>
                </div>
              )}
            </>
          )}
          </div>
        </Card>

        {/* 5. Tip (delivery only - pickup has no courier; merchant can hide it) */}
        {method === "delivery" && tenant.tipEnabled !== false && (
          <Card>
            <div className="flex items-baseline justify-between">
              <CardTitle>טיפ לשליח</CardTitle>
              <span className="text-xs text-qf-mute">אופציונלי</span>
            </div>
            <div className="grid grid-cols-4 gap-2 mt-3">
              {[0, 5, 10, 15].map((t) => (
                <Pill key={t} active={tip === t} onClick={() => setTip(t)}>
                  {t === 0 ? "ללא" : `+${formatPrice(t)}`}
                </Pill>
              ))}
            </div>
          </Card>
        )}

        {tenant.cutleryEnabled && (
          <Card>
            <div className="flex items-baseline justify-between">
              <CardTitle>{tenant.cutleryLabel || "סכו״ם חד״פ"}</CardTitle>
              <span className="text-xs text-qf-mute">אופציונלי</span>
            </div>
            {cutleryFreeUnlocked && cutleryCount > 0 && (
              <div className="text-xs text-qf-green-deep mt-2">
                כלול חינם להזמנה מעל {formatPrice(cutleryFreeAbove!)}
              </div>
            )}
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="text-sm">
                <div className="font-medium">להוסיף סטים?</div>
                <div className="text-xs text-qf-mute mt-0.5">
                  {cutleryUnitPrice > 0 && !cutleryFreeUnlocked
                    ? `${formatPrice(cutleryUnitPrice)} לסט`
                    : "ללא עלות"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="פחות"
                  onClick={() => setCutleryCount((c) => Math.max(0, c - 1))}
                  disabled={cutleryCount === 0}
                  className="w-9 h-9 rounded-full border border-qf-line-dash text-lg leading-none disabled:opacity-40"
                >
                  −
                </button>
                <div className="w-8 text-center font-semibold tnum">{cutleryCount}</div>
                <button
                  type="button"
                  aria-label="עוד"
                  onClick={() => setCutleryCount((c) => Math.min(20, c + 1))}
                  className="w-9 h-9 rounded-full border border-qf-line-dash text-lg leading-none"
                >
                  +
                </button>
              </div>
            </div>
          </Card>
        )}

        {/* 5b. Schedule order. Hidden entirely when the merchant disabled
            scheduled orders in dashboard settings - keeps fast-food queues
            sane. */}
        {tenant.scheduledOrdersEnabled !== false && (
          <Card>
            <div className="flex items-baseline justify-between">
              <CardTitle>זמן {method === "delivery" ? "משלוח" : "איסוף"}</CardTitle>
              <span className="text-xs text-qf-mute">אופציונלי</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <Pill
                active={!showSlots && !scheduledTime}
                onClick={() => {
                  setScheduledTime("");
                  setShowSlots(false);
                }}
              >
                בהקדם האפשרי
              </Pill>
              <Pill
                active={showSlots || !!scheduledTime}
                onClick={() => setShowSlots(true)}
              >
                {scheduledTime ? `תזמן · ${scheduledTime}` : "תזמן לשעה"}
              </Pill>
            </div>
            {showSlots && (
              <div className="mt-3">
                {scheduleSlots.length > 0 ? (
                  <>
                    <p className="text-xs text-qf-mute mb-2">
                      בחר שעת {method === "delivery" ? "מסירה" : "איסוף"} להיום
                    </p>
                    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
                      {scheduleSlots.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setScheduledTime(slot)}
                          className={cn(
                            "shrink-0 snap-start px-4 h-11 rounded-xl text-sm font-semibold border transition tnum active:scale-[0.98]",
                            scheduledTime === slot
                              ? "bg-(--qf-primary) text-white border-transparent shadow-sm shadow-(--qf-primary)/25"
                              : "bg-white text-qf-ink2 border-qf-line hover:border-(--qf-primary)/40",
                          )}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-qf-mute mt-2">
                    לא נותרו שעות פנויות להיום - בחר &quot;בהקדם האפשרי&quot;.
                  </p>
                )}
              </div>
            )}
          </Card>
        )}

        {/* 5c. Coupon code */}
        <Card>
          <div className="flex items-baseline justify-between">
            <CardTitle>קוד הנחה</CardTitle>
            {couponApplied && (
              <button
                type="button"
                onClick={clearCoupon}
                className="text-xs text-qf-mute hover:text-qf-tomato"
              >
                הסר קופון
              </button>
            )}
          </div>
          {couponApplied ? (
            <div className="mt-3 bg-qf-green-soft border border-qf-green-deep/20 rounded-2xl px-4 py-3 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="font-semibold text-qf-green-deep tnum">
                  {couponApplied.code}
                </span>
                <span className="text-xs text-qf-ink2">{couponApplied.message}</span>
              </div>
              <span className="font-bold tnum text-qf-green-deep">
                −{formatPrice(couponApplied.discount)}
              </span>
            </div>
          ) : (
            <div className="mt-3 flex gap-2">
              <input
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void applyCoupon();
                  }
                }}
                placeholder="הקלד קוד"
                maxLength={40}
                dir="ltr"
                className="flex-1 bg-qf-bg border border-qf-line rounded-2xl px-4 py-3 text-base text-right outline-none focus:border-(--qf-primary) focus:bg-white transition tnum"
              />
              <button
                type="button"
                onClick={applyCoupon}
                disabled={!couponCode.trim() || couponBusy}
                className="px-5 rounded-2xl bg-qf-ink text-white text-sm font-semibold disabled:opacity-50 transition"
              >
                {couponBusy ? "..." : "החל"}
              </button>
            </div>
          )}
          {couponError && (
            <div className="mt-2 text-xs text-qf-tomato">{couponError}</div>
          )}
        </Card>

        {/* Loyalty points - shown only to a logged-in member of a club with
            redemption on and enough balance. */}
        {loyalty && (
          <Card>
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <div className="min-w-0">
                <CardTitle>נקודות מועדון</CardTitle>
                <div className="text-xs text-qf-mute mt-1">
                  יש לך {loyalty.balance.toLocaleString("he-IL")} נקודות בשווי{" "}
                  {formatPrice(Math.floor((loyalty.balance * loyalty.pointValueAgorot) / 100))}
                </div>
                {usePoints && pointsDiscount > 0 && (
                  <div className="text-xs font-semibold text-qf-green-deep mt-1 tnum">
                    ינוצלו {pointsQuote.points.toLocaleString("he-IL")} נקודות = −
                    {formatPrice(pointsDiscount)} בהזמנה זו
                  </div>
                )}
              </div>
              <Toggle
                checked={usePoints}
                onChange={setUsePoints}
                aria-label="מימוש נקודות מועדון"
              />
            </label>
          </Card>
        )}

        {/* 6. Notes */}
        <Card>
          <CardTitle>הערה למסעדה</CardTitle>
          <textarea
            value={customerNotes}
            onChange={(e) => setCustomerNotes(e.target.value)}
            rows={2}
            placeholder="הערות למסעדה"
            className="w-full mt-3 bg-qf-bg border border-qf-line rounded-2xl px-4 py-3 text-base outline-none focus:border-(--qf-primary) focus:bg-white resize-none transition"
          />
        </Card>

        {/* How did you hear about us - non-blocking, skippable. Merchant can
            hide it in Settings -> Checkout. */}
        {showAttribution && <AttributionPrompt tenantSlug={tenantSlug} />}

        {/* Order summary - rendered LAST on mobile (just before the error +
            footer CTA) so the customer scrolls past every input first.
            Desktop has the same content as a sticky sidebar (below). */}
        <div className="lg:hidden">
          <Card>
          <div className="flex items-baseline justify-between">
            <CardTitle>סיכום הזמנה</CardTitle>
            <Link
              href={`/s/${tenantSlug}/cart`}
              className="text-xs text-(--qf-deep) font-medium hover:underline"
            >
              עריכת סל
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-qf-line-soft">
            {lines.map((l) => {
              const opts = l.options.reduce((a, o) => a + o.priceDelta, 0);
              const unit = l.basePrice + l.sizeDelta + opts;
              const lineTotal = unit * l.quantity;
              return (
                <li key={l.lineId} className="py-2.5 flex gap-3 items-start">
                  <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0">
                    <MenuItemImage
                      src={l.imageUrl ?? undefined}
                      alt={l.name}
                      businessType={businessType}
                      size={56}
                      rounded="xl"
                      fill
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-sm leading-tight">{l.name}</div>
                      <div className="text-sm tnum font-medium shrink-0">
                        {formatPrice(lineTotal)}
                      </div>
                    </div>
                    {l.sizeName && (
                      <div className="text-xs text-qf-mute mt-0.5">{l.sizeName}</div>
                    )}
                    <CartLineOptions options={l.options} />
                    <div className="text-xs text-qf-ink2 mt-1 tnum">× {l.quantity}</div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-3 pt-3 border-t border-qf-line-soft space-y-1.5 text-sm">
            <SumRow label={`${itemCount} פריטים`} value={formatPrice(subtotal)} />
            {method === "delivery" && (
              <SumRow label="דמי משלוח" value={deliveryFee === 0 ? "חינם" : formatPrice(deliveryFee)} />
            )}
            {serviceFee > 0 && <SumRow label="דמי שירות" value={formatPrice(serviceFee)} />}
            {cutleryFee > 0 && (
              <SumRow
                label={`${tenant.cutleryLabel || "סכו״ם חד״פ"} × ${cutleryCount}`}
                value={formatPrice(cutleryFee)}
              />
            )}
            {tip > 0 && <SumRow label="טיפ לשליח" value={formatPrice(tip)} />}
            {bundleDiscount > 0 && (
              <SumRow
                label="הנחת מבצע"
                value={`−${formatPrice(bundleDiscount)}`}
                tone="discount"
              />
            )}
            {couponApplied && (
              <SumRow
                label={`קופון ${couponApplied.code}`}
                value={`−${formatPrice(couponApplied.discount)}`}
                tone="discount"
              />
            )}
            {pointsDiscount > 0 && (
              <SumRow
                label={`נקודות מועדון (${pointsQuote.points.toLocaleString("he-IL")})`}
                value={`−${formatPrice(pointsDiscount)}`}
                tone="discount"
              />
            )}
            <div className="pt-2 border-t border-qf-line-soft flex items-center justify-between">
              <div className="font-semibold">סה״כ לתשלום</div>
              <div className="font-bold tnum text-lg">{formatPrice(total)}</div>
            </div>
          </div>
          </Card>
        </div>

        {error && (
          <div className="bg-qf-tomato-soft border border-qf-tomato/40 text-qf-tomato text-sm rounded-xl px-3 py-2">
            {error}
          </div>
        )}
        </div>{/* end left column */}

        {/* Desktop sidebar - sticky order summary + CTA. Hidden on mobile,
            which keeps the inline summary + fixed-footer CTA instead. */}
        <aside className="hidden lg:block lg:col-start-2 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardTitle>סיכום הזמנה</CardTitle>
            <ul className="mt-3 divide-y divide-qf-line-soft">
              {lines.map((l) => {
                const opts = l.options.reduce((a, o) => a + o.priceDelta, 0);
                const unit = l.basePrice + l.sizeDelta + opts;
                const lineTotal = unit * l.quantity;
                return (
                  <li key={l.lineId} className="py-2.5 flex gap-3 items-start">
                    <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0">
                      <MenuItemImage
                        src={l.imageUrl ?? undefined}
                        alt={l.name}
                        businessType={businessType}
                        size={48}
                        rounded="md"
                        fill
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium text-sm leading-tight">{l.name}</div>
                        <div className="text-sm tnum font-medium shrink-0">{formatPrice(lineTotal)}</div>
                      </div>
                      {l.sizeName && (
                        <div className="text-xs text-qf-mute mt-0.5">{l.sizeName}</div>
                      )}
                      <CartLineOptions options={l.options} />
                      <div className="text-xs text-qf-ink2 mt-0.5 tnum">× {l.quantity}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 pt-3 border-t border-qf-line-soft space-y-1.5 text-sm">
              <SumRow label={`${itemCount} פריטים`} value={formatPrice(subtotal)} />
              {method === "delivery" && (
                <SumRow label="דמי משלוח" value={deliveryFee === 0 ? "חינם" : formatPrice(deliveryFee)} />
              )}
              {serviceFee > 0 && <SumRow label="דמי שירות" value={formatPrice(serviceFee)} />}
            {cutleryFee > 0 && (
              <SumRow
                label={`${tenant.cutleryLabel || "סכו״ם חד״פ"} × ${cutleryCount}`}
                value={formatPrice(cutleryFee)}
              />
            )}
              {tip > 0 && <SumRow label="טיפ לשליח" value={formatPrice(tip)} />}
            {bundleDiscount > 0 && (
              <SumRow
                label="הנחת מבצע"
                value={`−${formatPrice(bundleDiscount)}`}
                tone="discount"
              />
            )}
            {couponApplied && (
              <SumRow
                label={`קופון ${couponApplied.code}`}
                value={`−${formatPrice(couponApplied.discount)}`}
                tone="discount"
              />
            )}
            {pointsDiscount > 0 && (
              <SumRow
                label={`נקודות מועדון (${pointsQuote.points.toLocaleString("he-IL")})`}
                value={`−${formatPrice(pointsDiscount)}`}
                tone="discount"
              />
            )}
              <div className="pt-2 border-t border-qf-line-soft flex items-center justify-between">
                <div className="font-semibold">סה״כ לתשלום</div>
                <div className="font-bold tnum text-lg">{formatPrice(total)}</div>
              </div>
            </div>
            {belowMin && (
              <div className="mt-4 bg-qf-tomato-soft border border-qf-tomato/40 text-qf-tomato text-sm rounded-xl px-3 py-2 text-center">
                חסר {formatPrice(minOrder - subtotal)} לסכום מינימום ({formatPrice(minOrder)})
              </div>
            )}
            <div className="mt-3">{termsConsent}</div>
            {loyaltyConsentEl && <div className="mt-2">{loyaltyConsentEl}</div>}
            <button
              type="button"
              onClick={onPlaceClick}
              disabled={submitLocked}
              className="w-full mt-3 bg-(--qf-primary) hover:bg-(--qf-deep) disabled:bg-qf-mute disabled:shadow-none text-white rounded-2xl px-5 h-14 text-base font-semibold flex items-center justify-between shadow-sm shadow-(--qf-primary)/25 transition"
            >
              <span className="inline-flex items-center gap-2">
                {(busy || paymentInFlight) && (
                  <span className="qf-spinner text-white text-base" aria-hidden />
                )}
                <span>
                  {busy
                    ? "שולח..."
                    : paymentInFlight
                      ? walletOpen
                        ? "ממתין לתשלום..."
                        : "פותח תשלום..."
                      : paymentMethod === "cash"
                        ? "בצע הזמנה"
                        : "לשלם כעת"}
                </span>
                {!busy && !paymentInFlight && <IcoArrowLeft c="#fff" s={16} />}
              </span>
              <span className="tnum text-lg">{formatPrice(total)}</span>
            </button>
          </Card>
        </aside>
      </div>

      {/* Fixed CTA - mobile only (desktop uses the sidebar above). */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 max-w-md mx-auto bg-white border-t border-qf-line px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {belowMin && (
          <div className="mb-2 bg-qf-tomato-soft border border-qf-tomato/40 text-qf-tomato text-sm rounded-xl px-3 py-2 text-center">
            חסר {formatPrice(minOrder - subtotal)} לסכום מינימום ({formatPrice(minOrder)})
          </div>
        )}
        <div className="mb-2.5">{termsConsent}</div>
        {loyaltyConsentEl && <div className="mb-2.5">{loyaltyConsentEl}</div>}
        <button
          type="button"
          onClick={onPlaceClick}
          disabled={submitLocked}
          className="w-full bg-(--qf-primary) hover:bg-(--qf-deep) disabled:bg-qf-mute disabled:shadow-none text-white rounded-2xl px-5 h-16 text-base font-semibold flex items-center justify-between shadow-lg shadow-(--qf-primary)/25 transition active:scale-[0.99]"
        >
          <span className="inline-flex items-center gap-2">
            {(busy || paymentInFlight) && (
              <span className="qf-spinner text-white text-base" aria-hidden />
            )}
            <span>
              {busy
                ? "שולח..."
                : paymentInFlight
                  ? walletOpen
                    ? "ממתין לתשלום..."
                    : "פותח תשלום..."
                  : paymentMethod === "cash"
                    ? "בצע הזמנה"
                    : "לשלם כעת"}
            </span>
            {!busy && !paymentInFlight && <IcoArrowLeft c="#fff" s={16} />}
          </span>
          <span className="tnum text-lg">{formatPrice(total)}</span>
        </button>
      </div>

      {/* Grow wallet - pre-loaded on page mount when the tenant has Grow
          enabled, so the SDK has ~1s to do its async setup while the
          customer fills out the form. The wallet itself only renders when
          we trigger `renderGrowWallet(authCode)` after /pay/initiate. */}
      {provider === "cardcom" && hostedPayment?.displayMode === "iframe" && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4"
        >
          <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-qf-line">
              <span className="font-bold text-sm">תשלום מאובטח</span>
              <button
                type="button"
                onClick={() => setHostedPayment(null)}
                className="text-sm text-qf-mute hover:text-qf-ink"
              >
                סגירה
              </button>
            </div>
            <HostedPaymentFrame
              paymentUrl={hostedPayment.paymentUrl}
              displayMode="iframe"
              heightPx={560}
            />
          </div>
        </div>
      )}
      {provider === "cardcom" && hostedPayment?.displayMode === "redirect" && (
        <HostedPaymentFrame
          paymentUrl={hostedPayment.paymentUrl}
          displayMode="redirect"
        />
      )}
      {provider === "grow" && cardEnabled && (
        <GrowPaymentSdk
          testMode={pendingPayment?.testMode ?? testMode}
          thankYouUrl={pendingPayment?.thankYouUrl ?? `/s/${tenantSlug}`}
          onReady={() => setSdkReady(true)}
          onSuccess={() => {
            // Empty the cart on a successful wallet payment. The SDK does a
            // full-page redirect right after, so the persist-effect won't run -
            // remove the stored cart synchronously, then clear React state too.
            try {
              localStorage.removeItem(`qf:cart:${tenantSlug}`);
            } catch {
              /* private mode / blocked storage - ignore */
            }
            clear();
          }}
          onWalletChange={(state) => setWalletOpen(state === "open")}
          onError={(message) => {
            // Only surface the error if we actually have an in-flight
            // payment - pre-mount SDK errors (none of our business) get
            // silently logged via the console hooks in GrowPaymentSdk.
            if (pendingPayment) {
              setError(asErrorString(message, "התשלום נכשל. אפשר לנסות שוב."));
              setPendingPayment(null);
            }
          }}
        />
      )}
      {busyAlertOpen && (
        <BusyAlertModal
          boostMinutes={branch?.busyEtaBoostMinutes ?? 15}
          ctaLabel="הבנתי, המשך להזמין"
          onClose={ackBusyAndPlace}
        />
      )}

      <Modal
        open={termsOpen}
        onClose={() => setTermsOpen(false)}
        size="2xl"
        ariaLabel="תקנון ותנאי שימוש"
        className="border-2 border-black shadow-[0_10px_40px_rgba(0,0,0,0.45)] overflow-hidden"
      >
        <div
          className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 border-b-2 border-black"
          style={{ backgroundColor: themeColors.primary }}
        >
          <h2 className="font-bold text-lg text-white">תקנון ותנאי שימוש</h2>
          <button
            type="button"
            onClick={() => setTermsOpen(false)}
            aria-label="סגור"
            className="shrink-0 w-10 h-10 rounded-full bg-white grid place-items-center border-2 border-black shadow-[0_2px_0_#000] active:translate-y-px active:shadow-none transition"
            style={{ color: themeColors.deep }}
          >
            <IcoClose s={22} />
          </button>
        </div>
        <ModalBody>
          <LegalText text={termsText} />
        </ModalBody>
      </Modal>

      <Modal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        size="sm"
        ariaLabel="התחברות"
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-qf-line-soft">
          <h2 className="font-bold text-lg">התחברות</h2>
          <button
            type="button"
            onClick={() => setLoginOpen(false)}
            aria-label="סגור"
            className="shrink-0 w-9 h-9 rounded-full grid place-items-center text-qf-mute hover:bg-qf-line-soft transition"
          >
            <IcoClose s={20} />
          </button>
        </div>
        <ModalBody>
          <p className="text-sm text-qf-mute text-center mb-4">
            נשלח קוד אימות בוואטסאפ והפרטים שלך ימולאו אוטומטית
          </p>
          <CustomerOtpLogin tenantSlug={tenantSlug} onSuccess={handleLoginSuccess} />
        </ModalBody>
      </Modal>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-qf-line p-4 shadow-xs">
      {children}
    </div>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-semibold text-base">{children}</h2>;
}

function Field({
  label,
  required,
  error,
  errorId,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string | null;
  /** Links the error text to the input via aria-describedby. */
  errorId?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-qf-ink2 mb-1.5">
        {label}
        {required && <span className="text-qf-tomato"> *</span>}
      </div>
      {children}
      {error && (
        <div id={errorId} className="mt-1.5 text-xs font-medium text-qf-tomato" role="alert">
          {error}
        </div>
      )}
    </label>
  );
}

function Input({
  id,
  value,
  onChange,
  onBlur,
  placeholder,
  dir,
  inputMode,
  autoComplete,
  invalid,
  describedBy,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder: string;
  dir?: "ltr" | "rtl";
  inputMode?: "tel" | "text" | "email" | "numeric";
  autoComplete?: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  return (
    <input
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      dir={dir}
      inputMode={inputMode}
      autoComplete={autoComplete}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid && describedBy ? describedBy : undefined}
      className={
        "w-full bg-white border rounded-2xl px-4 h-14 text-base outline-none placeholder:text-qf-mute transition " +
        (invalid
          ? "border-qf-tomato focus:border-qf-tomato focus:ring-2 focus:ring-qf-tomato/20"
          : "border-qf-line focus:border-(--qf-primary) focus:ring-2 focus:ring-(--qf-primary)/15")
      }
    />
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 h-14 rounded-2xl text-sm transition border font-semibold active:scale-[0.98]",
        active
          ? "bg-(--qf-primary) text-white border-transparent shadow-sm shadow-(--qf-primary)/25"
          : "bg-white text-qf-ink2 border-qf-line hover:border-(--qf-primary)/40",
      )}
    >
      {children}
    </button>
  );
}

function SumRow({
  label,
  value,
  bold,
  tone,
}: {
  label: string;
  value: string;
  bold?: boolean;
  tone?: "discount";
}) {
  const valueClass =
    tone === "discount"
      ? "tnum text-qf-green-deep font-semibold"
      : bold
        ? "font-bold tnum text-base"
        : "tnum";
  return (
    <div className="flex items-center justify-between">
      <div className={bold ? "font-semibold" : "text-qf-ink2"}>{label}</div>
      <div className={valueClass}>{value}</div>
    </div>
  );
}

/**
 * Coerce anything that came back from an API/SDK error to a renderable
 * string. We've seen Grow occasionally return `message` as a `{id, message}`
 * object - without this, React error #31 ("object with keys {id, message}")
 * fires the moment we drop it into <div>{error}</div>.
 */
function asErrorString(value: unknown, fallback: string): string {
  if (typeof value === "string" && value) return value;
  if (value == null) return fallback;
  if (typeof value === "object") {
    const obj = value as { message?: unknown };
    if (typeof obj.message === "string" && obj.message) return obj.message;
  }
  return fallback;
}

function ProcessingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8 text-center bg-qf-bg/60">
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-16 h-16 rounded-full bg-white shadow-lg grid place-items-center"
          aria-hidden
        >
          <span className="qf-spinner text-(--qf-primary) text-2xl" />
        </div>
        <div>
          <div className="font-bold text-lg">מעבד את ההזמנה...</div>
          <div className="text-sm text-qf-mute mt-1">רק שניה, מעביר אותך למסך המעקב</div>
        </div>
      </div>
    </div>
  );
}

