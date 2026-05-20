"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { THEMES, type ThemeId } from "@/lib/themes";
import { BUSINESS_TYPES, type BusinessType, MenuItemImage } from "@/components/shared/MenuItemImage";
import { cn } from "@/lib/cn";

type SlugStatus = "idle" | "checking" | "available" | "taken" | "invalid" | "reserved" | "too_short";

export function SignupForm() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    // simple Hebrew → slug
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

  const canNext1 =
    businessName.length >= 2 && slug.length >= 2 && slugStatus === "available";
  const canNext2 = branchAddress.length >= 3 && branchPhone.length >= 7;
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
      router.push(data.redirect ?? "/dashboard/orders");
      router.refresh();
    } catch {
      setError("שגיאת רשת");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <ol className="grid grid-cols-3 gap-1.5 text-xs">
        {[
          { n: 1, label: "מותג ועיצוב" },
          { n: 2, label: "פרטי סניף" },
          { n: 3, label: "בעלים" },
        ].map(({ n, label }) => {
          const active = step === n;
          const done = step > n;
          return (
            <li
              key={n}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-lg border",
                active && "border-qf-ink bg-qf-line-soft/60 font-medium",
                done && "border-qf-line-dash text-qf-mute",
                !active && !done && "border-qf-line-dash text-qf-mute",
              )}
            >
              <span
                className={cn(
                  "w-5 h-5 rounded-full grid place-items-center text-[10px] font-bold shrink-0",
                  active && "bg-qf-ink text-white",
                  done && "bg-qf-green-soft text-qf-green-deep",
                  !active && !done && "bg-qf-line-soft text-qf-mute",
                )}
              >
                {done ? "✓" : n}
              </span>
              <span className="truncate">{label}</span>
            </li>
          );
        })}
      </ol>

      <div className="space-y-5">
        {step === 1 && (
          <Step1
            businessName={businessName}
            onBusinessName={onNameChange}
            businessType={businessType}
            setBusinessType={setBusinessType}
            cuisineType={cuisineType}
            setCuisineType={setCuisineType}
            themeId={themeId}
            setThemeId={setThemeId}
            slug={slug}
            setSlug={setSlug}
            slugStatus={slugStatus}
          />
        )}

        {step === 2 && (
          <Step2
            address={branchAddress}
            setAddress={setBranchAddress}
            phone={branchPhone}
            setPhone={setBranchPhone}
          />
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

      <div className="pt-1 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => (step > 1 ? setStep((step - 1) as 1 | 2 | 3) : router.push("/"))}
          className="text-sm text-qf-mute hover:text-qf-ink"
        >
          {step > 1 ? "← חזרה" : "← לעמוד הבית"}
        </button>

        {step < 3 ? (
          <button
            type="button"
            disabled={step === 1 ? !canNext1 : !canNext2}
            onClick={() => setStep(((step as number) + 1) as 1 | 2 | 3)}
            className="px-5 py-3 rounded-xl bg-qf-ink hover:bg-black text-white text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2"
          >
            המשך
            <span aria-hidden>→</span>
          </button>
        ) : (
          <button
            type="button"
            disabled={!canSubmit || busy}
            onClick={submit}
            className="px-5 py-3 rounded-xl bg-qf-ink hover:bg-black text-white text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2"
          >
            {busy ? "פותח חנות..." : "פתיחת חנות"}
            {!busy && <span aria-hidden>→</span>}
          </button>
        )}
      </div>

      <p className="text-[10px] text-qf-mute/80 text-center pt-1">
        בהמשך אתה מסכים ל-
        <a href="#" className="underline">תנאי השימוש</a>
        {" "}ו-{" "}
        <a href="#" className="underline">מדיניות הפרטיות</a>
      </p>
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
  themeId,
  setThemeId,
  slug,
  setSlug,
  slugStatus,
}: {
  businessName: string;
  onBusinessName: (v: string) => void;
  businessType: BusinessType;
  setBusinessType: (v: BusinessType) => void;
  cuisineType: string;
  setCuisineType: (v: string) => void;
  themeId: ThemeId;
  setThemeId: (v: ThemeId) => void;
  slug: string;
  setSlug: (v: string) => void;
  slugStatus: SlugStatus;
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="שם העסק">
          <input
            value={businessName}
            onChange={(e) => onBusinessName(e.target.value)}
            placeholder="פיצרייה ורדה"
            className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
          />
        </Field>
        <Field label="כתובת באתר">
          <div
            dir="ltr"
            className={cn(
              "flex items-center border rounded-xl bg-white transition",
              borderColor,
            )}
          >
            <span className="ps-3 pe-1.5 text-qf-mute text-xs select-none">
              quickfood.app/
            </span>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              dir="ltr"
              placeholder="my-restaurant"
              className="flex-1 min-w-0 py-2.5 outline-none bg-transparent font-mono text-sm"
            />
            <SlugStatusBadge status={slugStatus} slug={slug} />
          </div>
          <SlugStatusLine status={slugStatus} slug={slug} />
        </Field>
      </div>

      <Field label="סוג עסק">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {BUSINESS_TYPES.map((t) => {
            const active = businessType === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setBusinessType(t.value)}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-2 rounded-xl border text-sm transition text-start",
                  active
                    ? "border-qf-ink ring-2 ring-(--qf-primary)/30 bg-qf-line-soft"
                    : "border-qf-line-dash hover:border-qf-ink/40",
                )}
              >
                <MenuItemImage
                  alt={t.label}
                  businessType={t.value}
                  size={36}
                  rounded="lg"
                />
                <span className="font-medium">{t.label}</span>
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="סוג מטבח (אופציונלי)">
        <input
          value={cuisineType}
          onChange={(e) => setCuisineType(e.target.value)}
          placeholder="פיצה נפוליטנית / המבורגרים אמריקאים / סושי יפני"
          className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
        />
      </Field>

      <Field label="ערכת צבע">
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {Object.values(THEMES).map((t) => {
            const active = themeId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setThemeId(t.id)}
                className={cn(
                  "rounded-xl border p-2 text-start transition",
                  active
                    ? "border-qf-ink ring-2 ring-qf-ink/30"
                    : "border-qf-line-dash hover:border-qf-ink/40",
                )}
              >
                <div className="flex gap-1 mb-1">
                  <span className="w-4 h-4 rounded" style={{ background: t.primary }} />
                  <span className="w-4 h-4 rounded" style={{ background: t.deep }} />
                  <span className="w-4 h-4 rounded" style={{ background: t.soft }} />
                </div>
                <div className="text-xs font-medium">{t.name}</div>
              </button>
            );
          })}
        </div>
      </Field>
    </div>
  );
}

