-- Billing enums & tables (sub-ledger + invoices)

CREATE TYPE "BillingFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL');
CREATE TYPE "ChargeKind" AS ENUM ('RENT', 'CAM', 'PARKING', 'OTHER');
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'VOID');
CREATE TYPE "LedgerSource" AS ENUM ('INVOICE', 'PAYMENT', 'ADJUSTMENT');

CREATE TABLE "charge_schedules" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "lease_id" UUID NOT NULL,
    "kind" "ChargeKind" NOT NULL,
    "label" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "frequency" "BillingFrequency" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charge_schedules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "lease_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "due_date" DATE,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoice_lines" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "charge_schedule_id" UUID,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ledger_entries" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "lease_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "invoice_id" UUID,
    "narrative" TEXT NOT NULL,
    "signed_amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "source" "LedgerSource" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ledger_entries_invoice_id_key" ON "ledger_entries"("invoice_id");

ALTER TABLE "charge_schedules" ADD CONSTRAINT "charge_schedules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "charge_schedules" ADD CONSTRAINT "charge_schedules_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_charge_schedule_id_fkey" FOREIGN KEY ("charge_schedule_id") REFERENCES "charge_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS: charge_schedules
ALTER TABLE "charge_schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "charge_schedules" FORCE ROW LEVEL SECURITY;

CREATE POLICY "charge_schedules_select" ON "charge_schedules" FOR SELECT USING (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR (
    current_setting('app.current_organization_id', true) IS NOT NULL
    AND "organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
);

CREATE POLICY "charge_schedules_insert" ON "charge_schedules" FOR INSERT WITH CHECK (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR COALESCE(current_setting('app.rls_seed', true), 'false') = 'true'
  OR (
    current_setting('app.current_organization_id', true) IS NOT NULL
    AND "organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
);

CREATE POLICY "charge_schedules_update" ON "charge_schedules" FOR UPDATE USING (
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

CREATE POLICY "charge_schedules_delete" ON "charge_schedules" FOR DELETE USING (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR (
    current_setting('app.current_organization_id', true) IS NOT NULL
    AND "organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
);

-- RLS: invoices
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoices" FORCE ROW LEVEL SECURITY;

CREATE POLICY "invoices_select" ON "invoices" FOR SELECT USING (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR (
    current_setting('app.current_organization_id', true) IS NOT NULL
    AND "organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
);

CREATE POLICY "invoices_insert" ON "invoices" FOR INSERT WITH CHECK (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR COALESCE(current_setting('app.rls_seed', true), 'false') = 'true'
  OR (
    current_setting('app.current_organization_id', true) IS NOT NULL
    AND "organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
);

CREATE POLICY "invoices_update" ON "invoices" FOR UPDATE USING (
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

CREATE POLICY "invoices_delete" ON "invoices" FOR DELETE USING (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR (
    current_setting('app.current_organization_id', true) IS NOT NULL
    AND "organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
);

-- RLS: invoice_lines
ALTER TABLE "invoice_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_lines" FORCE ROW LEVEL SECURITY;

CREATE POLICY "invoice_lines_select" ON "invoice_lines" FOR SELECT USING (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR EXISTS (
    SELECT 1 FROM "invoices" i
    WHERE i."id" = "invoice_lines"."invoice_id"
    AND i."organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
);

CREATE POLICY "invoice_lines_insert" ON "invoice_lines" FOR INSERT WITH CHECK (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR COALESCE(current_setting('app.rls_seed', true), 'false') = 'true'
  OR EXISTS (
    SELECT 1 FROM "invoices" i
    WHERE i."id" = "invoice_lines"."invoice_id"
    AND i."organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
);

CREATE POLICY "invoice_lines_update" ON "invoice_lines" FOR UPDATE USING (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR COALESCE(current_setting('app.rls_seed', true), 'false') = 'true'
  OR EXISTS (
    SELECT 1 FROM "invoices" i
    WHERE i."id" = "invoice_lines"."invoice_id"
    AND i."organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
) WITH CHECK (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR COALESCE(current_setting('app.rls_seed', true), 'false') = 'true'
  OR EXISTS (
    SELECT 1 FROM "invoices" i
    WHERE i."id" = "invoice_lines"."invoice_id"
    AND i."organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
);

CREATE POLICY "invoice_lines_delete" ON "invoice_lines" FOR DELETE USING (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR EXISTS (
    SELECT 1 FROM "invoices" i
    WHERE i."id" = "invoice_lines"."invoice_id"
    AND i."organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
);

-- RLS: ledger_entries (append-only: no UPDATE/DELETE policies)
ALTER TABLE "ledger_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ledger_entries" FORCE ROW LEVEL SECURITY;

CREATE POLICY "ledger_entries_select" ON "ledger_entries" FOR SELECT USING (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR (
    current_setting('app.current_organization_id', true) IS NOT NULL
    AND "organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
);

CREATE POLICY "ledger_entries_insert" ON "ledger_entries" FOR INSERT WITH CHECK (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR COALESCE(current_setting('app.rls_seed', true), 'false') = 'true'
  OR (
    current_setting('app.current_organization_id', true) IS NOT NULL
    AND "organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
);
