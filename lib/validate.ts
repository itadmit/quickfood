import { z } from "zod";

/**
 * zod schemas - shared between API Route Handlers and (eventually) OpenAPI auto-gen.
 * Field naming: snake_case (matches API.md).
 */

export const PhoneSchema = z
  .string()
  .min(7)
  .max(20)
  .regex(/^[\d+\-\s()]+$/, { message: "phone format invalid" });

export const EmailSchema = z.string().email();

export const UuidSchema = z.string().uuid();

// ─── Auth ──────────────────────────────────────────────────────

export const OtpRequestSchema = z.object({
  phone: PhoneSchema,
});

export const OtpVerifySchema = z.object({
  phone: PhoneSchema,
  code: z.string().length(6).regex(/^\d{6}$/),
  client_type: z.enum(["web", "mobile"]).default("web"),
});

export const MerchantLoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(6).max(128),
  client_type: z.enum(["web", "mobile"]).default("web"),
});

// ─── Customer ──────────────────────────────────────────────────

export const CustomerUpdateSchema = z.object({
  first_name: z.string().min(1).max(40).optional(),
  last_name: z.string().max(40).optional(),
  email: EmailSchema.optional(),
});

export const AddressInputSchema = z.object({
  label: z.string().max(40).optional(),
  street: z.string().min(1).max(120),
  city: z.string().min(1).max(60),
  apartment: z.string().max(20).optional(),
  floor: z.string().max(10).optional(),
  entrance: z.string().max(10).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  notes: z.string().max(200).optional(),
  is_default: z.boolean().optional(),
});

// ─── Cart ──────────────────────────────────────────────────────

export const CartItemAddSchema = z.object({
  item_id: UuidSchema,
  quantity: z.number().int().min(1).max(20).default(1),
  size_id: UuidSchema.optional(),
  option_ids: z.array(UuidSchema).default([]),
  notes: z.string().max(200).optional(),
});

export const CartItemUpdateSchema = z.object({
  quantity: z.number().int().min(0).max(20),
});

export const CartCouponSchema = z.object({
  code: z.string().min(1).max(40),
});

// ─── Orders ────────────────────────────────────────────────────

export const OrderCreateSchema = z.object({
  method: z.enum(["delivery", "pickup"]),
  address_id: UuidSchema.optional(),
  scheduled_for: z.string().datetime().optional(),
  payment_method: z.enum(["card", "cash", "apple_pay", "google_pay", "bit"]).default("cash"),
  payment_token: z.string().optional(),
  tip: z.number().int().min(0).default(0),
  cutlery_count: z.number().int().min(0).max(20).default(0),
  customer_notes: z.string().max(500).optional(),
  delivery_notes: z.string().max(200).optional(),
  guest_phone: PhoneSchema.optional(),
  guest_first_name: z.string().min(1).max(40).optional(),
  guest_last_name: z.string().max(40).optional(),
  guest_email: EmailSchema.optional(),
  // Customer email (logged-in flow). Server-side will persist this onto the
  // Customer row before creating the order so review reminders can use it.
  customer_email: EmailSchema.optional(),
  // Optional discount code applied at checkout. Validated server-side
  // against the Coupon model; invalid/expired codes are silently dropped
  // (the cart already shows the validation result in real time before submit).
  coupon_code: z.string().min(1).max(40).optional(),
});

export const OrderStatusPatchSchema = z.object({
  status: z.enum([
    "pending",
    "confirmed",
    "preparing",
    "in_oven",
    "ready",
    "out_for_delivery",
    "delivered",
    "cancelled",
    "refunded",
  ]),
  courier_id: UuidSchema.optional(),
});

export const OrderRateSchema = z.object({
  rating: z.number().int().min(1).max(5),
  text: z.string().max(1000).optional(),
});

// ─── Merchant menu ─────────────────────────────────────────────

