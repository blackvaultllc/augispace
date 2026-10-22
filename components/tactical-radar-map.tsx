'use client'

import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react'
import { Crosshair } from 'lucide-react'
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps'
import worldAtlas from 'world-atlas/countries-110m.json'

export type BeaconKind = 'operator' | 'ip' | 'mail' | 'bluetooth'

export type Beacon = {
  id: string
  kind: BeaconKind
  label: string
  latitude: number
  longitude: number
  source: string
  details: [string, string][]
  dossierId?: string
}

export type Coordinates = { latitude: number; longitude: number; accuracy?: number; capturedAt: string }

const MAP_WIDTH = 800
const MAP_HEIGHT = 440
const SWEEP_PERIOD_MS = 4200
const EARTH_RADIUS_MILES = 3958.7613
const GLOBAL_CENTER: [number, number] = [-18, 25]
const GLOBAL_SCALE = 145

const kindColors: Record<BeaconKind, string> = {
  operator: '#f05656',
  ip: '#e3b85c',
  mail: '#d9cfa8',
  bluetooth: '#7fd3c6',
}

function radiusScale(radiusMiles: number) {
  const latitudeSpan = radiusMiles / 69.17
  return MAP_HEIGHT / (2 * latitudeSpan * Math.PI / 180)
}

function mercatorY(latitude: number) {
  const phi = Math.max(-85, Math.min(85, latitude)) * Math.PI / 180
  return Math.log(Math.tan(Math.PI / 4 + phi / 2))
}

function project([longitude, latitude]: [number, number], center: [number, number], scale: number) {
  let deltaLongitude = longitude - center[0]
  if (deltaLongitude > 180) deltaLongitude -= 360
  if (deltaLongitude < -180) deltaLongitude += 360
  return {
    x: MAP_WIDTH / 2 + scale * deltaLongitude * Math.PI / 180,
    y: MAP_HEIGHT / 2 - scale * (mercatorY(latitude) - mercatorY(center[1])),
  }
}

function getRadiusFeature(coordinates: Coordinates, radiusMiles: number) {
  const angularDistance = radiusMiles / EARTH_RADIUS_MILES
  const latitude = coordinates.latitude * Math.PI / 180
  const longitude = coordinates.longitude * Math.PI / 180
  const points: [number, number][] = []
  for (let bearing = 0; bearing <= 360; bearing += 5) {
    const heading = bearing * Math.PI / 180
    const targetLatitude = Math.asin(Math.sin(latitude) * Math.cos(angularDistance) + Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(heading))
    const targetLongitude = longitude + Math.atan2(Math.sin(heading) * Math.sin(angularDistance) * Math.cos(latitude), Math.cos(angularDistance) - Math.sin(latitude) * Math.sin(targetLatitude))
    points.push([targetLongitude * 180 / Math.PI, targetLatitude * 180 / Math.PI])
  }
  return { type: 'FeatureCollection' as const, features: [{ type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: [points] } }] }
}

type Props = {
  coordinates: Coordinates | null
  radiusMiles: number
  view: 'local' | 'global'
  beacons: Beacon[]
  selectedId: string | null
  onSelect: (beacon: Beacon) => void
  onPing?: (beacon: Beacon) => void
}

