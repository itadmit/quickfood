import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { BrandingForm } from "./BrandingForm";
import { SettingsHeader } from "../SettingsHeader";

export const dynamic = "force-dynamic";

export default async function BrandingPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: {
      id: true, name: true, logoLetter: true, logoUrl: true, themeId: true,
      businessType: true, cuisineType: true, about: true, slug: true,
      coverImage: true, customDomain: true,
    },
  });
  if (!tenant) redirect("/dashboard/login");

  // Prefer the merchant's custom domain when set — that's the URL we want
  // the QR scanner to land on. Falls back to the platform path so the QR
  // still works for everyone before they connect a domain.
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://quickfood.co.il").replace(/\/$/, "");
  const storefrontUrl = tenant.customDomain
    ? `https://${tenant.customDomain}`
    : `${base}/${tenant.slug}`;

  // Server-generated PNG data URL. 512px is enough that the modal preview
  // looks crisp and a printed flyer at A6 stays scannable.
  const qrDataUrl = await QRCode.toDataURL(storefrontUrl, {
    width: 512,
    margin: 2,
    color: { dark: "#000000", light: "#FFFFFF" },
  });

  return (
    <div className="space-y-5">
      <SettingsHeader subtitle="מיתוג, צבעים ותצוגת החנות שלך" />
      <BrandingForm
        tenant={tenant}
        storefrontUrl={storefrontUrl}
        qrDataUrl={qrDataUrl}
      />
    </div>
  );
}