export const MenuCategoryInputSchema = z.object({
  name: z.string().min(1).max(60),
  icon: z.string().max(20).optional(),
  position: z.number().int().default(0),
  active: z.boolean().default(true),
});

export const ItemSizeInputSchema = z.object({
  code: z.string().max(4),
  name: z.string().min(1).max(60),
  price_delta: z.number().int().default(0),
  is_default: z.boolean().default(false),
});

export const ItemOptionInputSchema = z.object({
  name: z.string().min(1).max(60),
  price_delta: z.number().int().default(0),
  half_price_delta: z.number().int().min(0).nullable().optional(),
  is_default: z.boolean().default(false),
  available: z.boolean().default(true),
  image_url: z.string().url().nullable().optional(),
});

type ModifierShape = {
  type: "single" | "multi";
  required: boolean;
  min_select: number;
  max_select: number;
  included_free: number;
  options: { name: string }[];
  // When set, the group's options come from a shared ModifierSet resolved
  // server-side, so an empty inline `options` array is expected and valid.
  template_set_id?: string | null;
};

function coerceSingleSelection<T extends ModifierShape>(d: T): T {
  if (d.type !== "single") return d;
  return {
    ...d,
    max_select: 1,
    included_free: 0,
    min_select: d.required ? 1 : 0,
  };
}

const modifierConstraints = <T extends ModifierShape>(d: T, ctx: z.RefinementCtx) => {
  if (d.min_select > d.max_select) {
    ctx.addIssue({
      code: "custom",
      message: "מינ׳ בחירות לא יכול להיות גדול ממקס׳",
      path: ["min_select"],
    });
  }
  if (d.included_free > d.max_select) {
    ctx.addIssue({
      code: "custom",
      message: "כלולות חינם לא יכול לעלות על מקס׳ בחירות",
      path: ["included_free"],
    });
  }
  if (d.required && d.min_select < 1) {
    ctx.addIssue({
      code: "custom",
      message: "קבוצת חובה חייבת לדרוש לפחות בחירה אחת",
      path: ["min_select"],
    });
  }
  if (d.required && d.options.length === 0 && !d.template_set_id) {
    ctx.addIssue({
      code: "custom",
      message: "קבוצת חובה חייבת לכלול לפחות אפשרות אחת",
      path: ["options"],
    });
  }
};

export const ItemOptionGroupInputSchema = z
  .object({
    name: z.string().min(1).max(60),
    type: z.enum(["single", "multi"]).default("single"),
    required: z.boolean().default(false),
    min_select: z.number().int().min(0).default(0),
    max_select: z.number().int().min(1).default(1),
    included_free: z.number().int().min(0).default(0),
    help_text: z.string().max(200).nullable().optional(),
    allow_half: z.boolean().default(false),
    split_price: z.boolean().default(false),
    custom_half_price: z.boolean().default(false),
    bundle_count: z.number().int().min(0).default(0),
    bundle_price: z.number().int().min(0).default(0),
    max_per_side: z.number().int().min(1).nullable().optional(),
    template_set_id: UuidSchema.nullable().optional(),
    options: z.array(ItemOptionInputSchema).default([]),
  })
  .transform(coerceSingleSelection)
  .superRefine(modifierConstraints);

export const ModifierSetInputSchema = z
  .object({
    name: z.string().min(1).max(60),
    type: z.enum(["single", "multi"]).default("multi"),
    required: z.boolean().default(false),
    min_select: z.number().int().min(0).default(0),
    max_select: z.number().int().min(1).default(5),
    included_free: z.number().int().min(0).default(0),
    help_text: z.string().max(200).nullable().optional(),
    allow_half: z.boolean().default(false),
    split_price: z.boolean().default(false),
    custom_half_price: z.boolean().default(false),
    bundle_count: z.number().int().min(0).default(0),
    bundle_price: z.number().int().min(0).default(0),
    max_per_side: z.number().int().min(1).nullable().optional(),
    position: z.number().int().default(0),
    options: z.array(ItemOptionInputSchema).default([]),
  })
  .transform(coerceSingleSelection)
  .superRefine(modifierConstraints);

