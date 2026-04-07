import AccountTreeOutlined from '@mui/icons-material/AccountTreeOutlined'
import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined'
import DragIndicatorOutlined from '@mui/icons-material/DragIndicatorOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
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
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import {
  sectionCardHeaderOutlinedSx,
  SectionCard,
} from '../components/DashboardUi'
import { MapPinPickerDialog } from '../components/MapPinPickerDialog'
import { useDashboard } from '../dashboard/context'
import type { BuildingRow, FloorRow, PortfolioRow, UnitRow } from '../dashboard/types'
import { readApiErrorMessage } from '../lib/apiError'
import { authHeaders } from '../lib/auth'

const UNIT_STATUSES = [
  'VACANT',
  'UNDER_RENOVATION',
  'MARKETED',
  'LEASED',
  'OCCUPIED',
] as const

function formatArea(raw: string | number | null | undefined): string {
  if (raw === undefined || raw === null || raw === '') return '—'
  const n = typeof raw === 'string' ? parseFloat(raw) : Number(raw)
  return Number.isFinite(n) ? String(n) : '—'
}

function portfolioLabel(p: PortfolioRow, orgName: string | null) {
  const base = p.region ? `${p.name} (${p.region})` : p.name
  if (!orgName) return base
  return `${base} · ${orgName}`
}

