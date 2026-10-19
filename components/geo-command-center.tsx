'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import {
  Activity,
  Antenna,
  ArrowDownToLine,
  Bluetooth,
  ChevronDown,
  ChevronUp,
  Command,
  Crosshair,
  Database,
  Globe2,
  LockKeyhole,
  MapPin,
  Network,
  Radar,
  ScanLine,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Signal,
  Terminal,
  Volume2,
  VolumeX,
  Wifi,
  X,
} from 'lucide-react'
import { DeviceRecovery, type PairedDevice } from '@/components/device-recovery'
import { DossierActions, DossierFacts } from '@/components/ip-dossier-desk'
import { TacticalRadarMap, type Beacon, type Coordinates } from '@/components/tactical-radar-map'
import type { IpDossier } from '@/lib/ip-dossier'

type CommandLog = { id: string; command: string; output: string; time: string }
type Panel = 'network' | 'rf' | 'registry' | 'terminal' | 'beacon' | null
type View = 'local' | 'global'

const SESSION_KEY = 'agamoss:geo-command-session:v2'
const AVAILABLE_COMMANDS = ['scan --local-net', 'sec --radius 100', 'wifi --verify', 'radar --global', 'radar --local', 'beacons --list']

function formatCoordinate(value: number, positive: string, negative: string) {
  return `${Math.abs(value).toFixed(4)}°${value >= 0 ? positive : negative}`
}

function DiagnosticValue({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof Shield }) {
  return (
    <article className="geo-diagnostic-value">
      <span className="geo-diagnostic-icon"><Icon aria-hidden="true" /></span>
      <div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
    </article>
  )
}

type Props = {
  dossiers?: IpDossier[]
  focus?: { dossierId: string; nonce: number } | null
  onOpenDossier?: (id: string) => void
}

