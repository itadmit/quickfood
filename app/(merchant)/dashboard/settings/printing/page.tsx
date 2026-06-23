import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { SettingsHeader } from "../SettingsHeader";
import { PrintingForm } from "./PrintingForm";
import { resolveReceiptSettings, type ReceiptPrinterType } from "@/lib/receipt-print";

export const dynamic = "force-dynamic";

export default async function PrintingSettingsPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { receiptPrinter: true, receiptSettings: true },
  });
  if (!tenant) redirect("/dashboard/login");

  return (
    <div className="space-y-5">
      <SettingsHeader subtitle="לאיזו מדפסת מודפסות קבלות מההזמנות" />
      <PrintingForm
        initial={tenant.receiptPrinter as ReceiptPrinterType}
        initialSettings={resolveReceiptSettings(tenant.receiptSettings)}
      />
    </div>
  );
}
