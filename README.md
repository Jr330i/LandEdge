# Sofinda

Property **sub-ledger and operational intelligence** platform (PRD v5.0). Monorepo:

| Package | Path | Stack |
|--------|------|--------|
| API | `apps/api` | NestJS 11, OpenAPI at `/api/docs` |
| Web | `apps/web` | Vite, React 19, TypeScript, **Material UI** (PRD §7.3) |

## Prerequisites

- Node.js 20+
- npm 10+
- Docker (optional) for Postgres and Redis

## Setup

```bash
npm install
cp apps/api/.env.example apps/api/.env
docker compose up -d
cd apps/api && npx prisma migrate deploy && npx prisma db seed && cd ../..


docker compose up -d
npm run dev:web
npm run dev:api
```

Database URL defaults to local Docker Postgres (`docker-compose.yml`).

## Development

```bash
# Terminal 1 — API (http://localhost:3000)
npm run dev:api

# Terminal 2 — Admin web (http://localhost:5173, proxies /api → API)
npm run dev:web
```

Admin UI (JWT): organizations, **portfolios** (list/create with org picker for **SUPER_ADMIN**, edit/move org, **buildings / floors / units** hierarchy with **map pin** and **drag reorder**), **tenants (CRUD)**, leases (list/filter, CRUD, unit cascade, async tenant pickers), billing (**charge schedules** per lease with reorder + active filter, **paged/filtered invoices** with detail page + draft **PATCH** + **PDF download** + line-level **CSV export**, **paged/filtered ledger** + manual line + **CSV**). Home tiles use **`GET /api/v1/dashboard/metrics`** (counts only).

- Health: `GET http://localhost:3000/api/v1/health` (public)
- Auth: `POST http://localhost:3000/api/v1/auth/login` (public) — body: `organizationSlug`, `email`, `password`
- Password reset (public, requires SMTP for email delivery): `POST /api/v1/auth/forgot-password`, `POST /api/v1/auth/reset-password`
- Organizations: `GET http://localhost:3000/api/v1/organizations` (Bearer JWT) — `SUPER_ADMIN` sees all; others own org only. `POST` creates org (**SUPER_ADMIN** only).
- Property hierarchy (Bearer JWT): `GET/POST/PATCH/DELETE /api/v1/portfolios` (create/update DTO may include `organizationId` for **SUPER_ADMIN** only); `GET /api/v1/buildings?portfolioId=`; `GET /api/v1/floors?buildingId=`; `GET /api/v1/units?floorId=` and `GET /api/v1/units/:id` (each includes `floor.buildingId` for clients) — writes restricted to **SUPER_ADMIN**, **ORG_ADMIN**, **PORTFOLIO_MANAGER** (RLS enforced in Postgres).
- Dashboard: `GET /api/v1/dashboard/metrics` — scoped counts (leases, tenants, invoices, ledger lines) for the home page; avoids loading full billing lists at login.
- Tenants & leases: `GET /api/v1/tenants` and `GET /api/v1/leases` support optional `q`, `page`, `pageSize` (leases also `tenantId`); when any of those are set, JSON is `{ items, total, page, pageSize }` — omit them for a full array (backward compatible). `GET /api/v1/tenants/:id` for a single row. Writes: **SUPER_ADMIN**, **ORG_ADMIN**, **PORTFOLIO_MANAGER**. Overlapping **active** leases on the same unit are rejected (draft/terminated leases do not block).
- **Billing & sub-ledger** (RLS on all tables):
  - Charge schedules: `GET /api/v1/billing/charge-schedules?leaseId=`; `POST/PATCH/DELETE` — writes **SUPER_ADMIN**, **ORG_ADMIN**, **FINANCE**.
  - Invoices: `GET /api/v1/billing/invoices` — optional `leaseId`, `tenantId`, `q`, `status`, `periodFrom`, `periodTo`, `page`, `pageSize` (paged `{ items, total, page, pageSize }` when any of those extras are present; otherwise a full array). `GET /api/v1/billing/invoices/export` — CSV (one row per line; same filter query params as list, no pagination). `GET /api/v1/billing/invoices/:id` — detail (includes lease/tenant). `GET /api/v1/billing/invoices/:id/pdf` — **PDF** download (same RLS as detail; not a tax invoice template — operational summary). `POST /api/v1/billing/invoices/:id/send-email` — sends email with PDF attachment (uses tenant contact email by default; requires SMTP env). `POST` draft with lines; `PATCH /api/v1/billing/invoices/:id` — update **draft** only (optional line replace). `POST /api/v1/billing/invoices/generate-from-schedules` (draft from **active charge schedules** for a period — idempotent per lease+period draft); `POST /:id/issue` (posts one **immutable** ledger line); `POST /:id/void` (draft only).
  - Ledger: `GET /api/v1/billing/ledger` — optional `leaseId`, `tenantId`, `q`, `source`, `createdFrom`, `createdTo`, `page`, `pageSize` (paged `{ items, total, page, pageSize }` when any of those extras are present; otherwise a full array). `GET /api/v1/billing/ledger/export` accepts the same filter query params (no pagination). `POST /api/v1/billing/ledger/manual` (payment/adjustment — append-only).
  - Charge schedule order: `POST /api/v1/billing/charge-schedules/reorder` (body: `leaseId`, `chargeScheduleIds[]`) — billing write roles.
- Swagger: `http://localhost:3000/api/docs`

**Seed demo users** (password `demo123`, org slug `demo`):

- `super@demo.sofinda.local` — `SUPER_ADMIN`
- `admin@demo.sofinda.local` — `ORG_ADMIN`
- `tenant@demo.sofinda.local` — `TENANT_USER` (linked to demo tenant; portal at `/portal/tenant`)
- `owner@demo.sofinda.local` — `OWNER_USER` (portal at `/portal/owner`)

### Tests

```bash
npm test -w api
npm run test:e2e -w api       # health only (no DB required)
npm run test:e2e:db -w api    # full API e2e incl. organizations (Postgres up + migrated)
```

## Build

```bash
npm run build
```

## Production (Docker)

Local infra only (Postgres + Redis):

```bash
docker compose up -d
```

Full stack (Postgres + API + web with nginx `/api` proxy):

```bash
cp apps/api/.env.example apps/api/.env   # set JWT_SECRET (and SMTP if needed)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build
```

- Web UI: `http://localhost:8080`
- API health: `http://localhost:3000/api/v1/health`

Set `CORS_ORIGINS` on the API when the browser talks to the API directly (without nginx proxy).

## Row-level security (Postgres)

Migrations enable **RLS** on `organizations` and `users`. The API sets transaction-local GUCs via `set_config`:

- `app.rls_login` — login transaction only  
- `app.current_organization_id` + `app.is_super_admin` — authenticated requests  
- `app.rls_seed` — `prisma db seed` transaction only  

All tenant-aware Prisma calls run inside `PrismaService.withLoginRls` / `withUserRls` / `withSeedRls` so `SET LOCAL` applies to the same connection.

## Pinned follow-ups

Short, actionable backlog (e.g. lease picker polish): [`docs/PINNED.md`](docs/PINNED.md).

## Next (PRD)

- OAuth/MFA, richer RBAC, deeper ERP journal mapping (dimensions, GL codes)
- Payment matching, dunning, accrual / multi-currency billing rules

## License

Proprietary.
