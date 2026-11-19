import { prisma } from "@/lib/db/client";
import { sendEmail } from "@/lib/email/send";
import { renderRtlEmail } from "@/lib/email/templates";
import { appBaseUrl } from "@/lib/orders/notify-customer";

const ALERT_EVERY_MS = 24 * 60 * 60_000;

export async function alertNoSmsBalance(tenantId: string, logId: string): Promise<void> {
  const earlier = await prisma.smsLog.findFirst({
    where: {
      tenantId,
      status: "skipped_no_balance",
      id: { not: logId },
      createdAt: { gte: new Date(Date.now() - ALERT_EVERY_MS) },
    },
    select: { id: true },
  });
  if (earlier) return;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      name: true,
      merchantUsers: {
        where: { role: "owner" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { email: true },
      },
    },
  });
  const to = tenant?.merchantUsers[0]?.email;
  if (!tenant || !to) return;

  const subject = "נגמרה יתרת ה-SMS - הודעות ללקוחות לא נשלחות";
  const { html, text } = renderRtlEmail({
    subject,
    preheader: "הלקוחות שלך לא מקבלים הודעות SMS על ההזמנות.",
    heading: "נגמרה יתרת ה-SMS",
    paragraphs: [
      `יתרת הודעות ה-SMS של ${tenant.name} הגיעה ל-0, ולכן הודעות ללקוחות (אישור הזמנה, יציאה למשלוח, תזכורות דירוג) לא נשלחות כרגע.`,
      "כדי לחזור לשלוח הודעות, אפשר לרכוש חבילת SMS במסך דיוור והתראות.",
    ],
    button: { href: `${appBaseUrl()}/dashboard/messaging`, label: "לרכישת חבילת SMS" },
  });

  await sendEmail({
    tenantId,
    to,
    subject,
    body: text,
    html,
    kind: "sms_no_balance",
    refKind: "sms_log",
    refId: logId,
  });
}
