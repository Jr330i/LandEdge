-- AlterTable
ALTER TABLE "buildings" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "floors" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "units" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;
