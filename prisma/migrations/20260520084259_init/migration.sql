-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('active', 'suspended', 'trial');

-- CreateEnum
CREATE TYPE "ThemeId" AS ENUM ('fresh', 'basil', 'forest', 'olive', 'tomato', 'charcoal', 'cobalt');

-- CreateEnum
CREATE TYPE "RestaurantStatus" AS ENUM ('open', 'busy', 'closed');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'confirmed', 'preparing', 'in_oven', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'refunded');

-- CreateEnum
CREATE TYPE "OrderMethod" AS ENUM ('delivery', 'pickup');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('card', 'cash', 'apple_pay', 'google_pay', 'bit');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'paid', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "CourierStatus" AS ENUM ('available', 'on_delivery', 'break_time', 'offline');

-- CreateEnum
CREATE TYPE "CourierVehicle" AS ENUM ('scooter', 'bike', 'car', 'walking');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('owner', 'manager', 'kitchen', 'courier_dispatch', 'platform_admin');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('trial', 'active', 'past_due', 'cancelled');

-- CreateEnum
CREATE TYPE "OptionGroupType" AS ENUM ('single', 'multi');

-- CreateEnum
CREATE TYPE "CouponType" AS ENUM ('percent', 'fixed');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('visible', 'hidden', 'flagged');

