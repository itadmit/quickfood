import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { resolveMessagingAvailability } from "@/lib/messaging/availability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  channel: z.enum(["off", "email", "sms", "whatsapp", "whatsapp_managed"]),
});

async function availability(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      notifyChannel: true,
      smsCreditsRemaining: true,
      whatsappCreditsRemaining: true,
      whatsappEnabled: true,
      whatsappToken: true,
      whatsappInstanceId: true,
      reviewsWhatsappSubscriptionId: true,
    },
  });
  if (!tenant) return null;
  const a = resolveMessagingAvailability(tenant);
  return {
    tenant,
    sms_available: a.smsAvailable,
    whatsapp_connected: a.whatsappConnected,
    whatsapp_available: a.whatsappAvailable,
    managed_active: a.managedActive,
    sms_credits: a.smsCredits,
    whatsapp_credits: a.whatsappCredits,
  };
}

export const GET = handler(async () => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const a = await availability(session.tenantId);
  if (!a) return apiError("not_found", "tenant not found", 404);
  return apiJson({
    channel: a.tenant.notifyChannel,
    sms_available: a.sms_available,
    whatsapp_connected: a.whatsapp_connected,
    whatsapp_available: a.whatsapp_available,
    managed_active: a.managed_active,
    sms_credits: a.sms_credits,
  });
});

export const PATCH = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const body = Schema.parse(await req.json());

  const a = await availability(session.tenantId);
  if (!a) return apiError("not_found", "tenant not found", 404);

  // Defense-in-depth: a forged PATCH must not switch to a paid channel the
  // tenant can't actually use (the UI already disables them).
  if (body.channel === "whatsapp_managed" && !a.managed_active) {
    return apiError(
      "whatsapp_managed_inactive",
      "מנוי ווטסאפ של QuickFood אינו פעיל. הפעל אותו בהגדרות ביקורות כדי לבחור בערוץ הזה.",
      409,
      "channel",
    );
  }
  if (body.channel === "sms" && !a.sms_available) {
    return apiError("no_credits", "אין קרדיט הודעות. רכוש קרדיט כדי להפעיל את הערוץ הזה.", 409, "channel");
  }
  if (body.channel === "whatsapp") {
    if (!a.whatsapp_connected) {
      return apiError("whatsapp_not_connected", "WhatsApp לא מחובר. חברו את ה-iBot בעמוד 'דיוור והתראות'.", 409, "channel");
    }
    if (!a.whatsapp_available) {
      return apiError("no_credits", "אין יתרת וואטסאפ. רכשו חבילת וואטסאפ כדי להפעיל את הערוץ הזה.", 409, "channel");
    }
  }

  await prisma.tenant.update({
    where: { id: session.tenantId },
    data: { notifyChannel: body.channel },
  });
  return apiJson({ channel: body.channel });
});
