import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-sm border border-qf-line p-8 space-y-6">
        <div className="space-y-1">
          <div className="text-sm text-qf-mute">QuickFood by Quickshop</div>
          <h1 className="text-2xl font-bold text-qf-ink">פלטפורמת הזמנות אוכל</h1>
          <p className="text-qf-ink2">
            ה-MVP. כדי לראות מסעדה לדוגמה ודא ש-Neon מחובר והרץ{" "}
            <code className="px-1.5 py-0.5 rounded bg-qf-bg-dash text-sm">npm run db:seed</code>.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <LinkCard
            href="/pizzeria-verde"
            title="חנות הלקוח — פיצרייה ורדה"
            sub="storefront לדמו (לאחר seed)"
          />
          <LinkCard
            href="/dashboard"
            title="דשבורד מסעדה"
            sub="owner@pizzeria-verde.local · verde1234"
          />
          <LinkCard
            href="/admin"
            title="מנהל פלטפורמה"
            sub="admin@quickfood.local · admin1234"
          />
          <LinkCard href="/api/health" title="API · /api/health" sub="בדיקת חיים" />
          <LinkCard
            href="/api/v1/openapi"
            title="OpenAPI spec"
            sub="/api/v1/openapi.json — חוזה ה-API למובייל / אינטגרציות"
          />
        </div>
      </div>
    </main>
  );
}

function LinkCard({
  href,
  title,
  sub,
}: {
  href: string;
  title: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-qf-line px-4 py-3 hover:border-(--qf-primary) hover:bg-qf-green-soft transition"
    >
      <div className="font-medium">{title}</div>
      <div className="text-sm text-qf-mute">{sub}</div>
    </Link>
  );
}
