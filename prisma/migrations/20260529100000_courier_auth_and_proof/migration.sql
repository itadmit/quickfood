-- AlterTable: couriers
ALTER TABLE "couriers"
  ADD COLUMN "email"           TEXT,
  ADD COLUMN "pin_hash"        TEXT,
  ADD COLUMN "max_concurrent"  INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN "cash_on_hand"    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "active"          BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "last_seen_at"    TIMESTAMP(3);

CREATE UNIQUE INDEX "couriers_email_key" ON "couriers"("email");

-- AlterTable: orders
ALTER TABLE "orders"
  ADD COLUMN "courier_assigned_at"  TIMESTAMP(3),
  ADD COLUMN "courier_picked_up_at" TIMESTAMP(3),
  ADD COLUMN "cash_collected"       INTEGER,
  ADD COLUMN "proof_photo_url"      TEXT;

-- CreateTable: courier_sessions
CREATE TABLE "courier_sessions" (
    "id"         UUID NOT NULL,
    "courier_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "device"     TEXT,
    "ip"         TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    CONSTRAINT "courier_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "courier_sessions_token_hash_key" ON "courier_sessions"("token_hash");
CREATE INDEX "courier_sessions_courier_id_created_at_idx" ON "courier_sessions"("courier_id", "created_at" DESC);

ALTER TABLE "courier_sessions"
  ADD CONSTRAINT "courier_sessions_courier_id_fkey"
  FOREIGN KEY ("courier_id") REFERENCES "couriers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: courier_magic_link_tokens
CREATE TABLE "courier_magic_link_tokens" (
    "id"         UUID NOT NULL,
    "courier_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at"    TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "courier_magic_link_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "courier_magic_link_tokens_token_hash_key" ON "courier_magic_link_tokens"("token_hash");
CREATE INDEX "courier_magic_link_tokens_courier_id_created_at_idx" ON "courier_magic_link_tokens"("courier_id", "created_at" DESC);

ALTER TABLE "courier_magic_link_tokens"
  ADD CONSTRAINT "courier_magic_link_tokens_courier_id_fkey"
  FOREIGN KEY ("courier_id") REFERENCES "couriers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
