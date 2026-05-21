"use client";

import { useMemo, useState } from "react";
import styles from "./ItemCustomizerMockup.module.css";

type Size = { id: string; label: string; sub: string; delta: number };
type Crust = { id: string; label: string; delta: number };
type Topping = { id: string; label: string; delta: number };

const SIZES: Size[] = [
  { id: "s", label: "אישית", sub: "25 ס״מ", delta: -10 },
  { id: "m", label: "משפחתית", sub: "32 ס״מ", delta: 0 },
  { id: "l", label: "XL", sub: "40 ס״מ", delta: 14 },
];

const CRUSTS: Crust[] = [
  { id: "classic", label: "קלאסי", delta: 0 },
  { id: "thin", label: "דק ופריך", delta: 0 },
  { id: "sourdough", label: "מחמצת", delta: 6 },
];

const TOPPINGS: Topping[] = [
  { id: "mushroom", label: "פטריות", delta: 4 },
  { id: "olives", label: "זיתים", delta: 4 },
  { id: "feta", label: "פטה", delta: 6 },
  { id: "onion", label: "בצל", delta: 3 },
  { id: "pepper", label: "פלפלים", delta: 4 },
  { id: "eggplant", label: "חציל קלוי", delta: 5 },
];

const BASE_PRICE = 58;
const MAX_TOPPINGS = 5;

export default function ItemCustomizerMockup() {
  const [sizeId, setSizeId] = useState("m");
  const [crustId, setCrustId] = useState("classic");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(["mushroom", "olives"]),
  );

  const total = useMemo(() => {
    const size = SIZES.find((s) => s.id === sizeId)!;
    const crust = CRUSTS.find((c) => c.id === crustId)!;
    const tops = TOPPINGS.filter((t) => selected.has(t.id)).reduce(
      (sum, t) => sum + t.delta,
      0,
    );
    return BASE_PRICE + size.delta + crust.delta + tops;
  }, [sizeId, crustId, selected]);

  function toggleTopping(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_TOPPINGS) next.add(id);
      return next;
    });
  }

  return (
    <div className={styles.card} aria-hidden>
      <div className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.heroBadge}>פופולרי</div>
      </div>
      <div className={styles.body}>
        <div className={styles.titleRow}>
          <h4 className={styles.title}>מרגריטה</h4>
          <span className={styles.basePrice}>₪{BASE_PRICE}</span>
        </div>
        <p className={styles.desc}>
          רוטב עגבניות סן-מרצאנו, מוצרלה פיור-די-לאטה, ריחן טרי.
        </p>

        <div className={styles.group}>
          <div className={styles.groupHead}>
            <span className={styles.groupLabel}>גודל</span>
            <span className={styles.groupHint}>חובה · בחירה אחת</span>
          </div>
          <div className={styles.chips}>
            {SIZES.map((s) => {
              const active = sizeId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSizeId(s.id)}
                  className={`${styles.chip} ${active ? styles.chipActive : ""}`}
                >
                  <span className={styles.chipMain}>{s.label}</span>
                  <span className={styles.chipSub}>{s.sub}</span>
                  {s.delta !== 0 && (
                    <span className={styles.chipDelta}>
                      {s.delta > 0 ? `+₪${s.delta}` : `-₪${Math.abs(s.delta)}`}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.group}>
          <div className={styles.groupHead}>
            <span className={styles.groupLabel}>בצק</span>
            <span className={styles.groupHint}>חובה · בחירה אחת</span>
          </div>
          <div className={styles.chips}>
            {CRUSTS.map((c) => {
              const active = crustId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCrustId(c.id)}
                  className={`${styles.chip} ${active ? styles.chipActive : ""}`}
                >
                  <span className={styles.chipMain}>{c.label}</span>
                  {c.delta !== 0 && (
                    <span className={styles.chipDelta}>+₪{c.delta}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.group}>
          <div className={styles.groupHead}>
            <span className={styles.groupLabel}>תוספות</span>
            <span className={styles.groupHint}>
              עד {MAX_TOPPINGS} · אופציונלי
            </span>
          </div>
          <div className={styles.toppingGrid}>
            {TOPPINGS.map((t) => {
              const active = selected.has(t.id);
              const disabled = !active && selected.size >= MAX_TOPPINGS;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTopping(t.id)}
                  disabled={disabled}
                  className={`${styles.topping} ${active ? styles.toppingActive : ""}`}
                >
                  <span className={styles.toppingBox} aria-hidden>
                    {active && (
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12l4 4 10-10" />
                      </svg>
                    )}
                  </span>
                  <span className={styles.toppingLabel}>{t.label}</span>
                  <span className={styles.toppingDelta}>+₪{t.delta}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.footerLeft}>
          <span className={styles.footerLabel}>סה״כ</span>
          <span className={styles.footerTotal}>₪{total}</span>
        </div>
        <button type="button" className={styles.addBtn} tabIndex={-1}>
          הוסף לסל
        </button>
      </div>
    </div>
  );
}
