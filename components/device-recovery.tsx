'use client'

import { useEffect, useRef, useState } from 'react'
import { Antenna, BatteryMedium, Bluetooth, ExternalLink, LoaderCircle, Radio, ShieldCheck, Trash2 } from 'lucide-react'

type BluetoothAdvertisement = Event & { rssi?: number; txPower?: number }
type BluetoothCharacteristic = { readValue: () => Promise<DataView> }
type BluetoothService = { getCharacteristic: (name: string) => Promise<BluetoothCharacteristic> }
type BluetoothServer = { connected: boolean; getPrimaryService: (name: string) => Promise<BluetoothService>; disconnect: () => void }
type WebBluetoothDevice = EventTarget & {
  id: string
  name?: string
  gatt?: { connect: () => Promise<BluetoothServer> }
  watchAdvertisements?: (options?: { signal?: AbortSignal }) => Promise<void>
}
type WebBluetooth = {
  getAvailability?: () => Promise<boolean>
  requestDevice: (options: { acceptAllDevices: boolean; optionalServices: string[] }) => Promise<WebBluetoothDevice>
}

export type PairedDevice = {
  id: string
  name: string
  pairedAt: string
  battery: number | null
  manufacturer: string | null
  model: string | null
  serial: string | null
  firmware: string | null
  rssi: number | null
  txPower: number | null
  lastSeen: string | null
  signalSupport: 'live' | 'unsupported' | 'pending'
}

const RECOVERY_NETWORKS = [
  { name: 'Apple Find My', scope: 'AirTags, AirPods, iPhone, Mac — owner account only', href: 'https://www.icloud.com/find' },
  { name: 'Google Find Hub', scope: 'Android phones, earbuds, compatible tags', href: 'https://www.google.com/android/find' },
  { name: 'Samsung SmartThings Find', scope: 'Galaxy devices and SmartTags', href: 'https://smartthingsfind.samsung.com' },
  { name: 'Tile', scope: 'Tile trackers and partner devices', href: 'https://www.tile.com' },
  { name: 'FAA Remote ID', scope: 'Drone broadcast ID rules and receiver guidance', href: 'https://www.faa.gov/uas/getting_started/remote_id' },
  { name: 'OpenDroneID', scope: 'Open-source Remote ID receiver apps (hardware dependent)', href: 'https://github.com/opendroneid' },
]

const decoder = new TextDecoder()

function proximityFor(rssi: number | null) {
  if (rssi === null) return { label: 'NO SIGNAL YET', level: 0 }
  if (rssi >= -55) return { label: 'VERY CLOSE · HOT', level: 4 }
  if (rssi >= -67) return { label: 'NEAR · WARM', level: 3 }
  if (rssi >= -80) return { label: 'IN RANGE · COOL', level: 2 }
  return { label: 'FAINT · COLD', level: 1 }
}

function estimateMeters(rssi: number | null, txPower: number | null) {
  if (rssi === null) return null
  const reference = txPower !== null && txPower < 0 ? txPower : -59
  return Math.pow(10, (reference - rssi) / 20)
}

async function readText(server: BluetoothServer, service: string, characteristic: string) {
  try {
    const value = await (await (await server.getPrimaryService(service)).getCharacteristic(characteristic)).readValue()
    return decoder.decode(value.buffer as ArrayBuffer).replace(/\0/g, '').trim().slice(0, 80) || null
  } catch {
    return null
  }
}

