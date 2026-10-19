'use client'

import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react'
import {
  Activity,
  AlertTriangle,
  Antenna,
  ArrowDownToLine,
  ChevronDown,
  ChevronUp,
  Command,
  Crosshair,
  Database,
  Globe2,
  LockKeyhole,
  MapPin,
  Network,
  Radio,
  ScanLine,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Signal,
  Terminal,
  Wifi,
  X,
} from 'lucide-react'
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps'
import worldAtlas from 'world-atlas/countries-110m.json'

type Coordinates = { latitude: number; longitude: number; capturedAt: string }
type CommandLog = { id: string; command: string; output: string; time: string }
type Panel = 'network' | 'rf' | 'registry' | 'terminal' | null

const SESSION_KEY = 'agamoss:geo-command-session:v1'
const EARTH_RADIUS_MILES = 3958.7613
const METERS_PER_MILE = 1609.344
const AVAILABLE_COMMANDS = ['scan --local-net', 'sec --radius 100', 'wifi --verify']

function formatCoordinate(value: number, positive: string, negative: string) {
  return `${Math.abs(value).toFixed(4)}°${value >= 0 ? positive : negative}`
}

function getRadiusFeature(coordinates: Coordinates | null, radiusMiles: number) {
  if (!coordinates) return null
  const angularDistance = radiusMiles / EARTH_RADIUS_MILES
  const latitude = coordinates.latitude * Math.PI / 180
  const longitude = coordinates.longitude * Math.PI / 180
  const points: [number, number][] = []

  for (let bearing = 0; bearing <= 360; bearing += 5) {
    const heading = bearing * Math.PI / 180
    const targetLatitude = Math.asin(
      Math.sin(latitude) * Math.cos(angularDistance) +
      Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(heading),
    )
    const targetLongitude = longitude + Math.atan2(
      Math.sin(heading) * Math.sin(angularDistance) * Math.cos(latitude),
      Math.cos(angularDistance) - Math.sin(latitude) * Math.sin(targetLatitude),
    )
    points.push([targetLongitude * 180 / Math.PI, targetLatitude * 180 / Math.PI])
  }

  return {
    type: 'FeatureCollection' as const,
    features: [{
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'Polygon' as const, coordinates: [points] },
    }],
  }
}

function radiusScale(radiusMiles: number) {
  const latitudeSpan = radiusMiles / 69.17
  return 440 / (2 * latitudeSpan * Math.PI / 180)
}

function RadarMap({ coordinates, radiusMiles }: { coordinates: Coordinates | null; radiusMiles: number }) {
  const radius = useMemo(() => getRadiusFeature(coordinates, radiusMiles), [coordinates, radiusMiles])
  const center: [number, number] = coordinates ? [coordinates.longitude, coordinates.latitude] : [-18, 25]

  return (
    <div className={`geo-map-viewport${coordinates ? ' geo-map-locked' : ''}`} aria-label={coordinates ? `Local map centered on operator coordinates with a ${radiusMiles}-mile radius` : 'Continental map overview'}>
      <div className="geo-map-grid" aria-hidden="true" />
      <ComposableMap
        className="geo-map-svg"
        width={800}
        height={440}
        projection="geoMercator"
        projectionConfig={{ center, scale: coordinates ? radiusScale(radiusMiles) : 145 }}
        aria-label={coordinates ? 'World map zoomed to the operator location' : 'World map at continental scale'}
        role="img"
      >
        {/* react-simple-maps consumes bundled TopoJSON at runtime; its geography prop types only accept GeoJSON. */}
        <Geographies geography={worldAtlas as never}>
          {({ geographies }) => geographies.map((geography) => (
            <Geography
              key={geography.rsmKey}
              geography={geography}
              fill="#11110d"
              stroke="#554528"
              strokeWidth={coordinates ? 0.55 : 0.7}
              tabIndex={-1}
            />
          ))}
        </Geographies>
        {radius && (
          <Geographies geography={radius}>
            {({ geographies }) => geographies.map((geography) => <Geography key={geography.rsmKey} geography={geography} fill="rgba(202, 164, 85, 0.12)" stroke="#c9a454" strokeWidth={1.1} tabIndex={-1} />)}
          </Geographies>
        )}
        {coordinates && (
          <Marker coordinates={[coordinates.longitude, coordinates.latitude]}>
            <circle r={11} fill="rgba(224, 68, 68, .12)" stroke="#e04444" strokeWidth={1} />
            <circle r={4} fill="#f05656" stroke="#0a0806" strokeWidth={1.5} />
          </Marker>
        )}
      </ComposableMap>
      <div className="geo-map-caption"><span>{coordinates ? 'LOCAL TARGET GRID' : 'CONTINENTAL OVERVIEW'}</span><span>{coordinates ? `${radiusMiles} MI RADIUS` : 'AWAITING OPERATOR FIX'}</span></div>
      {coordinates && <span className="geo-map-crosshair" aria-hidden="true"><Crosshair /></span>}
    </div>
  )
}

