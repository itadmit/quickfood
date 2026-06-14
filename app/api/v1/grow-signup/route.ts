import { z } from "zod";
import { apiError, apiJson, handler } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { submitGrowLead } from "@/lib/grow-signup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GrowSignupSchema = z.object({
  businessNumber: z.string().trim().min(5).max(20),
  businessName: z.string().trim().min(2).max(120),
  phone: z
    .string()
    .trim()
    .regex(/^0\d{8,9}$/, { message: "מספר טלפון לא תקין" }),
  website: z.string().trim().max(200).optional().or(z.literal("")),
});

export const POST = handler(async (req: Request) => {
  const input = GrowSignupSchema.parse(await req.json());

  const session = await getSession();
  const tenantId = session?.type === "merchant" ? session.tenantId : undefined;

  const lead = await prisma.growLead.create({
    data: {
      tenantId: tenantId ?? null,
      businessNumber: input.businessNumber,
      businessName: input.businessName,
      phone: input.phone,
      website: input.website || null,
      status: "pending",
    },
    select: { id: true },
  });

  try {
    const rowId = await submitGrowLead({
      businessNumber: input.businessNumber,
      businessName: input.businessName,
      phone: input.phone,
      website: input.website || undefined,
    });
    await prisma.growLead.update({
      where: { id: lead.id },
      data: { status: "sent", airtableRowId: rowId },
    });
    return apiJson({ ok: true });
  } catch (err) {
    await prisma.growLead.update({
      where: { id: lead.id },
      data: { status: "failed", error: err instanceof Error ? err.message : String(err) },
    });
    return apiError("upstream_error", "שליחת הפרטים נכשלה, נסו שוב בעוד רגע", 502);
  }
});