export function GeoCommandCenter({ dossiers = [], focus = null, onOpenDossier }: Props) {
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null)
  const [radiusMiles, setRadiusMiles] = useState(100)
  const [view, setView] = useState<View>('global')
  const [panel, setPanel] = useState<Panel>(null)
  const [selectedBeaconId, setSelectedBeaconId] = useState<string | null>(null)
  const [command, setCommand] = useState('')
  const [logs, setLogs] = useState<CommandLog[]>([])
  const [devices, setDevices] = useState<PairedDevice[]>([])
  const [scanState, setScanState] = useState<'idle' | 'locating' | 'locked' | 'error'>('idle')
  const [scanMessage, setScanMessage] = useState('Location is not requested until you start a perimeter scan.')
  const [browserOnline, setBrowserOnline] = useState<boolean | null>(null)
  const [audioOn, setAudioOn] = useState(false)
  const [lastPing, setLastPing] = useState<{ label: string; time: string } | null>(null)
  const [handledFocus, setHandledFocus] = useState<number | null>(null)
  const audioRef = useRef<AudioContext | null>(null)
  const audioOnRef = useRef(false)

  if (focus && focus.nonce !== handledFocus) {
    setHandledFocus(focus.nonce)
    setView('global')
    setSelectedBeaconId(`ip-${focus.dossierId}`)
    setPanel('beacon')
  }

  useEffect(() => {
    setBrowserOnline(navigator.onLine)
    try {
      const saved = sessionStorage.getItem(SESSION_KEY)
      if (!saved) return
      const parsed = JSON.parse(saved) as { coordinates?: Coordinates; radiusMiles?: number; logs?: CommandLog[]; view?: View }
      if (parsed.coordinates && Number.isFinite(parsed.coordinates.latitude) && Number.isFinite(parsed.coordinates.longitude)) {
        setCoordinates(parsed.coordinates)
        setScanState('locked')
        setView(parsed.view === 'global' ? 'global' : 'local')
        setScanMessage('Operator fix restored from this tab session.')
      }
      if (typeof parsed.radiusMiles === 'number' && Number.isFinite(parsed.radiusMiles)) setRadiusMiles(Math.min(100, Math.max(1, parsed.radiusMiles)))
      if (Array.isArray(parsed.logs)) setLogs(parsed.logs.slice(0, 12))
    } catch {
      sessionStorage.removeItem(SESSION_KEY)
    }
  }, [])

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ coordinates, radiusMiles, logs, view }))
    } catch {
      /* Session storage can be disabled; state still lives in memory for this page. */
    }
  }, [coordinates, radiusMiles, logs, view])

  useEffect(() => () => { void audioRef.current?.close() }, [])

  const beacons = useMemo<Beacon[]>(() => {
    const list: Beacon[] = []
    if (coordinates) {
      list.push({
        id: 'operator',
        kind: 'operator',
        label: 'Operator fix (you)',
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        source: 'Browser Geolocation API · your consent',
        details: [
          ['LATITUDE', formatCoordinate(coordinates.latitude, 'N', 'S')],
          ['LONGITUDE', formatCoordinate(coordinates.longitude, 'E', 'W')],
          ['ACCURACY', coordinates.accuracy ? `± ${Math.round(coordinates.accuracy)} m` : 'Not reported'],
          ['CAPTURED', new Date(coordinates.capturedAt).toLocaleString()],
          ['PAIRED DEVICES', devices.length ? devices.map((device) => device.name).join(', ') : 'None'],
        ],
      })
    }
    for (const dossier of dossiers) {
      const { latitude, longitude, city, country } = dossier.report.location
      if (latitude === null || longitude === null) continue
      list.push({
        id: `ip-${dossier.id}`,
        kind: 'ip',
        label: `${dossier.ip} · ${[city, country].filter(Boolean).join(', ') || 'Unknown area'}`,
        latitude,
        longitude,
        source: 'Saved IP dossier · public registry',
        details: [],
        dossierId: dossier.id,
      })
    }
    return list
  }, [coordinates, dossiers, devices])

  const selectedBeacon = beacons.find((beacon) => beacon.id === selectedBeaconId) ?? null
  const selectedDossier = selectedBeacon?.dossierId ? dossiers.find((dossier) => dossier.id === selectedBeacon.dossierId) ?? null : null

  function appendLog(commandText: string, output: string) {
    setLogs((current) => [{ id: crypto.randomUUID(), command: commandText, output, time: new Date().toLocaleTimeString() }, ...current].slice(0, 12))
  }

  function selectBeacon(beacon: Beacon) {
    setSelectedBeaconId(beacon.id)
    setPanel('beacon')
  }

  function playPing() {
    const context = audioRef.current
    if (!audioOnRef.current || !context) return
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(1320, context.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(880, context.currentTime + 0.18)
    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.32)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.34)
  }

  function handlePing(beacon: Beacon) {
    playPing()
    setLastPing({ label: beacon.kind === 'operator' ? 'OPERATOR' : beacon.label, time: new Date().toLocaleTimeString() })
  }

  function toggleAudio() {
    const next = !audioOn
    if (next && !audioRef.current) audioRef.current = new AudioContext()
    if (next) void audioRef.current?.resume()
    audioOnRef.current = next
    setAudioOn(next)
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
        setCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: new Date(position.timestamp).toISOString(),
        })
        setRadiusMiles(100)
        setView('local')
        setScanState('locked')
        setScanMessage('Coordinates locked. The radar is centered on your fix; coordinates stay in this tab.')
      },
      (error) => {
        setScanState('error')
        setScanMessage(error.code === error.PERMISSION_DENIED
          ? 'Location permission was denied. Allow access in your browser to center the local map.'
          : error.code === error.POSITION_UNAVAILABLE
            ? 'Your device did not provide a location fix.'
            : 'Location request timed out. You can retry when ready.')
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
      appendLog(value, `BROWSER LINK · ${status.toUpperCase()} · SSID, encryption, and access-point identity are not exposed to web pages.`)
      setPanel('network')
      return
    }
    if (value === 'radar --global') {
      setView('global')
      appendLog(value, `GLOBAL PLOT · ${beacons.length} real contacts on the world map.`)
      setPanel(null)
      return
    }
    if (value === 'radar --local') {
      if (!coordinates) {
        appendLog(value, 'NO FIX · Run ENACT PERIMETER SCAN first.')
        setPanel('terminal')
        return
      }
      setView('local')
      appendLog(value, `LOCAL GRID · ${radiusMiles} MI range around your fix.`)
      setPanel(null)
      return
    }
    if (value === 'beacons --list') {
      appendLog(value, beacons.length ? beacons.map((beacon) => beacon.kind === 'operator' ? 'OPERATOR' : beacon.label).join(' | ') : 'NO CONTACTS · Lock your fix or save an IP dossier.')
      setPanel('registry')
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
      setView('local')
      appendLog(value, `${requestedRadius} MI RADIUS · Local grid recalibrated around your fix.`)
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
    rf: 'DEVICE RECOVERY ARRAY',
    registry: 'CONTACT & INCIDENT REGISTRY',
    terminal: 'DIAGNOSTIC TERMINAL',
    beacon: 'BEACON INTELLIGENCE',
  }
  const panelIndex: Record<Exclude<Panel, null>, string> = { network: '02', rf: '03', registry: '04', terminal: '05', beacon: '06' }
  const liveDevices = devices.filter((device) => device.signalSupport === 'live').length

  return (
    <section className="geo-command" aria-labelledby="geo-command-title">
      <header className="geo-command-heading">
        <div className="geo-command-title-group">
          <span className="geo-command-mark"><Radar aria-hidden="true" /></span>
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
        <button type="button" aria-expanded={panel === 'rf'} onClick={() => setPanel(panel === 'rf' ? null : 'rf')}><Antenna aria-hidden="true" /> RECOVERY <span>03</span></button>
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
            <div className="geo-panel-topline">
              <span><Globe2 aria-hidden="true" /> GEOGRAPHIC COMMAND CANVAS</span>
              <span className="radar-topline-tools">
                <span className="radar-view-toggle" role="group" aria-label="Radar scale">
                  <button type="button" aria-pressed={view === 'local'} disabled={!coordinates} onClick={() => setView('local')}>LOCAL</button>
                  <button type="button" aria-pressed={view === 'global'} onClick={() => setView('global')}>GLOBAL</button>
                </span>
                <button type="button" className="radar-audio-toggle" onClick={toggleAudio} aria-pressed={audioOn} aria-label={audioOn ? 'Mute radar ping audio' : 'Enable radar ping audio'}>{audioOn ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}</button>
              </span>
            </div>
            <TacticalRadarMap coordinates={coordinates} radiusMiles={radiusMiles} view={view} beacons={beacons} selectedId={selectedBeaconId} onSelect={selectBeacon} onPing={handlePing} />
            <div className="geo-map-controls">
              <div className="geo-coordinate-readout" aria-live="polite">
                <MapPin aria-hidden="true" />
                {coordinates ? <><span>{formatCoordinate(coordinates.latitude, 'N', 'S')}</span><span>{formatCoordinate(coordinates.longitude, 'E', 'W')}</span></> : <span>AWAITING GPS FIX</span>}
              </div>
              <div className="geo-zoom-controls" aria-label="Map radius controls">
                <button type="button" aria-label="Zoom in, decrease radius" disabled={!coordinates || view !== 'local' || radiusMiles <= 1} onClick={() => setRadiusMiles(Math.max(1, Math.round(radiusMiles / 2)))}><ChevronUp aria-hidden="true" /></button>
                <span>{view === 'local' && coordinates ? `${radiusMiles} MI` : 'WORLD'}</span>
                <button type="button" aria-label="Zoom out, increase radius" disabled={!coordinates || view !== 'local' || radiusMiles >= 100} onClick={() => setRadiusMiles(Math.min(100, radiusMiles * 2))}><ChevronDown aria-hidden="true" /></button>
              </div>
            </div>
          </div>

          <div className="geo-diagnostics-grid" aria-label="Diagnostic status">
            <DiagnosticValue label="NETWORK LINK" value={browserOnline === null ? 'CHECKING' : browserOnline ? 'ONLINE' : 'OFFLINE'} detail="Reachability only · no subnet scan" icon={Wifi} />
            <DiagnosticValue label="RADAR CONTACTS" value={String(beacons.length).padStart(2, '0')} detail="Your fix + saved IP dossiers" icon={Radar} />
            <DiagnosticValue label="PAIRED DEVICES" value={`${devices.length} / ${liveDevices} LIVE`} detail="Consent-based Bluetooth only" icon={Bluetooth} />
            <DiagnosticValue label="IP DOSSIERS" value={String(dossiers.length).padStart(2, '0')} detail="Saved to your account" icon={Activity} />
          </div>
          <p className={`geo-scan-message${scanState === 'error' ? ' is-error' : ''}`} role="status"><LockKeyhole aria-hidden="true" />{scanMessage}</p>
        </div>

        <aside className="geo-side-deck" aria-label="Live contacts">
          <div className="geo-side-heading"><span className="geo-micro-label">LIVE CONTACTS</span><span className="geo-ring-index">{view === 'local' && coordinates ? `R / ${String(radiusMiles).padStart(3, '0')}` : 'GLOBAL'}</span></div>
          <ul className="radar-contact-list">
            {beacons.length ? beacons.map((beacon) => (
              <li key={beacon.id}>
                <button type="button" className={beacon.id === selectedBeaconId ? 'is-current' : ''} onClick={() => selectBeacon(beacon)}>
                  <span className={`geo-light radar-light-${beacon.kind}`} />
                  <span>{beacon.kind === 'operator' ? 'OPERATOR FIX' : beacon.label}</span>
                  <strong>{beacon.kind === 'operator' ? 'GPS' : 'IP'}</strong>
                </button>
              </li>
            )) : <li className="radar-contact-empty">No contacts yet. Lock your GPS fix or save an IP dossier to plot it.</li>}
          </ul>
          <div className="radar-last-ping" aria-live="off">
            <span className="geo-micro-label">LAST SWEEP RETURN</span>
            <strong>{lastPing ? lastPing.label : 'NO RETURNS'}</strong>
            <small>{lastPing ? lastPing.time : 'Sweep only pings real contacts'}</small>
          </div>
          <div className="geo-privacy-card"><ShieldCheck aria-hidden="true" /><div><strong>FIRST-PARTY BOUNDARY</strong><p>Your coordinates and command history stay in this tab&apos;s session cache. IP dossiers are saved to your account with owner-only access.</p><small>Same-origin scripts and browser extensions may access page storage.</small></div></div>
        </aside>
      </div>

      <form className="geo-cli" onSubmit={submitCommand} aria-label="Tactical diagnostic command line">
        <span className="geo-cli-prefix"><Terminal aria-hidden="true" /> AGAMOSS<span> $</span></span>
        <label className="sr-only" htmlFor="geo-command-input">Enter a supported diagnostic command</label>
        <input id="geo-command-input" value={command} onChange={(event) => setCommand(event.target.value)} onKeyDown={handleCommandKeyDown} autoComplete="off" spellCheck={false} placeholder="sec --radius 100  ·  radar --global  ·  beacons --list" />
        <button type="submit" aria-label="Run diagnostic command"><Command aria-hidden="true" /> EXECUTE</button>
      </form>

      <div className="geo-command-foot"><span><ShieldAlert aria-hidden="true" /> PASSIVE & CONSENT-BASED · NO PACKET INJECTION · NO PORT SCANS · NO INTERCEPTION</span><span>SESSION LOG / {String(logs.length).padStart(2, '0')}</span></div>

      {panel && (
        <div className="geo-slideout-backdrop" onClick={() => setPanel(null)}>
          <aside className="geo-slideout" onClick={(event) => event.stopPropagation()} aria-label={panelTitles[panel]}>
            <div className="geo-slideout-heading"><div><span className="geo-micro-label">SYSTEM NODE / {panelIndex[panel]}</span><h3>{panelTitles[panel]}</h3></div><button type="button" onClick={() => setPanel(null)} aria-label="Close system panel"><X aria-hidden="true" /></button></div>

            {panel === 'beacon' && (
              <div className="geo-slideout-body">
                {selectedBeacon ? (
                  <>
                    <div className="beacon-headline"><span className={`geo-light radar-light-${selectedBeacon.kind}`} /><div><strong>{selectedBeacon.kind === 'operator' ? 'OPERATOR FIX' : selectedDossier?.ip ?? selectedBeacon.label}</strong><small>{selectedBeacon.source}</small></div></div>
                    {selectedDossier ? (
                      <>
                        <DossierFacts dossier={selectedDossier} />
                        {selectedDossier.notes && <div className="beacon-notes"><span className="geo-micro-label">ANALYST NOTES</span><p>{selectedDossier.notes}</p></div>}
                        <DossierActions dossier={selectedDossier} />
                        {onOpenDossier && <button type="button" className="beacon-open-desk" onClick={() => { onOpenDossier(selectedDossier.id); setPanel(null) }}>OPEN IN DOSSIER DESK</button>}
                        <p className="geo-small-disclaimer">{selectedDossier.report.accuracyNote}</p>
                      </>
                    ) : (
                      <dl className="dossier-facts">{selectedBeacon.details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
                    )}
                  </>
                ) : <p className="geo-small-disclaimer">This contact is no longer on the radar.</p>}
              </div>
            )}

            {panel === 'network' && <div className="geo-slideout-body"><div className="geo-honesty-note"><Network aria-hidden="true" /><p>Browser security boundaries prevent this page from reading gateway routes, MAC addresses, SSIDs, encryption, or local device posture.</p></div><DiagnosticValue label="LINK STATE" value={browserOnline === null ? 'CHECKING' : browserOnline ? 'ONLINE' : 'OFFLINE'} detail="navigator.onLine only" icon={Signal} /><DiagnosticValue label="SUBNET / ROUTES" value="UNAVAILABLE" detail="No interface or packet inspection performed" icon={Network} /><DiagnosticValue label="WI-FI POSTURE" value="UNAVAILABLE" detail="No SSID, BSSID, or encryption status exposed" icon={ShieldCheck} /><CommandHistory logs={logs.filter((entry) => entry.command.startsWith('scan ') || entry.command.startsWith('wifi '))} /></div>}

            {panel === 'rf' && <DeviceRecovery devices={devices} onChange={setDevices} />}

            {panel === 'registry' && (
              <div className="geo-slideout-body">
                <div className="geo-registry-table" role="table" aria-label="Radar contact registry">
                  <div className="geo-registry-row geo-registry-header" role="row"><span role="columnheader">CONTACT</span><span role="columnheader">TYPE</span><span role="columnheader">SOURCE</span></div>
                  {beacons.length ? beacons.map((beacon) => (
                    <button type="button" className="geo-registry-row radar-registry-button" role="row" key={beacon.id} onClick={() => selectBeacon(beacon)}>
                      <span role="cell">{beacon.kind === 'operator' ? 'Operator fix' : beacon.label}</span><span role="cell">{beacon.kind === 'operator' ? 'GPS' : 'IP'}</span><span role="cell">{beacon.kind === 'operator' ? 'Browser' : 'Dossier'}</span>
                    </button>
                  )) : <div className="geo-registry-row" role="row"><span role="cell">No contacts</span><span role="cell">—</span><span role="cell">—</span></div>}
                  {devices.map((device) => <div className="geo-registry-row" role="row" key={device.id}><span role="cell">{device.name}</span><span role="cell">BLUETOOTH</span><span role="cell">Paired by you</span></div>)}
                </div>
                <div className="geo-honesty-note"><Database aria-hidden="true" /><p>No regional crime or incident feed is connected, so no public incidents are listed. Nothing here is inferred or fabricated.</p></div>
              </div>
            )}

            {panel === 'terminal' && <div className="geo-slideout-body"><div className="geo-honesty-note"><Terminal aria-hidden="true" /><p>Local command interpreter. It does not open a shell, inspect other devices, or send network probes.</p></div><div className="geo-command-reference"><span>sec --radius [1–100]</span><p>Draws a geodesic radius around your GPS fix.</p><span>radar --global / --local</span><p>Switch between the world plot and your local grid.</p><span>beacons --list</span><p>Lists every real contact on the radar.</p><span>scan --local-net</span><p>Reports browser limitation; sends no packets.</p><span>wifi --verify</span><p>Reports navigator.onLine only.</p></div><CommandHistory logs={logs} /></div>}
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
