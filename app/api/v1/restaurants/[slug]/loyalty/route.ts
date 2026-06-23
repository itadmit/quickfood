import { handler, apiJson, apiError } from "@/lib/api-response";
import { resolveTenantBySlug } from "@/lib/slug";
import { prisma } from "@/lib/db/client";
import { resolveLoyaltyConfig } from "@/lib/loyalty/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public endpoint - the storefront pulls the loyalty join-form copy and the
 * two display toggles so it can decide whether to render the entry popup and
 * the checkout opt-in checkbox. Never exposes member data or tier thresholds.
 */
export const GET = handler(
  async (_req: Request, { params }: { params: Promise<{ slug: string }> }) => {
    const { slug } = await params;
    const tenant = await resolveTenantBySlug(slug);
    if (!tenant) return apiError("not_found", "מסעדה לא נמצאה", 404);

    const row = await prisma.tenant.findUnique({
      where: { id: tenant.id },
      select: { name: true, loyaltyConfig: true },
    });
    const config = resolveLoyaltyConfig(row?.loyaltyConfig, row?.name ?? "העסק");

    return apiJson({
      program_name: row?.name ?? "",
      show_join_popup: config.showJoinPopup,
      show_checkout_checkbox: config.showCheckoutCheckbox,
      checkout_consent_text: config.checkoutConsentText,
      join_form: {
        title: config.joinForm.title,
        subtitle: config.joinForm.subtitle,
        button_text: config.joinForm.buttonText,
        image_url: config.joinForm.imageUrl,
        collect_name: config.joinForm.collectName,
        collect_email: config.joinForm.collectEmail,
        collect_birthday: config.joinForm.collectBirthday,
        consent_text: config.joinForm.consentText,
      },
    });
  },
);