// ─── Step 2: branch ────────────────────────────────────────

function Step2({
  address,
  setAddress,
  phone,
  setPhone,
}: {
  address: string;
  setAddress: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-qf-ink2">
        זה הסניף הראשי. נוכל להוסיף סניפים נוספים מאוחר יותר מההגדרות.
      </p>
      <Field label="כתובת מלאה">
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="אלנבי 42, תל אביב"
          className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
        />
      </Field>
      <Field label="טלפון לסניף">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          dir="ltr"
          placeholder="03-555-1234"
          className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
        />
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
      <Field label="שם מלא">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
        />
      </Field>
      <Field label="אימייל">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          dir="ltr"
          className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
        />
      </Field>
      <Field label="סיסמה" hint="לפחות 8 תווים">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none font-mono"
        />
      </Field>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-medium">{label}</label>
        {hint && <span className="text-xs text-qf-mute">{hint}</span>}
      </div>
      {children}
    </div>
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
        className="pe-3 text-qf-green-deep text-base inline-flex items-center"
        aria-live="polite"
        aria-label="פנוי"
      >
        ✓
      </span>
    );
  }
  if (status === "taken" || status === "reserved" || status === "invalid") {
    return (
      <span
        className="pe-3 text-qf-tomato text-base inline-flex items-center"
        aria-live="polite"
        aria-label="לא זמין"
      >
        ✕
      </span>
    );
  }
  return null;
}

function SlugStatusLine({ status, slug }: { status: SlugStatus; slug: string }) {
  if (slug.length < 2 || status === "idle" || status === "too_short") {
    return <p className="text-xs text-qf-mute mt-1">לפחות 2 תווים — אותיות לועזיות, ספרות ומקפים</p>;
  }
  const msg = {
    checking: { text: "בודק זמינות...", color: "text-qf-mute" },
    available: { text: "מעולה — פנוי לרישום", color: "text-qf-green-deep" },
    taken: { text: "תפוס כבר. נסה משהו אחר", color: "text-qf-tomato" },
    reserved: { text: "שמור למערכת — בחר slug אחר", color: "text-qf-tomato" },
    invalid: { text: "תווים לא חוקיים", color: "text-qf-tomato" },
  }[status as "checking" | "available" | "taken" | "reserved" | "invalid"];
  if (!msg) return null;
  return <p className={cn("text-xs mt-1", msg.color)}>{msg.text}</p>;
}
