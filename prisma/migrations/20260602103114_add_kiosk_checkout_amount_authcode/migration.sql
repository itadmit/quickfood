/*
  Warnings:

  - Added the required column `amount` to the `kiosk_pending_checkouts` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "kiosk_pending_checkouts" ADD COLUMN     "amount" INTEGER NOT NULL,
ADD COLUMN     "auth_code" TEXT,
ADD COLUMN     "provider_response" JSONB;
