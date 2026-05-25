"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { THEMES, type ThemeId } from "@/lib/themes";
import { type BusinessType } from "@/components/shared/MenuItemImage";
import { BusinessTypeSelect } from "@/components/shared/BusinessTypeSelect";
import { ImageUploader } from "@/components/shared/ImageUploader";
import { SmartImg } from "@/components/shared/SmartImg";

import { IcoCheck, IcoCopy, IcoWhatsApp, IcoTrash, IcoQrCode, IcoClose } from "@/components/shared/Icons";
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
}

/**
 * Always-2-char logo mark derived from the tenant name. Strips whitespace,
 * takes the first 2 graphemes, falls back to "QF" if the name is empty.
 * Works for both Hebrew ("פיצרייה ורדה" → "פי") and Latin ("Pizza Verde" → "Pi").
 */
function deriveLogoLetter(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "QF";
  // Use Array.from so surrogate-pair emojis count as one grapheme.
  return Array.from(trimmed).slice(0, 2).join("");
}

export function BrandingForm({
  tenant,
  storefrontUrl,
  qrDataUrl,
}: {
  tenant: Tenant;
  storefrontUrl: string;
  qrDataUrl: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(tenant.name);
  const [themeId, setThemeId] = useState<ThemeId>(tenant.themeId);
  const [businessType, setBusinessType] = useState<BusinessType>(tenant.businessType);
  const [cuisineType, setCuisineType] = useState(tenant.cuisineType ?? "");
  const [about, setAbout] = useState(tenant.about ?? "");
  const [coverImage, setCoverImage] = useState<string | null>(tenant.coverImage);
  const [logoUrl, setLogoUrl] = useState<string | null>(tenant.logoUrl);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const logoLetter = deriveLogoLetter(name);

  async function save() {
    setSaving(true);
    setToast(null);
    try {
      const res = await fetch("/api/v1/merchant/tenant", {
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
        }),
      });
      if (res.ok) {
        setToast("נשמר");
        router.refresh();
      } else {
        setToast("שמירה נכשלה");
      }
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 2000);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 lg:gap-6">
      <div className="space-y-5 bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5">
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="name">שם הפיצרייה</label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="cuisine">סוג מטבח</label>
          <input
            id="cuisine"
            value={cuisineType}
            onChange={(e) => setCuisineType(e.target.value)}
            placeholder="לדוגמה: פיצה נפוליטנית"
            className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="about">תיאור העסק</label>
          <textarea
            id="about"
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="טאגליין קצר או פסקה שמופיעה מתחת לשם החנות בעמוד הלקוח"
            className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none resize-y leading-relaxed"
          />
          <p className="text-xs text-qf-mute">
            עד 2000 תווים. מוצג בעמוד הראשי של החנות לצד הלוגו.
          </p>
        </div>

        <BusinessTypeSelect
          label="סוג עסק"
          hint="מוצרים ללא תמונה יציגו את האייקון לפי סוג העסק"
          value={businessType}
          onChange={setBusinessType}
        />

        <div className="space-y-2">
          <div className="text-sm font-medium">לוגו</div>
          <p className="text-xs text-qf-mute">
            מומלץ ריבוע (1:1) עם רקע שקוף — png או webp. הלוגו מופיע בעיגול
            הקטן ליד שם החנות בלקוח. אם לא יועלה לוגו — יוצגו האותיות
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
          <div className="text-sm font-medium">תמונת קאבר לחנות</div>
          <p className="text-xs text-qf-mute">
            התמונה מופיעה ככותרת בחנות ובדף התפריט של הלקוח. אם לא תועלה תמונה
            — יוצג רקע ירוק בצבעי המותג.
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
                מחק תמונה — להחלפה בחר תמונה חדשה לאחר המחיקה
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
          <div className="text-sm font-medium">ערכת צבע</div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
            {Object.values(THEMES).map((t) => {
              const selected = t.id === themeId;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setThemeId(t.id)}
                  className={cn(
                    "rounded-xl border p-2.5 text-start transition",
                    selected
                      ? "border-qf-ink ring-2 ring-(--qf-primary)/30"
                      : "border-qf-line-dash hover:border-qf-ink/40",
                  )}
                >
                  <div className="flex gap-1 mb-1.5">
                    <span className="w-5 h-5 rounded-md" style={{ background: t.primary }} />
                    <span className="w-5 h-5 rounded-md" style={{ background: t.deep }} />
                    <span className="w-5 h-5 rounded-md" style={{ background: t.soft }} />
                  </div>
                  <div className="text-xs font-medium">{t.name}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-qf-line-soft">
          <div className="text-sm text-qf-mute">
            {toast && (
              <span className="inline-flex items-center gap-1.5 text-qf-green-deep">
                <IcoCheck c="currentColor" s={14} />
                {toast}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-medium disabled:opacity-60"
          >
            {saving ? "שומר..." : "שמירת שינויים"}
          </button>
        </div>
      </div>

      {/* Live preview card */}
      <aside
        className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 h-fit space-y-4"
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
        <div className="text-xs text-qf-mute">תצוגה מקדימה</div>
        <div className="rounded-2xl overflow-hidden relative h-36 text-white">
          {coverImage ? (
            <>
              <SmartImg src={coverImage} alt="" fill className="absolute inset-0 object-cover" />
              <div className="absolute inset-0 bg-linear-to-b from-black/60 to-black/80" />
            </>
          ) : (
            <div className="absolute inset-0 bg-linear-to-b from-(--qf-primary) to-(--qf-deep)" />
          )}
          <div className="absolute inset-0 flex flex-col justify-end p-4 gap-1">
            <div className="flex items-center gap-2.5">
              {logoUrl ? (
                <div className="w-11 h-11 rounded-full overflow-hidden bg-white grid place-items-center shrink-0 shadow">
                  <SmartImg src={logoUrl} alt="" width={44} height={44} className="object-contain w-full h-full" />
                </div>
              ) : (
                <div className="w-11 h-11 rounded-full bg-white/20 grid place-items-center shrink-0 text-sm font-bold">
                  {logoLetter}
                </div>
              )}
              <div>
                <div className="text-base font-semibold leading-tight drop-shadow">{name}</div>
                {cuisineType && <div className="text-xs opacity-80 mt-0.5">{cuisineType}</div>}
              </div>
            </div>
          </div>
        </div>
        <ShopShareActions
          slug={tenant.slug}
          name={name}
          storefrontUrl={storefrontUrl}
          qrDataUrl={qrDataUrl}
        />
      </aside>
    </div>
  );
}

/**
 * Four actions for the merchant's public storefront URL:
 *  • view shop (opens in a new tab — primary button)
 *  • copy URL (icon, briefly flips to a check on success)
 *  • QR code (icon, opens a modal with the QR image + download button)
 *  • share on WhatsApp (icon, opens wa.me with a pre-filled message)
 *
 * The storefront URL + QR data URL are generated server-side in
 * page.tsx — they account for the tenant's customDomain if one is set.
 */
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
      /* clipboard blocked — ignore */
    }
  }

  function shareWhatsApp() {
    const text = `${name} — להזמנות אונליין: ${storefrontUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  return (
    <>
      <div className="flex items-stretch gap-2">
        <a
          href={`/${slug}`}
          target="_blank"
          rel="noreferrer"
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-medium transition"
        >
          צפה בחנות
        </a>
        <button
          type="button"
          onClick={copy}
          aria-label="העתק כתובת אתר"
          title={copied ? "הועתק" : "העתק כתובת אתר"}
          className="w-10 h-10 rounded-xl border border-qf-line-dash hover:bg-qf-line-soft grid place-items-center text-qf-ink2"
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
          className="w-10 h-10 rounded-xl border border-qf-line-dash hover:bg-qf-line-soft grid place-items-center text-qf-ink2"
        >
          <IcoQrCode c="currentColor" s={18} />
        </button>
        <button
          type="button"
          onClick={shareWhatsApp}
          aria-label="שתף בוואטסאפ"
          title="שתף בוואטסאפ"
          className="w-10 h-10 rounded-xl border border-qf-line-dash hover:bg-qf-line-soft grid place-items-center"
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

/**
 * Modal preview of the storefront QR code. Server-generated PNG data
 * URL means no client deps and the download button is a plain anchor
 * with `download` — works offline, no extra request.
 */
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
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-sm bg-white rounded-3xl border border-qf-line p-6 space-y-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="סגור"
          className="absolute top-3 inset-s-3 w-9 h-9 rounded-full grid place-items-center bg-qf-line-soft hover:bg-qf-line transition"
        >
          <IcoClose c="currentColor" s={14} />
        </button>

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
          className="block w-full text-center px-3 py-2.5 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-bold transition"
        >
          הורד PNG
        </a>
      </div>
    </div>
  );
}
