# Pinned follow-ups

Short list of intentional gaps / next steps. Revisit when planning sprints.

## Lease unit cascade — polish

- **Done:** Multi-floor / multi-building selection; orphan menu labels **other floor** vs **other building** (via `GET /units?floorId=` including `floor.buildingId`).
- **Later (optional):** `GET /api/v1/units/:id` for labels when metadata was never loaded (edge case).
- **Code:** `apps/web/src/pages/usePropertyUnitCascade.ts`, `LeaseUnitCascadeFields.tsx`, `apps/api/src/property/units.service.ts`.

## Property hierarchy — admin UI

- **Done:** Portfolios page includes **Buildings, floors & units** (`PropertyHierarchyPanel.tsx`): portfolio picker, row-select building → floors → units, create/edit/delete (property-write roles). Uses existing `GET/POST/PATCH/DELETE` property APIs.
- **Done:** Portfolio **edit** (name, region) and **delete** on the top portfolios table (`PortfoliosPage`); hierarchy picker clears if the selected portfolio is removed.
- **Done:** Building create/edit forms include optional `latitude` / `longitude` fields (wired to property API DTO).
- **Later:** Map pin picker UX for coordinates; drag-drop reorder; SUPER_ADMIN-only `organizationId` move in portfolio edit.

## Tenant & lease lists — scale

- **Done (API + UI):** `GET /tenants` and `GET /leases` accept optional `q`, `page`, `pageSize` (and leases: `tenantId`). When any of those are present, response is `{ items, total, page, pageSize }`; omit them for a full array (backward compatible). Admin **Tenants** and **Leases** tables use **server** search (debounced) + pagination. Dropdowns and billing flows still use unpaged loads from app context.
- **Code:** `apps/web/src/pages/DetailPages.tsx` (`TenantsPage`, `LeasesPage`); `apps/api/src/leases/tenants.controller.ts`, `tenants.service.ts`, `leases.controller.ts`, `leases.service.ts`.

## Next major candidates (unstarted)

- **Lease cascade polish:** `GET /api/v1/units/:id` for labels when unit metadata was never loaded (see *Lease unit cascade* above).
- **Property UX:** map pin picker for building coordinates; drag-drop reorder; SUPER_ADMIN portfolio `organizationId` move.
