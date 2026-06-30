-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('sent', 'signed');

-- CreateTable
CREATE TABLE "proposals" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "client_name" TEXT NOT NULL,
    "monthly_price" INTEGER NOT NULL,
    "commission_struck" TEXT,
    "commission_actual" TEXT,
    "notes" TEXT,
    "status" "ProposalStatus" NOT NULL DEFAULT 'sent',
    "signer_name" TEXT,
    "signature_data" TEXT,
    "signed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "proposals_token_key" ON "proposals"("token");
