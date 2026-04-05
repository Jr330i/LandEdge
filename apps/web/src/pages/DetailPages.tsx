import AddOutlined from '@mui/icons-material/AddOutlined'
import ApartmentOutlined from '@mui/icons-material/ApartmentOutlined'
import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import AssignmentOutlined from '@mui/icons-material/AssignmentOutlined'
import DnsOutlined from '@mui/icons-material/DnsOutlined'
import PeopleOutlineOutlined from '@mui/icons-material/PeopleOutlineOutlined'
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined'
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined'
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import SavingsOutlined from '@mui/icons-material/SavingsOutlined'
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined'
import {
  Alert,
  Box,
  Button,
  Chip,
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
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { useCallback, useMemo, useState, type FormEvent } from 'react'
import {
  invoiceStatusChipColor,
  leaseStatusChipColor,
  sectionCardHeaderOutlinedSx,
  SectionCard,
} from '../components/DashboardUi'
import { useDashboard } from '../dashboard/context'
import type { LeaseRow, TenantRow } from '../dashboard/types'
import { readApiErrorMessage } from '../lib/apiError'
import { authHeaders } from '../lib/auth'
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

function leaseDateToInputValue(iso: string): string {
  if (iso.length >= 10 && iso[4] === '-' && iso[7] === '-') {
    return iso.slice(0, 10)
  }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
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

function leaseMatchesSearch(l: LeaseRow, needleLower: string): boolean {
  const tenant = [l.tenant.legalName, l.tenant.tradingName ?? '']
    .join(' ')
    .toLowerCase()
  const status = l.status.replace(/_/g, ' ').toLowerCase()
  const units = l.leaseUnits.map((lu) => formatLeaseUnitCell(lu).toLowerCase()).join(' ')
  const start = new Date(l.startDate).toLocaleDateString().toLowerCase()
  const end = new Date(l.endDate).toLocaleDateString().toLowerCase()
  const hay = `${tenant} ${status} ${units} ${start} ${end}`
  return hay.includes(needleLower)
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

export function OrganizationsPage() {
  const { orgs, orgsErr } = useDashboard()
  return (
    <>
      <PageHeader title="Organizations" />
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
                  <TableCell align="right">Users</TableCell>
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
                    <TableCell align="right">{o._count.users}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </SectionCard>
    </>
  )
}

export function PortfoliosPage() {
  const {
    portfolios,
    portfoliosErr,
    canWriteProperty,
    newPortfolioName,
    setNewPortfolioName,
    portfolioSaving,
    handleCreatePortfolio,
  } = useDashboard()
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
              <Button
                type="submit"
                variant="contained"
                disabled={portfolioSaving || !newPortfolioName.trim()}
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
                  <TableCell>Region</TableCell>
                  <TableCell align="right">Buildings</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {portfolios.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Typography fontWeight={600}>{p.name}</Typography>
                    </TableCell>
                    <TableCell>{p.region ?? '—'}</TableCell>
                    <TableCell align="right">{p._count.buildings}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </SectionCard>
      <Box sx={{ mt: 3 }}>
        <PropertyHierarchyPanel />
      </Box>
    </>
  )
}

function tenantDisplayName(row: TenantRow) {
  return row.tradingName ?? row.legalName
}

function tenantMatchesSearch(row: TenantRow, needleLower: string): boolean {
  const parts = [
    row.legalName,
    row.tradingName ?? '',
    row.contactEmail ?? '',
    row.contactPhone ?? '',
    String(row._count.leases),
  ]
  const hay = parts.join(' ').toLowerCase()
  return hay.includes(needleLower)
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

export function TenantsPage() {
  const {
    token,
    signOut,
    tenants,
    tenantsErr,
    canWriteProperty,
    reloadTenants,
    reloadLeases,
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

  const filteredTenants = useMemo(() => {
    if (!tenants) return []
    const q = tenantSearch.trim().toLowerCase()
    if (!q) return tenants
    return tenants.filter((row) => tenantMatchesSearch(row, q))
  }, [tenants, tenantSearch])

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
    fetch('/api/v1/tenants', {
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
        reloadTenants()
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
    fetch(`/api/v1/tenants/${editingTenant.id}`, {
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
        reloadTenants()
        reloadLeases()
      })
      .catch((err: Error) => setEditErr(err.message))
      .finally(() => setEditSaving(false))
  }

  const submitDeleteTenant = () => {
    if (!token || !deletingTenant) return
    setDeleteSaving(true)
    setDeleteErr(null)
    fetch(`/api/v1/tenants/${deletingTenant.id}`, {
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
        reloadTenants()
        reloadLeases()
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
        subtitle="Filter client-side by name, email, phone, or lease count. Writes: property roles."
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
        {tenantsErr && (
          <Alert severity="warning" variant="outlined">
            {tenantsErr}
          </Alert>
        )}
        {!tenantsErr && tenants === null && (
          <Stack spacing={1}>
            <Skeleton height={36} />
            <Skeleton height={36} />
          </Stack>
        )}
        {!tenantsErr && tenants && tenants.length === 0 && (
          <Typography color="text.secondary">No tenants yet.</Typography>
        )}
        {!tenantsErr &&
          tenants &&
          tenants.length > 0 &&
          filteredTenants.length === 0 && (
            <Typography color="text.secondary">
              {`No tenants match "${tenantSearch.trim()}".`}
            </Typography>
          )}
        {!tenantsErr && tenants && tenants.length > 0 && filteredTenants.length > 0 && (
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
                {filteredTenants.map((row) => (
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
    signOut,
    reloadLeases,
    canWriteProperty,
    leases,
    leasesErr,
    tenants,
    portfolios,
    portfoliosErr,
    leaseTenantFilter,
    onLeaseTenantFilterChange,
  } = useDashboard()

  const [createTenantId, setCreateTenantId] = useState('')
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

  const filteredLeases = useMemo(() => {
    if (!leases) return []
    const q = leaseSearch.trim().toLowerCase()
    if (!q) return leases
    return leases.filter((l) => leaseMatchesSearch(l, q))
  }, [leases, leaseSearch])

  const handleUnauthorized = useCallback(() => {
    signOut()
  }, [signOut])

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
    fetch('/api/v1/leases', {
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
        reloadLeases()
        setCreateErr(null)
        setCreateNotes('')
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
    fetch(`/api/v1/leases/${editingLease.id}`, {
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
        setEditReplaceUnitsEnabled(false)
        editReplaceCascade.resetAll()
        reloadLeases()
      })
      .catch((e: Error) => setEditErr(e.message))
      .finally(() => setEditSaving(false))
  }

  const submitDeleteLease = () => {
    if (!token || !deletingLease) return
    setDeleteSaving(true)
    setDeleteErr(null)
    fetch(`/api/v1/leases/${deletingLease.id}`, {
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
        reloadLeases()
      })
      .catch((e: Error) => setDeleteErr(e.message))
      .finally(() => setDeleteSaving(false))
  }

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
                <FormControl fullWidth size="small">
                  <InputLabel id="create-lease-tenant-label">Tenant</InputLabel>
                  <Select
                    labelId="create-lease-tenant-label"
                    label="Tenant"
                    value={createTenantId}
                    onChange={(e) => setCreateTenantId(e.target.value)}
                  >
                    <MenuItem value="">
                      <em>Select tenant</em>
                    </MenuItem>
                    {(tenants ?? []).map((row) => (
                      <MenuItem key={row.id} value={row.id}>
                        {row.tradingName ?? row.legalName}
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
        subtitle="API filter by tenant; search narrows the loaded list (status, units, dates, names)."
        icon={<AssignmentOutlined />}
        action={
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            useFlexGap
            sx={{ width: { xs: '100%', sm: 'auto' }, alignItems: { sm: 'center' } }}
          >
            <FormControl
              size="small"
              sx={{
                minWidth: { xs: '100%', sm: 220 },
                ...sectionCardHeaderOutlinedSx,
              }}
            >
              <InputLabel id="lease-tenant-filter-label">Tenant</InputLabel>
              <Select
                labelId="lease-tenant-filter-label"
                label="Tenant"
                value={leaseTenantFilter}
                onChange={onLeaseTenantFilterChange}
              >
                <MenuItem value="">
                  <em>All tenants</em>
                </MenuItem>
                {(tenants ?? []).map((row) => (
                  <MenuItem key={row.id} value={row.id}>
                    {row.tradingName ?? row.legalName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
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
        {leasesErr && (
          <Alert severity="warning" variant="outlined">
            {leasesErr}
          </Alert>
        )}
        {!leasesErr && leases === null && (
          <Stack spacing={1}>
            <Skeleton height={40} />
            <Skeleton height={40} />
          </Stack>
        )}
        {!leasesErr && leases && leases.length === 0 && (
          <Typography color="text.secondary">No leases match this filter.</Typography>
        )}
        {!leasesErr &&
          leases &&
          leases.length > 0 &&
          filteredLeases.length === 0 && (
            <Typography color="text.secondary">
              {`No leases match "${leaseSearch.trim()}".`}
            </Typography>
          )}
        {!leasesErr && leases && leases.length > 0 && filteredLeases.length > 0 && (
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
                  <TableCell align="right" width={canWriteProperty ? 148 : 56}>
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredLeases.map((l) => (
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
                    <TableCell sx={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem' }}>
                      {l.leaseUnits.map(formatLeaseUnitCell).join(', ') || '—'}
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
  const {
    leases,
    billingLeaseId,
    onBillingLeaseChange,
    chargeSchedules,
    chargeSchedulesErr,
  } = useDashboard()
  return (
    <>
      <PageHeader title="Charge schedules" />
      <SectionCard
        title="Charge schedules"
        subtitle="Recurring charges per lease (rent, CAM, etc.). Writes: SUPER_ADMIN, ORG_ADMIN, FINANCE."
        icon={<ScheduleOutlined />}
        action={
          leases && leases.length > 0 ? (
            <FormControl size="small" sx={{ minWidth: 260 }}>
              <InputLabel id="billing-lease-label">Lease</InputLabel>
              <Select
                labelId="billing-lease-label"
                label="Lease"
                value={billingLeaseId}
                onChange={onBillingLeaseChange}
              >
                {leases.map((l) => (
                  <MenuItem key={l.id} value={l.id}>
                    {l.tenant.tradingName ?? l.tenant.legalName} ·{' '}
                    {l.leaseUnits.map(formatLeaseUnitCell).join(', ')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : undefined
        }
      >
        {chargeSchedulesErr && (
          <Alert severity="warning" variant="outlined">
            {chargeSchedulesErr}
          </Alert>
        )}
        {!chargeSchedulesErr && chargeSchedules === null && billingLeaseId && (
          <Stack spacing={1}>
            <Skeleton height={36} />
            <Skeleton height={36} />
          </Stack>
        )}
        {!billingLeaseId && (
          <Typography color="text.secondary">
            <Button component={RouterLink} to="/leases" size="small" sx={{ p: 0, minWidth: 0 }}>
              Create or open a lease
            </Button>{' '}
            first to attach charge schedules.
          </Typography>
        )}
        {billingLeaseId &&
          chargeSchedules &&
          chargeSchedules.length === 0 && (
            <Typography color="text.secondary">
              No charge schedules for this lease (seed adds monthly rent for the demo lease).
            </Typography>
          )}
        {chargeSchedules && chargeSchedules.length > 0 && (
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
                  <TableCell>Kind</TableCell>
                  <TableCell>Label</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Frequency</TableCell>
                  <TableCell>Active</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {chargeSchedules.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell sx={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem' }}>
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
                    <TableCell>{c.active ? 'Yes' : 'No'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </SectionCard>
    </>
  )
}

export function BillingInvoicesPage() {
  const {
    billingInvoicesErr,
    billingInvoices,
    canWriteBilling,
    billingLeaseId,
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
        subtitle="Generate drafts from charge schedules by month, then Issue to post the sub-ledger. Manual lines still available via API."
        icon={<ReceiptLongOutlined />}
        action={
          canWriteBilling && billingLeaseId ? (
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
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
                disabled={generateSaving}
                onClick={handleGenerateFromSchedules}
              >
                {generateSaving ? 'Generating…' : 'Generate from schedules'}
              </Button>
            </Stack>
          ) : undefined
        }
      >
        {!billingLeaseId && (
          <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
            Select a lease on the{' '}
            <Button component={RouterLink} to="/billing/schedules" size="small">
              Charge schedules
            </Button>{' '}
            page (or ensure you have leases) before generating invoices.
          </Alert>
        )}
        {billingInvoicesErr && (
          <Alert severity="warning" variant="outlined">
            {billingInvoicesErr}
          </Alert>
        )}
        {billingInvoices === null && (
          <Stack spacing={1}>
            <Skeleton height={40} />
            <Skeleton height={40} />
          </Stack>
        )}
        {billingInvoices && billingInvoices.length === 0 && (
          <Typography color="text.secondary">No invoices yet.</Typography>
        )}
        {billingInvoices && billingInvoices.length > 0 && (
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
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell>Lines</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {billingInvoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      {new Date(inv.periodStart).toLocaleDateString()} –{' '}
                      {new Date(inv.periodEnd).toLocaleDateString()}
                    </TableCell>
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
                    <TableCell align="right">
                      {canWriteBilling && inv.status === 'DRAFT' && (
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => handleIssueInvoice(inv.id)}
                          >
                            Issue
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleVoidInvoice(inv.id)}
                          >
                            Void
                          </Button>
                        </Stack>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </SectionCard>
    </>
  )
}

export function BillingLedgerPage() {
  const { ledgerErr, ledgerEntries, downloadLedgerCsv } = useDashboard()
  return (
    <>
      <PageHeader title="Tenant sub-ledger" />
      <SectionCard
        title="Tenant sub-ledger"
        subtitle="Append-only lines (invoice postings, payments, adjustments). CSV export for ERP handoff."
        icon={<SavingsOutlined />}
        action={
          <Button variant="outlined" size="small" onClick={downloadLedgerCsv}>
            Download CSV
          </Button>
        }
      >
        {ledgerErr && (
          <Alert severity="warning" variant="outlined">
            {ledgerErr}
          </Alert>
        )}
        {ledgerEntries === null && (
          <Stack spacing={1}>
            <Skeleton height={36} />
            <Skeleton height={36} />
          </Stack>
        )}
        {ledgerEntries && ledgerEntries.length === 0 && (
          <Typography color="text.secondary">No ledger entries yet.</Typography>
        )}
        {ledgerEntries && ledgerEntries.length > 0 && (
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
                  <TableCell>Source</TableCell>
                  <TableCell>Narrative</TableCell>
                  <TableCell align="right">Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {ledgerEntries.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      {new Date(row.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem' }}>
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
        )}
      </SectionCard>
    </>
  )
}
