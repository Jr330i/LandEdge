import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { DashboardContext, type DashboardContextValue } from './dashboard/context'
import type {
  BillingInvoiceRow,
  DashboardMetrics,
  Health,
  LoginUser,
  OrganizationRow,
  PortfolioRow,
} from './dashboard/types'
import {
  BILLING_WRITE_ROLES,
  CONSOLE_ACCESS_ROLES,
  PERFORMANCE_VIEW_ROLES,
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
  BillingInvoiceDetailPage,
  BillingInvoicesPage,
  BillingLedgerPage,
  BillingSchedulesPage,
  LeasesPage,
  MyProfilePage,
  OrganizationsPage,
  PerformancePage,
  PortfoliosPage,
  TenantsPage,
} from './pages/DetailPages'
import { LoginPage } from './pages/LoginPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import {
  OwnerInvoicesPage,
  OwnerInvoiceDetailPage,
  OwnerPortalHomePage,
  OwnerPropertiesPage,
  TenantInvoiceDetailPage,
  TenantInvoicesPage,
  TenantLeasesPage,
  TenantPortalHomePage,
  TenantStatementPage,
} from './pages/PortalPages'

function AppRoot() {
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
  const [newPortfolioOrganizationId, setNewPortfolioOrganizationId] = useState('')
  const [portfolioSaving, setPortfolioSaving] = useState(false)
  const [leaseTenantFilter, setLeaseTenantFilter] = useState('')
  const [billingLeaseId, setBillingLeaseId] = useState('')
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(
    null,
  )
  const [dashboardMetricsErr, setDashboardMetricsErr] = useState<string | null>(null)
  const [billingActionErr, setBillingActionErr] = useState<string | null>(null)
  const [generateMonth, setGenerateMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [generateSaving, setGenerateSaving] = useState(false)
  const hasConsoleAccess = me != null && CONSOLE_ACCESS_ROLES.has(me.role)

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

  const loadDashboardMetrics = useCallback((t: string) => {
    setDashboardMetrics(null)
    setDashboardMetricsErr(null)
    fetch('/api/v1/dashboard/metrics', { headers: authHeaders(t) })
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
      .then((data: DashboardMetrics) => setDashboardMetrics(data))
      .catch((e: Error) => setDashboardMetricsErr(e.message))
  }, [])

  useEffect(() => {
    if (!token) {
      setOrgs(null)
      setPortfolios(null)
      setMe(null)
      setBillingLeaseId('')
      setDashboardMetrics(null)
      setDashboardMetricsErr(null)
      setBillingActionErr(null)
      setNewPortfolioOrganizationId('')
      return
    }
    if (!hasConsoleAccess) {
      setOrgs([])
      setPortfolios([])
      setDashboardMetrics(null)
      setDashboardMetricsErr(null)
      return
    }
    loadOrganizations(token)
    loadPortfolios(token)
    loadDashboardMetrics(token)
  }, [token, hasConsoleAccess, loadOrganizations, loadPortfolios, loadDashboardMetrics])

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
        const body = (await r.json().catch(() => ({}))) as {
          message?: string | string[]
        }
        if (!r.ok) {
          const m = body.message
          const msg =
            typeof m === 'string'
              ? m
              : Array.isArray(m)
                ? m.join('; ')
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
      .catch((err: Error) => {
        const m = err.message
        if (
          m === 'Failed to fetch' ||
          m === 'Load failed' ||
          m === 'NetworkError when attempting to fetch resource.'
        ) {
          setLoginErr(
            'Cannot reach the API. Start the API (`npm run dev:api`), use the Vite dev app URL (e.g. http://localhost:5173), and ensure Postgres is up with migrations + seed.',
          )
        } else {
          setLoginErr(m)
        }
      })
      .finally(() => setLoginLoading(false))
  }

  const signOut = () => {
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(USER_KEY)
    setToken(null)
    setMe(null)
    setOrgs(null)
    setPortfolios(null)
    setLeaseTenantFilter('')
    setBillingLeaseId('')
    setDashboardMetrics(null)
    setDashboardMetricsErr(null)
    setBillingActionErr(null)
    setNewPortfolioName('')
    setNewPortfolioOrganizationId('')
  }

  const reloadPortfolios = useCallback(() => {
    if (!token) return
    loadPortfolios(token)
  }, [token, loadPortfolios])

  const reloadOrganizations = useCallback(() => {
    if (!token) return
    loadOrganizations(token)
  }, [token, loadOrganizations])

  const reloadDashboardMetrics = useCallback(() => {
    if (!token) return
    loadDashboardMetrics(token)
  }, [token, loadDashboardMetrics])

  const canWriteProperty =
    me != null && PROPERTY_WRITE_ROLES.has(me.role)
  const canAccessConsole =
    me != null && CONSOLE_ACCESS_ROLES.has(me.role)
  const canViewPerformance =
    me != null && PERFORMANCE_VIEW_ROLES.has(me.role)
  const isTenantUser = me?.role === 'TENANT_USER'
  const isOwnerUser = me?.role === 'OWNER_USER'

  const handleCreatePortfolio = (e: FormEvent) => {
    e.preventDefault()
    if (!token || !newPortfolioName.trim()) return
    setPortfolioSaving(true)
    setPortfoliosErr(null)
    const body: Record<string, string> = { name: newPortfolioName.trim() }
    if (me?.role === 'SUPER_ADMIN' && orgs?.length) {
      const oid =
        newPortfolioOrganizationId &&
        orgs.some((o) => o.id === newPortfolioOrganizationId)
          ? newPortfolioOrganizationId
          : orgs[0].id
      body.organizationId = oid
    }
    fetch('/api/v1/portfolios', {
      method: 'POST',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
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

  const handleIssueInvoice = (invoiceId: string): Promise<void> => {
    if (!token) return Promise.resolve()
    setBillingActionErr(null)
    return fetch(`/api/v1/billing/invoices/${invoiceId}/issue`, {
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
        loadDashboardMetrics(token)
      })
      .catch((e: Error) => {
        setBillingActionErr(e.message)
        throw e
      })
  }

  const handleVoidInvoice = (invoiceId: string): Promise<void> => {
    if (!token) return Promise.resolve()
    setBillingActionErr(null)
    return fetch(`/api/v1/billing/invoices/${invoiceId}/void`, {
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
      .then(() => loadDashboardMetrics(token))
      .catch((e: Error) => {
        setBillingActionErr(e.message)
        throw e
      })
  }

  const handleGenerateFromSchedules = (): Promise<void> => {
    if (!token || !billingLeaseId) return Promise.resolve()
    setBillingActionErr(null)
    setGenerateSaving(true)
    const [y, m] = generateMonth.split('-').map(Number)
    const periodStart = new Date(Date.UTC(y, m - 1, 1))
      .toISOString()
      .slice(0, 10)
    const periodEnd = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
    return fetch('/api/v1/billing/invoices/generate-from-schedules', {
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
      .then(() => loadDashboardMetrics(token))
      .catch((e: Error) => {
        setBillingActionErr(e.message)
        throw e
      })
      .finally(() => setGenerateSaving(false))
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
    newPortfolioOrganizationId,
    setNewPortfolioOrganizationId,
    portfolioSaving,
    leaseTenantFilter,
    setLeaseTenantFilter,
    billingLeaseId,
    setBillingLeaseId,
    billingActionErr,
    setBillingActionErr,
    generateMonth,
    setGenerateMonth,
    generateSaving,
    dashboardMetrics,
    dashboardMetricsErr,
    signOut,
    reloadPortfolios,
    reloadOrganizations,
    reloadDashboardMetrics,
    canWriteProperty,
    handleCreatePortfolio,
    canWriteBilling,
    handleIssueInvoice,
    handleVoidInvoice,
    handleGenerateFromSchedules,
    invoiceLineTotal,
  }

  return (
    <DashboardContext.Provider value={dashboardValue}>
      <Routes>
        <Route path="/" element={<DashboardShell />}>
            <Route
              index
              element={
                isTenantUser ? (
                  <Navigate to="/portal/tenant" replace />
                ) : isOwnerUser ? (
                  <Navigate to="/portal/owner" replace />
                ) : (
                  <DashboardHome />
                )
              }
            />
            <Route
              path="portal/tenant"
              element={
                isTenantUser ? <TenantPortalHomePage /> : <Navigate to="/" replace />
              }
            />
            <Route
              path="portal/tenant/invoices"
              element={
                isTenantUser ? <TenantInvoicesPage /> : <Navigate to="/" replace />
              }
            />
            <Route
              path="portal/tenant/invoices/:invoiceId"
              element={
                isTenantUser ? (
                  <TenantInvoiceDetailPage />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route
              path="portal/tenant/statement"
              element={
                isTenantUser ? <TenantStatementPage /> : <Navigate to="/" replace />
              }
            />
            <Route
              path="portal/tenant/leases"
              element={
                isTenantUser ? <TenantLeasesPage /> : <Navigate to="/" replace />
              }
            />
            <Route
              path="portal/owner"
              element={
                isOwnerUser ? <OwnerPortalHomePage /> : <Navigate to="/" replace />
              }
            />
            <Route
              path="portal/owner/properties"
              element={
                isOwnerUser ? <OwnerPropertiesPage /> : <Navigate to="/" replace />
              }
            />
            <Route
              path="portal/owner/invoices/:invoiceId"
              element={
                isOwnerUser ? (
                  <OwnerInvoiceDetailPage />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route
              path="portal/owner/invoices"
              element={
                isOwnerUser ? <OwnerInvoicesPage /> : <Navigate to="/" replace />
              }
            />
            <Route
              path="organizations"
              element={canAccessConsole ? <OrganizationsPage /> : <Navigate to="/" replace />}
            />
            <Route path="profile" element={<MyProfilePage />} />
            <Route
              path="performance"
              element={canViewPerformance ? <PerformancePage /> : <Navigate to="/" replace />}
            />
            <Route
              path="portfolios"
              element={canAccessConsole ? <PortfoliosPage /> : <Navigate to="/" replace />}
            />
            <Route
              path="tenants"
              element={canAccessConsole ? <TenantsPage /> : <Navigate to="/" replace />}
            />
            <Route
              path="leases"
              element={canAccessConsole ? <LeasesPage /> : <Navigate to="/" replace />}
            />
            <Route
              path="billing/schedules"
              element={canAccessConsole ? <BillingSchedulesPage /> : <Navigate to="/" replace />}
            />
            <Route
              path="billing/invoices/:invoiceId"
              element={canAccessConsole ? <BillingInvoiceDetailPage /> : <Navigate to="/" replace />}
            />
            <Route
              path="billing/invoices"
              element={canAccessConsole ? <BillingInvoicesPage /> : <Navigate to="/" replace />}
            />
            <Route
              path="billing/ledger"
              element={canAccessConsole ? <BillingLedgerPage /> : <Navigate to="/" replace />}
            />
          </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </DashboardContext.Provider>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/*" element={<AppRoot />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
