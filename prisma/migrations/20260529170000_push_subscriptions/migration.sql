-- courier_push_subscriptions
CREATE TABLE "courier_push_subscriptions" (
    "id"           UUID NOT NULL,
    "courier_id"   UUID NOT NULL,
    "endpoint"     TEXT NOT NULL,
    "p256dh"       TEXT NOT NULL,
    "auth"         TEXT NOT NULL,
    "user_agent"   TEXT,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3),
    CONSTRAINT "courier_push_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "courier_push_subscriptions_endpoint_key"
  ON "courier_push_subscriptions"("endpoint");
CREATE INDEX "courier_push_subscriptions_courier_id_idx"
  ON "courier_push_subscriptions"("courier_id");

ALTER TABLE "courier_push_subscriptions"
  ADD CONSTRAINT "courier_push_subscriptions_courier_id_fkey"
  FOREIGN KEY ("courier_id") REFERENCES "couriers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- merchant_user_push_subscriptions
CREATE TABLE "merchant_user_push_subscriptions" (
    "id"           UUID NOT NULL,
    "user_id"      UUID NOT NULL,
    "tenant_id"    UUID,
    "endpoint"     TEXT NOT NULL,
    "p256dh"       TEXT NOT NULL,
    "auth"         TEXT NOT NULL,
    "user_agent"   TEXT,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3),
    CONSTRAINT "merchant_user_push_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "merchant_user_push_subscriptions_endpoint_key"
  ON "merchant_user_push_subscriptions"("endpoint");
CREATE INDEX "merchant_user_push_subscriptions_user_id_idx"
  ON "merchant_user_push_subscriptions"("user_id");
CREATE INDEX "merchant_user_push_subscriptions_tenant_id_idx"
  ON "merchant_user_push_subscriptions"("tenant_id");

ALTER TABLE "merchant_user_push_subscriptions"
  ADD CONSTRAINT "merchant_user_push_subscriptions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "merchant_users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
