-- OTP moves to email for the merchant signup + merchant login flows.
-- Additive only: existing phone-keyed rows (customer storefront + kiosk) keep working.
ALTER TABLE "otp_codes" ALTER COLUMN "phone" DROP NOT NULL;
ALTER TABLE "otp_codes" ADD COLUMN "email" TEXT;
CREATE INDEX "otp_codes_email_created_at_idx" ON "otp_codes"("email", "created_at" DESC);
