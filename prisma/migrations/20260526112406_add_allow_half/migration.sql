-- DropForeignKey
ALTER TABLE "notices" DROP CONSTRAINT "notices_category_id_fkey";

-- DropForeignKey
ALTER TABLE "notices" DROP CONSTRAINT "notices_item_id_fkey";

-- DropForeignKey
ALTER TABLE "notices" DROP CONSTRAINT "notices_tenant_id_fkey";

-- AlterTable
ALTER TABLE "item_option_groups" ADD COLUMN     "allow_half" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "notices" ADD CONSTRAINT "notices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notices" ADD CONSTRAINT "notices_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "menu_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notices" ADD CONSTRAINT "notices_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
