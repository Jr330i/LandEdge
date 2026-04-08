export type Health = {
  status: string
  service: string
  timestamp: string
}

export type DashboardMetrics = {
  leases: number
  tenants: number
  invoices: number
  ledgerLines: number
}

export type PerformanceReport = {
  summary: {
    tenants: number
    avgHonestyRate: number | null
    totalNetRecovered: number
    avgCollectionScore: number
  }
  tenantLeaderboard: PerformanceTenantRow[]
  staffLeaderboard: PerformanceStaffRow[]
  employeeNote: string
}

export type PerformanceTenantRow = {
  tenantId: string
  tenantName: string
  dueInvoices: number
  onTimeInvoices: number
  honestyRate: number | null
  paymentsCount: number
  reversalsCount: number
  paymentsAmount: number
  reversalAmount: number
  netRecovered: number
  recoveryEfficiency: number
  collectionScore: number
  organizationId?: string
  organizationName?: string | null
}

export type PerformanceStaffRow = {
  userId: string
  email: string
  displayName: string | null
  role: string
  assignedLeases: number
  dueInvoices: number
  onTimeInvoices: number
  honestyRate: number | null
  paymentsCount: number
  reversalsCount: number
  paymentsAmount: number
  reversalAmount: number
  netRecovered: number
  recoveryEfficiency: number
  collectionScore: number
  organizationId?: string
  organizationName?: string | null
}

export type OrgStaffUserRow = {
  id: string
  email: string
  displayName: string | null
  role: string
}

export type DashboardOrgStaffResponse = {
  organizationId: string
  users: OrgStaffUserRow[]
}

export type ProfileMetrics = {
  user: {
    id: string
    email: string
    role: string
    organizationId: string
  }
  tenantHonesty: {
    dueInvoices: number
    onTimeInvoices: number
    rate: number | null
  }
  recovery: {
    paymentsCount: number
    reversalsCount: number
    paymentsAmount: number
    reversalAmount: number
    netRecovered: number
  }
  collectionScore: number
  trend: {
    label: string
    collectionScore: number
    netRecovered: number
  }[]
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
  settings?: {
    invoiceProfile?: {
      legalName?: string | null
      taxNumber?: string | null
      bankDetails?: string | null
      paymentInstructions?: string | null
      logoUrl?: string | null
    }
  } | null
  createdAt: string
  _count: { users: number }
}

export type PortfolioRow = {
  id: string
  organizationId: string
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
  sortOrder?: number
  _count: { floors: number }
}

export type FloorRow = {
  id: string
  buildingId: string
  name: string
  level: number | null
  sortOrder?: number
  _count: { units: number }
}

export type UnitRow = {
  id: string
  floorId: string
  code: string
  type: string
  rentableArea?: string | number | null
  status: string
  sortOrder?: number
  floor: { buildingId: string }
}

export type TenantRow = {
  id: string
  organizationId?: string
  legalName: string
  tradingName: string | null
  contactEmail: string | null
  contactPhone: string | null
  _count: { leases: number }
}

export type LeaseRow = {
  id: string
  organizationId: string
  brokerUserId?: string | null
  brokerUser?: {
    id: string
    email: string
    displayName: string | null
  } | null
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
  sortOrder?: number
}

export type BillingInvoiceRow = {
  id: string
  status: string
  periodStart: string
  periodEnd: string
  currency: string
  lines: { description: string; amount: string; chargeScheduleId?: string | null }[]
  tenant?: {
    id: string
    legalName: string
    tradingName: string | null
  }
  lease?: { id: string; status: string }
}

/** `GET /billing/invoices/:id` — full invoice for detail view */
export type BillingInvoiceDetailRow = {
  id: string
  organizationId: string
  leaseId: string
  tenantId: string
  status: string
  periodStart: string
  periodEnd: string
  dueDate: string | null
  currency: string
  notes: string | null
  createdAt: string
  updatedAt: string
  lines: {
    id: string
    description: string
    amount: string
    chargeScheduleId: string | null
  }[]
  lease: { id: string; status: string }
  tenant: {
    id: string
    legalName: string
    tradingName: string | null
  }
  ledgerEntry: {
    id: string
    narrative: string
    signedAmount: string
    currency: string
    source: string
    createdAt: string
  } | null
}

export type LedgerEntryRow = {
  id: string
  narrative: string
  signedAmount: string
  currency: string
  source: string
  createdAt: string
  leaseId: string
  tenant?: {
    id: string
    legalName: string
    tradingName: string | null
  }
  lease?: { id: string }
}

export type InvoicePaymentRow = {
  id: string
  narrative: string
  signedAmount: string
  currency: string
  source: string
  createdAt: string
  reversed?: boolean
  reversal?: {
    id: string
    createdAt: string
    signedAmount: string
    reason: string | null
  } | null
}

export type InvoiceActivityRow = {
  id: string
  kind: string
  at: string
  amount: string | null
  currency: string | null
  detail: string
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

/** Matches `GET /dashboard/performance` on the API */
export const PERFORMANCE_VIEW_ROLES = new Set([
  'SUPER_ADMIN',
  'ORG_ADMIN',
  'FINANCE',
  'PORTFOLIO_MANAGER',
])
