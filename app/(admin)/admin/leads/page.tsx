import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = {
  contact: "צור קשר",
  talk: "לנדינג",
  unknown: "לא ידוע",
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

export default async function MarketingLeadsPage() {
  const leads = await prisma.marketingLead.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return (
    <div dir="rtl" className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-qf-ink">לידים מהאתר</h1>
          <p className="text-xs text-qf-mute mt-0.5">
            פניות מטופס "צור קשר" והלנדינג. נשמרות אצלנו וגם נשלחות במייל.
          </p>
        </div>
        <span className="px-2.5 py-1 rounded-lg bg-white border border-qf-line-dash text-xs">
          סה״כ {leads.length}
        </span>
      </div>

      {leads.length === 0 ? (
        <div className="bg-white border border-qf-line-dash rounded-xl p-10 text-center text-qf-mute text-sm">
          עדיין אין לידים.
        </div>
      ) : (
        <div className="bg-white border border-qf-line-dash rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-qf-mute text-xs border-b border-qf-line-dash">
                <th className="font-medium text-start px-4 py-3">שם</th>
                <th className="font-medium text-start px-4 py-3">מסעדה</th>
                <th className="font-medium text-start px-4 py-3">טלפון</th>
                <th className="font-medium text-start px-4 py-3">מייל</th>
                <th className="font-medium text-start px-4 py-3">הודעה</th>
                <th className="font-medium text-start px-4 py-3">מקור</th>
                <th className="font-medium text-start px-4 py-3">תאריך</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-b border-qf-line-soft last:border-0 align-top">
                  <td className="px-4 py-3 font-medium text-qf-ink whitespace-nowrap">{l.name}</td>
                  <td className="px-4 py-3">{l.restaurant || <span className="text-qf-mute">-</span>}</td>
                  <td className="px-4 py-3 whitespace-nowrap" dir="ltr">
                    {l.phone ? (
                      <a href={`tel:${l.phone}`} className="text-qf-ink hover:underline">
                        {l.phone}
                      </a>
                    ) : (
                      <span className="text-qf-mute">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3" dir="ltr">
                    <a href={`mailto:${l.email}`} className="text-qf-ink hover:underline">
                      {l.email}
                    </a>
                  </td>
                  <td className="px-4 py-3 max-w-xs text-qf-ink/80">
                    {l.message ? (
                      <span className="line-clamp-3 whitespace-pre-wrap">{l.message}</span>
                    ) : (
                      <span className="text-qf-mute">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded-md text-xs bg-qf-line-soft text-qf-ink">
                      {SOURCE_LABEL[l.source] ?? l.source}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-qf-mute whitespace-nowrap" dir="ltr">
                    {fmt(l.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
