import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { SmsView } from "./SmsView";

export const dynamic = "force-dynamic";

export default async function SmsPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const [tenant, logs] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: session.tenantId },
      select: {
        smsCreditsRemaining: true,
        smsSender: true,
        billingPaymentMethodId: true,
      },
    }),
    prisma.smsLog.findMany({
      where: {
        tenantId: session.tenantId,
        // Hide the internal "top-up credit" markers - those are for webhook
        // dedupe, not user-visible message activity.
        kind: { not: "topup_credit" },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        to: true,
        body: true,
        channel: true,
        kind: true,
        status: true,
        providerMsg: true,
        sentAt: true,
        createdAt: true,
      },
    }),
  ]);
  if (!tenant) redirect("/dashboard/login");

  return (
    <SmsView
      tenant={{
        creditsRemaining: tenant.smsCreditsRemaining,
        sender: tenant.smsSender,
        billingReady: !!tenant.billingPaymentMethodId,
      }}
      logs={logs.map((l) => ({
        id: l.id,
        to: l.to,
        body: l.body,
        channel: l.channel,
        kind: l.kind,
        status: l.status,
        providerMsg: l.providerMsg,
        sentAt: l.sentAt?.toISOString() ?? null,
        createdAt: l.createdAt.toISOString(),
      }))}
    />
  );
}
