import AddOutlined from '@mui/icons-material/AddOutlined'
import PersonOutlineOutlined from '@mui/icons-material/PersonOutlineOutlined'
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined'
import ApartmentOutlined from '@mui/icons-material/ApartmentOutlined'
import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined'
import DragIndicatorOutlined from '@mui/icons-material/DragIndicatorOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import AssignmentOutlined from '@mui/icons-material/AssignmentOutlined'
import DnsOutlined from '@mui/icons-material/DnsOutlined'
import PeopleOutlineOutlined from '@mui/icons-material/PeopleOutlineOutlined'
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined'
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined'
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined'
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import SavingsOutlined from '@mui/icons-material/SavingsOutlined'
import LeaderboardOutlined from '@mui/icons-material/LeaderboardOutlined'
import VerifiedUserOutlined from '@mui/icons-material/VerifiedUserOutlined'
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined'
import SendOutlined from '@mui/icons-material/SendOutlined'
import Autocomplete from '@mui/material/Autocomplete'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import type { ChipProps } from '@mui/material'
import {
  Link as RouterLink,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import {
  invoiceStatusChipColor,
  leaseStatusChipColor,
  sectionCardHeaderOutlinedSx,
  SectionCard,
  StatTile,
} from '../components/DashboardUi'
import { LeaseAsyncPicker } from '../components/LeaseAsyncPicker'
import { TenantAsyncPicker } from '../components/TenantAsyncPicker'
import { useDashboard } from '../dashboard/context'
import type {
  BillingInvoiceDetailRow,
  BillingInvoiceRow,
  ChargeScheduleRow,
  DashboardOrgStaffResponse,
  OrgStaffUserRow,
  PerformanceReport,
  ProfileMetrics,
  InvoiceActivityRow,
  InvoicePaymentRow,
  LeaseRow,
  LedgerEntryRow,
  OrganizationRow,
  OrganizationUserRow,
  PortfolioRow,
  TenantRow,
} from '../dashboard/types'
import { PERFORMANCE_VIEW_ROLES } from '../dashboard/types'
import { readApiErrorMessage } from '../lib/apiError'
import { apiUrl } from '../lib/api'
import { authHeaders } from '../lib/auth'
import { downloadPdfFromResponse } from '../lib/downloadPdf'
import { LeaseUnitCascadeFields } from './LeaseUnitCascadeFields'
import { PropertyHierarchyPanel } from './PropertyHierarchyPanel'
import { usePropertyUnitCascade } from './usePropertyUnitCascade'

const LEASE_CREATE_STATUSES = [
  'DRAFT',
  'UNDER_REVIEW',
  'APPROVED',
  'ACTIVE',
  'EXPIRING',
  'RENEWED',
  'TERMINATED',
] as const

const CHARGE_SCHEDULE_KINDS = ['RENT', 'CAM', 'PARKING', 'OTHER'] as const
const CHARGE_SCHEDULE_FREQUENCIES = ['MONTHLY', 'QUARTERLY', 'ANNUAL'] as const

type ChargeScheduleVisibility = 'all' | 'active' | 'inactive'

const INVOICE_FILTER_STATUSES = ['DRAFT', 'ISSUED', 'VOID'] as const

const LEDGER_FILTER_SOURCES = ['INVOICE', 'PAYMENT', 'ADJUSTMENT'] as const
const MANUAL_LEDGER_SOURCES = ['PAYMENT', 'ADJUSTMENT'] as const
const USER_ROLES = [
  'SUPER_ADMIN',
  'ORG_ADMIN',
  'PORTFOLIO_MANAGER',
  'FINANCE',
  'FACILITIES_MANAGER',
  'READ_ONLY',
  'OWNER_USER',
  'TENANT_USER',
] as const

function invoiceTenantLabel(row: BillingInvoiceRow) {
  if (!row.tenant) return '—'
  return row.tenant.tradingName ?? row.tenant.legalName
}

function ledgerTenantLabel(row: LedgerEntryRow) {
  if (!row.tenant) return '—'
  return row.tenant.tradingName ?? row.tenant.legalName
}

function leaseDateToInputValue(iso: string): string {
  if (iso.length >= 10 && iso[4] === '-' && iso[7] === '-') {
    return iso.slice(0, 10)
  }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function chargeScheduleOptionLabel(c: ChargeScheduleRow): string {
  const lab = (c.label ?? '').trim()
  const name = lab.length > 0 ? lab : c.kind
  return `${c.kind} — ${name} (${c.currency} ${Number(c.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })})`
}

function formatLeaseUnitCell(lu: LeaseRow['leaseUnits'][number]): string {
  const code = lu.unit.code
  const raw = lu.percentageAllocated
  if (raw === undefined || raw === null || raw === '') return code
  const n = typeof raw === 'string' ? parseFloat(raw) : Number(raw)
  if (!Number.isFinite(n) || Math.abs(n - 100) < 0.0001) return code
  const rounded =
    Math.abs(n - Math.round(n)) < 1e-4 ? String(Math.round(n)) : String(n)
  return `${code} (${rounded}%)`
}

function initialEditUnitPcts(l: LeaseRow): Record<string, string> {
  const p: Record<string, string> = {}
  for (const lu of l.leaseUnits) {
    const raw = lu.percentageAllocated
    if (raw === undefined || raw === null || raw === '') {
      p[lu.unit.id] = '100'
    } else {
      const n = typeof raw === 'string' ? parseFloat(raw) : Number(raw)
      p[lu.unit.id] = Number.isFinite(n) ? String(n) : '100'
    }
  }
  return p
}

function leaseNotesFromTerms(terms: unknown): string {
  if (terms == null || typeof terms !== 'object' || Array.isArray(terms)) {
    return ''
  }
  const n = (terms as Record<string, unknown>).notes
  return typeof n === 'string' ? n : ''
}

function mergeLeaseTermsForPatch(
  existing: unknown,
  notes: string,
): Record<string, unknown> {
  const base =
    existing != null && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {}
  const t = notes.trim()
  if (t) base.notes = t
  else delete base.notes
  return base
}

function orgStaffOptionLabel(u: OrgStaffUserRow): string {
  const name = u.displayName?.trim()
  return name ? `${name} (${u.email})` : u.email
}

function leaseTermsDisplayBlock(terms: unknown): string {
  const notes = leaseNotesFromTerms(terms)
  if (notes) return notes
  if (terms != null && typeof terms === 'object' && !Array.isArray(terms)) {
    const o = terms as Record<string, unknown>
    if (Object.keys(o).length === 0) return ''
    return JSON.stringify(terms, null, 2)
  }
  return ''
}

function LeaseViewDialogBody({
  lease,
  onNavigateBilling,
}: {
  lease: LeaseRow
  onNavigateBilling: () => void
}) {
  const termsBlock = leaseTermsDisplayBlock(lease.terms)
  return (
    <Stack spacing={2} sx={{ pt: 0.5 }}>
      <Typography fontWeight={700}>
        {lease.tenant.tradingName ?? lease.tenant.legalName}
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Chip
          size="small"
          label={lease.status.replace(/_/g, ' ')}
          color={leaseStatusChipColor(lease.status)}
          variant="outlined"
        />
        <Typography variant="body2" color="text.secondary">
          {new Date(lease.startDate).toLocaleDateString()} —{' '}
          {new Date(lease.endDate).toLocaleDateString()}
        </Typography>
      </Stack>
      <Typography variant="body2">
        <strong>Units:</strong>{' '}
        {lease.leaseUnits.map(formatLeaseUnitCell).join(', ') || '—'}
      </Typography>
      <Typography variant="body2">
        <strong>Collection broker:</strong>{' '}
        {lease.brokerUser
          ? lease.brokerUser.displayName?.trim() || lease.brokerUser.email
          : '—'}
      </Typography>
      {termsBlock ? (
        <Box>
          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            sx={{ mb: 0.5 }}
          >
            Notes / terms
          </Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {termsBlock}
          </Typography>
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary">
          No notes.
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary">
        Open billing with this lease selected
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button
          component={RouterLink}
          to={`/billing/schedules?leaseId=${lease.id}`}
          variant="outlined"
          size="small"
          onClick={onNavigateBilling}
        >
          Charge schedules
        </Button>
        <Button
          component={RouterLink}
          to={`/billing/invoices?leaseId=${lease.id}`}
          variant="outlined"
          size="small"
          onClick={onNavigateBilling}
        >
          Invoices
        </Button>
        <Button
          component={RouterLink}
          to={`/billing/ledger?leaseId=${lease.id}`}
          variant="outlined"
          size="small"
          onClick={onNavigateBilling}
        >
          Ledger
        </Button>
      </Stack>
    </Stack>
  )
}

function PageHeader({ title }: { title: string }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Button component={RouterLink} to="/" color="primary" sx={{ mb: 1, px: 0 }}>
        ← Back to dashboard
      </Button>
      <Typography variant="h4" fontWeight={800} letterSpacing="-0.03em">
        {title}
      </Typography>
    </Box>
  )
}

export function MyProfilePage() {
  const { token, me, signOut } = useDashboard()
  const [metrics, setMetrics] = useState<ProfileMetrics | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [trendMetric, setTrendMetric] = useState<'score' | 'recovered'>('score')

  const reload = useCallback(() => {
    if (!token) return
    setLoading(true)
    setErr(null)
    fetch(apiUrl('/api/v1/dashboard/profile-metrics'), { headers: authHeaders(token) })
      .then(async (r) => {
        if (r.status === 401) {
          signOut()
          throw new Error('Session expired')
        }
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
        return r.json() as Promise<ProfileMetrics>
      })
      .then((data) => setMetrics(data))
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false))
  }, [token, signOut])

  useEffect(() => {
    reload()
  }, [reload])

  const scoreTrendPoints = useMemo(() => {
    const trend = metrics?.trend ?? []
    if (trend.length === 0) return ''
    const w = 520
    const h = 160
    const pad = 16
    const maxX = Math.max(1, trend.length - 1)
    const maxRecovered = Math.max(1, ...trend.map((m) => m.netRecovered))
    return trend
      .map((m, i) => {
        const x = pad + (i / maxX) * (w - pad * 2)
        const v =
          trendMetric === 'score'
            ? Math.max(0, Math.min(100, m.collectionScore))
            : Math.max(0, m.netRecovered)
        const normalized = trendMetric === 'score' ? v / 100 : v / maxRecovered
        const y = h - pad - normalized * (h - pad * 2)
        return `${x},${y}`
      })
      .join(' ')
  }, [metrics?.trend, trendMetric])

  return (
    <>
      <PageHeader title="My profile" />
      <SectionCard
        title="User details"
        subtitle="Signed-in identity and current role."
        icon={<PersonOutlineOutlined />}
      >
        <Stack spacing={1}>
          <Typography variant="body2">
            <strong>Name:</strong> {me?.displayName ?? '—'}
          </Typography>
          <Typography variant="body2">
            <strong>Email:</strong> {me?.email ?? '—'}
          </Typography>
          <Typography variant="body2">
            <strong>Role:</strong> {me?.role?.replace(/_/g, ' ') ?? '—'}
          </Typography>
        </Stack>
      </SectionCard>

      <Box sx={{ mt: 2 }}>
        <SectionCard
          title="Performance tracking"
          subtitle="Tenant payment honesty and recovery KPIs scoped to your organization visibility."
          icon={<VerifiedUserOutlined />}
        >
          {err ? (
            <Alert severity="warning" variant="outlined" sx={{ mb: 2 }}>
              {err}
            </Alert>
          ) : null}
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} useFlexGap flexWrap="wrap">
            <StatTile
              label="Collection score"
              value={
                metrics
                  ? `${metrics.collectionScore.toLocaleString(undefined, {
                      maximumFractionDigits: 1,
                    })}/100`
                  : '—'
              }
              icon={<VerifiedUserOutlined fontSize="small" />}
              loading={loading}
              state={
                !metrics
                  ? 'default'
                  : metrics.collectionScore >= 75
                    ? 'success'
                    : metrics.collectionScore < 50
                      ? 'error'
                      : 'default'
              }
            />
            <StatTile
              label="Tenant honesty rate"
              value={
                metrics?.tenantHonesty.rate == null
                  ? '—'
                  : `${(metrics.tenantHonesty.rate * 100).toLocaleString(undefined, {
                      maximumFractionDigits: 1,
                    })}%`
              }
              icon={<PeopleOutlineOutlined fontSize="small" />}
              loading={loading}
            />
            <StatTile
              label="Net recovered"
              value={
                metrics
                  ? metrics.recovery.netRecovered.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })
                  : '—'
              }
              icon={<SavingsOutlined fontSize="small" />}
              loading={loading}
            />
          </Stack>
          {metrics ? (
            <Stack spacing={0.5} sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Due invoices: {metrics.tenantHonesty.dueInvoices} · On-time paid:{' '}
                {metrics.tenantHonesty.onTimeInvoices}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Payment entries: {metrics.recovery.paymentsCount} · Reversals:{' '}
                {metrics.recovery.reversalsCount}
              </Typography>
            </Stack>
          ) : null}
          <Box sx={{ mt: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="subtitle2">
              Progress (last 6 months)
              </Typography>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={trendMetric}
                onChange={(_, v: 'score' | 'recovered' | null) => {
                  if (v) setTrendMetric(v)
                }}
              >
                <ToggleButton value="score">Collection score</ToggleButton>
                <ToggleButton value="recovered">Net recovered</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
            {metrics && metrics.trend.length > 0 ? (
              <>
                <Box
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 2,
                    p: 1,
                    bgcolor: 'background.paper',
                  }}
                >
                  <svg viewBox="0 0 520 160" width="100%" height={160}>
                    <line x1="16" y1="144" x2="504" y2="144" stroke="#cbd5e1" strokeWidth="1" />
                    <line x1="16" y1="16" x2="16" y2="144" stroke="#cbd5e1" strokeWidth="1" />
                    <polyline
                      points={scoreTrendPoints}
                      fill="none"
                      stroke={trendMetric === 'score' ? '#2563eb' : '#0d9488'}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Box>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                  {metrics.trend.map((m) => (
                    <Chip
                      key={m.label}
                      size="small"
                      variant="outlined"
                      label={
                        trendMetric === 'score'
                          ? `${m.label}: ${m.collectionScore.toLocaleString(undefined, {
                              maximumFractionDigits: 1,
                            })}`
                          : `${m.label}: ${m.netRecovered.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}`
                      }
                    />
                  ))}
                </Stack>
              </>
            ) : (
              <Typography color="text.secondary">No trend data yet.</Typography>
            )}
          </Box>
        </SectionCard>
      </Box>
    </>
  )
}

