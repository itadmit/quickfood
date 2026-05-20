"use client";

import { useEffect, useRef, useState } from "react";
import styles from "../page.module.css";

type Status = "new" | "prep" | "ready" | "out";

type Order = {
  id: number;
  name: string;
  status: Status;
  total: number;
  min: number;
};

const COLS: { id: Status; label: string; color: string; bg: string }[] = [
  { id: "new",   label: "חדשות", color: "#d63f1a", bg: "rgba(214,63,26,0.1)" },
  { id: "prep",  label: "בהכנה", color: "#a87a00", bg: "rgba(245,185,66,0.15)" },
  { id: "ready", label: "מוכן",  color: "#1f6b3c", bg: "rgba(31,107,60,0.12)" },
  { id: "out",   label: "במשלוח", color: "#1a4dad", bg: "rgba(26,77,173,0.12)" },
];

const NAMES = [
  "דנה ל.", "יואב ב.", "נועה ב.", "איתי כ.", "שירה מ.",
  "רוני א.", "אדם ש.", "מאיה ר.", "גיל ע.", "אסף ש.",
];

const ORDER_BASE = 7400;

const SEED: Order[] = [
  { id: ORDER_BASE + 1,  name: "דנה ל.",  status: "new",   total: 185, min: 1 },
  { id: ORDER_BASE + 2,  name: "יואב ב.", status: "new",   total: 124, min: 3 },
  { id: ORDER_BASE + 3,  name: "נועה ב.", status: "prep",  total: 166, min: 6 },
  { id: ORDER_BASE + 4,  name: "איתי כ.", status: "prep",  total: 144, min: 9 },
  { id: ORDER_BASE + 5,  name: "אדם ש.",  status: "prep",  total: 92,  min: 5 },
  { id: ORDER_BASE + 6,  name: "גיל ע.",  status: "prep",  total: 108, min: 8 },
  { id: ORDER_BASE + 7,  name: "שירה מ.", status: "ready", total: 134, min: 14 },
  { id: ORDER_BASE + 8,  name: "מאיה ר.", status: "ready", total: 78,  min: 11 },
  { id: ORDER_BASE + 9,  name: "אסף ש.",  status: "ready", total: 172, min: 15 },
  { id: ORDER_BASE + 10, name: "רוני א.", status: "out",   total: 92,  min: 22 },
  { id: ORDER_BASE + 11, name: "בעז ק.",  status: "out",   total: 204, min: 18 },
  { id: ORDER_BASE + 12, name: "אורי פ.", status: "out",   total: 156, min: 25 },
  { id: ORDER_BASE + 13, name: "יונת ש.", status: "out",   total: 124, min: 30 },
  { id: ORDER_BASE + 14, name: "תום ל.",  status: "out",   total: 88,  min: 28 },
];

export default function LiveDashboard() {
  const [orders, setOrders] = useState<Order[]>(SEED);
  const [freshIds, setFreshIds] = useState<Set<number>>(() => new Set());
  const nextIdRef = useRef(ORDER_BASE + 15);

  useEffect(() => {
    const interval = setInterval(() => {
      setOrders((prev) => {
        const next = prev.map((o) => ({ ...o, min: o.min + 1 }));
        const advance: Status[] = ["out", "ready", "prep", "new"];
        for (const s of advance) {
          const candidates = next.filter((o) => o.status === s).sort((a, b) => b.min - a.min);
          if (candidates.length > 0) {
            const target = candidates[0];
            if (s === "out") {
              const idx = next.findIndex((o) => o.id === target.id);
              if (idx !== -1) next.splice(idx, 1);
            } else {
              const nextStatus = advance[advance.indexOf(s) - 1];
              target.status = nextStatus;
              target.min = 1;
            }
            break;
          }
        }
        let added: number | null = null;
        if (Math.random() < 0.85) {
          const fresh: Order = {
            id: nextIdRef.current++,
            name: NAMES[Math.floor(Math.random() * NAMES.length)],
            status: "new",
            total: 60 + Math.floor(Math.random() * 200),
            min: 0,
          };
          next.unshift(fresh);
          added = fresh.id;
        }
        if (added !== null) {
          setFreshIds(new Set([added]));
          setTimeout(() => setFreshIds(new Set()), 600);
        }
        return next;
      });
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  const queueCount = orders.filter((o) => o.status === "new" || o.status === "prep").length;

  return (
    <div className={styles.liveDashboard} aria-label="Live dashboard preview">
      <div className={styles.ldWindow}>
        <aside className={styles.ldSide}>
          <div className={styles.ldBrand}>
            <div className={styles.ldBrandLogo}>ו</div>
            <div>
              <div className={styles.ldBrandName}>פיצרייה ורדה</div>
              <div className={styles.ldBrandSub}>דיזנגוף</div>
            </div>
          </div>
          <div className={`${styles.ldNavItem} ${styles.ldNavItemActive}`}>
            <span className={styles.ldNavDot} />הזמנות
          </div>
          <div className={styles.ldNavItem}><span className={styles.ldNavDot} />תפריט</div>
          <div className={styles.ldNavItem}><span className={styles.ldNavDot} />אנליטיקה</div>
          <div className={styles.ldNavItem}><span className={styles.ldNavDot} />ביקורות</div>
          <div className={styles.ldNavItem}><span className={styles.ldNavDot} />שליחים</div>
          <div className={styles.ldNavItem}><span className={styles.ldNavDot} />הגדרות</div>
        </aside>
        <div className={styles.ldMain}>
          <div className={styles.ldMainHeader}>
            <div>
              <div className={styles.ldMainTitle}>הזמנות חיות</div>
              <div className={styles.ldMainSub}>עדכון אוטומטי כל 5 שניות</div>
            </div>
            <div className={styles.ldKpis}>
              <span className={styles.ldKpi}>זמן הכנה <b>11׳</b></span>
              <span className={styles.ldKpi}>בתור <b>{queueCount}</b></span>
              <span className={styles.ldKpi}>שליחים <b>2/4</b></span>
            </div>
          </div>
          <div className={styles.ldKanban}>
            {COLS.map((col) => {
              const items = orders.filter((o) => o.status === col.id).slice(0, 3);
              const total = orders.filter((o) => o.status === col.id).length;
              return (
                <div key={col.id} className={styles.ldCol}>
                  <div className={styles.ldColH}>
                    <span style={{ color: col.color }}>{col.label}</span>
                    <span>{total}</span>
                  </div>
                  {items.map((o) => (
                    <div
                      key={o.id}
                      className={`${styles.ldCard} ${freshIds.has(o.id) ? styles.ldCardFresh : ""}`}
                    >
                      <div className={styles.ldCardH}>
                        <span className={styles.ldCardId}>#{o.id}</span>
                        <span
                          className={styles.ldCardStatus}
                          style={{ background: col.bg, color: col.color }}
                        >
                          {col.label}
                        </span>
                      </div>
                      <div className={styles.ldCardName}>{o.name}</div>
                      <div className={styles.ldCardFoot}>
                        <span className={styles.ldCardTime}>{o.min}׳</span>
                        <span className={styles.ldCardTotal}>₪{o.total}</span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
