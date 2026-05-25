import AssignmentOutlined from '@mui/icons-material/AssignmentOutlined'
import { apiUrl } from '../lib/api'
import ApartmentOutlined from '@mui/icons-material/ApartmentOutlined'
import ChevronRightOutlined from '@mui/icons-material/ChevronRightOutlined'
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined'
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined'
import SavingsOutlined from '@mui/icons-material/SavingsOutlined'
import TableChartOutlined from '@mui/icons-material/TableChartOutlined'
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from '@mui/material'
import { useCallback, useEffect, useState } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import {
  invoiceStatusChipColor,
  leaseStatusChipColor,
  SectionCard,
  StatTile,
} from '../components/DashboardUi'
import { useDashboard } from '../dashboard/context'
import type {
  OwnerPortalSnapshot,
  TenantPortalSnapshot,
} from '../dashboard/types'
import { readApiErrorMessage } from '../lib/apiError'
import { authHeaders } from '../lib/auth'
import { downloadCsvFromResponse } from '../lib/downloadCsv'
import { downloadPdfFromResponse } from '../lib/downloadPdf'

function PortalPageHeader({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h4" fontWeight={800} letterSpacing="-0.03em" gutterBottom>
        {title}
      </Typography>
      {subtitle ? (
        <Typography variant="body1" color="text.secondary">
          {subtitle}
        </Typography>
      ) : null}
    </Box>
  )
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function fmtMoney(currency: string, amount: number) {
  return `${currency} ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function PortalTablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}) {
  if (total <= pageSize && page === 0) return null
  return (
    <TablePagination
      component="div"
      count={total}
      page={page}
      onPageChange={(_, p) => onPageChange(p)}
      rowsPerPage={pageSize}
      onRowsPerPageChange={(e) => {
        onPageSizeChange(Number.parseInt(e.target.value, 10))
        onPageChange(0)
      }}
      rowsPerPageOptions={[10, 20, 50]}
    />
  )
}

function UnlinkedTenantAlert() {
  return (
    <Alert severity="warning" variant="outlined">
      Your login is not linked to a tenant profile. If your organization has one tenant, linking
      is automatic; otherwise ask your org admin to set your email as the tenant contact email.
    </Alert>
  )
}

const TENANT_NAV = [
  { to: '/portal/tenant', title: 'Overview', description: 'Balance, leases, and recent activity' },
  { to: '/portal/tenant/invoices', title: 'Invoices', description: 'View and download tax invoices' },
  { to: '/portal/tenant/statement', title: 'Statement', description: 'Full account ledger' },
  { to: '/portal/tenant/leases', title: 'Leases', description: 'Your agreements and units' },
] as const

const OWNER_NAV = [
  { to: '/portal/owner', title: 'Overview', description: 'Occupancy and finance summary' },
  { to: '/portal/owner/properties', title: 'Properties', description: 'Portfolios, buildings, units' },
  { to: '/portal/owner/invoices', title: 'Invoices', description: 'Organization billing (read-only)' },
] as const

function PortalNavCards({ items }: { items: readonly { to: string; title: string; description: string }[] }) {
  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} useFlexGap flexWrap="wrap">
      {items.map((c) => (
        <Card
          key={c.to}
          elevation={0}
          sx={{ flex: '1 1 220px', border: 1, borderColor: 'divider', borderRadius: 2 }}
        >
          <CardActionArea component={RouterLink} to={c.to} sx={{ p: 2, height: '100%' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography fontWeight={700}>{c.title}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {c.description}
                </Typography>
              </Box>
              <ChevronRightOutlined color="action" />
            </Stack>
          </CardActionArea>
        </Card>
      ))}
    </Stack>
  )
}

export function TenantPortalHomePage() {
  const { token, me } = useDashboard()
  const [snap, setSnap] = useState<TenantPortalSnapshot | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    fetch(apiUrl('/api/v1/portal/tenant'), { headers: authHeaders(token) })
      .then(async (r) => {
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
        return r.json() as Promise<TenantPortalSnapshot>
      })
      .then(setSnap)
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false))
  }, [token])

  return (
    <>
      <PortalPageHeader
        title="Tenant portal"
        subtitle={`${me?.organizationName ?? me?.organizationSlug ?? 'Organization'} · signed in as ${me?.email}`}
      />
      {err ? <Alert severity="warning" sx={{ mb: 2 }}>{err}</Alert> : null}
      {loading ? (
        <Stack direction="row" spacing={1} alignItems="center">
          <CircularProgress size={20} />
          <Typography variant="body2" color="text.secondary">Loading…</Typography>
        </Stack>
      ) : null}
      {!loading && snap && !snap.linkedTenant ? <UnlinkedTenantAlert /> : null}
      {!loading && snap?.linkedTenant ? (
        <Stack spacing={3}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} useFlexGap flexWrap="wrap">
            <StatTile label="Statement balance" value={fmtMoney('ZMW', snap.statement.balance)} icon={<SavingsOutlined fontSize="small" />} />
            <StatTile label="Active leases" value={snap.leaseSummary.activeLeases} icon={<AssignmentOutlined fontSize="small" />} />
            <StatTile label="Invoices" value={snap.statement.invoiceCount} icon={<ReceiptLongOutlined fontSize="small" />} />
          </Stack>
          <PortalNavCards items={TENANT_NAV.slice(1)} />
          <SectionCard title="Recent invoices" icon={<ReceiptLongOutlined />}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Period</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {snap.recentInvoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>{fmtDate(inv.periodStart)} – {fmtDate(inv.periodEnd)}</TableCell>
                      <TableCell>
                        <Chip size="small" variant="outlined" color={invoiceStatusChipColor(inv.status)} label={inv.status} />
                      </TableCell>
                      <TableCell align="right">{fmtMoney(inv.currency, inv.totalAmount)}</TableCell>
                      <TableCell align="right">
                        <Button size="small" component={RouterLink} to={`/portal/tenant/invoices/${inv.id}`}>View</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {snap.recentInvoices.length === 0 ? (
                    <TableRow><TableCell colSpan={4}>No invoices yet.</TableCell></TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>
          </SectionCard>
        </Stack>
      ) : null}
    </>
  )
}

type TenantInvoiceRow = {
  id: string
  status: string
  periodStart: string
  periodEnd: string
  dueDate: string | null
  currency: string
  totalAmount: number
}

export function TenantInvoicesPage() {
  const { token } = useDashboard()
  const [items, setItems] = useState<TenantInvoiceRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')

  const reload = useCallback(() => {
    if (!token) return
    setLoading(true)
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    params.set('page', String(page + 1))
    params.set('pageSize', String(pageSize))
    fetch(apiUrl(`/api/v1/portal/tenant/invoices?${params}`), { headers: authHeaders(token) })
      .then(async (r) => {
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
        return r.json() as Promise<{ items: TenantInvoiceRow[]; total: number }>
      })
      .then((data) => {
        setItems(data.items)
        setTotal(data.total)
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false))
  }, [token, status, page, pageSize])

  useEffect(() => { reload() }, [reload])
  useEffect(() => { setPage(0) }, [status])

  return (
    <>
      <PortalPageHeader title="My invoices" subtitle="Tax invoices issued to your tenant account." />
      <SectionCard
        title="Invoices"
        icon={<ReceiptLongOutlined />}
        action={
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Status</InputLabel>
            <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="ISSUED">Issued</MenuItem>
              <MenuItem value="DRAFT">Draft</MenuItem>
              <MenuItem value="VOID">Void</MenuItem>
            </Select>
          </FormControl>
        }
      >
        {err ? <Alert severity="warning" sx={{ mb: 2 }}>{err}</Alert> : null}
        {loading ? <CircularProgress size={24} /> : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Period</TableCell>
                  <TableCell>Due</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>{fmtDate(inv.periodStart)} – {fmtDate(inv.periodEnd)}</TableCell>
                    <TableCell>{inv.dueDate ? fmtDate(inv.dueDate) : '—'}</TableCell>
                    <TableCell>
                      <Chip size="small" variant="outlined" color={invoiceStatusChipColor(inv.status)} label={inv.status} />
                    </TableCell>
                    <TableCell align="right">{fmtMoney(inv.currency, inv.totalAmount)}</TableCell>
                    <TableCell align="right">
                      <Button size="small" component={RouterLink} to={`/portal/tenant/invoices/${inv.id}`}>Open</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 ? <TableRow><TableCell colSpan={5}>No invoices found.</TableCell></TableRow> : null}
              </TableBody>
            </Table>
            <PortalTablePagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </TableContainer>
        )}
      </SectionCard>
    </>
  )
}

export function TenantInvoiceDetailPage() {
  const { token, setBillingActionErr } = useDashboard()
  const { invoiceId = '' } = useParams()
  const [inv, setInv] = useState<{
    id: string
    status: string
    periodStart: string
    periodEnd: string
    dueDate: string | null
    currency: string
    notes: string | null
    organizationName: string
    lines: { id: string; description: string; amount: number }[]
    totalAmount: number
  } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token || !invoiceId) return
    setLoading(true)
    fetch(apiUrl(`/api/v1/portal/tenant/invoices/${encodeURIComponent(invoiceId)}`), {
      headers: authHeaders(token),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
        return r.json()
      })
      .then(setInv)
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false))
  }, [token, invoiceId])

  const downloadPdf = () => {
    if (!token || !invoiceId) return
    fetch(apiUrl(`/api/v1/portal/tenant/invoices/${encodeURIComponent(invoiceId)}/pdf`), {
      headers: authHeaders(token),
    })
      .then((r) =>
        downloadPdfFromResponse(r, `tax-invoice-${invoiceId.slice(0, 8).toUpperCase()}.pdf`),
      )
      .catch((e: Error) => setBillingActionErr(e.message))
  }

  return (
    <>
      <PortalPageHeader title="Invoice detail" />
      <Button component={RouterLink} to="/portal/tenant/invoices" size="small" sx={{ mb: 2 }}>
        ← Back to invoices
      </Button>
      {err ? <Alert severity="warning">{err}</Alert> : null}
      {loading ? <CircularProgress size={24} /> : null}
      {inv ? (
        <SectionCard
          title={`${inv.organizationName} · ${fmtDate(inv.periodStart)} – ${fmtDate(inv.periodEnd)}`}
          icon={<ReceiptLongOutlined />}
          action={
            <Button variant="outlined" size="small" startIcon={<PictureAsPdfOutlined />} onClick={downloadPdf}>
              Download PDF
            </Button>
          }
        >
          <Stack spacing={1} sx={{ mb: 2 }}>
            <Typography variant="body2">Status: <Chip size="small" label={inv.status} color={invoiceStatusChipColor(inv.status)} /></Typography>
            {inv.dueDate ? <Typography variant="body2">Due: {fmtDate(inv.dueDate)}</Typography> : null}
          </Stack>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Description</TableCell>
                  <TableCell align="right">Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {inv.lines.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{l.description}</TableCell>
                    <TableCell align="right">{fmtMoney(inv.currency, l.amount)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell><strong>Total</strong></TableCell>
                  <TableCell align="right"><strong>{fmtMoney(inv.currency, inv.totalAmount)}</strong></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
          {inv.notes ? (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="body2" color="text.secondary">{inv.notes}</Typography>
            </>
          ) : null}
        </SectionCard>
      ) : null}
    </>
  )
}

export function TenantStatementPage() {
  const { token, setBillingActionErr } = useDashboard()
  const [balance, setBalance] = useState(0)
  const [items, setItems] = useState<
    { id: string; narrative: string; signedAmount: number; currency: string; source: string; createdAt: string }[]
  >([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    const params = new URLSearchParams({
      page: String(page + 1),
      pageSize: String(pageSize),
    })
    fetch(apiUrl(`/api/v1/portal/tenant/statement?${params}`), { headers: authHeaders(token) })
      .then(async (r) => {
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
        return r.json() as Promise<{ balance: number; items: typeof items; total: number }>
      })
      .then((data) => {
        setBalance(data.balance)
        setItems(data.items)
        setTotal(data.total)
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false))
  }, [token, page, pageSize])

  const downloadCsv = () => {
    if (!token) return
    fetch(apiUrl('/api/v1/portal/tenant/statement/export'), { headers: authHeaders(token) })
      .then((r) => downloadCsvFromResponse(r, 'account-statement.csv'))
      .catch((e: Error) => setBillingActionErr(e.message))
  }

  return (
    <>
      <PortalPageHeader title="Account statement" subtitle="Append-only ledger for your tenant account." />
      <StatTile label="Current balance" value={balance.toLocaleString(undefined, { minimumFractionDigits: 2 })} icon={<SavingsOutlined fontSize="small" />} />
      <Box sx={{ mt: 2 }} />
      <SectionCard
        title="Ledger lines"
        icon={<SavingsOutlined />}
        action={
          <Button variant="outlined" size="small" startIcon={<TableChartOutlined />} onClick={downloadCsv}>
            Download CSV
          </Button>
        }
      >
        {err ? <Alert severity="warning" sx={{ mb: 2 }}>{err}</Alert> : null}
        {loading ? <CircularProgress size={24} /> : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell>Narrative</TableCell>
                  <TableCell align="right">Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{fmtDate(r.createdAt)}</TableCell>
                    <TableCell>{r.source}</TableCell>
                    <TableCell>{r.narrative}</TableCell>
                    <TableCell align="right">{fmtMoney(r.currency, r.signedAmount)}</TableCell>
                  </TableRow>
                ))}
                {items.length === 0 ? <TableRow><TableCell colSpan={4}>No ledger activity yet.</TableCell></TableRow> : null}
              </TableBody>
            </Table>
            <PortalTablePagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </TableContainer>
        )}
      </SectionCard>
    </>
  )
}

export function TenantLeasesPage() {
  const { token } = useDashboard()
  const [items, setItems] = useState<
    { id: string; status: string; startDate: string; endDate: string; units: { code: string; floor: string; building: string }[] }[]
  >([])
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    fetch(apiUrl('/api/v1/portal/tenant/leases'), { headers: authHeaders(token) })
      .then(async (r) => {
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
        return r.json() as Promise<{ items: typeof items }>
      })
      .then((data) => setItems(data.items))
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false))
  }, [token])

  return (
    <>
      <PortalPageHeader title="My leases" subtitle="Agreements and units linked to your tenant profile." />
      <SectionCard title="Leases" icon={<AssignmentOutlined />}>
        {err ? <Alert severity="warning" sx={{ mb: 2 }}>{err}</Alert> : null}
        {loading ? <CircularProgress size={24} /> : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Status</TableCell>
                  <TableCell>Term</TableCell>
                  <TableCell>Units</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <Chip size="small" variant="outlined" color={leaseStatusChipColor(l.status)} label={l.status.replace(/_/g, ' ')} />
                    </TableCell>
                    <TableCell>{fmtDate(l.startDate)} – {fmtDate(l.endDate)}</TableCell>
                    <TableCell>
                      {l.units.length
                        ? l.units.map((u) => `${u.building} / ${u.floor} / ${u.code}`).join('; ')
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 ? <TableRow><TableCell colSpan={3}>No leases found.</TableCell></TableRow> : null}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </SectionCard>
    </>
  )
}

export function OwnerPortalHomePage() {
  const { token, me } = useDashboard()
  const [snap, setSnap] = useState<OwnerPortalSnapshot | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    fetch(apiUrl('/api/v1/portal/owner'), { headers: authHeaders(token) })
      .then(async (r) => {
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
        return r.json() as Promise<OwnerPortalSnapshot>
      })
      .then(setSnap)
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false))
  }, [token])

  return (
    <>
      <PortalPageHeader
        title="Owner portal"
        subtitle={`${snap?.organization.name ?? me?.organizationName ?? 'Organization'} · portfolio overview`}
      />
      {err ? <Alert severity="warning" sx={{ mb: 2 }}>{err}</Alert> : null}
      {loading ? <CircularProgress size={24} /> : null}
      {snap ? (
        <Stack spacing={3}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} useFlexGap flexWrap="wrap">
            <StatTile label="Portfolios" value={snap.properties.portfolios} icon={<ApartmentOutlined fontSize="small" />} />
            <StatTile label="Buildings" value={snap.properties.buildings} icon={<ApartmentOutlined fontSize="small" />} />
            <StatTile label="Units" value={snap.properties.units} icon={<ApartmentOutlined fontSize="small" />} />
            <StatTile label="Active leases" value={snap.occupancy.activeLeases} icon={<AssignmentOutlined fontSize="small" />} />
            <StatTile
              label="Ledger balance"
              value={snap.finance.ledgerBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              icon={<SavingsOutlined fontSize="small" />}
            />
          </Stack>
          <PortalNavCards items={OWNER_NAV.slice(1)} />
        </Stack>
      ) : null}
    </>
  )
}

export function OwnerPropertiesPage() {
  const { token } = useDashboard()
  const [items, setItems] = useState<
    { id: string; name: string; region: string | null; buildingCount: number; unitCount: number; buildings: { name: string; address: string | null; unitCount: number }[] }[]
  >([])
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    fetch(apiUrl('/api/v1/portal/owner/properties'), { headers: authHeaders(token) })
      .then(async (r) => {
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
        return r.json() as Promise<{ items: typeof items }>
      })
      .then((data) => setItems(data.items))
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false))
  }, [token])

  return (
    <>
      <PortalPageHeader title="Properties" subtitle="Portfolios and buildings in your organization." />
      <SectionCard title="Portfolios" icon={<ApartmentOutlined />}>
        {err ? <Alert severity="warning" sx={{ mb: 2 }}>{err}</Alert> : null}
        {loading ? <CircularProgress size={24} /> : (
          <Stack spacing={2}>
            {items.map((p) => (
              <Card key={p.id} variant="outlined" sx={{ p: 2 }}>
                <Typography fontWeight={700}>{p.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {p.region ?? 'No region'} · {p.buildingCount} buildings · {p.unitCount} units
                </Typography>
                {p.buildings.length > 0 ? (
                  <TableContainer sx={{ mt: 1 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Building</TableCell>
                          <TableCell>Address</TableCell>
                          <TableCell align="right">Units</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {p.buildings.map((b) => (
                          <TableRow key={b.name}>
                            <TableCell>{b.name}</TableCell>
                            <TableCell>{b.address ?? '—'}</TableCell>
                            <TableCell align="right">{b.unitCount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : null}
              </Card>
            ))}
            {items.length === 0 ? <Typography color="text.secondary">No portfolios yet.</Typography> : null}
          </Stack>
        )}
      </SectionCard>
    </>
  )
}

export function OwnerInvoicesPage() {
  const { token } = useDashboard()
  const [items, setItems] = useState<
    { id: string; status: string; tenantName: string; periodStart: string; periodEnd: string; currency: string; totalAmount: number }[]
  >([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    const params = new URLSearchParams({
      page: String(page + 1),
      pageSize: String(pageSize),
    })
    fetch(apiUrl(`/api/v1/portal/owner/invoices?${params}`), { headers: authHeaders(token) })
      .then(async (r) => {
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
        return r.json() as Promise<{ items: typeof items; total: number }>
      })
      .then((data) => {
        setItems(data.items)
        setTotal(data.total)
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false))
  }, [token, page, pageSize])

  return (
    <>
      <PortalPageHeader title="Invoices" subtitle="Read-only view of organization billing." />
      <SectionCard title="All invoices" icon={<ReceiptLongOutlined />}>
        {err ? <Alert severity="warning" sx={{ mb: 2 }}>{err}</Alert> : null}
        {loading ? <CircularProgress size={24} /> : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Tenant</TableCell>
                  <TableCell>Period</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>{inv.tenantName}</TableCell>
                    <TableCell>{fmtDate(inv.periodStart)} – {fmtDate(inv.periodEnd)}</TableCell>
                    <TableCell>
                      <Chip size="small" variant="outlined" color={invoiceStatusChipColor(inv.status)} label={inv.status} />
                    </TableCell>
                    <TableCell align="right">{fmtMoney(inv.currency, inv.totalAmount)}</TableCell>
                    <TableCell align="right">
                      <Button size="small" component={RouterLink} to={`/portal/owner/invoices/${inv.id}`}>Open</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 ? <TableRow><TableCell colSpan={5}>No invoices.</TableCell></TableRow> : null}
              </TableBody>
            </Table>
            <PortalTablePagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </TableContainer>
        )}
      </SectionCard>
    </>
  )
}

export function OwnerInvoiceDetailPage() {
  const { token, setBillingActionErr } = useDashboard()
  const { invoiceId = '' } = useParams()
  const [inv, setInv] = useState<{
    id: string
    status: string
    periodStart: string
    periodEnd: string
    dueDate: string | null
    currency: string
    notes: string | null
    organizationName: string
    tenantName: string
    tenantEmail: string | null
    lines: { id: string; description: string; amount: number }[]
    totalAmount: number
  } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token || !invoiceId) return
    setLoading(true)
    fetch(apiUrl(`/api/v1/portal/owner/invoices/${encodeURIComponent(invoiceId)}`), {
      headers: authHeaders(token),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
        return r.json()
      })
      .then(setInv)
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false))
  }, [token, invoiceId])

  const downloadPdf = () => {
    if (!token || !invoiceId) return
    fetch(apiUrl(`/api/v1/portal/owner/invoices/${encodeURIComponent(invoiceId)}/pdf`), {
      headers: authHeaders(token),
    })
      .then((r) =>
        downloadPdfFromResponse(r, `invoice-${invoiceId.slice(0, 8).toUpperCase()}.pdf`),
      )
      .catch((e: Error) => setBillingActionErr(e.message))
  }

  return (
    <>
      <PortalPageHeader title="Invoice detail" />
      <Button component={RouterLink} to="/portal/owner/invoices" size="small" sx={{ mb: 2 }}>
        ← Back to invoices
      </Button>
      {err ? <Alert severity="warning">{err}</Alert> : null}
      {loading ? <CircularProgress size={24} /> : null}
      {inv ? (
        <SectionCard
          title={`${inv.organizationName} · ${inv.tenantName}`}
          icon={<ReceiptLongOutlined />}
          action={
            <Button variant="outlined" size="small" startIcon={<PictureAsPdfOutlined />} onClick={downloadPdf}>
              Download PDF
            </Button>
          }
        >
          <Stack spacing={1} sx={{ mb: 2 }}>
            <Typography variant="body2">
              Period: {fmtDate(inv.periodStart)} – {fmtDate(inv.periodEnd)}
            </Typography>
            <Typography variant="body2">
              Status: <Chip size="small" label={inv.status} color={invoiceStatusChipColor(inv.status)} />
            </Typography>
            {inv.dueDate ? <Typography variant="body2">Due: {fmtDate(inv.dueDate)}</Typography> : null}
            {inv.tenantEmail ? (
              <Typography variant="body2" color="text.secondary">Tenant contact: {inv.tenantEmail}</Typography>
            ) : null}
          </Stack>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Description</TableCell>
                  <TableCell align="right">Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {inv.lines.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{l.description}</TableCell>
                    <TableCell align="right">{fmtMoney(inv.currency, l.amount)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell><strong>Total</strong></TableCell>
                  <TableCell align="right"><strong>{fmtMoney(inv.currency, inv.totalAmount)}</strong></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
          {inv.notes ? (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="body2" color="text.secondary">{inv.notes}</Typography>
            </>
          ) : null}
        </SectionCard>
      ) : null}
    </>
  )
}
