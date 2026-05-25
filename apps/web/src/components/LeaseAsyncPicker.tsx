import Autocomplete from '@mui/material/Autocomplete'
import { apiUrl } from '../lib/api'
import CircularProgress from '@mui/material/CircularProgress'
import TextField from '@mui/material/TextField'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { LeaseRow } from '../dashboard/types'
import { readApiErrorMessage } from '../lib/apiError'
import { authHeaders } from '../lib/auth'

const LIST_PAGE_SIZE = 50

function leaseOptionLabel(l: LeaseRow): string {
  const tenant = l.tenant.tradingName ?? l.tenant.legalName
  const units = l.leaseUnits.map((lu) => lu.unit.code).filter(Boolean).join(', ')
  return units ? `${tenant} · ${units}` : tenant
}

export type LeaseAsyncPickerProps = {
  token: string
  value: string
  onChange: (leaseId: string) => void
  label: string
  allowClear?: boolean
  size?: 'small' | 'medium'
  disabled?: boolean
  sx?: Record<string, unknown>
  helperText?: string
  onUnauthorized?: () => void
  tenantId?: string
}

export function LeaseAsyncPicker({
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
  tenantId,
}: LeaseAsyncPickerProps) {
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [options, setOptions] = useState<LeaseRow[]>([])
  const [listTotal, setListTotal] = useState(0)
  const [listLoading, setListLoading] = useState(false)
  const [listErr, setListErr] = useState<string | null>(null)
  const [selectedLease, setSelectedLease] = useState<LeaseRow | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQ(inputValue.trim()), 300)
    return () => window.clearTimeout(id)
  }, [inputValue])

  useEffect(() => {
    if (!value) {
      setSelectedLease(null)
      return
    }
    let cancelled = false
    setDetailLoading(true)
    fetch(apiUrl(`/api/v1/leases/${encodeURIComponent(value)}`), { headers: authHeaders(token) })
      .then(async (r) => {
        if (r.status === 401) {
          onUnauthorized?.()
          throw new Error('Session expired')
        }
        if (r.status === 404) {
          setSelectedLease(null)
          return null
        }
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
        return r.json() as Promise<LeaseRow>
      })
      .then((row) => {
        if (!cancelled && row) setSelectedLease(row)
      })
      .catch(() => {
        if (!cancelled) setSelectedLease(null)
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
    if (selectedLease?.id === value) {
      setInputValue(leaseOptionLabel(selectedLease))
    }
  }, [value, selectedLease, open])

  const fetchList = useCallback(() => {
    if (!open) return
    setListLoading(true)
    setListErr(null)
    const params = new URLSearchParams({
      page: '1',
      pageSize: String(LIST_PAGE_SIZE),
    })
    if (debouncedQ) params.set('q', debouncedQ)
    if (tenantId) params.set('tenantId', tenantId)
    fetch(apiUrl(`/api/v1/leases?${params}`), { headers: authHeaders(token) })
      .then(async (r) => {
        if (r.status === 401) {
          onUnauthorized?.()
          throw new Error('Session expired')
        }
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
        return r.json() as Promise<
          LeaseRow[] | { items: LeaseRow[]; total: number }
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
  }, [open, debouncedQ, tenantId, token, onUnauthorized])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const mergedOptions = useMemo(() => {
    if (!selectedLease) return options
    if (options.some((o) => o.id === selectedLease.id)) return options
    return [selectedLease, ...options]
  }, [options, selectedLease])

  const showTotalHint = listTotal > LIST_PAGE_SIZE

  return (
    <Autocomplete<LeaseRow, false, boolean, false>
      sx={sx}
      size={size}
      disabled={disabled}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      loading={listLoading || detailLoading}
      filterOptions={(x) => x}
      options={mergedOptions}
      getOptionLabel={(o) => leaseOptionLabel(o)}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      value={value ? selectedLease : null}
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
      noOptionsText={listErr ?? (listLoading ? 'Loading…' : 'No leases')}
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