-- CreateEnum
CREATE TYPE "RecipientType" AS ENUM ('customer', 'merchant_user');

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('pending', 'success', 'failed', 'abandoned');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('cash', 'grow');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo_letter" VARCHAR(2) NOT NULL,
    "logo_url" TEXT,
    "theme_id" "ThemeId" NOT NULL DEFAULT 'fresh',
    "cuisine_type" TEXT,
    "vat_number" TEXT,
    "status" "TenantStatus" NOT NULL DEFAULT 'active',
    "plan_id" UUID,
    "custom_domain" TEXT,
    "payment_provider" "PaymentProvider" NOT NULL DEFAULT 'cash',
    "allowed_origins" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lat" DECIMAL(10,7),
    "lng" DECIMAL(10,7),
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "status" "RestaurantStatus" NOT NULL DEFAULT 'open',
    "hours" JSONB NOT NULL DEFAULT '{}',
    "min_order" INTEGER NOT NULL DEFAULT 0,
    "delivery_fee" INTEGER NOT NULL DEFAULT 0,
    "service_fee" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_zones" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "radius_km" DECIMAL(6,2),
    "geometry" JSONB,
    "delivery_fee" INTEGER NOT NULL,
    "min_eta" INTEGER NOT NULL,
    "max_eta" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "delivery_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_categories" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "menu_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "image_url" TEXT,
    "art_type" TEXT,
    "base_price" INTEGER NOT NULL,
    "prep_minutes" INTEGER NOT NULL DEFAULT 10,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sku" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_sizes" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "code" VARCHAR(4) NOT NULL,
    "name" TEXT NOT NULL,
    "price_delta" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "item_sizes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_option_groups" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OptionGroupType" NOT NULL DEFAULT 'single',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "min_select" INTEGER NOT NULL DEFAULT 0,
    "max_select" INTEGER NOT NULL DEFAULT 1,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "item_option_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_options" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "price_delta" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "item_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "anonymized" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "label" TEXT,
    "street" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "apartment" TEXT,
    "floor" TEXT,
    "entrance" TEXT,
    "lat" DECIMAL(10,7),
    "lng" DECIMAL(10,7),
    "notes" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "customer_id" UUID,
    "status" "OrderStatus" NOT NULL DEFAULT 'pending',
    "method" "OrderMethod" NOT NULL DEFAULT 'delivery',
    "delivery_address_id" UUID,
    "delivery_notes" TEXT,
    "scheduled_for" TIMESTAMP(3),
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "delivery_fee" INTEGER NOT NULL DEFAULT 0,
    "service_fee" INTEGER NOT NULL DEFAULT 0,
    "tip" INTEGER NOT NULL DEFAULT 0,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "payment_method" "PaymentMethod" NOT NULL DEFAULT 'cash',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "payment_intent_id" TEXT,
    "courier_id" UUID,
    "customer_notes" TEXT,
    "customer_phone_snap" TEXT,
    "customer_name_snap" TEXT,
    "estimated_ready_at" TIMESTAMP(3),
    "estimated_delivery_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),
    "ready_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "rating" INTEGER,
    "review_text" TEXT,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "menu_item_id" UUID,
    "name_snapshot" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" INTEGER NOT NULL,
    "total_price" INTEGER NOT NULL,
    "size_id" UUID,
    "size_snapshot" TEXT,
    "selected_options" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_events" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carts" (
    "id" UUID NOT NULL,
    "customer_id" UUID,
    "tenant_id" UUID NOT NULL,
    "session_id" TEXT,
    "coupon_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" UUID NOT NULL,
    "cart_id" UUID NOT NULL,
    "menu_item_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "size_id" UUID,
    "selected_options" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "couriers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "vehicle" "CourierVehicle" NOT NULL DEFAULT 'scooter',
    "status" "CourierStatus" NOT NULL DEFAULT 'offline',
    "current_lat" DECIMAL(10,7),
    "current_lng" DECIMAL(10,7),
    "current_order_id" UUID,
    "rating_avg" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "deliveries_today" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "couriers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "text" TEXT,
    "reply_text" TEXT,
    "reply_at" TIMESTAMP(3),
    "status" "ReviewStatus" NOT NULL DEFAULT 'visible',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_users" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'owner',
    "branches" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "tfa_secret" TEXT,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "customer_id" UUID,
    "name" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "last_used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "price_monthly" INTEGER NOT NULL,
    "features" JSONB NOT NULL DEFAULT '{}',
    "order_limit" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'trial',
    "current_period_start" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "payment_method_id" TEXT,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "type" "CouponType" NOT NULL DEFAULT 'percent',
    "value" INTEGER NOT NULL,
    "min_order" INTEGER,
    "max_discount" INTEGER,
    "usage_limit" INTEGER,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "per_customer_limit" INTEGER,
    "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "recipient_type" "RecipientType" NOT NULL,
    "recipient_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "read_at" TIMESTAMP(3),
    "channels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_endpoints" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" UUID NOT NULL,
    "endpoint_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMP(3),
    "next_retry_at" TIMESTAMP(3),
    "response_code" INTEGER,
    "response_body" TEXT,
    "response_headers" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_custom_domain_key" ON "tenants"("custom_domain");

-- CreateIndex
CREATE INDEX "tenants_slug_idx" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "branches_tenant_id_idx" ON "branches"("tenant_id");

-- CreateIndex
CREATE INDEX "delivery_zones_branch_id_idx" ON "delivery_zones"("branch_id");

-- CreateIndex
CREATE INDEX "menu_categories_tenant_id_position_idx" ON "menu_categories"("tenant_id", "position");

-- CreateIndex
CREATE INDEX "menu_items_tenant_id_category_id_position_idx" ON "menu_items"("tenant_id", "category_id", "position");

-- CreateIndex
CREATE INDEX "menu_items_tenant_id_available_idx" ON "menu_items"("tenant_id", "available");

-- CreateIndex
CREATE INDEX "item_sizes_item_id_position_idx" ON "item_sizes"("item_id", "position");

-- CreateIndex
CREATE INDEX "item_option_groups_item_id_idx" ON "item_option_groups"("item_id");

-- CreateIndex
CREATE INDEX "item_options_group_id_position_idx" ON "item_options"("group_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "addresses_customer_id_idx" ON "addresses"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_number_key" ON "orders"("number");

-- CreateIndex
CREATE INDEX "orders_tenant_id_status_created_at_idx" ON "orders"("tenant_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "orders_customer_id_created_at_idx" ON "orders"("customer_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_events_order_id_created_at_idx" ON "order_events"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "order_events_created_at_idx" ON "order_events"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "carts_session_id_key" ON "carts"("session_id");

-- CreateIndex
CREATE INDEX "carts_customer_id_tenant_id_idx" ON "carts"("customer_id", "tenant_id");

-- CreateIndex
CREATE INDEX "cart_items_cart_id_idx" ON "cart_items"("cart_id");

-- CreateIndex
CREATE INDEX "couriers_branch_id_status_idx" ON "couriers"("branch_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_order_id_key" ON "reviews"("order_id");

-- CreateIndex
CREATE INDEX "reviews_tenant_id_created_at_idx" ON "reviews"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "merchant_users_email_key" ON "merchant_users"("email");

-- CreateIndex
CREATE INDEX "merchant_users_tenant_id_idx" ON "merchant_users"("tenant_id");

-- CreateIndex
CREATE INDEX "otp_codes_phone_created_at_idx" ON "otp_codes"("phone", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_hash_key" ON "api_keys"("hash");

-- CreateIndex
CREATE INDEX "api_keys_tenant_id_idx" ON "api_keys"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_tenant_id_key" ON "subscriptions"("tenant_id");

-- CreateIndex
CREATE INDEX "coupons_tenant_id_active_idx" ON "coupons"("tenant_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_tenant_id_code_key" ON "coupons"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "notifications_recipient_type_recipient_id_created_at_idx" ON "notifications"("recipient_type", "recipient_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "webhook_endpoints_tenant_id_active_idx" ON "webhook_endpoints"("tenant_id", "active");

-- CreateIndex
CREATE INDEX "webhook_deliveries_status_next_retry_at_idx" ON "webhook_deliveries"("status", "next_retry_at");

-- CreateIndex
CREATE INDEX "webhook_deliveries_endpoint_id_created_at_idx" ON "webhook_deliveries"("endpoint_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_zones" ADD CONSTRAINT "delivery_zones_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_categories" ADD CONSTRAINT "menu_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "menu_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_sizes" ADD CONSTRAINT "item_sizes_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_option_groups" ADD CONSTRAINT "item_option_groups_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_options" ADD CONSTRAINT "item_options_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "item_option_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_address_id_fkey" FOREIGN KEY ("delivery_address_id") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_courier_id_fkey" FOREIGN KEY ("courier_id") REFERENCES "couriers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "couriers" ADD CONSTRAINT "couriers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "couriers" ADD CONSTRAINT "couriers_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_users" ADD CONSTRAINT "merchant_users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_endpoint_id_fkey" FOREIGN KEY ("endpoint_id") REFERENCES "webhook_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
