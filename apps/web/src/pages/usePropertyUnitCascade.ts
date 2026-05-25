import { useCallback, useEffect, useState } from 'react'
import { apiUrl } from '../lib/api'
import { authHeaders } from '../lib/auth'
import { readApiErrorMessage } from '../lib/apiError'

/** Lease cascade follow-ups: `docs/PINNED.md` (e.g. multi-building unit picks). */

export type BuildingListRow = { id: string; name: string }
export type FloorListRow = { id: string; name: string }
export type UnitListRow = {
  id: string
  code: string
  floorId: string
  floor: { buildingId: string }
}

function mergeUnitAllocationStrings(
  selected: string[],
  prev: Record<string, string>,
): Record<string, string> {
  const next: Record<string, string> = {}
  for (const id of selected) {
    next[id] = prev[id] ?? '100'
  }
  return next
}

export function usePropertyUnitCascade(
  token: string | null,
  onUnauthorized: () => void,
) {
  const [portfolioId, setPortfolioId] = useState('')
  const [buildingId, setBuildingId] = useState('')
  const [floorId, setFloorId] = useState('')
  const [buildings, setBuildings] = useState<BuildingListRow[] | null>(null)
  const [floors, setFloors] = useState<FloorListRow[] | null>(null)
  const [units, setUnits] = useState<UnitListRow[] | null>(null)
  const [hierarchyErr, setHierarchyErr] = useState<string | null>(null)
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([])
  const [unitAllocationPct, setUnitAllocationPct] = useState<
    Record<string, string>
  >({})
  /** Metadata for units we have loaded (multi-floor / multi-building labels). */
  const [unitMetaById, setUnitMetaById] = useState<
    Record<string, { code: string; floorId: string; buildingId: string }>
  >({})

  useEffect(() => {
    if (!token || !portfolioId) {
      setBuildings(null)
      return
    }
    let cancelled = false
    setHierarchyErr(null)
    setBuildings(null)
    fetch(
      apiUrl(`/api/v1/buildings?portfolioId=${encodeURIComponent(portfolioId)}`),
      { headers: authHeaders(token) },
    )
      .then(async (r) => {
        if (r.status === 401) {
          onUnauthorized()
          throw new Error('Session expired')
        }
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
        return r.json() as Promise<BuildingListRow[]>
      })
      .then((data) => {
        if (!cancelled) setBuildings(data)
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setBuildings([])
          setHierarchyErr(e.message)
        }
      })
    return () => {
      cancelled = true
    }
  }, [token, portfolioId, onUnauthorized])

  useEffect(() => {
    if (!token || !buildingId) {
      setFloors(null)
      return
    }
    let cancelled = false
    setHierarchyErr(null)
    setFloors(null)
    fetch(apiUrl(`/api/v1/floors?buildingId=${encodeURIComponent(buildingId)}`), {
      headers: authHeaders(token),
    })
      .then(async (r) => {
        if (r.status === 401) {
          onUnauthorized()
          throw new Error('Session expired')
        }
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
        return r.json() as Promise<FloorListRow[]>
      })
      .then((data) => {
        if (!cancelled) setFloors(data)
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setFloors([])
          setHierarchyErr(e.message)
        }
      })
    return () => {
      cancelled = true
    }
  }, [token, buildingId, onUnauthorized])

  useEffect(() => {
    if (!token || !floorId) {
      setUnits(null)
      return
    }
    let cancelled = false
    setHierarchyErr(null)
    setUnits(null)
    fetch(apiUrl(`/api/v1/units?floorId=${encodeURIComponent(floorId)}`), {
      headers: authHeaders(token),
    })
      .then(async (r) => {
        if (r.status === 401) {
          onUnauthorized()
          throw new Error('Session expired')
        }
        if (!r.ok) throw new Error(await readApiErrorMessage(r))
        return r.json() as Promise<UnitListRow[]>
      })
      .then((data) => {
        if (!cancelled) {
          setUnits(data)
          setUnitMetaById((prev) => {
            const next = { ...prev }
            for (const u of data) {
              next[u.id] = {
                code: u.code,
                floorId: u.floorId,
                buildingId: u.floor.buildingId,
              }
            }
            return next
          })
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setUnits([])
          setHierarchyErr(e.message)
        }
      })
    return () => {
      cancelled = true
    }
  }, [token, floorId, onUnauthorized])

  const resetLocationBelowPortfolio = useCallback(() => {
    setBuildingId('')
    setFloorId('')
    setBuildings(null)
    setFloors(null)
    setUnits(null)
    setSelectedUnitIds([])
    setUnitAllocationPct({})
    setUnitMetaById({})
  }, [])

  /** Clears floor branch only; keeps selection and unit metadata (multi-floor + multi-building). */
  const resetLocationBelowBuilding = useCallback(() => {
    setFloorId('')
    setFloors(null)
    setUnits(null)
  }, [])

  /** Only clears the current floor’s unit list; selection and codes are kept (multi-floor picks). */
  const resetLocationBelowFloor = useCallback(() => {
    setUnits(null)
  }, [])

  const clearUnitSelection = useCallback(() => {
    setSelectedUnitIds([])
    setUnitAllocationPct({})
    setUnitMetaById({})
  }, [])

  const resetAll = useCallback(() => {
    setPortfolioId('')
    setBuildingId('')
    setFloorId('')
    setBuildings(null)
    setFloors(null)
    setUnits(null)
    setHierarchyErr(null)
    setSelectedUnitIds([])
    setUnitAllocationPct({})
    setUnitMetaById({})
  }, [])

  const onUnitsSelectChange = useCallback(
    (value: string | string[]) => {
      const next = typeof value === 'string' ? value.split(',') : [...value]
      setSelectedUnitIds(next)
      setUnitAllocationPct((prev) => mergeUnitAllocationStrings(next, prev))
    },
    [],
  )

  /** Hydrate labels for units not on the current floor (e.g. edit lease) via `GET /units/:id`. */
  useEffect(() => {
    if (!token || selectedUnitIds.length === 0) return
    const missing = selectedUnitIds.filter((id) => !unitMetaById[id])
    if (missing.length === 0) return
    let cancelled = false
    void Promise.all(
      missing.map((unitId) =>
        fetch(apiUrl(`/api/v1/units/${encodeURIComponent(unitId)}`), {
          headers: authHeaders(token),
        }).then(async (r) => {
          if (r.status === 401) {
            onUnauthorized()
            throw new Error('Session expired')
          }
          if (!r.ok) throw new Error(await readApiErrorMessage(r))
          return r.json() as Promise<UnitListRow>
        }),
      ),
    )
      .then((rows) => {
        if (cancelled) return
        setUnitMetaById((prev) => {
          const next = { ...prev }
          for (const u of rows) {
            next[u.id] = {
              code: u.code,
              floorId: u.floorId,
              buildingId: u.floor.buildingId,
            }
          }
          return next
        })
      })
      .catch((e: Error) => {
        if (!cancelled) setHierarchyErr(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [token, selectedUnitIds, unitMetaById, onUnauthorized])

  return {
    portfolioId,
    setPortfolioId,
    buildingId,
    setBuildingId,
    floorId,
    setFloorId,
    buildings,
    floors,
    units,
    unitMetaById,
    hierarchyErr,
    selectedUnitIds,
    setSelectedUnitIds,
    unitAllocationPct,
    setUnitAllocationPct,
    resetLocationBelowPortfolio,
    resetLocationBelowBuilding,
    resetLocationBelowFloor,
    clearUnitSelection,
    resetAll,
    onUnitsSelectChange,
  }
}

export type PropertyUnitCascade = ReturnType<typeof usePropertyUnitCascade>
