-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "ai_advisor_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ai_gemini_api_key" TEXT;
