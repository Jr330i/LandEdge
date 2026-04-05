export type Health = {
  status: string
  service: string
  timestamp: string
}

export type LoginUser = {
  id: string
  email: string
  role: string
  displayName: string | null
}

export type OrganizationRow = {
  id: string
  name: string
  slug: string
  timezone: string
  baseCurrency: string
  createdAt: string
  _count: { users: number }
}

export type PortfolioRow = {
  id: string
  name: string
  region: string | null
  createdAt: string
  _count: { buildings: number }
}

export type BuildingRow = {
  id: string
  portfolioId: string
  name: string
  address: string | null
  latitude?: string | number | null
  longitude?: string | number | null
  _count: { floors: number }
}

export type FloorRow = {
  id: string
  buildingId: string
  name: string
  level: number | null
  _count: { units: number }
}

export type UnitRow = {
  id: string
  floorId: string
  code: string
  type: string
  rentableArea?: string | number | null
  status: string
  floor: { buildingId: string }
}

export type TenantRow = {
  id: string
  legalName: string
  tradingName: string | null
  contactEmail: string | null
  contactPhone: string | null
  _count: { leases: number }
}

export type LeaseRow = {
  id: string
  status: string
  startDate: string
  endDate: string
  /** JSON from API; UI uses `notes` string when present. */
  terms?: Record<string, unknown> | null
  tenant: {
    id: string
    legalName: string
    tradingName: string | null
  }
  leaseUnits: {
    unit: { id: string; code: string }
    /** Present when API returns lease line; Prisma Decimal often serializes as string. */
    percentageAllocated?: string | number | null
  }[]
}

export type ChargeScheduleRow = {
  id: string
  kind: string
  label: string | null
  amount: string
  currency: string
  frequency: string
  active: boolean
  startDate: string
  endDate: string | null
}

export type BillingInvoiceRow = {
  id: string
  status: string
  periodStart: string
  periodEnd: string
  currency: string
  lines: { description: string; amount: string }[]
}

export type LedgerEntryRow = {
  id: string
  narrative: string
  signedAmount: string
  currency: string
  source: string
  createdAt: string
  leaseId: string
}

export const PROPERTY_WRITE_ROLES = new Set([
  'SUPER_ADMIN',
  'ORG_ADMIN',
  'PORTFOLIO_MANAGER',
])

export const BILLING_WRITE_ROLES = new Set([
  'SUPER_ADMIN',
  'ORG_ADMIN',
  'FINANCE',
])
