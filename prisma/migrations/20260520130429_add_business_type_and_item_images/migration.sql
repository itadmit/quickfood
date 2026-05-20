-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('pizza', 'burger', 'falafel', 'shawarma', 'sushi', 'asian', 'bakery', 'cafe', 'icecream', 'mediterranean', 'general');

-- AlterTable
ALTER TABLE "menu_items" ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "business_type" "BusinessType" NOT NULL DEFAULT 'general';
