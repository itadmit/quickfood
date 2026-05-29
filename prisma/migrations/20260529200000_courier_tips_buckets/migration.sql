-- Split tip tracking from cashOnHand so couriers don't surrender their
-- tips when settling the cash drawer with the merchant.
ALTER TABLE "couriers" ADD COLUMN "tips_on_hand" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "couriers" ADD COLUMN "tips_owed" INTEGER NOT NULL DEFAULT 0;
