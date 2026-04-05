import { createTheme } from '@mui/material/styles'

export const appTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2563eb',
      dark: '#1d4ed8',
      light: '#93c5fd',
    },
    secondary: {
      main: '#0d9488',
      dark: '#0f766e',
      light: '#5eead4',
    },
    background: {
      default: '#e8edf4',
      paper: '#ffffff',
    },
    text: {
      primary: '#0f172a',
      secondary: '#475569',
    },
    divider: 'rgba(15, 23, 42, 0.09)',
  },
  shape: {
    borderRadius: 14,
  },
  typography: {
    fontFamily:
      '"Plus Jakarta Sans", "Roboto", "Helvetica Neue", Arial, sans-serif',
    h3: {
      fontWeight: 700,
      letterSpacing: '-0.03em',
      lineHeight: 1.15,
    },
    h4: { fontWeight: 700, letterSpacing: '-0.025em' },
    h5: { fontWeight: 700, letterSpacing: '-0.02em' },
    h6: { fontWeight: 600, letterSpacing: '-0.015em' },
    subtitle2: { fontWeight: 600, letterSpacing: '0.02em' },
    button: { fontWeight: 600, letterSpacing: '0.02em' },
  },
  components: {
    MuiAppBar: {
      defaultProps: {
        color: 'transparent',
      },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarWidth: 'thin',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 12,
          paddingInline: 22,
          paddingBlock: 10,
        },
        containedPrimary: {
          boxShadow: '0 4px 14px rgba(37, 99, 235, 0.32)',
          '&:hover': {
            boxShadow: '0 6px 20px rgba(37, 99, 235, 0.38)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 600,
          fontSize: '0.7rem',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'text.secondary',
          bgcolor: 'rgba(15, 23, 42, 0.04)',
          borderBottom: 'none',
        },
      },
    },
  },
})
