'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { Camera, CheckCircle2, LoaderCircle, ScanBarcode, Upload, X } from 'lucide-react'

type InvestigatorResult = { analysis: string; barcode?: string; saved: boolean }

// Phone photos are routinely several MB. Base64 inflates them by a third and the request must also fit the
// host's request-body limit, so frames are downscaled in the browser before upload.
const MAX_EDGE = 1600
const JPEG_QUALITY = 0.82
const KEEP_ORIGINAL_BELOW_BYTES = 1_500_000

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Unreadable image.')))
    reader.onerror = () => reject(reader.error ?? new Error('Unreadable image.'))
    reader.readAsDataURL(file)
  })
}

async function prepareImage(file: File) {
  const original = await readAsDataUrl(file)
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size < KEEP_ORIGINAL_BELOW_BYTES) {
      bitmap.close()
      return original
    }
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) {
      bitmap.close()
      return original
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
  } catch {
    // The browser could not decode the frame for resizing; send it unchanged and let the server validate it.
    return original
  }
}

export function AugiInvestigator() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [image, setImage] = useState('')
  const [barcode, setBarcode] = useState('')
  const [result, setResult] = useState<InvestigatorResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function loadImage(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target
    const file = input.files?.[0]
    // Reset so choosing the same photo again after clearing it still fires a change event.
    input.value = ''
    if (!file) return
    setResult(null)
    setError('')
    if (!file.type.startsWith('image/')) {
      setError('That file is not an image. Choose a photo or screenshot.')
      return
    }
    try {
      setImage(await prepareImage(file))
    } catch {
      setError('That image could not be read. Try capturing it again.')
    }
  }

  async function analyze() {
    if (!image || busy) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/investigate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image, barcode }) })
      // Host-level rejections (for example an oversized body) come back as non-JSON, so parsing must not throw.
      const payload = await response.json().catch(() => null) as (Partial<InvestigatorResult> & { error?: string }) | null
      if (!response.ok) throw new Error(payload?.error || (response.status === 413 ? 'Image is too large. Capture a smaller frame.' : 'Investigation failed.'))
      if (typeof payload?.analysis !== 'string') throw new Error('Investigation failed.')
      setResult({ analysis: payload.analysis, barcode: payload.barcode, saved: payload.saved === true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Investigation failed.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="investigator-panel" aria-labelledby="investigator-title">
    <div className="investigator-header"><div><span className="workspace-micro-label"><Camera aria-hidden="true" /> VISUAL EVIDENCE LAB</span><h2 id="investigator-title">Capture. Inspect. Preserve.</h2><p>Give AUGI a frame, label, package, device, or document. It will separate visible facts from uncertainty and retain the field report.</p></div><span className="investigator-status"><span className="status-pulse" /> CAPTURE READY</span></div>
    <div className="investigator-grid">
      <div className="capture-stage">
        {image ? <><img src={image} alt="Evidence capture preview" /><button className="capture-clear" type="button" onClick={() => { setImage(''); setResult(null) }} aria-label="Remove evidence capture"><X aria-hidden="true" /></button></> : <button className="capture-empty" type="button" onClick={() => inputRef.current?.click()}><Upload aria-hidden="true" /><strong>CAPTURE OR UPLOAD EVIDENCE</strong><span>On a phone this opens your camera; on a computer it opens a file picker. Nothing is sent until you analyze it.</span></button>}
        <input ref={inputRef} className="sr-only" type="file" accept="image/*" capture="environment" onChange={loadImage} />
      </div>
      <div className="investigator-controls"><label><span>OPTIONAL BARCODE / SKU</span><div className="barcode-input"><ScanBarcode aria-hidden="true" /><input value={barcode} onChange={(event) => setBarcode(event.target.value.replace(/\D/g, '').slice(0, 14))} inputMode="numeric" placeholder="Scan or enter digits" /></div></label><button className="investigate-button" type="button" disabled={!image || busy} onClick={analyze}>{busy ? <><LoaderCircle className="spin-icon" aria-hidden="true" /> AUGI IS EXAMINING</> : <><Camera aria-hidden="true" /> ANALYZE EVIDENCE</>}</button>{result && <div className="investigator-result"><div className="result-saved"><CheckCircle2 aria-hidden="true" /> RETAINED IN INVESTIGATION LOG</div><p>{result.analysis}</p></div>}{error && <p className="workspace-error" role="alert">{error}</p>}</div>
    </div>
  </section>
}
