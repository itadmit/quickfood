import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { ConnectPaymentForm } from "./ConnectPaymentForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "חיבור סליקה | QuickFood",
  description: "משאירים פרטים קצרים ו-Grow פותחים לכם תיק סליקה דיגיטלית.",
};

export default async function ConnectPaymentPage() {
  const session = await getSession();
  let prefill = { businessName: "", businessNumber: "", phone: "", website: "" };

  if (session?.type === "merchant" && session.tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: session.tenantId },
      select: {
        name: true,
        slug: true,
        vatNumber: true,
        branches: { take: 1, orderBy: { createdAt: "asc" }, select: { phone: true } },
      },
    });
    if (tenant) {
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://quickfood.co.il").replace(/\/$/, "");
      prefill = {
        businessName: tenant.name ?? "",
        businessNumber: tenant.vatNumber ?? "",
        phone: tenant.branches[0]?.phone ?? "",
        website: tenant.slug ? `${appUrl}/s/${tenant.slug}` : "",
      };
    }
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#F8CB1E] flex items-center justify-center p-4">
      <ConnectPaymentForm prefill={prefill} />
    </main>
  );
}
