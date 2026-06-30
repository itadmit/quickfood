import { prisma } from "@/lib/db/client";
import { QuotesManager } from "./QuotesManager";

export const dynamic = "force-dynamic";

export default async function AdminQuotesPage() {
  const rows = await prisma.proposal.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true, token: true, clientName: true, monthlyPrice: true,
      commissionStruck: true, commissionActual: true, notes: true,
      status: true, signerName: true, signedAt: true, createdAt: true,
    },
  });

  const initial = rows.map((r) => ({
    ...r,
    signedAt: r.signedAt ? r.signedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div dir="rtl" className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-qf-ink">הצעות מחיר</h1>
        <p className="text-xs text-qf-mute mt-0.5">
          יוצרים הצעה, מקבלים לינק ייחודי לשליחה ללקוח. כשהלקוח חותם בתחתית הדף, הסטטוס עובר ל"נחתם" ומגיע מייל חיווי.
        </p>
      </div>
      <QuotesManager initial={initial} />
    </div>
  );
}
