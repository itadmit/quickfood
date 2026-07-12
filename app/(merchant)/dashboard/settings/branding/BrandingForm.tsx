"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { THEMES, type ThemeId } from "@/lib/themes";
import { type BusinessType } from "@/components/shared/MenuItemImage";
import { BusinessTypeSelect } from "@/components/shared/BusinessTypeSelect";
import { ImageUploader } from "@/components/shared/ImageUploader";
import { SmartImg } from "@/components/shared/SmartImg";

import { IcoCheck, IcoCopy, IcoWhatsApp, IcoTrash, IcoQrCode, IcoClose } from "@/components/shared/Icons";
import { Modal } from "@/components/shared/Modal";
import { SettingsSaveBar } from "@/components/merchant/SettingsSaveBar";
import { cn } from "@/lib/cn";

interface Tenant {
  id: string;
  name: string;
  logoLetter: string;
  logoUrl: string | null;
  themeId: ThemeId;
  businessType: BusinessType;
  cuisineType: string | null;
  about: string | null;
  slug: string;
  coverImage: string | null;
  customDomain: string | null;
  vatNumber: string | null;
}

interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  minOrder: number;
  deliveryFee: number;
  serviceFee: number;
  busyEtaBoostMinutes: number;
  defaultEtaMin: number;
  defaultEtaMax: number;
}

const ABOUT_MAX = 90;

function singleLineAbout(v: string): string {
  return v.replace(/\s*\n+\s*/g, " ").slice(0, ABOUT_MAX);
}

function deriveLogoLetter(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "QF";
  return Array.from(trimmed).slice(0, 2).join("");
}

