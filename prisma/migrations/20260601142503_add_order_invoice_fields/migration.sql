-- DropIndex
DROP INDEX "orders_number_key";

-- AlterTable
ALTER TABLE "bundle_offers" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "invoice_number" TEXT,
ADD COLUMN     "invoice_url" TEXT;