export function PropertyHierarchyPanel() {
  const {
    token,
    signOut,
    me,
    orgs,
    portfolios,
    portfoliosErr,
    canWriteProperty,
  } = useDashboard()

  const orgNameByPortfolioId = useMemo(() => {
    if (me?.role !== 'SUPER_ADMIN' || !orgs || !portfolios) return null
    const map = new Map<string, string>()
    for (const p of portfolios) {
      const n = orgs.find((o) => o.id === p.organizationId)?.name
      if (n) map.set(p.id, n)
    }
    return map
  }, [me?.role, orgs, portfolios])

  const handleUnauthorized = useCallback(() => {
    signOut()
  }, [signOut])

  const [portfolioId, setPortfolioId] = useState('')
  const [buildings, setBuildings] = useState<BuildingRow[] | null>(null)
  const [buildingsErr, setBuildingsErr] = useState<string | null>(null)
  const [selectedBuildingId, setSelectedBuildingId] = useState('')
  const [floors, setFloors] = useState<FloorRow[] | null>(null)
  const [floorsErr, setFloorsErr] = useState<string | null>(null)
  const [selectedFloorId, setSelectedFloorId] = useState('')
  const [units, setUnits] = useState<UnitRow[] | null>(null)
  const [unitsErr, setUnitsErr] = useState<string | null>(null)

  const [newBuildName, setNewBuildName] = useState('')
  const [newBuildAddress, setNewBuildAddress] = useState('')
  const [newBuildLatitude, setNewBuildLatitude] = useState('')
  const [newBuildLongitude, setNewBuildLongitude] = useState('')
  const [buildCreateSaving, setBuildCreateSaving] = useState(false)
  const [newFloorName, setNewFloorName] = useState('')
  const [newFloorLevel, setNewFloorLevel] = useState('')
  const [floorCreateSaving, setFloorCreateSaving] = useState(false)
  const [newUnitCode, setNewUnitCode] = useState('')
  const [newUnitType, setNewUnitType] = useState('retail')
  const [newUnitArea, setNewUnitArea] = useState('')
  const [newUnitStatus, setNewUnitStatus] = useState<string>('VACANT')
  const [unitCreateSaving, setUnitCreateSaving] = useState(false)

  const [editingBuilding, setEditingBuilding] = useState<BuildingRow | null>(null)
  const [editBuildName, setEditBuildName] = useState('')
  const [editBuildAddress, setEditBuildAddress] = useState('')
  const [editBuildLatitude, setEditBuildLatitude] = useState('')
  const [editBuildLongitude, setEditBuildLongitude] = useState('')
  const [buildPatchSaving, setBuildPatchSaving] = useState(false)
  const [buildPatchErr, setBuildPatchErr] = useState<string | null>(null)
  const [deletingBuilding, setDeletingBuilding] = useState<BuildingRow | null>(null)
  const [buildDeleteSaving, setBuildDeleteSaving] = useState(false)
  const [buildDeleteErr, setBuildDeleteErr] = useState<string | null>(null)

  const [editingFloor, setEditingFloor] = useState<FloorRow | null>(null)
  const [editFloorName, setEditFloorName] = useState('')
  const [editFloorLevel, setEditFloorLevel] = useState('')
  const [floorPatchSaving, setFloorPatchSaving] = useState(false)
  const [floorPatchErr, setFloorPatchErr] = useState<string | null>(null)
  const [deletingFloor, setDeletingFloor] = useState<FloorRow | null>(null)
  const [floorDeleteSaving, setFloorDeleteSaving] = useState(false)
  const [floorDeleteErr, setFloorDeleteErr] = useState<string | null>(null)

  const [editingUnit, setEditingUnit] = useState<UnitRow | null>(null)
  const [editUnitCode, setEditUnitCode] = useState('')
  const [editUnitType, setEditUnitType] = useState('')
  const [editUnitArea, setEditUnitArea] = useState('')
  const [editUnitStatus, setEditUnitStatus] = useState('')
  const [unitPatchSaving, setUnitPatchSaving] = useState(false)
  const [unitPatchErr, setUnitPatchErr] = useState<string | null>(null)
  const [deletingUnit, setDeletingUnit] = useState<UnitRow | null>(null)
  const [unitDeleteSaving, setUnitDeleteSaving] = useState(false)
  const [unitDeleteErr, setUnitDeleteErr] = useState<string | null>(null)

  const [buildingMapPicker, setBuildingMapPicker] = useState<'new' | 'edit' | null>(
    null,
  )

  const [buildingDragId, setBuildingDragId] = useState<string | null>(null)
  const [buildingDragOverId, setBuildingDragOverId] = useState<string | null>(null)
  const [floorDragId, setFloorDragId] = useState<string | null>(null)
  const [floorDragOverId, setFloorDragOverId] = useState<string | null>(null)
  const [unitDragId, setUnitDragId] = useState<string | null>(null)
  const [unitDragOverId, setUnitDragOverId] = useState<string | null>(null)

  const loadBuildings = useCallback(
    (t: string, pid: string) => {
      if (!pid) {
        setBuildings(null)
        setBuildingsErr(null)
        return
      }
      setBuildings(null)
      setBuildingsErr(null)
      fetch(`/api/v1/buildings?portfolioId=${encodeURIComponent(pid)}`, {
        headers: authHeaders(t),
      })
        .then(async (r) => {
          if (r.status === 401) {
            handleUnauthorized()
            throw new Error('Session expired')
          }
          if (!r.ok) throw new Error(await readApiErrorMessage(r))
          return r.json()
        })
        .then((data: BuildingRow[]) => setBuildings(data))
        .catch((e: Error) => setBuildingsErr(e.message))
    },
    [handleUnauthorized],
  )

  const loadFloors = useCallback(
    (t: string, bid: string) => {
      if (!bid) {
        setFloors(null)
        setFloorsErr(null)
        return
      }
      setFloors(null)
      setFloorsErr(null)
      fetch(`/api/v1/floors?buildingId=${encodeURIComponent(bid)}`, {
        headers: authHeaders(t),
      })
        .then(async (r) => {
          if (r.status === 401) {
            handleUnauthorized()
            throw new Error('Session expired')
          }
          if (!r.ok) throw new Error(await readApiErrorMessage(r))
          return r.json()
        })
        .then((data: FloorRow[]) => setFloors(data))
        .catch((e: Error) => setFloorsErr(e.message))
    },
    [handleUnauthorized],
  )

  const loadUnits = useCallback(
    (t: string, fid: string) => {
      if (!fid) {
        setUnits(null)
        setUnitsErr(null)
        return
      }
      setUnits(null)
      setUnitsErr(null)
      fetch(`/api/v1/units?floorId=${encodeURIComponent(fid)}`, {
        headers: authHeaders(t),
      })
        .then(async (r) => {
          if (r.status === 401) {
            handleUnauthorized()
            throw new Error('Session expired')
          }
          if (!r.ok) throw new Error(await readApiErrorMessage(r))
          return r.json()
        })
        .then((data: UnitRow[]) => setUnits(data))
        .catch((e: Error) => setUnitsErr(e.message))
    },
    [handleUnauthorized],
  )

  const persistBuildingOrder = useCallback(
    (ordered: BuildingRow[]) => {
      if (!token || !portfolioId) return
      setBuildings(ordered)
      fetch('/api/v1/buildings/reorder', {
        method: 'POST',
        headers: {
          ...authHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          portfolioId,
          buildingIds: ordered.map((x) => x.id),
        }),
      })
        .then(async (r) => {
          if (r.status === 401) {
            handleUnauthorized()
            throw new Error('Session expired')
          }
          if (!r.ok) throw new Error(await readApiErrorMessage(r))
        })
        .catch(() => loadBuildings(token, portfolioId))
    },
    [token, portfolioId, handleUnauthorized, loadBuildings],
  )

  const persistFloorOrder = useCallback(
    (ordered: FloorRow[]) => {
      if (!token || !selectedBuildingId) return
      setFloors(ordered)
      fetch('/api/v1/floors/reorder', {
        method: 'POST',
        headers: {
          ...authHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          buildingId: selectedBuildingId,
          floorIds: ordered.map((x) => x.id),
        }),
      })
        .then(async (r) => {
          if (r.status === 401) {
            handleUnauthorized()
            throw new Error('Session expired')
          }
          if (!r.ok) throw new Error(await readApiErrorMessage(r))
        })
        .catch(() => loadFloors(token, selectedBuildingId))
    },
    [token, selectedBuildingId, handleUnauthorized, loadFloors],
  )

  const persistUnitOrder = useCallback(
    (ordered: UnitRow[]) => {
      if (!token || !selectedFloorId) return
      setUnits(ordered)
      fetch('/api/v1/units/reorder', {
        method: 'POST',
        headers: {
          ...authHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          floorId: selectedFloorId,
          unitIds: ordered.map((x) => x.id),
        }),
      })
        .then(async (r) => {
          if (r.status === 401) {
            handleUnauthorized()
            throw new Error('Session expired')
          }
          if (!r.ok) throw new Error(await readApiErrorMessage(r))
        })
        .catch(() => loadUnits(token, selectedFloorId))
    },
    [token, selectedFloorId, handleUnauthorized, loadUnits],
  )

  useEffect(() => {
    if (!portfolioId || !portfolios) return
    if (!portfolios.some((p) => p.id === portfolioId)) {
      setPortfolioId('')
      setSelectedBuildingId('')
      setSelectedFloorId('')
    }
  }, [portfolios, portfolioId])

  useEffect(() => {
    if (!token || !portfolioId) {
      setBuildings(null)
      setBuildingsErr(null)
      return
    }
    loadBuildings(token, portfolioId)
  }, [token, portfolioId, loadBuildings])

  useEffect(() => {
    if (!token || !selectedBuildingId) {
      setFloors(null)
      setFloorsErr(null)
      return
    }
    loadFloors(token, selectedBuildingId)
  }, [token, selectedBuildingId, loadFloors])

  useEffect(() => {
    if (!token || !selectedFloorId) {
      setUnits(null)
      setUnitsErr(null)
      return
    }
    loadUnits(token, selectedFloorId)
  }, [token, selectedFloorId, loadUnits])

  const selectedBuilding = useMemo(
    () => buildings?.find((b) => b.id === selectedBuildingId),
    [buildings, selectedBuildingId],
  )
  const selectedFloor = useMemo(
    () => floors?.find((f) => f.id === selectedFloorId),
    [floors, selectedFloorId],
  )

  const onPortfolioChange = (pid: string) => {
    setPortfolioId(pid)
    setSelectedBuildingId('')
    setSelectedFloorId('')
  }

  const submitCreateBuilding = (e: FormEvent) => {
    e.preventDefault()
    if (!token || !portfolioId) return
    const name = newBuildName.trim()
    if (!name) return
    setBuildCreateSaving(true)
    const body: Record<string, string> = { portfolioId, name }
    const addr = newBuildAddress.trim()
    const lat = newBuildLatitude.trim()
    const lon = newBuildLongitude.trim()
    if (addr) body.address = addr
    if (lat !== '') {
      const n = parseFloat(lat.replace(',', '.'))
      if (Number.isFinite(n)) body.latitude = String(n)
    }
    if (lon !== '') {
      const n = parseFloat(lon.replace(',', '.'))
      if (Number.isFinite(n)) body.longitude = String(n)
    }
    fetch('/api/v1/buildings', {
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
        setNewBuildName('')
        setNewBuildAddress('')
        setNewBuildLatitude('')
        setNewBuildLongitude('')
        loadBuildings(token, portfolioId)
      })
      .catch((err: Error) => setBuildingsErr(err.message))
      .finally(() => setBuildCreateSaving(false))
  }

  const submitCreateFloor = (e: FormEvent) => {
    e.preventDefault()
    if (!token || !selectedBuildingId) return
    const name = newFloorName.trim()
    if (!name) return
    setFloorCreateSaving(true)
    const body: { buildingId: string; name: string; level?: number } = {
      buildingId: selectedBuildingId,
      name,
    }
    const lv = newFloorLevel.trim()
    if (lv !== '') {
      const n = parseInt(lv, 10)
      if (Number.isFinite(n)) body.level = n
    }
    fetch('/api/v1/floors', {
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
        setNewFloorName('')
        setNewFloorLevel('')
        loadFloors(token, selectedBuildingId)
      })
      .catch((err: Error) => setFloorsErr(err.message))
      .finally(() => setFloorCreateSaving(false))
  }

  const submitCreateUnit = (e: FormEvent) => {
    e.preventDefault()
    if (!token || !selectedFloorId) return
    const code = newUnitCode.trim()
    const type = newUnitType.trim()
    if (!code || !type) return
    setUnitCreateSaving(true)
    const body: {
      floorId: string
      code: string
      type: string
      status: string
      rentableArea?: number
    } = {
      floorId: selectedFloorId,
      code,
      type,
      status: newUnitStatus,
    }
    const ar = newUnitArea.trim()
    if (ar !== '') {
      const n = parseFloat(ar.replace(',', '.'))
      if (Number.isFinite(n)) body.rentableArea = n
    }
    fetch('/api/v1/units', {
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
        setNewUnitCode('')
        setNewUnitType('retail')
        setNewUnitArea('')
        setNewUnitStatus('VACANT')
        loadUnits(token, selectedFloorId)
      })
      .catch((err: Error) => setUnitsErr(err.message))
      .finally(() => setUnitCreateSaving(false))
  }

  const openEditBuilding = (b: BuildingRow) => {
    setEditingBuilding(b)
    setEditBuildName(b.name)
    setEditBuildAddress(b.address ?? '')
    setEditBuildLatitude(
      b.latitude !== undefined && b.latitude !== null && b.latitude !== ''
        ? String(b.latitude)
        : '',
    )
    setEditBuildLongitude(
      b.longitude !== undefined && b.longitude !== null && b.longitude !== ''
        ? String(b.longitude)
        : '',
    )
    setBuildPatchErr(null)
  }

  const submitPatchBuilding = () => {
    if (!token || !editingBuilding) return
    setBuildPatchSaving(true)
    setBuildPatchErr(null)
    const lat = editBuildLatitude.trim()
    const lon = editBuildLongitude.trim()
    const latPayload =
      lat === ''
        ? { latitude: null as number | null }
        : Number.isFinite(parseFloat(lat.replace(',', '.')))
          ? { latitude: parseFloat(lat.replace(',', '.')) }
          : {}
    const lonPayload =
      lon === ''
        ? { longitude: null as number | null }
        : Number.isFinite(parseFloat(lon.replace(',', '.')))
          ? { longitude: parseFloat(lon.replace(',', '.')) }
          : {}
    fetch(`/api/v1/buildings/${editingBuilding.id}`, {
      method: 'PATCH',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: editBuildName.trim(),
        address: editBuildAddress.trim() || null,
        ...latPayload,
        ...lonPayload,
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
        setEditingBuilding(null)
        loadBuildings(token, portfolioId)
      })
      .catch((e: Error) => setBuildPatchErr(e.message))
      .finally(() => setBuildPatchSaving(false))
  }

  const submitDeleteBuilding = () => {
    if (!token || !deletingBuilding) return
    setBuildDeleteSaving(true)
    setBuildDeleteErr(null)
    fetch(`/api/v1/buildings/${deletingBuilding.id}`, {
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
        setDeletingBuilding(null)
        if (selectedBuildingId === deletingBuilding.id) {
          setSelectedBuildingId('')
          setSelectedFloorId('')
        }
        loadBuildings(token, portfolioId)
      })
      .catch((e: Error) => setBuildDeleteErr(e.message))
      .finally(() => setBuildDeleteSaving(false))
  }

  const openEditFloor = (f: FloorRow) => {
    setEditingFloor(f)
    setEditFloorName(f.name)
    setEditFloorLevel(f.level != null ? String(f.level) : '')
    setFloorPatchErr(null)
  }

  const submitPatchFloor = () => {
    if (!token || !editingFloor) return
    setFloorPatchSaving(true)
    setFloorPatchErr(null)
    const lv = editFloorLevel.trim()
    const levelPayload: { level: number | null } | Record<string, never> =
      lv === ''
        ? { level: null }
        : Number.isFinite(parseInt(lv, 10))
          ? { level: parseInt(lv, 10) }
          : {}
    fetch(`/api/v1/floors/${editingFloor.id}`, {
      method: 'PATCH',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: editFloorName.trim(),
        ...levelPayload,
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
        setEditingFloor(null)
        if (selectedBuildingId) loadFloors(token, selectedBuildingId)
      })
      .catch((e: Error) => setFloorPatchErr(e.message))
      .finally(() => setFloorPatchSaving(false))
  }

  const submitDeleteFloor = () => {
    if (!token || !deletingFloor) return
    setFloorDeleteSaving(true)
    setFloorDeleteErr(null)
    fetch(`/api/v1/floors/${deletingFloor.id}`, {
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
        setDeletingFloor(null)
        if (selectedFloorId === deletingFloor.id) {
          setSelectedFloorId('')
        }
        if (selectedBuildingId) loadFloors(token, selectedBuildingId)
      })
      .catch((e: Error) => setFloorDeleteErr(e.message))
      .finally(() => setFloorDeleteSaving(false))
  }

  const openEditUnit = (u: UnitRow) => {
    setEditingUnit(u)
    setEditUnitCode(u.code)
    setEditUnitType(u.type)
    setEditUnitArea(
      u.rentableArea != null && u.rentableArea !== ''
        ? String(u.rentableArea)
        : '',
    )
    setEditUnitStatus(u.status)
    setUnitPatchErr(null)
  }

  const submitPatchUnit = () => {
    if (!token || !editingUnit) return
    setUnitPatchSaving(true)
    setUnitPatchErr(null)
    const ar = editUnitArea.trim()
    const areaN = ar === '' ? null : parseFloat(ar.replace(',', '.'))
    const rentablePayload =
      ar === ''
        ? { rentableArea: null as number | null }
        : Number.isFinite(areaN)
          ? { rentableArea: areaN as number }
          : {}
    fetch(`/api/v1/units/${editingUnit.id}`, {
      method: 'PATCH',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: editUnitCode.trim(),
        type: editUnitType.trim(),
        status: editUnitStatus,
        ...rentablePayload,
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
        setEditingUnit(null)
        if (selectedFloorId) loadUnits(token, selectedFloorId)
      })
      .catch((e: Error) => setUnitPatchErr(e.message))
      .finally(() => setUnitPatchSaving(false))
  }

  const submitDeleteUnit = () => {
    if (!token || !deletingUnit) return
    setUnitDeleteSaving(true)
    setUnitDeleteErr(null)
    fetch(`/api/v1/units/${deletingUnit.id}`, {
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
        setDeletingUnit(null)
        if (selectedFloorId) loadUnits(token, selectedFloorId)
      })
      .catch((e: Error) => setUnitDeleteErr(e.message))
      .finally(() => setUnitDeleteSaving(false))
  }

  if (!token) return null

  return (
    <>
    <SectionCard
      title="Buildings, floors & units"
      subtitle="Choose a portfolio, select a building row for floors, then a floor row for units. Writes use the same property roles as above."
      icon={<AccountTreeOutlined />}
      action={
        <FormControl
          size="small"
          sx={{
            minWidth: { xs: '100%', sm: 280 },
            ...sectionCardHeaderOutlinedSx,
          }}
        >
          <InputLabel id="hierarchy-portfolio-label">Portfolio</InputLabel>
          <Select
            labelId="hierarchy-portfolio-label"
            label="Portfolio"
            value={portfolioId}
            onChange={(e) => onPortfolioChange(e.target.value)}
            disabled={!portfolios || portfolios.length === 0}
          >
            <MenuItem value="">
              <em>Select portfolio</em>
            </MenuItem>
            {(portfolios ?? []).map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {portfolioLabel(
                  p,
                  orgNameByPortfolioId?.get(p.id) ?? null,
                )}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      }
    >
      {portfoliosErr && (
        <Alert severity="warning" variant="outlined" sx={{ mb: 2 }}>
          {portfoliosErr}
        </Alert>
      )}
      {!portfolioId && (
        <Typography color="text.secondary">
          Select a portfolio to load buildings.
        </Typography>
      )}

      {portfolioId && (
        <Stack spacing={3}>
          {buildingsErr && (
            <Alert severity="error" variant="outlined">
              {buildingsErr}
            </Alert>
          )}
          {canWriteProperty && (
            <Box
              component="form"
              onSubmit={submitCreateBuilding}
              sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'flex-start' }}
            >
              <TextField
                size="small"
                label="New building name"
                value={newBuildName}
                onChange={(e) => setNewBuildName(e.target.value)}
                sx={{ minWidth: 200 }}
              />
              <TextField
                size="small"
                label="Address (optional)"
                value={newBuildAddress}
                onChange={(e) => setNewBuildAddress(e.target.value)}
                sx={{ minWidth: 220 }}
              />
              <Stack direction="row" flexWrap="wrap" alignItems="flex-end" gap={1}>
                <TextField
                  size="small"
                  label="Latitude (optional)"
                  value={newBuildLatitude}
                  onChange={(e) => setNewBuildLatitude(e.target.value)}
                  sx={{ width: 160 }}
                />
                <TextField
                  size="small"
                  label="Longitude (optional)"
                  value={newBuildLongitude}
                  onChange={(e) => setNewBuildLongitude(e.target.value)}
                  sx={{ width: 170 }}
                />
                <Button
                  type="button"
                  variant="outlined"
                  size="small"
                  onClick={() => setBuildingMapPicker('new')}
                  disabled={buildCreateSaving}
                >
                  Pick on map
                </Button>
              </Stack>
              <Button
                type="submit"
                variant="contained"
                disabled={buildCreateSaving || !newBuildName.trim()}
              >
                {buildCreateSaving ? 'Adding…' : 'Add building'}
              </Button>
            </Box>
          )}
          {buildings === null && !buildingsErr && (
            <Stack spacing={1}>
              <Skeleton height={36} />
              <Skeleton height={36} />
            </Stack>
          )}
          {buildings && buildings.length === 0 && (
            <Typography color="text.secondary">No buildings in this portfolio yet.</Typography>
          )}
          {buildings && buildings.length > 0 && (
            <TableContainer
              sx={{
                borderRadius: 2,
                border: 1,
                borderColor: 'divider',
                overflow: 'hidden',
              }}
            >
              <Table size="small" sx={{ '& tbody tr:hover': { bgcolor: 'action.hover' } }}>
                <TableHead>
                  <TableRow>
                    {canWriteProperty && buildings.length > 1 ? (
                      <TableCell width={44} padding="checkbox" aria-label="Reorder" />
                    ) : null}
                    <TableCell>Name</TableCell>
                    <TableCell>Address</TableCell>
                    <TableCell align="right">Floors</TableCell>
                    {canWriteProperty && (
                      <TableCell align="right" width={100}>
                        Actions
                      </TableCell>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {buildings.map((b) => {
                    const buildingReorder = Boolean(
                      canWriteProperty && buildings.length > 1,
                    )
                    return (
                      <TableRow
                        key={b.id}
                        hover
                        selected={selectedBuildingId === b.id}
                        onClick={() => {
                          setSelectedBuildingId(b.id)
                          setSelectedFloorId('')
                        }}
                        onDragOver={
                          buildingReorder
                            ? (e) => {
                                e.preventDefault()
                                e.dataTransfer.dropEffect = 'move'
                                if (b.id !== buildingDragId) {
                                  setBuildingDragOverId(b.id)
                                }
                              }
                            : undefined
                        }
                        onDragLeave={
                          buildingReorder
                            ? () => {
                                setBuildingDragOverId((cur) =>
                                  cur === b.id ? null : cur,
                                )
                              }
                            : undefined
                        }
                        onDrop={
                          buildingReorder
                            ? (e) => {
                                e.preventDefault()
                                const fromId = e.dataTransfer.getData('text/plain')
                                setBuildingDragOverId(null)
                                setBuildingDragId(null)
                                if (!fromId || !buildings) return
                                const from = buildings.findIndex((x) => x.id === fromId)
                                const to = buildings.findIndex((x) => x.id === b.id)
                                if (from < 0 || to < 0 || from === to) return
                                const next = [...buildings]
                                const [rem] = next.splice(from, 1)
                                next.splice(to, 0, rem)
                                persistBuildingOrder(next)
                              }
                            : undefined
                        }
                        sx={{
                          cursor: 'pointer',
                          ...(buildingDragOverId === b.id &&
                          buildingDragId &&
                          buildingDragId !== b.id
                            ? {
                                outline: '2px dashed',
                                outlineOffset: -2,
                                outlineColor: 'primary.main',
                              }
                            : {}),
                        }}
                      >
                        {buildingReorder ? (
                          <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                            <IconButton
                              size="small"
                              draggable
                              onDragStart={(e) => {
                                e.stopPropagation()
                                e.dataTransfer.setData('text/plain', b.id)
                                e.dataTransfer.effectAllowed = 'move'
                                setBuildingDragId(b.id)
                              }}
                              onDragEnd={() => {
                                setBuildingDragId(null)
                                setBuildingDragOverId(null)
                              }}
                              sx={{ cursor: 'grab' }}
                              aria-label="Drag to reorder building"
                            >
                              <DragIndicatorOutlined fontSize="small" />
                            </IconButton>
                          </TableCell>
                        ) : null}
                        <TableCell>
                          <Typography fontWeight={600}>{b.name}</Typography>
                        </TableCell>
                        <TableCell>{b.address ?? '—'}</TableCell>
                        <TableCell align="right">{b._count.floors}</TableCell>
                        {canWriteProperty && (
                          <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                            <IconButton
                              size="small"
                              aria-label="Edit building"
                              onClick={() => openEditBuilding(b)}
                            >
                              <EditOutlined fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              aria-label="Delete building"
                              onClick={() => {
                                setBuildDeleteErr(null)
                                setDeletingBuilding(b)
                              }}
                            >
                              <DeleteOutlineOutlined fontSize="small" />
                            </IconButton>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {selectedBuildingId && selectedBuilding && (
            <Box>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
                Floors — {selectedBuilding.name}
              </Typography>
              {floorsErr && (
                <Alert severity="error" variant="outlined" sx={{ mb: 2 }}>
                  {floorsErr}
                </Alert>
              )}
              {canWriteProperty && (
                <Box
                  component="form"
                  onSubmit={submitCreateFloor}
                  sx={{
                    display: 'flex',
                    gap: 1,
                    flexWrap: 'wrap',
                    alignItems: 'flex-start',
                    mb: 2,
                  }}
                >
                  <TextField
                    size="small"
                    label="New floor name"
                    value={newFloorName}
                    onChange={(e) => setNewFloorName(e.target.value)}
                    sx={{ minWidth: 160 }}
                  />
                  <TextField
                    size="small"
                    label="Level (optional)"
                    value={newFloorLevel}
                    onChange={(e) => setNewFloorLevel(e.target.value)}
                    sx={{ width: 120 }}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={floorCreateSaving || !newFloorName.trim()}
                  >
                    {floorCreateSaving ? 'Adding…' : 'Add floor'}
                  </Button>
                </Box>
              )}
              {floors === null && !floorsErr && (
                <Stack spacing={1}>
                  <Skeleton height={32} />
                  <Skeleton height={32} />
                </Stack>
              )}
              {floors && floors.length === 0 && (
                <Typography color="text.secondary">No floors yet — add one above.</Typography>
              )}
              {floors && floors.length > 0 && (
                <TableContainer
                  sx={{
                    borderRadius: 2,
                    border: 1,
                    borderColor: 'divider',
                    overflow: 'hidden',
                  }}
                >
                  <Table size="small" sx={{ '& tbody tr:hover': { bgcolor: 'action.hover' } }}>
                    <TableHead>
                      <TableRow>
                        {canWriteProperty && floors.length > 1 ? (
                          <TableCell width={44} padding="checkbox" aria-label="Reorder" />
                        ) : null}
                        <TableCell>Name</TableCell>
                        <TableCell>Level</TableCell>
                        <TableCell align="right">Units</TableCell>
                        {canWriteProperty && (
                          <TableCell align="right" width={100}>
                            Actions
                          </TableCell>
                        )}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {floors.map((f) => {
                        const floorReorder = Boolean(
                          canWriteProperty && floors.length > 1,
                        )
                        return (
                          <TableRow
                            key={f.id}
                            hover
                            selected={selectedFloorId === f.id}
                            onClick={() => setSelectedFloorId(f.id)}
                            onDragOver={
                              floorReorder
                                ? (e) => {
                                    e.preventDefault()
                                    e.dataTransfer.dropEffect = 'move'
                                    if (f.id !== floorDragId) setFloorDragOverId(f.id)
                                  }
                                : undefined
                            }
                            onDragLeave={
                              floorReorder
                                ? () => {
                                    setFloorDragOverId((cur) =>
                                      cur === f.id ? null : cur,
                                    )
                                  }
                                : undefined
                            }
                            onDrop={
                              floorReorder
                                ? (e) => {
                                    e.preventDefault()
                                    const fromId = e.dataTransfer.getData('text/plain')
                                    setFloorDragOverId(null)
                                    setFloorDragId(null)
                                    if (!fromId || !floors) return
                                    const from = floors.findIndex((x) => x.id === fromId)
                                    const to = floors.findIndex((x) => x.id === f.id)
                                    if (from < 0 || to < 0 || from === to) return
                                    const next = [...floors]
                                    const [rem] = next.splice(from, 1)
                                    next.splice(to, 0, rem)
                                    persistFloorOrder(next)
                                  }
                                : undefined
                            }
                            sx={{
                              cursor: 'pointer',
                              ...(floorDragOverId === f.id &&
                              floorDragId &&
                              floorDragId !== f.id
                                ? {
                                    outline: '2px dashed',
                                    outlineOffset: -2,
                                    outlineColor: 'primary.main',
                                  }
                                : {}),
                            }}
                          >
                            {floorReorder ? (
                              <TableCell
                                padding="checkbox"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <IconButton
                                  size="small"
                                  draggable
                                  onDragStart={(e) => {
                                    e.stopPropagation()
                                    e.dataTransfer.setData('text/plain', f.id)
                                    e.dataTransfer.effectAllowed = 'move'
                                    setFloorDragId(f.id)
                                  }}
                                  onDragEnd={() => {
                                    setFloorDragId(null)
                                    setFloorDragOverId(null)
                                  }}
                                  sx={{ cursor: 'grab' }}
                                  aria-label="Drag to reorder floor"
                                >
                                  <DragIndicatorOutlined fontSize="small" />
                                </IconButton>
                              </TableCell>
                            ) : null}
                            <TableCell>
                              <Typography fontWeight={600}>{f.name}</Typography>
                            </TableCell>
                            <TableCell>{f.level ?? '—'}</TableCell>
                            <TableCell align="right">{f._count.units}</TableCell>
                            {canWriteProperty && (
                              <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                                <IconButton
                                  size="small"
                                  aria-label="Edit floor"
                                  onClick={() => openEditFloor(f)}
                                >
                                  <EditOutlined fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  aria-label="Delete floor"
                                  onClick={() => {
                                    setFloorDeleteErr(null)
                                    setDeletingFloor(f)
                                  }}
                                >
                                  <DeleteOutlineOutlined fontSize="small" />
                                </IconButton>
                              </TableCell>
                            )}
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}

          {selectedFloorId && selectedFloor && (
            <Box>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
                Units — {selectedFloor.name}
              </Typography>
              {unitsErr && (
                <Alert severity="error" variant="outlined" sx={{ mb: 2 }}>
                  {unitsErr}
                </Alert>
              )}
              {canWriteProperty && (
                <Box
                  component="form"
                  onSubmit={submitCreateUnit}
                  sx={{
                    display: 'flex',
                    gap: 1,
                    flexWrap: 'wrap',
                    alignItems: 'flex-start',
                    mb: 2,
                  }}
                >
                  <TextField
                    size="small"
                    label="Code"
                    value={newUnitCode}
                    onChange={(e) => setNewUnitCode(e.target.value)}
                    sx={{ width: 120 }}
                  />
                  <TextField
                    size="small"
                    label="Type"
                    value={newUnitType}
                    onChange={(e) => setNewUnitType(e.target.value)}
                    sx={{ minWidth: 120 }}
                  />
                  <TextField
                    size="small"
                    label="Area (optional)"
                    value={newUnitArea}
                    onChange={(e) => setNewUnitArea(e.target.value)}
                    sx={{ width: 120 }}
                  />
                  <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel id="new-unit-status-label">Status</InputLabel>
                    <Select
                      labelId="new-unit-status-label"
                      label="Status"
                      value={newUnitStatus}
                      onChange={(e) => setNewUnitStatus(e.target.value)}
                    >
                      {UNIT_STATUSES.map((s) => (
                        <MenuItem key={s} value={s}>
                          {s.replace(/_/g, ' ')}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={
                      unitCreateSaving || !newUnitCode.trim() || !newUnitType.trim()
                    }
                  >
                    {unitCreateSaving ? 'Adding…' : 'Add unit'}
                  </Button>
                </Box>
              )}
              {units === null && !unitsErr && (
                <Stack spacing={1}>
                  <Skeleton height={32} />
                  <Skeleton height={32} />
                </Stack>
              )}
              {units && units.length === 0 && (
                <Typography color="text.secondary">No units on this floor yet.</Typography>
              )}
              {units && units.length > 0 && (
                <TableContainer
                  sx={{
                    borderRadius: 2,
                    border: 1,
                    borderColor: 'divider',
                    overflow: 'hidden',
                  }}
                >
                  <Table size="small" sx={{ '& tbody tr:hover': { bgcolor: 'action.hover' } }}>
                    <TableHead>
                      <TableRow>
                        {canWriteProperty && units.length > 1 ? (
                          <TableCell width={44} padding="checkbox" aria-label="Reorder" />
                        ) : null}
                        <TableCell>Code</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell align="right">Area</TableCell>
                        <TableCell>Status</TableCell>
                        {canWriteProperty && (
                          <TableCell align="right" width={100}>
                            Actions
                          </TableCell>
                        )}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {units.map((u) => {
                        const unitReorder = Boolean(canWriteProperty && units.length > 1)
                        return (
                          <TableRow
                            key={u.id}
                            onDragOver={
                              unitReorder
                                ? (e) => {
                                    e.preventDefault()
                                    e.dataTransfer.dropEffect = 'move'
                                    if (u.id !== unitDragId) setUnitDragOverId(u.id)
                                  }
                                : undefined
                            }
                            onDragLeave={
                              unitReorder
                                ? () => {
                                    setUnitDragOverId((cur) => (cur === u.id ? null : cur))
                                  }
                                : undefined
                            }
                            onDrop={
                              unitReorder
                                ? (e) => {
                                    e.preventDefault()
                                    const fromId = e.dataTransfer.getData('text/plain')
                                    setUnitDragOverId(null)
                                    setUnitDragId(null)
                                    if (!fromId || !units) return
                                    const from = units.findIndex((x) => x.id === fromId)
                                    const to = units.findIndex((x) => x.id === u.id)
                                    if (from < 0 || to < 0 || from === to) return
                                    const next = [...units]
                                    const [rem] = next.splice(from, 1)
                                    next.splice(to, 0, rem)
                                    persistUnitOrder(next)
                                  }
                                : undefined
                            }
                            sx={{
                              ...(unitDragOverId === u.id && unitDragId && unitDragId !== u.id
                                ? {
                                    outline: '2px dashed',
                                    outlineOffset: -2,
                                    outlineColor: 'primary.main',
                                  }
                                : {}),
                            }}
                          >
                            {unitReorder ? (
                              <TableCell padding="checkbox">
                                <IconButton
                                  size="small"
                                  draggable
                                  onDragStart={(e) => {
                                    e.dataTransfer.setData('text/plain', u.id)
                                    e.dataTransfer.effectAllowed = 'move'
                                    setUnitDragId(u.id)
                                  }}
                                  onDragEnd={() => {
                                    setUnitDragId(null)
                                    setUnitDragOverId(null)
                                  }}
                                  sx={{ cursor: 'grab' }}
                                  aria-label="Drag to reorder unit"
                                >
                                  <DragIndicatorOutlined fontSize="small" />
                                </IconButton>
                              </TableCell>
                            ) : null}
                            <TableCell
                              sx={{
                                fontFamily: 'JetBrains Mono, monospace',
                                fontSize: '0.85rem',
                              }}
                            >
                              {u.code}
                            </TableCell>
                            <TableCell>{u.type}</TableCell>
                            <TableCell align="right">{formatArea(u.rentableArea)}</TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                label={u.status.replace(/_/g, ' ')}
                                variant="outlined"
                                sx={{ textTransform: 'capitalize' }}
                              />
                            </TableCell>
                            {canWriteProperty && (
                              <TableCell align="right">
                                <IconButton
                                  size="small"
                                  aria-label="Edit unit"
                                  onClick={() => openEditUnit(u)}
                                >
                                  <EditOutlined fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  aria-label="Delete unit"
                                  onClick={() => {
                                    setUnitDeleteErr(null)
                                    setDeletingUnit(u)
                                  }}
                                >
                                  <DeleteOutlineOutlined fontSize="small" />
                                </IconButton>
                              </TableCell>
                            )}
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}
        </Stack>
      )}

      <Dialog
        open={editingBuilding !== null}
        onClose={() => !buildPatchSaving && setEditingBuilding(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Edit building</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {buildPatchErr && (
              <Alert severity="error" variant="outlined">
                {buildPatchErr}
              </Alert>
            )}
            <TextField
              label="Name"
              size="small"
              fullWidth
              value={editBuildName}
              onChange={(e) => setEditBuildName(e.target.value)}
            />
            <TextField
              label="Address"
              size="small"
              fullWidth
              value={editBuildAddress}
              onChange={(e) => setEditBuildAddress(e.target.value)}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-end">
              <TextField
                label="Latitude"
                size="small"
                fullWidth
                value={editBuildLatitude}
                onChange={(e) => setEditBuildLatitude(e.target.value)}
              />
              <TextField
                label="Longitude"
                size="small"
                fullWidth
                value={editBuildLongitude}
                onChange={(e) => setEditBuildLongitude(e.target.value)}
              />
              <Button
                type="button"
                variant="outlined"
                size="small"
                onClick={() => setBuildingMapPicker('edit')}
                disabled={buildPatchSaving}
                sx={{ flexShrink: 0 }}
              >
                Pick on map
              </Button>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingBuilding(null)} disabled={buildPatchSaving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={submitPatchBuilding} disabled={buildPatchSaving}>
            {buildPatchSaving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deletingBuilding !== null}
        onClose={() => !buildDeleteSaving && setDeletingBuilding(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Delete building?</DialogTitle>
        <DialogContent>
          {buildDeleteErr && (
            <Alert severity="error" variant="outlined" sx={{ mb: 2 }}>
              {buildDeleteErr}
            </Alert>
          )}
          {deletingBuilding && (
            <Typography variant="body2">
              This removes <strong>{deletingBuilding.name}</strong> and nested floors/units where the
              database allows it. If a unit is on a lease, the API will reject the delete.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeletingBuilding(null)} disabled={buildDeleteSaving}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={submitDeleteBuilding}
            disabled={buildDeleteSaving}
          >
            {buildDeleteSaving ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={editingFloor !== null}
        onClose={() => !floorPatchSaving && setEditingFloor(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Edit floor</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {floorPatchErr && (
              <Alert severity="error" variant="outlined">
                {floorPatchErr}
              </Alert>
            )}
            <TextField
              label="Name"
              size="small"
              fullWidth
              value={editFloorName}
              onChange={(e) => setEditFloorName(e.target.value)}
            />
            <TextField
              label="Level (blank to clear)"
              size="small"
              fullWidth
              value={editFloorLevel}
              onChange={(e) => setEditFloorLevel(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingFloor(null)} disabled={floorPatchSaving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={submitPatchFloor} disabled={floorPatchSaving}>
            {floorPatchSaving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deletingFloor !== null}
        onClose={() => !floorDeleteSaving && setDeletingFloor(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Delete floor?</DialogTitle>
        <DialogContent>
          {floorDeleteErr && (
            <Alert severity="error" variant="outlined" sx={{ mb: 2 }}>
              {floorDeleteErr}
            </Alert>
          )}
          {deletingFloor && (
            <Typography variant="body2">
              Removes <strong>{deletingFloor.name}</strong> and its units when allowed. Linked leases
              block unit removal.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeletingFloor(null)} disabled={floorDeleteSaving}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={submitDeleteFloor}
            disabled={floorDeleteSaving}
          >
            {floorDeleteSaving ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={editingUnit !== null}
        onClose={() => !unitPatchSaving && setEditingUnit(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Edit unit</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {unitPatchErr && (
              <Alert severity="error" variant="outlined">
                {unitPatchErr}
              </Alert>
            )}
            <TextField
              label="Code"
              size="small"
              fullWidth
              value={editUnitCode}
              onChange={(e) => setEditUnitCode(e.target.value)}
            />
            <TextField
              label="Type"
              size="small"
              fullWidth
              value={editUnitType}
              onChange={(e) => setEditUnitType(e.target.value)}
            />
            <TextField
              label="Rentable area (blank to clear)"
              size="small"
              fullWidth
              value={editUnitArea}
              onChange={(e) => setEditUnitArea(e.target.value)}
            />
            <FormControl fullWidth size="small">
              <InputLabel id="edit-unit-status-label">Status</InputLabel>
              <Select
                labelId="edit-unit-status-label"
                label="Status"
                value={editUnitStatus}
                onChange={(e) => setEditUnitStatus(e.target.value)}
              >
                {UNIT_STATUSES.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingUnit(null)} disabled={unitPatchSaving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={submitPatchUnit} disabled={unitPatchSaving}>
            {unitPatchSaving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deletingUnit !== null}
        onClose={() => !unitDeleteSaving && setDeletingUnit(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Delete unit?</DialogTitle>
        <DialogContent>
          {unitDeleteErr && (
            <Alert severity="error" variant="outlined" sx={{ mb: 2 }}>
              {unitDeleteErr}
            </Alert>
          )}
          {deletingUnit && (
            <Typography variant="body2">
              Permanently remove <strong>{deletingUnit.code}</strong>. Not allowed if the unit is on a
              lease line.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeletingUnit(null)} disabled={unitDeleteSaving}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={submitDeleteUnit}
            disabled={unitDeleteSaving}
          >
            {unitDeleteSaving ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </SectionCard>

    <MapPinPickerDialog
      open={buildingMapPicker !== null}
      onClose={() => setBuildingMapPicker(null)}
      initialLatitude={
        buildingMapPicker === 'edit'
          ? editBuildLatitude
          : buildingMapPicker === 'new'
            ? newBuildLatitude
            : ''
      }
      initialLongitude={
        buildingMapPicker === 'edit'
          ? editBuildLongitude
          : buildingMapPicker === 'new'
            ? newBuildLongitude
            : ''
      }
      onPick={(lat, lng) => {
        if (buildingMapPicker === 'new') {
          setNewBuildLatitude(lat)
          setNewBuildLongitude(lng)
        } else if (buildingMapPicker === 'edit') {
          setEditBuildLatitude(lat)
          setEditBuildLongitude(lng)
        }
      }}
    />
    </>
  )
}
