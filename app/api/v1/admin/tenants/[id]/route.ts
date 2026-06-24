/**
 * Platform-admin per-tenant endpoint.
 *
 *   GET    → full tenant details (including merchant users, branches counts,
 *            WhatsApp credentials, SMS credit balance).
 *   PATCH  → update editable fields (name, theme, business/cuisine, custom
 *            domain, VAT, accepts-cash, status, WhatsApp token+instance).
 *   DELETE → hard-delete the tenant. Cascades to branches, users, orders,
 *            menu items, etc. via the Prisma `onDelete: Cascade` relations.
 *            Use with care - there is no undo.
 */
import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { deletePrefix } from "@/lib/storage/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  status: z.enum(["active", "suspended", "trial"]).optional(),
  theme_id: z
    .enum(["fresh", "basil", "forest", "olive", "tomato", "charcoal", "cobalt", "sunflower", "apricot"])
    .optional(),
  business_type: z
    .enum([
      "pizza",
      "burger",
      "falafel",
      "shawarma",
      "sushi",
      "asian",
      "bakery",
      "cafe",
      "icecream",
      "mediterranean",
      "general",
    ])
    .optional(),
  cuisine_type: z.string().trim().max(80).nullable().optional(),
  vat_number: z.string().trim().max(20).nullable().optional(),
  custom_domain: z.string().trim().max(200).nullable().optional(),
  accepts_cash: z.boolean().optional(),
  whatsapp_token: z.string().trim().max(2000).nullable().optional(),
  whatsapp_instance_id: z.string().trim().max(200).nullable().optional(),
  // Kiosk mode is a paid add-on. Superadmin flips this; the merchant
  // gets a settings card to tune the welcome text + idle timeout
  // only when the flag is on.
  kiosk_enabled: z.boolean().optional(),
  // Trial end date (ISO). Drives the dashboard TrialGate together with
  // is_paying. null clears it (no trial window defined).
  trial_ends_at: z.string().datetime().nullable().optional(),
  // Paying customer toggle. true → stamp billing_setup_completed_at so the
  // dashboard treats them as a paying customer (gate never locks). false →
  // clear it, dropping them back to a trial gated by trial_ends_at.
  is_paying: z.boolean().optional(),
});

export const GET = handler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    await requireAdmin();
    const { id } = await params;
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        plan: { select: { name: true } },
        branches: {
          select: { id: true, name: true, address: true, phone: true, isPrimary: true },
          orderBy: { createdAt: "asc" },
        },
        merchantUsers: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            lastLoginAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        },
        _count: { select: { orders: true, campaigns: true, smsLogs: true } },
      },
    });
    if (!tenant) return apiError("not_found", "מסעדה לא נמצאה", 404);

    return apiJson({
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        status: tenant.status,
        theme_id: tenant.themeId,
        business_type: tenant.businessType,
        cuisine_type: tenant.cuisineType,
        vat_number: tenant.vatNumber,
        custom_domain: tenant.customDomain,
        accepts_cash: tenant.acceptsCash,
        sms_credits_remaining: tenant.smsCreditsRemaining,
        whatsapp_credits_remaining: tenant.whatsappCreditsRemaining,
        sms_sender: tenant.smsSender,
        whatsapp_token: tenant.whatsappToken,
        whatsapp_instance_id: tenant.whatsappInstanceId,
        billing_setup_completed_at: tenant.billingSetupCompletedAt?.toISOString() ?? null,
        trial_ends_at: tenant.trialEndsAt?.toISOString() ?? null,
        created_at: tenant.createdAt.toISOString(),
        plan: tenant.plan?.name ?? null,
        counts: {
          orders: tenant._count.orders,
          campaigns: tenant._count.campaigns,
          sms_logs: tenant._count.smsLogs,
          branches: tenant.branches.length,
        },
        branches: tenant.branches,
        users: tenant.merchantUsers.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          last_login_at: u.lastLoginAt?.toISOString() ?? null,
          created_at: u.createdAt.toISOString(),
        })),
      },
    });
  },
);

export const PATCH = handler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    await requireAdmin();
    const { id } = await params;
    const body = PatchSchema.parse(await req.json());

    const existing = await prisma.tenant.findUnique({
      where: { id },
      select: { id: true, billingSetupCompletedAt: true },
    });
    if (!existing) return apiError("not_found", "מסעדה לא נמצאה", 404);

    const updated = await prisma.tenant.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.theme_id !== undefined && { themeId: body.theme_id }),
        ...(body.business_type !== undefined && { businessType: body.business_type }),
        ...(body.cuisine_type !== undefined && {
          cuisineType: body.cuisine_type === "" ? null : body.cuisine_type,
        }),
        ...(body.vat_number !== undefined && {
          vatNumber: body.vat_number === "" ? null : body.vat_number,
        }),
        ...(body.custom_domain !== undefined && {
          customDomain: body.custom_domain === "" ? null : body.custom_domain,
        }),
        ...(body.accepts_cash !== undefined && { acceptsCash: body.accepts_cash }),
        ...(body.whatsapp_token !== undefined && {
          whatsappToken: body.whatsapp_token === "" ? null : body.whatsapp_token,
        }),
        ...(body.whatsapp_instance_id !== undefined && {
          whatsappInstanceId:
            body.whatsapp_instance_id === "" ? null : body.whatsapp_instance_id,
        }),
        ...(body.kiosk_enabled !== undefined && { kioskEnabled: body.kiosk_enabled }),
        ...(body.trial_ends_at !== undefined && {
          trialEndsAt: body.trial_ends_at ? new Date(body.trial_ends_at) : null,
        }),
        ...(body.is_paying !== undefined && {
          billingSetupCompletedAt: body.is_paying
            ? existing.billingSetupCompletedAt ?? new Date()
            : null,
        }),
      },
      select: { id: true, trialEndsAt: true, billingSetupCompletedAt: true },
    });
    return apiJson({
      tenant: {
        id: updated.id,
        trial_ends_at: updated.trialEndsAt?.toISOString() ?? null,
        billing_setup_completed_at:
          updated.billingSetupCompletedAt?.toISOString() ?? null,
      },
    });
  },
);

export const DELETE = handler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    await requireAdmin();
    const { id } = await params;
    const existing = await prisma.tenant.findUnique({
      where: { id },
      select: { id: true, slug: true },
    });
    if (!existing) return apiError("not_found", "מסעדה לא נמצאה", 404);

    // Purge R2 images before removing the DB row.
    // Direct uploads live under `{tenantId}/`, Wolt-imported images under `tenants/{tenantId}/`.
    // Best-effort — partial R2 failures don't abort the delete.
    const [r2Direct, r2Wolt] = await Promise.allSettled([
      deletePrefix(`${id}/`),
      deletePrefix(`tenants/${id}/`),
    ]);
    const r2Deleted =
      (r2Direct.status === "fulfilled" ? r2Direct.value.deleted : 0) +
      (r2Wolt.status === "fulfilled" ? r2Wolt.value.deleted : 0);

    // Cascade is configured on every Tenant relation, so a single delete
    // removes branches, users, orders, menus, campaigns, logs, etc.
    try {
      await prisma.tenant.delete({ where: { id } });
    } catch (err) {
      console.error("[admin] tenant delete failed", id, err);
      throw err;
    }
    return apiJson({ deleted: { id, slug: existing.slug, r2Deleted } });
  },
);