export const MenuItemInputSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(800).default(""),
  category_id: UuidSchema,
  base_price: z.number().int().min(0),
  prep_minutes: z.number().int().min(0).default(10),
  art_type: z.string().max(40).optional(),
  image_url: z.string().url().optional(),
  images: z.array(z.string().url()).max(10).default([]),
  available: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
  position: z.number().int().default(0),
  sku: z.string().max(40).optional(),
  // Time-of-day windowing - minutes since midnight, 0..1439. Both null =
  // no time restriction. availableDays is a 7-bit mask, null = every day.
  available_from: z.number().int().min(0).max(1439).nullable().optional(),
  available_to: z.number().int().min(0).max(1439).nullable().optional(),
  available_days: z.number().int().min(0).max(127).nullable().optional(),
  // Inventory countdown - null = no inventory tracking (infinite).
  stock_remaining: z.number().int().min(0).nullable().optional(),
  sizes: z.array(ItemSizeInputSchema).default([]),
  option_groups: z.array(ItemOptionGroupInputSchema).default([]),
});

// ─── Merchant settings ─────────────────────────────────────────

export const TenantPatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  logo_letter: z.string().min(1).max(2).optional(),
  logo_url: z.string().url().nullable().optional(),
  cover_image: z.string().url().nullable().optional(),
  theme_id: z.enum(["fresh", "basil", "forest", "olive", "tomato", "charcoal", "cobalt", "sunflower", "apricot"]).optional(),
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
  cuisine_type: z.string().max(60).optional(),
  about: z.string().max(2000).nullable().optional(),
  vat_number: z.string().max(20).optional(),
  terms_text: z.string().max(20000).nullable().optional(),
  terms_acknowledged: z.boolean().optional(),
  checkout_show_tracking: z.boolean().optional(),
  scheduled_orders_enabled: z.boolean().optional(),
  pickup_enabled: z.boolean().optional(),
  cutlery_enabled: z.boolean().optional(),
  cutlery_label: z.string().min(1).max(60).optional(),
  cutlery_price: z.number().int().min(0).max(10000).optional(),
  cutlery_free_above: z.number().int().min(0).max(1000000).nullable().optional(),
  // Only setter-shape we accept: `true` = stamp now, anything else ignored.
  // Cleared via the DB if a tenant ever needs to be re-shown.
  onboarding_dismissed: z.literal(true).optional(),
  dashboard_version: z.enum(["v1", "v2"]).optional(),
  receipt_printer: z.enum(["airprint", "star", "epson", "escpos"]).optional(),
  receipt_settings: z
    .object({
      show_customer_name: z.boolean(),
      show_customer_phone: z.boolean(),
      show_options: z.boolean(),
      show_option_prices: z.boolean(),
      show_item_notes: z.boolean(),
      show_order_notes: z.boolean(),
    })
    .partial()
    .optional(),
  // Kiosk feature settings - only the welcome text + idle reset are
  // merchant-editable. `kiosk_enabled` itself is a superadmin gate.
  kiosk_welcome_text: z.string().max(160).nullable().optional(),
  kiosk_idle_seconds: z.number().int().min(15).max(600).optional(),
  kiosk_collect_phone: z.boolean().optional(),
  kiosk_require_phone: z.boolean().optional(),
  // Flat dotted-key → custom-string dict. Defaults to {} in the schema.
  // Persisted as-is; the kiosk runtime merges over `lib/i18n/kiosk-messages`
  // defaults at render time. Capped at 200 keys × 400 chars each so a
  // single tenant can't blow up the row.
  kiosk_string_overrides: z
    .record(z.string().min(1).max(120), z.string().max(400))
    .refine((v) => Object.keys(v).length <= 200, {
      message: "יותר מדי טקסטים מותאמים",
    })
    .optional(),
  // Merchandising knobs (shared by storefront + kiosk).
  featured_badge_label: z.string().max(40).nullable().optional(),
  upsell_size_nudge: z.boolean().optional(),
});

