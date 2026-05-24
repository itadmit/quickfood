import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { NoticesView } from "./NoticesView";

export const dynamic = "force-dynamic";

export default async function NoticesPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const [notices, categories, items] = await Promise.all([
    prisma.notice.findMany({
      where: { tenantId: session.tenantId },
      orderBy: [{ active: "desc" }, { position: "asc" }, { updatedAt: "desc" }],
    }),
    prisma.menuCategory.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { position: "asc" },
      select: { id: true, name: true },
    }),
    prisma.menuItem.findMany({
      where: { tenantId: session.tenantId },
      orderBy: [{ categoryId: "asc" }, { position: "asc" }],
      select: { id: true, name: true, categoryId: true },
    }),
  ]);

  return (
    <NoticesView
      initial={notices.map((n) => ({
        id: n.id,
        scope: n.scope,
        categoryId: n.categoryId,
        itemId: n.itemId,
        kind: n.kind,
        title: n.title,
        body: n.body,
        icon: n.icon,
        active: n.active,
        position: n.position,
      }))}
      categories={categories}
      items={items}
    />
  );
}
