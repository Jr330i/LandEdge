-- Row-level security (PRD FR-001.01, NFR-SEC-01). Session vars set per transaction from Nest (SET LOCAL via set_config).

ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organizations" FORCE ROW LEVEL SECURITY;

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;

-- organizations: read own row, super reads all, login path reads by slug lookup
CREATE POLICY "organizations_select_tenant" ON "organizations" FOR SELECT USING (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR (
    current_setting('app.current_organization_id', true) IS NOT NULL
    AND "id" = current_setting('app.current_organization_id', true)::uuid
  )
);

CREATE POLICY "organizations_select_login" ON "organizations" FOR SELECT USING (
  COALESCE(current_setting('app.rls_login', true), 'false') = 'true'
);

CREATE POLICY "organizations_insert" ON "organizations" FOR INSERT WITH CHECK (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR COALESCE(current_setting('app.rls_seed', true), 'false') = 'true'
);

CREATE POLICY "organizations_update" ON "organizations" FOR UPDATE USING (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR COALESCE(current_setting('app.rls_seed', true), 'false') = 'true'
  OR (
    current_setting('app.current_organization_id', true) IS NOT NULL
    AND "id" = current_setting('app.current_organization_id', true)::uuid
  )
);

-- users: same-tenant reads, super reads all, login reads credentials
CREATE POLICY "users_select_tenant" ON "users" FOR SELECT USING (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR (
    current_setting('app.current_organization_id', true) IS NOT NULL
    AND "organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
);

CREATE POLICY "users_select_login" ON "users" FOR SELECT USING (
  COALESCE(current_setting('app.rls_login', true), 'false') = 'true'
);

CREATE POLICY "users_insert" ON "users" FOR INSERT WITH CHECK (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR COALESCE(current_setting('app.rls_seed', true), 'false') = 'true'
  OR (
    current_setting('app.current_organization_id', true) IS NOT NULL
    AND "organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
);

CREATE POLICY "users_update" ON "users" FOR UPDATE USING (
  COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true'
  OR COALESCE(current_setting('app.rls_seed', true), 'false') = 'true'
  OR (
    current_setting('app.current_organization_id', true) IS NOT NULL
    AND "organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
);
