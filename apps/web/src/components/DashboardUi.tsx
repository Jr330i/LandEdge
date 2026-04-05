import type { ReactNode } from 'react'
import type { SxProps, Theme } from '@mui/material/styles'
import {
  Avatar,
  Box,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'

/** Outlined inputs on SectionCard headers (tinted bar) — paper fill and readable borders. */
export const sectionCardHeaderOutlinedSx: SxProps<Theme> = {
  '& .MuiOutlinedInput-root': {
    bgcolor: 'background.paper',
    color: 'text.primary',
  },
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: 'divider',
  },
  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: 'text.secondary',
  },
  '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: 'primary.main',
  },
}

export function leaseStatusChipColor(
  status: string,
):
  | 'default'
  | 'primary'
  | 'secondary'
  | 'error'
  | 'info'
  | 'success'
  | 'warning' {
  switch (status) {
    case 'ACTIVE':
      return 'success'
    case 'DRAFT':
      return 'default'
    case 'UNDER_REVIEW':
      return 'warning'
    case 'APPROVED':
    case 'RENEWED':
      return 'info'
    case 'EXPIRING':
      return 'warning'
    case 'TERMINATED':
      return 'error'
    default:
      return 'default'
  }
}

export function periodFromCalendarMonth(ym: string): {
  periodStart: string
  periodEnd: string
} {
  const [y, m] = ym.split('-').map(Number)
  const periodStart = new Date(Date.UTC(y, m - 1, 1))
  const periodEnd = new Date(Date.UTC(y, m, 0))
  return {
    periodStart: periodStart.toISOString().slice(0, 10),
    periodEnd: periodEnd.toISOString().slice(0, 10),
  }
}

export function invoiceStatusChipColor(
  status: string,
): 'default' | 'success' | 'error' | 'warning' {
  switch (status) {
    case 'ISSUED':
      return 'success'
    case 'VOID':
      return 'error'
    case 'DRAFT':
      return 'warning'
    default:
      return 'default'
  }
}

export function SectionCard({
  title,
  subtitle,
  icon,
  action,
  children,
}: {
  title: string
  subtitle?: string
  icon: ReactNode
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
        boxShadow: '0 4px 24px rgba(15, 23, 42, 0.045)',
      }}
    >
      <Box
        sx={{
          px: 3,
          py: 2.25,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: (t) => alpha(t.palette.primary.main, 0.04),
        }}
      >
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Avatar
            variant="rounded"
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
            }}
          >
            {icon}
          </Avatar>
          <Box>
            <Typography variant="h6" component="h2">
              {title}
            </Typography>
            {subtitle && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.35, maxWidth: 760 }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>
        </Stack>
        {action != null && (
          <Box
            sx={{
              flexShrink: 0,
              width: { xs: '100%', sm: 'auto' },
              alignSelf: { xs: 'stretch', sm: 'center' },
            }}
          >
            {action}
          </Box>
        )}
      </Box>
      <Box sx={{ p: 3 }}>{children}</Box>
    </Paper>
  )
}

export function StatTile({
  label,
  value,
  icon,
  loading,
  state = 'default',
}: {
  label: string
  value: ReactNode
  icon: ReactNode
  loading?: boolean
  state?: 'default' | 'success' | 'error'
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        flex: 1,
        minWidth: { xs: '100%', sm: 200 },
        p: 2.5,
        borderRadius: 3,
        borderColor:
          state === 'success'
            ? 'success.light'
            : state === 'error'
              ? 'error.light'
              : 'divider',
        bgcolor: 'background.paper',
        transition: 'box-shadow 0.2s ease',
        '&:hover': {
          boxShadow: '0 8px 28px rgba(15, 23, 42, 0.06)',
        },
      }}
    >
      <Stack direction="row" alignItems="center" spacing={2}>
        <Avatar
          variant="rounded"
          sx={{
            width: 46,
            height: 46,
            borderRadius: 2,
            bgcolor:
              state === 'success'
                ? (t) => alpha(t.palette.success.main, 0.12)
                : state === 'error'
                  ? (t) => alpha(t.palette.error.main, 0.12)
                  : 'action.hover',
            color:
              state === 'success'
                ? 'success.dark'
                : state === 'error'
                  ? 'error.dark'
                  : 'text.primary',
          }}
        >
          {icon}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            fontWeight={600}
            sx={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}
          >
            {label}
          </Typography>
          {loading ? (
            <Skeleton width={72} height={36} sx={{ mt: 0.5 }} />
          ) : (
            <Typography variant="h5" fontWeight={700} sx={{ lineHeight: 1.2 }}>
              {value}
            </Typography>
          )}
        </Box>
      </Stack>
    </Paper>
  )
}
