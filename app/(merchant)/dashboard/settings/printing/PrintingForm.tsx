"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IcoCheck, IcoClose, IcoPrinter } from "@/components/shared/Icons";
import { SettingsSaveBar } from "@/components/merchant/SettingsSaveBar";
import type { ReceiptPrinterType, ReceiptSettings } from "@/lib/receipt-print";
import type { CloudPrinterSettings } from "@/lib/printing/settings";

const RECEIPT_FIELDS: Array<{ key: keyof ReceiptSettings; label: string }> = [
  { key: "showCustomerName", label: "הצג שם לקוח" },
  { key: "showCustomerPhone", label: "הצג טלפון לקוח" },
  { key: "showOptions", label: "הצג תוספות ואפשרויות" },
  { key: "showOptionPrices", label: "הצג מחיר ליד כל תוספת" },
  { key: "showItemNotes", label: "הצג הערות לפריט" },
  { key: "showOrderNotes", label: "הצג הערת הזמנה" },
];

const SETTINGS_API_KEY: Record<keyof ReceiptSettings, string> = {
  showCustomerName: "show_customer_name",
  showCustomerPhone: "show_customer_phone",
  showOptions: "show_options",
  showOptionPrices: "show_option_prices",
  showItemNotes: "show_item_notes",
  showOrderNotes: "show_order_notes",
  autoPrintOnNew: "auto_print_on_new",
};

interface PrinterOption {
  type: ReceiptPrinterType;
  title: string;
  sub: string;
  badge?: string;
}

const OPTIONS: PrinterOption[] = [
  {
    type: "star",
    title: "Star Micronics",
    sub: "mC-Print3 · TSP100 · TSP650 ועוד. זו המדפסת שוולט מספקים למסעדות.",
    badge: "הנפוצה בישראל",
  },
  {
    type: "epson",
    title: "Epson TM",
    sub: "TM-m30 · TM-T20 · TM-T88 ועוד.",
  },
  {
    type: "escpos",
    title: "מדפסת בלוטות' אחרת",
    sub: "מדפסות קבלות גנריות (ESC/POS). עובד מטאבלט אנדרואיד בלבד.",
  },
  {
    type: "airprint",
    title: "מדפסת רגילה (WiFi / AirPrint)",
    sub: "מדפסת משרדית או מדפסת קבלות עם WiFi. הדפסה דרך חלון ההדפסה של המכשיר.",
  },
];

interface AppLinks {
  appName: string;
  ios?: string;
  android?: string;
}

const APP_LINKS: Partial<Record<ReceiptPrinterType, AppLinks>> = {
  star: {
    appName: "Star PassPRNT",
    ios: "https://apps.apple.com/us/app/star-passprnt/id979827520",
    android: "https://play.google.com/store/apps/details?id=jp.star_m.passprnt",
  },
  epson: {
    appName: "Epson TM Print Assistant",
    ios: "https://apps.apple.com/us/app/epson-tm-print-assistant/id1324935555",
    android: "https://play.google.com/store/apps/details?id=com.epson.tmassistant",
  },
  escpos: {
    appName: "RawBT",
    android: "https://play.google.com/store/apps/details?id=ru.a402d.rawbtprinter",
  },
};

