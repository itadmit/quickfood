-- When the order entered the kitchen (status → preparing). Powers the
-- "בהכנה" timestamp on the customer order tracker.
ALTER TABLE "orders" ADD COLUMN "preparing_at" TIMESTAMP(3);
