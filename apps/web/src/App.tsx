import type { SelectChangeEvent } from '@mui/material'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { DashboardContext, type DashboardContextValue } from './dashboard/context'
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
} from './dashboard/types'
import {
  BILLING_WRITE_ROLES,
  PROPERTY_WRITE_ROLES,
} from './dashboard/types'
import { DashboardShell } from './layout/DashboardShell'
import {
  TOKEN_KEY,
  USER_KEY,
  authHeaders,
  loadStoredUser,
} from './lib/auth'
import { DashboardHome } from './pages/DashboardHome'
import {
  BillingInvoicesPage,
  BillingLedgerPage,
  BillingSchedulesPage,
  LeasesPage,
  OrganizationsPage,
  PortfoliosPage,
  TenantsPage,
} from './pages/DetailPages'
import { LoginPage } from './pages/LoginPage'

function App() {
  const [token, setToken] = useState<string | null>(() =>
    sessionStorage.getItem(TOKEN_KEY),
  )
  const [loginSlug, setLoginSlug] = useState('demo')
  const [loginEmail, setLoginEmail] = useState('super@demo.sofinda.local')
  const [loginPassword, setLoginPassword] = useState('demo123')
  const [loginErr, setLoginErr] = useState<string | null>(null)
  const [loginLoading, setLoginLoading] = useState(false)

  const [health, setHealth] = useState<Health | null>(null)
  const [healthErr, setHealthErr] = useState<string | null>(null)
  const [orgs, setOrgs] = useState<OrganizationRow[] | null>(null)
  const [orgsErr, setOrgsErr] = useState<string | null>(null)
  const [me, setMe] = useState<LoginUser | null>(() => loadStoredUser())
  const [portfolios, setPortfolios] = useState<PortfolioRow[] | null>(null)
  const [portfoliosErr, setPortfoliosErr] = useState<string | null>(null)
  const [newPortfolioName, setNewPortfolioName] = useState('')
  const [portfolioSaving, setPortfolioSaving] = useState(false)
  const [tenants, setTenants] = useState<TenantRow[] | null>(null)
  const [tenantsErr, setTenantsErr] = useState<string | null>(null)
  const [leases, setLeases] = useState<LeaseRow[] | null>(null)
  const [leasesErr, setLeasesErr] = useState<string | null>(null)
  const [leaseTenantFilter, setLeaseTenantFilter] = useState('')
  const [billingLeaseId, setBillingLeaseId] = useState('')
  const [chargeSchedules, setChargeSchedules] = useState<ChargeScheduleRow[] | null>(
    null,
  )
  const [chargeSchedulesErr, setChargeSchedulesErr] = useState<string | null>(null)
  const [billingInvoices, setBillingInvoices] = useState<BillingInvoiceRow[] | null>(
    null,
  )
  const [billingInvoicesErr, setBillingInvoicesErr] = useState<string | null>(null)
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntryRow[] | null>(null)
  const [ledgerErr, setLedgerErr] = useState<string | null>(null)
  const [billingActionErr, setBillingActionErr] = useState<string | null>(null)
  const [generateMonth, setGenerateMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [generateSaving, setGenerateSaving] = useState(false)

  useEffect(() => {
    fetch('/api/v1/health')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: Health) => setHealth(data))
      .catch((e: Error) => setHealthErr(e.message))
  }, [])

  const loadOrganizations = useCallback((t: string) => {
    setOrgs(null)
    setOrgsErr(null)
    fetch('/api/v1/organizations', { headers: authHeaders(t) })
      .then((r) => {
        if (r.status === 401) {
          sessionStorage.removeItem(TOKEN_KEY)
          sessionStorage.removeItem(USER_KEY)
          setToken(null)
          setMe(null)
          throw new Error('Session expired — sign in again')
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: OrganizationRow[]) => setOrgs(data))
      .catch((e: Error) => setOrgsErr(e.message))
  }, [])

  const loadPortfolios = useCallback((t: string) => {
    setPortfolios(null)
    setPortfoliosErr(null)
    fetch('/api/v1/portfolios', { headers: authHeaders(t) })
      .then((r) => {
        if (r.status === 401) {
          sessionStorage.removeItem(TOKEN_KEY)
          sessionStorage.removeItem(USER_KEY)
          setToken(null)
          setMe(null)
          throw new Error('Session expired — sign in again')
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: PortfolioRow[]) => setPortfolios(data))
      .catch((e: Error) => setPortfoliosErr(e.message))
  }, [])

  const loadTenants = useCallback((t: string) => {
    setTenants(null)
    setTenantsErr(null)
    fetch('/api/v1/tenants', { headers: authHeaders(t) })
      .then((r) => {
        if (r.status === 401) {
          sessionStorage.removeItem(TOKEN_KEY)
          sessionStorage.removeItem(USER_KEY)
          setToken(null)
          setMe(null)
          throw new Error('Session expired — sign in again')
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: TenantRow[]) => setTenants(data))
      .catch((e: Error) => setTenantsErr(e.message))
  }, [])

  const loadLeases = useCallback((t: string, tenantId?: string) => {
    setLeases(null)
    setLeasesErr(null)
    const q =
      tenantId && tenantId.length > 0
        ? `?tenantId=${encodeURIComponent(tenantId)}`
        : ''
    fetch(`/api/v1/leases${q}`, { headers: authHeaders(t) })
      .then((r) => {
        if (r.status === 401) {
          sessionStorage.removeItem(TOKEN_KEY)
          sessionStorage.removeItem(USER_KEY)
          setToken(null)
          setMe(null)
          throw new Error('Session expired — sign in again')
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: LeaseRow[]) => setLeases(data))
      .catch((e: Error) => setLeasesErr(e.message))
  }, [])

  const loadChargeSchedules = useCallback((t: string, leaseId: string) => {
    if (!leaseId) {
      setChargeSchedules([])
      setChargeSchedulesErr(null)
      return
    }
    setChargeSchedules(null)
    setChargeSchedulesErr(null)
    fetch(
      `/api/v1/billing/charge-schedules?leaseId=${encodeURIComponent(leaseId)}`,
      { headers: authHeaders(t) },
    )
      .then((r) => {
        if (r.status === 401) {
          sessionStorage.removeItem(TOKEN_KEY)
          sessionStorage.removeItem(USER_KEY)
          setToken(null)
          setMe(null)
          throw new Error('Session expired — sign in again')
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: ChargeScheduleRow[]) => setChargeSchedules(data))
      .catch((e: Error) => setChargeSchedulesErr(e.message))
  }, [])

  const loadBillingInvoices = useCallback((t: string) => {
    setBillingInvoices(null)
    setBillingInvoicesErr(null)
    fetch('/api/v1/billing/invoices', { headers: authHeaders(t) })
      .then((r) => {
        if (r.status === 401) {
          sessionStorage.removeItem(TOKEN_KEY)
          sessionStorage.removeItem(USER_KEY)
          setToken(null)
          setMe(null)
          throw new Error('Session expired — sign in again')
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: BillingInvoiceRow[]) => setBillingInvoices(data))
      .catch((e: Error) => setBillingInvoicesErr(e.message))
  }, [])

  const loadLedger = useCallback((t: string) => {
    setLedgerEntries(null)
    setLedgerErr(null)
    fetch('/api/v1/billing/ledger', { headers: authHeaders(t) })
      .then((r) => {
        if (r.status === 401) {
          sessionStorage.removeItem(TOKEN_KEY)
          sessionStorage.removeItem(USER_KEY)
          setToken(null)
          setMe(null)
          throw new Error('Session expired — sign in again')
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: LedgerEntryRow[]) => setLedgerEntries(data))
      .catch((e: Error) => setLedgerErr(e.message))
  }, [])

  useEffect(() => {
    if (!token) {
      setOrgs(null)
      setPortfolios(null)
      setTenants(null)
      setLeases(null)
      setMe(null)
      setBillingLeaseId('')
      setChargeSchedules(null)
      setBillingInvoices(null)
      setLedgerEntries(null)
      setBillingActionErr(null)
      return
    }
    loadOrganizations(token)
    loadPortfolios(token)
    loadTenants(token)
    loadBillingInvoices(token)
    loadLedger(token)
  }, [
    token,
    loadOrganizations,
    loadPortfolios,
    loadTenants,
    loadBillingInvoices,
    loadLedger,
  ])

  useEffect(() => {
    if (!token) return
    loadLeases(token, leaseTenantFilter || undefined)
  }, [token, leaseTenantFilter, loadLeases])

  useEffect(() => {
    if (!leases) return
    if (leases.length === 0) {
      setBillingLeaseId('')
      return
    }
    if (!billingLeaseId || !leases.some((l) => l.id === billingLeaseId)) {
      setBillingLeaseId(leases[0].id)
    }
  }, [leases, billingLeaseId])

  useEffect(() => {
    if (!token) return
    loadChargeSchedules(token, billingLeaseId)
  }, [token, billingLeaseId, loadChargeSchedules])

  const handleLogin = (e: FormEvent) => {
    e.preventDefault()
    setLoginErr(null)
    setLoginLoading(true)
    fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationSlug: loginSlug.trim(),
        email: loginEmail.trim(),
        password: loginPassword,
      }),
    })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}))
        if (!r.ok) {
          const msg =
            typeof body.message === 'string'
              ? body.message
              : 'Sign-in failed'
          throw new Error(msg)
        }
        return body as {
          access_token: string
          user: LoginUser
        }
      })
      .then(({ access_token, user }) => {
        sessionStorage.setItem(TOKEN_KEY, access_token)
        sessionStorage.setItem(USER_KEY, JSON.stringify(user))
        setToken(access_token)
        setMe(user)
      })
      .catch((err: Error) => setLoginErr(err.message))
      .finally(() => setLoginLoading(false))
  }

  const signOut = () => {
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(USER_KEY)
    setToken(null)
    setMe(null)
    setOrgs(null)
    setPortfolios(null)
    setTenants(null)
    setLeases(null)
    setLeaseTenantFilter('')
    setBillingLeaseId('')
    setChargeSchedules(null)
    setBillingInvoices(null)
    setLedgerEntries(null)
    setBillingActionErr(null)
  }

  const onLeaseTenantFilterChange = (e: SelectChangeEvent<string>) => {
    setLeaseTenantFilter(e.target.value)
  }

  const reloadLeases = useCallback(() => {
    if (!token) return
    loadLeases(token, leaseTenantFilter || undefined)
  }, [token, leaseTenantFilter, loadLeases])

  const reloadTenants = useCallback(() => {
    if (!token) return
    loadTenants(token)
  }, [token, loadTenants])

  const canWriteProperty =
    me != null && PROPERTY_WRITE_ROLES.has(me.role)

  const handleCreatePortfolio = (e: FormEvent) => {
    e.preventDefault()
    if (!token || !newPortfolioName.trim()) return
    setPortfolioSaving(true)
    setPortfoliosErr(null)
    fetch('/api/v1/portfolios', {
      method: 'POST',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: newPortfolioName.trim() }),
    })
      .then(async (r) => {
        if (r.status === 401) {
          signOut()
          throw new Error('Session expired')
        }
        if (!r.ok) {
          const body = await r.json().catch(() => ({}))
          const msg =
            typeof body.message === 'string' ? body.message : `HTTP ${r.status}`
          throw new Error(msg)
        }
        return r.json()
      })
      .then(() => {
        setNewPortfolioName('')
        loadPortfolios(token)
      })
      .catch((err: Error) => setPortfoliosErr(err.message))
      .finally(() => setPortfolioSaving(false))
  }

  const canWriteBilling =
    me != null && BILLING_WRITE_ROLES.has(me.role)

  const onBillingLeaseChange = (e: SelectChangeEvent<string>) => {
    setBillingLeaseId(e.target.value)
  }

  const handleIssueInvoice = (invoiceId: string) => {
    if (!token) return
    setBillingActionErr(null)
    fetch(`/api/v1/billing/invoices/${invoiceId}/issue`, {
      method: 'POST',
      headers: authHeaders(token),
    })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}))
          throw new Error(
            typeof body.message === 'string' ? body.message : `HTTP ${r.status}`,
          )
        }
      })
      .then(() => {
        loadBillingInvoices(token)
        loadLedger(token)
      })
      .catch((e: Error) => setBillingActionErr(e.message))
  }

  const handleVoidInvoice = (invoiceId: string) => {
    if (!token) return
    setBillingActionErr(null)
    fetch(`/api/v1/billing/invoices/${invoiceId}/void`, {
      method: 'POST',
      headers: authHeaders(token),
    })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}))
          throw new Error(
            typeof body.message === 'string' ? body.message : `HTTP ${r.status}`,
          )
        }
      })
      .then(() => loadBillingInvoices(token))
      .catch((e: Error) => setBillingActionErr(e.message))
  }

  const handleGenerateFromSchedules = () => {
    if (!token || !billingLeaseId) return
    setBillingActionErr(null)
    setGenerateSaving(true)
    const [y, m] = generateMonth.split('-').map(Number)
    const periodStart = new Date(Date.UTC(y, m - 1, 1))
      .toISOString()
      .slice(0, 10)
    const periodEnd = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
    fetch('/api/v1/billing/invoices/generate-from-schedules', {
      method: 'POST',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        leaseId: billingLeaseId,
        periodStart,
        periodEnd,
      }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}))
          throw new Error(
            typeof body.message === 'string' ? body.message : `HTTP ${r.status}`,
          )
        }
      })
      .then(() => loadBillingInvoices(token))
      .catch((e: Error) => setBillingActionErr(e.message))
      .finally(() => setGenerateSaving(false))
  }

  const downloadLedgerCsv = () => {
    if (!token) return
    setBillingActionErr(null)
    fetch('/api/v1/billing/ledger/export', { headers: authHeaders(token) })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.blob()
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'sofinda-ledger.csv'
        a.click()
        URL.revokeObjectURL(url)
      })
      .catch((e: Error) => setBillingActionErr(e.message))
  }

  const invoiceLineTotal = (inv: BillingInvoiceRow) =>
    inv.lines.reduce((sum, line) => sum + Number(line.amount), 0)

  if (!token) {
    return (
      <LoginPage
        loginSlug={loginSlug}
        setLoginSlug={setLoginSlug}
        loginEmail={loginEmail}
        setLoginEmail={setLoginEmail}
        loginPassword={loginPassword}
        setLoginPassword={setLoginPassword}
        loginErr={loginErr}
        loginLoading={loginLoading}
        handleLogin={handleLogin}
        health={health}
        healthErr={healthErr}
      />
    )
  }

  const dashboardValue: DashboardContextValue = {
    token,
    me,
    health,
    healthErr,
    orgs,
    orgsErr,
    portfolios,
    portfoliosErr,
    newPortfolioName,
    setNewPortfolioName,
    portfolioSaving,
    tenants,
    tenantsErr,
    leases,
    leasesErr,
    leaseTenantFilter,
    billingLeaseId,
    setBillingLeaseId,
    chargeSchedules,
    chargeSchedulesErr,
    billingInvoices,
    billingInvoicesErr,
    ledgerEntries,
    ledgerErr,
    billingActionErr,
    setBillingActionErr,
    generateMonth,
    setGenerateMonth,
    generateSaving,
    signOut,
    onLeaseTenantFilterChange,
    reloadLeases,
    reloadTenants,
    canWriteProperty,
    handleCreatePortfolio,
    canWriteBilling,
    onBillingLeaseChange,
    handleIssueInvoice,
    handleVoidInvoice,
    handleGenerateFromSchedules,
    downloadLedgerCsv,
    invoiceLineTotal,
  }

  return (
    <BrowserRouter>
      <DashboardContext.Provider value={dashboardValue}>
        <Routes>
          <Route path="/" element={<DashboardShell />}>
            <Route index element={<DashboardHome />} />
            <Route path="organizations" element={<OrganizationsPage />} />
            <Route path="portfolios" element={<PortfoliosPage />} />
            <Route path="tenants" element={<TenantsPage />} />
            <Route path="leases" element={<LeasesPage />} />
            <Route path="billing/schedules" element={<BillingSchedulesPage />} />
            <Route path="billing/invoices" element={<BillingInvoicesPage />} />
            <Route path="billing/ledger" element={<BillingLedgerPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </DashboardContext.Provider>
    </BrowserRouter>
  )
}

export default App
