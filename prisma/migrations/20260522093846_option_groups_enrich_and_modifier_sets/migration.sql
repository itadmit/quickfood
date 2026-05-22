-- AlterTable
ALTER TABLE "item_option_groups" ADD COLUMN     "help_text" TEXT,
ADD COLUMN     "included_free" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "template_set_id" UUID;

-- AlterTable
ALTER TABLE "item_options" ADD COLUMN     "available" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "modifier_sets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OptionGroupType" NOT NULL DEFAULT 'multi',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "min_select" INTEGER NOT NULL DEFAULT 0,
    "max_select" INTEGER NOT NULL DEFAULT 5,
    "included_free" INTEGER NOT NULL DEFAULT 0,
    "help_text" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modifier_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modifier_set_options" (
    "id" UUID NOT NULL,
    "set_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "price_delta" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "modifier_set_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "modifier_sets_tenant_id_position_idx" ON "modifier_sets"("tenant_id", "position");

-- CreateIndex
CREATE INDEX "modifier_set_options_set_id_position_idx" ON "modifier_set_options"("set_id", "position");

-- CreateIndex
CREATE INDEX "item_option_groups_template_set_id_idx" ON "item_option_groups"("template_set_id");

-- AddForeignKey
ALTER TABLE "item_option_groups" ADD CONSTRAINT "item_option_groups_template_set_id_fkey" FOREIGN KEY ("template_set_id") REFERENCES "modifier_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modifier_sets" ADD CONSTRAINT "modifier_sets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modifier_set_options" ADD CONSTRAINT "modifier_set_options_set_id_fkey" FOREIGN KEY ("set_id") REFERENCES "modifier_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
