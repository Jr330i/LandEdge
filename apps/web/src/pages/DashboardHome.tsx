import ApartmentOutlined from '@mui/icons-material/ApartmentOutlined'
import { apiUrl } from '../lib/api'
import AssignmentOutlined from '@mui/icons-material/AssignmentOutlined'
import BusinessOutlined from '@mui/icons-material/BusinessOutlined'
import ChevronRightOutlined from '@mui/icons-material/ChevronRightOutlined'
import CloudDoneOutlined from '@mui/icons-material/CloudDoneOutlined'
import CloudOffOutlined from '@mui/icons-material/CloudOffOutlined'
import DnsOutlined from '@mui/icons-material/DnsOutlined'
import PeopleOutlineOutlined from '@mui/icons-material/PeopleOutlineOutlined'
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined'
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined'
import SavingsOutlined from '@mui/icons-material/SavingsOutlined'
import {
  Alert,
  Avatar,
  Box,
  Card,
  CardActionArea,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { useEffect, useState, type ReactNode } from 'react'
import { alpha } from '@mui/material/styles'
import { Link as RouterLink } from 'react-router-dom'
import { StatTile } from '../components/DashboardUi'
import { useDashboard } from '../dashboard/context'
import {
  CONSOLE_ACCESS_ROLES,
  PERFORMANCE_VIEW_ROLES,
  type OwnerPortalSnapshot,
  type TenantPortalSnapshot,
} from '../dashboard/types'
import { readApiErrorMessage } from '../lib/apiError'
import { authHeaders } from '../lib/auth'

type NavCardDef = {
  to: string
  title: string
  description: string
  icon: ReactNode
}

const NAV_CARDS: NavCardDef[] = [
  {
    to: '/organizations',
    title: 'Organizations',
    description: 'Tenant scope, currency, and user counts',
    icon: <DnsOutlined />,
  },
  {
    to: '/portfolios',
    title: 'Portfolios',
    description: 'Portfolios plus buildings, floors, and units',
    icon: <ApartmentOutlined />,
  },
  {
    to: '/tenants',
    title: 'Tenants',
    description: 'Lessee CRUD, contacts, and lease counts',
    icon: <PeopleOutlineOutlined />,
  },
  {
    to: '/leases',
    title: 'Leases',
    description: 'Agreements, units, and lifecycle',
    icon: <AssignmentOutlined />,
  },
  {
    to: '/billing/schedules',
    title: 'Charge schedules',
    description: 'Recurring rent, CAM, and other charges',
    icon: <ScheduleOutlined />,
  },
  {
    to: '/billing/invoices',
    title: 'Invoices',
    description: 'Draft, generate, issue to sub-ledger',
    icon: <ReceiptLongOutlined />,
  },
  {
    to: '/billing/ledger',
    title: 'Sub-ledger',
    description: 'Immutable lines and CSV export',
    icon: <SavingsOutlined />,
  },
]
const FACILITIES_ALLOWED = new Set(['/portfolios', '/leases'])
const READ_ONLY_ALLOWED = new Set([
  '/organizations',
  '/portfolios',
  '/tenants',
  '/leases',
  '/billing/schedules',
  '/billing/invoices',
  '/billing/ledger',
])

export function DashboardHome() {
  const {
    token,
    me,
    health,
    healthErr,
    orgs,
    orgsErr,
    portfolios,
    portfoliosErr,
    dashboardMetrics,
    dashboardMetricsErr,
  } = useDashboard()
  const canAccessConsole = me != null && CONSOLE_ACCESS_ROLES.has(me.role)
  const canViewPerformance = me != null && PERFORMANCE_VIEW_ROLES.has(me.role)
  const role = me?.role
  const navCards = NAV_CARDS.filter((c) => {
    if (!canAccessConsole) return false
    if (c.to === '/performance') return canViewPerformance
    if (role === 'FACILITIES_MANAGER') return FACILITIES_ALLOWED.has(c.to)
    if (role === 'READ_ONLY') return READ_ONLY_ALLOWED.has(c.to)
    return true
  })
  const isTenantUser = me?.role === 'TENANT_USER'
  const isOwnerUser = me?.role === 'OWNER_USER'
  const [tenantSnap, setTenantSnap] = useState<TenantPortalSnapshot | null>(null)
  const [tenantErr, setTenantErr] = useState<string | null>(null)
  const [tenantLoading, setTenantLoading] = useState(false)
  const [ownerSnap, setOwnerSnap] = useState<OwnerPortalSnapshot | null>(null)
  const [ownerErr, setOwnerErr] = useState<string | null>(null)
  const [ownerLoading, setOwnerLoading] = useState(false)

  useEffect(() => {
    if (!isTenantUser || !token) {
      setTenantSnap(null)
      setTenantErr(null)
      setTenantLoading(false)
      return
    }
    let cancelled = false
    setTenantLoading(true)
    setTenantErr(null)
    fetch(apiUrl('/api/v1/dashboard/tenant-portal'), { headers: authHeaders(token) })
      .then(async (r) => {
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
        return r.json() as Promise<TenantPortalSnapshot>
      })
      .then((data) => {
        if (!cancelled) setTenantSnap(data)
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setTenantErr(e.message)
          setTenantSnap(null)
        }
      })
      .finally(() => {
        if (!cancelled) setTenantLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isTenantUser, token])

  useEffect(() => {
    if (!isOwnerUser || !token) {
      setOwnerSnap(null)
      setOwnerErr(null)
      setOwnerLoading(false)
      return
    }
    let cancelled = false
    setOwnerLoading(true)
    setOwnerErr(null)
    fetch(apiUrl('/api/v1/dashboard/owner-portal'), { headers: authHeaders(token) })
      .then(async (r) => {
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
        return r.json() as Promise<OwnerPortalSnapshot>
      })
      .then((data) => {
        if (!cancelled) setOwnerSnap(data)
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setOwnerErr(e.message)
          setOwnerSnap(null)
        }
      })
      .finally(() => {
        if (!cancelled) setOwnerLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isOwnerUser, token])

  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={800} letterSpacing="-0.03em" gutterBottom>
          Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Signed in as <strong>{me?.email}</strong>
          {me?.displayName && (
            <>
              {' '}
              · {me.displayName}
            </>
          )}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Open any area below — each card goes to its own page.
        </Typography>
      </Box>
      {isTenantUser ? (
        <Stack spacing={2}>
          <Alert severity="info" variant="outlined">
            Tenant portal view for organization{' '}
            <strong>{me.organizationName ?? me.organizationSlug ?? me.organizationId}</strong>.
          </Alert>
          {tenantErr ? (
            <Alert severity="warning" variant="outlined">
              {tenantErr}
            </Alert>
          ) : null}
          {tenantLoading ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                Loading your tenant dashboard…
              </Typography>
            </Stack>
          ) : null}
          {tenantSnap && !tenantSnap.linkedTenant ? (
            <Alert severity="warning" variant="outlined">
              Your login is not yet linked to a tenant profile. If your organization has one tenant, linking is automatic; otherwise ask your org admin to set your email as the tenant contact email.
            </Alert>
          ) : null}
          {tenantSnap && tenantSnap.linkedTenant ? (
            <>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} useFlexGap flexWrap="wrap">
                <StatTile
                  label="Active leases"
                  value={tenantSnap.leaseSummary.activeLeases}
                  icon={<AssignmentOutlined fontSize="small" />}
                />
                <StatTile
                  label="Expiring leases"
                  value={tenantSnap.leaseSummary.expiringLeases}
                  icon={<ScheduleOutlined fontSize="small" />}
                />
                <StatTile
                  label="Statement balance"
                  value={tenantSnap.statement.balance.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                  icon={<SavingsOutlined fontSize="small" />}
                />
              </Stack>
              <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 2 }}>
                <Typography variant="subtitle1" fontWeight={700}>
                  Tenant profile
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {tenantSnap.tenant?.tradingName ?? tenantSnap.tenant?.legalName ?? '—'}
                </Typography>
                <Divider sx={{ my: 1.5 }} />
                <Typography variant="body2">
                  Contact email: {tenantSnap.tenant?.contactEmail ?? '—'}
                </Typography>
                <Typography variant="body2">
                  Contact phone: {tenantSnap.tenant?.contactPhone ?? '—'}
                </Typography>
              </Card>
              <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 2 }}>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                  Recent invoices
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Period</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {tenantSnap.recentInvoices.map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell>
                            {new Date(inv.periodStart).toLocaleDateString()} - {new Date(inv.periodEnd).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Chip size="small" variant="outlined" label={inv.status.replace(/_/g, ' ')} />
                          </TableCell>
                          <TableCell align="right">
                            {inv.totalAmount.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}
                          </TableCell>
                        </TableRow>
                      ))}
                      {tenantSnap.recentInvoices.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3}>No invoices yet.</TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Card>
            </>
          ) : null}
        </Stack>
      ) : null}
      {isOwnerUser ? (
        <Stack spacing={2}>
          <Alert severity="info" variant="outlined">
            Owner portal view for organization{' '}
            <strong>{me.organizationName ?? me.organizationSlug ?? me.organizationId}</strong>.
          </Alert>
          {ownerErr ? (
            <Alert severity="warning" variant="outlined">
              {ownerErr}
            </Alert>
          ) : null}
          {ownerLoading ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                Loading owner dashboard…
              </Typography>
            </Stack>
          ) : null}
          {ownerSnap ? (
            <>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} useFlexGap flexWrap="wrap">
                <StatTile label="Portfolios" value={ownerSnap.properties.portfolios} icon={<ApartmentOutlined fontSize="small" />} />
                <StatTile label="Buildings" value={ownerSnap.properties.buildings} icon={<BusinessOutlined fontSize="small" />} />
                <StatTile label="Units" value={ownerSnap.properties.units} icon={<DnsOutlined fontSize="small" />} />
                <StatTile label="Active leases" value={ownerSnap.occupancy.activeLeases} icon={<AssignmentOutlined fontSize="small" />} />
                <StatTile
                  label="Ledger balance"
                  value={ownerSnap.finance.ledgerBalance.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                  icon={<SavingsOutlined fontSize="small" />}
                />
              </Stack>
              <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 2 }}>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                  Recent invoices
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Period</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {ownerSnap.recentInvoices.map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell>
                            {new Date(inv.periodStart).toLocaleDateString()} - {new Date(inv.periodEnd).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Chip size="small" variant="outlined" label={inv.status.replace(/_/g, ' ')} />
                          </TableCell>
                          <TableCell align="right">
                            {inv.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Card>
            </>
          ) : null}
        </Stack>
      ) : null}
      {isTenantUser || isOwnerUser ? null : (
        <>
      {(role === 'FACILITIES_MANAGER' || role === 'READ_ONLY') ? (
        <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
          {role === 'FACILITIES_MANAGER'
            ? 'Facilities manager view: quick access to property structure and lease visibility.'
            : 'Read-only view: browse data across modules without write actions.'}
        </Alert>
      ) : null}

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <StatTile
          label="API"
          value={healthErr ? 'Offline' : health ? 'Healthy' : '…'}
          icon={
            healthErr ? (
              <CloudOffOutlined fontSize="small" />
            ) : (
              <CloudDoneOutlined fontSize="small" />
            )
          }
          loading={!health && !healthErr}
          state={healthErr ? 'error' : health ? 'success' : 'default'}
        />
        <StatTile
          label="Organizations"
          value={orgs?.length ?? '—'}
          icon={<DnsOutlined fontSize="small" />}
          loading={orgs === null && !orgsErr}
        />
        <StatTile
          label="Portfolios"
          value={portfolios?.length ?? '—'}
          icon={<BusinessOutlined fontSize="small" />}
          loading={portfolios === null && !portfoliosErr}
        />
      </Stack>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        flexWrap="wrap"
        useFlexGap
        sx={{ mb: 4 }}
      >
        <StatTile
          label="Tenants"
          value={dashboardMetrics?.tenants ?? '—'}
          icon={<PeopleOutlineOutlined fontSize="small" />}
          loading={dashboardMetrics === null && !dashboardMetricsErr}
        />
        <StatTile
          label="Leases"
          value={dashboardMetrics?.leases ?? '—'}
          icon={<AssignmentOutlined fontSize="small" />}
          loading={dashboardMetrics === null && !dashboardMetricsErr}
        />
        <StatTile
          label="Invoices"
          value={dashboardMetrics?.invoices ?? '—'}
          icon={<ReceiptLongOutlined fontSize="small" />}
          loading={dashboardMetrics === null && !dashboardMetricsErr}
        />
        <StatTile
          label="Ledger lines"
          value={dashboardMetrics?.ledgerLines ?? '—'}
          icon={<SavingsOutlined fontSize="small" />}
          loading={dashboardMetrics === null && !dashboardMetricsErr}
        />
      </Stack>

      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, letterSpacing: '0.08em' }}>
        MODULES
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
          },
        }}
      >
        {navCards.map((c) => (
          <Card
            key={c.to}
            elevation={0}
            sx={{
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              '&:hover': {
                boxShadow: '0 12px 32px rgba(15, 23, 42, 0.1)',
                transform: 'translateY(-2px)',
              },
            }}
          >
            <CardActionArea
              component={RouterLink}
              to={c.to}
              sx={{ alignItems: 'stretch', p: 0 }}
            >
              <Stack direction="row" spacing={2} sx={{ p: 2.5, width: '100%' }}>
                <Avatar
                  variant="rounded"
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
                    color: 'primary.main',
                  }}
                >
                  {c.icon}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    {c.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {c.description}
                  </Typography>
                </Box>
                <ChevronRightOutlined sx={{ color: 'text.disabled', alignSelf: 'center' }} />
              </Stack>
            </CardActionArea>
          </Card>
        ))}
      </Box>
        </>
      )}
    </>
  )
}
