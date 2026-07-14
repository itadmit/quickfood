-- CreateTable
CREATE TABLE "native_device_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tenant_id" UUID,
    "fcm_token" TEXT NOT NULL,
    "platform" VARCHAR(12) NOT NULL,
    "app_version" VARCHAR(40),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3),

    CONSTRAINT "native_device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "native_device_tokens_fcm_token_key" ON "native_device_tokens"("fcm_token");

-- CreateIndex
CREATE INDEX "native_device_tokens_user_id_idx" ON "native_device_tokens"("user_id");

-- CreateIndex
CREATE INDEX "native_device_tokens_tenant_id_idx" ON "native_device_tokens"("tenant_id");
