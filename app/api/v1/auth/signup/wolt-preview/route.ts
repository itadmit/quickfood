import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { extractSlug, fetchMenu, resolveVenue, WoltFetchError } from "@/lib/wolt-import/fetch";
import { hoursPreviewSummary, woltScheduleToHours } from "@/lib/wolt-import/hours";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  url: z.string().url({ message: "כתובת לא תקינה" }),
});

const SAMPLE_ITEM_COUNT = 6;

export const POST = handler(async (req: Request) => {
  const body = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return apiError("bad_request", body.error.issues[0]?.message ?? "URL לא תקין", 400);
  }

  try {
    const info = await resolveVenue(body.data.url);

    const addressParts = [
      info.venue.address,
      info.venue.city,
      info.venue.post_code,
    ].filter((p): p is string => !!p && p.length > 0);
    const fullAddress = addressParts.join(", ");

    const hoursMap = woltScheduleToHours(info.venue.opening_times_schedule);
    const hoursSummary = hoursPreviewSummary(hoursMap);
    const hasHours = hoursSummary.some((h) => h.active);

    // Best-effort menu fetch - the signup preview shows item/category
    // counts and 6 sample tiles so the merchant trusts what they're
    // about to onboard. If Wolt's menu API is briefly down we still
    // succeed on the venue payload alone (merchant can sign up; the
    // post-signup importer will retry the menu).
    let menuStats: {
      categoriesCount: number;
      itemsCount: number;
      imagesCount: number;
      sampleItems: Array<{ name: string; image: string | null; price: number }>;
    } | null = null;
    let detected: {
      cutleryItem: { name: string } | null;
      noticeItems: string[];
      flaggedNames: string[];
    } = { cutleryItem: null, noticeItems: [], flaggedNames: [] };

    try {
      const menu = await fetchMenu(info.venueId);
      const items = menu.items.filter((it) => it.enabled !== false);
      // Wolt has no native cutlery / notice surfaces, so merchants
      // hack them in as zero-price menu items ("סכו״ם חד״פ", "הודעה
      // ללקוח"). They'd pollute the preview's reorder + popular slots
      // with stock fork-knife images, so drop them from sampleItems.
      const SAMPLE_CUTLERY_RE = /סכו["״׳']?ם|כלי\s*אוכל|cutlery|sztu[cć]/iu;
      const SAMPLE_NOTICE_RE = /הודעה|הודיע|לתשומת|שימו\s*לב|notice|info|important|attention/iu;
      const sampleItems = items
        .filter(
          (it) =>
            !!it.image &&
            (it.baseprice ?? 0) > 0 &&
            !SAMPLE_CUTLERY_RE.test(it.name) &&
            !SAMPLE_NOTICE_RE.test(it.name),
        )
        .slice(0, SAMPLE_ITEM_COUNT)
        .map((it) => ({
          name: it.name,
          image: it.image ?? null,
          price: Math.round((it.baseprice ?? 0) / 100),
        }));
      menuStats = {
        categoriesCount: menu.categories.length,
        itemsCount: items.length,
        imagesCount: items.filter((it) => !!it.image).length,
        sampleItems,
      };

      // Wolt has no native cutlery / customer-notice surfaces, so
      // merchants hack them in as zero-price menu items ("סכו״ם
      // חד״פ", "הודעה ללקוח"). QuickFood has these as proper
      // built-ins (cutlery toggle in checkout, banner/popup system),
      // so we flag them here to surface a friendly tip in the
      // signup wizard.
      const CUTLERY_RE = /סכו["״׳']?ם|כלי\s*אוכל|cutlery|sztu[cć]/iu;
      const NOTICE_RE = /הודעה|הודיע|לתשומת|שימו\s*לב|notice|info|important|attention/iu;
      let cutleryItem: { name: string } | null = null;
      const noticeItems: string[] = [];
      for (const it of items) {
        const isZero = (it.baseprice ?? 0) === 0;
        if (!isZero) continue;
        if (!cutleryItem && CUTLERY_RE.test(it.name)) {
          cutleryItem = { name: it.name };
          continue;
        }
        if (NOTICE_RE.test(it.name) || (it.description && NOTICE_RE.test(it.description))) {
          noticeItems.push(it.name);
        }
      }
      const flaggedNames = [
        ...(cutleryItem ? [cutleryItem.name] : []),
        ...noticeItems,
      ];
      detected = { cutleryItem, noticeItems, flaggedNames };
    } catch (err) {
      console.warn("[wolt-preview] menu fetch failed", err);
    }

    // The Wolt URL slug is the cleanest source for our slug -
    // already kebab-case, latin, unique per venue, and meaningful
    // ("meatbar-burger-dizengoff" beats anything we'd derive from
    // the Hebrew name).
    const woltSlug = extractSlug(body.data.url);

    return apiJson({
      name: info.name,
      slug: woltSlug ?? null,
      address: fullAddress || null,
      phone: info.venue.phone ?? null,
      description: info.venue.description ?? null,
      logo_url: info.venue.brand_logo_image_url ?? null,
      cover_url: info.venue.image_url ?? null,
      hours: hoursSummary,
      has_hours: hasHours,
      menu: menuStats,
      detected,
    });
  } catch (err) {
    if (err instanceof WoltFetchError) {
      return apiError(err.code, err.message, 400);
    }
    return apiError("wolt_fetch_failed", "כשל בשליפה מוולט", 500);
  }
});
