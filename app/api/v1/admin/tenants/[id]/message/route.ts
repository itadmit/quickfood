import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { sendWhatsApp } from "@/lib/whatsapp/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  body: z.string().trim().min(1).max(4000),
  to: z.string().trim().min(6).max(20).optional(),
});

const STATUS_MESSAGE: Record<string, string> = {
  not_configured: "חשבון ה-WhatsApp של QuickFood לא מוגדר בהגדרות הפלטפורמה",
  invalid_recipient: "מספר הטלפון לא תקין",
  failed: "השליחה נכשלה מול ספק ה-WhatsApp",
  skipped_no_balance: "השליחה נחסמה - אין יתרת הודעות",
};

export const POST = handler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    await requireAdmin();
    const { id } = await params;
    const input = Body.parse(await req.json());

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!tenant) return apiError("not_found", "מסעדה לא נמצאה", 404);

    let to = input.to;
    if (!to) {
      const owner =
        (await prisma.merchantUser.findFirst({
          where: { tenantId: id, role: "owner", phone: { not: null } },
          select: { phone: true },
        })) ??
        (await prisma.merchantUser.findFirst({
          where: { tenantId: id, phone: { not: null } },
          select: { phone: true },
        }));
      to = owner?.phone ?? undefined;
    }
    if (!to) return apiError("no_phone", "אין מספר טלפון לבעל החנות", 400);

    const result = await sendWhatsApp({
      tenantId: id,
      to,
      body: input.body,
      kind: "admin_message",
      useManagedAccount: true,
    });

    if (result.status === "sent") return apiJson({ status: result.status, to });
    return apiError(
      "send_failed",
      STATUS_MESSAGE[result.status] ?? "השליחה נכשלה",
      502,
    );
  },
);
