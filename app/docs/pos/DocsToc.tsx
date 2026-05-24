const ENTRIES: Array<{ id: string; label: string }> = [
  { id: "overview", label: "1. סקירה כללית" },
  { id: "auth", label: "2. אימות" },
  { id: "errors", label: "3. פורמט שגיאות" },
  { id: "webhooks", label: "4. Webhooks (אאוטבאונד)" },
  { id: "orders-api", label: "5. API הזמנות" },
  { id: "menu-api", label: "6. API תפריט" },
  { id: "idempotency", label: "7. Idempotency" },
  { id: "rate-limits", label: "8. Rate Limits" },
  { id: "cors-ip", label: "9. CORS, IP, ושיקולי רשת" },
  { id: "conventions", label: "10. מוסכמות נתונים" },
  { id: "checklist", label: "11. צ׳ק-ליסט אינטגרציה" },
  { id: "faq", label: "12. שאלות נפוצות" },
  { id: "support", label: "13. תמיכה" },
];

export function DocsToc() {
  return (
    <nav
      aria-label="תוכן עניינים"
      className="not-prose mb-8 p-5 rounded-2xl border-2 border-black bg-[#fffbec] shadow-[0_3px_0_#000]"
    >
      <div className="text-[11px] font-black tracking-wider text-black/65 mb-3 uppercase">
        תוכן עניינים
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
        {ENTRIES.map((e) => (
          <li key={e.id}>
            <a
              href={`#${e.id}`}
              className="text-black font-bold no-underline hover:underline underline-offset-2"
            >
              {e.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
