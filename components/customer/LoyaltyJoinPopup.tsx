"use client";

import { useEffect, useState } from "react";
import { IcoClose, IcoHeart } from "@/components/shared/Icons";

interface JoinForm {
  title: string;
  subtitle: string;
  button_text: string;
  image_url: string | null;
  collect_name: boolean;
  collect_email: boolean;
  collect_birthday: boolean;
  consent_text: string;
}

interface LoyaltyPublic {
  show_join_popup: boolean;
  join_form: JoinForm;
}

interface Props {
  tenantSlug: string;
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function seenKey(slug: string) {
  return `qf:loyalty:${slug}:${todayKey()}`;
}
function joinedKey(slug: string) {
  return `qf:loyalty-joined:${slug}`;
}

export function LoyaltyJoinPopup({ tenantSlug }: Props) {
  const [form, setForm] = useState<JoinForm | null>(null);
  const [visible, setVisible] = useState(false);

  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (window.localStorage.getItem(joinedKey(tenantSlug))) return;
        if (window.localStorage.getItem(seenKey(tenantSlug))) return;
        const res = await fetch(`/api/v1/restaurants/${tenantSlug}/loyalty`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as LoyaltyPublic;
        if (cancelled || !data.show_join_popup) return;
        setForm(data.join_form);
        window.setTimeout(() => !cancelled && setVisible(true), 50);
      } catch {
        // Silent - popup is non-critical.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantSlug]);

  function dismiss() {
    try {
      window.localStorage.setItem(seenKey(tenantSlug), "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
    window.setTimeout(() => setForm(null), 200);
  }

  async function submit() {
    setError(null);
    if (!phone.trim()) {
      setError("נא להזין מספר טלפון");
      return;
    }
    if (!consent) {
      setError("יש לאשר את התקנון ומדיניות הפרטיות");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/v1/customer/loyalty/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          tenant_slug: tenantSlug,
          phone: phone.trim(),
          first_name: firstName.trim() || undefined,
          last_name: lastName.trim() || undefined,
          email: email.trim() || undefined,
          marketing_consent: true,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setError(data?.error?.message ?? "ההצטרפות נכשלה, נסו שוב");
        return;
      }
      try {
        window.localStorage.setItem(joinedKey(tenantSlug), "1");
        window.localStorage.setItem(seenKey(tenantSlug), "1");
      } catch {
        /* ignore */
      }
      setDone(true);
      window.setTimeout(() => {
        setVisible(false);
        window.setTimeout(() => setForm(null), 200);
      }, 1800);
    } finally {
      setBusy(false);
    }
  }

  if (!form) return null;

  return (
    <div
      className={
        "fixed inset-0 z-60 grid place-items-center p-5 transition-opacity duration-200 " +
        (visible ? "opacity-100" : "opacity-0 pointer-events-none")
      }
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
      aria-label={form.title}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white rounded-3xl overflow-hidden shadow-2xl max-w-sm w-full"
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="סגור"
          className="absolute top-2.5 inset-e-2.5 z-10 w-9 h-9 rounded-full bg-black/45 backdrop-blur grid place-items-center hover:bg-black/65 transition"
        >
          <IcoClose c="#fff" s={18} />
        </button>

        {form.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={form.image_url} alt={form.title} className="block w-full h-32 object-cover" />
        ) : (
          <div className="h-20 bg-(--qf-primary) grid place-items-center">
            <IcoHeart c="var(--qf-on-primary, #000)" s={34} />
          </div>
        )}

        <div className="p-5">
          {done ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 mx-auto rounded-full bg-(--qf-primary) grid place-items-center mb-3">
                <IcoHeart c="var(--qf-on-primary, #000)" s={22} />
              </div>
              <h3 className="font-black text-lg">הצטרפת למועדון!</h3>
              <p className="text-sm text-qf-ink2 mt-1">תודה שהצטרפת. נתראה בהזמנה הבאה.</p>
            </div>
          ) : (
            <>
              <h3 className="font-black text-xl text-qf-ink">{form.title}</h3>
              {form.subtitle && (
                <p className="text-sm text-qf-ink2 mt-1 leading-relaxed">{form.subtitle}</p>
              )}

              <div className="mt-4 space-y-2.5">
                {form.collect_name && (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="שם פרטי"
                      className="rounded-xl border border-qf-line focus:border-(--qf-deep) px-3 py-2.5 text-sm outline-none"
                    />
                    <input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="שם משפחה"
                      className="rounded-xl border border-qf-line focus:border-(--qf-deep) px-3 py-2.5 text-sm outline-none"
                    />
                  </div>
                )}
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  placeholder="טלפון נייד"
                  dir="ltr"
                  className="w-full rounded-xl border border-qf-line focus:border-(--qf-deep) px-3 py-2.5 text-sm outline-none text-start"
                />
                {form.collect_email && (
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    placeholder="אימייל"
                    dir="ltr"
                    className="w-full rounded-xl border border-qf-line focus:border-(--qf-deep) px-3 py-2.5 text-sm outline-none text-start"
                  />
                )}
              </div>

              <label className="flex items-start gap-2 text-xs text-qf-ink2 leading-relaxed cursor-pointer mt-3">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 w-4 h-4 shrink-0 accent-(--qf-primary)"
                />
                <span>{form.consent_text}</span>
              </label>

              {error && <p className="text-xs text-qf-tomato font-semibold mt-2">{error}</p>}

              <button
                type="button"
                onClick={submit}
                disabled={busy}
                className="w-full mt-4 py-3 rounded-2xl bg-(--qf-primary) text-(--qf-on-primary) font-black text-sm disabled:opacity-60 transition"
              >
                {busy ? "מצטרפים..." : form.button_text}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
