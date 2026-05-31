-- Self-service kiosk mode (paid add-on). Toggle gates the
-- /s/<slug>/kiosk route and the merchant-side settings card.
ALTER TABLE "tenants"
  ADD COLUMN "kiosk_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "kiosk_welcome_text" VARCHAR(160),
  ADD COLUMN "kiosk_idle_seconds" INTEGER NOT NULL DEFAULT 90;
