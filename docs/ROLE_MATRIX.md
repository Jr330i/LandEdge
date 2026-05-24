# Role Matrix (Admin Console v1)

This is the current permission baseline for the back-office app.

## Roles in scope

- `SUPER_ADMIN`
- `ORG_ADMIN`
- `PORTFOLIO_MANAGER`
- `FINANCE`
- `FACILITIES_MANAGER`
- `TENANT_USER`
- `OWNER_USER`
- `READ_ONLY`

## Access layers

- **Console access (API + web routes/nav):**
  - Allowed: `SUPER_ADMIN`, `ORG_ADMIN`, `PORTFOLIO_MANAGER`, `FINANCE`, `FACILITIES_MANAGER`, `READ_ONLY`
  - Blocked: `TENANT_USER`, `OWNER_USER`
- **Property writes:** `SUPER_ADMIN`, `ORG_ADMIN`, `PORTFOLIO_MANAGER`
- **Lease/Tenant writes:** `SUPER_ADMIN`, `ORG_ADMIN`, `PORTFOLIO_MANAGER`
- **Billing writes:** `SUPER_ADMIN`, `ORG_ADMIN`, `FINANCE`
- **Performance dashboard view:** `SUPER_ADMIN`, `ORG_ADMIN`, `FINANCE`, `PORTFOLIO_MANAGER`

## API matrix (current)

- **Organizations**
  - `GET /organizations`, `GET /organizations/:id`: console-access roles
  - `POST /organizations`: `SUPER_ADMIN`
  - `PATCH /organizations/:id/invoice-profile`: `SUPER_ADMIN`, `ORG_ADMIN`
  - User CRUD (`GET/POST/PATCH/DELETE /organizations/:id/users...`): `SUPER_ADMIN`, `ORG_ADMIN` (hierarchy enforced)
  - `POST /organizations/:id/users/:userId/invite`: resend invite email
- **Auth (public)**
  - `POST /auth/login`, `POST /auth/forgot-password`, `POST /auth/reset-password`
- **Property hierarchy (portfolios/buildings/floors/units)**
  - Read endpoints: console-access roles
  - Create/update/delete/reorder: property write roles
- **Tenants**
  - `GET /tenants`, `GET /tenants/:id`: console-access roles
  - `POST/PATCH/DELETE /tenants...`: lease write roles
- **Leases**
  - `GET /leases`, `GET /leases/:id`: console-access roles
  - `POST/PATCH/DELETE /leases...`: lease write roles
- **Billing (charge schedules/invoices/ledger)**
  - Read/list/export/detail endpoints: console-access roles
  - Mutations (`POST/PATCH/DELETE`, issue/void/payments/manual): billing write roles
  - Payment gateway:
    - `POST /billing/payments/checkout`: billing write roles
    - `POST /billing/payments/webhooks/lenco`: public webhook endpoint (provider callback)
- **Dashboard**
  - `GET /dashboard/metrics`, `GET /dashboard/profile-metrics`: console-access roles
  - `GET /dashboard/org-staff`: lease write roles
  - `GET /dashboard/performance`: performance view roles
  - `GET /dashboard/tenant-portal`: `TENANT_USER` (legacy alias → portal snapshot)
  - `GET /dashboard/owner-portal`: `OWNER_USER` (legacy alias → portal snapshot)
- **Portal (`/portal/...`)**
  - Tenant (`TENANT_USER`): `GET /portal/tenant`, `/portal/tenant/invoices`, `/portal/tenant/invoices/:id`, `/portal/tenant/invoices/:id/pdf`, `/portal/tenant/statement`, `/portal/tenant/statement/export`, `/portal/tenant/leases`
  - Owner (`OWNER_USER`): `GET /portal/owner`, `/portal/owner/properties`, `/portal/owner/invoices`, `/portal/owner/invoices/:id`, `/portal/owner/invoices/:id/pdf`

## Frontend matrix (current)

- Non-console roles are redirected away from:
  - `/organizations`
  - `/portfolios`
  - `/tenants`
  - `/leases`
  - `/billing/schedules`
  - `/billing/invoices`
  - `/billing/invoices/:invoiceId`
  - `/billing/ledger`
- `/performance` additionally requires performance-view role.
- Portal users use `/portal/tenant/*` or `/portal/owner/*` (not admin console routes).
- Nav/module cards are filtered to match route access.

## Notes

- RLS/org-scoping still applies underneath role checks.
- Tenant/user sync: creating a tenant with `contactEmail` auto-creates/links a `TENANT_USER`; creating/updating a `TENANT_USER` auto-creates/links a tenant by email in the same org.
- Security hardening: no default password is assigned for tenant users auto-created from Tenants; login is pending until an admin sets a password in User Management.
- This document is the intended baseline; update it when controller guards or route gating changes.
