import AccountBalanceOutlined from '@mui/icons-material/AccountBalanceOutlined'
import CloudDoneOutlined from '@mui/icons-material/CloudDoneOutlined'
import CloudOffOutlined from '@mui/icons-material/CloudOffOutlined'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { FormEvent } from 'react'
import { useState } from 'react'
import type { Health } from '../dashboard/types'

type LoginPageProps = {
  loginSlug: string
  setLoginSlug: (v: string) => void
  loginEmail: string
  setLoginEmail: (v: string) => void
  loginPassword: string
  setLoginPassword: (v: string) => void
  loginErr: string | null
  loginLoading: boolean
  handleLogin: (e: FormEvent) => void
  health: Health | null
  healthErr: string | null
}

export function LoginPage({
  loginSlug,
  setLoginSlug,
  loginEmail,
  setLoginEmail,
  loginPassword,
  setLoginPassword,
  loginErr,
  loginLoading,
  handleLogin,
  health,
  healthErr,
}: LoginPageProps) {
  const apiOk = Boolean(health && !healthErr)
  const [mode, setMode] = useState<'login' | 'forgot'>('login')
  const [forgotErr, setForgotErr] = useState<string | null>(null)
  const [forgotOk, setForgotOk] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)

  const handleForgot = (e: FormEvent) => {
    e.preventDefault()
    setForgotErr(null)
    setForgotOk(false)
    setForgotLoading(true)
    fetch('/api/v1/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationSlug: loginSlug.trim(),
        email: loginEmail.trim(),
      }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const body = (await r.json().catch(() => ({}))) as { message?: string | string[] }
          const m = body.message
          throw new Error(
            typeof m === 'string' ? m : Array.isArray(m) ? m.join('; ') : 'Request failed',
          )
        }
      })
      .then(() => setForgotOk(true))
      .catch((err: Error) => setForgotErr(err.message))
      .finally(() => setForgotLoading(false))
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        bgcolor: 'background.default',
      }}
    >
      <Box
        sx={{
          display: { xs: 'flex', md: 'none' },
          alignItems: 'center',
          gap: 1.5,
          px: 2.5,
          py: 2,
          background: 'linear-gradient(92deg, #1d4ed8 0%, #4338ca 55%, #0f172a 100%)',
          color: 'common.white',
        }}
      >
        <Avatar
          variant="rounded"
          sx={{
            width: 40,
            height: 40,
            bgcolor: alpha('#fff', 0.15),
            color: 'common.white',
          }}
        >
          <AccountBalanceOutlined fontSize="small" />
        </Avatar>
        <Typography variant="subtitle1" fontWeight={700}>
          Sofinda
        </Typography>
      </Box>

      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flex: '0 0 44%',
          maxWidth: { md: 560 },
          flexDirection: 'column',
          justifyContent: 'space-between',
          p: 5,
          position: 'relative',
          overflow: 'hidden',
          background:
            'linear-gradient(152deg, #1d4ed8 0%, #3730a3 45%, #0f172a 100%)',
          color: 'common.white',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            width: 320,
            height: 320,
            borderRadius: '50%',
            top: '-12%',
            right: '-18%',
            bgcolor: alpha('#fff', 0.06),
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            width: 180,
            height: 180,
            borderRadius: '50%',
            bottom: '8%',
            left: '-6%',
            bgcolor: alpha('#fff', 0.05),
          }}
        />
        <Box sx={{ position: 'relative', zIndex: 1, pt: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 4 }}>
            <Avatar
              variant="rounded"
              sx={{
                width: 48,
                height: 48,
                bgcolor: alpha('#fff', 0.14),
                color: 'common.white',
              }}
            >
              <AccountBalanceOutlined />
            </Avatar>
            <Typography variant="h5" fontWeight={800} letterSpacing="-0.02em">
              Sofinda
            </Typography>
          </Stack>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 800,
              mb: 2,
              letterSpacing: '-0.04em',
              lineHeight: 1.1,
            }}
          >
            Operations clarity for real estate portfolios.
          </Typography>
          <Typography
            variant="h6"
            sx={{
              opacity: 0.9,
              fontWeight: 500,
              maxWidth: 400,
              lineHeight: 1.55,
              fontSize: '1.05rem',
            }}
          >
            Leases, tenants, and property hierarchy — scoped by organization with
            Postgres RLS.
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ opacity: 0.65, position: 'relative', zIndex: 1 }}>
          Admin console · PRD v5 aligned
        </Typography>
      </Box>

      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 2, sm: 4 },
          py: { xs: 4, md: 4 },
        }}
      >
        <Paper
          component={mode === 'login' ? 'form' : 'div'}
          onSubmit={mode === 'login' ? handleLogin : undefined}
          elevation={0}
          sx={{
            width: '100%',
            maxWidth: 440,
            p: { xs: 3, sm: 4 },
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 24px 64px -16px rgba(15, 23, 42, 0.14)',
          }}
        >
          <Typography variant="overline" color="primary" fontWeight={700}>
            {mode === 'login' ? 'Welcome back' : 'Password reset'}
          </Typography>
          <Typography variant="h5" sx={{ mt: 0.5, mb: 0.5, fontWeight: 700 }}>
            {mode === 'login' ? 'Sign in to continue' : 'Forgot your password?'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {mode === 'login' ? (
              <>
                Seeded demo: <code>super@demo.sofinda.local</code> / <code>demo123</code>{' '}
                · org <code>demo</code>
              </>
            ) : (
              'Enter your organization slug and email. If an account exists and email is configured, we will send a reset link.'
            )}
          </Typography>
          {(mode === 'login' ? loginErr : forgotErr) && (
            <Alert severity="error" sx={{ mb: 2 }} variant="outlined">
              {mode === 'login' ? loginErr : forgotErr}
            </Alert>
          )}
          {mode === 'forgot' && forgotOk ? (
            <Stack spacing={2}>
              <Alert severity="success" variant="outlined">
                If that account exists, a reset link has been sent. Check your inbox.
              </Alert>
              <Button variant="outlined" onClick={() => { setMode('login'); setForgotOk(false) }}>
                Back to sign in
              </Button>
            </Stack>
          ) : mode === 'forgot' ? (
            <Stack spacing={2.25} component="form" onSubmit={handleForgot}>
              <TextField
                label="Organization slug"
                value={loginSlug}
                onChange={(e) => setLoginSlug(e.target.value)}
                required
                fullWidth
                autoComplete="organization"
              />
              <TextField
                label="Email"
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                fullWidth
                autoComplete="username"
              />
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={forgotLoading}
                fullWidth
              >
                {forgotLoading ? 'Sending…' : 'Send reset link'}
              </Button>
              <Button type="button" size="small" onClick={() => setMode('login')}>
                Back to sign in
              </Button>
            </Stack>
          ) : (
          <Stack spacing={2.25}>
            <TextField
              label="Organization slug"
              value={loginSlug}
              onChange={(e) => setLoginSlug(e.target.value)}
              required
              fullWidth
              autoComplete="organization"
            />
            <TextField
              label="Email"
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              required
              fullWidth
              autoComplete="username"
            />
            <TextField
              label="Password"
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              required
              fullWidth
              autoComplete="current-password"
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={loginLoading}
              fullWidth
            >
              {loginLoading ? 'Signing in…' : 'Sign in'}
            </Button>
            <Button type="button" size="small" onClick={() => setMode('forgot')}>
              Forgot password?
            </Button>
          </Stack>
          )}
        </Paper>

        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{ mt: 3, color: 'text.secondary' }}
        >
          {apiOk ? (
            <CloudDoneOutlined color="success" fontSize="small" />
          ) : (
            <CloudOffOutlined color="disabled" fontSize="small" />
          )}
          <Typography variant="caption">
            {healthErr
              ? `API unreachable (${healthErr})`
              : health
                ? `${health.service} · ${health.status}`
                : 'Checking API…'}
          </Typography>
        </Stack>
      </Box>
    </Box>
  )
}