export function PerformancePage() {
  const { token, me, signOut } = useDashboard()
  const [report, setReport] = useState<PerformanceReport | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const allowed = me != null && PERFORMANCE_VIEW_ROLES.has(me.role)

  const reload = useCallback(() => {
    if (!token || !allowed) return
    setLoading(true)
    setErr(null)
    fetch(apiUrl('/api/v1/dashboard/performance'), { headers: authHeaders(token) })
      .then(async (r) => {
        if (r.status === 401) {
          signOut()
          throw new Error('Session expired')
        }
        if (r.status === 403) {
          throw new Error('You do not have access to the performance dashboard.')
        }
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
        return r.json() as Promise<PerformanceReport>
      })
      .then((data) => setReport(data))
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false))
  }, [token, signOut, allowed])

  useEffect(() => {
    reload()
  }, [reload])

  if (!allowed) {
    return (
      <>
        <PageHeader title="Performance" />
        <Alert severity="info" variant="outlined">
          This view is available to executive and finance roles (org admin, finance, portfolio
          manager, or platform super admin).
        </Alert>
      </>
    )
  }

  const showOrgCol = me?.role === 'SUPER_ADMIN'

  return (
    <>
      <PageHeader title="Performance" />
      <SectionCard
        title="Organization leaderboard"
        subtitle="Tenants ranked by collection score (on-time invoice payment vs recovery efficiency), scoped to your visibility."
        icon={<LeaderboardOutlined />}
      >
        {err ? (
          <Alert severity="warning" variant="outlined" sx={{ mb: 2 }}>
            {err}
          </Alert>
        ) : null}
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} useFlexGap flexWrap="wrap">
          <StatTile
            label="Tenants"
            value={report ? String(report.summary.tenants) : '—'}
            icon={<PeopleOutlineOutlined fontSize="small" />}
            loading={loading}
          />
          <StatTile
            label="Avg honesty (tenants with due invoices)"
            value={
              report?.summary.avgHonestyRate == null
                ? '—'
                : `${(report.summary.avgHonestyRate * 100).toLocaleString(undefined, {
                    maximumFractionDigits: 1,
                  })}%`
            }
            icon={<VerifiedUserOutlined fontSize="small" />}
            loading={loading}
          />
          <StatTile
            label="Total net recovered"
            value={
              report
                ? report.summary.totalNetRecovered.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })
                : '—'
            }
            icon={<SavingsOutlined fontSize="small" />}
            loading={loading}
          />
          <StatTile
            label="Avg collection score"
            value={
              report
                ? `${report.summary.avgCollectionScore.toLocaleString(undefined, {
                    maximumFractionDigits: 1,
                  })}/100`
                : '—'
            }
            icon={<LeaderboardOutlined fontSize="small" />}
            loading={loading}
          />
        </Stack>

        <TableContainer sx={{ mt: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                {showOrgCol ? <TableCell>Organization</TableCell> : null}
                <TableCell>Tenant</TableCell>
                <TableCell align="right">Due inv.</TableCell>
                <TableCell align="right">On-time</TableCell>
                <TableCell align="right">Honesty</TableCell>
                <TableCell align="right">Net recovered</TableCell>
                <TableCell align="right">Score</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && !report ? (
                <TableRow>
                  <TableCell colSpan={showOrgCol ? 8 : 7}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 2 }}>
                      <CircularProgress size={22} />
                      <Typography variant="body2" color="text.secondary">
                        Loading…
                      </Typography>
                    </Stack>
                  </TableCell>
                </TableRow>
              ) : null}
              {report?.tenantLeaderboard.map((row, i) => (
                <TableRow key={row.tenantId} hover>
                  <TableCell>{i + 1}</TableCell>
                  {showOrgCol ? (
                    <TableCell>{row.organizationName ?? row.organizationId ?? '—'}</TableCell>
                  ) : null}
                  <TableCell>
                    <Button
                      component={RouterLink}
                      to={`/billing/invoices?tenantId=${row.tenantId}`}
                      size="small"
                      sx={{ textTransform: 'none', p: 0, minWidth: 0, fontWeight: 600 }}
                    >
                      {row.tenantName}
                    </Button>
                  </TableCell>
                  <TableCell align="right">{row.dueInvoices}</TableCell>
                  <TableCell align="right">{row.onTimeInvoices}</TableCell>
                  <TableCell align="right">
                    {row.honestyRate == null
                      ? '—'
                      : `${(row.honestyRate * 100).toLocaleString(undefined, {
                          maximumFractionDigits: 1,
                        })}%`}
                  </TableCell>
                  <TableCell align="right">
                    {row.netRecovered.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell align="right">
                    {row.collectionScore.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  </TableCell>
                </TableRow>
              ))}
              {report && report.tenantLeaderboard.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={showOrgCol ? 8 : 7}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                      No tenants in scope.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </TableContainer>
      </SectionCard>

      <Box sx={{ mt: 3 }}>
        <SectionCard
          title="Staff leaderboard"
          subtitle="Metrics roll up to the collection broker assigned on each lease (same honesty and recovery rules as tenants)."
          icon={<PersonOutlineOutlined />}
        >
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {report?.employeeNote}
          </Typography>
          <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  {showOrgCol ? <TableCell>Organization</TableCell> : null}
                  <TableCell>User</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell align="right">Leases</TableCell>
                  <TableCell align="right">Due inv.</TableCell>
                  <TableCell align="right">On-time</TableCell>
                  <TableCell align="right">Honesty</TableCell>
                  <TableCell align="right">Net recovered</TableCell>
                  <TableCell align="right">Score</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(report?.staffLeaderboard ?? []).map((row, i) => (
                  <TableRow key={row.userId} hover>
                    <TableCell>{i + 1}</TableCell>
                    {showOrgCol ? (
                      <TableCell>{row.organizationName ?? row.organizationId ?? '—'}</TableCell>
                    ) : null}
                    <TableCell>
                      <Typography fontWeight={600} variant="body2">
                        {row.displayName?.trim() || row.email}
                      </Typography>
                      {row.displayName?.trim() ? (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {row.email}
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell sx={{ textTransform: 'capitalize' }}>
                      {row.role.replace(/_/g, ' ')}
                    </TableCell>
                    <TableCell align="right">{row.assignedLeases}</TableCell>
                    <TableCell align="right">{row.dueInvoices}</TableCell>
                    <TableCell align="right">{row.onTimeInvoices}</TableCell>
                    <TableCell align="right">
                      {row.honestyRate == null
                        ? '—'
                        : `${(row.honestyRate * 100).toLocaleString(undefined, {
                            maximumFractionDigits: 1,
                          })}%`}
                    </TableCell>
                    <TableCell align="right">
                      {row.netRecovered.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell align="right">
                      {row.collectionScore.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                    </TableCell>
                  </TableRow>
                ))}
                {report && (report.staffLeaderboard ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={showOrgCol ? 10 : 9}>
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        No staff in scope.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TableContainer>
        </SectionCard>
      </Box>
    </>
  )
}

export function OrganizationsPage() {
  const {
    token,
    me,
    signOut,
    orgs,
    orgsErr,
    reloadOrganizations,
    reloadDashboardMetrics,
  } = useDashboard()
  const [createName, setCreateName] = useState('')
  const [createSlug, setCreateSlug] = useState('')
  const [createCurrency, setCreateCurrency] = useState('ZAR')
  const [createTimezone, setCreateTimezone] = useState('Africa/Johannesburg')
  const [createSaving, setCreateSaving] = useState(false)
  const [createErr, setCreateErr] = useState<string | null>(null)
  const isSuperAdmin = me?.role === 'SUPER_ADMIN'
  const canEditInvoiceProfile = me?.role === 'SUPER_ADMIN' || me?.role === 'ORG_ADMIN'
  const [editingOrgProfile, setEditingOrgProfile] = useState<OrganizationRow | null>(null)
  const [orgProfileLegalName, setOrgProfileLegalName] = useState('')
  const [orgProfileTaxNumber, setOrgProfileTaxNumber] = useState('')
  const [orgProfileAddress, setOrgProfileAddress] = useState('')
  const [orgProfilePhone, setOrgProfilePhone] = useState('')
  const [orgProfileEmail, setOrgProfileEmail] = useState('')
  const [orgProfileBankDetails, setOrgProfileBankDetails] = useState('')
  const [orgProfilePaymentInstructions, setOrgProfilePaymentInstructions] = useState('')
  const [orgProfileLogoUrl, setOrgProfileLogoUrl] = useState('')
  const [orgProfileFocusField, setOrgProfileFocusField] = useState<
    | 'legalName'
    | 'taxNumber'
    | 'address'
    | 'phone'
    | 'email'
    | 'bankDetails'
    | 'paymentInstructions'
    | 'logoUrl'
    | null
  >(null)
  const [orgProfileSaving, setOrgProfileSaving] = useState(false)
  const [orgProfileErr, setOrgProfileErr] = useState<string | null>(null)
  const canManageUsers = me?.role === 'SUPER_ADMIN' || me?.role === 'ORG_ADMIN'
  const [userOrgId, setUserOrgId] = useState('')
  const [orgUsers, setOrgUsers] = useState<OrganizationUserRow[] | null>(null)
  const [orgUsersErr, setOrgUsersErr] = useState<string | null>(null)
  const [orgUsersLoading, setOrgUsersLoading] = useState(false)
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserDisplayName, setNewUserDisplayName] = useState('')
  const [newUserRole, setNewUserRole] = useState<string>('READ_ONLY')
  const [newUserPassword, setNewUserPassword] = useState('demo123')
  const [newUserInviteOnly, setNewUserInviteOnly] = useState(false)
  const [newUserSaving, setNewUserSaving] = useState(false)
  const [newUserErr, setNewUserErr] = useState<string | null>(null)
  const [editingUser, setEditingUser] = useState<OrganizationUserRow | null>(null)
  const [editUserEmail, setEditUserEmail] = useState('')
  const [editUserDisplayName, setEditUserDisplayName] = useState('')
  const [editUserRole, setEditUserRole] = useState('')
  const [editUserPassword, setEditUserPassword] = useState('')
  const [editUserSaving, setEditUserSaving] = useState(false)
  const [editUserErr, setEditUserErr] = useState<string | null>(null)
  const [deleteUserErr, setDeleteUserErr] = useState<string | null>(null)

  const invoiceProfileCompleteness = (o: OrganizationRow) => {
    const p = o.settings?.invoiceProfile
    if (!p) return { done: 0, total: 7 }
    const fields = [
      p.legalName,
      p.taxNumber,
      p.address,
      p.phone,
      p.email,
      p.bankDetails,
      p.paymentInstructions,
    ]
    const done = fields.filter((v) => typeof v === 'string' && v.trim().length > 0).length
    return { done, total: fields.length }
  }

  const submitCreateOrg = (e: FormEvent) => {
    e.preventDefault()
    if (!token || !isSuperAdmin) return
    const name = createName.trim()
    if (!name) {
      setCreateErr('Name is required.')
      return
    }
    setCreateErr(null)
    setCreateSaving(true)
    const body: Record<string, string> = { name }
    const slug = createSlug.trim()
    if (slug) body.slug = slug
    const cur = createCurrency.trim().toUpperCase()
    if (cur.length === 3) body.baseCurrency = cur
    const tz = createTimezone.trim()
    if (tz) body.timezone = tz
    fetch(apiUrl('/api/v1/organizations'), {
      method: 'POST',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
      })
      .then(() => {
        setCreateName('')
        setCreateSlug('')
        setCreateCurrency('ZAR')
        setCreateTimezone('Africa/Johannesburg')
        reloadOrganizations()
        reloadDashboardMetrics()
      })
      .catch((err: Error) => setCreateErr(err.message))
      .finally(() => setCreateSaving(false))
  }

  const openEditOrgProfile = (o: OrganizationRow) => {
    setEditingOrgProfile(o)
    const p = o.settings?.invoiceProfile
    setOrgProfileLegalName(p?.legalName ?? '')
    setOrgProfileTaxNumber(p?.taxNumber ?? '')
    setOrgProfileAddress(p?.address ?? '')
    setOrgProfilePhone(p?.phone ?? '')
    setOrgProfileEmail(p?.email ?? '')
    setOrgProfileBankDetails(p?.bankDetails ?? '')
    setOrgProfilePaymentInstructions(p?.paymentInstructions ?? '')
    setOrgProfileLogoUrl(p?.logoUrl ?? '')
    const missing: Array<
      | 'legalName'
      | 'taxNumber'
      | 'address'
      | 'phone'
      | 'email'
      | 'bankDetails'
      | 'paymentInstructions'
      | 'logoUrl'
    > = []
    if (!(p?.legalName && p.legalName.trim())) missing.push('legalName')
    if (!(p?.taxNumber && p.taxNumber.trim())) missing.push('taxNumber')
    if (!(p?.address && p.address.trim())) missing.push('address')
    if (!(p?.phone && p.phone.trim())) missing.push('phone')
    if (!(p?.email && p.email.trim())) missing.push('email')
    if (!(p?.bankDetails && p.bankDetails.trim())) missing.push('bankDetails')
    if (!(p?.paymentInstructions && p.paymentInstructions.trim()))
      missing.push('paymentInstructions')
    setOrgProfileFocusField(missing[0] ?? 'legalName')
    setOrgProfileErr(null)
  }

  const submitOrgProfile = () => {
    if (!token || !editingOrgProfile || !canEditInvoiceProfile) return
    setOrgProfileSaving(true)
    setOrgProfileErr(null)
    fetch(apiUrl(`/api/v1/organizations/${editingOrgProfile.id}/invoice-profile`), {
      method: 'PATCH',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invoiceLegalName: orgProfileLegalName,
        invoiceTaxNumber: orgProfileTaxNumber,
        invoiceAddress: orgProfileAddress,
        invoicePhone: orgProfilePhone,
        invoiceEmail: orgProfileEmail,
        invoiceBankDetails: orgProfileBankDetails,
        invoicePaymentInstructions: orgProfilePaymentInstructions,
        invoiceLogoUrl: orgProfileLogoUrl,
      }),
    })
      .then(async (r) => {
        if (r.status === 401) {
          signOut()
          throw new Error('Session expired')
        }
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
      })
      .then(() => {
        setEditingOrgProfile(null)
        reloadOrganizations()
      })
      .catch((err: Error) => setOrgProfileErr(err.message))
      .finally(() => setOrgProfileSaving(false))
  }

  const isRoleManageable = useCallback(
    (role: string): boolean => {
      if (me?.role === 'SUPER_ADMIN') return role !== 'SUPER_ADMIN'
      if (me?.role === 'ORG_ADMIN') return role !== 'SUPER_ADMIN' && role !== 'ORG_ADMIN'
      return false
    },
    [me?.role],
  )

  const assignableRoles = useMemo(() => {
    if (me?.role === 'SUPER_ADMIN') return USER_ROLES.filter((r) => r !== 'SUPER_ADMIN')
    if (me?.role === 'ORG_ADMIN') return USER_ROLES.filter((r) => r !== 'SUPER_ADMIN' && r !== 'ORG_ADMIN')
    return [] as readonly string[]
  }, [me?.role])

  useEffect(() => {
    if (assignableRoles.length === 0) return
    if (!assignableRoles.includes(newUserRole as (typeof USER_ROLES)[number])) {
      setNewUserRole(assignableRoles[0])
    }
  }, [assignableRoles, newUserRole])

  useEffect(() => {
    if (!orgs || orgs.length === 0 || !canManageUsers) return
    if (userOrgId && orgs.some((o) => o.id === userOrgId)) return
    setUserOrgId(orgs[0].id)
  }, [orgs, canManageUsers, userOrgId])

  const reloadOrgUsers = useCallback(() => {
    if (!token || !canManageUsers || !userOrgId) return
    setOrgUsersLoading(true)
    setOrgUsersErr(null)
    fetch(apiUrl(`/api/v1/organizations/${userOrgId}/users`), { headers: authHeaders(token) })
      .then(async (r) => {
        if (r.status === 401) {
          signOut()
          throw new Error('Session expired')
        }
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
        return r.json() as Promise<OrganizationUserRow[]>
      })
      .then((rows) => setOrgUsers(rows))
      .catch((err: Error) => {
        setOrgUsersErr(err.message)
        setOrgUsers([])
      })
      .finally(() => setOrgUsersLoading(false))
  }, [token, canManageUsers, userOrgId, signOut])

  useEffect(() => {
    reloadOrgUsers()
  }, [reloadOrgUsers])

  const [inviteUserErr, setInviteUserErr] = useState<string | null>(null)

  const submitCreateUser = (e: FormEvent) => {
    e.preventDefault()
    if (!token || !userOrgId || !canManageUsers) return
    setNewUserErr(null)
    if (!newUserEmail.trim()) {
      setNewUserErr('Email is required.')
      return
    }
    if (!newUserInviteOnly) {
      if (!newUserPassword.trim() || newUserPassword.trim().length < 6) {
        setNewUserErr('Password must be at least 6 characters.')
        return
      }
    }
    setNewUserSaving(true)
    const body: Record<string, string | boolean> = {
      email: newUserEmail.trim().toLowerCase(),
      role: newUserRole,
    }
    if (newUserDisplayName.trim()) body.displayName = newUserDisplayName.trim()
    if (newUserInviteOnly) {
      body.sendInviteEmail = true
    } else {
      body.password = newUserPassword
    }
    fetch(apiUrl(`/api/v1/organizations/${userOrgId}/users`), {
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
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
        return r.json() as Promise<{ inviteEmailSent?: boolean; inviteEmailConfigured?: boolean }>
      })
      .then((data) => {
        setNewUserEmail('')
        setNewUserDisplayName('')
        setNewUserRole(assignableRoles[0] ?? 'READ_ONLY')
        setNewUserPassword('demo123')
        setNewUserInviteOnly(false)
        reloadOrgUsers()
        reloadOrganizations()
        if (newUserInviteOnly && data.inviteEmailConfigured && !data.inviteEmailSent) {
          setNewUserErr('User created but invite email could not be sent.')
        } else if (newUserInviteOnly && !data.inviteEmailConfigured) {
          setNewUserErr(
            'User created without password. SMTP is not configured — resend invite after setting SMTP env.',
          )
        }
      })
      .catch((err: Error) => setNewUserErr(err.message))
      .finally(() => setNewUserSaving(false))
  }

  const resendInvite = (u: OrganizationUserRow) => {
    if (!token || !canManageUsers || !userOrgId) return
    setInviteUserErr(null)
    fetch(apiUrl(`/api/v1/organizations/${userOrgId}/users/${u.id}/invite`), {
      method: 'POST',
      headers: authHeaders(token),
    })
      .then(async (r) => {
        if (r.status === 401) {
          signOut()
          throw new Error('Session expired')
        }
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
        return r.json() as Promise<{ inviteEmailSent?: boolean; inviteEmailConfigured?: boolean }>
      })
      .then((data) => {
        if (!data.inviteEmailConfigured) {
          setInviteUserErr('SMTP is not configured on the API.')
        } else if (!data.inviteEmailSent) {
          setInviteUserErr('Invite email could not be sent.')
        }
      })
      .catch((err: Error) => setInviteUserErr(err.message))
  }

  const openEditUser = (u: OrganizationUserRow) => {
    setEditingUser(u)
    setEditUserEmail(u.email)
    setEditUserDisplayName(u.displayName ?? '')
    setEditUserRole(u.role)
    setEditUserPassword('')
    setEditUserErr(null)
  }

  const submitEditUser = () => {
    if (!token || !canManageUsers || !userOrgId || !editingUser) return
    setEditUserSaving(true)
    setEditUserErr(null)
    fetch(apiUrl(`/api/v1/organizations/${userOrgId}/users/${editingUser.id}`), {
      method: 'PATCH',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: editUserEmail.trim().toLowerCase(),
        displayName: editUserDisplayName.trim() || null,
        role: editUserRole,
        ...(editUserPassword.trim() ? { password: editUserPassword } : {}),
      }),
    })
      .then(async (r) => {
        if (r.status === 401) {
          signOut()
          throw new Error('Session expired')
        }
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
      })
      .then(() => {
        setEditingUser(null)
        reloadOrgUsers()
      })
      .catch((err: Error) => setEditUserErr(err.message))
      .finally(() => setEditUserSaving(false))
  }

  const removeUser = (u: OrganizationUserRow) => {
    if (!token || !canManageUsers || !userOrgId) return
    setDeleteUserErr(null)
    if (!window.confirm(`Delete user ${u.email}?`)) return
    fetch(apiUrl(`/api/v1/organizations/${userOrgId}/users/${u.id}`), {
      method: 'DELETE',
      headers: authHeaders(token),
    })
      .then(async (r) => {
        if (r.status === 401) {
          signOut()
          throw new Error('Session expired')
        }
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
      })
      .then(() => {
        reloadOrgUsers()
        reloadOrganizations()
      })
      .catch((err: Error) => setDeleteUserErr(err.message))
  }

  return (
    <>
      <PageHeader title="Organizations" />
      {isSuperAdmin && (
        <Box sx={{ mb: 3 }}>
          <SectionCard
            title="Create organization"
            subtitle="SUPER_ADMIN only. Slug is derived from name if left empty."
            icon={<DnsOutlined />}
          >
            <Box component="form" onSubmit={submitCreateOrg} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {createErr && (
                <Alert severity="error" variant="outlined">
                  {createErr}
                </Alert>
              )}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap" useFlexGap>
                <TextField
                  required
                  size="small"
                  label="Name"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  sx={{ minWidth: 240, flex: 1 }}
                />
                <TextField
                  size="small"
                  label="Slug (optional)"
                  value={createSlug}
                  onChange={(e) => setCreateSlug(e.target.value)}
                  sx={{ minWidth: 200 }}
                  helperText="Lowercase letters, numbers, hyphens"
                />
                <TextField
                  size="small"
                  label="Base currency"
                  value={createCurrency}
                  onChange={(e) => setCreateCurrency(e.target.value)}
                  sx={{ width: 120 }}
                  inputProps={{ maxLength: 3 }}
                />
                <TextField
                  size="small"
                  label="Timezone"
                  value={createTimezone}
                  onChange={(e) => setCreateTimezone(e.target.value)}
                  sx={{ minWidth: 220 }}
                />
              </Stack>
              <Button type="submit" variant="contained" disabled={createSaving} sx={{ alignSelf: 'flex-start' }}>
                {createSaving ? 'Creating…' : 'Create organization'}
              </Button>
            </Box>
          </SectionCard>
        </Box>
      )}
      {canManageUsers && (
        <Box sx={{ mb: 3 }}>
          <SectionCard
            title="User management"
            subtitle="Create and manage users below your role in the selected organization."
            icon={<PeopleOutlineOutlined />}
          >
            <Stack spacing={2}>
              {isSuperAdmin && (
                <FormControl size="small" sx={{ maxWidth: 360 }}>
                  <InputLabel id="users-org-label">Organization</InputLabel>
                  <Select
                    labelId="users-org-label"
                    label="Organization"
                    value={userOrgId}
                    onChange={(e) => setUserOrgId(e.target.value)}
                  >
                    {(orgs ?? []).map((o) => (
                      <MenuItem key={o.id} value={o.id}>
                        {o.name} ({o.slug})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              {newUserErr ? (
                <Alert severity="error" variant="outlined">
                  {newUserErr}
                </Alert>
              ) : null}
              {deleteUserErr ? (
                <Alert severity="error" variant="outlined">
                  {deleteUserErr}
                </Alert>
              ) : null}
              {inviteUserErr ? (
                <Alert severity="warning" variant="outlined">
                  {inviteUserErr}
                </Alert>
              ) : null}
              <Stack
                component="form"
                onSubmit={submitCreateUser}
                direction={{ xs: 'column', md: 'row' }}
                spacing={1.5}
                useFlexGap
                flexWrap="wrap"
              >
                <TextField
                  size="small"
                  label="Email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  sx={{ minWidth: 220 }}
                />
                <TextField
                  size="small"
                  label="Display name"
                  value={newUserDisplayName}
                  onChange={(e) => setNewUserDisplayName(e.target.value)}
                  sx={{ minWidth: 220 }}
                />
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel id="new-user-role-label">Role</InputLabel>
                  <Select
                    labelId="new-user-role-label"
                    label="Role"
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value)}
                  >
                    {assignableRoles.map((r) => (
                      <MenuItem key={r} value={r}>
                        {r.replace(/_/g, ' ')}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  size="small"
                  label={newUserInviteOnly ? 'Password (optional)' : 'Password'}
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  disabled={newUserInviteOnly}
                  sx={{ minWidth: 180 }}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={newUserInviteOnly}
                      onChange={(e) => setNewUserInviteOnly(e.target.checked)}
                    />
                  }
                  label="Invite by email"
                />
                <Button type="submit" variant="contained" disabled={newUserSaving || !userOrgId}>
                  {newUserSaving ? 'Creating…' : newUserInviteOnly ? 'Create & invite' : 'Create user'}
                </Button>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Invite mode sends a password-setup link when SMTP is configured. Tenant users
                auto-created from the Tenants page stay pending until invited or given a password.
              </Typography>

              {orgUsersErr ? (
                <Alert severity="warning" variant="outlined">
                  {orgUsersErr}
                </Alert>
              ) : null}
              {orgUsers === null && orgUsersLoading ? (
                <Stack spacing={1}>
                  <Skeleton height={36} />
                  <Skeleton height={36} />
                </Stack>
              ) : null}
              {orgUsers && (
                <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Email</TableCell>
                        <TableCell>Name</TableCell>
                        <TableCell>Role</TableCell>
                        <TableCell>Login</TableCell>
                        <TableCell>Created</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {orgUsers.map((u) => {
                        const canEdit = isRoleManageable(u.role) && u.id !== me?.id
                        return (
                          <TableRow key={u.id} hover>
                            <TableCell>{u.email}</TableCell>
                            <TableCell>{u.displayName ?? '—'}</TableCell>
                            <TableCell sx={{ textTransform: 'capitalize' }}>
                              {u.role.replace(/_/g, ' ')}
                            </TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                variant="outlined"
                                label={u.hasPassword ? 'Active' : 'Pending password'}
                                color={u.hasPassword ? 'success' : 'warning'}
                              />
                            </TableCell>
                            <TableCell>{new Date(u.createdAt).toLocaleDateString()}</TableCell>
                            <TableCell align="right">
                              {!u.hasPassword && canEdit ? (
                                <Tooltip title="Resend invite email">
                                  <IconButton
                                    size="small"
                                    aria-label="Resend invite"
                                    onClick={() => resendInvite(u)}
                                  >
                                    <SendOutlined fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              ) : null}
                              <IconButton
                                size="small"
                                aria-label="Edit user"
                                disabled={!canEdit}
                                onClick={() => openEditUser(u)}
                              >
                                <EditOutlined fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                aria-label="Delete user"
                                disabled={!canEdit}
                                onClick={() => removeUser(u)}
                              >
                                <DeleteOutlineOutlined fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Stack>
          </SectionCard>
        </Box>
      )}
      <SectionCard
        title="Organizations"
        subtitle="SUPER_ADMIN sees all orgs; ORG_ADMIN is limited to their tenant (RLS)."
        icon={<DnsOutlined />}
      >
        {orgsErr && (
          <Alert severity="warning" variant="outlined">
            {orgsErr}
          </Alert>
        )}
        {!orgsErr && orgs === null && (
          <Stack spacing={1}>
            <Skeleton height={40} />
            <Skeleton height={40} />
            <Skeleton height={40} />
          </Stack>
        )}
        {!orgsErr && orgs && orgs.length === 0 && (
          <Typography color="text.secondary">No organizations returned.</Typography>
        )}
        {!orgsErr && orgs && orgs.length > 0 && (
          <TableContainer
            sx={{
              borderRadius: 2,
              border: 1,
              borderColor: 'divider',
              overflow: 'hidden',
            }}
          >
            <Table
              size="small"
              sx={{ '& tbody tr:hover': { bgcolor: 'action.hover' } }}
            >
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Slug</TableCell>
                  <TableCell>Currency</TableCell>
                  <TableCell>Invoice profile</TableCell>
                  <TableCell align="right">Users</TableCell>
                  {canEditInvoiceProfile && <TableCell align="right">Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {orgs.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Typography fontWeight={600}>{o.name}</Typography>
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem' }}>
                      {o.slug}
                    </TableCell>
                    <TableCell>{o.baseCurrency}</TableCell>
                    <TableCell>
                      {(() => {
                        const c = invoiceProfileCompleteness(o)
                        const full = c.done === c.total
                        return (
                          <Chip
                            size="small"
                            variant="outlined"
                            color={full ? 'success' : c.done > 0 ? 'warning' : 'default'}
                            label={`${c.done}/${c.total}`}
                            onClick={canEditInvoiceProfile ? () => openEditOrgProfile(o) : undefined}
                            sx={{
                              cursor: canEditInvoiceProfile ? 'pointer' : 'default',
                            }}
                          />
                        )
                      })()}
                    </TableCell>
                    <TableCell align="right">{o._count.users}</TableCell>
                    {canEditInvoiceProfile ? (
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => openEditOrgProfile(o)}
                        >
                          Invoice profile
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </SectionCard>

      <Dialog
        open={editingOrgProfile !== null}
        onClose={() => !orgProfileSaving && setEditingOrgProfile(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Organization tax invoice profile (Zambia / ZRA)</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {orgProfileErr ? (
              <Alert severity="error" variant="outlined">
                {orgProfileErr}
              </Alert>
            ) : null}
            <Alert severity="info" variant="outlined">
              Complete supplier details for ZRA-compliant tax invoices (TPIN, address, and payment
              details appear on every PDF).
            </Alert>
            <TextField
              size="small"
              label="Legal entity name"
              value={orgProfileLegalName}
              onChange={(e) => setOrgProfileLegalName(e.target.value)}
              autoFocus={orgProfileFocusField === 'legalName'}
              fullWidth
            />
            <TextField
              size="small"
              label="TPIN (ZRA Tax Payer ID)"
              value={orgProfileTaxNumber}
              onChange={(e) => setOrgProfileTaxNumber(e.target.value)}
              autoFocus={orgProfileFocusField === 'taxNumber'}
              fullWidth
              placeholder="e.g. 1001234567"
            />
            <TextField
              size="small"
              label="Registered address"
              value={orgProfileAddress}
              onChange={(e) => setOrgProfileAddress(e.target.value)}
              autoFocus={orgProfileFocusField === 'address'}
              fullWidth
              multiline
              minRows={2}
              placeholder="Plot, street, city, province"
            />
            <TextField
              size="small"
              label="Phone"
              value={orgProfilePhone}
              onChange={(e) => setOrgProfilePhone(e.target.value)}
              autoFocus={orgProfileFocusField === 'phone'}
              fullWidth
              placeholder="+260 …"
            />
            <TextField
              size="small"
              label="Email"
              value={orgProfileEmail}
              onChange={(e) => setOrgProfileEmail(e.target.value)}
              autoFocus={orgProfileFocusField === 'email'}
              fullWidth
            />
            <TextField
              size="small"
              label="Bank details"
              value={orgProfileBankDetails}
              onChange={(e) => setOrgProfileBankDetails(e.target.value)}
              autoFocus={orgProfileFocusField === 'bankDetails'}
              fullWidth
              multiline
              minRows={2}
            />
            <TextField
              size="small"
              label="Payment instructions"
              value={orgProfilePaymentInstructions}
              onChange={(e) => setOrgProfilePaymentInstructions(e.target.value)}
              autoFocus={orgProfileFocusField === 'paymentInstructions'}
              fullWidth
              multiline
              minRows={2}
            />
            <TextField
              size="small"
              label="Logo URL"
              value={orgProfileLogoUrl}
              onChange={(e) => setOrgProfileLogoUrl(e.target.value)}
              autoFocus={orgProfileFocusField === 'logoUrl'}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setEditingOrgProfile(null)}
            disabled={orgProfileSaving}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={submitOrgProfile}
            disabled={orgProfileSaving}
          >
            {orgProfileSaving ? 'Saving…' : 'Save profile'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={editingUser !== null}
        onClose={() => !editUserSaving && setEditingUser(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Edit user</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {editUserErr ? (
              <Alert severity="error" variant="outlined">
                {editUserErr}
              </Alert>
            ) : null}
            <TextField
              size="small"
              label="Email"
              value={editUserEmail}
              onChange={(e) => setEditUserEmail(e.target.value)}
              fullWidth
            />
            <TextField
              size="small"
              label="Display name"
              value={editUserDisplayName}
              onChange={(e) => setEditUserDisplayName(e.target.value)}
              fullWidth
            />
            <FormControl size="small" fullWidth>
              <InputLabel id="edit-org-user-role-label">Role</InputLabel>
              <Select
                labelId="edit-org-user-role-label"
                label="Role"
                value={editUserRole}
                onChange={(e) => setEditUserRole(e.target.value)}
              >
                {assignableRoles.map((r) => (
                  <MenuItem key={r} value={r}>
                    {r.replace(/_/g, ' ')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              size="small"
              label="New password (optional)"
              type="password"
              value={editUserPassword}
              onChange={(e) => setEditUserPassword(e.target.value)}
              fullWidth
              helperText="Leave empty to keep existing password."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingUser(null)} disabled={editUserSaving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={submitEditUser} disabled={editUserSaving}>
            {editUserSaving ? 'Saving…' : 'Save user'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

function organizationLabel(orgs: OrganizationRow[] | null, orgId: string) {
  return orgs?.find((o) => o.id === orgId)?.name ?? '—'
}

export function PortfoliosPage() {
  const {
    token,
    signOut,
    me,
    orgs,
    portfolios,
    portfoliosErr,
    canWriteProperty,
    newPortfolioName,
    setNewPortfolioName,
    newPortfolioOrganizationId,
    setNewPortfolioOrganizationId,
    portfolioSaving,
    handleCreatePortfolio,
    reloadPortfolios,
  } = useDashboard()

  const isSuperAdmin = me?.role === 'SUPER_ADMIN'

  const handleUnauthorized = useCallback(() => {
    signOut()
  }, [signOut])

  const [editingPortfolio, setEditingPortfolio] = useState<PortfolioRow | null>(null)
  const [editPortfolioName, setEditPortfolioName] = useState('')
  const [editPortfolioRegion, setEditPortfolioRegion] = useState('')
  const [editPortfolioOrgId, setEditPortfolioOrgId] = useState('')
  const [portfolioPatchSaving, setPortfolioPatchSaving] = useState(false)
  const [portfolioPatchErr, setPortfolioPatchErr] = useState<string | null>(null)
  const [deletingPortfolio, setDeletingPortfolio] = useState<PortfolioRow | null>(null)
  const [portfolioDeleteSaving, setPortfolioDeleteSaving] = useState(false)
  const [portfolioDeleteErr, setPortfolioDeleteErr] = useState<string | null>(null)

  const openEditPortfolio = (p: PortfolioRow) => {
    setEditingPortfolio(p)
    setEditPortfolioName(p.name)
    setEditPortfolioRegion(p.region ?? '')
    setEditPortfolioOrgId(p.organizationId)
    setPortfolioPatchErr(null)
  }

  const submitPatchPortfolio = () => {
    if (!token || !editingPortfolio) return
    const name = editPortfolioName.trim()
    if (!name) {
      setPortfolioPatchErr('Name is required.')
      return
    }
    setPortfolioPatchSaving(true)
    setPortfolioPatchErr(null)
    const reg = editPortfolioRegion.trim()
    const body: Record<string, string | null> = {
      name,
      region: reg || null,
    }
    if (isSuperAdmin && editPortfolioOrgId) {
      body.organizationId = editPortfolioOrgId
    }
    fetch(apiUrl(`/api/v1/portfolios/${editingPortfolio.id}`), {
      method: 'PATCH',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
      .then(async (r) => {
        if (r.status === 401) {
          handleUnauthorized()
          throw new Error('Session expired')
        }
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
      })
      .then(() => {
        setEditingPortfolio(null)
        reloadPortfolios()
      })
      .catch((e: Error) => setPortfolioPatchErr(e.message))
      .finally(() => setPortfolioPatchSaving(false))
  }

  const submitDeletePortfolio = () => {
    if (!token || !deletingPortfolio) return
    setPortfolioDeleteSaving(true)
    setPortfolioDeleteErr(null)
    fetch(apiUrl(`/api/v1/portfolios/${deletingPortfolio.id}`), {
      method: 'DELETE',
      headers: authHeaders(token),
    })
      .then(async (r) => {
        if (r.status === 401) {
          handleUnauthorized()
          throw new Error('Session expired')
        }
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
      })
      .then(() => {
        setDeletingPortfolio(null)
        reloadPortfolios()
      })
      .catch((e: Error) => setPortfolioDeleteErr(e.message))
      .finally(() => setPortfolioDeleteSaving(false))
  }

  return (
    <>
      <PageHeader title="Portfolios" />
      <SectionCard
        title="Portfolios"
        subtitle="Summary list and quick add. Use the section below to manage buildings, floors, and units per portfolio (same write roles)."
        icon={<ApartmentOutlined />}
        action={
          canWriteProperty ? (
            <Box
              component="form"
              onSubmit={handleCreatePortfolio}
              sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'flex-start' }}
            >
              <TextField
                size="small"
                label="New portfolio"
                value={newPortfolioName}
                onChange={(e) => setNewPortfolioName(e.target.value)}
                sx={{ minWidth: 200 }}
              />
              {isSuperAdmin && (
                <FormControl size="small" sx={{ minWidth: 220 }} required>
                  <InputLabel id="new-portfolio-org-label">Organization</InputLabel>
                  <Select
                    labelId="new-portfolio-org-label"
                    label="Organization"
                    value={
                      newPortfolioOrganizationId &&
                      orgs?.some((o) => o.id === newPortfolioOrganizationId)
                        ? newPortfolioOrganizationId
                        : orgs?.[0]?.id ?? ''
                    }
                    onChange={(e) => setNewPortfolioOrganizationId(e.target.value)}
                    disabled={!orgs || orgs.length === 0}
                  >
                    {(orgs ?? []).map((o) => (
                      <MenuItem key={o.id} value={o.id}>
                        {o.name} ({o.slug})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              <Button
                type="submit"
                variant="contained"
                disabled={
                  portfolioSaving ||
                  !newPortfolioName.trim() ||
                  (isSuperAdmin && (!orgs || orgs.length === 0))
                }
              >
                {portfolioSaving ? 'Saving…' : 'Add'}
              </Button>
            </Box>
          ) : undefined
        }
      >
        {portfoliosErr && (
          <Alert severity="warning" variant="outlined" sx={{ mb: 2 }}>
            {portfoliosErr}
          </Alert>
        )}
        {portfolios === null && (
          <Stack spacing={1}>
            <Skeleton height={36} />
            <Skeleton height={36} />
          </Stack>
        )}
        {portfolios && portfolios.length === 0 && (
          <Typography color="text.secondary">No portfolios yet.</Typography>
        )}
        {portfolios && portfolios.length > 0 && (
          <TableContainer
            sx={{
              borderRadius: 2,
              border: 1,
              borderColor: 'divider',
              overflow: 'hidden',
            }}
          >
            <Table
              size="small"
              sx={{ '& tbody tr:hover': { bgcolor: 'action.hover' } }}
            >
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  {isSuperAdmin && <TableCell>Organization</TableCell>}
                  <TableCell>Region</TableCell>
                  <TableCell align="right">Buildings</TableCell>
                  {canWriteProperty && (
                    <TableCell align="right" width={100}>
                      Actions
                    </TableCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {portfolios.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Typography fontWeight={600}>{p.name}</Typography>
                    </TableCell>
                    {isSuperAdmin && (
                      <TableCell>{organizationLabel(orgs, p.organizationId)}</TableCell>
                    )}
                    <TableCell>{p.region ?? '—'}</TableCell>
                    <TableCell align="right">{p._count.buildings}</TableCell>
                    {canWriteProperty && (
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          aria-label="Edit portfolio"
                          onClick={() => openEditPortfolio(p)}
                        >
                          <EditOutlined fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          aria-label="Delete portfolio"
                          onClick={() => {
                            setPortfolioDeleteErr(null)
                            setDeletingPortfolio(p)
                          }}
                        >
                          <DeleteOutlineOutlined fontSize="small" />
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </SectionCard>

      <Dialog
        open={editingPortfolio !== null}
        onClose={() => !portfolioPatchSaving && setEditingPortfolio(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Edit portfolio</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {portfolioPatchErr && (
              <Alert severity="error" variant="outlined">
                {portfolioPatchErr}
              </Alert>
            )}
            <TextField
              label="Name"
              size="small"
              fullWidth
              required
              value={editPortfolioName}
              onChange={(e) => setEditPortfolioName(e.target.value)}
            />
            <TextField
              label="Region (optional)"
              size="small"
              fullWidth
              value={editPortfolioRegion}
              onChange={(e) => setEditPortfolioRegion(e.target.value)}
            />
            {isSuperAdmin && (
              <FormControl fullWidth size="small" required>
                <InputLabel id="edit-portfolio-org-label">Organization</InputLabel>
                <Select
                  labelId="edit-portfolio-org-label"
                  label="Organization"
                  value={editPortfolioOrgId}
                  onChange={(e) => setEditPortfolioOrgId(e.target.value)}
                  disabled={!orgs || orgs.length === 0}
                >
                  {(orgs ?? []).map((o) => (
                    <MenuItem key={o.id} value={o.id}>
                      {o.name} ({o.slug})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setEditingPortfolio(null)}
            disabled={portfolioPatchSaving}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={submitPatchPortfolio}
            disabled={
              portfolioPatchSaving ||
              (isSuperAdmin && (!orgs || orgs.length === 0 || !editPortfolioOrgId))
            }
          >
            {portfolioPatchSaving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deletingPortfolio !== null}
        onClose={() => !portfolioDeleteSaving && setDeletingPortfolio(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Delete portfolio?</DialogTitle>
        <DialogContent>
          {portfolioDeleteErr && (
            <Alert severity="error" variant="outlined" sx={{ mb: 2 }}>
              {portfolioDeleteErr}
            </Alert>
          )}
          {deletingPortfolio && (
            <Typography variant="body2">
              This removes <strong>{deletingPortfolio.name}</strong> and cascades to buildings,
              floors, and units in the database. Deletes can fail if any unit is still linked to a
              lease.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeletingPortfolio(null)}
            disabled={portfolioDeleteSaving}
          >
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={submitDeletePortfolio}
            disabled={portfolioDeleteSaving}
          >
            {portfolioDeleteSaving ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Box sx={{ mt: 3 }}>
        <PropertyHierarchyPanel />
      </Box>
    </>
  )
}

function tenantDisplayName(row: TenantRow) {
  return row.tradingName ?? row.legalName
}

function invoiceActivityChipColor(kind: string): ChipProps['color'] {
  switch (kind) {
    case 'PAYMENT_ALLOCATED':
      return 'success'
    case 'PAYMENT_REVERSED':
      return 'warning'
    case 'INVOICE_ISSUED':
      return 'info'
    case 'ADJUSTMENT':
      return 'secondary'
    default:
      return 'default'
  }
}

function TenantViewDialogBody({ tenant }: { tenant: TenantRow }) {
  return (
    <Stack spacing={2} sx={{ pt: 0.5 }}>
      <Typography fontWeight={700}>{tenant.legalName}</Typography>
      {tenant.tradingName ? (
        <Typography variant="body2" color="text.secondary">
          Trading as: {tenant.tradingName}
        </Typography>
      ) : null}
      <Stack spacing={0.5}>
        <Typography variant="body2">
          <strong>Email:</strong> {tenant.contactEmail ?? '—'}
        </Typography>
        <Typography variant="body2">
          <strong>Phone:</strong> {tenant.contactPhone ?? '—'}
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        Linked leases: {tenant._count.leases}
      </Typography>
    </Stack>
  )
}

const ADMIN_TABLE_PAGE_SIZES = [10, 20, 50] as const
const DEFAULT_ADMIN_TABLE_PAGE_SIZE = 20

export function TenantsPage() {
  const {
    token,
    signOut,
    canWriteProperty,
    reloadDashboardMetrics,
  } = useDashboard()

  const handleUnauthorized = useCallback(() => {
    signOut()
  }, [signOut])

  const [createLegalName, setCreateLegalName] = useState('')
  const [createTradingName, setCreateTradingName] = useState('')
  const [createEmail, setCreateEmail] = useState('')
  const [createPhone, setCreatePhone] = useState('')
  const [createSaving, setCreateSaving] = useState(false)
  const [createErr, setCreateErr] = useState<string | null>(null)

  const [viewingTenant, setViewingTenant] = useState<TenantRow | null>(null)
  const [editingTenant, setEditingTenant] = useState<TenantRow | null>(null)
  const [editLegalName, setEditLegalName] = useState('')
  const [editTradingName, setEditTradingName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editErr, setEditErr] = useState<string | null>(null)

  const [deletingTenant, setDeletingTenant] = useState<TenantRow | null>(null)
  const [deleteSaving, setDeleteSaving] = useState(false)
  const [deleteErr, setDeleteErr] = useState<string | null>(null)
  const [tenantSearch, setTenantSearch] = useState('')
  const [debouncedTenantSearch, setDebouncedTenantSearch] = useState('')
  const [tenantListRows, setTenantListRows] = useState<TenantRow[] | null>(null)
  const [tenantListTotal, setTenantListTotal] = useState(0)
  const [tenantListPage, setTenantListPage] = useState(0)
  const [tenantListPageSize, setTenantListPageSize] = useState(
    DEFAULT_ADMIN_TABLE_PAGE_SIZE,
  )
  const [tenantListErr, setTenantListErr] = useState<string | null>(null)
  const [tenantListLoading, setTenantListLoading] = useState(false)
  const [tenantListNonce, setTenantListNonce] = useState(0)

  useEffect(() => {
    const id = window.setTimeout(
      () => setDebouncedTenantSearch(tenantSearch.trim()),
      400,
    )
    return () => window.clearTimeout(id)
  }, [tenantSearch])

  useEffect(() => {
    setTenantListPage(0)
  }, [debouncedTenantSearch])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setTenantListLoading(true)
    setTenantListErr(null)
    const params = new URLSearchParams({
      page: String(tenantListPage + 1),
      pageSize: String(tenantListPageSize),
    })
    if (debouncedTenantSearch) params.set('q', debouncedTenantSearch)
    fetch(apiUrl(`/api/v1/tenants?${params}`), { headers: authHeaders(token) })
      .then(async (r) => {
        if (r.status === 401) {
          handleUnauthorized()
          throw new Error('Session expired')
        }
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
        return r.json() as Promise<
          TenantRow[] | { items: TenantRow[]; total: number }
        >
      })
      .then((data) => {
        if (cancelled) return
        let rows: TenantRow[]
        let total: number
        if (Array.isArray(data)) {
          rows = data
          total = data.length
        } else {
          rows = data.items
          total = data.total
        }
        if (rows.length === 0 && total > 0 && tenantListPage > 0) {
          setTenantListPage(0)
          return
        }
        setTenantListRows(rows)
        setTenantListTotal(total)
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setTenantListErr(e.message)
          setTenantListRows([])
          setTenantListTotal(0)
        }
      })
      .finally(() => {
        if (!cancelled) setTenantListLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [
    token,
    tenantListPage,
    tenantListPageSize,
    debouncedTenantSearch,
    tenantListNonce,
    handleUnauthorized,
  ])

  const openEditTenant = (row: TenantRow) => {
    setEditingTenant(row)
    setEditLegalName(row.legalName)
    setEditTradingName(row.tradingName ?? '')
    setEditEmail(row.contactEmail ?? '')
    setEditPhone(row.contactPhone ?? '')
    setEditErr(null)
  }

  const submitCreateTenant = (e: FormEvent) => {
    e.preventDefault()
    if (!token) return
    const legal = createLegalName.trim()
    if (!legal) {
      setCreateErr('Legal name is required.')
      return
    }
    setCreateErr(null)
    setCreateSaving(true)
    const body: Record<string, string> = { legalName: legal }
    const t = createTradingName.trim()
    const em = createEmail.trim()
    const ph = createPhone.trim()
    if (t) body.tradingName = t
    if (em) body.contactEmail = em
    if (ph) body.contactPhone = ph
    fetch(apiUrl('/api/v1/tenants'), {
      method: 'POST',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
      .then(async (r) => {
        if (r.status === 401) {
          handleUnauthorized()
          throw new Error('Session expired')
        }
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
      })
      .then(() => {
        setCreateLegalName('')
        setCreateTradingName('')
        setCreateEmail('')
        setCreatePhone('')
        setTenantListPage(0)
        setTenantListNonce((n) => n + 1)
      })
      .catch((err: Error) => setCreateErr(err.message))
      .finally(() => setCreateSaving(false))
  }

  const submitEditTenant = () => {
    if (!token || !editingTenant) return
    const legal = editLegalName.trim()
    if (!legal) {
      setEditErr('Legal name is required.')
      return
    }
    setEditSaving(true)
    setEditErr(null)
    fetch(apiUrl(`/api/v1/tenants/${editingTenant.id}`), {
      method: 'PATCH',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        legalName: legal,
        tradingName: editTradingName.trim() || null,
        contactEmail: editEmail.trim() || null,
        contactPhone: editPhone.trim() || null,
      }),
    })
      .then(async (r) => {
        if (r.status === 401) {
          handleUnauthorized()
          throw new Error('Session expired')
        }
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
      })
      .then(() => {
        setEditingTenant(null)
        reloadDashboardMetrics()
        setTenantListNonce((n) => n + 1)
      })
      .catch((err: Error) => setEditErr(err.message))
      .finally(() => setEditSaving(false))
  }

  const submitDeleteTenant = () => {
    if (!token || !deletingTenant) return
    setDeleteSaving(true)
    setDeleteErr(null)
    fetch(apiUrl(`/api/v1/tenants/${deletingTenant.id}`), {
      method: 'DELETE',
      headers: authHeaders(token),
    })
      .then(async (r) => {
        if (r.status === 401) {
          handleUnauthorized()
          throw new Error('Session expired')
        }
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
      })
      .then(() => {
        setDeletingTenant(null)
        reloadDashboardMetrics()
        setTenantListNonce((n) => n + 1)
      })
      .catch((err: Error) => setDeleteErr(err.message))
      .finally(() => setDeleteSaving(false))
  }

  return (
    <>
      <PageHeader title="Tenants" />
      {canWriteProperty && (
        <Box sx={{ mb: 3 }}>
          <SectionCard
            title="Create tenant"
            subtitle="SUPER_ADMIN, ORG_ADMIN, or PORTFOLIO_MANAGER. Lessees are scoped to your organization (RLS)."
            icon={<AddOutlined />}
          >
            <Stack
              component="form"
              spacing={2}
              onSubmit={submitCreateTenant}
              sx={{ maxWidth: 560 }}
            >
              {createErr && (
                <Alert severity="error" variant="outlined">
                  {createErr}
                </Alert>
              )}
              <TextField
                label="Legal name"
                size="small"
                required
                fullWidth
                value={createLegalName}
                onChange={(e) => setCreateLegalName(e.target.value)}
              />
              <TextField
                label="Trading name (optional)"
                size="small"
                fullWidth
                value={createTradingName}
                onChange={(e) => setCreateTradingName(e.target.value)}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Contact email (optional)"
                  size="small"
                  fullWidth
                  type="email"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                />
                <TextField
                  label="Contact phone (optional)"
                  size="small"
                  fullWidth
                  value={createPhone}
                  onChange={(e) => setCreatePhone(e.target.value)}
                />
              </Stack>
              <Box>
                <Button type="submit" variant="contained" disabled={createSaving}>
                  {createSaving ? 'Creating…' : 'Create tenant'}
                </Button>
              </Box>
            </Stack>
          </SectionCard>
        </Box>
      )}
      <SectionCard
        title="Tenants"
        subtitle="Server search and pagination (name, email, phone). Leases and billing use async tenant search (no full tenant list at login). Writes: property roles."
        icon={<PeopleOutlineOutlined />}
        action={
          <TextField
            size="small"
            placeholder="Search…"
            value={tenantSearch}
            onChange={(e) => setTenantSearch(e.target.value)}
            aria-label="Filter tenants"
            sx={{
              minWidth: { xs: '100%', sm: 240 },
              ...sectionCardHeaderOutlinedSx,
            }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlined
                      fontSize="small"
                      sx={{ color: 'text.secondary' }}
                    />
                  </InputAdornment>
                ),
              },
            }}
          />
        }
      >
        {tenantListErr && (
          <Alert severity="warning" variant="outlined">
            {tenantListErr}
          </Alert>
        )}
        {tenantListRows === null && tenantListLoading && (
          <Stack spacing={1}>
            <Skeleton height={36} />
            <Skeleton height={36} />
          </Stack>
        )}
        {tenantListRows !== null &&
          tenantListTotal === 0 &&
          !tenantListErr &&
          !tenantListLoading && (
            <Typography color="text.secondary">
              {debouncedTenantSearch
                ? `No tenants match "${debouncedTenantSearch}".`
                : 'No tenants yet.'}
            </Typography>
          )}
        {tenantListRows !== null && tenantListTotal > 0 && (
          <>
            <TableContainer
              sx={{
                borderRadius: 2,
                border: 1,
                borderColor: 'divider',
                overflow: 'hidden',
              }}
            >
              <Table
                size="small"
                sx={{ '& tbody tr:hover': { bgcolor: 'action.hover' } }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell>Legal name</TableCell>
                    <TableCell>Trading name</TableCell>
                    <TableCell>Contact</TableCell>
                    <TableCell align="right">Leases</TableCell>
                    <TableCell align="right" width={canWriteProperty ? 148 : 56}>
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tenantListRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Typography fontWeight={600}>{row.legalName}</Typography>
                      </TableCell>
                      <TableCell>{row.tradingName ?? '—'}</TableCell>
                      <TableCell>
                        <Stack spacing={0.25}>
                          <Typography variant="body2">
                            {row.contactEmail ?? '—'}
                          </Typography>
                          {row.contactPhone ? (
                            <Typography variant="caption" color="text.secondary">
                              {row.contactPhone}
                            </Typography>
                          ) : null}
                        </Stack>
                      </TableCell>
                      <TableCell align="right">{row._count.leases}</TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          aria-label="View tenant"
                          onClick={() => setViewingTenant(row)}
                        >
                          <VisibilityOutlined fontSize="small" />
                        </IconButton>
                        {canWriteProperty && (
                          <>
                            <IconButton
                              size="small"
                              aria-label="Edit tenant"
                              onClick={() => openEditTenant(row)}
                            >
                              <EditOutlined fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              aria-label="Delete tenant"
                              disabled={row._count.leases > 0}
                              title={
                                row._count.leases > 0
                                  ? 'Remove or reassign leases before deleting'
                                  : 'Delete tenant'
                              }
                              onClick={() => {
                                setDeleteErr(null)
                                setDeletingTenant(row)
                              }}
                            >
                              <DeleteOutlineOutlined fontSize="small" />
                            </IconButton>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={tenantListTotal}
              page={tenantListPage}
              onPageChange={(_, p) => setTenantListPage(p)}
              rowsPerPage={tenantListPageSize}
              onRowsPerPageChange={(e) => {
                setTenantListPageSize(Number.parseInt(e.target.value, 10))
                setTenantListPage(0)
              }}
              rowsPerPageOptions={[...ADMIN_TABLE_PAGE_SIZES]}
            />
          </>
        )}
      </SectionCard>

      <Dialog
        open={viewingTenant !== null}
        onClose={() => setViewingTenant(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Tenant details</DialogTitle>
        <DialogContent>
          {viewingTenant && <TenantViewDialogBody tenant={viewingTenant} />}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewingTenant(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={editingTenant !== null}
        onClose={() => {
          if (!editSaving) setEditingTenant(null)
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Edit tenant</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {editErr && (
              <Alert severity="error" variant="outlined">
                {editErr}
              </Alert>
            )}
            {editingTenant && (
              <Typography variant="body2" color="text.secondary">
                {tenantDisplayName(editingTenant)}
              </Typography>
            )}
            <TextField
              label="Legal name"
              size="small"
              required
              fullWidth
              value={editLegalName}
              onChange={(e) => setEditLegalName(e.target.value)}
            />
            <TextField
              label="Trading name"
              size="small"
              fullWidth
              value={editTradingName}
              onChange={(e) => setEditTradingName(e.target.value)}
            />
            <TextField
              label="Contact email"
              size="small"
              fullWidth
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
            />
            <TextField
              label="Contact phone"
              size="small"
              fullWidth
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setEditingTenant(null)}
            disabled={editSaving}
          >
            Cancel
          </Button>
          <Button variant="contained" onClick={submitEditTenant} disabled={editSaving}>
            {editSaving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deletingTenant !== null}
        onClose={() => {
          if (!deleteSaving) setDeletingTenant(null)
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Delete tenant?</DialogTitle>
        <DialogContent>
          {deleteErr && (
            <Alert severity="error" variant="outlined" sx={{ mb: 2 }}>
              {deleteErr}
            </Alert>
          )}
          {deletingTenant && (
            <Typography variant="body2">
              This removes <strong>{tenantDisplayName(deletingTenant)}</strong> permanently.
              You cannot delete a tenant that still has leases.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeletingTenant(null)}
            disabled={deleteSaving}
          >
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={submitDeleteTenant}
            disabled={
              deleteSaving || (deletingTenant != null && deletingTenant._count.leases > 0)
            }
          >
            {deleteSaving ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export function LeasesPage() {
  const {
    token,
    me,
    signOut,
    reloadDashboardMetrics,
    canWriteProperty,
    portfolios,
    portfoliosErr,
    leaseTenantFilter,
    setLeaseTenantFilter,
  } = useDashboard()

  const [createTenantId, setCreateTenantId] = useState('')
  const [createTenantOrgId, setCreateTenantOrgId] = useState<string | null>(null)
  const [createBrokerUserId, setCreateBrokerUserId] = useState('')
  const [orgStaffList, setOrgStaffList] = useState<OrgStaffUserRow[]>([])
  const [orgStaffErr, setOrgStaffErr] = useState<string | null>(null)
  const [orgStaffLoading, setOrgStaffLoading] = useState(false)
  const [editBrokerUserId, setEditBrokerUserId] = useState('')
  const [createStart, setCreateStart] = useState('')
  const [createEnd, setCreateEnd] = useState('')
  const [createStatus, setCreateStatus] = useState<string>('DRAFT')
  const [createSaving, setCreateSaving] = useState(false)
  const [createErr, setCreateErr] = useState<string | null>(null)
  const [editingLease, setEditingLease] = useState<LeaseRow | null>(null)
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editErr, setEditErr] = useState<string | null>(null)
  const [editUnitPcts, setEditUnitPcts] = useState<Record<string, string>>({})
  const [editReplaceUnitsEnabled, setEditReplaceUnitsEnabled] = useState(false)
  const [deletingLease, setDeletingLease] = useState<LeaseRow | null>(null)
  const [deleteSaving, setDeleteSaving] = useState(false)
  const [deleteErr, setDeleteErr] = useState<string | null>(null)
  const [createNotes, setCreateNotes] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [viewingLease, setViewingLease] = useState<LeaseRow | null>(null)
  const [leaseSearch, setLeaseSearch] = useState('')
  const [debouncedLeaseSearch, setDebouncedLeaseSearch] = useState('')
  const [leaseListRows, setLeaseListRows] = useState<LeaseRow[] | null>(null)
  const [leaseListTotal, setLeaseListTotal] = useState(0)
  const [leaseListPage, setLeaseListPage] = useState(0)
  const [leaseListPageSize, setLeaseListPageSize] = useState(
    DEFAULT_ADMIN_TABLE_PAGE_SIZE,
  )
  const [leaseListErr, setLeaseListErr] = useState<string | null>(null)
  const [leaseListLoading, setLeaseListLoading] = useState(false)
  const [leaseListNonce, setLeaseListNonce] = useState(0)

  const handleUnauthorized = useCallback(() => {
    signOut()
  }, [signOut])

  useEffect(() => {
    const id = window.setTimeout(
      () => setDebouncedLeaseSearch(leaseSearch.trim()),
      400,
    )
    return () => window.clearTimeout(id)
  }, [leaseSearch])

  useEffect(() => {
    setLeaseListPage(0)
  }, [debouncedLeaseSearch, leaseTenantFilter])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setLeaseListLoading(true)
    setLeaseListErr(null)
    const params = new URLSearchParams({
      page: String(leaseListPage + 1),
      pageSize: String(leaseListPageSize),
    })
    if (leaseTenantFilter) params.set('tenantId', leaseTenantFilter)
    if (debouncedLeaseSearch) params.set('q', debouncedLeaseSearch)
    fetch(apiUrl(`/api/v1/leases?${params}`), { headers: authHeaders(token) })
      .then(async (r) => {
        if (r.status === 401) {
          handleUnauthorized()
          throw new Error('Session expired')
        }
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
        return r.json() as Promise<
          LeaseRow[] | { items: LeaseRow[]; total: number }
        >
      })
      .then((data) => {
        if (cancelled) return
        let rows: LeaseRow[]
        let total: number
        if (Array.isArray(data)) {
          rows = data
          total = data.length
        } else {
          rows = data.items
          total = data.total
        }
        if (rows.length === 0 && total > 0 && leaseListPage > 0) {
          setLeaseListPage(0)
          return
        }
        setLeaseListRows(rows)
        setLeaseListTotal(total)
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setLeaseListErr(e.message)
          setLeaseListRows([])
          setLeaseListTotal(0)
        }
      })
      .finally(() => {
        if (!cancelled) setLeaseListLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [
    token,
    leaseListPage,
    leaseListPageSize,
    debouncedLeaseSearch,
    leaseTenantFilter,
    leaseListNonce,
    handleUnauthorized,
  ])

  useEffect(() => {
    if (!createTenantId) {
      setCreateTenantOrgId(null)
      return
    }
    if (!token) return
    let cancelled = false
    fetch(apiUrl(`/api/v1/tenants/${encodeURIComponent(createTenantId)}`), {
      headers: authHeaders(token),
    })
      .then(async (r) => {
        if (r.status === 401) {
          handleUnauthorized()
          throw new Error('Session expired')
        }
        if (!r.ok) return null
        return r.json() as Promise<TenantRow>
      })
      .then((row) => {
        if (cancelled || !row?.organizationId) return
        setCreateTenantOrgId(row.organizationId ?? null)
      })
      .catch(() => {
        if (!cancelled) setCreateTenantOrgId(null)
      })
    return () => {
      cancelled = true
    }
  }, [createTenantId, token, handleUnauthorized])

  useEffect(() => {
    if (!token || !canWriteProperty) {
      setOrgStaffList([])
      setOrgStaffErr(null)
      return
    }
    let cancelled = false
    const superAdmin = me?.role === 'SUPER_ADMIN'
    const oid = editingLease?.organizationId ?? createTenantOrgId
    const orgParam =
      superAdmin && oid ? `?organizationId=${encodeURIComponent(oid)}` : ''
    setOrgStaffLoading(true)
    setOrgStaffErr(null)
    fetch(apiUrl(`/api/v1/dashboard/org-staff${orgParam}`), {
      headers: authHeaders(token),
    })
      .then(async (r) => {
        if (r.status === 401) {
          handleUnauthorized()
          throw new Error('Session expired')
        }
        if (r.status === 403) {
          throw new Error('You cannot load org staff for broker assignment.')
        }
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
        return r.json() as Promise<DashboardOrgStaffResponse>
      })
      .then((body) => {
        if (!cancelled) setOrgStaffList(body.users)
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setOrgStaffErr(e.message)
          setOrgStaffList([])
        }
      })
      .finally(() => {
        if (!cancelled) setOrgStaffLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [
    token,
    canWriteProperty,
    me?.role,
    editingLease?.organizationId,
    createTenantOrgId,
    handleUnauthorized,
  ])

  const createCascade = usePropertyUnitCascade(token, handleUnauthorized)
  const editReplaceCascade = usePropertyUnitCascade(token, handleUnauthorized)

  const submitCreateLease = (e: FormEvent) => {
    e.preventDefault()
    if (!token) return
    setCreateErr(null)
    if (!createTenantId) {
      setCreateErr('Select a tenant.')
      return
    }
    if (!createStart || !createEnd) {
      setCreateErr('Start and end dates are required.')
      return
    }
    if (createCascade.selectedUnitIds.length === 0) {
      setCreateErr('Select at least one unit.')
      return
    }
    const unitsPayload: { unitId: string; percentageAllocated: number }[] = []
    for (const unitId of createCascade.selectedUnitIds) {
      const raw = (createCascade.unitAllocationPct[unitId] ?? '100').trim()
      const n = parseFloat(raw.replace(',', '.'))
      if (!Number.isFinite(n) || n < 0.0001 || n > 100) {
        setCreateErr(
          `Allocation % for each unit must be a number from 0.0001 to 100 (check unit selections).`,
        )
        return
      }
      unitsPayload.push({ unitId, percentageAllocated: n })
    }
    setCreateSaving(true)
    fetch(apiUrl('/api/v1/leases'), {
      method: 'POST',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenantId: createTenantId,
        startDate: createStart,
        endDate: createEnd,
        status: createStatus,
        units: unitsPayload,
        ...(createBrokerUserId ? { brokerUserId: createBrokerUserId } : {}),
        ...(createNotes.trim()
          ? { terms: { notes: createNotes.trim() } }
          : {}),
      }),
    })
      .then(async (r) => {
        if (r.status === 401) {
          handleUnauthorized()
          throw new Error('Session expired')
        }
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
      })
      .then(() => {
        reloadDashboardMetrics()
        setLeaseListPage(0)
        setLeaseListNonce((n) => n + 1)
        setCreateErr(null)
        setCreateNotes('')
        setCreateBrokerUserId('')
        createCascade.clearUnitSelection()
      })
      .catch((err: Error) => setCreateErr(err.message))
      .finally(() => setCreateSaving(false))
  }

  const openEditLease = (l: LeaseRow) => {
    setEditingLease(l)
    setEditStart(leaseDateToInputValue(l.startDate))
    setEditEnd(leaseDateToInputValue(l.endDate))
    setEditStatus(l.status)
    setEditNotes(leaseNotesFromTerms(l.terms))
    setEditBrokerUserId(l.brokerUserId ?? '')
    setEditUnitPcts(initialEditUnitPcts(l))
    setEditReplaceUnitsEnabled(false)
    editReplaceCascade.resetAll()
    setEditErr(null)
  }

  const buildUnitsPayloadFromCascade = (
    ids: string[],
    pcts: Record<string, string>,
  ): { unitId: string; percentageAllocated: number }[] | null => {
    const out: { unitId: string; percentageAllocated: number }[] = []
    for (const unitId of ids) {
      const raw = (pcts[unitId] ?? '100').trim()
      const n = parseFloat(raw.replace(',', '.'))
      if (!Number.isFinite(n) || n < 0.0001 || n > 100) {
        return null
      }
      out.push({ unitId, percentageAllocated: n })
    }
    return out
  }

  const submitEditLease = () => {
    if (!token || !editingLease) return
    if (!editStart || !editEnd) {
      setEditErr('Start and end dates are required.')
      return
    }
    let unitsPayload: { unitId: string; percentageAllocated: number }[] | null
    if (editReplaceUnitsEnabled) {
      if (editReplaceCascade.selectedUnitIds.length === 0) {
        setEditErr(
          'Turn off “Replace unit links” or select at least one new unit.',
        )
        return
      }
      unitsPayload = buildUnitsPayloadFromCascade(
        editReplaceCascade.selectedUnitIds,
        editReplaceCascade.unitAllocationPct,
      )
      if (!unitsPayload) {
        setEditErr('Allocation % for each unit must be a number from 0.0001 to 100.')
        return
      }
    } else {
      if (editingLease.leaseUnits.length === 0) {
        setEditErr(
          'This lease has no units. Enable “Replace unit links” to choose units, or use the API.',
        )
        return
      }
      unitsPayload = buildUnitsPayloadFromCascade(
        editingLease.leaseUnits.map((lu) => lu.unit.id),
        editUnitPcts,
      )
      if (!unitsPayload) {
        setEditErr('Allocation % for each unit must be a number from 0.0001 to 100.')
        return
      }
    }
    setEditSaving(true)
    setEditErr(null)
    fetch(apiUrl(`/api/v1/leases/${editingLease.id}`), {
      method: 'PATCH',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate: editStart,
        endDate: editEnd,
        status: editStatus,
        units: unitsPayload,
        brokerUserId: editBrokerUserId || null,
        terms: mergeLeaseTermsForPatch(editingLease.terms, editNotes),
      }),
    })
      .then(async (r) => {
        if (r.status === 401) {
          handleUnauthorized()
          throw new Error('Session expired')
        }
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
      })
      .then(() => {
        setEditingLease(null)
        setEditUnitPcts({})
        setEditNotes('')
        setEditBrokerUserId('')
        setEditReplaceUnitsEnabled(false)
        editReplaceCascade.resetAll()
        reloadDashboardMetrics()
        setLeaseListNonce((n) => n + 1)
      })
      .catch((e: Error) => setEditErr(e.message))
      .finally(() => setEditSaving(false))
  }

  const submitDeleteLease = () => {
    if (!token || !deletingLease) return
    setDeleteSaving(true)
    setDeleteErr(null)
    fetch(apiUrl(`/api/v1/leases/${deletingLease.id}`), {
      method: 'DELETE',
      headers: authHeaders(token),
    })
      .then(async (r) => {
        if (r.status === 401) {
          handleUnauthorized()
          throw new Error('Session expired')
        }
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
      })
      .then(() => {
        setDeletingLease(null)
        reloadDashboardMetrics()
        setLeaseListNonce((n) => n + 1)
      })
      .catch((e: Error) => setDeleteErr(e.message))
      .finally(() => setDeleteSaving(false))
  }

  const editBrokerOptions = useMemo(() => {
    const list = [...orgStaffList]
    const bu = editingLease?.brokerUser
    if (bu && !list.some((u) => u.id === bu.id)) {
      list.unshift({
        id: bu.id,
        email: bu.email,
        displayName: bu.displayName,
        role: '',
      })
    }
    return list
  }, [orgStaffList, editingLease?.brokerUser])

  return (
    <>
      <PageHeader title="Leases" />
      {canWriteProperty && (
        <Box sx={{ mb: 3 }}>
        <SectionCard
          title="Create lease"
          subtitle="Choose portfolio, building, and floor, then units. Switch floor or building to add more units (same portfolio). SUPER_ADMIN, ORG_ADMIN, or PORTFOLIO_MANAGER."
          icon={<AddOutlined />}
        >
          <Stack
            component="form"
            spacing={2}
            onSubmit={submitCreateLease}
            sx={{ maxWidth: 720 }}
          >
            {portfoliosErr && (
              <Alert severity="warning" variant="outlined">
                {portfoliosErr}
              </Alert>
            )}
            {createCascade.hierarchyErr && (
              <Alert severity="warning" variant="outlined">
                {createCascade.hierarchyErr}
              </Alert>
            )}
            {createErr && (
              <Alert severity="error" variant="outlined">
                {createErr}
              </Alert>
            )}
            {!portfoliosErr && portfolios === null && (
              <Stack spacing={1}>
                <Skeleton height={40} />
                <Skeleton height={40} />
              </Stack>
            )}
            {!portfoliosErr && portfolios && portfolios.length === 0 && (
              <Typography color="text.secondary">
                No portfolios yet — create one from the dashboard first.
              </Typography>
            )}
            {!portfoliosErr && portfolios && portfolios.length > 0 && (
              <>
                <LeaseUnitCascadeFields
                  idPrefix="create-lease"
                  portfolios={portfolios}
                  c={createCascade}
                />
                <TenantAsyncPicker
                  token={token}
                  value={createTenantId}
                  onChange={setCreateTenantId}
                  label="Tenant"
                  allowClear
                  sx={{ maxWidth: 720, width: '100%' }}
                  onUnauthorized={handleUnauthorized}
                />
                {orgStaffErr ? (
                  <Alert severity="warning" variant="outlined">
                    {orgStaffErr}
                  </Alert>
                ) : null}
                <Autocomplete
                  size="small"
                  sx={{ maxWidth: 720, width: '100%' }}
                  options={orgStaffList}
                  loading={orgStaffLoading}
                  getOptionLabel={orgStaffOptionLabel}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  value={orgStaffList.find((u) => u.id === createBrokerUserId) ?? null}
                  onChange={(_, v) => setCreateBrokerUserId(v?.id ?? '')}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Collection broker (optional)"
                      placeholder="None"
                    />
                  )}
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label="Start date"
                    type="date"
                    size="small"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    value={createStart}
                    onChange={(e) => setCreateStart(e.target.value)}
                  />
                  <TextField
                    label="End date"
                    type="date"
                    size="small"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    value={createEnd}
                    onChange={(e) => setCreateEnd(e.target.value)}
                  />
                </Stack>
                <FormControl fullWidth size="small" sx={{ maxWidth: 360 }}>
                  <InputLabel id="create-lease-status-label">Status</InputLabel>
                  <Select
                    labelId="create-lease-status-label"
                    label="Status"
                    value={createStatus}
                    onChange={(e) => setCreateStatus(e.target.value)}
                  >
                    {LEASE_CREATE_STATUSES.map((s) => (
                      <MenuItem key={s} value={s}>
                        {s.replace(/_/g, ' ')}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="Notes (optional)"
                  size="small"
                  fullWidth
                  multiline
                  minRows={2}
                  placeholder="Stored on the lease as terms.notes"
                  value={createNotes}
                  onChange={(e) => setCreateNotes(e.target.value)}
                />
                <Box>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={createSaving}
                  >
                    {createSaving ? 'Creating…' : 'Create lease'}
                  </Button>
                </Box>
              </>
            )}
          </Stack>
        </SectionCard>
        </Box>
      )}
      <SectionCard
        title="Leases"
        subtitle="Async tenant filter and server search (tenant names, unit codes, status enum). Billing pages share the selected lease via the shell and ?leaseId=. Pagination below."
        icon={<AssignmentOutlined />}
        action={
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            useFlexGap
            sx={{ width: { xs: '100%', sm: 'auto' }, alignItems: { sm: 'center' } }}
          >
            <TenantAsyncPicker
              token={token}
              value={leaseTenantFilter}
              onChange={setLeaseTenantFilter}
              label="Tenant"
              allowClear
              sx={{
                minWidth: { xs: '100%', sm: 220 },
                ...sectionCardHeaderOutlinedSx,
              }}
              onUnauthorized={handleUnauthorized}
            />
            <TextField
              size="small"
              placeholder="Search…"
              value={leaseSearch}
              onChange={(e) => setLeaseSearch(e.target.value)}
              aria-label="Filter leases in list"
              sx={{
                minWidth: { xs: '100%', sm: 220 },
                ...sectionCardHeaderOutlinedSx,
              }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchOutlined
                        fontSize="small"
                        sx={{ color: 'text.secondary' }}
                      />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Stack>
        }
      >
        {leaseListErr && (
          <Alert severity="warning" variant="outlined">
            {leaseListErr}
          </Alert>
        )}
        {leaseListRows === null && leaseListLoading && (
          <Stack spacing={1}>
            <Skeleton height={40} />
            <Skeleton height={40} />
          </Stack>
        )}
        {leaseListRows !== null &&
          leaseListTotal === 0 &&
          !leaseListErr &&
          !leaseListLoading && (
            <Typography color="text.secondary">
              {debouncedLeaseSearch || leaseTenantFilter
                ? 'No leases match this filter or search.'
                : 'No leases yet.'}
            </Typography>
          )}
        {leaseListRows !== null && leaseListTotal > 0 && (
          <>
            <TableContainer
              sx={{
                borderRadius: 2,
                border: 1,
                borderColor: 'divider',
                overflow: 'hidden',
              }}
            >
              <Table
                size="small"
                sx={{ '& tbody tr:hover': { bgcolor: 'action.hover' } }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell>Tenant</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Start</TableCell>
                    <TableCell>End</TableCell>
                    <TableCell>Units</TableCell>
                    <TableCell>Broker</TableCell>
                    <TableCell align="right" width={canWriteProperty ? 148 : 56}>
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {leaseListRows.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <Typography fontWeight={600}>
                          {l.tenant.tradingName ?? l.tenant.legalName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={l.status.replace(/_/g, ' ')}
                          color={leaseStatusChipColor(l.status)}
                          variant="outlined"
                          sx={{ fontWeight: 600, textTransform: 'capitalize' }}
                        />
                      </TableCell>
                      <TableCell>
                        {new Date(l.startDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {new Date(l.endDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell
                        sx={{
                          fontFamily: 'JetBrains Mono, monospace',
                          fontSize: '0.85rem',
                        }}
                      >
                        {l.leaseUnits.map(formatLeaseUnitCell).join(', ') || '—'}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 160 }}>
                          {l.brokerUser
                            ? l.brokerUser.displayName?.trim() || l.brokerUser.email
                            : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          aria-label="View lease"
                          onClick={() => setViewingLease(l)}
                        >
                          <VisibilityOutlined fontSize="small" />
                        </IconButton>
                        {canWriteProperty && (
                          <>
                            <IconButton
                              size="small"
                              aria-label="Edit lease"
                              onClick={() => openEditLease(l)}
                            >
                              <EditOutlined fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              aria-label="Delete lease"
                              onClick={() => {
                                setDeleteErr(null)
                                setDeletingLease(l)
                              }}
                            >
                              <DeleteOutlineOutlined fontSize="small" />
                            </IconButton>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={leaseListTotal}
              page={leaseListPage}
              onPageChange={(_, p) => setLeaseListPage(p)}
              rowsPerPage={leaseListPageSize}
              onRowsPerPageChange={(e) => {
                setLeaseListPageSize(Number.parseInt(e.target.value, 10))
                setLeaseListPage(0)
              }}
              rowsPerPageOptions={[...ADMIN_TABLE_PAGE_SIZES]}
            />
          </>
        )}
      </SectionCard>

      <Dialog
        open={viewingLease !== null}
        onClose={() => setViewingLease(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Lease details</DialogTitle>
        <DialogContent>
          {viewingLease && (
            <LeaseViewDialogBody
              lease={viewingLease}
              onNavigateBilling={() => setViewingLease(null)}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setViewingLease(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={editingLease !== null}
        onClose={() => {
          if (!editSaving) {
            setEditingLease(null)
            setEditUnitPcts({})
            setEditNotes('')
            setEditBrokerUserId('')
            setEditReplaceUnitsEnabled(false)
            editReplaceCascade.resetAll()
          }
        }}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          Edit lease
          {editingLease && (
            <Typography component="span" variant="body2" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
              {editingLease.tenant.tradingName ?? editingLease.tenant.legalName} ·{' '}
              {editingLease.leaseUnits.map(formatLeaseUnitCell).join(', ') || '—'}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {editErr && (
              <Alert severity="error" variant="outlined">
                {editErr}
              </Alert>
            )}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Start date"
                type="date"
                size="small"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={editStart}
                onChange={(e) => setEditStart(e.target.value)}
                disabled={editSaving}
              />
              <TextField
                label="End date"
                type="date"
                size="small"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={editEnd}
                onChange={(e) => setEditEnd(e.target.value)}
                disabled={editSaving}
              />
            </Stack>
            <FormControl fullWidth size="small" sx={{ maxWidth: 360 }}>
              <InputLabel id="edit-lease-status-label">Status</InputLabel>
              <Select
                labelId="edit-lease-status-label"
                label="Status"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                disabled={editSaving}
              >
                {LEASE_CREATE_STATUSES.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {orgStaffErr ? (
              <Alert severity="warning" variant="outlined">
                {orgStaffErr}
              </Alert>
            ) : null}
            <Autocomplete
              size="small"
              sx={{ maxWidth: 480 }}
              options={editBrokerOptions}
              loading={orgStaffLoading}
              getOptionLabel={orgStaffOptionLabel}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              value={editBrokerOptions.find((u) => u.id === editBrokerUserId) ?? null}
              onChange={(_, v) => setEditBrokerUserId(v?.id ?? '')}
              disabled={editSaving}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Collection broker (optional)"
                  placeholder="None"
                />
              )}
            />
            <TextField
              label="Notes (optional)"
              size="small"
              fullWidth
              multiline
              minRows={2}
              placeholder="Stored as terms.notes; other JSON keys are preserved on save"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              disabled={editSaving}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={editReplaceUnitsEnabled}
                  onChange={(e) => {
                    const on = e.target.checked
                    setEditReplaceUnitsEnabled(on)
                    if (!on) editReplaceCascade.resetAll()
                  }}
                  disabled={editSaving}
                />
              }
              label="Replace unit links (portfolio → floor picker)"
            />
            {editReplaceUnitsEnabled && portfolios === null && (
              <Stack spacing={1}>
                <Skeleton height={40} />
                <Skeleton height={40} />
              </Stack>
            )}
            {editReplaceUnitsEnabled && portfolios && portfolios.length === 0 && (
              <Typography color="text.secondary" variant="body2">
                No portfolios available.
              </Typography>
            )}
            {editReplaceUnitsEnabled && portfolios && portfolios.length > 0 && (
              <Stack spacing={2}>
                {editReplaceCascade.hierarchyErr && (
                  <Alert severity="warning" variant="outlined">
                    {editReplaceCascade.hierarchyErr}
                  </Alert>
                )}
                <LeaseUnitCascadeFields
                  idPrefix="edit-lease-rep"
                  portfolios={portfolios}
                  c={editReplaceCascade}
                  disabled={editSaving}
                  allocationCaption="Allocation % per unit (0.0001–100). Change floor or building to add more."
                />
              </Stack>
            )}
            {!editReplaceUnitsEnabled &&
              editingLease &&
              editingLease.leaseUnits.length > 0 && (
                <Stack spacing={1.5}>
                  <Typography variant="caption" color="text.secondary">
                    Unit allocation % (replaces lines on save; 0.0001–100 each).
                  </Typography>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1.5}
                    useFlexGap
                    sx={{ flexWrap: 'wrap' }}
                  >
                    {editingLease.leaseUnits.map((lu) => (
                      <TextField
                        key={lu.unit.id}
                        size="small"
                        label={`${lu.unit.code} · %`}
                        type="text"
                        inputMode="decimal"
                        sx={{ width: { xs: '100%', sm: 140 } }}
                        value={editUnitPcts[lu.unit.id] ?? '100'}
                        onChange={(e) => {
                          const t = e.target.value
                          setEditUnitPcts((prev) => ({
                            ...prev,
                            [lu.unit.id]: t,
                          }))
                        }}
                        disabled={editSaving}
                      />
                    ))}
                  </Stack>
                </Stack>
              )}
            {!editReplaceUnitsEnabled &&
              editingLease &&
              editingLease.leaseUnits.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No units on this lease. Turn on “Replace unit links” to choose
                  units.
                </Typography>
              )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setEditingLease(null)
              setEditUnitPcts({})
              setEditNotes('')
              setEditBrokerUserId('')
              setEditReplaceUnitsEnabled(false)
              editReplaceCascade.resetAll()
            }}
            disabled={editSaving}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={submitEditLease}
            disabled={editSaving}
          >
            {editSaving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deletingLease !== null}
        onClose={() => {
          if (!deleteSaving) {
            setDeletingLease(null)
            setDeleteErr(null)
          }
        }}
      >
        <DialogTitle>Delete lease?</DialogTitle>
        <DialogContent>
          {deleteErr && (
            <Alert severity="error" variant="outlined" sx={{ mb: 2 }}>
              {deleteErr}
            </Alert>
          )}
          <Typography variant="body2" color="text.secondary">
            This removes the lease and its charge schedules. If invoices or ledger entries still
            reference this lease, the server will reject the delete.
          </Typography>
          {deletingLease && (
            <Typography sx={{ mt: 1.5 }} fontWeight={600}>
              {deletingLease.tenant.tradingName ?? deletingLease.tenant.legalName} ·{' '}
              {deletingLease.leaseUnits.map(formatLeaseUnitCell).join(', ') || '—'}
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setDeletingLease(null)
              setDeleteErr(null)
            }}
            disabled={deleteSaving}
          >
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={submitDeleteLease}
            disabled={deleteSaving}
          >
            {deleteSaving ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export function BillingSchedulesPage() {
  const { token, signOut, billingLeaseId, setBillingLeaseId, canWriteBilling } =
    useDashboard()

  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const handleUnauthorized = useCallback(() => {
    signOut()
  }, [signOut])

  const setLeaseForSchedules = useCallback(
    (id: string) => {
      setBillingLeaseId(id)
      const next = new URLSearchParams(searchParams.toString())
      if (id) next.set('leaseId', id)
      else next.delete('leaseId')
      const q = next.toString()
      navigate(`${location.pathname}${q ? `?${q}` : ''}`, { replace: true })
    },
    [setBillingLeaseId, searchParams, navigate, location.pathname],
  )

  const [scheduleRows, setScheduleRows] = useState<ChargeScheduleRow[] | null>(null)
  const [scheduleErr, setScheduleErr] = useState<string | null>(null)
  const [listNonce, setListNonce] = useState(0)
  const scheduleFetchLeaseRef = useRef<string>('')

  const reloadSchedules = useCallback(() => {
    setListNonce((n) => n + 1)
  }, [])

  useEffect(() => {
    if (!token) return
    if (!billingLeaseId) {
      scheduleFetchLeaseRef.current = ''
      setScheduleRows(null)
      setScheduleErr(null)
      return
    }
    let cancelled = false
    const leaseChanged = scheduleFetchLeaseRef.current !== billingLeaseId
    if (leaseChanged) {
      scheduleFetchLeaseRef.current = billingLeaseId
      setScheduleRows(null)
    }
    setScheduleErr(null)
    fetch(
      apiUrl(`/api/v1/billing/charge-schedules?leaseId=${encodeURIComponent(billingLeaseId)}`),
      { headers: authHeaders(token) },
    )
      .then(async (r) => {
        if (r.status === 401) {
          handleUnauthorized()
          throw new Error('Session expired')
        }
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
        return r.json() as Promise<ChargeScheduleRow[]>
      })
      .then((data) => {
        if (!cancelled) setScheduleRows(data)
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setScheduleErr(e.message)
          setScheduleRows([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [token, billingLeaseId, listNonce, handleUnauthorized])

  const [createOpen, setCreateOpen] = useState(false)
  const [createKind, setCreateKind] = useState<(typeof CHARGE_SCHEDULE_KINDS)[number]>('RENT')
  const [createLabel, setCreateLabel] = useState('')
  const [createAmount, setCreateAmount] = useState('')
  const [createCurrency, setCreateCurrency] = useState('ZAR')
  const [createFrequency, setCreateFrequency] = useState<
    (typeof CHARGE_SCHEDULE_FREQUENCIES)[number]
  >('MONTHLY')
  const [createStartDate, setCreateStartDate] = useState('')
  const [createEndDate, setCreateEndDate] = useState('')
  const [createActive, setCreateActive] = useState(true)
  const [createSaving, setCreateSaving] = useState(false)
  const [createErr, setCreateErr] = useState<string | null>(null)

  const [editingRow, setEditingRow] = useState<ChargeScheduleRow | null>(null)
  const [editKind, setEditKind] = useState<(typeof CHARGE_SCHEDULE_KINDS)[number]>('RENT')
  const [editLabel, setEditLabel] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editCurrency, setEditCurrency] = useState('ZAR')
  const [editFrequency, setEditFrequency] = useState<
    (typeof CHARGE_SCHEDULE_FREQUENCIES)[number]
  >('MONTHLY')
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')
  const [editActive, setEditActive] = useState(true)
  const [editSaving, setEditSaving] = useState(false)
  const [editErr, setEditErr] = useState<string | null>(null)

  const [deletingRow, setDeletingRow] = useState<ChargeScheduleRow | null>(null)
  const [deleteSaving, setDeleteSaving] = useState(false)
  const [deleteErr, setDeleteErr] = useState<string | null>(null)

  const [scheduleVisibilityFilter, setScheduleVisibilityFilter] =
    useState<ChargeScheduleVisibility>('all')

  useEffect(() => {
    setScheduleVisibilityFilter('all')
  }, [billingLeaseId])

  const [scheduleDragId, setScheduleDragId] = useState<string | null>(null)
  const [scheduleDragOverId, setScheduleDragOverId] = useState<string | null>(null)
  const [createDialogMode, setCreateDialogMode] = useState<'new' | 'duplicate'>('new')

  const scheduleReorderEnabled = Boolean(
    canWriteBilling &&
      scheduleVisibilityFilter === 'all' &&
      (scheduleRows?.length ?? 0) > 1,
  )

  const persistChargeScheduleOrder = useCallback(
    (ordered: ChargeScheduleRow[]) => {
      if (!token || !billingLeaseId) return
      setScheduleRows(ordered)
      fetch(apiUrl('/api/v1/billing/charge-schedules/reorder'), {
        method: 'POST',
        headers: {
          ...authHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          leaseId: billingLeaseId,
          chargeScheduleIds: ordered.map((r) => r.id),
        }),
      })
        .then(async (r) => {
          if (r.status === 401) {
            handleUnauthorized()
            throw new Error('Session expired')
          }
          if (!r.ok) throw new Error(await readApiErrorMessage(r))
        })
        .catch(() => {
          reloadSchedules()
        })
    },
    [token, billingLeaseId, handleUnauthorized, reloadSchedules],
  )

  const visibleScheduleRows = useMemo(() => {
    if (!scheduleRows) return null
    if (scheduleVisibilityFilter === 'active') {
      return scheduleRows.filter((r) => r.active)
    }
    if (scheduleVisibilityFilter === 'inactive') {
      return scheduleRows.filter((r) => !r.active)
    }
    return scheduleRows
  }, [scheduleRows, scheduleVisibilityFilter])

  const openCreate = () => {
    setCreateDialogMode('new')
    setCreateKind('RENT')
    setCreateLabel('')
    setCreateAmount('')
    setCreateCurrency('ZAR')
    setCreateFrequency('MONTHLY')
    setCreateStartDate(new Date().toISOString().slice(0, 10))
    setCreateEndDate('')
    setCreateActive(true)
    setCreateErr(null)
    setCreateOpen(true)
  }

  const openDuplicate = (c: ChargeScheduleRow) => {
    setCreateDialogMode('duplicate')
    setCreateKind(c.kind as (typeof CHARGE_SCHEDULE_KINDS)[number])
    const base = (c.label ?? '').trim()
    setCreateLabel(base ? `${base} (copy)` : '')
    setCreateAmount(String(Number(c.amount)))
    setCreateCurrency(c.currency)
    setCreateFrequency(c.frequency as (typeof CHARGE_SCHEDULE_FREQUENCIES)[number])
    setCreateStartDate(leaseDateToInputValue(c.startDate))
    setCreateEndDate(c.endDate ? leaseDateToInputValue(c.endDate) : '')
    setCreateActive(c.active)
    setCreateErr(null)
    setCreateOpen(true)
  }

  const submitCreate = () => {
    if (!token || !billingLeaseId) return
    const amt = parseFloat(createAmount.replace(',', '.'))
    if (!Number.isFinite(amt) || amt < 0.01) {
      setCreateErr('Amount must be at least 0.01.')
      return
    }
    if (!createStartDate.trim()) {
      setCreateErr('Start date is required.')
      return
    }
    const cur = createCurrency.trim().toUpperCase()
    if (cur.length !== 3) {
      setCreateErr('Currency must be a 3-letter code (e.g. ZAR).')
      return
    }
    setCreateSaving(true)
    setCreateErr(null)
    const body: Record<string, unknown> = {
      leaseId: billingLeaseId,
      kind: createKind,
      amount: amt,
      currency: cur,
      frequency: createFrequency,
      startDate: createStartDate,
      active: createActive,
    }
    const lab = createLabel.trim()
    if (lab) body.label = lab
    const end = createEndDate.trim()
    if (end) body.endDate = end
    fetch(apiUrl('/api/v1/billing/charge-schedules'), {
      method: 'POST',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
      .then(async (r) => {
        if (r.status === 401) {
          handleUnauthorized()
          throw new Error('Session expired')
        }
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
      })
      .then(() => {
        setCreateOpen(false)
        reloadSchedules()
      })
      .catch((e: Error) => setCreateErr(e.message))
      .finally(() => setCreateSaving(false))
  }

  const openEdit = (c: ChargeScheduleRow) => {
    setEditingRow(c)
    setEditKind(c.kind as (typeof CHARGE_SCHEDULE_KINDS)[number])
    setEditLabel(c.label ?? '')
    setEditAmount(String(Number(c.amount)))
    setEditCurrency(c.currency)
    setEditFrequency(c.frequency as (typeof CHARGE_SCHEDULE_FREQUENCIES)[number])
    setEditStartDate(leaseDateToInputValue(c.startDate))
    setEditEndDate(c.endDate ? leaseDateToInputValue(c.endDate) : '')
    setEditActive(c.active)
    setEditErr(null)
  }

  const submitEdit = () => {
    if (!token || !editingRow) return
    const amt = parseFloat(editAmount.replace(',', '.'))
    if (!Number.isFinite(amt) || amt < 0.01) {
      setEditErr('Amount must be at least 0.01.')
      return
    }
    if (!editStartDate.trim()) {
      setEditErr('Start date is required.')
      return
    }
    const cur = editCurrency.trim().toUpperCase()
    if (cur.length !== 3) {
      setEditErr('Currency must be a 3-letter code (e.g. ZAR).')
      return
    }
    setEditSaving(true)
    setEditErr(null)
    const body: Record<string, unknown> = {
      kind: editKind,
      amount: amt,
      currency: cur,
      frequency: editFrequency,
      startDate: editStartDate,
      active: editActive,
    }
    const lab = editLabel.trim()
    body.label = lab.length > 0 ? lab : null
    const end = editEndDate.trim()
    body.endDate = end.length > 0 ? end : null
    fetch(apiUrl(`/api/v1/billing/charge-schedules/${editingRow.id}`), {
      method: 'PATCH',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
      .then(async (r) => {
        if (r.status === 401) {
          handleUnauthorized()
          throw new Error('Session expired')
        }
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
      })
      .then(() => {
        setEditingRow(null)
        reloadSchedules()
      })
      .catch((e: Error) => setEditErr(e.message))
      .finally(() => setEditSaving(false))
  }

  const submitDelete = () => {
    if (!token || !deletingRow) return
    setDeleteSaving(true)
    setDeleteErr(null)
    fetch(apiUrl(`/api/v1/billing/charge-schedules/${deletingRow.id}`), {
      method: 'DELETE',
      headers: authHeaders(token),
    })
      .then(async (r) => {
        if (r.status === 401) {
          handleUnauthorized()
          throw new Error('Session expired')
        }
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
      })
      .then(() => {
        setDeletingRow(null)
        reloadSchedules()
      })
      .catch((e: Error) => setDeleteErr(e.message))
      .finally(() => setDeleteSaving(false))
  }

  return (
    <>
      <PageHeader title="Charge schedules" />
      <SectionCard
        title="Charge schedules"
        subtitle="Recurring charges per lease (rent, CAM, etc.). Row order is saved and used for listing; drag handles when showing All schedules. Lease in URL for sharing. Writes: SUPER_ADMIN, ORG_ADMIN, FINANCE."
        icon={<ScheduleOutlined />}
        action={
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <LeaseAsyncPicker
              token={token}
              value={billingLeaseId}
              onChange={setLeaseForSchedules}
              label="Lease"
              sx={{ minWidth: 280 }}
              onUnauthorized={handleUnauthorized}
            />
            {canWriteBilling && billingLeaseId ? (
              <Button
                variant="contained"
                size="small"
                startIcon={<AddOutlined />}
                onClick={openCreate}
              >
                Add schedule
              </Button>
            ) : null}
          </Stack>
        }
      >
        {scheduleErr && (
          <Alert severity="warning" variant="outlined">
            {scheduleErr}
          </Alert>
        )}
        {!scheduleErr && scheduleRows === null && billingLeaseId && (
          <Stack spacing={1}>
            <Skeleton height={36} />
            <Skeleton height={36} />
          </Stack>
        )}
        {!billingLeaseId && (
          <Typography color="text.secondary">
            Pick a lease above, or{' '}
            <Button component={RouterLink} to="/leases" size="small" sx={{ p: 0, minWidth: 0 }}>
              open the Leases page
            </Button>{' '}
            to create one.
          </Typography>
        )}
        {billingLeaseId && scheduleRows !== null && (
          <>
            {scheduleRows.length === 0 && (
              <Typography color="text.secondary" sx={{ mb: canWriteBilling ? 2 : 0 }}>
                No charge schedules for this lease yet.
              </Typography>
            )}
            {scheduleRows.length > 0 && (
              <>
                <Stack direction="row" alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 2 }} gap={2}>
                  <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
                    <Typography variant="body2" color="text.secondary" component="span">
                      Show
                    </Typography>
                    <ToggleButtonGroup
                      exclusive
                      value={scheduleVisibilityFilter}
                      onChange={(_, v: ChargeScheduleVisibility | null) => {
                        if (v != null) setScheduleVisibilityFilter(v)
                      }}
                      size="small"
                      aria-label="Filter schedules by active state"
                    >
                      <ToggleButton value="all">All</ToggleButton>
                      <ToggleButton value="active">Active</ToggleButton>
                      <ToggleButton value="inactive">Inactive</ToggleButton>
                    </ToggleButtonGroup>
                  </Stack>
                  {canWriteBilling && (scheduleRows?.length ?? 0) > 1 ? (
                    <Typography variant="caption" color="text.secondary">
                      {scheduleVisibilityFilter !== 'all'
                        ? 'Choose All to reorder every row for this lease.'
                        : 'Drag the handle to reorder (saved for this lease).'}
                    </Typography>
                  ) : null}
                </Stack>
                {visibleScheduleRows && visibleScheduleRows.length === 0 ? (
                  <Typography color="text.secondary">
                    {scheduleVisibilityFilter === 'active'
                      ? 'No active schedules. Choose All or Inactive to see other rows.'
                      : 'No inactive schedules. Choose All or Active to see other rows.'}
                  </Typography>
                ) : (
                  <TableContainer
                    sx={{
                      borderRadius: 2,
                      border: 1,
                      borderColor: 'divider',
                      overflow: 'hidden',
                    }}
                  >
                    <Table
                      size="small"
                      sx={{ '& tbody tr:hover': { bgcolor: 'action.hover' } }}
                    >
                      <TableHead>
                        <TableRow>
                          {scheduleReorderEnabled ? (
                            <TableCell width={44} padding="checkbox" aria-label="Reorder" />
                          ) : null}
                          <TableCell>Kind</TableCell>
                          <TableCell>Label</TableCell>
                          <TableCell align="right">Amount</TableCell>
                          <TableCell>Frequency</TableCell>
                          <TableCell>Period</TableCell>
                          <TableCell>Active</TableCell>
                          {canWriteBilling && (
                            <TableCell align="right" width={132}>
                              Actions
                            </TableCell>
                          )}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(visibleScheduleRows ?? []).map((c) => (
                          <TableRow
                            key={c.id}
                            onDragOver={
                              scheduleReorderEnabled
                                ? (e) => {
                                    e.preventDefault()
                                    e.dataTransfer.dropEffect = 'move'
                                    if (c.id !== scheduleDragId) {
                                      setScheduleDragOverId(c.id)
                                    }
                                  }
                                : undefined
                            }
                            onDragLeave={
                              scheduleReorderEnabled
                                ? () => {
                                    setScheduleDragOverId((cur) =>
                                      cur === c.id ? null : cur,
                                    )
                                  }
                                : undefined
                            }
                            onDrop={
                              scheduleReorderEnabled
                                ? (e) => {
                                    e.preventDefault()
                                    const fromId = e.dataTransfer.getData('text/plain')
                                    setScheduleDragOverId(null)
                                    setScheduleDragId(null)
                                    if (!fromId || !scheduleRows) return
                                    const from = scheduleRows.findIndex((x) => x.id === fromId)
                                    const to = scheduleRows.findIndex((x) => x.id === c.id)
                                    if (from < 0 || to < 0 || from === to) return
                                    const next = [...scheduleRows]
                                    const [rem] = next.splice(from, 1)
                                    next.splice(to, 0, rem)
                                    persistChargeScheduleOrder(next)
                                  }
                                : undefined
                            }
                            sx={{
                              ...(scheduleDragOverId === c.id &&
                              scheduleDragId &&
                              scheduleDragId !== c.id
                                ? {
                                    outline: '2px dashed',
                                    outlineOffset: -2,
                                    outlineColor: 'primary.main',
                                  }
                                : {}),
                            }}
                          >
                            {scheduleReorderEnabled ? (
                              <TableCell padding="checkbox">
                                <IconButton
                                  size="small"
                                  draggable
                                  onDragStart={(e) => {
                                    e.dataTransfer.setData('text/plain', c.id)
                                    e.dataTransfer.effectAllowed = 'move'
                                    setScheduleDragId(c.id)
                                  }}
                                  onDragEnd={() => {
                                    setScheduleDragId(null)
                                    setScheduleDragOverId(null)
                                  }}
                                  sx={{ cursor: 'grab' }}
                                  aria-label="Drag to reorder schedule"
                                >
                                  <DragIndicatorOutlined fontSize="small" />
                                </IconButton>
                              </TableCell>
                            ) : null}
                            <TableCell
                              sx={{
                                fontFamily: 'JetBrains Mono, monospace',
                                fontSize: '0.8rem',
                              }}
                            >
                              {c.kind}
                            </TableCell>
                            <TableCell>{c.label ?? '—'}</TableCell>
                            <TableCell align="right">
                              {c.currency}{' '}
                              {Number(c.amount).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                              })}
                            </TableCell>
                            <TableCell>{c.frequency}</TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                              {leaseDateToInputValue(c.startDate)}
                              {c.endDate ? ` → ${leaseDateToInputValue(c.endDate)}` : ''}
                            </TableCell>
                            <TableCell>{c.active ? 'Yes' : 'No'}</TableCell>
                            {canWriteBilling && (
                              <TableCell align="right">
                                <IconButton
                                  size="small"
                                  aria-label="Duplicate charge schedule"
                                  onClick={() => openDuplicate(c)}
                                >
                                  <ContentCopyOutlined fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  aria-label="Edit charge schedule"
                                  onClick={() => openEdit(c)}
                                >
                                  <EditOutlined fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  aria-label="Delete charge schedule"
                                  onClick={() => {
                                    setDeleteErr(null)
                                    setDeletingRow(c)
                                  }}
                                >
                                  <DeleteOutlineOutlined fontSize="small" />
                                </IconButton>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </>
            )}
          </>
        )}
      </SectionCard>

      <Dialog
        open={createOpen}
        onClose={() => !createSaving && setCreateOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {createDialogMode === 'duplicate'
            ? 'Duplicate charge schedule'
            : 'New charge schedule'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {createErr && (
              <Alert severity="error" variant="outlined">
                {createErr}
              </Alert>
            )}
            {createDialogMode === 'duplicate' && (
              <Typography variant="body2" color="text.secondary">
                Pre-filled from an existing row — adjust dates or label, then create a new schedule.
              </Typography>
            )}
            <FormControl fullWidth size="small">
              <InputLabel id="cs-create-kind">Kind</InputLabel>
              <Select
                labelId="cs-create-kind"
                label="Kind"
                value={createKind}
                onChange={(e) =>
                  setCreateKind(e.target.value as (typeof CHARGE_SCHEDULE_KINDS)[number])
                }
              >
                {CHARGE_SCHEDULE_KINDS.map((k) => (
                  <MenuItem key={k} value={k}>
                    {k}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Label (optional)"
              size="small"
              fullWidth
              value={createLabel}
              onChange={(e) => setCreateLabel(e.target.value)}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Amount"
                size="small"
                fullWidth
                required
                type="number"
                inputProps={{ min: 0.01, step: '0.01' }}
                value={createAmount}
                onChange={(e) => setCreateAmount(e.target.value)}
              />
              <TextField
                label="Currency"
                size="small"
                fullWidth
                required
                inputProps={{ maxLength: 3 }}
                value={createCurrency}
                onChange={(e) => setCreateCurrency(e.target.value.toUpperCase())}
              />
            </Stack>
            <FormControl fullWidth size="small">
              <InputLabel id="cs-create-freq">Frequency</InputLabel>
              <Select
                labelId="cs-create-freq"
                label="Frequency"
                value={createFrequency}
                onChange={(e) =>
                  setCreateFrequency(
                    e.target.value as (typeof CHARGE_SCHEDULE_FREQUENCIES)[number],
                  )
                }
              >
                {CHARGE_SCHEDULE_FREQUENCIES.map((f) => (
                  <MenuItem key={f} value={f}>
                    {f}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Start date"
                type="date"
                size="small"
                fullWidth
                required
                value={createStartDate}
                onChange={(e) => setCreateStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="End date (optional)"
                type="date"
                size="small"
                fullWidth
                value={createEndDate}
                onChange={(e) => setCreateEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
            <FormControlLabel
              control={
                <Switch
                  checked={createActive}
                  onChange={(e) => setCreateActive(e.target.checked)}
                />
              }
              label="Active"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)} disabled={createSaving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={submitCreate} disabled={createSaving}>
            {createSaving
              ? 'Saving…'
              : createDialogMode === 'duplicate'
                ? 'Create copy'
                : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={editingRow !== null}
        onClose={() => !editSaving && setEditingRow(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Edit charge schedule</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {editErr && (
              <Alert severity="error" variant="outlined">
                {editErr}
              </Alert>
            )}
            <FormControl fullWidth size="small">
              <InputLabel id="cs-edit-kind">Kind</InputLabel>
              <Select
                labelId="cs-edit-kind"
                label="Kind"
                value={editKind}
                onChange={(e) =>
                  setEditKind(e.target.value as (typeof CHARGE_SCHEDULE_KINDS)[number])
                }
              >
                {CHARGE_SCHEDULE_KINDS.map((k) => (
                  <MenuItem key={k} value={k}>
                    {k}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Label (optional)"
              size="small"
              fullWidth
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Amount"
                size="small"
                fullWidth
                required
                type="number"
                inputProps={{ min: 0.01, step: '0.01' }}
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
              />
              <TextField
                label="Currency"
                size="small"
                fullWidth
                required
                inputProps={{ maxLength: 3 }}
                value={editCurrency}
                onChange={(e) => setEditCurrency(e.target.value.toUpperCase())}
              />
            </Stack>
            <FormControl fullWidth size="small">
              <InputLabel id="cs-edit-freq">Frequency</InputLabel>
              <Select
                labelId="cs-edit-freq"
                label="Frequency"
                value={editFrequency}
                onChange={(e) =>
                  setEditFrequency(
                    e.target.value as (typeof CHARGE_SCHEDULE_FREQUENCIES)[number],
                  )
                }
              >
                {CHARGE_SCHEDULE_FREQUENCIES.map((f) => (
                  <MenuItem key={f} value={f}>
                    {f}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Start date"
                type="date"
                size="small"
                fullWidth
                required
                value={editStartDate}
                onChange={(e) => setEditStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="End date (optional)"
                type="date"
                size="small"
                fullWidth
                value={editEndDate}
                onChange={(e) => setEditEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
            <FormControlLabel
              control={
                <Switch checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />
              }
              label="Active"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingRow(null)} disabled={editSaving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={submitEdit} disabled={editSaving}>
            {editSaving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deletingRow !== null}
        onClose={() => !deleteSaving && setDeletingRow(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Delete charge schedule?</DialogTitle>
        <DialogContent>
          {deleteErr && (
            <Alert severity="error" variant="outlined" sx={{ mb: 2 }}>
              {deleteErr}
            </Alert>
          )}
          {deletingRow && (
            <Typography variant="body2">
              Remove{' '}
              <strong>
                {deletingRow.kind}
                {deletingRow.label ? ` — ${deletingRow.label}` : ''}
              </strong>{' '}
              ({deletingRow.currency} {Number(deletingRow.amount).toLocaleString()},{' '}
              {deletingRow.frequency}). This cannot be undone.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeletingRow(null)} disabled={deleteSaving}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={submitDelete}
            disabled={deleteSaving}
          >
            {deleteSaving ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export function BillingInvoicesPage() {
  const {
    token,
    signOut,
    canWriteBilling,
    billingLeaseId,
    setBillingLeaseId,
    generateMonth,
    setGenerateMonth,
    generateSaving,
    handleGenerateFromSchedules,
    invoiceLineTotal,
    handleIssueInvoice,
    handleVoidInvoice,
    billingActionErr,
    setBillingActionErr,
  } = useDashboard()

  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const handleUnauthorized = useCallback(() => {
    signOut()
  }, [signOut])

  const setLeaseForGeneration = useCallback(
    (id: string) => {
      setBillingLeaseId(id)
      const next = new URLSearchParams(searchParams.toString())
      if (id) next.set('leaseId', id)
      else next.delete('leaseId')
      const q = next.toString()
      navigate(`${location.pathname}${q ? `?${q}` : ''}`, { replace: true })
    },
    [setBillingLeaseId, searchParams, navigate, location.pathname],
  )

  const [invoiceSearch, setInvoiceSearch] = useState('')
  const [debouncedInvoiceSearch, setDebouncedInvoiceSearch] = useState('')
  const [filterLeaseId, setFilterLeaseId] = useState('')
  const [filterTenantId, setFilterTenantId] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [periodFrom, setPeriodFrom] = useState('')
  const [periodTo, setPeriodTo] = useState('')

  const [invoiceListRows, setInvoiceListRows] = useState<BillingInvoiceRow[] | null>(
    null,
  )
  const [invoiceListTotal, setInvoiceListTotal] = useState(0)
  const [invoiceListPage, setInvoiceListPage] = useState(0)
  const [invoiceListPageSize, setInvoiceListPageSize] = useState(
    DEFAULT_ADMIN_TABLE_PAGE_SIZE,
  )
  const [invoiceListErr, setInvoiceListErr] = useState<string | null>(null)
  const [invoiceListLoading, setInvoiceListLoading] = useState(false)
  const [invoiceListNonce, setInvoiceListNonce] = useState(0)

  useEffect(() => {
    const id = window.setTimeout(
      () => setDebouncedInvoiceSearch(invoiceSearch.trim()),
      400,
    )
    return () => window.clearTimeout(id)
  }, [invoiceSearch])

  useEffect(() => {
    setInvoiceListPage(0)
  }, [
    debouncedInvoiceSearch,
    filterLeaseId,
    filterTenantId,
    filterStatus,
    periodFrom,
    periodTo,
  ])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setInvoiceListLoading(true)
    setInvoiceListErr(null)
    const params = new URLSearchParams({
      page: String(invoiceListPage + 1),
      pageSize: String(invoiceListPageSize),
    })
    if (debouncedInvoiceSearch) params.set('q', debouncedInvoiceSearch)
    if (filterLeaseId) params.set('leaseId', filterLeaseId)
    if (filterTenantId) params.set('tenantId', filterTenantId)
    if (filterStatus) params.set('status', filterStatus)
    if (periodFrom) params.set('periodFrom', periodFrom)
    if (periodTo) params.set('periodTo', periodTo)
    fetch(apiUrl(`/api/v1/billing/invoices?${params}`), { headers: authHeaders(token) })
      .then(async (r) => {
        if (r.status === 401) {
          handleUnauthorized()
          throw new Error('Session expired')
        }
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
        return r.json() as Promise<
          | BillingInvoiceRow[]
          | { items: BillingInvoiceRow[]; total: number; page: number; pageSize: number }
        >
      })
      .then((data) => {
        if (cancelled) return
        if (Array.isArray(data)) {
          setInvoiceListRows(data)
          setInvoiceListTotal(data.length)
          return
        }
        const rows = data.items
        const total = data.total
        if (rows.length === 0 && total > 0 && invoiceListPage > 0) {
          setInvoiceListPage(0)
          return
        }
        setInvoiceListRows(rows)
        setInvoiceListTotal(total)
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setInvoiceListErr(e.message)
          setInvoiceListRows([])
          setInvoiceListTotal(0)
        }
      })
      .finally(() => {
        if (!cancelled) setInvoiceListLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [
    token,
    invoiceListPage,
    invoiceListPageSize,
    debouncedInvoiceSearch,
    filterLeaseId,
    filterTenantId,
    filterStatus,
    periodFrom,
    periodTo,
    invoiceListNonce,
    handleUnauthorized,
  ])

  const buildInvoiceExportParams = () => {
    const params = new URLSearchParams()
    if (debouncedInvoiceSearch) params.set('q', debouncedInvoiceSearch)
    if (filterLeaseId) params.set('leaseId', filterLeaseId)
    if (filterTenantId) params.set('tenantId', filterTenantId)
    if (filterStatus) params.set('status', filterStatus)
    if (periodFrom) params.set('periodFrom', periodFrom)
    if (periodTo) params.set('periodTo', periodTo)
    return params
  }

  const downloadInvoiceCsv = () => {
    if (!token) return
    setBillingActionErr(null)
    const q = buildInvoiceExportParams()
    const suffix = q.toString() ? `?${q}` : ''
    fetch(apiUrl(`/api/v1/billing/invoices/export${suffix}`), { headers: authHeaders(token) })
      .then(async (r) => {
        if (r.status === 401) {
          handleUnauthorized()
          throw new Error('Session expired')
        }
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
        return r.blob()
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'sofinda-invoices.csv'
        a.click()
        URL.revokeObjectURL(url)
      })
      .catch((e: Error) => setBillingActionErr(e.message))
  }

  return (
    <>
      <PageHeader title="Invoices" />
      {billingActionErr && (
        <Alert
          severity="error"
          variant="outlined"
          sx={{ mb: 2 }}
          onClose={() => setBillingActionErr(null)}
        >
          {billingActionErr}
        </Alert>
      )}
      <SectionCard
        title="Invoices"
        subtitle="Server search, filters, and pagination. CSV export uses the same filters (one row per line). Draft generation uses the lease below when you can write billing."
        icon={<ReceiptLongOutlined />}
        action={
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Button variant="outlined" size="small" onClick={downloadInvoiceCsv}>
              Download CSV
            </Button>
            {canWriteBilling ? (
              <>
                <LeaseAsyncPicker
                  token={token}
                  value={billingLeaseId}
                  onChange={setLeaseForGeneration}
                  label="Lease for generation"
                  allowClear
                  sx={{ minWidth: 280 }}
                  onUnauthorized={handleUnauthorized}
                />
                <TextField
                  type="month"
                  size="small"
                  label="Billing month"
                  value={generateMonth}
                  onChange={(e) => setGenerateMonth(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ width: 168 }}
                />
                <Button
                  variant="contained"
                  size="small"
                  disabled={generateSaving || !billingLeaseId}
                  onClick={() => {
                    void handleGenerateFromSchedules()
                      .then(() => setInvoiceListNonce((n) => n + 1))
                      .catch(() => {})
                  }}
                >
                  {generateSaving ? 'Generating…' : 'Generate from schedules'}
                </Button>
              </>
            ) : null}
          </Stack>
        }
      >
        {canWriteBilling && !billingLeaseId && (
          <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
            Choose a lease above to generate a draft, or pick one on{' '}
            <Button component={RouterLink} to="/billing/schedules" size="small">
              Charge schedules
            </Button>
            .
          </Alert>
        )}

        <Stack spacing={2} sx={{ mb: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} flexWrap="wrap" useFlexGap>
            <TextField
              size="small"
              label="Search"
              placeholder="Tenant, notes, line text…"
              value={invoiceSearch}
              onChange={(e) => setInvoiceSearch(e.target.value)}
              sx={{ minWidth: 220, flex: 1 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlined fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="inv-filter-status">Status</InputLabel>
              <Select
                labelId="inv-filter-status"
                label="Status"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <MenuItem value="">
                  <em>All</em>
                </MenuItem>
                {INVOICE_FILTER_STATUSES.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <LeaseAsyncPicker
              token={token}
              value={filterLeaseId}
              onChange={setFilterLeaseId}
              label="Lease"
              allowClear
              sx={{ minWidth: 260, flex: 1 }}
              onUnauthorized={handleUnauthorized}
              tenantId={filterTenantId || undefined}
            />
            <TenantAsyncPicker
              token={token}
              value={filterTenantId}
              onChange={setFilterTenantId}
              label="Tenant"
              allowClear
              sx={{ minWidth: 200, flex: 1 }}
              onUnauthorized={handleUnauthorized}
            />
            <TextField
              label="Period from"
              type="date"
              size="small"
              value={periodFrom}
              onChange={(e) => setPeriodFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 160 }}
            />
            <TextField
              label="Period to"
              type="date"
              size="small"
              value={periodTo}
              onChange={(e) => setPeriodTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 160 }}
            />
          </Stack>
        </Stack>

        {invoiceListErr && (
          <Alert severity="warning" variant="outlined" sx={{ mb: 2 }}>
            {invoiceListErr}
          </Alert>
        )}
        {invoiceListLoading && invoiceListRows === null && (
          <Stack spacing={1}>
            <Skeleton height={40} />
            <Skeleton height={40} />
          </Stack>
        )}
        {!invoiceListLoading && invoiceListRows && invoiceListRows.length === 0 && (
          <Typography color="text.secondary">No invoices match these filters.</Typography>
        )}
        {invoiceListRows && invoiceListRows.length > 0 && (
          <>
            <TableContainer
              sx={{
                borderRadius: 2,
                border: 1,
                borderColor: 'divider',
                overflow: 'hidden',
              }}
            >
              <Table
                size="small"
                sx={{ '& tbody tr:hover': { bgcolor: 'action.hover' } }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell>Period</TableCell>
                    <TableCell>Tenant</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell>Lines</TableCell>
                    <TableCell align="center">Schedules</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invoiceListRows.map((inv) => (
                    <TableRow key={inv.id} hover>
                      <TableCell>
                        {new Date(inv.periodStart).toLocaleDateString()} –{' '}
                        {new Date(inv.periodEnd).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{invoiceTenantLabel(inv)}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={inv.status}
                          color={invoiceStatusChipColor(inv.status)}
                          variant="outlined"
                          sx={{ fontWeight: 600 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        {inv.currency}{' '}
                        {invoiceLineTotal(inv).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 280 }}>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {inv.lines.map((l) => l.description).join(' · ')}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        {(() => {
                          const n = inv.lines.length
                          const linked = inv.lines.filter((l) => l.chargeScheduleId).length
                          if (n === 0 || linked === 0) return '—'
                          return (
                            <Typography variant="body2" color="text.secondary">
                              {linked}/{n}
                            </Typography>
                          )
                        })()}
                      </TableCell>
                      <TableCell align="right">
                        <Stack
                          direction="row"
                          spacing={0.5}
                          justifyContent="flex-end"
                          flexWrap="wrap"
                          useFlexGap
                        >
                          <Button
                            size="small"
                            variant="outlined"
                            component={RouterLink}
                            to={`/billing/invoices/${inv.id}`}
                            startIcon={<VisibilityOutlined />}
                          >
                            View
                          </Button>
                          {canWriteBilling && inv.status === 'DRAFT' ? (
                            <>
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => {
                                  void handleIssueInvoice(inv.id)
                                    .then(() => setInvoiceListNonce((n) => n + 1))
                                    .catch(() => {})
                                }}
                              >
                                Issue
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => {
                                  void handleVoidInvoice(inv.id)
                                    .then(() => setInvoiceListNonce((n) => n + 1))
                                    .catch(() => {})
                                }}
                              >
                                Void
                              </Button>
                            </>
                          ) : null}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={invoiceListTotal}
              page={invoiceListPage}
              onPageChange={(_, p) => setInvoiceListPage(p)}
              rowsPerPage={invoiceListPageSize}
              onRowsPerPageChange={(e) => {
                setInvoiceListPageSize(Number.parseInt(e.target.value, 10))
                setInvoiceListPage(0)
              }}
              rowsPerPageOptions={[...ADMIN_TABLE_PAGE_SIZES]}
            />
          </>
        )}
      </SectionCard>
    </>
  )
}

export function BillingInvoiceDetailPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>()
  const {
    token,
    signOut,
    canWriteBilling,
    handleIssueInvoice,
    handleVoidInvoice,
    billingActionErr,
    setBillingActionErr,
    reloadDashboardMetrics,
  } = useDashboard()

  const handleUnauthorized = useCallback(() => {
    signOut()
  }, [signOut])

  const [inv, setInv] = useState<BillingInvoiceDetailRow | null>(null)
  const [detailErr, setDetailErr] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(true)
  const [actionBusy, setActionBusy] = useState(false)

  const [draftEditMode, setDraftEditMode] = useState(false)
  const [editPeriodStart, setEditPeriodStart] = useState('')
  const [editPeriodEnd, setEditPeriodEnd] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editLines, setEditLines] = useState<
    { description: string; amount: string; chargeScheduleId: string }[]
  >([])
  const [saveDraftErr, setSaveDraftErr] = useState<string | null>(null)
  const [saveDraftBusy, setSaveDraftBusy] = useState(false)
  const [draftScheduleOptions, setDraftScheduleOptions] = useState<ChargeScheduleRow[] | null>(null)
  const [draftScheduleErr, setDraftScheduleErr] = useState<string | null>(null)
  const [draftSchedulesLoading, setDraftSchedulesLoading] = useState(false)
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [emailTo, setEmailTo] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailMessage, setEmailMessage] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailErr, setEmailErr] = useState<string | null>(null)
  const [paymentRows, setPaymentRows] = useState<InvoicePaymentRow[] | null>(null)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentErr, setPaymentErr] = useState<string | null>(null)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNarrative, setPaymentNarrative] = useState('')
  const [paymentSaving, setPaymentSaving] = useState(false)
  const [paymentSaveErr, setPaymentSaveErr] = useState<string | null>(null)
  const [reversingPaymentId, setReversingPaymentId] = useState<string | null>(null)
  const [reverseDialogOpen, setReverseDialogOpen] = useState(false)
  const [reverseTarget, setReverseTarget] = useState<InvoicePaymentRow | null>(null)
  const [reverseReason, setReverseReason] = useState('')
  const [activityRows, setActivityRows] = useState<InvoiceActivityRow[] | null>(null)
  const [activityLoading, setActivityLoading] = useState(false)
  const [activityErr, setActivityErr] = useState<string | null>(null)

  useEffect(() => {
    if (!draftEditMode || !token || !inv || inv.status !== 'DRAFT') {
      setDraftScheduleOptions(null)
      setDraftScheduleErr(null)
      setDraftSchedulesLoading(false)
      return
    }
    let cancelled = false
    setDraftSchedulesLoading(true)
    setDraftScheduleErr(null)
    fetch(
      apiUrl(`/api/v1/billing/charge-schedules?leaseId=${encodeURIComponent(inv.leaseId)}`),
      { headers: authHeaders(token) },
    )
      .then(async (r) => {
        if (r.status === 401) {
          handleUnauthorized()
          throw new Error('Session expired')
        }
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
        return r.json() as Promise<ChargeScheduleRow[]>
      })
      .then((data) => {
        if (!cancelled) setDraftScheduleOptions(data)
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setDraftScheduleErr(e.message)
          setDraftScheduleOptions([])
        }
      })
      .finally(() => {
        if (!cancelled) setDraftSchedulesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [draftEditMode, inv, token, handleUnauthorized])

  const reloadDetail = useCallback(() => {
    if (!token || !invoiceId) return Promise.resolve()
    setDetailLoading(true)
    setDetailErr(null)
    return fetch(apiUrl(`/api/v1/billing/invoices/${encodeURIComponent(invoiceId)}`), {
      headers: authHeaders(token),
    })
      .then(async (r) => {
        if (r.status === 401) {
          handleUnauthorized()
          throw new Error('Session expired')
        }
        if (r.status === 404) {
          setInv(null)
          throw new Error('Invoice not found')
        }
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
        return r.json() as Promise<BillingInvoiceDetailRow>
      })
      .then((data) => setInv(data))
      .catch((e: Error) => {
        setInv(null)
        setDetailErr(e.message)
      })
      .finally(() => setDetailLoading(false))
  }, [token, invoiceId, handleUnauthorized])

  useEffect(() => {
    void reloadDetail()
  }, [reloadDetail])

  const reloadPayments = useCallback(() => {
    if (!token || !invoiceId || !inv || inv.status !== 'ISSUED') {
      setPaymentRows(null)
      setPaymentErr(null)
      setPaymentLoading(false)
      return Promise.resolve()
    }
    setPaymentLoading(true)
    setPaymentErr(null)
    return fetch(
      apiUrl(`/api/v1/billing/invoices/${encodeURIComponent(invoiceId)}/payments`),
      { headers: authHeaders(token) },
    )
      .then(async (r) => {
        if (r.status === 401) {
          handleUnauthorized()
          throw new Error('Session expired')
        }
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
        return r.json() as Promise<InvoicePaymentRow[]>
      })
      .then((data) => setPaymentRows(data))
      .catch((e: Error) => {
        setPaymentRows([])
        setPaymentErr(e.message)
      })
      .finally(() => setPaymentLoading(false))
  }, [token, invoiceId, inv, handleUnauthorized])

  useEffect(() => {
    void reloadPayments()
  }, [reloadPayments])

  const reloadActivity = useCallback(() => {
    if (!token || !invoiceId) {
      setActivityRows(null)
      setActivityErr(null)
      setActivityLoading(false)
      return Promise.resolve()
    }
    setActivityLoading(true)
    setActivityErr(null)
    return fetch(
      apiUrl(`/api/v1/billing/invoices/${encodeURIComponent(invoiceId)}/activity`),
      { headers: authHeaders(token) },
    )
      .then(async (r) => {
        if (r.status === 401) {
          handleUnauthorized()
          throw new Error('Session expired')
        }
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
        return r.json() as Promise<InvoiceActivityRow[]>
      })
      .then((data) => setActivityRows(data))
      .catch((e: Error) => {
        setActivityRows([])
        setActivityErr(e.message)
      })
      .finally(() => setActivityLoading(false))
  }, [token, invoiceId, handleUnauthorized])

  useEffect(() => {
    void reloadActivity()
  }, [reloadActivity])

  const submitReversePayment = useCallback(() => {
    if (!token || !invoiceId || !reverseTarget) return
    setReversingPaymentId(reverseTarget.id)
    setPaymentErr(null)
    fetch(
      apiUrl(`/api/v1/billing/invoices/${encodeURIComponent(invoiceId)}/payments/${encodeURIComponent(reverseTarget.id)}/reverse`),
      {
        method: 'POST',
        headers: {
          ...authHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...(reverseReason.trim() ? { reason: reverseReason.trim() } : {}),
        }),
      },
    )
      .then(async (r) => {
        if (r.status === 401) {
          handleUnauthorized()
          throw new Error('Session expired')
        }
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
      })
      .then(async () => {
        setReverseDialogOpen(false)
        setReverseTarget(null)
        setReverseReason('')
        await reloadPayments()
        await reloadActivity()
      })
      .catch((e: Error) => setPaymentErr(e.message))
      .finally(() => setReversingPaymentId(null))
  }, [
    token,
    invoiceId,
    reverseTarget,
    reverseReason,
    handleUnauthorized,
    reloadPayments,
    reloadActivity,
  ])

  const openDraftEdit = useCallback(() => {
    if (!inv || inv.status !== 'DRAFT') return
    setEditPeriodStart(leaseDateToInputValue(inv.periodStart))
    setEditPeriodEnd(leaseDateToInputValue(inv.periodEnd))
    setEditDueDate(inv.dueDate ? leaseDateToInputValue(inv.dueDate) : '')
    setEditNotes(inv.notes ?? '')
    setEditLines(
      inv.lines.map((l) => ({
        description: l.description,
        amount: String(Number(l.amount)),
        chargeScheduleId: l.chargeScheduleId ?? '',
      })),
    )
    setSaveDraftErr(null)
    setDraftEditMode(true)
  }, [inv])

  const submitDraftEdit = useCallback(() => {
    if (!token || !inv || inv.status !== 'DRAFT') return
    const lines = editLines.map((l) => ({
      description: l.description.trim(),
      amount: parseFloat(l.amount.replace(',', '.')),
      chargeScheduleId: l.chargeScheduleId.trim() || undefined,
    }))
    if (lines.length === 0) {
      setSaveDraftErr('Add at least one line.')
      return
    }
    for (const l of lines) {
      if (!l.description) {
        setSaveDraftErr('Each line needs a description.')
        return
      }
      if (!Number.isFinite(l.amount) || l.amount < 0.01) {
        setSaveDraftErr('Each line amount must be at least 0.01.')
        return
      }
    }
    if (!editPeriodStart.trim() || !editPeriodEnd.trim()) {
      setSaveDraftErr('Period start and end are required.')
      return
    }
    setSaveDraftBusy(true)
    setSaveDraftErr(null)
    fetch(apiUrl(`/api/v1/billing/invoices/${encodeURIComponent(inv.id)}`), {
      method: 'PATCH',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        periodStart: editPeriodStart,
        periodEnd: editPeriodEnd,
        dueDate: editDueDate.trim() ? editDueDate : null,
        notes: editNotes.trim().length > 0 ? editNotes.trim() : null,
        lines: lines.map(({ description, amount, chargeScheduleId }) => ({
          description,
          amount,
          ...(chargeScheduleId ? { chargeScheduleId } : {}),
        })),
      }),
    })
      .then(async (r) => {
        if (r.status === 401) {
          handleUnauthorized()
          throw new Error('Session expired')
        }
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
      })
      .then(async () => {
        reloadDashboardMetrics()
        await reloadDetail()
        setDraftEditMode(false)
      })
      .catch((e: Error) => setSaveDraftErr(e.message))
      .finally(() => setSaveDraftBusy(false))
  }, [
    token,
    inv,
    editLines,
    editPeriodStart,
    editPeriodEnd,
    editDueDate,
    editNotes,
    reloadDetail,
    reloadDashboardMetrics,
    handleUnauthorized,
  ])

  const lineTotal = inv
    ? inv.lines.reduce((sum, l) => sum + Number(l.amount), 0)
    : 0
  const paidTotal = (paymentRows ?? []).reduce(
    (sum, p) => sum + Math.abs(Number(p.signedAmount)),
    0,
  )
  const balanceOutstanding = Math.max(0, lineTotal - paidTotal)

  const downloadInvoicePdf = useCallback(() => {
    if (!token || !invoiceId) return
    setBillingActionErr(null)
    fetch(
      apiUrl(`/api/v1/billing/invoices/${encodeURIComponent(invoiceId)}/pdf`),
      { headers: authHeaders(token) },
    )
      .then(async (r) => {
        if (r.status === 401) {
          handleUnauthorized()
          throw new Error('Session expired')
        }
        await downloadPdfFromResponse(
          r,
          `tax-invoice-${invoiceId.slice(0, 8).toUpperCase()}.pdf`,
        )
      })
      .catch((e: Error) => setBillingActionErr(e.message))
  }, [token, invoiceId, handleUnauthorized, setBillingActionErr])

  const sendInvoiceEmail = useCallback(() => {
    if (!token || !invoiceId) return
    setEmailSending(true)
    setEmailErr(null)
    setBillingActionErr(null)
    fetch(apiUrl(`/api/v1/billing/invoices/${encodeURIComponent(invoiceId)}/send-email`), {
      method: 'POST',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...(emailTo.trim() ? { to: emailTo.trim() } : {}),
        ...(emailSubject.trim() ? { subject: emailSubject.trim() } : {}),
        ...(emailMessage.trim() ? { message: emailMessage.trim() } : {}),
      }),
    })
      .then(async (r) => {
        if (r.status === 401) {
          handleUnauthorized()
          throw new Error('Session expired')
        }
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
      })
      .then(() => {
        setEmailDialogOpen(false)
        setEmailTo('')
        setEmailSubject('')
        setEmailMessage('')
      })
      .catch((e: Error) => {
        setEmailErr(e.message)
        setBillingActionErr(e.message)
      })
      .finally(() => setEmailSending(false))
  }, [
    token,
    invoiceId,
    emailTo,
    emailSubject,
    emailMessage,
    handleUnauthorized,
    setBillingActionErr,
  ])

  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Button
          component={RouterLink}
          to="/billing/invoices"
          color="primary"
          sx={{ mb: 1, px: 0 }}
        >
          ← All invoices
        </Button>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignItems={{ xs: 'stretch', sm: 'flex-start' }}
          justifyContent="space-between"
        >
          <Box>
            <Typography variant="h4" fontWeight={800} letterSpacing="-0.03em">
              Invoice
            </Typography>
            {invoiceId ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5, fontFamily: 'JetBrains Mono, monospace' }}
              >
                {invoiceId}
              </Typography>
            ) : null}
          </Box>
          {inv && !detailLoading ? (
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
            >
              {canWriteBilling && inv.status !== 'VOID' ? (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<SendOutlined />}
                  onClick={() => {
                    setEmailDialogOpen(true)
                    setEmailErr(null)
                  }}
                >
                  Send email
                </Button>
              ) : null}
              <Button
                variant="outlined"
                size="small"
                startIcon={<PictureAsPdfOutlined />}
                onClick={downloadInvoicePdf}
              >
                Download PDF
              </Button>
            </Stack>
          ) : null}
        </Stack>
      </Box>

      {billingActionErr && (
        <Alert
          severity="error"
          variant="outlined"
          sx={{ mb: 2 }}
          onClose={() => setBillingActionErr(null)}
        >
          {billingActionErr}
        </Alert>
      )}

      {detailErr && (
        <Alert severity="warning" variant="outlined" sx={{ mb: 2 }}>
          {detailErr}
        </Alert>
      )}

      {detailLoading && (
        <Stack spacing={1}>
          <Skeleton height={40} />
          <Skeleton height={200} />
        </Stack>
      )}

      {!detailLoading && inv && (
        <>
          <Dialog
            open={emailDialogOpen}
            onClose={() => !emailSending && setEmailDialogOpen(false)}
            fullWidth
            maxWidth="sm"
          >
            <DialogTitle>Send invoice email</DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ mt: 0.5 }}>
                {emailErr ? (
                  <Alert severity="error" variant="outlined">
                    {emailErr}
                  </Alert>
                ) : null}
                <TextField
                  label="To (optional)"
                  size="small"
                  type="email"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  helperText="Leave blank to use tenant contact email."
                />
                <TextField
                  label="Subject (optional)"
                  size="small"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  helperText="Leave blank for the default invoice subject."
                />
                <TextField
                  label="Message (optional)"
                  size="small"
                  multiline
                  minRows={4}
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  helperText="Leave blank for the default message."
                />
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => setEmailDialogOpen(false)}
                disabled={emailSending}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={sendInvoiceEmail}
                disabled={emailSending}
              >
                {emailSending ? 'Sending…' : 'Send'}
              </Button>
            </DialogActions>
          </Dialog>

          <SectionCard
            title="Summary"
            subtitle="Draft invoices can be issued (posts to sub-ledger) or voided. Issued invoices are immutable."
            icon={<ReceiptLongOutlined />}
            action={
              canWriteBilling && inv.status === 'DRAFT' ? (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {!draftEditMode ? (
                    <Button variant="outlined" size="small" disabled={actionBusy} onClick={openDraftEdit}>
                      Edit draft
                    </Button>
                  ) : null}
                  <Button
                    variant="contained"
                    size="small"
                    disabled={actionBusy || draftEditMode}
                    onClick={() => {
                      setActionBusy(true)
                      setBillingActionErr(null)
                      setDraftEditMode(false)
                      void handleIssueInvoice(inv.id)
                        .then(() => reloadDashboardMetrics())
                        .then(() => reloadDetail())
                        .catch(() => {})
                        .finally(() => setActionBusy(false))
                    }}
                  >
                    Issue
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={actionBusy || draftEditMode}
                    onClick={() => {
                      setActionBusy(true)
                      setBillingActionErr(null)
                      setDraftEditMode(false)
                      void handleVoidInvoice(inv.id)
                        .then(() => reloadDashboardMetrics())
                        .then(() => reloadDetail())
                        .catch(() => {})
                        .finally(() => setActionBusy(false))
                    }}
                  >
                    Void
                  </Button>
                </Stack>
              ) : canWriteBilling && inv.status === 'ISSUED' ? (
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => {
                    setPaymentDialogOpen(true)
                    setPaymentSaveErr(null)
                    setPaymentAmount(balanceOutstanding.toFixed(2))
                    setPaymentNarrative('')
                  }}
                >
                  Record payment
                </Button>
              ) : undefined
            }
          >
            <Stack spacing={2}>
              <Stack direction="row" flexWrap="wrap" useFlexGap spacing={2}>
                <Chip
                  size="small"
                  label={inv.status}
                  color={invoiceStatusChipColor(inv.status)}
                  variant="outlined"
                  sx={{ fontWeight: 600 }}
                />
                <Typography variant="body2">
                  <strong>Period:</strong>{' '}
                  {new Date(inv.periodStart).toLocaleDateString()} –{' '}
                  {new Date(inv.periodEnd).toLocaleDateString()}
                </Typography>
                {inv.dueDate ? (
                  <Typography variant="body2">
                    <strong>Due:</strong> {new Date(inv.dueDate).toLocaleDateString()}
                  </Typography>
                ) : null}
                <Typography variant="body2">
                  <strong>Tenant:</strong> {invoiceTenantLabel(inv)}
                </Typography>
                <Stack direction="row" alignItems="center" flexWrap="wrap" useFlexGap spacing={1}>
                  <Typography variant="body2" component="span">
                    <strong>Lease:</strong>
                  </Typography>
                  <Chip
                    size="small"
                    label={inv.lease.status}
                    color={leaseStatusChipColor(inv.lease.status)}
                    variant="outlined"
                    sx={{ fontWeight: 600 }}
                  />
                  <Button
                    component={RouterLink}
                    to={`/billing/schedules?leaseId=${encodeURIComponent(inv.leaseId)}`}
                    size="small"
                    sx={{ py: 0.25 }}
                  >
                    Charge schedules
                  </Button>
                </Stack>
              </Stack>
              {inv.notes ? (
                <Typography variant="body2" color="text.secondary">
                  <strong>Notes:</strong> {inv.notes}
                </Typography>
              ) : null}
              <Typography variant="h6" fontWeight={700}>
                Total {inv.currency}{' '}
                {lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Typography>
              {inv.status === 'ISSUED' ? (
                <Stack direction="row" flexWrap="wrap" useFlexGap spacing={2}>
                  <Typography variant="body2">
                    <strong>Paid:</strong> {inv.currency}{' '}
                    {paidTotal.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Outstanding:</strong> {inv.currency}{' '}
                    {balanceOutstanding.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </Typography>
                </Stack>
              ) : null}
            </Stack>
          </SectionCard>

          {inv.status === 'ISSUED' ? (
            <Box sx={{ mt: 2 }}>
              <SectionCard
                title="Payments"
                subtitle="Payment allocations posted against this invoice. Each creates an immutable PAYMENT ledger line."
                icon={<SavingsOutlined />}
              >
                {paymentErr ? (
                  <Alert severity="warning" variant="outlined" sx={{ mb: 2 }}>
                    {paymentErr}
                  </Alert>
                ) : null}
                {paymentLoading && paymentRows === null ? (
                  <Stack spacing={1}>
                    <Skeleton height={32} />
                    <Skeleton height={32} />
                  </Stack>
                ) : null}
                {!paymentLoading &&
                paymentRows &&
                paymentRows.length === 0 &&
                !paymentErr ? (
                  <Typography color="text.secondary">
                    No payments recorded for this invoice yet.
                  </Typography>
                ) : null}
                {paymentRows && paymentRows.length > 0 ? (
                  <Stack spacing={1}>
                    {paymentRows.map((p) => (
                      <Stack
                        key={p.id}
                        direction={{ xs: 'column', sm: 'row' }}
                        justifyContent="space-between"
                        sx={{
                          border: 1,
                          borderColor: 'divider',
                          borderRadius: 1,
                          p: 1,
                        }}
                      >
                        <Box>
                          <Typography variant="body2">{p.narrative}</Typography>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="caption" color="text.secondary">
                              {new Date(p.createdAt).toLocaleString()}
                            </Typography>
                            {p.reversed ? (
                              <Chip
                                size="small"
                                color="warning"
                                variant="outlined"
                                label="Reversed"
                              />
                            ) : null}
                          </Stack>
                          {p.reversal ? (
                            <Typography variant="caption" color="text.secondary">
                              Reversal posted {new Date(p.reversal.createdAt).toLocaleString()}
                              {' · '}
                              {p.currency}{' '}
                              {Math.abs(Number(p.reversal.signedAmount)).toLocaleString(
                                undefined,
                                { minimumFractionDigits: 2 },
                              )}
                              {p.reversal.reason ? ` · ${p.reversal.reason}` : ''}
                            </Typography>
                          ) : null}
                        </Box>
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          spacing={1}
                          alignItems={{ xs: 'flex-start', sm: 'center' }}
                        >
                          <Typography
                            variant="body2"
                            fontWeight={700}
                            sx={{ fontFamily: 'JetBrains Mono, monospace' }}
                          >
                            {p.currency}{' '}
                            {Math.abs(Number(p.signedAmount)).toLocaleString(
                              undefined,
                              { minimumFractionDigits: 2 },
                            )}
                          </Typography>
                          {canWriteBilling ? (
                            <Button
                              size="small"
                              variant="outlined"
                              color="warning"
                              disabled={Boolean(p.reversed) || reversingPaymentId === p.id}
                              onClick={() => {
                                setReverseTarget(p)
                                setReverseReason('')
                                setReverseDialogOpen(true)
                              }}
                            >
                              {reversingPaymentId === p.id ? 'Reversing…' : 'Reverse'}
                            </Button>
                          ) : null}
                        </Stack>
                      </Stack>
                    ))}
                  </Stack>
                ) : null}
              </SectionCard>
            </Box>
          ) : null}

          <Box sx={{ mt: 2 }}>
            <SectionCard
              title="Activity timeline"
              subtitle="Invoice and ledger audit events in reverse chronological order."
              icon={<ReceiptLongOutlined />}
            >
              {activityErr ? (
                <Alert severity="warning" variant="outlined" sx={{ mb: 2 }}>
                  {activityErr}
                </Alert>
              ) : null}
              {activityLoading && activityRows === null ? (
                <Stack spacing={1}>
                  <Skeleton height={28} />
                  <Skeleton height={28} />
                </Stack>
              ) : null}
              {!activityLoading &&
              activityRows &&
              activityRows.length === 0 &&
              !activityErr ? (
                <Typography color="text.secondary">No activity yet.</Typography>
              ) : null}
              {activityRows && activityRows.length > 0 ? (
                <Stack spacing={1}>
                  {activityRows.map((a) => (
                    <Stack
                      key={a.id}
                      direction={{ xs: 'column', sm: 'row' }}
                      justifyContent="space-between"
                      sx={{
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        p: 1,
                      }}
                    >
                      <Box>
                        <Stack direction="row" spacing={1} alignItems="center" useFlexGap>
                          <Chip
                            size="small"
                            label={a.kind.replace(/_/g, ' ')}
                            color={invoiceActivityChipColor(a.kind)}
                            variant="outlined"
                          />
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(a.at).toLocaleString()} · {a.detail}
                        </Typography>
                      </Box>
                      {a.amount && a.currency ? (
                        <Typography
                          variant="body2"
                          fontWeight={700}
                          sx={{
                            fontFamily: 'JetBrains Mono, monospace',
                            color:
                              a.kind === 'PAYMENT_ALLOCATED'
                                ? 'success.main'
                                : a.kind === 'PAYMENT_REVERSED'
                                  ? 'warning.main'
                                  : 'text.primary',
                          }}
                        >
                          {a.currency}{' '}
                          {Math.abs(Number(a.amount)).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </Typography>
                      ) : null}
                    </Stack>
                  ))}
                </Stack>
              ) : null}
            </SectionCard>
          </Box>

          <Dialog
            open={paymentDialogOpen}
            onClose={() => !paymentSaving && setPaymentDialogOpen(false)}
            fullWidth
            maxWidth="sm"
          >
            <DialogTitle>Record payment</DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ mt: 0.5 }}>
                {paymentSaveErr ? (
                  <Alert severity="error" variant="outlined">
                    {paymentSaveErr}
                  </Alert>
                ) : null}
                <TextField
                  label="Amount"
                  size="small"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  helperText="Positive value. Will post as a PAYMENT credit."
                />
                <TextField
                  label="Narrative (optional)"
                  size="small"
                  value={paymentNarrative}
                  onChange={(e) => setPaymentNarrative(e.target.value)}
                  helperText="Optional note appended after the invoice allocation tag."
                />
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => setPaymentDialogOpen(false)}
                disabled={paymentSaving}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                disabled={paymentSaving}
                onClick={() => {
                  if (!token || !invoiceId) return
                  const amt = parseFloat(paymentAmount.replace(',', '.'))
                  if (!Number.isFinite(amt) || amt <= 0) {
                    setPaymentSaveErr('Amount must be greater than zero.')
                    return
                  }
                  if (amt > balanceOutstanding) {
                    const proceed = window.confirm(
                      `This payment (${inv.currency} ${amt.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}) is greater than outstanding (${inv.currency} ${balanceOutstanding.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}). Post overpayment anyway?`,
                    )
                    if (!proceed) return
                  }
                  setPaymentSaving(true)
                  setPaymentSaveErr(null)
                  fetch(
                    apiUrl(`/api/v1/billing/invoices/${encodeURIComponent(invoiceId)}/payments`),
                    {
                      method: 'POST',
                      headers: {
                        ...authHeaders(token),
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        amount: amt,
                        narrative: paymentNarrative.trim() || undefined,
                      }),
                    },
                  )
                    .then(async (r) => {
                      if (r.status === 401) {
                        handleUnauthorized()
                        throw new Error('Session expired')
                      }
                      if (!r.ok) throw new Error(await readApiErrorMessage(r))
                    })
                    .then(async () => {
                      setPaymentDialogOpen(false)
                      await reloadPayments()
                      await reloadActivity()
                    })
                    .catch((e: Error) => setPaymentSaveErr(e.message))
                    .finally(() => setPaymentSaving(false))
                }}
              >
                {paymentSaving ? 'Posting…' : 'Post payment'}
              </Button>
            </DialogActions>
          </Dialog>

          <Dialog
            open={reverseDialogOpen}
            onClose={() => !reversingPaymentId && setReverseDialogOpen(false)}
            fullWidth
            maxWidth="sm"
          >
            <DialogTitle>Reverse payment allocation</DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ mt: 0.5 }}>
                <Typography variant="body2" color="text.secondary">
                  This posts an immutable ADJUSTMENT entry to reverse the selected
                  payment.
                </Typography>
                {reverseTarget ? (
                  <Typography variant="body2">
                    Reversing {reverseTarget.currency}{' '}
                    {Math.abs(Number(reverseTarget.signedAmount)).toLocaleString(
                      undefined,
                      { minimumFractionDigits: 2 },
                    )}{' '}
                    from {new Date(reverseTarget.createdAt).toLocaleString()}.
                  </Typography>
                ) : null}
                <TextField
                  label="Reason (optional)"
                  size="small"
                  value={reverseReason}
                  onChange={(e) => setReverseReason(e.target.value)}
                  helperText="This reason will be stored on the reversal narrative."
                />
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => setReverseDialogOpen(false)}
                disabled={Boolean(reversingPaymentId)}
              >
                Cancel
              </Button>
              <Button
                color="warning"
                variant="contained"
                disabled={!reverseTarget || Boolean(reversingPaymentId)}
                onClick={submitReversePayment}
              >
                {reversingPaymentId ? 'Reversing…' : 'Confirm reverse'}
              </Button>
            </DialogActions>
          </Dialog>

          {canWriteBilling && inv.status === 'DRAFT' && draftEditMode ? (
            <Box sx={{ mt: 2 }}>
              <SectionCard
                title="Edit draft"
                subtitle="Period, due date, notes, and lines replace the saved draft. Link lines to charge schedules for this lease via the picker."
                icon={<EditOutlined />}
                action={
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={saveDraftBusy}
                      onClick={() => {
                        setDraftEditMode(false)
                        setSaveDraftErr(null)
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      disabled={saveDraftBusy}
                      onClick={() => submitDraftEdit()}
                    >
                      {saveDraftBusy ? 'Saving…' : 'Save changes'}
                    </Button>
                  </Stack>
                }
              >
                {saveDraftErr ? (
                  <Alert severity="error" variant="outlined" sx={{ mb: 2 }}>
                    {saveDraftErr}
                  </Alert>
                ) : null}
                <Stack spacing={2}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap" useFlexGap>
                    <TextField
                      label="Period start"
                      type="date"
                      size="small"
                      value={editPeriodStart}
                      onChange={(e) => setEditPeriodStart(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={{ width: 160 }}
                    />
                    <TextField
                      label="Period end"
                      type="date"
                      size="small"
                      value={editPeriodEnd}
                      onChange={(e) => setEditPeriodEnd(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={{ width: 160 }}
                    />
                    <TextField
                      label="Due date"
                      type="date"
                      size="small"
                      value={editDueDate}
                      onChange={(e) => setEditDueDate(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={{ width: 160 }}
                      helperText="Leave empty to clear"
                    />
                  </Stack>
                  <TextField
                    label="Notes"
                    size="small"
                    fullWidth
                    multiline
                    minRows={2}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                  />
                  <Stack spacing={1.5}>
                    <Typography variant="subtitle2" fontWeight={600}>
                      Lines
                    </Typography>
                    {draftScheduleErr ? (
                      <Alert severity="warning" variant="outlined">
                        Could not load charge schedules: {draftScheduleErr}
                      </Alert>
                    ) : null}
                    {editLines.map((row, idx) => (
                      <Stack
                        key={idx}
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={1}
                        alignItems={{ md: 'center' }}
                        flexWrap="wrap"
                        useFlexGap
                      >
                        <TextField
                          label="Description"
                          size="small"
                          value={row.description}
                          onChange={(e) => {
                            const next = [...editLines]
                            next[idx] = { ...next[idx], description: e.target.value }
                            setEditLines(next)
                          }}
                          sx={{ flex: 2, minWidth: 200 }}
                        />
                        <TextField
                          label="Amount"
                          size="small"
                          type="text"
                          value={row.amount}
                          onChange={(e) => {
                            const next = [...editLines]
                            next[idx] = { ...next[idx], amount: e.target.value }
                            setEditLines(next)
                          }}
                          sx={{ width: 140 }}
                        />
                        <Stack spacing={0.5} sx={{ flex: 1, minWidth: 220 }}>
                          <Autocomplete
                            size="small"
                            loading={draftSchedulesLoading}
                            options={draftScheduleOptions ?? []}
                            getOptionLabel={(o) => chargeScheduleOptionLabel(o)}
                            value={
                              draftScheduleOptions?.find((s) => s.id === row.chargeScheduleId) ??
                              null
                            }
                            onChange={(_, v) => {
                              const next = [...editLines]
                              next[idx] = { ...next[idx], chargeScheduleId: v?.id ?? '' }
                              setEditLines(next)
                            }}
                            isOptionEqualToValue={(a, b) => a.id === b.id}
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                label="Charge schedule (optional)"
                                InputProps={{
                                  ...params.InputProps,
                                  endAdornment: (
                                    <>
                                      {draftSchedulesLoading ? (
                                        <CircularProgress color="inherit" size={18} />
                                      ) : null}
                                      {params.InputProps.endAdornment}
                                    </>
                                  ),
                                }}
                              />
                            )}
                          />
                          {row.chargeScheduleId &&
                          !draftSchedulesLoading &&
                          !(draftScheduleOptions ?? []).some((s) => s.id === row.chargeScheduleId) ? (
                            <Typography variant="caption" color="warning.main">
                              Saved schedule id not in current list — still kept until you clear the
                              picker.
                            </Typography>
                          ) : null}
                        </Stack>
                        <IconButton
                          size="small"
                          aria-label="Remove line"
                          disabled={editLines.length <= 1}
                          onClick={() => setEditLines((cur) => cur.filter((_, i) => i !== idx))}
                        >
                          <DeleteOutlineOutlined fontSize="small" />
                        </IconButton>
                      </Stack>
                    ))}
                    <Button
                      size="small"
                      startIcon={<AddOutlined />}
                      onClick={() =>
                        setEditLines((cur) => [
                          ...cur,
                          { description: '', amount: '', chargeScheduleId: '' },
                        ])
                      }
                    >
                      Add line
                    </Button>
                  </Stack>
                </Stack>
              </SectionCard>
            </Box>
          ) : (
            <Box sx={{ mt: 2 }}>
              <SectionCard title="Line items" icon={<AssignmentOutlined />}>
                <TableContainer
                  sx={{
                    borderRadius: 2,
                    border: 1,
                    borderColor: 'divider',
                    overflow: 'hidden',
                  }}
                >
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Description</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell>Charge schedule</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {inv.lines.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell>{line.description}</TableCell>
                          <TableCell
                            align="right"
                            sx={{ fontFamily: 'JetBrains Mono, monospace' }}
                          >
                            {inv.currency}{' '}
                            {Number(line.amount).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell>
                            {line.chargeScheduleId ? (
                              <Tooltip title={line.chargeScheduleId}>
                                <Button
                                  component={RouterLink}
                                  size="small"
                                  to={`/billing/schedules?leaseId=${encodeURIComponent(inv.leaseId)}`}
                                  sx={{ py: 0.25 }}
                                >
                                  Open schedules
                                </Button>
                              </Tooltip>
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                —
                              </Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </SectionCard>
            </Box>
          )}

          {inv.ledgerEntry ? (
            <Box sx={{ mt: 2 }}>
            <SectionCard
              title="Posted to sub-ledger"
              subtitle="One ledger line is created when an invoice is issued."
              icon={<SavingsOutlined />}
              action={
                <Button
                  size="small"
                  variant="outlined"
                  component={RouterLink}
                  to={`/billing/ledger?leaseId=${encodeURIComponent(inv.leaseId)}`}
                >
                  Open ledger
                </Button>
              }
            >
              <Stack spacing={1}>
                <Typography variant="body2" color="text.secondary">
                  {new Date(inv.ledgerEntry.createdAt).toLocaleString()}
                </Typography>
                <Typography variant="body1">{inv.ledgerEntry.narrative}</Typography>
                <Typography
                  variant="body1"
                  fontWeight={700}
                  sx={{
                    fontFamily: 'JetBrains Mono, monospace',
                    color:
                      Number(inv.ledgerEntry.signedAmount) < 0
                        ? 'success.main'
                        : 'text.primary',
                  }}
                >
                  {inv.ledgerEntry.currency}{' '}
                  {Number(inv.ledgerEntry.signedAmount).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}{' '}
                  <Typography component="span" variant="caption" color="text.secondary">
                    ({inv.ledgerEntry.source})
                  </Typography>
                </Typography>
              </Stack>
            </SectionCard>
            </Box>
          ) : inv.status === 'ISSUED' ? (
            <Alert severity="warning" variant="outlined" sx={{ mt: 2 }}>
              Issued invoice has no linked ledger entry (unexpected). Check API data.
            </Alert>
          ) : null}
        </>
      )}

      {!detailLoading && !inv && !detailErr && invoiceId ? (
        <Typography color="text.secondary">Invoice not found.</Typography>
      ) : null}

      {!invoiceId ? (
        <Typography color="text.secondary">Missing invoice id.</Typography>
      ) : null}
    </>
  )
}

export function BillingLedgerPage() {
  const {
    token,
    signOut,
    canWriteBilling,
    setBillingLeaseId,
    billingActionErr,
    setBillingActionErr,
  } = useDashboard()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const handleUnauthorized = useCallback(() => {
    signOut()
  }, [signOut])

  const [ledgerSearch, setLedgerSearch] = useState('')
  const [debouncedLedgerSearch, setDebouncedLedgerSearch] = useState('')
  const [filterLeaseId, setFilterLeaseId] = useState('')
  const [filterTenantId, setFilterTenantId] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [createdFrom, setCreatedFrom] = useState('')
  const [createdTo, setCreatedTo] = useState('')

  const [ledgerListRows, setLedgerListRows] = useState<LedgerEntryRow[] | null>(null)
  const [ledgerListTotal, setLedgerListTotal] = useState(0)
  const [ledgerListPage, setLedgerListPage] = useState(0)
  const [ledgerListPageSize, setLedgerListPageSize] = useState(
    DEFAULT_ADMIN_TABLE_PAGE_SIZE,
  )
  const [ledgerListErr, setLedgerListErr] = useState<string | null>(null)
  const [ledgerListLoading, setLedgerListLoading] = useState(false)
  const [ledgerListNonce, setLedgerListNonce] = useState(0)

  const [manualOpen, setManualOpen] = useState(false)
  const [manualLeaseId, setManualLeaseId] = useState('')
  const [manualNarrative, setManualNarrative] = useState('')
  const [manualAmount, setManualAmount] = useState('')
  const [manualSource, setManualSource] = useState<
    (typeof MANUAL_LEDGER_SOURCES)[number]
  >('PAYMENT')
  const [manualSaving, setManualSaving] = useState(false)
  const [manualErr, setManualErr] = useState<string | null>(null)

  const setLeaseForLedgerFilter = useCallback(
    (id: string) => {
      setFilterLeaseId(id)
      setBillingLeaseId(id)
      const next = new URLSearchParams(searchParams.toString())
      if (id) next.set('leaseId', id)
      else next.delete('leaseId')
      const q = next.toString()
      navigate(`${location.pathname}${q ? `?${q}` : ''}`, { replace: true })
    },
    [setBillingLeaseId, searchParams, navigate, location.pathname],
  )

  const leaseIdFromUrl = searchParams.get('leaseId')
  useEffect(() => {
    setFilterLeaseId(leaseIdFromUrl ?? '')
  }, [leaseIdFromUrl])

  useEffect(() => {
    const id = window.setTimeout(
      () => setDebouncedLedgerSearch(ledgerSearch.trim()),
      400,
    )
    return () => window.clearTimeout(id)
  }, [ledgerSearch])

  useEffect(() => {
    setLedgerListPage(0)
  }, [
    debouncedLedgerSearch,
    filterLeaseId,
    filterTenantId,
    filterSource,
    createdFrom,
    createdTo,
  ])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setLedgerListLoading(true)
    setLedgerListErr(null)
    const params = new URLSearchParams({
      page: String(ledgerListPage + 1),
      pageSize: String(ledgerListPageSize),
    })
    if (debouncedLedgerSearch) params.set('q', debouncedLedgerSearch)
    if (filterLeaseId) params.set('leaseId', filterLeaseId)
    if (filterTenantId) params.set('tenantId', filterTenantId)
    if (filterSource) params.set('source', filterSource)
    if (createdFrom) params.set('createdFrom', createdFrom)
    if (createdTo) params.set('createdTo', createdTo)
    fetch(apiUrl(`/api/v1/billing/ledger?${params}`), { headers: authHeaders(token) })
      .then(async (r) => {
        if (r.status === 401) {
          handleUnauthorized()
          throw new Error('Session expired')
        }
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
        return r.json() as Promise<
          | LedgerEntryRow[]
          | { items: LedgerEntryRow[]; total: number; page: number; pageSize: number }
        >
      })
      .then((data) => {
        if (cancelled) return
        if (Array.isArray(data)) {
          setLedgerListRows(data)
          setLedgerListTotal(data.length)
          return
        }
        const rows = Array.isArray(data?.items) ? data.items : []
        const total =
          typeof data?.total === 'number' ? data.total : rows.length
        if (rows.length === 0 && total > 0 && ledgerListPage > 0) {
          setLedgerListPage(0)
          return
        }
        setLedgerListRows(rows)
        setLedgerListTotal(total)
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setLedgerListErr(e.message)
          setLedgerListRows([])
          setLedgerListTotal(0)
        }
      })
      .finally(() => {
        if (!cancelled) setLedgerListLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [
    token,
    ledgerListPage,
    ledgerListPageSize,
    debouncedLedgerSearch,
    filterLeaseId,
    filterTenantId,
    filterSource,
    createdFrom,
    createdTo,
    ledgerListNonce,
    handleUnauthorized,
  ])

  const buildLedgerExportParams = () => {
    const params = new URLSearchParams()
    if (debouncedLedgerSearch) params.set('q', debouncedLedgerSearch)
    if (filterLeaseId) params.set('leaseId', filterLeaseId)
    if (filterTenantId) params.set('tenantId', filterTenantId)
    if (filterSource) params.set('source', filterSource)
    if (createdFrom) params.set('createdFrom', createdFrom)
    if (createdTo) params.set('createdTo', createdTo)
    return params
  }

  const downloadFilteredCsv = () => {
    if (!token) return
    setBillingActionErr(null)
    const q = buildLedgerExportParams()
    const suffix = q.toString() ? `?${q}` : ''
    fetch(apiUrl(`/api/v1/billing/ledger/export${suffix}`), { headers: authHeaders(token) })
      .then(async (r) => {
        if (r.status === 401) {
          handleUnauthorized()
          throw new Error('Session expired')
        }
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
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

  const openManual = () => {
    setManualLeaseId(filterLeaseId || '')
    setManualNarrative('')
    setManualAmount('')
    setManualSource('PAYMENT')
    setManualErr(null)
    setManualOpen(true)
  }

  const submitManual = () => {
    if (!token) return
    const leaseId = manualLeaseId.trim()
    const narrative = manualNarrative.trim()
    const amt = parseFloat(manualAmount.replace(',', '.'))
    if (!leaseId) {
      setManualErr('Lease is required.')
      return
    }
    if (!narrative) {
      setManualErr('Narrative is required.')
      return
    }
    if (!Number.isFinite(amt) || amt === 0) {
      setManualErr('Amount must be a non-zero number (use negative for credits / payments).')
      return
    }
    setManualSaving(true)
    setManualErr(null)
    fetch(apiUrl('/api/v1/billing/ledger/manual'), {
      method: 'POST',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        leaseId,
        narrative,
        signedAmount: amt,
        source: manualSource,
      }),
    })
      .then(async (r) => {
        if (r.status === 401) {
          handleUnauthorized()
          throw new Error('Session expired')
        }
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
        return r.json() as Promise<LedgerEntryRow>
      })
      .then((created) => {
        setManualOpen(false)
        setLedgerListPage(0)
        const matchesFilters =
          (!filterLeaseId || created.leaseId === filterLeaseId) &&
          (!filterTenantId || created.tenant?.id === filterTenantId) &&
          (!filterSource || created.source === filterSource)
        if (matchesFilters) {
          setLedgerListRows((prev) => {
            const base = prev ?? []
            const withoutDup = base.filter((row) => row.id !== created.id)
            return [created, ...withoutDup].slice(0, ledgerListPageSize)
          })
          setLedgerListTotal((total) => total + 1)
        }
        setLedgerListNonce((n) => n + 1)
      })
      .catch((e: Error) => setManualErr(e.message))
      .finally(() => setManualSaving(false))
  }

  return (
    <>
      <PageHeader title="Tenant sub-ledger" />
      {billingActionErr && (
        <Alert
          severity="error"
          variant="outlined"
          sx={{ mb: 2 }}
          onClose={() => setBillingActionErr(null)}
        >
          {billingActionErr}
        </Alert>
      )}
      <SectionCard
        title="Tenant sub-ledger"
        subtitle="Append-only lines. Lease filter updates the table, shared billing lease, and ?leaseId= (same as Invoices / Schedules). CSV export matches current filters."
        icon={<SavingsOutlined />}
        action={
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button variant="outlined" size="small" onClick={downloadFilteredCsv}>
              Download CSV
            </Button>
            {canWriteBilling ? (
              <Button variant="contained" size="small" onClick={openManual}>
                Manual entry
              </Button>
            ) : null}
          </Stack>
        }
      >
        <Stack spacing={2} sx={{ mb: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} flexWrap="wrap" useFlexGap>
            <TextField
              size="small"
              label="Search narrative"
              value={ledgerSearch}
              onChange={(e) => setLedgerSearch(e.target.value)}
              sx={{ minWidth: 200, flex: 1 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlined fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="led-filter-source">Source</InputLabel>
              <Select
                labelId="led-filter-source"
                label="Source"
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
              >
                <MenuItem value="">
                  <em>All</em>
                </MenuItem>
                {LEDGER_FILTER_SOURCES.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <LeaseAsyncPicker
              token={token}
              value={filterLeaseId}
              onChange={setLeaseForLedgerFilter}
              label="Lease"
              allowClear
              sx={{ minWidth: 260, flex: 1 }}
              onUnauthorized={handleUnauthorized}
              tenantId={filterTenantId || undefined}
            />
            <TenantAsyncPicker
              token={token}
              value={filterTenantId}
              onChange={setFilterTenantId}
              label="Tenant"
              allowClear
              sx={{ minWidth: 200, flex: 1 }}
              onUnauthorized={handleUnauthorized}
            />
            <TextField
              label="Posted from"
              type="date"
              size="small"
              value={createdFrom}
              onChange={(e) => setCreatedFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 160 }}
            />
            <TextField
              label="Posted to"
              type="date"
              size="small"
              value={createdTo}
              onChange={(e) => setCreatedTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 160 }}
            />
          </Stack>
        </Stack>

        {ledgerListErr && (
          <Alert severity="warning" variant="outlined" sx={{ mb: 2 }}>
            {ledgerListErr}
          </Alert>
        )}
        {ledgerListLoading && ledgerListRows === null && (
          <Stack spacing={1}>
            <Skeleton height={36} />
            <Skeleton height={36} />
          </Stack>
        )}
        {ledgerListLoading && ledgerListRows !== null && ledgerListRows.length > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            Refreshing…
          </Typography>
        )}
        {!ledgerListLoading && ledgerListRows && ledgerListRows.length === 0 && (
          <Typography color="text.secondary">No ledger lines match these filters.</Typography>
        )}
        {ledgerListRows && ledgerListRows.length > 0 && (
          <>
            <TableContainer
              sx={{
                borderRadius: 2,
                border: 1,
                borderColor: 'divider',
                overflow: 'hidden',
              }}
            >
              <Table
                size="small"
                sx={{ '& tbody tr:hover': { bgcolor: 'action.hover' } }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell>Posted</TableCell>
                    <TableCell>Tenant</TableCell>
                    <TableCell>Source</TableCell>
                    <TableCell>Narrative</TableCell>
                    <TableCell align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {ledgerListRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{new Date(row.createdAt).toLocaleString()}</TableCell>
                      <TableCell>{ledgerTenantLabel(row)}</TableCell>
                      <TableCell
                        sx={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem' }}
                      >
                        {row.source}
                      </TableCell>
                      <TableCell>{row.narrative}</TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontFamily: 'JetBrains Mono, monospace',
                          fontWeight: 600,
                          color:
                            Number(row.signedAmount) < 0
                              ? 'success.main'
                              : 'text.primary',
                        }}
                      >
                        {row.currency}{' '}
                        {Number(row.signedAmount).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={ledgerListTotal}
              page={ledgerListPage}
              onPageChange={(_, p) => setLedgerListPage(p)}
              rowsPerPage={ledgerListPageSize}
              onRowsPerPageChange={(e) => {
                setLedgerListPageSize(Number.parseInt(e.target.value, 10))
                setLedgerListPage(0)
              }}
              rowsPerPageOptions={[...ADMIN_TABLE_PAGE_SIZES]}
            />
          </>
        )}
      </SectionCard>

      <Dialog
        open={manualOpen}
        onClose={() => !manualSaving && setManualOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Manual ledger line</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {manualErr && (
              <Alert severity="error" variant="outlined">
                {manualErr}
              </Alert>
            )}
            <Typography variant="body2" color="text.secondary">
              Posts a <strong>PAYMENT</strong> or <strong>ADJUSTMENT</strong> against the lease’s
              tenant. Use a <strong>negative</strong> signed amount for credits / tenant payments
              (reduces receivable).
            </Typography>
            <LeaseAsyncPicker
              token={token}
              value={manualLeaseId}
              onChange={setManualLeaseId}
              label="Lease"
              sx={{ width: '100%' }}
              onUnauthorized={handleUnauthorized}
            />
            <FormControl fullWidth size="small">
              <InputLabel id="manual-ledger-source">Source</InputLabel>
              <Select
                labelId="manual-ledger-source"
                label="Source"
                value={manualSource}
                onChange={(e) =>
                  setManualSource(e.target.value as (typeof MANUAL_LEDGER_SOURCES)[number])
                }
              >
                {MANUAL_LEDGER_SOURCES.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Signed amount"
              size="small"
              fullWidth
              type="number"
              value={manualAmount}
              onChange={(e) => setManualAmount(e.target.value)}
              helperText="Non-zero. Negative = credit / payment."
            />
            <TextField
              label="Narrative"
              size="small"
              fullWidth
              multiline
              minRows={2}
              value={manualNarrative}
              onChange={(e) => setManualNarrative(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setManualOpen(false)} disabled={manualSaving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={submitManual} disabled={manualSaving}>
            {manualSaving ? 'Posting…' : 'Post line'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
