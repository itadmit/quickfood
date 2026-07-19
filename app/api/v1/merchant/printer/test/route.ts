import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import {
  resolvePrinterSettings,
  renderTestTicket,
  publishToPrinter,
} from "@/lib/printing/cloud-printer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  // Lets the settings form test a topic BEFORE saving it. Falls back to the
  // saved tenant settings when omitted.
  device_topic: z.string().trim().max(80).optional(),
});

export const POST = handler(async (req: Request) => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const body = Body.parse(await req.json().catch(() => ({})));

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { name: true, printerSettings: true },
  });
  if (!tenant) return apiError("not_found", "העסק לא נמצא", 404);

  const topic = body.device_topic || resolvePrinterSettings(tenant.printerSettings).deviceTopic;
  if (!topic) {
    return apiError("no_device_topic", "לא הוגדר מזהה מדפסת", 422, "device_topic");
  }

  try {
    await publishToPrinter(topic, renderTestTicket(tenant.name));
  } catch (err) {
    console.error("[printer/test] publish failed", err);
    return apiError("publish_failed", "השליחה למדפסת נכשלה - בדקו שהמדפסת דלוקה ומחוברת", 502);
  }
  return apiJson({ sent: true });
});
