-- CreateEnum
CREATE TYPE "LeaseStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE', 'EXPIRING', 'RENEWED', 'TERMINATED');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "legal_name" TEXT NOT NULL,
    "trading_name" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "leases" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "LeaseStatus" NOT NULL DEFAULT 'DRAFT',
    "terms" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lease_units" (
    "id" UUID NOT NULL,
    "lease_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "percentage_allocated" DECIMAL(7,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lease_units_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "tenants" ADD CONSTRAINT "tenants_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "leases" ADD CONSTRAINT "leases_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "leases" ADD CONSTRAINT "leases_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "lease_units" ADD CONSTRAINT "lease_units_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lease_units" ADD CONSTRAINT "lease_units_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "lease_units_lease_id_unit_id_key" ON "lease_units"("lease_id", "unit_id");

-- RLS: tenants
ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenants" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenants_select" ON "tenants" FOR SELECT USING (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR (
    current_setting('app.current_organization_id', true) IS NOT NULL
    AND "organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
);

CREATE POLICY "tenants_insert" ON "tenants" FOR INSERT WITH CHECK (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR COALESCE(current_setting('app.rls_seed', true), 'false') = 'true'
  OR (
    current_setting('app.current_organization_id', true) IS NOT NULL
    AND "organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
);

CREATE POLICY "tenants_update" ON "tenants" FOR UPDATE USING (
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

CREATE POLICY "tenants_delete" ON "tenants" FOR DELETE USING (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR (
    current_setting('app.current_organization_id', true) IS NOT NULL
    AND "organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
);

-- RLS: leases
ALTER TABLE "leases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "leases" FORCE ROW LEVEL SECURITY;

CREATE POLICY "leases_select" ON "leases" FOR SELECT USING (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR (
    current_setting('app.current_organization_id', true) IS NOT NULL
    AND "organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
);

CREATE POLICY "leases_insert" ON "leases" FOR INSERT WITH CHECK (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR COALESCE(current_setting('app.rls_seed', true), 'false') = 'true'
  OR (
    current_setting('app.current_organization_id', true) IS NOT NULL
    AND "organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
);

CREATE POLICY "leases_update" ON "leases" FOR UPDATE USING (
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

CREATE POLICY "leases_delete" ON "leases" FOR DELETE USING (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR (
    current_setting('app.current_organization_id', true) IS NOT NULL
    AND "organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
);

-- RLS: lease_units
ALTER TABLE "lease_units" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lease_units" FORCE ROW LEVEL SECURITY;

CREATE POLICY "lease_units_select" ON "lease_units" FOR SELECT USING (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR EXISTS (
    SELECT 1 FROM "leases" l
    WHERE l."id" = "lease_units"."lease_id"
    AND l."organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
);

CREATE POLICY "lease_units_insert" ON "lease_units" FOR INSERT WITH CHECK (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR COALESCE(current_setting('app.rls_seed', true), 'false') = 'true'
  OR EXISTS (
    SELECT 1 FROM "leases" l
    WHERE l."id" = "lease_units"."lease_id"
    AND l."organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
);

CREATE POLICY "lease_units_update" ON "lease_units" FOR UPDATE USING (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR COALESCE(current_setting('app.rls_seed', true), 'false') = 'true'
  OR EXISTS (
    SELECT 1 FROM "leases" l
    WHERE l."id" = "lease_units"."lease_id"
    AND l."organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
) WITH CHECK (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR COALESCE(current_setting('app.rls_seed', true), 'false') = 'true'
  OR EXISTS (
    SELECT 1 FROM "leases" l
    WHERE l."id" = "lease_units"."lease_id"
    AND l."organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
);

CREATE POLICY "lease_units_delete" ON "lease_units" FOR DELETE USING (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR EXISTS (
    SELECT 1 FROM "leases" l
    WHERE l."id" = "lease_units"."lease_id"
    AND l."organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
);
