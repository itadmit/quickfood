import Link from "next/link";
import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  sent: { text: "נשלח", cls: "bg-green-100 text-green-800" },
  pending: { text: "ממתין", cls: "bg-amber-100 text-amber-800" },
  failed: { text: "נכשל", cls: "bg-red-100 text-red-800" },
};

function fmt(d: Date): string {
  return d.toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function GrowLeadsPage() {
  const leads = await prisma.growLead.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    include: { tenant: { select: { id: true, name: true } } },
  });

  const sent = leads.filter((l) => l.status === "sent").length;
  const failed = leads.filter((l) => l.status === "failed").length;

  return (
    <div dir="rtl" className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-qf-ink">לידים לסליקה (Grow)</h1>
          <p className="text-xs text-qf-mute mt-0.5">
            פניות מטופס חיבור הסליקה. נשמרות אצלנו ונשלחות ל-Airtable של Grow.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-lg bg-white border border-qf-line-dash">
            סה״כ {leads.length}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-green-100 text-green-800">נשלחו {sent}</span>
          {failed > 0 ? (
            <span className="px-2.5 py-1 rounded-lg bg-red-100 text-red-800">נכשלו {failed}</span>
          ) : null}
        </div>
      </div>

      {leads.length === 0 ? (
        <div className="bg-white border border-qf-line-dash rounded-xl p-10 text-center text-qf-mute text-sm">
          עדיין אין לידים.
        </div>
      ) : (
        <div className="bg-white border border-qf-line-dash rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-qf-mute text-xs text-start border-b border-qf-line-dash">
                <th className="font-medium text-start px-4 py-3">שם העסק</th>
                <th className="font-medium text-start px-4 py-3">מספר עוסק</th>
                <th className="font-medium text-start px-4 py-3">טלפון</th>
                <th className="font-medium text-start px-4 py-3">אתר</th>
                <th className="font-medium text-start px-4 py-3">לקוח</th>
                <th className="font-medium text-start px-4 py-3">סטטוס</th>
                <th className="font-medium text-start px-4 py-3">תאריך</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => {
                const badge = STATUS_LABEL[l.status] ?? {
                  text: l.status,
                  cls: "bg-qf-line-soft text-qf-mute",
                };
                return (
                  <tr key={l.id} className="border-b border-qf-line-soft last:border-0">
                    <td className="px-4 py-3 font-medium text-qf-ink">{l.businessName}</td>
                    <td className="px-4 py-3" dir="ltr">
                      {l.businessNumber}
                    </td>
                    <td className="px-4 py-3" dir="ltr">
                      <a href={`tel:${l.phone}`} className="text-qf-ink hover:underline">
                        {l.phone}
                      </a>
                    </td>
                    <td className="px-4 py-3" dir="ltr">
                      {l.website ? (
                        <a
                          href={l.website.startsWith("http") ? l.website : `https://${l.website}`}
                          target="_blank"
                          rel="noopener"
                          className="text-qf-ink hover:underline"
                        >
                          {l.website}
                        </a>
                      ) : (
                        <span className="text-qf-mute">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {l.tenant ? (
                        <Link
                          href={`/admin/tenants/${l.tenant.id}`}
                          className="text-qf-ink hover:underline"
                        >
                          {l.tenant.name}
                        </Link>
                      ) : (
                        <span className="text-qf-mute">אורח</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${badge.cls}`}>
                        {badge.text}
                      </span>
                      {l.status === "failed" && l.error ? (
                        <div className="text-[10px] text-red-600 mt-0.5" dir="ltr">
                          {l.error}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-qf-mute whitespace-nowrap" dir="ltr">
                      {fmt(l.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
