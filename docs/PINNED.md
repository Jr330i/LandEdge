# Pinned follow-ups

Short list of intentional gaps / next steps. Revisit when planning sprints.

## Role permissions baseline

- **Done:** Admin console baseline role matrix implemented and documented in `docs/ROLE_MATRIX.md` (API class-level console access, endpoint-level write roles, performance-view scope, frontend route/nav gating alignment).

## Lease unit cascade — polish

- **Done:** Multi-floor / multi-building selection; orphan menu labels **other floor** vs **other building** (via `GET /units?floorId=` including `floor.buildingId`).
- **Done:** `GET /api/v1/units/:id` returns `floor.buildingId` (aligned with list); lease cascade hook **fetches missing** selected units so edit flows show codes / building–floor hints without relying on the current floor’s list.
- **Code:** `apps/web/src/pages/usePropertyUnitCascade.ts`, `LeaseUnitCascadeFields.tsx`, `apps/api/src/property/units.service.ts`.

## Property hierarchy — admin UI

- **Done:** Portfolios page includes **Buildings, floors & units** (`PropertyHierarchyPanel.tsx`): portfolio picker, row-select building → floors → units, create/edit/delete (property-write roles). Uses existing `GET/POST/PATCH/DELETE` property APIs.
- **Done:** Portfolio **edit** (name, region) and **delete** on the top portfolios table (`PortfoliosPage`); hierarchy picker clears if the selected portfolio is removed.
- **Done:** Building create/edit forms include optional `latitude` / `longitude` fields (wired to property API DTO).
- **Done:** **Pick on map** for building latitude/longitude (OpenStreetMap tiles + Leaflet) on create and edit building forms in `PropertyHierarchyPanel`.
- **Done:** Drag-drop reorder for **buildings / floors / units** (`sortOrder` + `POST .../reorder` APIs) in `PropertyHierarchyPanel`.
- **Done:** SUPER_ADMIN can **move a portfolio** to another organization from **Edit portfolio** (PATCH `organizationId`); portfolios table and hierarchy picker show org context for super admins.

## Tenant & lease lists — scale

- **Done (API + UI):** `GET /tenants` and `GET /leases` accept optional `q`, `page`, `pageSize` (and leases: `tenantId`). When any of those are present, response is `{ items, total, page, pageSize }`; omit them for a full array (backward compatible). Admin **Tenants** and **Leases** tables use **server** search (debounced) + pagination.
- **Done:** No bulk tenant list at app login. **TenantAsyncPicker** (`TenantAsyncPicker.tsx`) loads paged search + `GET /tenants/:id` for labels on **leases** (create + filter), **invoices** tenant filter, and **ledger** tenant filter. **LeaseAsyncPicker** does the same for leases in billing.
- **Code:** `apps/web/src/components/TenantAsyncPicker.tsx`, `LeaseAsyncPicker.tsx`, `apps/web/src/pages/DetailPages.tsx`; `apps/api/src/leases/tenants.controller.ts`, `tenants.service.ts`, `leases.controller.ts`, `leases.service.ts`.

## Billing admin UI

- **Done:** **Charge schedules** page (`BillingSchedulesPage`): create / edit / delete for the selected lease (`POST/PATCH/DELETE /api/v1/billing/charge-schedules`), row **drag reorder** (`POST /api/v1/billing/charge-schedules/reorder`), All/Active/Inactive filter. List refetch via local `listNonce` (not global context).
- **Done:** **Invoices** list: `GET /billing/invoices` supports `q`, `status`, `leaseId`, `tenantId`, `periodFrom`, `periodTo`, `page`, `pageSize` (paged `{ items, total, page, pageSize }` when any of those are set; omit them for a full array). **Invoices** page uses server search (debounced), filters, pagination, schedules column, **CSV** (`GET /billing/invoices/export`), detail route `/billing/invoices/:id`, **PATCH** draft (`PATCH /billing/invoices/:id`). Home dashboard counts use **`GET /dashboard/metrics`** (not full invoice list).
- **Done:** **Ledger** page: `GET /billing/ledger` supports `q`, `source`, `leaseId`, `tenantId`, `createdFrom`, `createdTo`, `page`, `pageSize` (paged shape when any of those extras are set). **CSV export** uses the same filters. **Manual entry** dialog (`POST /billing/ledger/manual`) for **PAYMENT** / **ADJUSTMENT**. Table refetch via local list nonce. Deep link `?leaseId=` pre-fills the lease filter.
- **Done:** **Invoice PDF + send email:** `GET /billing/invoices/:id/pdf` (pdfkit; org name, tenant, lines, total, notes) + `POST /billing/invoices/:id/send-email` (SMTP) and invoice detail actions (**Download PDF**, **Send email**). Not a jurisdiction-specific tax invoice — operational summary only.
- **Later:** Further lease/tenant picker polish (e.g. keyboard UX, larger page sizes) if orgs grow past MVP scale.

## Tenant & owner portals

- **Done:** Dedicated portal routes and nav for `TENANT_USER` and `OWNER_USER` (not admin console).
- **Done (tenant):** Overview, paginated invoices + detail + PDF download, paginated statement + CSV export, leases list. Tenant linked by contact email (or sole tenant in org).
- **Done (owner):** Overview, properties drill-down, paginated invoices + detail + PDF (read-only).
- **Done:** Password reset (`POST /auth/forgot-password`, `/auth/reset-password`) and org user invite/resend (`POST /organizations/:id/users` without password, `POST .../users/:userId/invite`).
- **Blocked on Lipila approval:** Online pay (“Pay with Lipila”) in tenant portal and payment transaction history UI.

## Deploy & CI

- **Done:** `apps/api/Dockerfile`, `apps/web/Dockerfile` (nginx), `docker-compose.prod.yml` for full stack.
- **Done:** GitHub Actions CI (`.github/workflows/ci.yml`) — build, unit tests, e2e with Postgres.
- **Done:** SMTP env documented (`SMTP_*`, `APP_PUBLIC_URL`) for invoice email, invites, and password reset in production/docker.
- **Later:** Lipila webhook URL, hosted env secrets.

## Next major candidates (unstarted)

- **Billing:** email delivery (SMTP/provider), payment allocation UI, branded or tax-compliant PDF templates.
- **Property UX:** bulk import, floor plans, richer unit attributes.
