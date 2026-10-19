'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { Camera, CheckCircle2, LoaderCircle, ScanBarcode, Upload, X } from 'lucide-react'

type InvestigatorResult = { analysis: string; barcode?: string; saved: boolean }

export function AugiInvestigator() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [image, setImage] = useState('')
  const [barcode, setBarcode] = useState('')
  const [result, setResult] = useState<InvestigatorResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function loadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => setImage(typeof reader.result === 'string' ? reader.result : '')
    reader.readAsDataURL(file)
    setResult(null)
    setError('')
  }

  async function analyze() {
    if (!image || busy) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/investigate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image, barcode }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Investigation failed.')
      setResult(payload)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Investigation failed.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="investigator-panel" aria-labelledby="investigator-title">
    <div className="investigator-header"><div><span className="workspace-micro-label"><Camera aria-hidden="true" /> VISUAL EVIDENCE LAB</span><h2 id="investigator-title">Capture. Inspect. Preserve.</h2><p>Give AUGI a frame, label, package, device, or document. It will separate visible facts from uncertainty and retain the field report.</p></div><span className="investigator-status"><span className="status-pulse" /> CAMERA READY</span></div>
    <div className="investigator-grid">
      <div className="capture-stage">
        {image ? <><img src={image} alt="Evidence capture preview" /><button className="capture-clear" type="button" onClick={() => { setImage(''); setResult(null) }} aria-label="Remove evidence capture"><X aria-hidden="true" /></button></> : <button className="capture-empty" type="button" onClick={() => inputRef.current?.click()}><Upload aria-hidden="true" /><strong>CAPTURE OR UPLOAD EVIDENCE</strong><span>Camera access is requested by your browser. Nothing is sent until you analyze it.</span></button>}
        <input ref={inputRef} className="sr-only" type="file" accept="image/*" capture="environment" onChange={loadImage} />
      </div>
      <div className="investigator-controls"><label><span>OPTIONAL BARCODE / SKU</span><div className="barcode-input"><ScanBarcode aria-hidden="true" /><input value={barcode} onChange={(event) => setBarcode(event.target.value.replace(/\D/g, '').slice(0, 14))} inputMode="numeric" placeholder="Scan or enter digits" /></div></label><button className="investigate-button" type="button" disabled={!image || busy} onClick={analyze}>{busy ? <><LoaderCircle className="spin-icon" aria-hidden="true" /> AUGI IS EXAMINING</> : <><Camera aria-hidden="true" /> ANALYZE EVIDENCE</>}</button>{result && <div className="investigator-result"><div className="result-saved"><CheckCircle2 aria-hidden="true" /> RETAINED IN INVESTIGATION LOG</div><p>{result.analysis}</p></div>}{error && <p className="workspace-error" role="alert">{error}</p>}</div>
    </div>
  </section>
}
