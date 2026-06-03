import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { SettingsHeader } from "../SettingsHeader";
import { TeamManager } from "./TeamManager";

export const dynamic = "force-dynamic";

export default async function TeamSettingsPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }
  if (session.role !== "owner" && session.role !== "manager") {
    redirect("/dashboard");
  }

  const users = await prisma.merchantUser.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  return (
    <div className="space-y-5">
      <SettingsHeader subtitle="ניהול צוות העובדים בעסק" />
      <TeamManager
        currentRole={session.role ?? "manager"}
        initial={users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          last_login_at: u.lastLoginAt?.toISOString() ?? null,
          created_at: u.createdAt.toISOString(),
          is_me: u.id === session.userId,
        }))}
      />
    </div>
  );
}
