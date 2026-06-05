"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Sparkles, MapPin, User, Check, X, Star } from "lucide-react";
import { IcoArrowLeft, IcoArrowRight } from "@/components/shared/Icons";
import { THEMES, type ThemeId } from "@/lib/themes";
import { type BusinessType } from "@/components/shared/MenuItemImage";
import { BusinessTypeSelect } from "@/components/shared/BusinessTypeSelect";
import { WoltTermsTrigger } from "@/components/shared/wolt/WoltTermsModal";
import { StorefrontPreviewPhone } from "@/components/shared/wolt/StorefrontPreviewPhone";
import { cn } from "@/lib/cn";

type SlugStatus = "idle" | "checking" | "available" | "taken" | "invalid" | "reserved" | "too_short";

interface WoltDayHours {
  day: string;
  label: string;
  display: string;
  active: boolean;
}

interface WoltPreview {
  name: string;
  slug: string | null;
  address: string | null;
  phone: string | null;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  hours: WoltDayHours[];
  has_hours: boolean;
  menu: {
    categoriesCount: number;
    itemsCount: number;
    imagesCount: number;
    sampleItems: Array<{ name: string; image: string | null; price: number }>;
  } | null;
  detected?: {
    cutleryItem: { name: string } | null;
    noticeItems: string[];
    flaggedNames: string[];
  };
}

type ApplyFlags = {
  name: boolean;
  address: boolean;
  phone: boolean;
  about: boolean;
  hours: boolean;
  logo: boolean;
  cover: boolean;
};

type Overrides = Partial<Record<"name" | "address" | "phone" | "about", string>>;

function buildHoursPayload(hours: WoltDayHours[]) {
  const map: Record<string, { open: string; close: string; active: boolean }> = {
    sunday: { open: "11:00", close: "23:00", active: false },
    monday: { open: "11:00", close: "23:00", active: false },
    tuesday: { open: "11:00", close: "23:00", active: false },
    wednesday: { open: "11:00", close: "23:00", active: false },
    thursday: { open: "11:00", close: "23:00", active: false },
    friday: { open: "11:00", close: "16:00", active: false },
    saturday: { open: "20:00", close: "01:00", active: false },
  };
  for (const h of hours) {
    if (!h.active || !h.display.includes("–")) continue;
    const [openRaw, closeRaw] = h.display.split("–");
    const open = openRaw?.trim();
    const close = closeRaw?.trim();
    if (open && close && /^\d{2}:\d{2}$/.test(open) && /^\d{2}:\d{2}$/.test(close)) {
      map[h.day] = { open, close, active: true };
    }
  }
  return map;
}