function DiagnosticValue({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof Shield }) {
  return (
    <article className="geo-diagnostic-value">
      <span className="geo-diagnostic-icon"><Icon aria-hidden="true" /></span>
      <div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
    </article>
  )
}

export function GeoCommandCenter() {
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null)
  const [radiusMiles, setRadiusMiles] = useState(100)
  const [panel, setPanel] = useState<Panel>(null)
  const [command, setCommand] = useState('')
  const [logs, setLogs] = useState<CommandLog[]>([])
  const [scanState, setScanState] = useState<'idle' | 'locating' | 'locked' | 'error'>('idle')
  const [scanMessage, setScanMessage] = useState('Location is not requested until you start a perimeter scan.')
  const [browserOnline, setBrowserOnline] = useState<boolean | null>(null)

  useEffect(() => {
    setBrowserOnline(navigator.onLine)
    try {
      const saved = sessionStorage.getItem(SESSION_KEY)
      if (!saved) return
      const parsed = JSON.parse(saved) as { coordinates?: Coordinates; radiusMiles?: number; logs?: CommandLog[] }
      if (parsed.coordinates && Number.isFinite(parsed.coordinates.latitude) && Number.isFinite(parsed.coordinates.longitude)) {
        setCoordinates(parsed.coordinates)
        setScanState('locked')
        setScanMessage('Operator fix restored from this tab session.')
      }
      if (typeof parsed.radiusMiles === 'number' && Number.isFinite(parsed.radiusMiles)) setRadiusMiles(Math.min(100, Math.max(1, parsed.radiusMiles)))
      if (Array.isArray(parsed.logs)) setLogs(parsed.logs.slice(0, 12))
    } catch {
      sessionStorage.removeItem(SESSION_KEY)
    }
  }, [])

  function saveSession(nextCoordinates: Coordinates | null, nextRadius = radiusMiles, nextLogs = logs) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ coordinates: nextCoordinates, radiusMiles: nextRadius, logs: nextLogs }))
    } catch {
      setScanMessage('Session cache unavailable. The current map remains in memory until this page closes.')
    }
  }

  function appendLog(commandText: string, output: string, nextRadius = radiusMiles) {
    const next = [{ id: crypto.randomUUID(), command: commandText, output, time: new Date().toLocaleTimeString() }, ...logs].slice(0, 12)
    setLogs(next)
    saveSession(coordinates, nextRadius, next)
  }

  function enactPerimeterScan() {
    if (!navigator.geolocation) {
      setScanState('error')
      setScanMessage('This browser does not provide the Geolocation API.')
      return
    }
    setScanState('locating')
    setScanMessage('Waiting for your browser location permission…')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const fix = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          capturedAt: new Date(position.timestamp).toISOString(),
        }
        setCoordinates(fix)
        setRadiusMiles(100)
        setScanState('locked')
        setScanMessage('Coordinates centered locally. No network or threat feed was queried.')
        saveSession(fix, 100)
      },
      (error) => {
        setScanState('error')
        const message = error.code === error.PERMISSION_DENIED
          ? 'Location permission was denied. Allow access in your browser to center the local map.'
          : error.code === error.POSITION_UNAVAILABLE
            ? 'Your device did not provide a location fix.'
            : 'Location request timed out. You can retry when ready.'
        setScanMessage(message)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }

  function runCommand(rawCommand: string) {
    const value = rawCommand.trim().replace(/\s+/g, ' ')
    if (!value) return
    setCommand('')

    if (value === 'scan --local-net') {
      appendLog(value, 'UNAVAILABLE · Browsers cannot enumerate LAN routes or MAC addresses. No packets were sent.')
      setPanel('network')
      return
    }

    if (value === 'wifi --verify') {
      const status = browserOnline === null ? 'unknown' : browserOnline ? 'online' : 'offline'
      appendLog(value, `BROWSER LINK · ${status.toUpperCase()} · SSID, encryption, access-point identity, and rogue AP status are not exposed to this page.`)
      setPanel('network')
      return
    }

    const radiusMatch = value.match(/^sec\s+--radius\s+(\d{1,3})$/)
    if (radiusMatch) {
      const requestedRadius = Number(radiusMatch[1])
      if (requestedRadius < 1 || requestedRadius > 100) {
        appendLog(value, 'REJECTED · Choose a radius from 1 to 100 miles.')
        setPanel('terminal')
        return
      }
      if (!coordinates) {
        appendLog(value, 'NO FIX · Start ENACT PERIMETER SCAN and grant location permission before setting a local radius.')
        setPanel('terminal')
        return
      }
      setRadiusMiles(requestedRadius)
      appendLog(value, `${requestedRadius} MI RADIUS · Local map visualization updated. No incident feed is connected.`, requestedRadius)
      setPanel(null)
      return
    }

    appendLog(value, `UNKNOWN COMMAND · Supported: ${AVAILABLE_COMMANDS.join(' · ')}`)
    setPanel('terminal')
  }

  function submitCommand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    runCommand(command)
  }

  function handleCommandKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    if (event.key === 'Enter') {
      event.preventDefault()
      runCommand(command)
    }
  }

  const panelTitles: Record<Exclude<Panel, null>, string> = {
    network: 'NETWORK DEFENSE MATRIX',
    rf: 'RF PROXIMITY ARRAY',
    registry: 'PUBLIC INCIDENT REGISTRY',
    terminal: 'DIAGNOSTIC TERMINAL',
  }

  return (
    <section className="geo-command" aria-labelledby="geo-command-title">
      <header className="geo-command-heading">
        <div className="geo-command-title-group">
          <span className="geo-command-mark"><Crosshair aria-hidden="true" /></span>
          <div>
            <p className="geo-eyebrow"><span /> SOVEREIGN GEO COMMAND / SESSION-LOCAL</p>
            <h2 id="geo-command-title">Tactical <span>geolocation</span> radar</h2>
          </div>
        </div>
        <div className="geo-command-status"><span className={scanState === 'locked' ? 'geo-status-dot is-locked' : 'geo-status-dot'} />{scanState === 'locked' ? 'FIX ACQUIRED' : scanState === 'locating' ? 'REQUESTING FIX' : 'NO FIX'}</div>
      </header>

      <nav className="geo-node-nav" aria-label="Tactical system views">
        <button type="button" className="is-current" onClick={() => setPanel(null)} aria-current="page"><Crosshair aria-hidden="true" /> RADAR <span>01</span></button>
        <button type="button" aria-expanded={panel === 'network'} onClick={() => setPanel(panel === 'network' ? null : 'network')}><Network aria-hidden="true" /> NETWORK <span>02</span></button>
        <button type="button" aria-expanded={panel === 'rf'} onClick={() => setPanel(panel === 'rf' ? null : 'rf')}><Antenna aria-hidden="true" /> RF ARRAY <span>03</span></button>
        <button type="button" aria-expanded={panel === 'registry'} onClick={() => setPanel(panel === 'registry' ? null : 'registry')}><Database aria-hidden="true" /> REGISTRY <span>04</span></button>
        <button type="button" aria-expanded={panel === 'terminal'} onClick={() => setPanel(panel === 'terminal' ? null : 'terminal')}><Terminal aria-hidden="true" /> TERMINAL <span>05</span></button>
      </nav>

      <div className="geo-deck">
        <div className="geo-main-deck">
          <div className="geo-scan-row">
            <div><span className="geo-micro-label">DEPLOYMENT CONTROL / GPS CONSENT REQUIRED</span><p>Center the local range on your device. Coordinates stay in this browser tab.</p></div>
            <button className="geo-scan-button" type="button" onClick={enactPerimeterScan} disabled={scanState === 'locating'}>
              <ScanLine aria-hidden="true" />{scanState === 'locating' ? 'ACQUIRING FIX…' : 'ENACT PERIMETER SCAN'}<ArrowDownToLine aria-hidden="true" />
            </button>
          </div>

          <div className="geo-map-panel">
            <div className="geo-panel-topline"><span><Globe2 aria-hidden="true" /> GEOGRAPHIC COMMAND CANVAS</span><span>WGS 84 / LOCAL PROJECTION</span></div>
            <RadarMap coordinates={coordinates} radiusMiles={radiusMiles} />
            <div className="geo-map-controls">
              <div className="geo-coordinate-readout" aria-live="polite">
                <MapPin aria-hidden="true" />
                {coordinates ? <><span>{formatCoordinate(coordinates.latitude, 'N', 'S')}</span><span>{formatCoordinate(coordinates.longitude, 'E', 'W')}</span></> : <span>AWAITING GPS FIX</span>}
              </div>
              <div className="geo-zoom-controls" aria-label="Map radius controls">
                <button type="button" aria-label="Zoom in, decrease radius" disabled={!coordinates || radiusMiles <= 1} onClick={() => { const next = Math.max(1, Math.round(radiusMiles / 2)); setRadiusMiles(next); saveSession(coordinates, next) }}><ChevronUp aria-hidden="true" /></button>
                <span>{radiusMiles} MI</span>
                <button type="button" aria-label="Zoom out, increase radius" disabled={!coordinates || radiusMiles >= 100} onClick={() => { const next = Math.min(100, radiusMiles * 2); setRadiusMiles(next); saveSession(coordinates, next) }}><ChevronDown aria-hidden="true" /></button>
              </div>
            </div>
          </div>

          <div className="geo-diagnostics-grid" aria-label="Browser-visible diagnostic status">
            <DiagnosticValue label="NETWORK LINK" value={browserOnline === null ? 'CHECKING' : browserOnline ? 'ONLINE' : 'OFFLINE'} detail="Reachability only · no subnet scan" icon={Wifi} />
            <DiagnosticValue label="DEVICE POSTURE" value="NOT EXPOSED" detail="Browser cannot inspect local security state" icon={Shield} />
            <DiagnosticValue label="RF / BLUETOOTH" value="NOT SCANNED" detail="No beacon or nearby-device scan" icon={Radio} />
            <DiagnosticValue label="PUBLIC OSINT" value="NO FEED" detail="No regional provider connected" icon={Activity} />
          </div>
          <p className={`geo-scan-message${scanState === 'error' ? ' is-error' : ''}`} role="status"><LockKeyhole aria-hidden="true" />{scanMessage}</p>
        </div>

        <aside className="geo-side-deck" aria-label="Regional indicator summary">
          <div className="geo-side-heading"><span className="geo-micro-label">LOCAL INDICATOR SUMMARY</span><span className="geo-ring-index">R / {String(radiusMiles).padStart(3, '0')}</span></div>
          <div className="geo-risk-list">
            <div><span className="geo-light geo-light-muted" /><span>NETWORK POSTURE</span><strong>UNAVAILABLE</strong></div>
            <div><span className="geo-light geo-light-muted" /><span>RF PROXIMITY</span><strong>NOT EXPOSED</strong></div>
            <div><span className="geo-light geo-light-muted" /><span>PUBLIC INCIDENTS</span><strong>NO FEED</strong></div>
          </div>
          <div className="geo-signal-array" aria-label="Session runtime sequence">
            <div className="geo-micro-label">SESSION SEQUENCE / LOCAL</div>
            <div>{Array.from({ length: 24 }, (_, index) => <span key={index} className={index % 6 === 0 ? 'is-accent' : ''}>{String((index * 37 + (coordinates ? 11 : 0)) % 100).padStart(2, '0')}</span>)}</div>
          </div>
          <div className="geo-privacy-card"><ShieldCheck aria-hidden="true" /><div><strong>FIRST-PARTY BOUNDARY</strong><p>Location and command history remain in this tab&apos;s session cache. This interface sends no coordinates to its server or external map service.</p><small>Same-origin scripts and browser extensions may access page storage.</small></div></div>
          <div className="geo-empty-registry"><span className="geo-micro-label">REGIONAL INCIDENT RECORDS</span><strong>NO RECORDS LOADED</strong><p>No public threat feed is configured. Categories shown in the registry are not live findings.</p><button type="button" onClick={() => setPanel('registry')}>OPEN REGISTRY <ChevronDown aria-hidden="true" /></button></div>
        </aside>
      </div>

      <form className="geo-cli" onSubmit={submitCommand} aria-label="Tactical diagnostic command line">
        <span className="geo-cli-prefix"><Terminal aria-hidden="true" /> AGAMOSS<span> $</span></span>
        <label className="sr-only" htmlFor="geo-command-input">Enter a supported diagnostic command</label>
        <input id="geo-command-input" value={command} onChange={(event) => setCommand(event.target.value)} onKeyDown={handleCommandKeyDown} autoComplete="off" spellCheck={false} placeholder="scan --local-net   ·   sec --radius 100   ·   wifi --verify" />
        <button type="submit" aria-label="Run diagnostic command"><Command aria-hidden="true" /> EXECUTE</button>
      </form>

      <div className="geo-command-foot"><span><ShieldAlert aria-hidden="true" /> PASSIVE DISPLAY ONLY · NO PACKET INJECTION · NO PORT SCANS</span><span>SESSION LOG / {String(logs.length).padStart(2, '0')}</span></div>

      {panel && (
        <div className="geo-slideout-backdrop" onClick={() => setPanel(null)}>
          <aside className="geo-slideout" onClick={(event) => event.stopPropagation()} aria-label={panelTitles[panel]}>
            <div className="geo-slideout-heading"><div><span className="geo-micro-label">SYSTEM NODE / 0{panel === 'network' ? '2' : panel === 'rf' ? '3' : panel === 'registry' ? '4' : '5'}</span><h3>{panelTitles[panel]}</h3></div><button type="button" onClick={() => setPanel(null)} aria-label="Close system panel"><X aria-hidden="true" /></button></div>
            {panel === 'network' && <div className="geo-slideout-body"><div className="geo-honesty-note"><Network aria-hidden="true" /><p>Browser security boundaries prevent this page from reading gateway routes, MAC addresses, SSIDs, encryption, or local device posture.</p></div><DiagnosticValue label="LINK STATE" value={browserOnline === null ? 'CHECKING' : browserOnline ? 'ONLINE' : 'OFFLINE'} detail="navigator.onLine only" icon={Signal} /><DiagnosticValue label="SUBNET / ROUTES" value="UNAVAILABLE" detail="No interface or packet inspection performed" icon={Network} /><DiagnosticValue label="WI-FI POSTURE" value="UNAVAILABLE" detail="No SSID, BSSID, or encryption status exposed" icon={ShieldCheck} /><CommandHistory logs={logs.filter((entry) => entry.command.startsWith('scan ') || entry.command.startsWith('wifi '))} /></div>}
            {panel === 'rf' && <div className="geo-slideout-body"><div className="geo-honesty-note"><Antenna aria-hidden="true" /><p>Nearby Bluetooth and RF identifiers are not available to ordinary web pages. No device picker or active radio scan is started.</p></div><div className="geo-rf-display"><span className="geo-rf-ring" /><span className="geo-rf-ring" /><span className="geo-rf-ring" /><div><Radio aria-hidden="true" /><strong>NO RF DATA</strong><small>PASSIVE / NOT EXPOSED</small></div></div><div className="geo-placeholder-row"><span>BLUETOOTH BEACONS</span><strong>NOT SCANNED</strong></div><div className="geo-placeholder-row"><span>WIRELESS INTERFERENCE</span><strong>NOT MEASURED</strong></div><div className="geo-placeholder-row"><span>NEARBY IDENTIFIERS</span><strong>NO DATA</strong></div></div>}
            {panel === 'registry' && <div className="geo-slideout-body"><div className="geo-honesty-note"><Database aria-hidden="true" /><p>Regional incident data is not connected. The empty table below is intentional; it does not imply a clean or unsafe area.</p></div><div className="geo-registry-table" role="table" aria-label="Public regional threat registry"><div className="geo-registry-row geo-registry-header" role="row"><span role="columnheader">SOURCE CATEGORY</span><span role="columnheader">STATUS</span><span role="columnheader">RECORDS</span></div>{['Public incident notices', 'Scam / phishing reports', 'Regional vulnerability advisories', 'Open-source risk indicators'].map((category) => <div className="geo-registry-row" role="row" key={category}><span role="cell">{category}</span><span role="cell">NO FEED</span><span role="cell">—</span></div>)}</div><p className="geo-small-disclaimer">No records were fetched, inferred, or fabricated. A feed integration is required to populate this registry.</p></div>}
            {panel === 'terminal' && <div className="geo-slideout-body"><div className="geo-honesty-note"><Terminal aria-hidden="true" /><p>Local command interpreter. It does not open a shell, inspect other devices, or send network probes.</p></div><div className="geo-command-reference"><span>scan --local-net</span><p>Reports browser limitation; sends no packets.</p><span>sec --radius [1–100]</span><p>Draws a geodesic radius around the current GPS fix.</p><span>wifi --verify</span><p>Reports navigator.onLine only; cannot verify Wi-Fi security.</p></div><CommandHistory logs={logs} /></div>}
          </aside>
        </div>
      )}
    </section>
  )
}

function CommandHistory({ logs }: { logs: CommandLog[] }) {
  return (
    <div className="geo-command-history" aria-live="polite">
      <span className="geo-micro-label">LOCAL COMMAND HISTORY</span>
      {logs.length ? logs.map((entry) => <article key={entry.id}><div><code>{entry.command}</code><time>{entry.time}</time></div><p>{entry.output}</p></article>) : <p>No commands in this session.</p>}
    </div>
  )
}
