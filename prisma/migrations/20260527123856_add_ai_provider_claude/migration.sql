-- CreateEnum
CREATE TYPE "AIProvider" AS ENUM ('gemini', 'claude');

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "ai_claude_api_key" TEXT,
ADD COLUMN     "ai_provider" "AIProvider" NOT NULL DEFAULT 'gemini';
