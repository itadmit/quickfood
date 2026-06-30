import { z } from "zod";
import { after } from "next/server";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";
import { sendEmail } from "@/lib/email/send";
import { renderRtlEmail } from "@/lib/email/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Sign = z.object({
  signerName: z.string().trim().min(2).max(120),
  signatureData: z.string().trim().startsWith("data:image/").max(500_000),
});

const NOTIFY_EMAIL = process.env.PROPOSAL_NOTIFY_EMAIL || "itadmit@gmail.com";

export const POST = handler(
  async (req: Request, { params }: { params: Promise<{ token: string }> }) => {
    const { token } = await params;
    const body = Sign.parse(await req.json());

    const proposal = await prisma.proposal.findUnique({ where: { token } });
    if (!proposal) return apiError("not_found", "הצעה לא נמצאה", 404);
    if (proposal.status === "signed") {
      return apiError("already_signed", "ההצעה כבר נחתמה", 409);
    }

    const signed = await prisma.proposal.update({
      where: { token },
      data: {
        status: "signed",
        signerName: body.signerName,
        signatureData: body.signatureData,
        signedAt: new Date(),
      },
    });

    after(async () => {
      const when = signed.signedAt?.toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" }) ?? "";
      const { html, text } = renderRtlEmail({
        subject: `הצעה נחתמה: ${signed.clientName}`,
        heading: "הצעת מחיר נחתמה ✍️",
        paragraphs: [
          `הלקוח <b>${signed.clientName}</b> אישר וחתם על הצעת המחיר.`,
          `חתם בשם: <b>${body.signerName}</b>`,
          `מחיר חודשי: <b>${signed.monthlyPrice} ₪</b>`,
          `תאריך חתימה: ${when}`,
        ],
        button: {
          href: "https://quickfood.co.il/admin/quotes",
          label: "פתיחת ההצעות בסופר-אדמין",
        },
        raw: true,
      });
      await sendEmail({
        tenantId: null,
        to: NOTIFY_EMAIL,
        subject: `הצעה נחתמה: ${signed.clientName}`,
        body: text,
        html,
        kind: "proposal_signed",
        refKind: "proposal",
        refId: signed.id,
      });
    });

    return apiJson({ ok: true, status: signed.status });
  },
);
