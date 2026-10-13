-- Phone number for the storefront floating WhatsApp button. When set, the
-- customer storefront renders a green WhatsApp FAB linking to wa.me/<number>.
-- NULL hides the button. Stored as the raw local/intl string the merchant
-- typed; normalised to wa.me international form at render time.

ALTER TABLE "tenants" ADD COLUMN "whatsapp_button_phone" TEXT;
