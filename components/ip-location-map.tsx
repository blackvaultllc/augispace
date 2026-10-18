'use client'

import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps'

type Location = { ip: string; city: string | null; region: string | null; country: string | null; latitude: number; longitude: number; source: string }

export function IpLocationMap({ locations }: { locations: Location[] }) {
  if (!locations.length) return null
  return (
    <section className="workspace-location" aria-labelledby="location-title">
      <div className="workspace-section-heading"><div><span className="workspace-micro-label">PUBLIC IP CONTEXT / APPROXIMATE</span><h2 id="location-title">Where the signal resolves</h2></div><span className="workspace-readonly"><span /> NO PRIVATE GPS</span></div>
      <p className="workspace-section-copy">Approximate geolocation of publicly resolved mail infrastructure. This is network context, not a person&apos;s location.</p>
      <div className="location-map-wrap">
        <ComposableMap projection="geoEqualEarth" projectionConfig={{ scale: 145 }} aria-label="Approximate public IP infrastructure locations">
          <Geographies geography="https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json">
            {({ geographies }) => geographies.map((geo) => <Geography key={geo.rsmKey} geography={geo} fill="#13232c" stroke="#35515c" strokeWidth={0.35} />)}
          </Geographies>
          {locations.map((location) => <Marker key={`${location.ip}-${location.latitude}`} coordinates={[location.longitude, location.latitude]}><circle r={5} fill="#8ce8dc" stroke="#071015" strokeWidth={2} /><circle r={10} fill="none" stroke="#8ce8dc" strokeOpacity={0.35} /></Marker>)}
        </ComposableMap>
      </div>
      <div className="location-list">{locations.map((location) => <div key={location.ip}><strong>{location.ip}</strong><span>{[location.city, location.region, location.country].filter(Boolean).join(', ') || 'Approximate region unavailable'}</span></div>)}</div>
      <p className="workspace-disclaimer">Location estimates are supplied by public IP geolocation data and can be inaccurate, proxied, or provider-level. AUGI does not identify individuals.</p>
    </section>
  )
}
