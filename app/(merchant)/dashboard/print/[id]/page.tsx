import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { resolveReceiptSettings, type ReceiptPrinterType } from "@/lib/receipt-print";
import { NativePrintRunner } from "./NativePrintRunner";

export const dynamic = "force-dynamic";

export default async function NativePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const { id } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { receiptPrinter: true, receiptSettings: true },
  });

  return (
    <NativePrintRunner
      orderId={id}
      printer={(tenant?.receiptPrinter as ReceiptPrinterType) ?? "airprint"}
      settings={resolveReceiptSettings(tenant?.receiptSettings)}
    />
  );
}
