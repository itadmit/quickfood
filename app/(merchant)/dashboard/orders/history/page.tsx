import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { resolveReceiptSettings, type ReceiptPrinterType } from "@/lib/receipt-print";
import { OrdersHistoryView } from "./OrdersHistoryView";

export const dynamic = "force-dynamic";

export default async function OrdersHistoryPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { receiptPrinter: true, receiptSettings: true },
  });

  return (
    <OrdersHistoryView
      receiptPrinter={(tenant?.receiptPrinter ?? "airprint") as ReceiptPrinterType}
      receiptSettings={resolveReceiptSettings(tenant?.receiptSettings)}
    />
  );
}