export function TacticalRadarMap({ coordinates, radiusMiles, view, beacons, selectedId, onSelect, onPing }: Props) {
  const local = view === 'local' && !!coordinates
  const centerLongitude = local && coordinates ? coordinates.longitude : GLOBAL_CENTER[0]
  const centerLatitude = local && coordinates ? coordinates.latitude : GLOBAL_CENTER[1]
  const scale = local ? radiusScale(radiusMiles) : GLOBAL_SCALE
  const radius = useMemo(() => (local && coordinates ? getRadiusFeature(coordinates, radiusMiles) : null), [local, coordinates, radiusMiles])

  const placed = useMemo(() => beacons.map((beacon) => {
    const point = project([beacon.longitude, beacon.latitude], [centerLongitude, centerLatitude], scale)
    const dx = point.x - MAP_WIDTH / 2
    const dy = point.y - MAP_HEIGHT / 2
    const visible = point.x >= -8 && point.x <= MAP_WIDTH + 8 && point.y >= -8 && point.y <= MAP_HEIGHT + 8
    const atCenter = Math.hypot(dx, dy) < 2
    const bearing = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360
    return { beacon, visible, atCenter, bearing }
  }), [beacons, centerLongitude, centerLatitude, scale])

  const sweepRef = useRef<HTMLDivElement>(null)
  const markerRefs = useRef(new Map<string, SVGGElement>())
  const placedRef = useRef(placed)
  const onPingRef = useRef(onPing)

  useEffect(() => {
    placedRef.current = placed
    onPingRef.current = onPing
  })

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      markerRefs.current.forEach((element) => element.style.setProperty('--glow', '1'))
      return
    }
    const lastBehind = new Map<string, number>()
    let frame = 0
    const tick = (time: number) => {
      const angle = (time % SWEEP_PERIOD_MS) / SWEEP_PERIOD_MS * 360
      if (sweepRef.current) sweepRef.current.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`
      for (const item of placedRef.current) {
        const element = markerRefs.current.get(item.beacon.id)
        if (!element) continue
        if (item.atCenter) {
          element.style.setProperty('--glow', '1')
          continue
        }
        const behind = (angle - item.bearing + 360) % 360
        element.style.setProperty('--glow', String(Math.max(0.22, 1 - behind / 320)))
        const previous = lastBehind.get(item.beacon.id)
        if (previous !== undefined && behind < previous && previous - behind > 180) {
          element.classList.remove('is-pinging')
          void element.getBoundingClientRect()
          element.classList.add('is-pinging')
          onPingRef.current?.(item.beacon)
        }
        lastBehind.set(item.beacon.id, behind)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  function handleMarkerKey(event: KeyboardEvent<SVGGElement>, beacon: Beacon) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect(beacon)
    }
  }

  const visibleCount = placed.filter((item) => item.visible).length

  return (
    <div className={`geo-map-viewport radar-viewport${local ? ' geo-map-locked' : ''}`}>
      <div className="geo-map-grid" aria-hidden="true" />
      <ComposableMap
        key={`${view}-${local ? 'fix' : 'world'}`}
        className="geo-map-svg"
        width={MAP_WIDTH}
        height={MAP_HEIGHT}
        projection="geoMercator"
        projectionConfig={{ center: [centerLongitude, centerLatitude], scale }}
        aria-label={local ? `Radar map centered on your location, ${radiusMiles}-mile range, ${visibleCount} beacons in view` : `Global radar map, ${visibleCount} beacons in view`}
      >
        {/* react-simple-maps consumes bundled TopoJSON at runtime; its geography prop types only accept GeoJSON. */}
        <Geographies geography={worldAtlas as never}>
          {({ geographies }) => geographies.map((geography) => (
            <Geography key={geography.rsmKey} geography={geography} fill="#081114" stroke="#1f4a44" strokeWidth={local ? 0.55 : 0.7} tabIndex={-1} style={{ outline: 'none' }} />
          ))}
        </Geographies>
        {radius && (
          <Geographies geography={radius}>
            {({ geographies }) => geographies.map((geography) => <Geography key={geography.rsmKey} geography={geography} fill="rgba(53, 224, 196, 0.07)" stroke="#35e0c4" strokeWidth={1.1} strokeDasharray="4 3" tabIndex={-1} style={{ outline: 'none' }} />)}
          </Geographies>
        )}
        {placed.filter((item) => item.visible).map(({ beacon }) => (
          <Marker key={beacon.id} coordinates={[beacon.longitude, beacon.latitude]}>
            <g
              ref={(element) => { if (element) markerRefs.current.set(beacon.id, element); else markerRefs.current.delete(beacon.id) }}
              className={`radar-beacon radar-beacon-${beacon.kind}${selectedId === beacon.id ? ' is-selected' : ''}`}
              style={{ color: kindColors[beacon.kind] }}
              role="button"
              tabIndex={0}
              aria-label={`${beacon.kind === 'operator' ? 'Your location' : beacon.label}. Open beacon details.`}
              aria-pressed={selectedId === beacon.id}
              onClick={() => onSelect(beacon)}
              onKeyDown={(event) => handleMarkerKey(event, beacon)}
            >
              <circle className="radar-beacon-hit" r={13} />
              <circle className="radar-beacon-ring" r={6} />
              <circle className="radar-beacon-halo" r={9} />
              <circle className="radar-beacon-core" r={beacon.kind === 'operator' ? 4.2 : 3.4} />
            </g>
          </Marker>
        ))}
      </ComposableMap>

      <div className="radar-scope" aria-hidden="true">
        <span className="radar-ring radar-ring-1" />
        <span className="radar-ring radar-ring-2" />
        <span className="radar-ring radar-ring-3" />
        <span className="radar-axis radar-axis-h" />
        <span className="radar-axis radar-axis-v" />
        <div ref={sweepRef} className="radar-sweep" />
        <span className="radar-bearing radar-bearing-n">000</span>
        <span className="radar-bearing radar-bearing-e">090</span>
        <span className="radar-bearing radar-bearing-s">180</span>
        <span className="radar-bearing radar-bearing-w">270</span>
      </div>

      <div className="geo-map-caption"><span>{local ? 'LOCAL TARGET GRID' : 'GLOBAL BEACON PLOT'}</span><span>{local ? `${radiusMiles} MI RANGE` : 'WORLD SCALE'} · {String(visibleCount).padStart(2, '0')} CONTACTS</span></div>
      {local && <span className="geo-map-crosshair" aria-hidden="true"><Crosshair /></span>}
    </div>
  )
}
