-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('direct', 'ai_advisor', 'reorder');

-- CreateEnum
CREATE TYPE "OrderItemSource" AS ENUM ('menu', 'ai_advisor', 'upsell', 'reorder');

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "source" "OrderItemSource" NOT NULL DEFAULT 'menu';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "source" "OrderSource" NOT NULL DEFAULT 'direct';
