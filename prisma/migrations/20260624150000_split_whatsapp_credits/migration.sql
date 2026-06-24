-- Split the messaging credit pool: SMS keeps sms_credits_remaining, BYO-WhatsApp
-- gets its own whatsapp_credits_remaining. whatsapp_enabled is the durable
-- "purchased a WhatsApp package" latch that gates the BYO connection UI.
ALTER TABLE "tenants" ADD COLUMN "whatsapp_credits_remaining" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "tenants" ADD COLUMN "whatsapp_enabled" BOOLEAN NOT NULL DEFAULT false;