export const NoticeInputSchema = z.object({
  scope: z.enum(["store", "category", "item"]),
  category_id: UuidSchema.nullable().optional(),
  item_id: UuidSchema.nullable().optional(),
  kind: z.enum(["info", "warning", "allergen", "kosher", "dietary"]).default("info"),
  title: z.string().min(1).max(120),
  body: z.string().max(500).nullable().optional(),
  icon: z.string().max(40).nullable().optional(),
  active: z.boolean().default(true),
  position: z.number().int().default(0),
});

export const NoticePatchSchema = NoticeInputSchema.partial();

export const BranchInputSchema = z.object({
  name: z.string().min(1).max(80),
  address: z.string().min(1).max(200),
  phone: z.string().min(7).max(20),
  email: EmailSchema.optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  is_primary: z.boolean().default(false),
  status: z.enum(["open", "busy", "closed"]).default("open"),
  hours: z.record(z.any()).default({}),
  min_order: z.number().int().min(0).default(0),
  delivery_fee: z.number().int().min(0).default(0),
  service_fee: z.number().int().min(0).default(0),
});

export const DeliveryZoneInputSchema = z.object({
  name: z.string().min(1).max(80),
  radius_km: z.number().positive().optional(),
  geometry: z.unknown().optional(),
  /** Cities this zone delivers to. Trimmed + deduped on the server. */
  cities: z.array(z.string().min(1).max(60)).max(200).optional(),
  delivery_fee: z.number().int().min(0),
  /** Per-zone minimum order (shekels). 0 = no minimum for this zone. */
  min_order: z.number().int().min(0).default(0),
  /** Free delivery when subtotal reaches this (shekels). null/0 = off. */
  free_delivery_above: z.number().int().min(0).nullable().optional(),
  min_eta: z.number().int().min(0),
  max_eta: z.number().int().min(0),
  active: z.boolean().default(true),
});

// ─── Webhooks ──────────────────────────────────────────────────

export const WebhookEventSchema = z.enum([
  "order.created",
  "order.status_changed",
  "order.cancelled",
  "order.refunded",
  "order.ready_for_print",
]);

export const WebhookEndpointInputSchema = z.object({
  url: z.string().url(),
  events: z.array(WebhookEventSchema).min(1),
  active: z.boolean().default(true),
});

export const WebhookEndpointPatchSchema = WebhookEndpointInputSchema.partial();

// ─── Campaigns ─────────────────────────────────────────────────

export const CampaignCreateSchema = z
  .object({
    kind: z.enum(["popup", "banner"]).optional().default("popup"),
    style: z.enum(["image", "text"]).optional().default("image"),
    title: z.string().min(1).max(120),
    subtitle: z.string().max(160).nullable().optional(),
    icon: z.string().max(40).nullable().optional(),
    color: z.string().max(40).nullable().optional(),
    image_url: z.string().url().nullable().optional(),
    is_active: z.boolean().optional().default(true),
    link_url: z
      .string()
      .url()
      .or(z.string().regex(/^\/[^\s]*$/, "must be absolute URL or path starting with /"))
      .nullable()
      .optional(),
  })
  .superRefine((data, ctx) => {
    // Image is required everywhere EXCEPT a banner that explicitly opts into
    // the text style. Popups are always image-based.
    const needsImage = data.kind !== "banner" || data.style !== "text";
    if (needsImage && !data.image_url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["image_url"],
        message: "image_url is required for popups and image-style banners",
      });
    }
  });