export function SignupForm() {
  const router = useRouter();
  // Step 0 = optional "do you have Wolt?" pre-fill - initial view.
  // Steps 1-3 = the actual wizard (business details, branding, owner).
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wolt URL the merchant pasted on Step 0. Kept so we hand it off to
  // /dashboard/settings/advanced after signup with ack=1&autostart=1,
  // which auto-runs the menu import without re-prompting.
  const [woltUrl, setWoltUrl] = useState("");
  const [woltStage, setWoltStage] = useState<"url" | "mapping">("url");
  const [woltPreview, setWoltPreview] = useState<WoltPreview | null>(null);
  const [woltApply, setWoltApply] = useState<ApplyFlags>({
    name: true,
    address: true,
    phone: true,
    about: true,
    hours: true,
    logo: true,
    cover: true,
  });
  const [woltOverrides, setWoltOverrides] = useState<Overrides>({});

  // Step 1
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState<BusinessType>("general");
  const [cuisineType, setCuisineType] = useState("");
  const [themeId, setThemeId] = useState<ThemeId>("fresh");
  const [slug, setSlug] = useState("");
  const [slugStatus, setSlugStatus] = useState<SlugStatus>("idle");

  // Scroll back to the top whenever the wizard advances/retreats - otherwise
  // the user lands on the next step at whatever scroll position the previous
  // one ended on, which hides the heading + step indicator above.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step, woltStage]);

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
  // Step 2 is branding only (theme picker) - always has a default
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
      const venueExtras =
        woltPreview
          ? {
              logo_url: woltApply.logo && woltPreview.logo_url ? woltPreview.logo_url : undefined,
              cover_image_url:
                woltApply.cover && woltPreview.cover_url ? woltPreview.cover_url : undefined,
              about: woltApply.about
                ? (woltOverrides.about ?? woltPreview.description) || undefined
                : undefined,
              hours:
                woltApply.hours && woltPreview.has_hours
                  ? buildHoursPayload(woltPreview.hours)
                  : undefined,
            }
          : {};
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
          ...venueExtras,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const field = data.error?.field as string | undefined;
        setError(data.error?.message ?? "ההרשמה נכשלה");
        const stepByField: Record<string, 1 | 2 | 3> = {
          business_name: 1,
          slug: 1,
          business_type: 1,
          cuisine_type: 1,
          branch_address: 1,
          branch_phone: 1,
          theme_id: 2,
          owner_name: 3,
          owner_email: 3,
          owner_password: 3,
        };
        if (field && stepByField[field]) setStep(stepByField[field]);
        return;
      }
      // Wolt URL hand-off: land on the importer with everything
      // pre-filled and the owner-acked, so the merchant doesn't have
      // to paste the URL or re-tick a checkbox they already saw on
      // signup. The page auto-runs the preview on mount.
      const dest = woltUrl
        ? `/dashboard/settings/advanced?wolt=${encodeURIComponent(woltUrl)}&ack=1&autostart=1`
        : (data.redirect ?? "/dashboard");
      router.push(dest);
      router.refresh();
    } catch {
      setError("שגיאת רשת");
    } finally {
      setBusy(false);
    }
  }

  async function applyMappingAndContinue() {
    if (!woltPreview) return;
    const eff = {
      name: woltOverrides.name ?? woltPreview.name,
      address: woltOverrides.address ?? woltPreview.address,
      phone: woltOverrides.phone ?? woltPreview.phone,
    };
    // Prefer the Wolt URL slug - already kebab-case and meaningful.
    // Fall back to a transliteration of the name only if Wolt didn't
    // surface a slug.
    const targetSlug =
      (woltPreview.slug ?? "").trim() || autoSlug(eff.name ?? "");

    if (woltApply.name && eff.name) setBusinessName(eff.name);
    if (targetSlug) setSlug(targetSlug);
    if (woltApply.address && eff.address) setBranchAddress(eff.address);
    if (woltApply.phone && eff.phone) setBranchPhone(eff.phone);

    // If everything is filled and the slug is free, skip Step 1
    // (business details) entirely - Wolt already gave us name,
    // address, phone, and a clean slug. business_type stays at its
    // "general" default; the merchant can edit it later from
    // Settings → Business. We jump straight to Step 2 (branding).
    const haveAll = !!eff.name && !!eff.address && !!eff.phone && !!targetSlug;
    let slugFree = false;
    if (haveAll) {
      try {
        const res = await fetch(
          `/api/v1/auth/check-slug?slug=${encodeURIComponent(targetSlug)}`,
        );
        if (res.ok) {
          const d = (await res.json()) as { status: string };
          slugFree = d.status === "available";
        }
      } catch {
        /* fall through to Step 1 */
      }
    }
    setStep(slugFree ? 2 : 1);
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
        {step === 0 && woltStage === "url" && (
          <Step0Url
            woltUrl={woltUrl}
            setWoltUrl={setWoltUrl}
            onPreviewed={(info) => {
              setWoltPreview(info);
              setWoltOverrides({});
              setWoltApply({
                name: true,
                address: !!info.address,
                phone: !!info.phone,
                about: !!info.description,
                hours: info.has_hours,
                logo: !!info.logo_url,
                cover: !!info.cover_url,
              });
              setWoltStage("mapping");
            }}
            onSkip={() => {
              setWoltUrl("");
              setWoltPreview(null);
              setStep(1);
            }}
          />
        )}

        {step === 0 && woltStage === "mapping" && woltPreview && (
          <Step0Mapping
            preview={woltPreview}
            flags={woltApply}
            setFlags={setWoltApply}
            overrides={woltOverrides}
            setOverride={(k, v) =>
              setWoltOverrides({ ...woltOverrides, [k]: v })
            }
            clearOverride={(k) => {
              const next = { ...woltOverrides };
              delete next[k];
              setWoltOverrides(next);
            }}
            onBack={() => setWoltStage("url")}
            onContinue={applyMappingAndContinue}
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
          <Step2
            themeId={themeId}
            setThemeId={setThemeId}
            preview={
              woltPreview
                ? {
                    name: woltOverrides.name ?? woltPreview.name,
                    address: woltOverrides.address ?? woltPreview.address,
                    description:
                      woltOverrides.about ?? woltPreview.description,
                    logo_url: woltApply.logo ? woltPreview.logo_url : null,
                    cover_url: woltApply.cover ? woltPreview.cover_url : null,
                    menu: woltPreview.menu
                      ? { sampleItems: woltPreview.menu.sampleItems }
                      : null,
                  }
                : null
            }
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

function Step0Url({
  woltUrl,
  setWoltUrl,
  onPreviewed,
  onSkip,
}: {
  woltUrl: string;
  setWoltUrl: (v: string) => void;
  onPreviewed: (info: WoltPreview) => void;
  onSkip: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [ack, setAck] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchPreview() {
    const url = woltUrl.trim();
    if (!url || busy) return;
    if (!ack) {
      setError("יש לאשר שאתם בעלי החנות לפני שמייבאים");
      return;
    }
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
      onPreviewed(data as WoltPreview);
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
          נייבא בשבילכם בלחיצה את שם העסק, הכתובת, הטלפון, הלוגו והתפריט
          המלא. תוך כמה שניות תהיו עם חנות מוכנה.
        </p>
      </div>

      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full px-5 py-3 rounded-xl bg-[#F8CB1E] hover:bg-[#ffd84a] text-black text-base font-black border-2 border-black shadow-[0_3px_0_#000] hover:shadow-[0_4px_0_#000] active:translate-y-px active:shadow-[0_2px_0_#000] transition inline-flex items-center justify-center gap-2"
        >
          ייבוא מוולט
        </button>
      ) : (
        <div className="space-y-4">
          <Field label="כתובת החנות בוולט" hint="https://wolt.com/he/...">
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
              autoFocus
              placeholder="https://wolt.com/he/isr/tel-aviv/restaurant/..."
              className="w-full px-3.5 py-3 rounded-xl border-2 border-black bg-[#FFFBEC] hover:bg-white focus:bg-white focus:border-black focus:shadow-[0_0_0_3px_#F8CB1E] outline-none transition font-mono text-sm text-black placeholder:text-black/35 placeholder:font-normal"
            />
          </Field>

          <label className="flex items-start gap-2.5 cursor-pointer rounded-xl border-2 border-black bg-[#FFFBEC] px-3 py-2.5">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-black"
            />
            <span className="text-xs text-black/80 leading-relaxed">
              אני בעל/ת החנות. התוכן (שמות, תמונות, מחירים, תוספות) שייך לי
              ואני מאשר/ת ייבוא שלו ל-QuickFood. הייבוא הזה באחריותי הבלעדית
              מול Wolt וצדדים שלישיים - ראו{" "}
              <WoltTermsTrigger />.
            </span>
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchPreview}
              disabled={!woltUrl.trim() || !ack || busy}
              className="flex-1 px-5 py-3 rounded-xl bg-[#F8CB1E] hover:bg-[#ffd84a] text-black text-base font-black border-2 border-black shadow-[0_3px_0_#000] hover:shadow-[0_4px_0_#000] active:translate-y-px active:shadow-[0_2px_0_#000] transition disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            >
              {busy ? (
                <>
                  <span className="qf-spinner" aria-hidden />
                  <span>שולפים מוולט…</span>
                </>
              ) : (
                "שלוף את החנות"
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setExpanded(false);
                setError(null);
              }}
              disabled={busy}
              className="shrink-0 px-3 py-3 rounded-xl bg-white border-2 border-black text-sm font-bold text-black shadow-[0_3px_0_#000] hover:shadow-[0_4px_0_#000] active:translate-y-px active:shadow-[0_2px_0_#000] transition disabled:opacity-50"
              aria-label="בטל"
            >
              ביטול
            </button>
          </div>

          {error && (
            <div className="bg-[#FFE2DC] border-2 border-black text-black text-sm font-bold rounded-xl px-3 py-2.5 shadow-[0_2px_0_#000]">
              {error}
            </div>
          )}
        </div>
      )}

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
הרשמה רגילה       </button>
    </div>
  );
}

// ─── Step 0b: mapping ───────────────────────────────────────

type TextField = keyof Overrides;

function Step0Mapping({
  preview,
  flags,
  setFlags,
  overrides,
  setOverride,
  clearOverride,
  onBack,
  onContinue,
}: {
  preview: WoltPreview;
  flags: ApplyFlags;
  setFlags: (next: ApplyFlags) => void;
  overrides: Overrides;
  setOverride: (k: TextField, v: string) => void;
  clearOverride: (k: TextField) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const [editing, setEditing] = useState<TextField | null>(null);

  function toggle(k: keyof ApplyFlags) {
    setFlags({ ...flags, [k]: !flags[k] });
  }

  function originalFor(k: TextField): string {
    switch (k) {
      case "name": return preview.name ?? "";
      case "address": return preview.address ?? "";
      case "phone": return preview.phone ?? "";
      case "about": return preview.description ?? "";
    }
  }

  function effectiveFor(k: TextField): string {
    return overrides[k] ?? originalFor(k);
  }

  function renderTextValue(k: TextField, dirLtr = false) {
    const v = effectiveFor(k);
    if (!v) return "-";
    if (k === "phone") {
      return <span dir="ltr" className="tnum">{v}</span>;
    }
    if (k === "about") {
      return <span className="line-clamp-3 whitespace-pre-line">{v}</span>;
    }
    return dirLtr ? <span dir="ltr">{v}</span> : <span>{v}</span>;
  }

  const rows: Array<{
    key: keyof ApplyFlags;
    label: string;
    available: boolean;
    editableField: TextField | null;
    value: React.ReactNode;
  }> = [
    {
      key: "name",
      label: "שם העסק",
      available: !!preview.name,
      editableField: "name",
      value: <span className="font-bold">{effectiveFor("name") || "-"}</span>,
    },
    {
      key: "address",
      label: "כתובת",
      available: !!preview.address,
      editableField: "address",
      value: renderTextValue("address"),
    },
    {
      key: "phone",
      label: "טלפון",
      available: !!preview.phone,
      editableField: "phone",
      value: renderTextValue("phone"),
    },
    {
      key: "about",
      label: "תיאור",
      available: !!preview.description,
      editableField: "about",
      value: renderTextValue("about"),
    },
    {
      key: "hours",
      label: "שעות פעילות",
      available: preview.has_hours,
      editableField: null,
      value: preview.has_hours ? (
        <ul className="space-y-0.5 text-xs">
          {preview.hours.map((h) => (
            <li key={h.day} className="flex items-baseline gap-2 tnum">
              <span className="text-black/55 w-12">{h.label}</span>
              <span className={h.active ? "" : "text-black/45"}>{h.display}</span>
            </li>
          ))}
        </ul>
      ) : (
        "-"
      ),
    },
    {
      key: "logo",
      label: "לוגו",
      available: !!preview.logo_url,
      editableField: null,
      value: preview.logo_url ? (
        <div className="relative w-12 h-12 rounded-xl overflow-hidden border-2 border-black bg-white">
          <Image src={preview.logo_url} alt="" fill sizes="48px" className="object-contain" unoptimized />
        </div>
      ) : (
        "-"
      ),
    },
    {
      key: "cover",
      label: "תמונת כריכה",
      available: !!preview.cover_url,
      editableField: null,
      value: preview.cover_url ? (
        <div className="relative w-32 h-16 rounded-xl overflow-hidden border-2 border-black bg-white">
          <Image src={preview.cover_url} alt="" fill sizes="128px" className="object-cover" unoptimized />
        </div>
      ) : (
        "-"
      ),
    },
  ];

  const menu = preview.menu;

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <h3 className="text-lg lg:text-xl font-black text-black">
          מצאנו את החנות שלכם
        </h3>
        <p className="text-sm text-black/65 leading-relaxed">
          סמנו מה לקחת מוולט ל-QuickFood. כל סעיף שתבטלו - תוכלו להזין ידנית
          בשלב הבא.
        </p>
      </div>

      {menu && (
        <div className="grid grid-cols-3 gap-2.5">
          <MenuStat label="קטגוריות" value={menu.categoriesCount} />
          <MenuStat label="פריטים" value={menu.itemsCount} />
          <MenuStat label="תמונות" value={menu.imagesCount} />
        </div>
      )}

      <div className="rounded-2xl border-2 border-black overflow-hidden bg-white">
        {rows.map((r, idx) => {
          const isEditing = r.editableField && editing === r.editableField;
          const isOverridden = r.editableField && overrides[r.editableField] !== undefined;
          return (
            <div
              key={r.key}
              className={cn(
                "grid grid-cols-[auto_1fr] gap-3 px-3 py-3 items-start text-sm transition",
                idx > 0 && "border-t-2 border-black/10",
                !r.available && "opacity-50",
                r.available && flags[r.key] && !isEditing && "bg-[#FFF6CC]",
              )}
            >
              <input
                type="checkbox"
                disabled={!r.available}
                checked={r.available && !!flags[r.key]}
                onChange={() => r.available && toggle(r.key)}
                className="mt-1 w-4 h-4 accent-black"
                aria-label={r.label}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-black/65">{r.label}</span>
                  {isOverridden && (
                    <span className="text-[10px] font-bold text-black/55 bg-black/5 rounded-md px-1.5 py-0.5">
                      נערך
                    </span>
                  )}
                  {r.editableField && r.available && !isEditing && (
                    <button
                      type="button"
                      onClick={() => setEditing(r.editableField)}
                      className="mr-auto text-[11px] font-bold text-black/70 hover:text-black underline underline-offset-2 cursor-pointer"
                    >
                      עריכה
                    </button>
                  )}
                  {r.editableField && isOverridden && !isEditing && (
                    <button
                      type="button"
                      onClick={() => clearOverride(r.editableField!)}
                      className="text-[11px] font-bold text-black/55 hover:text-qf-tomato underline underline-offset-2 cursor-pointer"
                    >
                      שחזור מוולט
                    </button>
                  )}
                </div>
                {isEditing && r.editableField ? (
                  <InlineEditor
                    field={r.editableField}
                    initial={effectiveFor(r.editableField)}
                    onSave={(v) => {
                      const trimmed = v.trim();
                      if (!trimmed || trimmed === originalFor(r.editableField!)) {
                        clearOverride(r.editableField!);
                      } else {
                        setOverride(r.editableField!, trimmed);
                      }
                      setEditing(null);
                      if (!flags[r.key]) toggle(r.key);
                    }}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <div className="text-sm text-black mt-1">{r.value}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-black/60 leading-relaxed text-center">
        כל הפרטים האלה ניתנים לעריכה בכל רגע מההגדרות בלוח הבקרה - לוגו,
        קאבר, שעות, כתובת, מחירים, הכל. אפשר לסמן עכשיו ולתקן אחרי שהחנות
        עולה.
      </p>

      {menu && menu.sampleItems.length > 0 && (
        <div>
          <h4 className="text-sm font-black text-black mb-2">
            דוגמה מהתפריט · {menu.sampleItems.length} מתוך {menu.itemsCount}
          </h4>
          <div className="grid grid-cols-3 gap-2">
            {menu.sampleItems.map((it, i) => {
              const flagged = !!preview.detected?.flaggedNames?.includes(it.name);
              return (
                <div
                  key={i}
                  className={cn(
                    "relative rounded-xl border-2 overflow-hidden bg-white",
                    flagged
                      ? "border-[#F8CB1E] ring-2 ring-[#F8CB1E]/60"
                      : "border-black",
                  )}
                >
                  {flagged && (
                    <div
                      className="absolute top-1 inset-inline-start-1 z-10 w-7 h-7 rounded-full bg-[#F8CB1E] border-2 border-black grid place-items-center shadow-[0_2px_0_#000]"
                      title="פתרון עוקף שיש לו פתרון מובנה ב-QuickFood"
                      aria-label="פריט שמסומן בהערה"
                    >
                      <Star size={12} strokeWidth={2.6} fill="#000" className="text-black" />
                    </div>
                  )}
                  <div className="aspect-square bg-[#FFFBEC] relative">
                    {it.image && (
                      <Image
                        src={it.image}
                        alt={it.name}
                        fill
                        sizes="(max-width: 768px) 33vw, 200px"
                        className="object-cover"
                        unoptimized
                      />
                    )}
                  </div>
                  <div className="px-2 py-1.5 text-xs">
                    <div className="font-bold line-clamp-2 leading-tight">{it.name}</div>
                    <div className="text-black/55 tnum mt-0.5">₪{it.price}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-black/55 mt-2 leading-relaxed">
            התפריט המלא ייובא לחנות שלכם אוטומטית מיד אחרי שתשלימו את ההרשמה.
          </p>
        </div>
      )}

      <WoltVsQuickFoodTip detected={preview.detected} />

      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-bold text-black/65 hover:text-black inline-flex items-center gap-1.5"
        >
          <IcoArrowRight c="currentColor" s={14} />
          להזין כתובת אחרת
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="px-5 py-3 rounded-xl bg-[#F8CB1E] hover:bg-[#ffd84a] text-black text-base font-black border-2 border-black shadow-[0_3px_0_#000] hover:shadow-[0_4px_0_#000] active:translate-y-px active:shadow-[0_2px_0_#000] transition inline-flex items-center gap-2"
        >
          המשך
          <IcoArrowLeft c="currentColor" s={16} />
        </button>
      </div>
    </div>
  );
}

function InlineEditor({
  field,
  initial,
  onSave,
  onCancel,
}: {
  field: TextField;
  initial: string;
  onSave: (v: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const multi = field === "about";
  const isPhone = field === "phone";
  const sharedClass =
    "w-full px-3 py-2 rounded-lg border-2 border-black bg-[#FFFBEC] focus:bg-white focus:outline-none focus:shadow-[0_0_0_3px_#F8CB1E] text-sm";

  return (
    <div className="mt-2 space-y-2">
      {multi ? (
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={3}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Escape") onCancel();
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSave(value);
          }}
          className={cn(sharedClass, "leading-relaxed")}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          dir={isPhone ? "ltr" : undefined}
          inputMode={isPhone ? "tel" : undefined}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Escape") onCancel();
            if (e.key === "Enter") {
              e.preventDefault();
              onSave(value);
            }
          }}
          className={sharedClass}
        />
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onSave(value)}
          className="px-3 py-1.5 rounded-lg bg-[#F8CB1E] border-2 border-black text-xs font-black text-black shadow-[0_2px_0_#000] active:translate-y-px active:shadow-none transition"
        >
          שמור
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg bg-white border-2 border-black text-xs font-bold text-black hover:bg-[#FFFBEC] transition"
        >
          בטל
        </button>
      </div>
    </div>
  );
}

function MenuStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border-2 border-black bg-[#FFF6CC] text-center py-3">
      <div className="text-xl font-black text-black tnum">{value}</div>
      <div className="text-[10px] font-bold text-black/65 mt-0.5">{label}</div>
    </div>
  );
}

// Friendly nudge surfaced in Step 0b when we spot Wolt-specific hacks
// (zero-price cutlery item, zero-price notice items). These exist in
// Wolt because Wolt has no native cutlery toggle or banner system -
// merchants stuff them into the menu. QuickFood has both as
// first-class features, so this banner says "by the way, you'll be
// able to drop those entirely" without being snarky about Wolt.
function WoltVsQuickFoodTip({
  detected,
}: {
  detected: WoltPreview["detected"];
}) {
  if (!detected) return null;
  const hasCutlery = !!detected.cutleryItem;
  const noticeCount = detected.noticeItems?.length ?? 0;
  if (!hasCutlery && noticeCount === 0) return null;

  const bullets: Array<{ what: React.ReactNode; tip: string }> = [];
  if (hasCutlery) {
    bullets.push({
      what: (
        <>
          הפריט{" "}
          <span className="bg-[#F8CB1E] px-1.5 py-0.5 rounded-md">
            “{detected.cutleryItem!.name}”
          </span>{" "}
          (מסומן בכוכב למעלה) - סכו״ם חד״פ
        </>
      ),
      tip: "בקוויק פוד זה מובנה בצ׳ק־אאוט כקליק אחד של הלקוח (חינם או בתוספת תשלום, עם רף מינימום). אין צורך לסחוב פריט כזה בתפריט.",
    });
  }
  if (noticeCount > 0) {
    bullets.push({
      what: `${noticeCount} פריטים שנראים כמו הודעות ללקוח${noticeCount > 1 ? "" : ""} (מסומנים בכוכב)`,
      tip: "בקוויק פוד יש מערכת באנרים ופופאפים ייעודיים - מודיעים ללקוח בלי לזהם את התפריט.",
    });
  }

  return (
    <div className="rounded-2xl border-2 border-black bg-[#FFF6CC] p-4 shadow-[0_3px_0_#000]">
      <div className="flex items-start gap-2.5">
        <div className="shrink-0 w-7 h-7 rounded-full bg-black text-[#F8CB1E] grid place-items-center">
          <Star size={14} strokeWidth={2.6} fill="#F8CB1E" />
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          <div>
            <div className="text-xs font-black text-black/55 mb-0.5">
              אגב, סתם שתדעו
            </div>
            <p className="text-sm font-bold text-black leading-snug">
              חלק מהפריטים שלכם בוולט הם פתרונות עוקפים - בקוויק פוד יש
              להם כלי מובנה.
            </p>
          </div>
          <ul className="space-y-2.5">
            {bullets.map((b, i) => (
              <li key={i} className="text-xs text-black/80 leading-relaxed">
                <div className="font-bold text-black">{b.what}</div>
                <div className="mt-0.5">{b.tip}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
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
      {/* One field per row - the previous 2-column grid squeezed the
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
      <Field label="כתובת האתר" hint="אנגלית בלבד" required>
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
  preview,
}: {
  themeId: ThemeId;
  setThemeId: (v: ThemeId) => void;
  preview: React.ComponentProps<typeof StorefrontPreviewPhone>["preview"];
}) {
  const SWATCH_ORDER: ThemeId[] = [
    "sunflower",
    "fresh",
    "tomato",
    "cobalt",
    "charcoal",
    "forest",
  ];
  return (
    <div className="space-y-6">
      <p className="text-sm text-black/65 leading-relaxed">
        בחרו ערכת צבעים לחנות שלכם. ההדמיה למטה מתעדכנת בלייב לפי הבחירה.
        אפשר לשנות מאוחר יותר בהגדרות.
      </p>

      <div className="inline-flex items-center gap-3.5 px-4 py-3 bg-white border-2 border-black rounded-2xl shadow-[0_3px_0_#000]">
        <span className="text-xs font-black text-black">ערכת צבע</span>
        <div className="flex gap-2">
          {SWATCH_ORDER.map((id) => {
            const t = THEMES[id];
            const active = themeId === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setThemeId(id)}
                aria-label={t.name}
                aria-pressed={active}
                className="w-[26px] h-[26px] rounded-full border-2 border-black p-0 cursor-pointer transition-transform hover:scale-110"
                style={{
                  background: t.primary,
                  outline: active ? "2px solid #000" : "none",
                  outlineOffset: active ? 2 : 0,
                }}
              />
            );
          })}
        </div>
      </div>

      <div className="flex justify-center pt-2">
        <StorefrontPreviewPhone preview={preview} themeId={themeId} />
      </div>
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
        חשבון הבעלים הראשי - תוכל להוסיף מנהלים, צוות מטבח ושליחים מאוחר יותר.
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
      {/* Progress line - width based on current step */}
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
      <div className="mt-1 space-y-0.5">
        <p className="text-xs text-black/70 leading-snug">
          זו הכתובת שהלקוחות יקלידו כדי להגיע לאתר שלכם - מומלץ לבחור את שם העסק באנגלית.
        </p>
        <p className="text-[11px] text-qf-mute">
          אותיות קטנות, ספרות ומקפים · לפחות 2 תווים
        </p>
      </div>
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
      text: "אנגלית בלבד - אותיות קטנות, ספרות ומקפים",
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
