-- Passwordless WhatsApp-OTP login for merchants. `phone` is stored in
-- free-form (05.., +972.., dashes, spaces), so we keep a normalised E.164
-- copy as the login lookup key.
ALTER TABLE "merchant_users" ADD COLUMN "phone_e164" TEXT;

-- Backfill existing rows. Mirrors lib/format.ts toE164(): strip everything
-- but digits, then map to +972XXXXXXXXX. Anything that doesn't land on a
-- valid Israeli pattern stays NULL (can't be used for OTP login).
UPDATE "merchant_users"
SET "phone_e164" = CASE
  WHEN regexp_replace("phone", '\D', '', 'g') LIKE '972%'
    THEN '+' || regexp_replace("phone", '\D', '', 'g')
  WHEN regexp_replace("phone", '\D', '', 'g') LIKE '0%'
    THEN '+972' || substring(regexp_replace("phone", '\D', '', 'g') from 2)
  WHEN regexp_replace("phone", '\D', '', 'g') ~ '^5[0-9]{8}$'
    THEN '+972' || regexp_replace("phone", '\D', '', 'g')
  ELSE NULL
END
WHERE "phone" IS NOT NULL;

-- Drop values that didn't normalise to a clean +9725XXXXXXXX / +972XXXXXXXX.
UPDATE "merchant_users"
SET "phone_e164" = NULL
WHERE "phone_e164" IS NOT NULL
  AND "phone_e164" !~ '^\+972\d{8,9}$';

CREATE INDEX "merchant_users_phone_e164_idx" ON "merchant_users"("phone_e164");