// .partial() doesn't work on a refined schema; build the patch schema from
// the underlying object instead and re-apply the same cross-field rule.
const CampaignPatchObject = z.object({
  kind: z.enum(["popup", "banner"]).optional(),
  style: z.enum(["image", "text"]).optional(),
  title: z.string().min(1).max(120).optional(),
  subtitle: z.string().max(160).nullable().optional(),
  icon: z.string().max(40).nullable().optional(),
  color: z.string().max(40).nullable().optional(),
  image_url: z.string().url().nullable().optional(),
  is_active: z.boolean().optional(),
  link_url: z
    .string()
    .url()
    .or(z.string().regex(/^\/[^\s]*$/, "must be absolute URL or path starting with /"))
    .nullable()
    .optional(),
});

export const CampaignPatchSchema = CampaignPatchObject;

// ─── Uploads ───────────────────────────────────────────────────

export const UploadInitSchema = z.object({
  type: z.enum(["menu_item_image", "logo", "cover_image", "review_photo", "campaign_image"]),
  filename: z.string().min(1).max(200),
  mime_type: z.enum(["image/jpeg", "image/png", "image/webp"]),
  size_bytes: z.number().int().min(1).max(10_000_000).optional(),
});

// ─── Admin (Platform) ──────────────────────────────────────────

export const TenantCreateSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "slug must be lowercase letters, digits and hyphens"),
  name: z.string().min(1).max(120),
  logo_letter: z.string().min(1).max(2),
  theme_id: z
    .enum(["fresh", "basil", "forest", "olive", "tomato", "charcoal", "cobalt", "sunflower", "apricot"])
    .default("fresh"),
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
    .default("general"),
  cuisine_type: z.string().max(60).optional(),
  branch: z.object({
    name: z.string().min(1).max(80).default("ראשי"),
    address: z.string().min(1).max(200),
    phone: z.string().min(7).max(20),
  }),
  owner: z.object({
    email: EmailSchema,
    name: z.string().min(1).max(80),
    password: z.string().min(8).max(128),
  }),
});

// Duplicate an existing tenant (catalog + settings) into a fresh store with
// its own slug and owner. Payment config, custom domain, billing linkage and
// runtime data are NOT copied - see the duplicate route.
export const TenantDuplicateSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "slug must be lowercase letters, digits and hyphens"),
  name: z.string().min(1).max(120).optional(),
  owner: z.object({
    email: EmailSchema,
    name: z.string().min(1).max(80),
    password: z.string().min(8).max(128),
  }),
});

// ─── Payments (merchant settings) ──────────────────────────────

/**
 * Multi-provider payments: a tenant can accept any combination of cash and
 * provider-routed payments (currently just Grow, which covers card/Bit/Apple
 * Pay/Google Pay through one SDK).
 */
export const MerchantPaymentsPatchSchema = z
  .object({
    /** Tenant.acceptsCash - show "cash on delivery" at checkout */
    accepts_cash: z.boolean(),
    /** Which method should be pre-selected for the customer at checkout.
     *  Server validates this is one of the methods the tenant actually
     *  accepts before persisting; nullable means "fall back to the
     *  platform default order (cash → card → bit → apple_pay → google_pay)". */
    default_payment_method: z
      .enum(["cash", "card", "bit", "apple_pay", "google_pay"])
      .nullable()
      .optional(),
    grow: z
      .object({
        is_active: z.boolean(),
        test_mode: z.boolean().optional(),
        user_id: z.string().min(1).max(64).optional(),
        page_code: z.string().max(64).optional(),
        api_key: z.string().max(128).optional(),
        max_installments: z.number().int().min(1).max(12).optional(),
        bank_transfer_enabled: z.boolean().optional(),
        /** Apple Pay domain-association file content. Empty string clears it. */
        apple_pay_domain_association: z
          .string()
          .max(8000)
          .optional()
          .nullable(),
      })
      .optional(),
  })
  .refine(
    (v) => v.accepts_cash || (v.grow?.is_active ?? false),
    {
      message: "חייב להפעיל לפחות אמצעי תשלום אחד (מזומן או Grow)",
      path: ["accepts_cash"],
    },
  );
