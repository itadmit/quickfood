import { z } from "zod";
import { apiError, apiJson, handler } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import {
  sanitizeGrowDigits,
  sanitizeGrowPhone,
  sanitizeGrowText,
  sanitizeGrowUrl,
  submitGrowLead,
} from "@/lib/grow-signup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GrowSignupSchema = z.object({
  businessNumber: z
    .string()
    .transform(sanitizeGrowDigits)
    .refine((v) => v.length >= 5 && v.length <= 20, {
      message: "יש להזין מספר עוסק או ת.ז תקין (ספרות בלבד)",
    }),
  businessName: z
    .string()
    .transform(sanitizeGrowText)
    .refine((v) => v.length >= 2 && v.length <= 120, {
      message: "יש להזין שם עסק תקין",
    }),
  phone: z
    .string()
    .transform(sanitizeGrowPhone)
    .refine((v) => /^05\d{8}$/.test(v), {
      message: "יש להזין מספר נייד תקין (05XXXXXXXX)",
    }),
  website: z
    .string()
    .transform(sanitizeGrowUrl)
    .refine((v) => v.length >= 3 && v.length <= 200, {
      message: "לינק לאתר חובה",
    }),
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
