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
```

Database URL defaults to local Docker Postgres (`docker-compose.yml`).

## Development

```bash
# Terminal 1 — API (http://localhost:3000)
npm run dev:api

# Terminal 2 — Admin web (http://localhost:5173, proxies /api → API)
npm run dev:web
```

Admin UI (JWT): organizations, **portfolios** (list/create + **buildings / floors / units** hierarchy), **tenants (CRUD)**, leases (list/filter, CRUD, unit cascade), billing (schedules, invoices, ledger).

- Health: `GET http://localhost:3000/api/v1/health` (public)
- Auth: `POST http://localhost:3000/api/v1/auth/login` (public) — body: `organizationSlug`, `email`, `password`
- Organizations: `GET http://localhost:3000/api/v1/organizations` (Bearer JWT) — `SUPER_ADMIN` sees all; others own org only. `POST` creates org (**SUPER_ADMIN** only).
- Property hierarchy (Bearer JWT): `GET/POST/PATCH/DELETE /api/v1/portfolios`; `GET /api/v1/buildings?portfolioId=`; `GET /api/v1/floors?buildingId=`; `GET /api/v1/units?floorId=` (each unit includes `floor.buildingId` for clients) — writes restricted to **SUPER_ADMIN**, **ORG_ADMIN**, **PORTFOLIO_MANAGER** (RLS enforced in Postgres).
- Tenants & leases: `/api/v1/tenants`, `/api/v1/leases` (optional `?tenantId=`). Writes: **SUPER_ADMIN**, **ORG_ADMIN**, **PORTFOLIO_MANAGER**. Overlapping **active** leases on the same unit are rejected (draft/terminated leases do not block).
- **Billing & sub-ledger** (RLS on all tables):
  - Charge schedules: `GET /api/v1/billing/charge-schedules?leaseId=`; `POST/PATCH/DELETE` — writes **SUPER_ADMIN**, **ORG_ADMIN**, **FINANCE**.
  - Invoices: `GET /api/v1/billing/invoices` (optional `leaseId`, `tenantId`); `POST` draft with lines; `POST /api/v1/billing/invoices/generate-from-schedules` (draft from **active charge schedules** for a period — idempotent per lease+period draft); `POST /:id/issue` (posts one **immutable** ledger line); `POST /:id/void` (draft only).
  - Ledger: `GET /api/v1/billing/ledger`; `GET /api/v1/billing/ledger/export` (CSV for ERP handoff); `POST /api/v1/billing/ledger/manual` (payment/adjustment — append-only).
- Swagger: `http://localhost:3000/api/docs`

**Seed demo users** (password `demo123`, org slug `demo`):

- `super@demo.sofinda.local` — `SUPER_ADMIN`
- `admin@demo.sofinda.local` — `ORG_ADMIN`

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
