"use client";

import { useState } from "react";
import Link from "next/link";
import { THEMES, type ThemeId } from "@/lib/themes";
import {
  StorefrontPreviewPhone,
  type StorefrontPreviewData,
} from "@/components/shared/wolt/StorefrontPreviewPhone";
import styles from "./WoltTeaser.module.css";

interface WoltPreviewMenu {
  categoriesCount: number;
  itemsCount: number;
  imagesCount: number;
  sampleItems: Array<{ name: string; image: string | null; price: number }>;
}

interface WoltPreview extends StorefrontPreviewData {
  phone: string | null;
  hours: Array<{ day: string; label: string; display: string; active: boolean }>;
  has_hours: boolean;
  menu: WoltPreviewMenu | null;
}

const SWATCHES: ThemeId[] = ["sunflower", "fresh", "tomato", "cobalt", "charcoal", "forest"];

export default function WoltTeaser() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<WoltPreview | null>(null);
  const [themeId, setThemeId] = useState<ThemeId>("sunflower");

  async function fetchPreview() {
    const trimmed = url.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/signup/wolt-preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "כשל בקריאה מ-Wolt");
        return;
      }
      setPreview(data as WoltPreview);
    } catch {
      setError("שגיאת רשת");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.layout}>
          <div className={styles.left}>
            <div className={styles.eyebrow}>
              <span>עובדים עם</span>
              <img
                src="/brands/wolt.png"
                alt="Wolt"
                className={styles.eyebrowWoltLogo}
              />
              <span>?</span>
            </div>

            <h2 className={styles.heading}>
            גלו איך החנות שלכם
              <br />
              תראה ב-Quick&nbsp;Food.
            </h2>
            <p className={styles.sub}>
              הדביקו את כתובת החנות שלכם ב-Wolt. נציג לכם תוך כמה שניות הדמיה
              של האתר שלכם בעיצוב Quick Food, בלי להירשם, בלי לשלם, בלי כאבי
              ראש. כלום לא נשמר אצלנו.
            </p>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>כתובת החנות בוולט</span>
              <div className={styles.inputRow}>
                <input
                  dir="ltr"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      fetchPreview();
                    }
                  }}
                  placeholder="https://wolt.com/he/isr/tel-aviv/restaurant/..."
                  className={styles.input}
                  aria-label="כתובת חנות וולט"
                />
                <button
                  type="button"
                  onClick={fetchPreview}
                  disabled={!url.trim() || busy}
                  className={styles.cta}
                >
                  {busy ? "טוען…" : "להדמיה"}
                </button>
              </div>
              {error && <span className={styles.error}>{error}</span>}
              <span className={styles.disclaimer}>
                ההדמיה היא להמחשה בלבד — לא נוצרת חנות, שום פריט לא נשמר אצלנו.
                התוכן מוצג מתוך עמוד Wolt הציבורי שלכם.
              </span>
            </label>

            <div className={styles.themeRow}>
              <span className={styles.themeLabel}>ערכת צבע</span>
              <div className={styles.swatches}>
                {SWATCHES.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setThemeId(id)}
                    aria-label={THEMES[id].name}
                    aria-pressed={themeId === id}
                    className={styles.swatch}
                    style={
                      {
                        "--swatch": THEMES[id].primary,
                        outline: themeId === id ? "2px solid #000" : "none",
                        outlineOffset: themeId === id ? 2 : 0,
                      } as React.CSSProperties
                    }
                  />
                ))}
              </div>
            </div>

            {preview && (
              <div className={styles.ctaRow}>
                <Link href="/signup" className={styles.ctaPrimary}>
                 אוקי, אני רוצה להירשם!
                </Link>
                <p className={styles.ctaHint}>
                  בהרשמה תוכלו להדביק את הקישור הזה שוב ולייבא את התפריט המלא
                  עם תמונות וקטגוריות.
                </p>
              </div>
            )}
          </div>

          <div className={styles.right}>
            <StorefrontPreviewPhone
              preview={preview}
              themeId={themeId}
              busy={busy}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function WoltMark({ className }: { className?: string }) {
  return (
    <span
      className={className}
      aria-label="Wolt"
      role="img"
      style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
    >
      <svg width="14" height="14" viewBox="0 0 32 32" aria-hidden>
        <circle cx="16" cy="16" r="14" fill="#009DE0" />
        <text
          x="16"
          y="22"
          textAnchor="middle"
          fontSize="16"
          fontWeight="900"
          fill="#fff"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          W
        </text>
      </svg>
      <span style={{ fontWeight: 800, color: "#009DE0", fontSize: 14 }}>Wolt</span>
    </span>
  );
}
