import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material'
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

function parseCoord(raw: string): number | null {
  const n = parseFloat(raw.trim().replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

// Vite bundling: restore default marker assets (Leaflet's CSS expects bundled URLs).
const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})
L.Marker.prototype.options.icon = DefaultIcon

const DEFAULT_LAT = -26.2041
const DEFAULT_LNG = 28.0473

export function MapPinPickerDialog({
  open,
  onClose,
  initialLatitude,
  initialLongitude,
  onPick,
}: {
  open: boolean
  onClose: () => void
  initialLatitude: string
  initialLongitude: string
  onPick: (lat: string, lng: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)

  useEffect(() => {
    if (!open) return
    let mapInst: L.Map | null = null
    let resizeLater: number | undefined

    const startId = window.setTimeout(() => {
      const el = containerRef.current
      if (!el) return

      const lat = parseCoord(initialLatitude) ?? DEFAULT_LAT
      const lng = parseCoord(initialLongitude) ?? DEFAULT_LNG

      const map = L.map(el).setView([lat, lng], 13)
      mapInst = map
      mapRef.current = map
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map)

      const marker = L.marker([lat, lng], { draggable: true }).addTo(map)
      markerRef.current = marker
      map.on('click', (e) => {
        marker.setLatLng(e.latlng)
      })

      window.setTimeout(() => map.invalidateSize(), 0)
      resizeLater = window.setTimeout(() => map.invalidateSize(), 280)
    }, 50)

    return () => {
      window.clearTimeout(startId)
      if (resizeLater !== undefined) window.clearTimeout(resizeLater)
      mapInst?.remove()
      mapInst = null
      mapRef.current = null
      markerRef.current = null
    }
  }, [open, initialLatitude, initialLongitude])

  const apply = () => {
    const marker = markerRef.current
    if (!marker) return
    const ll = marker.getLatLng()
    onPick(ll.lat.toFixed(6), ll.lng.toFixed(6))
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Pick location</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Click the map or drag the pin. Tiles courtesy of OpenStreetMap.
        </Typography>
        <Box
          ref={containerRef}
          sx={{
            height: 360,
            width: '100%',
            borderRadius: 1,
            overflow: 'hidden',
            border: 1,
            borderColor: 'divider',
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={apply}>
          Use coordinates
        </Button>
      </DialogActions>
    </Dialog>
  )
}
