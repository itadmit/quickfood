import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { CampaignsView } from "./CampaignsView";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const campaigns = await prisma.campaign.findMany({
    where: { tenantId: session.tenantId },
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
  });

  return (
    <CampaignsView
      initial={campaigns.map((c) => ({
        id: c.id,
        kind: c.kind,
        style: c.style,
        placement: c.placement,
        title: c.title,
        subtitle: c.subtitle,
        icon: c.icon,
        color: c.color,
        imageUrl: c.imageUrl,
        isActive: c.isActive,
        linkUrl: c.linkUrl,
        updatedAt: c.updatedAt.toISOString(),
      }))}
    />
  );
}
