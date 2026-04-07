import { createContext, useContext } from 'react'
import type { FormEvent } from 'react'
import type {
  BillingInvoiceRow,
  DashboardMetrics,
  Health,
  LoginUser,
  OrganizationRow,
  PortfolioRow,
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
  newPortfolioOrganizationId: string
  setNewPortfolioOrganizationId: (v: string) => void
  portfolioSaving: boolean
  leaseTenantFilter: string
  setLeaseTenantFilter: (id: string) => void
  billingLeaseId: string
  setBillingLeaseId: (id: string) => void
  billingActionErr: string | null
  setBillingActionErr: (v: string | null) => void
  generateMonth: string
  setGenerateMonth: (v: string) => void
  generateSaving: boolean
  dashboardMetrics: DashboardMetrics | null
  dashboardMetricsErr: string | null
  signOut: () => void
  reloadPortfolios: () => void
  reloadOrganizations: () => void
  reloadDashboardMetrics: () => void
  canWriteProperty: boolean
  handleCreatePortfolio: (e: FormEvent) => void
  canWriteBilling: boolean
  handleIssueInvoice: (id: string) => Promise<void>
  handleVoidInvoice: (id: string) => Promise<void>
  handleGenerateFromSchedules: () => Promise<void>
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
