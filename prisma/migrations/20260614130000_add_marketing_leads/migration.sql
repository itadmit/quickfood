-- CreateTable
CREATE TABLE "marketing_leads" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "restaurant" TEXT,
    "phone" TEXT,
    "email" TEXT NOT NULL,
    "message" TEXT,
    "source" TEXT NOT NULL DEFAULT 'unknown',
    "ip" TEXT,
    "email_status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "marketing_leads_created_at_idx" ON "marketing_leads"("created_at" DESC);
