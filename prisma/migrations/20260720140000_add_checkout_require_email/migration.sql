-- Email is no longer forced at checkout by default: the payment provider
-- (Grow/CardCom) issues and sends the tax invoice, and the customer supplies
-- their email on the provider's own page. Merchants can opt back in.
ALTER TABLE "tenants"
    ADD COLUMN "checkout_require_email" BOOLEAN NOT NULL DEFAULT false;
