import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireCustomer } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AddressPatchSchema = z.object({
  label: z.string().max(40).nullable().optional(),
  street: z.string().min(1).max(120).optional(),
  city: z.string().min(1).max(60).optional(),
  apartment: z.string().max(20).nullable().optional(),
  floor: z.string().max(10).nullable().optional(),
  entrance: z.string().max(10).nullable().optional(),
  notes: z.string().max(200).nullable().optional(),
});

async function ownedAddressId(customerId: string, addressId: string) {
  const row = await prisma.address.findFirst({
    where: { id: addressId, customerId },
    select: { id: true },
  });
  return row?.id ?? null;
}

export const PATCH = handler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireCustomer();
    const { id } = await params;
    const owned = await ownedAddressId(session.userId, id);
    if (!owned) return apiError("not_found", "כתובת לא נמצאה", 404);

    const body = AddressPatchSchema.parse(await req.json());
    const address = await prisma.address.update({
      where: { id: owned },
      data: {
        ...(body.label !== undefined && { label: body.label }),
        ...(body.street !== undefined && { street: body.street }),
        ...(body.city !== undefined && { city: body.city }),
        ...(body.apartment !== undefined && { apartment: body.apartment }),
        ...(body.floor !== undefined && { floor: body.floor }),
        ...(body.entrance !== undefined && { entrance: body.entrance }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
      select: {
        id: true, label: true, street: true, city: true,
        apartment: true, floor: true, entrance: true, notes: true, isDefault: true,
      },
    });
    return apiJson({
      address: {
        id: address.id,
        label: address.label,
        street: address.street,
        city: address.city,
        apartment: address.apartment,
        floor: address.floor,
        entrance: address.entrance,
        notes: address.notes,
        is_default: address.isDefault,
      },
    });
  },
);

export const DELETE = handler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireCustomer();
    const { id } = await params;
    const owned = await ownedAddressId(session.userId, id);
    if (!owned) return apiError("not_found", "כתובת לא נמצאה", 404);
    await prisma.address.delete({ where: { id: owned } });
    return apiJson({ ok: true });
  },
);
