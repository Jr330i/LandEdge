import ApartmentOutlined from '@mui/icons-material/ApartmentOutlined'
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
  Avatar,
  Box,
  Card,
  CardActionArea,
  Stack,
  Typography,
} from '@mui/material'
import type { ReactNode } from 'react'
import { alpha } from '@mui/material/styles'
import { Link as RouterLink } from 'react-router-dom'
import { StatTile } from '../components/DashboardUi'
import { useDashboard } from '../dashboard/context'

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

export function DashboardHome() {
  const {
    me,
    health,
    healthErr,
    orgs,
    orgsErr,
    portfolios,
    portfoliosErr,
    tenants,
    tenantsErr,
    leases,
    leasesErr,
    billingInvoices,
    billingInvoicesErr,
    ledgerEntries,
    ledgerErr,
  } = useDashboard()

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
          value={tenants?.length ?? '—'}
          icon={<PeopleOutlineOutlined fontSize="small" />}
          loading={tenants === null && !tenantsErr}
        />
        <StatTile
          label="Leases"
          value={leases?.length ?? '—'}
          icon={<AssignmentOutlined fontSize="small" />}
          loading={leases === null && !leasesErr}
        />
        <StatTile
          label="Invoices"
          value={billingInvoices?.length ?? '—'}
          icon={<ReceiptLongOutlined fontSize="small" />}
          loading={billingInvoices === null && !billingInvoicesErr}
        />
        <StatTile
          label="Ledger lines"
          value={ledgerEntries?.length ?? '—'}
          icon={<SavingsOutlined fontSize="small" />}
          loading={ledgerEntries === null && !ledgerErr}
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
        {NAV_CARDS.map((c) => (
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
  )
}
