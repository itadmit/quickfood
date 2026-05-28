"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, MapPin, User, Check, X } from "lucide-react";
import { IcoArrowLeft, IcoArrowRight } from "@/components/shared/Icons";
import { THEMES, type ThemeId } from "@/lib/themes";
import { type BusinessType } from "@/components/shared/MenuItemImage";
import { BusinessTypeSelect } from "@/components/shared/BusinessTypeSelect";
import { cn } from "@/lib/cn";

type SlugStatus = "idle" | "checking" | "available" | "taken" | "invalid" | "reserved" | "too_short";

export function SignupForm() {
  const router = useRouter();
  // Step 0 = optional "do you have Wolt?" pre-fill — initial view.
  // Steps 1-3 = the actual wizard (business details, branding, owner).
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wolt URL the merchant pasted on Step 0 — kept so we can pass it
  // through to /dashboard after signup and auto-trigger the menu
  // import in the welcome overlay.
  const [woltUrl, setWoltUrl] = useState("");

  // Step 1
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState<BusinessType>("general");
  const [cuisineType, setCuisineType] = useState("");
  const [themeId, setThemeId] = useState<ThemeId>("fresh");
  const [slug, setSlug] = useState("");
  const [slugStatus, setSlugStatus] = useState<SlugStatus>("idle");

  // Live slug availability check (debounced 350ms)
  useEffect(() => {
    if (!slug || slug.length < 2) {
      const id = setTimeout(() => setSlugStatus("idle"), 0);
      return () => clearTimeout(id);
    }
    const tStart = setTimeout(() => setSlugStatus("checking"), 0);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/auth/check-slug?slug=${encodeURIComponent(slug)}`);
        if (!res.ok) return;
        const d = (await res.json()) as { status: SlugStatus; slug: string };
        // Guard against race conditions (another change happened mid-flight)
        if (d.slug === slug.toLowerCase().trim()) setSlugStatus(d.status);
      } catch {
        /* ignore */
      }
    }, 350);
    return () => {
      clearTimeout(tStart);
      clearTimeout(t);
    };
  }, [slug]);

  // Step 2
  const [branchAddress, setBranchAddress] = useState("");
  const [branchPhone, setBranchPhone] = useState("");

  // Step 3
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");

  function autoSlug(v: string) {
    // simple Hebrew ← slug
    const map: Record<string, string> = {};
    const ascii = v
      .toLowerCase()
      .split("")
      .map((c) => map[c] ?? (/^[a-z0-9]$/.test(c) ? c : "-"))
      .join("")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    return ascii.slice(0, 40);
  }

  function onNameChange(v: string) {
    setBusinessName(v);
    if (!slug || slug === autoSlug(businessName)) setSlug(autoSlug(v));
  }

  // Step 1 covers all business identity + contact details, so it
  // gates on name, slug, address, and phone all being valid.
  const canNext1 =
    businessName.length >= 2 &&
    slug.length >= 2 &&
    slugStatus === "available" &&
    branchAddress.length >= 3 &&
    branchPhone.length >= 7;
  // Step 2 is branding only (theme picker) — always has a default
  // selection, so the merchant can always proceed.
  const canNext2 = true;
  const canSubmit =
    ownerName.length >= 1 &&
    /\S+@\S+\.\S+/.test(ownerEmail) &&
    ownerPassword.length >= 8;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          business_name: businessName,
          slug,
          business_type: businessType,
          theme_id: themeId,
          cuisine_type: cuisineType || undefined,
          branch_address: branchAddress,
          branch_phone: branchPhone,
          owner_name: ownerName,
          owner_email: ownerEmail.toLowerCase(),
          owner_password: ownerPassword,
          client_type: "web",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const field = data.error?.field;
        setError(data.error?.message ?? "ההרשמה נכשלה");
        if (field === "slug") setStep(1);
        if (field === "owner_email") setStep(3);
        return;
      }
      // If the merchant pasted a Wolt URL on Step 0, append it to the
      // dashboard URL so the welcome overlay can pre-trigger the menu
      // import without making them paste it again.
      const dest = data.redirect ?? "/dashboard";
      const withWolt = woltUrl
        ? `${dest}${dest.includes("?") ? "&" : "?"}wolt=${encodeURIComponent(woltUrl)}`
        : dest;
      router.push(withWolt);
      router.refresh();
    } catch {
      setError("שגיאת רשת");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Step indicator only after the optional Wolt pre-step. The
          pre-step itself feels like a shortcut, not "Step 0 of 4". */}
      {step > 0 && (
        <>
          <StepIndicator step={step as 1 | 2 | 3} />
          <div className="text-xs font-bold text-black/65">
            שלב {step} מתוך 3
          </div>
        </>
      )}

      <div className="space-y-5">
        {step === 0 && (
          <Step0
            woltUrl={woltUrl}
            setWoltUrl={setWoltUrl}
            onImported={(info) => {
              setBusinessName(info.name);
              setSlug(autoSlug(info.name));
              if (info.address) setBranchAddress(info.address);
              if (info.phone) setBranchPhone(info.phone);
              // Skip past Step 1 — Wolt filled all the business
              // details. Land on Step 2 (branding).
              setStep(2);
            }}
            onSkip={() => {
              setWoltUrl("");
              setStep(1);
            }}
          />
        )}

        {step === 1 && (
          <Step1
            businessName={businessName}
            onBusinessName={onNameChange}
            businessType={businessType}
            setBusinessType={setBusinessType}
            cuisineType={cuisineType}
            setCuisineType={setCuisineType}
            slug={slug}
            setSlug={setSlug}
            slugStatus={slugStatus}
            address={branchAddress}
            setAddress={setBranchAddress}
            phone={branchPhone}
            setPhone={setBranchPhone}
          />
        )}

        {step === 2 && (
          <Step2 themeId={themeId} setThemeId={setThemeId} />
        )}

        {step === 3 && (
          <Step3
            name={ownerName}
            setName={setOwnerName}
            email={ownerEmail}
            setEmail={setOwnerEmail}
            password={ownerPassword}
            setPassword={setOwnerPassword}
          />
        )}

        {error && (
          <div className="bg-qf-tomato-soft border border-qf-tomato/40 text-qf-tomato text-sm rounded-xl px-3 py-2">
            {error}
          </div>
        )}
      </div>

      {step > 0 && (
        <div className="pt-1 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => (step > 1 ? setStep((step - 1) as 1 | 2 | 3) : router.push("/"))}
          className="text-sm font-bold text-black/65 hover:text-black inline-flex items-center gap-1.5"
        >
          <IcoArrowRight c="currentColor" s={14} />
          {step > 1 ? "חזרה" : "לעמוד הבית"}
        </button>

        {step < 3 ? (
          <button
            type="button"
            disabled={step === 1 ? !canNext1 : !canNext2}
            onClick={() => setStep(((step as number) + 1) as 1 | 2 | 3)}
            className="px-5 py-3 rounded-xl bg-[#F8CB1E] hover:bg-[#ffd84a] text-black text-base font-black border-2 border-black shadow-[0_3px_0_#000] hover:shadow-[0_4px_0_#000] active:translate-y-px active:shadow-[0_2px_0_#000] transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            המשך
            <IcoArrowLeft c="currentColor" s={16} />
          </button>
        ) : (
          <button
            type="button"
            disabled={!canSubmit || busy}
            onClick={submit}
            className="px-5 py-3 rounded-xl bg-[#F8CB1E] hover:bg-[#ffd84a] text-black text-base font-black border-2 border-black shadow-[0_3px_0_#000] hover:shadow-[0_4px_0_#000] active:translate-y-px active:shadow-[0_2px_0_#000] transition disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {busy ? (
              <>
                <span className="qf-spinner" aria-hidden />
                <span>פותח חנות…</span>
              </>
            ) : (
              <>
                <span>פתיחת חנות</span>
                <IcoArrowLeft c="currentColor" s={16} />
              </>
            )}
          </button>
        )}
        </div>
      )}

      <p className="text-[10px] text-qf-mute/80 text-center pt-1">
        בהמשך אתה מסכים ל-
        <a href="/terms" className="underline">תנאי השימוש</a>
        {" "}ול-{" "}
        <a href="/privacy" className="underline">מדיניות הפרטיות</a>
      </p>
    </div>
  );
}

// ─── Step 0: optional Wolt pre-fill ────────────────────────

interface WoltPreview {
  name: string;
  address: string | null;
  phone: string | null;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
}

function Step0({
  woltUrl,
  setWoltUrl,
  onImported,
  onSkip,
}: {
  woltUrl: string;
  setWoltUrl: (v: string) => void;
  onImported: (info: WoltPreview) => void;
  onSkip: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchPreview() {
    const url = woltUrl.trim();
    if (!url || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/signup/wolt-preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "כשל בקריאה מ-Wolt");
        return;
      }
      onImported(data as WoltPreview);
    } catch {
      setError("שגיאת רשת");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h3 className="text-lg lg:text-xl font-black text-black">
          כבר יש לכם חנות בוולט?
        </h3>
        <p className="text-sm text-black/65 leading-relaxed">
          הדביקו את כתובת החנות שלכם בוולט ונייבא בשבילכם את שם העסק,
          הכתובת, הטלפון, הלוגו והתפריט המלא. תוך כמה שניות תהיו עם
          חנות מוכנה.
        </p>
      </div>

      <Field label="כתובת החנות בוולט" hint="https://wolt.com/he/...">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={woltUrl}
            onChange={(e) => setWoltUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                fetchPreview();
              }
            }}
            dir="ltr"
            placeholder="https://wolt.com/he/isr/tel-aviv/restaurant/..."
            className="flex-1 min-w-0 px-3.5 py-3 rounded-xl border-2 border-black bg-[#FFFBEC] hover:bg-white focus:bg-white focus:border-black focus:shadow-[0_0_0_3px_#F8CB1E] outline-none transition font-mono text-sm text-black placeholder:text-black/35 placeholder:font-normal"
          />
          <button
            type="button"
            onClick={fetchPreview}
            disabled={!woltUrl.trim() || busy}
            className="shrink-0 px-5 py-3 rounded-xl bg-[#F8CB1E] hover:bg-[#ffd84a] text-black text-base font-black border-2 border-black shadow-[0_3px_0_#000] hover:shadow-[0_4px_0_#000] active:translate-y-px active:shadow-[0_2px_0_#000] transition disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          >
            {busy ? (
              <>
                <span className="qf-spinner" aria-hidden />
                <span>טוען…</span>
              </>
            ) : (
              "ייבוא מוולט"
            )}
          </button>
        </div>
      </Field>

      {error && (
        <div className="bg-[#FFE2DC] border-2 border-black text-black text-sm font-bold rounded-xl px-3 py-2.5 shadow-[0_2px_0_#000]">
          {error}
        </div>
      )}

      {/* Divider */}
      <div className="relative flex items-center gap-3 py-1">
        <div className="flex-1 h-0.5 bg-black/15" />
        <span className="text-xs font-bold text-black/55 tracking-wider">או</span>
        <div className="flex-1 h-0.5 bg-black/15" />
      </div>

      <button
        type="button"
        onClick={onSkip}
        className="block w-full text-center py-3 rounded-xl bg-white border-2 border-black hover:bg-[#FFFBEC] text-sm font-bold text-black shadow-[0_3px_0_#000] hover:shadow-[0_4px_0_#000] active:translate-y-px active:shadow-[0_2px_0_#000] transition"
      >
        אני מתחיל מאפס — מילוי ידני
      </button>
    </div>
  );
}

// ─── Step 1: branding ────────────────────────────────────────

function Step1({
  businessName,
  onBusinessName,
  businessType,
  setBusinessType,
  cuisineType,
  setCuisineType,
  slug,
  setSlug,
  slugStatus,
  address,
  setAddress,
  phone,
  setPhone,
}: {
  businessName: string;
  onBusinessName: (v: string) => void;
  businessType: BusinessType;
  setBusinessType: (v: BusinessType) => void;
  cuisineType: string;
  setCuisineType: (v: string) => void;
  slug: string;
  setSlug: (v: string) => void;
  slugStatus: SlugStatus;
  address: string;
  setAddress: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
}) {
  const borderColor =
    slug.length < 2
      ? "border-qf-line-dash"
      : slugStatus === "available"
        ? "border-qf-green focus-within:border-qf-green"
        : slugStatus === "checking"
          ? "border-qf-line-dash"
          : "border-qf-tomato focus-within:border-qf-tomato";

  return (
    <div className="space-y-5">
      {/* One field per row — the previous 2-column grid squeezed the
          slug widget so the validation badge clipped on narrow viewports. */}
      <Field label="שם העסק" required>
        <input
          value={businessName}
          onChange={(e) => onBusinessName(e.target.value)}
          placeholder="פיצרייה ורדה"
          required
          aria-required="true"
          className="w-full px-3.5 py-3 rounded-xl border-2 border-black bg-[#FFFBEC] hover:bg-white focus:bg-white focus:border-black focus:shadow-[0_0_0_3px_#F8CB1E] outline-none transition font-semibold text-black placeholder:text-black/35 placeholder:font-normal"
        />
      </Field>
      <Field label="כתובת באתר" hint="אנגלית בלבד" required>
        <div
          dir="ltr"
          className={cn(
            "flex items-center border-2 rounded-xl bg-[#FFFBEC] hover:bg-white focus-within:bg-white focus-within:border-black focus-within:shadow-[0_0_0_3px_#F8CB1E] transition",
            borderColor,
          )}
        >
          <span className="ps-3 pe-2 text-black/55 text-xs font-mono font-bold select-none border-e-2 border-black py-3 me-2">
            quickfood.co.il/
          </span>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            dir="ltr"
            placeholder="my-restaurant"
            required
            aria-required="true"
            className="flex-1 min-w-0 py-3 pe-2 outline-none bg-transparent font-mono font-bold text-sm text-black placeholder:text-black/35 placeholder:font-normal"
          />
          <SlugStatusBadge status={slugStatus} slug={slug} />
        </div>
        <SlugStatusLine status={slugStatus} slug={slug} />
      </Field>

      <BusinessTypeSelect
        label="סוג עסק"
        hint="קובע את הפלייסהולדרים לפריטים ללא תמונה"
        value={businessType}
        onChange={setBusinessType}
        required
      />

      <Field label="סוג מטבח (אופציונלי)">
        <input
          value={cuisineType}
          onChange={(e) => setCuisineType(e.target.value)}
          placeholder="פיצה נפוליטנית / המבורגרים אמריקאים / סושי יפני"
          className="w-full px-3.5 py-3 rounded-xl border-2 border-black bg-[#FFFBEC] hover:bg-white focus:bg-white focus:border-black focus:shadow-[0_0_0_3px_#F8CB1E] outline-none transition font-semibold text-black placeholder:text-black/35 placeholder:font-normal"
        />
      </Field>

      <Field label="כתובת מלאה (הסניף הראשי)" required>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="אלנבי 42, תל אביב"
          required
          aria-required="true"
          className="w-full px-3.5 py-3 rounded-xl border-2 border-black bg-[#FFFBEC] hover:bg-white focus:bg-white focus:border-black focus:shadow-[0_0_0_3px_#F8CB1E] outline-none transition font-semibold text-black placeholder:text-black/35 placeholder:font-normal"
        />
      </Field>

      <Field label="טלפון לסניף" required>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          dir="ltr"
          placeholder="03-555-1234"
          required
          aria-required="true"
          inputMode="tel"
          className="w-full px-3.5 py-3 rounded-xl border-2 border-black bg-[#FFFBEC] hover:bg-white focus:bg-white focus:border-black focus:shadow-[0_0_0_3px_#F8CB1E] outline-none transition font-semibold text-black placeholder:text-black/35 placeholder:font-normal"
        />
      </Field>
    </div>
  );
}

// ─── Step 2: branding (theme picker only) ─────────────────

function Step2({
  themeId,
  setThemeId,
}: {
  themeId: ThemeId;
  setThemeId: (v: ThemeId) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-black/65 leading-relaxed">
        בחרו ערכת צבעים לחנות שלכם. אפשר לשנות מאוחר יותר בהגדרות.
      </p>
      <Field label="ערכת צבע">
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
          {Object.values(THEMES).map((t) => {
            const active = themeId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setThemeId(t.id)}
                className={cn(
                  "rounded-xl border-2 p-2.5 text-start transition",
                  active
                    ? "border-black bg-[#FFF6CE] shadow-[0_3px_0_#000]"
                    : "border-black/15 hover:border-black bg-white",
                )}
              >
                <div className="flex gap-1 mb-1.5">
                  <span className="w-5 h-5 rounded border border-black/10" style={{ background: t.primary }} />
                  <span className="w-5 h-5 rounded border border-black/10" style={{ background: t.deep }} />
                  <span className="w-5 h-5 rounded border border-black/10" style={{ background: t.soft }} />
                </div>
                <div className="text-xs font-bold text-black">{t.name}</div>
              </button>
            );
          })}
        </div>
      </Field>
    </div>
  );
}

// ─── Step 3: owner ────────────────────────────────────────

function Step3({
  name,
  setName,
  email,
  setEmail,
  password,
  setPassword,
}: {
  name: string;
  setName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-qf-ink2">
        חשבון הבעלים הראשי — תוכל להוסיף מנהלים, צוות מטבח ושליחים מאוחר יותר.
      </p>
      <Field label="שם מלא" required>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          aria-required="true"
          autoComplete="name"
          className="w-full px-3.5 py-3 rounded-xl border-2 border-black bg-[#FFFBEC] hover:bg-white focus:bg-white focus:border-black focus:shadow-[0_0_0_3px_#F8CB1E] outline-none transition font-semibold text-black placeholder:text-black/35 placeholder:font-normal"
        />
      </Field>
      <Field label="אימייל" required>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          dir="ltr"
          required
          aria-required="true"
          autoComplete="email"
          className="w-full px-3.5 py-3 rounded-xl border-2 border-black bg-[#FFFBEC] hover:bg-white focus:bg-white focus:border-black focus:shadow-[0_0_0_3px_#F8CB1E] outline-none transition font-semibold text-black placeholder:text-black/35 placeholder:font-normal"
        />
        <div className="mt-1.5 flex items-start gap-2 px-3 py-2 rounded-lg bg-[#FFF6CC] border border-black/15">
          <span aria-hidden className="text-base leading-none mt-0.5">!</span>
          <p className="text-xs text-black/75 leading-relaxed">
            <span className="font-bold">שים לב:</span> יש להזין כתובת דוא״ל אמיתית. נשלח לשם מייל לאימות וצריך ללחוץ עליו כדי להפעיל את החנות.
          </p>
        </div>
      </Field>
      <Field label="סיסמה" hint="לפחות 8 תווים" required>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          aria-required="true"
          minLength={8}
          autoComplete="new-password"
          className="w-full px-3.5 py-3 rounded-xl border-2 border-black bg-[#FFFBEC] hover:bg-white focus:bg-white focus:border-black focus:shadow-[0_0_0_3px_#F8CB1E] outline-none transition font-mono font-bold text-black placeholder:text-black/35 placeholder:font-normal tracking-widest"
        />
      </Field>
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-black text-black">
          {label}
          {required && (
            <span className="text-qf-tomato ms-1" aria-hidden>
              *
            </span>
          )}
        </label>
        {hint && <span className="text-xs font-medium text-black/55">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

// ─── Step indicator (dots-with-connector) ─────────────────────────

const STEP_DEFS: Array<{
  n: 1 | 2 | 3;
  label: string;
  Icon: typeof Sparkles;
}> = [
  { n: 1, label: "פרטי עסק", Icon: MapPin },
  { n: 2, label: "מותג ועיצוב", Icon: Sparkles },
  { n: 3, label: "בעלים", Icon: User },
];

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  // RTL: visually we want step 1 at the right edge, step 3 at the left edge.
  // CSS RTL handles this automatically when the parent is dir="rtl" (it is, via root).
  return (
    <ol className="relative grid grid-cols-3 gap-0">
      {/* Background line under the dots */}
      <div
        aria-hidden
        className="absolute top-5 inset-x-[16.66%] h-0.5 bg-black/15"
      />
      {/* Progress line — width based on current step */}
      <div
        aria-hidden
        className="absolute top-5 h-0.5 bg-black transition-all"
        style={{
          insetInlineStart: "16.66%",
          width: step === 1 ? "0%" : step === 2 ? "33.33%" : "66.66%",
        }}
      />
      {STEP_DEFS.map(({ n, label, Icon }) => {
        const active = step === n;
        const done = step > n;
        return (
          <li key={n} className="flex flex-col items-center relative z-10">
            <div
              className={cn(
                "w-10 h-10 rounded-full grid place-items-center transition-colors border-2 border-black",
                done && "bg-black text-[#F8CB1E]",
                active && "bg-[#F8CB1E] text-black shadow-[0_3px_0_#000]",
                !active && !done && "bg-white text-black/40",
              )}
            >
              {done ? <Check size={18} strokeWidth={2.8} /> : <Icon size={18} strokeWidth={2.4} />}
            </div>
            <div
              className={cn(
                "mt-2 text-xs text-center",
                active && "font-black text-black",
                done && "font-bold text-black",
                !active && !done && "font-medium text-black/55",
              )}
            >
              {label}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function SlugStatusBadge({ status, slug }: { status: SlugStatus; slug: string }) {
  if (slug.length < 2) return null;
  if (status === "checking") {
    return (
      <span
        className="pe-3 text-qf-mute text-xs inline-flex items-center gap-1"
        aria-live="polite"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" className="animate-spin">
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray="40 60"
            fill="none"
          />
        </svg>
      </span>
    );
  }
  if (status === "available") {
    return (
      <span
        className="pe-3 text-qf-green-deep inline-flex items-center"
        aria-live="polite"
        aria-label="פנוי"
      >
        <Check size={18} strokeWidth={2.6} />
      </span>
    );
  }
  if (status === "taken" || status === "reserved" || status === "invalid") {
    return (
      <span
        className="pe-3 text-qf-tomato inline-flex items-center"
        aria-live="polite"
        aria-label="לא זמין"
      >
        <X size={18} strokeWidth={2.6} />
      </span>
    );
  }
  return null;
}

function SlugStatusLine({ status, slug }: { status: SlugStatus; slug: string }) {
  if (slug.length < 2 || status === "idle" || status === "too_short") {
    return (
      <p className="text-xs text-qf-mute mt-1">
        אנגלית בלבד · אותיות קטנות, ספרות ומקפים · לפחות 2 תווים
      </p>
    );
  }
  const msg = {
    checking: { text: "בודק זמינות...", color: "text-qf-mute", icon: null },
    available: {
      text: "פנוי לרישום",
      color: "text-qf-green-deep",
      icon: <Check size={12} strokeWidth={2.6} />,
    },
    taken: {
      text: "תפוס כבר. נסה משהו אחר",
      color: "text-qf-tomato",
      icon: <X size={12} strokeWidth={2.6} />,
    },
    reserved: {
      text: "שמור למערכת. בחר כתובת אחרת",
      color: "text-qf-tomato",
      icon: <X size={12} strokeWidth={2.6} />,
    },
    invalid: {
      text: "אנגלית בלבד — אותיות קטנות, ספרות ומקפים",
      color: "text-qf-tomato",
      icon: <X size={12} strokeWidth={2.6} />,
    },
  }[status as "checking" | "available" | "taken" | "reserved" | "invalid"];
  if (!msg) return null;
  return (
    <p className={cn("text-xs mt-1 inline-flex items-center gap-1", msg.color)}>
      {msg.icon}
      {msg.text}
    </p>
  );
}
