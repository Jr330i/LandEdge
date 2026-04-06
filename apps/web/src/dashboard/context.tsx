import { createContext, useContext } from 'react'
import type { SelectChangeEvent } from '@mui/material'
import type { FormEvent } from 'react'
import type {
  BillingInvoiceRow,
  ChargeScheduleRow,
  Health,
  LeaseRow,
  LedgerEntryRow,
  LoginUser,
  OrganizationRow,
  PortfolioRow,
  TenantRow,
} from './types'

export type DashboardContextValue = {
  token: string
  me: LoginUser | null
  health: Health | null
  healthErr: string | null
  orgs: OrganizationRow[] | null
  orgsErr: string | null
  portfolios: PortfolioRow[] | null
  portfoliosErr: string | null
  newPortfolioName: string
  setNewPortfolioName: (v: string) => void
  portfolioSaving: boolean
  tenants: TenantRow[] | null
  tenantsErr: string | null
  leases: LeaseRow[] | null
  leasesErr: string | null
  leaseTenantFilter: string
  billingLeaseId: string
  setBillingLeaseId: (id: string) => void
  chargeSchedules: ChargeScheduleRow[] | null
  chargeSchedulesErr: string | null
  billingInvoices: BillingInvoiceRow[] | null
  billingInvoicesErr: string | null
  ledgerEntries: LedgerEntryRow[] | null
  ledgerErr: string | null
  billingActionErr: string | null
  setBillingActionErr: (v: string | null) => void
  generateMonth: string
  setGenerateMonth: (v: string) => void
  generateSaving: boolean
  signOut: () => void
  onLeaseTenantFilterChange: (e: SelectChangeEvent<string>) => void
  reloadLeases: () => void
  reloadTenants: () => void
  reloadPortfolios: () => void
  canWriteProperty: boolean
  handleCreatePortfolio: (e: FormEvent) => void
  canWriteBilling: boolean
  onBillingLeaseChange: (e: SelectChangeEvent<string>) => void
  handleIssueInvoice: (id: string) => void
  handleVoidInvoice: (id: string) => void
  handleGenerateFromSchedules: () => void
  downloadLedgerCsv: () => void
  invoiceLineTotal: (inv: BillingInvoiceRow) => number
}

const DashboardContext = createContext<DashboardContextValue | null>(null)

export function useDashboard() {
  const ctx = useContext(DashboardContext)
  if (!ctx) {
    throw new Error('useDashboard must be used within an authenticated dashboard route')
  }
  return ctx
}

export { DashboardContext }