export function DeviceRecovery({ devices, onChange }: { devices: PairedDevice[]; onChange: (update: (current: PairedDevice[]) => PairedDevice[]) => void }) {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const watchers = useRef(new Map<string, AbortController>())

  useEffect(() => {
    setSupported(typeof navigator !== 'undefined' && 'bluetooth' in navigator)
    const active = watchers.current
    return () => active.forEach((controller) => controller.abort())
  }, [])

  function patch(id: string, values: Partial<PairedDevice>) {
    onChange((current) => current.map((device) => (device.id === id ? { ...device, ...values } : device)))
  }

  async function pairDevice() {
    const bluetooth = (navigator as Navigator & { bluetooth?: WebBluetooth }).bluetooth
    if (!bluetooth) return
    setBusy(true)
    setMessage('Choose one of your own devices in the browser picker…')
    try {
      const device = await bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: ['battery_service', 'device_information'] })
      const entry: PairedDevice = {
        id: device.id,
        name: device.name?.slice(0, 60) || 'Unnamed device',
        pairedAt: new Date().toISOString(),
        battery: null, manufacturer: null, model: null, serial: null, firmware: null,
        rssi: null, txPower: null, lastSeen: null,
        signalSupport: device.watchAdvertisements ? 'pending' : 'unsupported',
      }
      onChange((current) => [entry, ...current.filter((item) => item.id !== entry.id)].slice(0, 8))
      setMessage(`${entry.name} authorized. Reading what it chooses to share…`)

      if (device.gatt) {
        try {
          const server = await device.gatt.connect()
          let battery: number | null = null
          try {
            const value = await (await (await server.getPrimaryService('battery_service')).getCharacteristic('battery_level')).readValue()
            battery = value.getUint8(0)
          } catch { /* battery service not exposed by this device */ }
          const [manufacturer, model, serial, firmware] = await Promise.all([
            readText(server, 'device_information', 'manufacturer_name_string'),
            readText(server, 'device_information', 'model_number_string'),
            readText(server, 'device_information', 'serial_number_string'),
            readText(server, 'device_information', 'firmware_revision_string'),
          ])
          patch(entry.id, { battery, manufacturer, model, serial, firmware })
          server.disconnect()
        } catch {
          setMessage(`${entry.name} is paired, but it did not allow a data connection. Signal tracking may still work.`)
        }
      }

      if (device.watchAdvertisements) {
        const controller = new AbortController()
        watchers.current.get(entry.id)?.abort()
        watchers.current.set(entry.id, controller)
        device.addEventListener('advertisementreceived', (event) => {
          const advertisement = event as BluetoothAdvertisement
          patch(entry.id, { rssi: advertisement.rssi ?? null, txPower: advertisement.txPower ?? null, lastSeen: new Date().toISOString(), signalSupport: 'live' })
        }, { signal: controller.signal })
        try {
          await device.watchAdvertisements({ signal: controller.signal })
          setMessage(`Tracking signal strength for ${entry.name}. Walk around — the meter rises as you get closer.`)
        } catch {
          patch(entry.id, { signalSupport: 'unsupported' })
          setMessage('This browser blocked live signal strength. Enable experimental Web Bluetooth features in Chrome to use the hot/cold finder.')
        }
      }
    } catch (caught) {
      const name = caught instanceof DOMException ? caught.name : ''
      setMessage(name === 'NotFoundError' ? 'No device was chosen.' : name === 'SecurityError' ? 'Bluetooth is blocked in this embedded preview. Open the deployed site directly in Chrome or Edge.' : 'Bluetooth pairing failed. Make sure Bluetooth is on and the device is discoverable.')
    } finally {
      setBusy(false)
    }
  }

  function forget(id: string) {
    watchers.current.get(id)?.abort()
    watchers.current.delete(id)
    onChange((current) => current.filter((device) => device.id !== id))
  }

  return (
    <div className="geo-slideout-body">
      <div className="geo-honesty-note"><Antenna aria-hidden="true" /><p>Find devices <strong>you own</strong>. Your browser shows a picker; only the device you choose is shared with this page. Nothing else nearby is scanned, logged, or identified.</p></div>

      <button className="recovery-pair-button" type="button" onClick={pairDevice} disabled={!supported || busy}>
        {busy ? <LoaderCircle className="spin-icon" aria-hidden="true" /> : <Bluetooth aria-hidden="true" />}
        {supported === false ? 'WEB BLUETOOTH UNAVAILABLE' : busy ? 'WAITING FOR PICKER…' : 'PAIR A DEVICE I OWN'}
      </button>
      {supported === false && <p className="geo-small-disclaimer">Web Bluetooth works in Chrome, Edge, and Opera on desktop and Android. Safari and iOS browsers do not support it.</p>}
      {message && <p className="recovery-message" role="status">{message}</p>}

      {devices.length ? devices.map((device) => {
        const proximity = proximityFor(device.rssi)
        const meters = estimateMeters(device.rssi, device.txPower)
        return (
          <article className="recovery-device" key={device.id}>
            <header>
              <div><Bluetooth aria-hidden="true" /><strong>{device.name}</strong></div>
              <button type="button" onClick={() => forget(device.id)} aria-label={`Forget ${device.name}`}><Trash2 aria-hidden="true" /></button>
            </header>
            <div className="recovery-meter" aria-label={`Proximity: ${proximity.label}`}>
              {[1, 2, 3, 4].map((bar) => <span key={bar} className={bar <= proximity.level ? 'is-on' : ''} />)}
              <strong>{device.signalSupport === 'unsupported' ? 'SIGNAL NOT EXPOSED' : proximity.label}</strong>
            </div>
            <dl>
              <div><dt>RSSI</dt><dd>{device.rssi !== null ? `${device.rssi} dBm` : '—'}</dd></div>
              <div><dt>RANGE EST.</dt><dd>{meters !== null ? `≈ ${meters < 10 ? meters.toFixed(1) : Math.round(meters)} m` : '—'}</dd></div>
              <div><dt><BatteryMedium aria-hidden="true" /> BATTERY</dt><dd>{device.battery !== null ? `${device.battery}%` : 'Not shared'}</dd></div>
              <div><dt>MAKER</dt><dd>{device.manufacturer ?? 'Not shared'}</dd></div>
              <div><dt>MODEL</dt><dd>{device.model ?? 'Not shared'}</dd></div>
              <div><dt>SERIAL</dt><dd>{device.serial ?? 'Not shared'}</dd></div>
              <div><dt>FIRMWARE</dt><dd>{device.firmware ?? 'Not shared'}</dd></div>
              <div><dt>LAST HEARD</dt><dd>{device.lastSeen ? new Date(device.lastSeen).toLocaleTimeString() : '—'}</dd></div>
            </dl>
          </article>
        )
      }) : (
        <div className="geo-rf-display"><span className="geo-rf-ring" /><span className="geo-rf-ring" /><span className="geo-rf-ring" /><div><Radio aria-hidden="true" /><strong>NO DEVICES PAIRED</strong><small>CONSENT-BASED · SESSION ONLY</small></div></div>
      )}

      <p className="geo-small-disclaimer">Range is a rough estimate from signal strength and is affected by walls and bodies. Bluetooth cannot give GPS coordinates, so paired devices are plotted at your own location on the radar.</p>

      <section className="recovery-networks" aria-labelledby="recovery-networks-title">
        <span className="geo-micro-label" id="recovery-networks-title">OFFICIAL RECOVERY NETWORKS</span>
        <p>AirTags, pet trackers, and phones report location only to their owner through these networks. Use them for map-level tracking.</p>
        <ul>
          {RECOVERY_NETWORKS.map((network) => (
            <li key={network.name}>
              <a href={network.href} target="_blank" rel="noopener noreferrer"><strong>{network.name}</strong><small>{network.scope}</small><ExternalLink aria-hidden="true" /></a>
            </li>
          ))}
        </ul>
      </section>
      <div className="geo-privacy-card"><ShieldCheck aria-hidden="true" /><div><strong>LEGAL BOUNDARY</strong><p>This array never collects identifiers from devices you have not selected, never intercepts traffic, and never tracks people.</p></div></div>
    </div>
  )
}
