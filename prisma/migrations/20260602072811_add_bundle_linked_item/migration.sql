-- AlterTable
ALTER TABLE "bundle_offers" ADD COLUMN     "linked_item_id" UUID;

-- AddForeignKey
ALTER TABLE "bundle_offers" ADD CONSTRAINT "bundle_offers_linked_item_id_fkey" FOREIGN KEY ("linked_item_id") REFERENCES "menu_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