export function BrandingForm({
  tenant,
  branch,
  storefrontUrl,
  qrDataUrl,
}: {
  tenant: Tenant;
  branch: Branch | null;
  storefrontUrl: string;
  qrDataUrl: string;
}) {
  const router = useRouter();

  // Branding (tenant-level) state
  const [name, setName] = useState(tenant.name);
  const [themeId, setThemeId] = useState<ThemeId>(tenant.themeId);
  const [businessType, setBusinessType] = useState<BusinessType>(tenant.businessType);
  const [cuisineType, setCuisineType] = useState(tenant.cuisineType ?? "");
  const [about, setAbout] = useState(singleLineAbout(tenant.about ?? ""));
  const [coverImage, setCoverImage] = useState<string | null>(tenant.coverImage);
  const [logoUrl, setLogoUrl] = useState<string | null>(tenant.logoUrl);
  const [vatNumber, setVatNumber] = useState(tenant.vatNumber ?? "");

  // Branch-level state (synced from primary branch). When the user has
  // multiple branches we plan to swap `branch` via the topbar branch
  // selector, but the form contract stays identical.
  const [branchName, setBranchName] = useState(branch?.name ?? "");
  const [branchAddress, setBranchAddress] = useState(branch?.address ?? "");
  const [branchPhone, setBranchPhone] = useState(branch?.phone ?? "");
  const [branchEmail, setBranchEmail] = useState(branch?.email ?? "");
  const [minOrder, setMinOrder] = useState(branch?.minOrder ?? 0);
  const [deliveryFee, setDeliveryFee] = useState(branch?.deliveryFee ?? 0);
  const [serviceFee, setServiceFee] = useState(branch?.serviceFee ?? 0);
  const [busyEtaBoost, setBusyEtaBoost] = useState(branch?.busyEtaBoostMinutes ?? 0);
  const [etaMin, setEtaMin] = useState(branch?.defaultEtaMin ?? 25);
  const [etaMax, setEtaMax] = useState(branch?.defaultEtaMax ?? 35);

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const logoLetter = deriveLogoLetter(name);

  async function save() {
    setSaving(true);
    setToast(null);
    try {
      // Tenant + branch are persisted in parallel through their own
      // endpoints. We treat the whole page as a single save action from
      // the merchant's perspective.
      const tenantPromise = fetch("/api/v1/merchant/tenant", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          logo_letter: logoLetter,
          logo_url: logoUrl,
          theme_id: themeId,
          business_type: businessType,
          cuisine_type: cuisineType || undefined,
          about: about.trim() ? about.trim() : null,
          cover_image: coverImage,
          vat_number: vatNumber || undefined,
        }),
      });

      const branchPromise = branch
        ? fetch(`/api/v1/merchant/branches/${branch.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              name: branchName,
              address: branchAddress,
              phone: branchPhone,
              email: branchEmail || undefined,
              min_order: minOrder,
              delivery_fee: deliveryFee,
              service_fee: serviceFee,
              busy_eta_boost_minutes: busyEtaBoost,
              default_eta_min: etaMin,
              default_eta_max: etaMax,
            }),
          })
        : Promise.resolve({ ok: true } as Response);

      const [tenantRes, branchRes] = await Promise.all([tenantPromise, branchPromise]);
      const ok = tenantRes.ok && branchRes.ok;
      setToast(ok ? { kind: "ok", msg: "נשמר" } : { kind: "err", msg: "שמירה נכשלה" });
      if (ok) router.refresh();
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 2200);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

        {/* ─── Column 1 (right in RTL): Branch details + Identity ── */}
        <div className="space-y-5">

          {/* פרטי העסק */}
          <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-4">
            <header className="space-y-1">
              <h2 className="font-bold text-lg">פרטי העסק</h2>
              <p className="text-xs text-qf-mute leading-relaxed">
                הפרטים הקובעים את הסניף שמוצג ללקוח, את הכתובת בחשבונית, ואת
                מחירי המשלוח הבסיסיים. דמי המשלוח כאן הם ברירת המחדל - אזורי
                משלוח יכולים לדרוס אותם פר-אזור.
              </p>
            </header>

            {!branch && (
              <div className="rounded-xl bg-qf-tomato-soft border border-qf-tomato/40 px-3.5 py-2.5 text-sm text-qf-tomato">
                לא נמצא סניף ראשי. הוסיפו סניף בהגדרות לפני שמרכזים פה את הפרטים.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="שם הסניף">
                <input
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  disabled={!branch}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none disabled:bg-qf-line-soft/40 disabled:text-qf-mute"
                />
              </Field>
              <Field label="טלפון">
                <input
                  value={branchPhone}
                  onChange={(e) => setBranchPhone(e.target.value)}
                  disabled={!branch}
                  dir="ltr"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none disabled:bg-qf-line-soft/40 disabled:text-qf-mute"
                />
              </Field>
            </div>

            <Field label="כתובת מלאה">
              <input
                value={branchAddress}
                onChange={(e) => setBranchAddress(e.target.value)}
                disabled={!branch}
                className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none disabled:bg-qf-line-soft/40 disabled:text-qf-mute"
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="דוא״ל">
                <input
                  value={branchEmail}
                  onChange={(e) => setBranchEmail(e.target.value)}
                  disabled={!branch}
                  type="email"
                  dir="ltr"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none disabled:bg-qf-line-soft/40 disabled:text-qf-mute"
                />
              </Field>
              <Field label="ח״פ / עוסק">
                <input
                  value={vatNumber}
                  onChange={(e) => setVatNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none tnum"
                />
              </Field>
            </div>

            <hr className="border-qf-line-soft" />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="סכום מינימום (₪)">
                <NumberField value={minOrder} onChange={setMinOrder} disabled={!branch} />
              </Field>
              <Field label="דמי משלוח ברירת מחדל (₪)">
                <NumberField value={deliveryFee} onChange={setDeliveryFee} disabled={!branch} />
              </Field>
              <Field label="דמי שירות (₪)">
                <NumberField value={serviceFee} onChange={setServiceFee} disabled={!branch} />
              </Field>
            </div>

            <Field label="זמן הגעה משוער (דקות)">
              <div className="flex items-center gap-2 max-w-[280px]">
                <div className="flex items-center border border-qf-line-dash rounded-xl focus-within:border-(--qf-primary) flex-1">
                  <span className="px-3 text-qf-mute text-sm">מ-</span>
                  <input
                    type="number"
                    min={0}
                    max={240}
                    value={etaMin}
                    onChange={(e) => setEtaMin(Math.max(0, Math.min(240, parseInt(e.target.value, 10) || 0)))}
                    disabled={!branch}
                    className="flex-1 w-full py-2.5 outline-none bg-transparent tnum disabled:text-qf-mute"
                  />
                </div>
                <span className="text-qf-mute text-sm">עד</span>
                <div className="flex items-center border border-qf-line-dash rounded-xl focus-within:border-(--qf-primary) flex-1">
                  <input
                    type="number"
                    min={0}
                    max={240}
                    value={etaMax}
                    onChange={(e) => setEtaMax(Math.max(0, Math.min(240, parseInt(e.target.value, 10) || 0)))}
                    disabled={!branch}
                    className="flex-1 w-full py-2.5 ps-3 outline-none bg-transparent tnum disabled:text-qf-mute"
                  />
                  <span className="px-3 text-qf-mute text-sm">דק&apos;</span>
                </div>
              </div>
              <p className="text-[11px] text-qf-mute mt-1.5 leading-snug">
                הטווח שמוצג ללקוח בכותרת החנות (למשל &quot;25-35 דק&apos;&quot;). אזור משלוח עם זמן משלו גובר על ברירת המחדל הזו.
              </p>
            </Field>

            <Field label="תוספת זמן הגעה בעומס (דקות)">
              <div className="flex items-center border border-qf-line-dash rounded-xl focus-within:border-(--qf-primary) max-w-[240px]">
                <span className="px-3 text-qf-mute text-sm">+</span>
                <input
                  type="number"
                  min={0}
                  max={180}
                  value={busyEtaBoost}
                  onChange={(e) =>
                    setBusyEtaBoost(Math.max(0, Math.min(180, parseInt(e.target.value, 10) || 0)))
                  }
                  disabled={!branch}
                  className="flex-1 py-2.5 outline-none bg-transparent tnum disabled:text-qf-mute"
                />
                <span className="px-3 text-qf-mute text-sm">דק&apos;</span>
              </div>
              <p className="text-[11px] text-qf-mute mt-1.5 leading-snug">
                כשהסטטוס במצב &quot;עומס&quot; - זמן ההגעה שמוצג ללקוח גדל בכמות הזו ומופיע מודל אזהרה.
              </p>
            </Field>
          </section>

          {/* מיתוג - שם החנות, סוג מטבח, תיאור, סוג עסק */}
          <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-4">
            <header className="space-y-1">
              <h2 className="font-bold text-lg">מיתוג</h2>
              <p className="text-xs text-qf-mute leading-relaxed">
                שם החנות, הסגנון הקולינרי והתיאור שמופיעים בעמוד הלקוח.
              </p>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="שם החנות (פומבי)">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
                />
              </Field>
              <Field label="סוג מטבח">
                <input
                  value={cuisineType}
                  onChange={(e) => setCuisineType(e.target.value)}
                  placeholder="לדוגמה: פיצה נפוליטנית"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
                />
              </Field>
            </div>

            <Field label="תיאור העסק">
              <textarea
                value={about}
                onChange={(e) => setAbout(singleLineAbout(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.preventDefault();
                }}
                rows={2}
                maxLength={ABOUT_MAX}
                placeholder="טאגליין קצר שמופיע מתחת לשם החנות בעמוד הלקוח"
                className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none resize-none leading-relaxed"
              />
              <p className="text-xs text-qf-mute mt-1">
                שורה אחת, עד {ABOUT_MAX} תווים ({about.length}/{ABOUT_MAX}). מוצג בעמוד הראשי של החנות לצד הלוגו.
              </p>
            </Field>

            <BusinessTypeSelect
              label="סוג עסק"
              hint="מוצרים ללא תמונה יציגו את האייקון לפי סוג העסק"
              value={businessType}
              onChange={setBusinessType}
            />
          </section>

        </div>

        {/* ─── Column 2 (left in RTL): Design + Share ───────────── */}
        <div className="space-y-5">

          {/* עיצוב */}
          <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-5">
            <header className="space-y-1">
              <h2 className="font-bold text-lg">עיצוב</h2>
              <p className="text-xs text-qf-mute leading-relaxed">
                לוגו, תמונת קאבר וערכת הצבע של החנות.
              </p>
            </header>

            <div className="space-y-2">
              <div className="font-semibold">לוגו</div>
              <p className="text-xs text-qf-mute">
                מומלץ ריבוע (1:1) עם רקע שקוף - png או webp. הלוגו מופיע בעיגול
                הקטן ליד שם החנות בלקוח. אם לא יועלה לוגו - יוצגו האותיות
                הראשונות מהשם.
              </p>

              {logoUrl ? (
                <div className="flex items-center gap-3">
                  <div className="relative w-20 h-20 rounded-2xl overflow-hidden border border-qf-line-dash bg-qf-line-soft/40">
                    <SmartImg src={logoUrl} alt="" fill className="absolute inset-0 object-contain" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setLogoUrl(null)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-qf-tomato/40 text-qf-tomato hover:bg-qf-tomato-soft text-sm font-medium"
                  >
                    <IcoTrash c="currentColor" s={14} />
                    מחק לוגו
                  </button>
                </div>
              ) : (
                <ImageUploader
                  type="logo"
                  value={[]}
                  onChange={(urls) => setLogoUrl(urls[0] ?? null)}
                  max={1}
                  multiple={false}
                />
              )}
            </div>

            <div className="space-y-2">
              <div className="font-semibold">תמונת קאבר</div>
              <p className="text-xs text-qf-mute">
                התמונה מופיעה ככותרת בחנות ובדף התפריט של הלקוח. אם לא תועלה תמונה
                - יוצג רקע בצבעי המותג.
              </p>

              {coverImage ? (
                <div className="space-y-2">
                  <div className="relative rounded-2xl overflow-hidden border border-qf-line-dash aspect-5/2">
                    <SmartImg
                      src={coverImage}
                      alt=""
                      fill
                      className="absolute inset-0"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setCoverImage(null)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-qf-tomato/40 text-qf-tomato hover:bg-qf-tomato-soft text-sm font-medium"
                  >
                    <IcoTrash c="currentColor" s={14} />
                    מחק תמונה - להחלפה בחר תמונה חדשה לאחר המחיקה
                  </button>
                </div>
              ) : (
                <ImageUploader
                  type="cover_image"
                  value={[]}
                  onChange={(urls) => setCoverImage(urls[0] ?? null)}
                  max={1}
                  multiple={false}
                />
              )}
            </div>

            <div className="space-y-2">
              <div className="font-semibold">ערכת צבע</div>
              <div className="flex flex-wrap gap-3">
                {Object.values(THEMES).map((t) => {
                  const selected = t.id === themeId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setThemeId(t.id)}
                      aria-label={t.name}
                      aria-pressed={selected}
                      title={t.name}
                      className="w-9 h-9 rounded-full border-2 border-black cursor-pointer transition-transform hover:scale-110"
                      style={{
                        background: t.primary,
                        outline: selected ? "2px solid #000" : "none",
                        outlineOffset: selected ? 3 : 0,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </section>

          {/* שיתוף החנות */}
          <section
            className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-3"
            data-theme={themeId}
            style={
              {
                "--qf-primary": THEMES[themeId].primary,
                "--qf-deep": THEMES[themeId].deep,
                "--qf-soft": THEMES[themeId].soft,
                "--qf-line": THEMES[themeId].line,
                "--qf-on-primary": THEMES[themeId].onPrimary,
              } as React.CSSProperties
            }
          >
            <header className="space-y-1">
              <h2 className="font-bold text-lg">שיתוף החנות</h2>
              <p className="text-xs text-qf-mute leading-relaxed">
                כתובת החנות הציבורית שלך לשיתוף עם לקוחות, להדפסה על פלאיירים
                או הדבקה ב-WhatsApp.
              </p>
            </header>
            <div className="text-xs text-qf-mute font-mono break-all" dir="ltr">
              {storefrontUrl}
            </div>
            <ShopShareActions
              slug={tenant.slug}
              name={name}
              storefrontUrl={storefrontUrl}
              qrDataUrl={qrDataUrl}
            />
          </section>

        </div>

      </div>

      <SettingsSaveBar saving={saving} onSave={save} toast={toast} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium block">{label}</label>
      {children}
    </div>
  );
}

function NumberField({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center border border-qf-line-dash rounded-xl focus-within:border-(--qf-primary)">
      <span className="px-3 text-qf-mute">₪</span>
      <input
        type="number"
        min={0}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        className="flex-1 py-2.5 outline-none bg-transparent tnum disabled:text-qf-mute"
      />
    </div>
  );
}

function ShopShareActions({
  slug,
  name,
  storefrontUrl,
  qrDataUrl,
}: {
  slug: string;
  name: string;
  storefrontUrl: string;
  qrDataUrl: string;
}) {
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(storefrontUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked - ignore */
    }
  }

  function shareWhatsApp() {
    const text = `${name} - להזמנות אונליין: ${storefrontUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  return (
    <>
      <div className="flex items-stretch gap-2 flex-wrap">
        <a
          href={`/s/${slug}`}
          target="_blank"
          rel="noreferrer"
          className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#F8CB1E] hover:bg-[#FFD843] text-black border-2 border-black shadow-[0_2px_0_#000] active:translate-y-px active:shadow-[0_1px_0_#000] text-sm font-bold transition"
        >
          צפה בחנות
        </a>
        <button
          type="button"
          onClick={copy}
          aria-label="העתק כתובת אתר"
          title={copied ? "הועתק" : "העתק כתובת אתר"}
          className="w-11 h-11 rounded-xl border-2 border-black bg-white hover:bg-qf-line-soft grid place-items-center text-qf-ink2 shadow-[0_2px_0_#000] active:translate-y-px active:shadow-[0_1px_0_#000] transition"
        >
          {copied ? (
            <IcoCheck c="currentColor" s={16} />
          ) : (
            <IcoCopy c="currentColor" s={16} />
          )}
        </button>
        <button
          type="button"
          onClick={() => setQrOpen(true)}
          aria-label="QR code לחנות"
          title="QR code לחנות"
          className="w-11 h-11 rounded-xl border-2 border-black bg-white hover:bg-qf-line-soft grid place-items-center text-qf-ink2 shadow-[0_2px_0_#000] active:translate-y-px active:shadow-[0_1px_0_#000] transition"
        >
          <IcoQrCode c="currentColor" s={18} />
        </button>
        <button
          type="button"
          onClick={shareWhatsApp}
          aria-label="שתף בוואטסאפ"
          title="שתף בוואטסאפ"
          className="w-11 h-11 rounded-xl border-2 border-black bg-white hover:bg-qf-line-soft grid place-items-center shadow-[0_2px_0_#000] active:translate-y-px active:shadow-[0_1px_0_#000] transition"
        >
          <IcoWhatsApp s={18} />
        </button>
      </div>

      {qrOpen && (
        <QrModal
          name={name}
          slug={slug}
          storefrontUrl={storefrontUrl}
          qrDataUrl={qrDataUrl}
          onClose={() => setQrOpen(false)}
        />
      )}
    </>
  );
}

function QrModal({
  name,
  slug,
  storefrontUrl,
  qrDataUrl,
  onClose,
}: {
  name: string;
  slug: string;
  storefrontUrl: string;
  qrDataUrl: string;
  onClose: () => void;
}) {
  const downloadName = `${slug || "quickfood"}-qr.png`;
  return (
    <Modal open onClose={onClose} size="sm" ariaLabel="QR code לחנות">
      <button
        type="button"
        onClick={onClose}
        aria-label="סגור"
        className="absolute top-3 inset-s-3 z-20 w-9 h-9 rounded-full grid place-items-center bg-qf-line-soft hover:bg-qf-line transition"
      >
        <IcoClose c="currentColor" s={14} />
      </button>

      <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
        <div className="text-center space-y-1 pt-1">
          <h3 className="font-bold text-lg">QR code לחנות</h3>
          <p className="text-xs text-qf-ink2">
            סרוק בטלפון או הדפס על פלאיירים, תפריטים ושלטים.
          </p>
        </div>

        <div className="bg-white border border-qf-line rounded-2xl p-3 grid place-items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt={`QR code לחנות ${name}`}
            width={320}
            height={320}
            className="w-full max-w-[320px] h-auto"
          />
        </div>

        <div className="text-center text-xs text-qf-ink2 break-all" dir="ltr">
          {storefrontUrl}
        </div>

        <a
          href={qrDataUrl}
          download={downloadName}
          className="block w-full text-center px-3 py-2.5 rounded-xl bg-[#F8CB1E] hover:bg-[#FFD843] text-black border-2 border-black shadow-[0_2px_0_#000] active:translate-y-px active:shadow-[0_1px_0_#000] text-sm font-bold transition"
        >
          הורד PNG
        </a>
      </div>
    </Modal>
  );
}
