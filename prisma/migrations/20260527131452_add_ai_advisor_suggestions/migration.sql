-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "ai_advisor_suggestions" TEXT[] DEFAULT ARRAY[]::TEXT[];
