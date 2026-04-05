# Pinned follow-ups

Short list of intentional gaps / next steps. Revisit when planning sprints.

## Lease unit cascade — polish

- **Done:** Multi-floor / multi-building selection; orphan menu labels **other floor** vs **other building** (via `GET /units?floorId=` including `floor.buildingId`).
- **Later (optional):** `GET /api/v1/units/:id` for labels when metadata was never loaded (edge case).
- **Code:** `apps/web/src/pages/usePropertyUnitCascade.ts`, `LeaseUnitCascadeFields.tsx`, `apps/api/src/property/units.service.ts`.

## Property hierarchy — admin UI

- **Done:** Portfolios page includes **Buildings, floors & units** (`PropertyHierarchyPanel.tsx`): portfolio picker, row-select building → floors → units, create/edit/delete (property-write roles). Uses existing `GET/POST/PATCH/DELETE` property APIs.
- **Later:** Portfolio row edit/delete in UI; map pins (lat/long) on building form; drag-drop reorder.

## Tenant & lease lists — scale

- **Done (UI):** Tenants — list + view + create / edit / delete + **client-side** search (name, email, phone, lease count) on `TenantsPage` in `apps/web/src/pages/DetailPages.tsx`. API: `apps/api/src/leases/tenants.controller.ts`.
- **Done (UI):** Leases — **client-side** search on the loaded list (tenant names, status, unit labels, dates) beside the existing API tenant dropdown; `LeasesPage` in `DetailPages.tsx`.
- **Later:** Server-side pagination and search on `GET /tenants` and `GET /leases` (and matching admin table filters).
