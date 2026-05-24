import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useState, type FormEvent } from 'react'
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom'

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (!token) {
      setErr('Missing reset token. Open the link from your email.')
      return
    }
    if (password.length < 6) {
      setErr('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setErr('Passwords do not match.')
      return
    }
    setLoading(true)
    fetch('/api/v1/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })
      .then(async (r) => {
        const body = (await r.json().catch(() => ({}))) as { message?: string | string[] }
        if (!r.ok) {
          const m = body.message
          throw new Error(
            typeof m === 'string' ? m : Array.isArray(m) ? m.join('; ') : 'Reset failed',
          )
        }
      })
      .then(() => setOk(true))
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false))
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
        bgcolor: 'background.default',
      }}
    >
      <Paper
        component="form"
        onSubmit={submit}
        elevation={0}
        sx={{ width: '100%', maxWidth: 440, p: 4, border: 1, borderColor: 'divider', borderRadius: 3 }}
      >
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Set your password
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Choose a password for your Sofinda account.
        </Typography>
        {ok ? (
          <Stack spacing={2}>
            <Alert severity="success">Password saved. You can sign in now.</Alert>
            <Button variant="contained" onClick={() => navigate('/')}>
              Go to sign in
            </Button>
          </Stack>
        ) : (
          <Stack spacing={2}>
            {err ? <Alert severity="error">{err}</Alert> : null}
            <TextField
              label="New password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
              autoComplete="new-password"
            />
            <TextField
              label="Confirm password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              fullWidth
              autoComplete="new-password"
            />
            <Button type="submit" variant="contained" disabled={loading} fullWidth>
              {loading ? 'Saving…' : 'Save password'}
            </Button>
            <Button component={RouterLink} to="/" size="small">
              Back to sign in
            </Button>
          </Stack>
        )}
      </Paper>
    </Box>
  )
}
