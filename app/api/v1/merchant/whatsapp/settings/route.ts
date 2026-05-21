/**
 * Merchant WhatsApp (iBot Chat) connection settings.
 *
 * GET  → current token + instance_id + a `connected` boolean (both set).
 * PATCH → update token / instance_id. Passing `null` clears a field, which
 *         disconnects WhatsApp without disturbing other settings.
 *
 * These credentials are bring-your-own: each merchant creates an iBot
 * account, connects their WhatsApp business number, and pastes the
 * resulting token + instance_id here. The platform never stores a shared
 * WhatsApp account.
 */
import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  token: z.string().trim().max(2000).nullable().optional(),
  instance_id: z.string().trim().max(200).nullable().optional(),
});

export const GET = handler(async () => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const t = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { whatsappToken: true, whatsappInstanceId: true },
  });
  if (!t) return apiError("not_found", "tenant not found", 404);
  return apiJson({
    settings: {
      token: t.whatsappToken,
      instance_id: t.whatsappInstanceId,
      connected: !!(t.whatsappToken && t.whatsappInstanceId),
    },
  });
});

export const PATCH = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const body = Schema.parse(await req.json());

  const updated = await prisma.tenant.update({
    where: { id: session.tenantId },
    data: {
      ...(body.token !== undefined && {
        whatsappToken: body.token === "" ? null : body.token,
      }),
      ...(body.instance_id !== undefined && {
        whatsappInstanceId: body.instance_id === "" ? null : body.instance_id,
      }),
    },
    select: { whatsappToken: true, whatsappInstanceId: true },
  });

  return apiJson({
    settings: {
      token: updated.whatsappToken,
      instance_id: updated.whatsappInstanceId,
      connected: !!(updated.whatsappToken && updated.whatsappInstanceId),
    },
  });
});
