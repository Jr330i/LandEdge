import {
  Box,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import type { PortfolioRow } from '../dashboard/types'
import type { PropertyUnitCascade } from './usePropertyUnitCascade'

function orphanUnitSuffix(
  unitId: string,
  currentFloorId: string,
  currentBuildingId: string,
  meta: PropertyUnitCascade['unitMetaById'],
): string {
  const m = meta[unitId]
  if (!m) return '· not on this floor'
  if (currentBuildingId && m.buildingId !== currentBuildingId) {
    return '· other building'
  }
  if (currentFloorId && m.floorId !== currentFloorId) {
    return '· other floor'
  }
  return '· not on this floor'
}

export function LeaseUnitCascadeFields({
  idPrefix,
  portfolios,
  c,
  disabled,
  allocationCaption = 'Allocation % per unit (0.0001–100 each; defaults to 100). Change floor or building to add more units.',
}: {
  idPrefix: string
  portfolios: PortfolioRow[]
  c: PropertyUnitCascade
  disabled?: boolean
  allocationCaption?: string
}) {
  const {
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
    selectedUnitIds,
    unitAllocationPct,
    setUnitAllocationPct,
    resetLocationBelowPortfolio,
    resetLocationBelowBuilding,
    onUnitsSelectChange,
  } = c

  const unitLabel = (id: string) =>
    units?.find((x) => x.id === id)?.code ?? unitMetaById[id]?.code ?? id

  const unitsOnFloor = units ?? []
  const selectedNotOnCurrentFloor = selectedUnitIds.filter(
    (id) => !unitsOnFloor.some((u) => u.id === id),
  )

  return (
    <>
      <FormControl fullWidth size="small" disabled={disabled}>
        <InputLabel id={`${idPrefix}-portfolio-label`}>Portfolio</InputLabel>
        <Select
          labelId={`${idPrefix}-portfolio-label`}
          label="Portfolio"
          value={portfolioId}
          onChange={(e) => {
            setPortfolioId(e.target.value)
            resetLocationBelowPortfolio()
          }}
        >
          <MenuItem value="">
            <em>Select portfolio</em>
          </MenuItem>
          {portfolios.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl fullWidth size="small" disabled={disabled || !portfolioId}>
        <InputLabel id={`${idPrefix}-building-label`}>Building</InputLabel>
        <Select
          labelId={`${idPrefix}-building-label`}
          label="Building"
          value={buildingId}
          onChange={(e) => {
            setBuildingId(e.target.value)
            resetLocationBelowBuilding()
          }}
        >
          <MenuItem value="">
            <em>Select building</em>
          </MenuItem>
          {buildings?.map((b) => (
            <MenuItem key={b.id} value={b.id}>
              {b.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl fullWidth size="small" disabled={disabled || !buildingId}>
        <InputLabel id={`${idPrefix}-floor-label`}>Floor</InputLabel>
        <Select
          labelId={`${idPrefix}-floor-label`}
          label="Floor"
          value={floorId}
          onChange={(e) => setFloorId(e.target.value)}
        >
          <MenuItem value="">
            <em>Select floor</em>
          </MenuItem>
          {floors?.map((f) => (
            <MenuItem key={f.id} value={f.id}>
              {f.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl fullWidth size="small" disabled={disabled || !floorId}>
        <InputLabel id={`${idPrefix}-units-label`}>Units</InputLabel>
        <Select
          labelId={`${idPrefix}-units-label`}
          label="Units"
          multiple
          value={selectedUnitIds}
          onChange={(e) => onUnitsSelectChange(e.target.value)}
          renderValue={(selected) => (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {selected.map((id) => {
                const onThisFloor = unitsOnFloor.some((u) => u.id === id)
                const hint = onThisFloor
                  ? ''
                  : orphanUnitSuffix(id, floorId, buildingId, unitMetaById).replace(
                      /^·\s*/,
                      '',
                    )
                return (
                  <Chip
                    key={id}
                    size="small"
                    label={
                      hint ? `${unitLabel(id)} (${hint})` : unitLabel(id)
                    }
                  />
                )
              })}
            </Box>
          )}
        >
          {unitsOnFloor.map((u) => (
            <MenuItem key={u.id} value={u.id}>
              {u.code}
            </MenuItem>
          ))}
          {selectedNotOnCurrentFloor.map((id) => (
            <MenuItem key={id} value={id}>
              {unitLabel(id)}
              <Typography
                component="span"
                variant="caption"
                color="text.secondary"
                sx={{ ml: 0.75 }}
              >
                {orphanUnitSuffix(id, floorId, buildingId, unitMetaById)}
              </Typography>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {floorId && units && units.length === 0 && selectedNotOnCurrentFloor.length === 0 && (
        <Typography color="text.secondary" variant="body2">
          No units on this floor yet.
        </Typography>
      )}
      {selectedUnitIds.length > 0 && (
        <Stack spacing={1.5}>
          <Typography variant="caption" color="text.secondary">
            {allocationCaption}
          </Typography>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            useFlexGap
            sx={{ flexWrap: 'wrap' }}
          >
            {selectedUnitIds.map((id) => (
                <TextField
                  key={id}
                  size="small"
                  label={`${unitLabel(id)} · %`}
                  type="text"
                  inputMode="decimal"
                  disabled={disabled}
                  sx={{ width: { xs: '100%', sm: 140 } }}
                  value={unitAllocationPct[id] ?? '100'}
                  onChange={(e) => {
                    const t = e.target.value
                    setUnitAllocationPct((prev) => ({
                      ...prev,
                      [id]: t,
                    }))
                  }}
                />
            ))}
          </Stack>
        </Stack>
      )}
    </>
  )
}
