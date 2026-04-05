-- CreateEnum
CREATE TYPE "UnitStatus" AS ENUM ('VACANT', 'UNDER_RENOVATION', 'MARKETED', 'LEASED', 'OCCUPIED');

-- CreateTable
CREATE TABLE "portfolios" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buildings" (
    "id" UUID NOT NULL,
    "portfolio_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buildings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "floors" (
    "id" UUID NOT NULL,
    "building_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "floors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" UUID NOT NULL,
    "floor_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "rentable_area" DECIMAL(14,4),
    "status" "UnitStatus" NOT NULL DEFAULT 'VACANT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "buildings" ADD CONSTRAINT "buildings_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "floors" ADD CONSTRAINT "floors_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "units" ADD CONSTRAINT "units_floor_id_fkey" FOREIGN KEY ("floor_id") REFERENCES "floors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "units_floor_id_code_key" ON "units"("floor_id", "code");

-- RLS: portfolios (direct organization_id)
ALTER TABLE "portfolios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "portfolios" FORCE ROW LEVEL SECURITY;

CREATE POLICY "portfolios_select" ON "portfolios" FOR SELECT USING (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR (
    current_setting('app.current_organization_id', true) IS NOT NULL
    AND "organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
);

CREATE POLICY "portfolios_insert" ON "portfolios" FOR INSERT WITH CHECK (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR COALESCE(current_setting('app.rls_seed', true), 'false') = 'true'
  OR (
    current_setting('app.current_organization_id', true) IS NOT NULL
    AND "organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
);

CREATE POLICY "portfolios_update" ON "portfolios" FOR UPDATE USING (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR COALESCE(current_setting('app.rls_seed', true), 'false') = 'true'
  OR (
    current_setting('app.current_organization_id', true) IS NOT NULL
    AND "organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
) WITH CHECK (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR COALESCE(current_setting('app.rls_seed', true), 'false') = 'true'
  OR (
    current_setting('app.current_organization_id', true) IS NOT NULL
    AND "organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
);

CREATE POLICY "portfolios_delete" ON "portfolios" FOR DELETE USING (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR (
    current_setting('app.current_organization_id', true) IS NOT NULL
    AND "organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
);

-- RLS: buildings → portfolio.organization_id
ALTER TABLE "buildings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "buildings" FORCE ROW LEVEL SECURITY;

CREATE POLICY "buildings_select" ON "buildings" FOR SELECT USING (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR EXISTS (
    SELECT 1 FROM "portfolios" p
    WHERE p."id" = "buildings"."portfolio_id"
    AND p."organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
);

CREATE POLICY "buildings_insert" ON "buildings" FOR INSERT WITH CHECK (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR EXISTS (
    SELECT 1 FROM "portfolios" p
    WHERE p."id" = "buildings"."portfolio_id"
    AND p."organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
);

CREATE POLICY "buildings_update" ON "buildings" FOR UPDATE USING (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR EXISTS (
    SELECT 1 FROM "portfolios" p
    WHERE p."id" = "buildings"."portfolio_id"
    AND p."organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
) WITH CHECK (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR EXISTS (
    SELECT 1 FROM "portfolios" p
    WHERE p."id" = "buildings"."portfolio_id"
    AND p."organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
);

CREATE POLICY "buildings_delete" ON "buildings" FOR DELETE USING (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR EXISTS (
    SELECT 1 FROM "portfolios" p
    WHERE p."id" = "buildings"."portfolio_id"
    AND p."organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
);

-- RLS: floors → building → portfolio
ALTER TABLE "floors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "floors" FORCE ROW LEVEL SECURITY;

CREATE POLICY "floors_select" ON "floors" FOR SELECT USING (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR EXISTS (
    SELECT 1 FROM "buildings" b
    INNER JOIN "portfolios" p ON p."id" = b."portfolio_id"
    WHERE b."id" = "floors"."building_id"
    AND p."organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
);

CREATE POLICY "floors_insert" ON "floors" FOR INSERT WITH CHECK (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR EXISTS (
    SELECT 1 FROM "buildings" b
    INNER JOIN "portfolios" p ON p."id" = b."portfolio_id"
    WHERE b."id" = "floors"."building_id"
    AND p."organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
);

CREATE POLICY "floors_update" ON "floors" FOR UPDATE USING (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR EXISTS (
    SELECT 1 FROM "buildings" b
    INNER JOIN "portfolios" p ON p."id" = b."portfolio_id"
    WHERE b."id" = "floors"."building_id"
    AND p."organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
) WITH CHECK (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR EXISTS (
    SELECT 1 FROM "buildings" b
    INNER JOIN "portfolios" p ON p."id" = b."portfolio_id"
    WHERE b."id" = "floors"."building_id"
    AND p."organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
);

CREATE POLICY "floors_delete" ON "floors" FOR DELETE USING (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR EXISTS (
    SELECT 1 FROM "buildings" b
    INNER JOIN "portfolios" p ON p."id" = b."portfolio_id"
    WHERE b."id" = "floors"."building_id"
    AND p."organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
);

-- RLS: units → floor → building → portfolio
ALTER TABLE "units" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "units" FORCE ROW LEVEL SECURITY;

CREATE POLICY "units_select" ON "units" FOR SELECT USING (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR EXISTS (
    SELECT 1 FROM "floors" f
    INNER JOIN "buildings" b ON b."id" = f."building_id"
    INNER JOIN "portfolios" p ON p."id" = b."portfolio_id"
    WHERE f."id" = "units"."floor_id"
    AND p."organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
);

CREATE POLICY "units_insert" ON "units" FOR INSERT WITH CHECK (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR EXISTS (
    SELECT 1 FROM "floors" f
    INNER JOIN "buildings" b ON b."id" = f."building_id"
    INNER JOIN "portfolios" p ON p."id" = b."portfolio_id"
    WHERE f."id" = "units"."floor_id"
    AND p."organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
);

CREATE POLICY "units_update" ON "units" FOR UPDATE USING (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR EXISTS (
    SELECT 1 FROM "floors" f
    INNER JOIN "buildings" b ON b."id" = f."building_id"
    INNER JOIN "portfolios" p ON p."id" = b."portfolio_id"
    WHERE f."id" = "units"."floor_id"
    AND p."organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
) WITH CHECK (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR EXISTS (
    SELECT 1 FROM "floors" f
    INNER JOIN "buildings" b ON b."id" = f."building_id"
    INNER JOIN "portfolios" p ON p."id" = b."portfolio_id"
    WHERE f."id" = "units"."floor_id"
    AND p."organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
);

CREATE POLICY "units_delete" ON "units" FOR DELETE USING (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR EXISTS (
    SELECT 1 FROM "floors" f
    INNER JOIN "buildings" b ON b."id" = f."building_id"
    INNER JOIN "portfolios" p ON p."id" = b."portfolio_id"
    WHERE f."id" = "units"."floor_id"
    AND p."organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
);
