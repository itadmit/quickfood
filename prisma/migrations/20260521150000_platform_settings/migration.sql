-- Platform-wide singleton settings table. Holds global defaults editable
-- from the admin dashboard (instead of env vars), so the support team
-- can rotate fallback credentials without a redeploy.

CREATE TABLE "platform_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "whatsapp_default_token" TEXT,
    "whatsapp_default_instance_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- Seed the singleton row so the API can always upsert without a special path.
INSERT INTO "platform_settings" ("id", "updated_at")
    VALUES ('singleton', CURRENT_TIMESTAMP)
    ON CONFLICT ("id") DO NOTHING;
