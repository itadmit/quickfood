import { z } from "zod";

/**
 * zod schemas — shared between API Route Handlers and (eventually) OpenAPI auto-gen.
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
  name: z.string().min(1).max(80).optional(),
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
  customer_notes: z.string().max(500).optional(),
  delivery_notes: z.string().max(200).optional(),
  guest_phone: PhoneSchema.optional(),
  guest_name: z.string().min(1).max(80).optional(),
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
  is_default: z.boolean().default(false),
});

export const ItemOptionGroupInputSchema = z.object({
  name: z.string().min(1).max(60),
  type: z.enum(["single", "multi"]).default("single"),
  required: z.boolean().default(false),
  min_select: z.number().int().min(0).default(0),
  max_select: z.number().int().min(1).default(1),
  options: z.array(ItemOptionInputSchema).default([]),
});

export const MenuItemInputSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(800).default(""),
  category_id: UuidSchema,
  base_price: z.number().int().min(0),
  prep_minutes: z.number().int().min(0).default(10),
  art_type: z.string().max(40).optional(),
  image_url: z.string().url().optional(),
  available: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
  position: z.number().int().default(0),
  sku: z.string().max(40).optional(),
  sizes: z.array(ItemSizeInputSchema).default([]),
  option_groups: z.array(ItemOptionGroupInputSchema).default([]),
});

// ─── Merchant settings ─────────────────────────────────────────

export const TenantPatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  logo_letter: z.string().min(1).max(2).optional(),
  logo_url: z.string().url().optional(),
  theme_id: z.enum(["fresh", "basil", "forest", "olive", "tomato", "charcoal", "cobalt"]).optional(),
  cuisine_type: z.string().max(60).optional(),
  vat_number: z.string().max(20).optional(),
});

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
  delivery_fee: z.number().int().min(0),
  min_eta: z.number().int().min(0),
  max_eta: z.number().int().min(0),
  active: z.boolean().default(true),
});

// ─── Webhooks ──────────────────────────────────────────────────

export const WebhookEventSchema = z.enum([
  "order.created",
  "order.status_changed",
  "order.cancelled",
  "order.ready_for_print",
]);

export const WebhookEndpointInputSchema = z.object({
  url: z.string().url(),
  events: z.array(WebhookEventSchema).min(1),
  active: z.boolean().default(true),
});

export const WebhookEndpointPatchSchema = WebhookEndpointInputSchema.partial();

// ─── Uploads ───────────────────────────────────────────────────

export const UploadInitSchema = z.object({
  type: z.enum(["menu_item_image", "logo", "review_photo"]),
  filename: z.string().min(1).max(200),
  mime_type: z.enum(["image/jpeg", "image/png", "image/webp"]),
  size_bytes: z.number().int().min(1).max(5_000_000).optional(),
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
    .enum(["fresh", "basil", "forest", "olive", "tomato", "charcoal", "cobalt"])
    .default("fresh"),
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
