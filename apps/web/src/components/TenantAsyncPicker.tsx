import Autocomplete from '@mui/material/Autocomplete'
import { apiUrl } from '../lib/api'
import CircularProgress from '@mui/material/CircularProgress'
import TextField from '@mui/material/TextField'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TenantRow } from '../dashboard/types'
import { readApiErrorMessage } from '../lib/apiError'
import { authHeaders } from '../lib/auth'

const LIST_PAGE_SIZE = 50

function tenantOptionLabel(t: TenantRow): string {
  return t.tradingName ?? t.legalName
}

export type TenantAsyncPickerProps = {
  token: string
  value: string
  onChange: (tenantId: string) => void
  label: string
  allowClear?: boolean
  size?: 'small' | 'medium'
  disabled?: boolean
  sx?: Record<string, unknown>
  helperText?: string
  onUnauthorized?: () => void
}

export function TenantAsyncPicker({
  token,
  value,
  onChange,
  label,
  allowClear = false,
  size = 'small',
  disabled = false,
  sx,
  helperText,
  onUnauthorized,
}: TenantAsyncPickerProps) {
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [options, setOptions] = useState<TenantRow[]>([])
  const [listTotal, setListTotal] = useState(0)
  const [listLoading, setListLoading] = useState(false)
  const [listErr, setListErr] = useState<string | null>(null)
  const [selectedTenant, setSelectedTenant] = useState<TenantRow | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQ(inputValue.trim()), 300)
    return () => window.clearTimeout(id)
  }, [inputValue])

  useEffect(() => {
    if (!value) {
      setSelectedTenant(null)
      return
    }
    let cancelled = false
    setDetailLoading(true)
    fetch(apiUrl(`/api/v1/tenants/${encodeURIComponent(value)}`), {
      headers: authHeaders(token),
    })
      .then(async (r) => {
        if (r.status === 401) {
          onUnauthorized?.()
          throw new Error('Session expired')
        }
        if (r.status === 404) {
          setSelectedTenant(null)
          return null
        }
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
        return r.json() as Promise<TenantRow>
      })
      .then((row) => {
        if (!cancelled && row) setSelectedTenant(row)
      })
      .catch(() => {
        if (!cancelled) setSelectedTenant(null)
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [value, token, onUnauthorized])

  useEffect(() => {
    if (open) return
    if (!value) {
      setInputValue('')
      return
    }
    if (selectedTenant?.id === value) {
      setInputValue(tenantOptionLabel(selectedTenant))
    }
  }, [value, selectedTenant, open])

  const fetchList = useCallback(() => {
    if (!open) return
    setListLoading(true)
    setListErr(null)
    const params = new URLSearchParams({
      page: '1',
      pageSize: String(LIST_PAGE_SIZE),
    })
    if (debouncedQ) params.set('q', debouncedQ)
    fetch(apiUrl(`/api/v1/tenants?${params}`), { headers: authHeaders(token) })
      .then(async (r) => {
        if (r.status === 401) {
          onUnauthorized?.()
          throw new Error('Session expired')
        }
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
        return r.json() as Promise<
          TenantRow[] | { items: TenantRow[]; total: number }
        >
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setOptions(data)
          setListTotal(data.length)
        } else {
          setOptions(data.items)
          setListTotal(data.total)
        }
      })
      .catch((e: Error) => {
        setListErr(e.message)
        setOptions([])
        setListTotal(0)
      })
      .finally(() => setListLoading(false))
  }, [open, debouncedQ, token, onUnauthorized])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const mergedOptions = useMemo(() => {
    if (!selectedTenant) return options
    if (options.some((o) => o.id === selectedTenant.id)) return options
    return [selectedTenant, ...options]
  }, [options, selectedTenant])

  const showTotalHint = listTotal > LIST_PAGE_SIZE

  return (
    <Autocomplete<TenantRow, false, boolean, false>
      sx={sx}
      size={size}
      disabled={disabled}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      loading={listLoading || detailLoading}
      filterOptions={(x) => x}
      options={mergedOptions}
      getOptionLabel={(o) => tenantOptionLabel(o)}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      value={value ? selectedTenant : null}
      onChange={(_, row) => {
        onChange(row?.id ?? '')
      }}
      inputValue={inputValue}
      onInputChange={(_, v, reason) => {
        if (reason === 'input' || reason === 'clear') {
          setInputValue(v)
        }
      }}
      disableClearable={!allowClear}
      noOptionsText={listErr ?? (listLoading ? 'Loading…' : 'No tenants')}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          helperText={
            helperText ??
            (showTotalHint
              ? `Showing first ${LIST_PAGE_SIZE} of ${listTotal} — type to narrow.`
              : undefined)
          }
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {listLoading ? (
                  <CircularProgress color="inherit" size={16} sx={{ mr: 0.5 }} />
                ) : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      ListboxProps={{
        style: { maxHeight: 280 },
      }}
      slotProps={{
        paper: {
          elevation: 8,
        },
      }}
    />
  )
}
