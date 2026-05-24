import AccountBalanceOutlined from '@mui/icons-material/AccountBalanceOutlined'
import LogoutOutlined from '@mui/icons-material/LogoutOutlined'
import MenuOutlined from '@mui/icons-material/MenuOutlined'
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  Container,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom'
import { useDashboard } from '../dashboard/context'
import { CONSOLE_ACCESS_ROLES, PERFORMANCE_VIEW_ROLES } from '../dashboard/types'

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

export function DashboardShell() {
  const { me, signOut, billingLeaseId, setBillingLeaseId } = useDashboard()

  const navLinks = useMemo(() => {
    if (me?.role === 'TENANT_USER') {
      return [
        { to: '/portal/tenant', label: 'Home' },
        { to: '/portal/tenant/invoices', label: 'Invoices' },
        { to: '/portal/tenant/statement', label: 'Statement' },
        { to: '/portal/tenant/leases', label: 'Leases' },
      ]
    }
    if (me?.role === 'OWNER_USER') {
      return [
        { to: '/portal/owner', label: 'Home' },
        { to: '/portal/owner/properties', label: 'Properties' },
        { to: '/portal/owner/invoices', label: 'Invoices' },
      ]
    }
    const consoleAllowed = !!me && CONSOLE_ACCESS_ROLES.has(me.role)
    const perf =
      me && PERFORMANCE_VIEW_ROLES.has(me.role)
        ? [{ to: '/performance', label: 'Performance' }]
        : []
    const allConsoleLinks = [
      { to: '/organizations', label: 'Organizations' },
      { to: '/portfolios', label: 'Portfolios' },
      { to: '/tenants', label: 'Tenants' },
      { to: '/leases', label: 'Leases' },
      { to: '/billing/schedules', label: 'Charge schedules' },
      { to: '/billing/invoices', label: 'Invoices' },
      { to: '/billing/ledger', label: 'Ledger' },
    ]
    const consoleLinks = consoleAllowed
      ? allConsoleLinks.filter((l) => {
          if (me?.role === 'FACILITIES_MANAGER') return FACILITIES_ALLOWED.has(l.to)
          if (me?.role === 'READ_ONLY') return READ_ONLY_ALLOWED.has(l.to)
          return true
        })
      : []
    return [
      { to: '/', label: 'Home' },
      ...perf,
      ...consoleLinks,
    ]
  }, [me])
  const [menuEl, setMenuEl] = useState<null | HTMLElement>(null)
  const location = useLocation()
  const menuOpen = Boolean(menuEl)

  const closeMenu = () => setMenuEl(null)

  useEffect(() => {
    if (!location.pathname.startsWith('/billing')) return
    const q = new URLSearchParams(location.search).get('leaseId')
    if (!q) return
    if (billingLeaseId !== q) setBillingLeaseId(q)
  }, [location.pathname, location.search, billingLeaseId, setBillingLeaseId])

  const portalSubtitle =
    me?.role === 'TENANT_USER'
      ? 'Tenant portal'
      : me?.role === 'OWNER_USER'
        ? 'Owner portal'
        : 'Admin console'

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="sticky"
        elevation={0}
        color="transparent"
        sx={{
          bgcolor: alpha('#ffffff', 0.92),
          color: 'text.primary',
          backdropFilter: 'blur(14px)',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Toolbar sx={{ gap: 2, py: 1, minHeight: { xs: 64, sm: 72 }, flexWrap: 'wrap' }}>
          <Button
            component={RouterLink}
            to={me?.role === 'TENANT_USER' ? '/portal/tenant' : me?.role === 'OWNER_USER' ? '/portal/owner' : '/'}
            color="inherit"
            sx={{
              textAlign: 'left',
              textTransform: 'none',
              flexGrow: { xs: 1, md: 0 },
              minWidth: 0,
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #2563eb 0%, #0d9488 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
                }}
              >
                <AccountBalanceOutlined sx={{ color: 'common.white', fontSize: 24 }} />
              </Box>
              <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>
                  Sofinda
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {portalSubtitle}
                </Typography>
              </Box>
            </Stack>
          </Button>

          <IconButton
            color="inherit"
            aria-label="open navigation menu"
            onClick={(e) => setMenuEl(e.currentTarget)}
            sx={{ display: { xs: 'inline-flex', lg: 'none' } }}
          >
            <MenuOutlined />
          </IconButton>
          <Menu
            anchorEl={menuEl}
            open={menuOpen}
            onClose={closeMenu}
            slotProps={{
              paper: {
                sx: {
                  minWidth: 220,
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                  boxShadow: (t) => t.shadows[8],
                },
              },
            }}
          >
            {navLinks.map(({ to, label }) => (
              <MenuItem
                key={to}
                component={RouterLink}
                to={to}
                onClick={closeMenu}
                selected={location.pathname === to}
              >
                {label}
              </MenuItem>
            ))}
          </Menu>

          <Stack
            direction="row"
            spacing={0.5}
            flexWrap="wrap"
            useFlexGap
            sx={{ display: { xs: 'none', lg: 'flex' }, alignItems: 'center' }}
          >
            {navLinks.map(({ to, label }) => (
              <Button
                key={to}
                component={RouterLink}
                to={to}
                color="inherit"
                size="small"
              >
                {label === 'Charge schedules' ? 'Schedules' : label}
              </Button>
            ))}
          </Stack>

          {me && (
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ ml: { lg: 'auto' } }}>
              <Chip
                size="small"
                label={me.role.replace(/_/g, ' ')}
                color="primary"
                variant="outlined"
                sx={{
                  fontWeight: 600,
                  display: { xs: 'none', md: 'flex' },
                  textTransform: 'capitalize',
                }}
              />
              <Chip
                size="small"
                label={me.organizationName ?? me.organizationSlug ?? me.organizationId}
                color="default"
                variant="outlined"
                sx={{
                  fontWeight: 600,
                  display: { xs: 'none', lg: 'flex' },
                  maxWidth: 220,
                }}
              />
              <Avatar
                component={RouterLink}
                to="/profile"
                sx={{
                  width: 38,
                  height: 38,
                  bgcolor: 'secondary.main',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                {(me.displayName?.[0] ?? me.email?.[0] ?? '?').toUpperCase()}
              </Avatar>
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<LogoutOutlined />}
                onClick={signOut}
                sx={{
                  borderColor: 'divider',
                  display: { xs: 'none', sm: 'inline-flex' },
                }}
              >
                Sign out
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                onClick={signOut}
                sx={{ display: { xs: 'inline-flex', sm: 'none' }, minWidth: 0, px: 1.5 }}
              >
                <LogoutOutlined fontSize="small" />
              </Button>
            </Stack>
          )}
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: { xs: 3, sm: 4 } }}>
        <Outlet />
      </Container>
    </Box>
  )
}
