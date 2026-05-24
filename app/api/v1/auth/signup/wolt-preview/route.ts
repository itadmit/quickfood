import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { resolveVenue, WoltFetchError } from "@/lib/wolt-import/fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/v1/auth/signup/wolt-preview
 *
 * Public companion to the merchant-only Wolt import endpoint, used
 * by the signup wizard's optional "כבר יש לך חנות בוולט?" pre-step.
 * Fetches the Wolt venue page and returns just the metadata the
 * signup form needs to pre-fill (no menu, no DB write, no auth).
 *
 * The full menu import still runs through the regular
 * /api/v1/merchant/import/wolt/preview + commit pair after the
 * merchant signs up and gets a session.
 */

const BodySchema = z.object({
  url: z.string().url({ message: "כתובת לא תקינה" }),
});

export const POST = handler(async (req: Request) => {
  const body = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return apiError("bad_request", body.error.issues[0]?.message ?? "URL לא תקין", 400);
  }

  try {
    const info = await resolveVenue(body.data.url);

    // Stitch a single human-readable address from the parts Wolt
    // returns separately — the signup form has one address field.
    const addressParts = [
      info.venue.address,
      info.venue.city,
      info.venue.post_code,
    ].filter((p): p is string => !!p && p.length > 0);
    const fullAddress = addressParts.join(", ");

    return apiJson({
      name: info.name,
      address: fullAddress || null,
      phone: info.venue.phone ?? null,
      description: info.venue.description ?? null,
      logo_url: info.venue.brand_logo_image_url ?? null,
      cover_url: info.venue.image_url ?? null,
    });
  } catch (err) {
    if (err instanceof WoltFetchError) {
      return apiError(err.code, err.message, 400);
    }
    return apiError("wolt_fetch_failed", "כשל בשליפה מוולט", 500);
  }
});
