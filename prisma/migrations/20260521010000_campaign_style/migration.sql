-- CreateEnum
CREATE TYPE "CampaignStyle" AS ENUM ('image', 'text');

-- AlterTable
ALTER TABLE "campaigns"
  ADD COLUMN "style" "CampaignStyle" NOT NULL DEFAULT 'image',
  ADD COLUMN "subtitle" VARCHAR(160),
  ALTER COLUMN "image_url" DROP NOT NULL;
