"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { THEMES, type ThemeId } from "@/lib/themes";
import { BUSINESS_TYPES, type BusinessType, MenuItemImage } from "@/components/shared/MenuItemImage";
import { cn } from "@/lib/cn";

interface Tenant {
  id: string;
  name: string;
  logoLetter: string;
  themeId: ThemeId;
  businessType: BusinessType;
  cuisineType: string | null;
  slug: string;
}

export function BrandingForm({ tenant }: { tenant: Tenant }) {
  const router = useRouter();
  const [name, setName] = useState(tenant.name);
  const [logoLetter, setLogoLetter] = useState(tenant.logoLetter);
  const [themeId, setThemeId] = useState<ThemeId>(tenant.themeId);
  const [businessType, setBusinessType] = useState<BusinessType>(tenant.businessType);
  const [cuisineType, setCuisineType] = useState(tenant.cuisineType ?? "");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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
          theme_id: themeId,
          business_type: businessType,
          cuisine_type: cuisineType || undefined,
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
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
      <div className="space-y-5 bg-white rounded-2xl border border-qf-line-dash p-5">
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
          <label className="text-sm font-medium" htmlFor="logo">אות לוגו (1–2 תווים)</label>
          <input
            id="logo"
            value={logoLetter}
            maxLength={2}
            onChange={(e) => setLogoLetter(e.target.value)}
            className="w-24 px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none text-center font-bold"
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

        <div className="space-y-2">
          <div className="text-sm font-medium">סוג עסק</div>
          <div className="text-xs text-qf-mute mb-1">משפיע על הפלייסהולדרים שמוצגים לפריטים ללא תמונה</div>
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
                  <MenuItemImage alt={t.label} businessType={t.value} size={32} rounded="lg" />
                  <span className="font-medium text-xs">{t.label}</span>
                </button>
              );
            })}
          </div>
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
            {toast && <span className="text-qf-green-deep">✓ {toast}</span>}
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
        className="bg-white rounded-2xl border border-qf-line-dash p-5 h-fit space-y-4"
        data-theme={themeId}
        style={
          {
            "--qf-primary": THEMES[themeId].primary,
            "--qf-deep": THEMES[themeId].deep,
            "--qf-soft": THEMES[themeId].soft,
            "--qf-line": THEMES[themeId].line,
          } as React.CSSProperties
        }
      >
        <div className="text-xs text-qf-mute">תצוגה מקדימה</div>
        <div className="rounded-2xl bg-gradient-to-br from-(--qf-primary) to-(--qf-deep) p-5 text-white space-y-2">
          <div className="text-3xl font-bold">{logoLetter}</div>
          <div className="text-lg font-semibold">{name}</div>
          {cuisineType && <div className="text-sm opacity-80">{cuisineType}</div>}
        </div>
        <a
          href={`/${tenant.slug}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-(--qf-deep) underline"
        >
          /{tenant.slug} ← לחנות הלקוח
        </a>
      </aside>
    </div>
  );
}
