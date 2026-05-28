import Link from "next/link";
import { AuthShell } from "@/components/shared/AuthShell";

type Status = "success" | "expired" | "used" | "not_found" | "missing";

const COPY: Record<Status, { title: string; subtitle: string; body: string; cta: { href: string; label: string }; tone: "ok" | "error" }> = {
  success: {
    title: "המייל אומת. החנות פעילה.",
    subtitle: "תודה — סיימנו את הצעד הזה.",
    body: "אפשר להמשיך לדשבורד ולהוסיף תפריט, להפעיל את הסניף ולשתף את הקישור עם הלקוחות.",
    cta: { href: "/dashboard", label: "מעבר לדשבורד" },
    tone: "ok",
  },
  expired: {
    title: "הקישור פג תוקף",
    subtitle: "קישורי אימות תקפים ל-24 שעות.",
    body: "אפשר להיכנס לדשבורד וללחוץ על 'שלח לי שוב' בבאנר העליון — יישלח קישור חדש למייל.",
    cta: { href: "/dashboard/login", label: "כניסה לדשבורד" },
    tone: "error",
  },
  used: {
    title: "הקישור כבר נוצל",
    subtitle: "הוא חד-פעמי לצורכי אבטחה.",
    body: "אם המייל עוד לא אומת, אפשר לבקש קישור חדש מהבאנר בדשבורד.",
    cta: { href: "/dashboard/login", label: "כניסה לדשבורד" },
    tone: "error",
  },
  not_found: {
    title: "הקישור לא נמצא",
    subtitle: "ייתכן שהועתק חלקית מהמייל.",
    body: "ודא שהעתקת את כל הכתובת מהמייל, או בקש קישור חדש מהבאנר בדשבורד.",
    cta: { href: "/dashboard/login", label: "כניסה לדשבורד" },
    tone: "error",
  },
  missing: {
    title: "לא הגיע קישור",
    subtitle: "הדף הזה נפתח רק אחרי לחיצה על קישור אימות מהמייל.",
    body: "אם רשמת חנות חדשה — צריך לבדוק את תיבת המייל ולחפש את המייל מ-QuickFood.",
    cta: { href: "/dashboard/login", label: "כניסה לדשבורד" },
    tone: "error",
  },
};

function resolveStatus(raw: string | undefined): Status {
  if (raw === "success" || raw === "expired" || raw === "used" || raw === "not_found") return raw;
  return "missing";
}

export const metadata = {
  title: "אימות מייל — QuickFood",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: rawStatus } = await searchParams;
  const status = resolveStatus(rawStatus);
  const copy = COPY[status];

  return (
    <AuthShell variant="login" title={copy.title} subtitle={copy.subtitle}>
      <div className="space-y-4">
        <div
          className={
            copy.tone === "ok"
              ? "rounded-xl border-2 border-black bg-qf-green-soft px-4 py-3 text-sm font-medium text-qf-green-deep"
              : "rounded-xl border-2 border-black bg-qf-tomato-soft px-4 py-3 text-sm font-medium text-qf-tomato"
          }
        >
          {copy.body}
        </div>
        <Link
          href={copy.cta.href}
          className="inline-flex items-center justify-center w-full px-4 py-3 rounded-xl bg-black text-[#F8CB1E] font-black border-2 border-black hover:bg-[#1a1a1a] transition"
        >
          {copy.cta.label}
        </Link>
      </div>
    </AuthShell>
  );
}
