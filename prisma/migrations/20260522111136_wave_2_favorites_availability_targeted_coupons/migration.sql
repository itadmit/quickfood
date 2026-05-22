-- CreateEnum
CREATE TYPE "CouponAppliesTo" AS ENUM ('all', 'category', 'items');

-- AlterTable
ALTER TABLE "coupons" ADD COLUMN     "applies_to" "CouponAppliesTo" NOT NULL DEFAULT 'all',
ADD COLUMN     "category_id" UUID,
ADD COLUMN     "item_ids" UUID[] DEFAULT ARRAY[]::UUID[];

-- AlterTable
ALTER TABLE "menu_items" ADD COLUMN     "available_days" INTEGER,
ADD COLUMN     "available_from" INTEGER,
ADD COLUMN     "available_to" INTEGER,
ADD COLUMN     "stock_remaining" INTEGER;

-- CreateTable
CREATE TABLE "favorites" (
    "customer_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("customer_id","item_id")
);

-- CreateIndex
CREATE INDEX "favorites_customer_id_idx" ON "favorites"("customer_id");

-- CreateIndex
CREATE INDEX "favorites_item_id_idx" ON "favorites"("item_id");

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
