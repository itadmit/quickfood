import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { SettingsHeader } from "../SettingsHeader";
import { ApiKeysManager } from "./ApiKeysManager";

export const dynamic = "force-dynamic";

export default async function ApiKeysPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }
  const keys = await prisma.apiKey.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      prefix: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
  });
  return (
    <div className="space-y-5">
      <SettingsHeader subtitle="מפתחות API לחיבור קופות ומערכות חיצוניות" />
      <ApiKeysManager
        initial={keys.map((k) => ({
          id: k.id,
          name: k.name,
          prefix: k.prefix,
          lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
          expiresAt: k.expiresAt?.toISOString() ?? null,
          createdAt: k.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