export function PrintingForm({
  initial,
  initialSettings,
  initialCloudPrinter,
}: {
  initial: ReceiptPrinterType;
  initialSettings: ReceiptSettings;
  initialCloudPrinter: CloudPrinterSettings;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<ReceiptPrinterType>(initial);
  const [settings, setSettings] = useState<ReceiptSettings>(initialSettings);
  const [cloud, setCloud] = useState<CloudPrinterSettings>(initialCloudPrinter);
  const [saving, setSaving] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  async function save() {
    setSaving(true);
    setToast(null);
    try {
      const receipt_settings = {
        ...Object.fromEntries(
          RECEIPT_FIELDS.map((f) => [SETTINGS_API_KEY[f.key], settings[f.key]]),
        ),
        auto_print_on_new: settings.autoPrintOnNew,
      };
      const printer_settings = {
        enabled: cloud.enabled,
        device_topic: cloud.deviceTopic.trim(),
        print_cash_on_create: cloud.printCashOnCreate,
        print_card_on_paid: cloud.printCardOnPaid,
        copies: cloud.copies,
      };
      const res = await fetch("/api/v1/merchant/tenant", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ receipt_printer: selected, receipt_settings, printer_settings }),
      });
      const data = (await res.json()) as { error?: { message?: string } };
      if (res.ok) {
        setToast({ kind: "ok", msg: "נשמר" });
        router.refresh();
        if (selected !== "airprint" && selected !== initial) setShowGuide(true);
      } else {
        setToast({ kind: "err", msg: data.error?.message ?? "שמירה נכשלה" });
      }
    } catch {
      setToast({ kind: "err", msg: "שגיאת רשת" });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
  }

  return (
    <>
      <div className="space-y-5">
        <div className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-4">
          <div>
            <h2 className="font-semibold text-base lg:text-lg">איזו מדפסת קבלות יש לכם?</h2>
            <p className="text-sm text-qf-mute mt-0.5">
              לפי הבחירה, כפתור ההדפסה בפרטי ההזמנה ידע לשלוח את הקבלה למדפסת הנכונה.
            </p>
          </div>

          <div className="space-y-3">
            {OPTIONS.map((opt) => {
              const active = selected === opt.type;
              return (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => setSelected(opt.type)}
                  aria-pressed={active}
                  className={
                    "w-full flex items-start gap-3 p-3.5 rounded-xl border-2 text-start transition " +
                    (active
                      ? "border-(--qf-primary) bg-qf-green-soft"
                      : "border-qf-line-dash bg-white hover:bg-qf-line-soft")
                  }
                >
                  <div className="w-10 h-10 rounded-lg bg-white border border-qf-line-dash grid place-items-center shrink-0">
                    <IcoPrinter s={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium flex items-center gap-2">
                      {opt.title}
                      {opt.badge && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-qf-yolk-soft border border-qf-yolk/40">
                          {opt.badge}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-qf-mute mt-0.5">{opt.sub}</div>
                  </div>
                  <div
                    className={
                      "w-5 h-5 rounded-md border-2 shrink-0 mt-0.5 grid place-items-center transition " +
                      (active ? "border-(--qf-primary) bg-(--qf-primary)" : "border-qf-line-dash")
                    }
                    aria-hidden
                  >
                    {active && <IcoCheck c="#fff" s={12} />}
                  </div>
                </button>
              );
            })}
          </div>

          {selected !== "airprint" && (
            <button
              type="button"
              onClick={() => setShowGuide(true)}
              className="w-full px-3.5 py-2.5 rounded-xl border-2 border-black bg-white font-bold text-sm shadow-[0_2px_0_#000] hover:bg-black/5"
            >
              איך מחברים? הוראות התקנה
            </button>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-4">
          <div>
            <h2 className="font-semibold text-base lg:text-lg">הגדרות בון</h2>
            <p className="text-sm text-qf-mute mt-0.5">
              בחרו מה יודפס על הבון. כברירת מחדל הכל מסומן - אפשר לבטל ולשמור.
            </p>
          </div>

          <div className="divide-y divide-qf-line-soft">
            {RECEIPT_FIELDS.map((f) => {
              const on = settings[f.key];
              return (
                <button
                  key={f.key}
                  type="button"
                  role="switch"
                  aria-checked={on}
                  onClick={() => setSettings((p) => ({ ...p, [f.key]: !p[f.key] }))}
                  className="w-full flex items-center justify-between gap-3 py-3 text-start"
                >
                  <span className="text-sm font-medium">{f.label}</span>
                  <span
                    className={
                      "w-5 h-5 rounded-md border-2 shrink-0 grid place-items-center transition " +
                      (on ? "border-(--qf-primary) bg-(--qf-primary)" : "border-qf-line-dash")
                    }
                    aria-hidden
                  >
                    {on && <IcoCheck c="#fff" s={12} />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-3">
          <div>
            <h2 className="font-semibold text-base lg:text-lg">הדפסה אוטומטית של הזמנות חדשות</h2>
            <p className="text-sm text-qf-mute mt-0.5">
              כשמופעל, כל הזמנה חדשה מודפסת אוטומטית כל עוד לוח ההזמנות פתוח - גם
              כשהחלון ממוזער.
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={settings.autoPrintOnNew}
            onClick={() => setSettings((p) => ({ ...p, autoPrintOnNew: !p.autoPrintOnNew }))}
            className="w-full flex items-center justify-between gap-3 py-2 text-start"
          >
            <span className="text-sm font-medium">הדפס כל הזמנה חדשה אוטומטית</span>
            <span
              className={
                "w-5 h-5 rounded-md border-2 shrink-0 grid place-items-center transition " +
                (settings.autoPrintOnNew
                  ? "border-(--qf-primary) bg-(--qf-primary)"
                  : "border-qf-line-dash")
              }
              aria-hidden
            >
              {settings.autoPrintOnNew && <IcoCheck c="#fff" s={12} />}
            </span>
          </button>

          {settings.autoPrintOnNew && (
            <div className="rounded-xl bg-qf-yolk-soft/50 border border-qf-yolk/30 px-3.5 py-3 text-xs text-qf-ink2 leading-relaxed space-y-1">
              <div className="font-bold text-qf-ink">כדי שההדפסה תהיה שקטה (בלי חלון הדפסה):</div>
              <p>
                • <span className="font-medium">באפליקציית QuickFood למחשב</span> - עובד אוטומטית,
                גם כשהאפליקציה ממוזערת. ודאו שהמדפסת מוגדרת כברירת מחדל ב-Windows.
              </p>
              <p>
                • <span className="font-medium">בדפדפן Chrome/Edge</span> - יש לפתוח את לוח
                ההזמנות עם הדגל <span dir="ltr" className="font-mono">--kiosk-printing</span> ולהשאיר
                אותו פתוח. בלי זה יופיע חלון הדפסה על כל הזמנה.
              </p>
            </div>
          )}
        </div>

        <CloudPrinterCard cloud={cloud} setCloud={setCloud} />
      </div>

      {showGuide && <GuideModal type={selected} onClose={() => setShowGuide(false)} />}
      <SettingsSaveBar saving={saving} onSave={save} toast={toast} />
    </>
  );
}

function GuideModal({ type, onClose }: { type: ReceiptPrinterType; onClose: () => void }) {
  const links = APP_LINKS[type];
  const option = OPTIONS.find((o) => o.type === type);
  if (!links || !option) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-qf-line-soft">
          <h3 className="font-bold text-lg">חיבור מדפסת {option.title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-qf-line-soft grid place-items-center text-qf-mute"
            aria-label="סגור"
          >
            <IcoClose s={16} />
          </button>
        </header>

        <div className="p-5 space-y-4 text-sm max-h-[70vh] overflow-y-auto">
          <GuideStep n={1} title={`מתקינים את האפליקציה ${links.appName} (חינם)`}>
            <div className="flex flex-wrap gap-2 mt-2">
              {links.ios && (
                <a
                  href={links.ios}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg border border-qf-line-dash text-xs font-medium hover:bg-qf-line-soft"
                >
                  App Store (אייפד / אייפון)
                </a>
              )}
              {links.android && (
                <a
                  href={links.android}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg border border-qf-line-dash text-xs font-medium hover:bg-qf-line-soft"
                >
                  Google Play (אנדרואיד)
                </a>
              )}
            </div>
            {!links.ios && (
              <p className="text-xs text-qf-tomato mt-2">
                שימו לב: האפשרות הזו עובדת מטאבלט / טלפון אנדרואיד בלבד.
              </p>
            )}
          </GuideStep>

          <GuideStep n={2} title="מצמידים את המדפסת בבלוטות'">
            מדליקים את המדפסת, נכנסים להגדרות הבלוטות׳ של המכשיר ומצמידים אותה
            (Pair). פעולה חד-פעמית.
          </GuideStep>

          <GuideStep n={3} title="מדפיסים פעם ראשונה">
            פותחים הזמנה בדשבורד ולוחצים על &quot;מדפסת קופה&quot;. בפעם הראשונה
            {type === "escpos"
              ? " נכנסים פעם אחת לאפליקציית RawBT ובוחרים את המדפסת כברירת מחדל."
              : " האפליקציה תבקש לבחור את המדפסת מהרשימה - בוחרים אותה והיא נשמרת להבא."}
          </GuideStep>

          <div className="rounded-xl bg-qf-green-soft/40 border border-qf-green-deep/20 px-4 py-3 space-y-1.5">
            <div className="font-bold text-qf-green-deep text-xs">טיפים</div>
            <ul className="text-xs text-qf-ink2 space-y-1 list-disc ps-4">
              <li>
                באנדרואיד: שמרו את הדשבורד במסך הבית (&quot;הוסף למסך הבית&quot; בדפדפן) -
                ההדפסה תעבוד בלי שאלת אישור בכל פעם.
              </li>
              {type === "epson" && (
                <li>באייפד/אייפון: אחרי ההדפסה חוזרים ידנית לדפדפן (מגבלה של אפליקציית Epson).</li>
              )}
              <li>הקבלה יוצאת ברוחב 80 מ&quot;מ. נייר תרמי סטנדרטי.</li>
            </ul>
          </div>
        </div>

        <footer className="px-5 py-3 border-t border-qf-line-soft">
          <button
            type="button"
            onClick={onClose}
            className="w-full px-3.5 py-2.5 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-medium"
          >
            הבנתי, סגור
          </button>
        </footer>
      </div>
    </div>
  );
}

function CloudPrinterCard({
  cloud,
  setCloud,
}: {
  cloud: CloudPrinterSettings;
  setCloud: React.Dispatch<React.SetStateAction<CloudPrinterSettings>>;
}) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function sendTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/v1/merchant/printer/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ device_topic: cloud.deviceTopic.trim() || undefined }),
      });
      const data = (await res.json()) as { error?: { message?: string } };
      setTestResult(
        res.ok
          ? { ok: true, msg: "נשלח - בדקו שיצאה פתקית מהמדפסת" }
          : { ok: false, msg: data.error?.message ?? "השליחה נכשלה" },
      );
    } catch {
      setTestResult({ ok: false, msg: "שגיאת רשת" });
    } finally {
      setTesting(false);
      setTimeout(() => setTestResult(null), 6000);
    }
  }

  const TRIGGERS: Array<{ key: "printCashOnCreate" | "printCardOnPaid"; label: string }> = [
    { key: "printCardOnPaid", label: "הדפסה אוטומטית כשהזמנה שולמה באשראי" },
    { key: "printCashOnCreate", label: "הדפסה אוטומטית כשנכנסת הזמנת מזומן" },
  ];

  return (
    <div className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-base lg:text-lg">מדפסת ענן - הדפסה אוטומטית</h2>
          <p className="text-sm text-qf-mute mt-0.5">
            מדפסת בונים שמחוברת לאינטרנט (HSPOS ודומות) מדפיסה כל הזמנה לבד - בלי מחשב,
            בלי דשבורד ובלי אפליקציה.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={cloud.enabled}
          onClick={() => setCloud((p) => ({ ...p, enabled: !p.enabled }))}
          className={
            "w-11 h-6 rounded-full relative transition shrink-0 mt-1 " +
            (cloud.enabled ? "bg-(--qf-primary)" : "bg-qf-line-dash")
          }
          aria-label="הפעלת מדפסת ענן"
        >
          <span
            className={
              "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all " +
              (cloud.enabled ? "right-0.5" : "right-[calc(100%-1.375rem)]")
            }
          />
        </button>
      </div>

      {cloud.enabled && (
        <>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="cloud-printer-topic">
              מזהה מדפסת
            </label>
            <input
              id="cloud-printer-topic"
              value={cloud.deviceTopic}
              onChange={(e) => setCloud((p) => ({ ...p, deviceTopic: e.target.value }))}
              placeholder="Prn..."
              dir="ltr"
              spellCheck={false}
              className="w-full rounded-xl border border-qf-line-dash focus:border-(--qf-primary) px-3 py-2.5 text-sm outline-none font-mono"
            />
            <p className="text-xs text-qf-mute mt-1">
              מודפס על דף הבדיקה העצמית של המדפסת בשורת SubTopic (מתחיל ב-Prn).
            </p>
          </div>

          <div className="divide-y divide-qf-line-soft">
            {TRIGGERS.map((f) => {
              const on = cloud[f.key];
              return (
                <button
                  key={f.key}
                  type="button"
                  role="switch"
                  aria-checked={on}
                  onClick={() => setCloud((p) => ({ ...p, [f.key]: !p[f.key] }))}
                  className="w-full flex items-center justify-between gap-3 py-3 text-start"
                >
                  <span className="text-sm font-medium">{f.label}</span>
                  <span
                    className={
                      "w-5 h-5 rounded-md border-2 shrink-0 grid place-items-center transition " +
                      (on ? "border-(--qf-primary) bg-(--qf-primary)" : "border-qf-line-dash")
                    }
                    aria-hidden
                  >
                    {on && <IcoCheck c="#fff" s={12} />}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={sendTest}
              disabled={testing || !cloud.deviceTopic.trim()}
              className="px-4 py-2.5 rounded-xl border-2 border-black bg-white font-bold text-sm shadow-[0_2px_0_#000] hover:bg-black/5 disabled:opacity-50 disabled:shadow-none"
            >
              {testing ? "שולח..." : "הדפסת בדיקה"}
            </button>
            {testResult && (
              <span
                className={
                  "text-xs font-semibold " +
                  (testResult.ok ? "text-qf-green-deep" : "text-qf-tomato")
                }
              >
                {testResult.msg}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function GuideStep({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-full bg-(--qf-primary) text-white grid place-items-center font-bold text-xs shrink-0">
        {n}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold">{title}</div>
        <div className="text-qf-ink2 text-xs mt-0.5 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
