/**
 * Platform-wide admin settings (singleton).
 *
 *   GET   → current values (creates the singleton row lazily if missing).
 *   PATCH → update any subset of fields. Send empty-string or null to clear.
 *
 * Today this is just the WhatsApp (iBot) fallback credentials, but the
 * `platform_settings` table is designed to grow with more globals (default
 * theme, feature flags, default tip percentages, …) without new tables.
 */
import { z } from "zod";
import { handler, apiJson } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  whatsapp_default_token: z.string().trim().max(2000).nullable().optional(),
  whatsapp_default_instance_id: z.string().trim().max(200).nullable().optional(),
});

async function loadOrCreate() {
  const existing = await prisma.platformSettings.findUnique({
    where: { id: "singleton" },
  });
  if (existing) return existing;
  return prisma.platformSettings.create({ data: { id: "singleton" } });
}

export const GET = handler(async () => {
  await requireAdmin();
  const s = await loadOrCreate();
  return apiJson({
    settings: {
      whatsapp_default_token: s.whatsappDefaultToken,
      whatsapp_default_instance_id: s.whatsappDefaultInstanceId,
      updated_at: s.updatedAt.toISOString(),
    },
  });
});

export const PATCH = handler(async (req: Request) => {
  await requireAdmin();
  const body = Schema.parse(await req.json());
  await loadOrCreate();

  const updated = await prisma.platformSettings.update({
    where: { id: "singleton" },
    data: {
      ...(body.whatsapp_default_token !== undefined && {
        whatsappDefaultToken:
          body.whatsapp_default_token === "" ? null : body.whatsapp_default_token,
      }),
      ...(body.whatsapp_default_instance_id !== undefined && {
        whatsappDefaultInstanceId:
          body.whatsapp_default_instance_id === ""
            ? null
            : body.whatsapp_default_instance_id,
      }),
    },
  });

  return apiJson({
    settings: {
      whatsapp_default_token: updated.whatsappDefaultToken,
      whatsapp_default_instance_id: updated.whatsappDefaultInstanceId,
      updated_at: updated.updatedAt.toISOString(),
    },
  });
});
