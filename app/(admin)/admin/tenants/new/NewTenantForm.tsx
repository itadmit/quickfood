"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { THEMES, type ThemeId } from "@/lib/themes";
import { cn } from "@/lib/cn";

export function NewTenantForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [logoLetter, setLogoLetter] = useState("");
  const [themeId, setThemeId] = useState<ThemeId>("fresh");
  const [cuisineType, setCuisineType] = useState("");
  const [branchAddress, setBranchAddress] = useState("");
  const [branchPhone, setBranchPhone] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-derive slug + logo letter from name
  function onNameChange(v: string) {
    setName(v);
    if (!slug) {
      const auto = v
        .toLowerCase()
        .replace(/[^a-zA-Z0-9\s֐-׿-]/g, "")
        .trim()
        .replace(/\s+/g, "-");
      setSlug(auto.slice(0, 40));
    }
    if (!logoLetter) setLogoLetter(v.trim().slice(0, 1));
  }

  async function submit() {
    if (!name || !slug || !branchAddress || !ownerEmail || !ownerPassword) {
      setError("חובה למלא את כל השדות הבסיסיים");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/tenants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          name,
          logo_letter: logoLetter || name.slice(0, 1),
          theme_id: themeId,
          cuisine_type: cuisineType || undefined,
          branch: {
            name: "ראשי",
            address: branchAddress,
            phone: branchPhone,
          },
          owner: {
            email: ownerEmail.toLowerCase(),
            name: ownerName,
            password: ownerPassword,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "יצירה נכשלה");
        return;
      }
      router.push("/admin/tenants");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <header className="flex items-center gap-3">
        <Link
          href="/admin/tenants"
          className="w-9 h-9 rounded-full border border-qf-line-dash grid place-items-center"
        >
          ←
        </Link>
        <div>
          <h1 className="text-2xl font-bold">לקוח חדש</h1>
          <p className="text-sm text-qf-mute">יצירת מסעדה + סניף + משתמש בעלים</p>
        </div>
      </header>

      <section className="bg-white rounded-2xl border border-qf-line-dash p-5 space-y-4">
        <h2 className="font-semibold">פרטי מסעדה</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="שם המסעדה">
            <input
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
            />
          </Field>
          <Field label="Slug (URL)">
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              dir="ltr"
              placeholder="my-restaurant"
              className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none font-mono"
            />
          </Field>
          <Field label="אות לוגו (1–2 תווים)">
            <input
              value={logoLetter}
              onChange={(e) => setLogoLetter(e.target.value.slice(0, 2))}
              maxLength={2}
              className="w-24 px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none text-center font-bold"
            />
          </Field>
          <Field label="סוג מטבח (אופציונלי)">
            <input
              value={cuisineType}
              onChange={(e) => setCuisineType(e.target.value)}
              placeholder="פיצה / המבורגרים / סושי"
              className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
            />
          </Field>
        </div>

        <Field label="ערכת צבע">
          <div className="grid grid-cols-4 gap-2">
            {Object.values(THEMES).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setThemeId(t.id)}
                className={cn(
                  "rounded-xl border p-2 text-start",
                  themeId === t.id
                    ? "border-qf-ink ring-2 ring-qf-ink/30"
                    : "border-qf-line-dash",
                )}
              >
                <div className="flex gap-1 mb-1">
                  <span className="w-4 h-4 rounded" style={{ background: t.primary }} />
                  <span className="w-4 h-4 rounded" style={{ background: t.deep }} />
                  <span className="w-4 h-4 rounded" style={{ background: t.soft }} />
                </div>
                <div className="text-xs font-medium">{t.name}</div>
              </button>
            ))}
          </div>
        </Field>
      </section>

      <section className="bg-white rounded-2xl border border-qf-line-dash p-5 space-y-4">
        <h2 className="font-semibold">סניף ראשי</h2>
        <Field label="כתובת">
          <input
            value={branchAddress}
            onChange={(e) => setBranchAddress(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
          />
        </Field>
        <Field label="טלפון">
          <input
            value={branchPhone}
            onChange={(e) => setBranchPhone(e.target.value)}
            dir="ltr"
            placeholder="03-555-1234"
            className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
          />
        </Field>
      </section>

      <section className="bg-white rounded-2xl border border-qf-line-dash p-5 space-y-4">
        <h2 className="font-semibold">משתמש בעלים</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="שם מלא">
            <input
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
            />
          </Field>
          <Field label="אימייל">
            <input
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              dir="ltr"
              className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
            />
          </Field>
        </div>
        <Field label="סיסמה ראשונית">
          <input
            type="text"
            value={ownerPassword}
            onChange={(e) => setOwnerPassword(e.target.value)}
            placeholder="לפחות 8 תווים"
            className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none font-mono"
          />
        </Field>
      </section>

      {error && (
        <div className="bg-qf-tomato-soft border border-qf-tomato/40 text-qf-tomato text-sm rounded-xl px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Link
          href="/admin/tenants"
          className="px-4 py-2 rounded-xl border border-qf-line-dash text-sm"
        >
          ביטול
        </Link>
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="px-4 py-2 rounded-xl bg-qf-ink text-white text-sm font-medium disabled:opacity-60"
        >
          {busy ? "יוצר..." : "צור לקוח"}
        </button>
      </div>
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
