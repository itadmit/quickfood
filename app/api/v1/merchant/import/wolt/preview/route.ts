import { z } from "zod";
import { Prisma } from "@prisma/client";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { resolveVenue, fetchMenu, WoltFetchError } from "@/lib/wolt-import/fetch";
import {
  hoursPreviewSummary,
  woltScheduleToHours,
} from "@/lib/wolt-import/hours";
import type { ImportPreview, VenueInfoPreview } from "@/lib/wolt-import/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  source_url: z.string().url(),
});

// One preview per minute per tenant — prevents accidental hammering on
// the Wolt CDN if the merchant double-clicks. A successful commit row
// doesn't count here.
const PREVIEW_COOLDOWN_MS = 60_000;

export const POST = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);

  const body = BodySchema.parse(await req.json());

  const recent = await prisma.woltImport.findFirst({
    where: { tenantId: session.tenantId, status: "preview" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (recent && Date.now() - recent.createdAt.getTime() < PREVIEW_COOLDOWN_MS) {
    return apiError(
      "cooldown",
      "המתן רגע לפני יצירת תצוגת ייבוא נוספת",
      429,
    );
  }

  try {
    const venue = await resolveVenue(body.source_url);
    const menu = await fetchMenu(venue.venueId);

    const imagesCount = menu.items.filter((i) => !!i.image).length;
    const sampleItems = menu.items.slice(0, 8).map((i) => ({
      name: i.name,
      image: i.image ?? null,
      price: Math.round((i.baseprice ?? 0) / 100),
    }));

    const tenantBranch = await prisma.tenant.findUnique({
      where: { id: session.tenantId },
      select: {
        name: true,
        about: true,
        coverImage: true,
        logoUrl: true,
        branches: {
          where: { isPrimary: true },
          select: { address: true, phone: true, hours: true },
          take: 1,
        },
      },
    });
    const primary = tenantBranch?.branches[0] ?? null;
    const currentHours = (primary?.hours ?? {}) as Record<string, unknown>;
    const venueInfo: VenueInfoPreview = {
      wolt: {
        name: venue.venue.name ?? venue.name,
        about: cleanText(venue.venue.description ?? null),
        address: cleanText(
          [venue.venue.address, venue.venue.city]
            .filter(Boolean)
            .join(", ") || null,
        ),
        phone: cleanPhone(venue.venue.phone ?? null),
        coverImageUrl: venue.venue.image_url ?? null,
        logoImageUrl: venue.venue.brand_logo_image_url ?? null,
        hours: hoursPreviewSummary(
          woltScheduleToHours(
            venue.venue.opening_times_schedule ??
              venue.venue.delivery_times_schedule,
          ),
        ),
        hasHours: Boolean(
          venue.venue.opening_times_schedule?.length ||
            venue.venue.delivery_times_schedule?.length,
        ),
      },
      current: {
        name: tenantBranch?.name ?? "",
        about: tenantBranch?.about ?? null,
        address: primary?.address ?? null,
        phone: primary?.phone ?? null,
        coverImage: tenantBranch?.coverImage ?? null,
        logoUrl: tenantBranch?.logoUrl ?? null,
        hasHours: Object.keys(currentHours).length > 0,
      },
    };

    const created = await prisma.woltImport.create({
      data: {
        tenantId: session.tenantId,
        sourceUrl: body.source_url,
        venueId: venue.venueId,
        venueName: venue.name,
        status: "preview",
        categoriesTotal: menu.categories.length,
        itemsTotal: menu.items.length,
        rawMenu: menu as unknown as Prisma.InputJsonValue,
        rawVenue: venue.venue as unknown as Prisma.InputJsonValue,
      },
      select: { id: true, venueName: true },
    });

    const preview: ImportPreview = {
      importId: created.id,
      venueName: created.venueName,
      categoriesCount: menu.categories.length,
      itemsCount: menu.items.length,
      optionsCount: menu.options.length,
      imagesCount,
      sampleItems,
      venueInfo,
    };
    return apiJson({ preview }, 201);
  } catch (err) {
    if (err instanceof WoltFetchError) {
      return apiError(err.code, err.message, 422);
    }
    throw err;
  }
});

function cleanText(s: string | null): string | null {
  if (!s) return null;
  const t = s.replace(/\r\n?/g, "\n").trim();
  return t.length > 0 ? t : null;
}

function cleanPhone(s: string | null): string | null {
  if (!s) return null;
  const t = s.replace(/[\s()-]/g, "").trim();
  return t.length > 0 ? t : null;
}
