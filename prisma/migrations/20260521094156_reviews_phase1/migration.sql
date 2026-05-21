-- CreateEnum
CREATE TYPE "ReviewChannel" AS ENUM ('off', 'email', 'sms');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "review_prompt_dismissed_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "reviews_channel" "ReviewChannel" NOT NULL DEFAULT 'off',
ADD COLUMN     "reviews_delay_minutes" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "reviews_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "reviews_public" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sms_sender" VARCHAR(11);

-- CreateTable
CREATE TABLE "review_items" (
    "id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "menu_item_id" UUID,
    "rating" INTEGER NOT NULL,
    "text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "review_items_menu_item_id_created_at_idx" ON "review_items"("menu_item_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "review_items_review_id_idx" ON "review_items"("review_id");

-- AddForeignKey
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
