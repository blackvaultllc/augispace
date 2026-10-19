import { generateText } from 'ai'
import { NextResponse } from 'next/server'
import { getOwnerContext } from '@/lib/supabase/owner'

export const runtime = 'nodejs'

const SYSTEM_PROMPT = `You are AUGI's visual investigation engine. Analyze only the supplied image and optional barcode. Describe visible objects, labels, safety-relevant details, and uncertainty. Never identify a private person, infer sensitive traits, or claim an image proves criminal activity. For products, packages, documents, or devices, explain what can be verified and recommend lawful next steps. Treat every result as an observation, not a conclusion. Return a concise field report with sections: OBSERVATIONS, POSSIBLE IDENTIFIERS, RISKS OR UNCERTAINTIES, NEXT STEPS.`

export async function POST(request: Request) {
  const context = await getOwnerContext()
  if (!context) return NextResponse.json({ error: 'Owner access required.' }, { status: 403 })

  const body = await request.json().catch(() => null) as { image?: unknown; barcode?: unknown } | null
  const image = typeof body?.image === 'string' ? body.image : ''
  const barcode = typeof body?.barcode === 'string' ? body.barcode.trim().slice(0, 80) : ''
  if (!image.startsWith('data:image/')) return NextResponse.json({ error: 'Capture an image before analysis.' }, { status: 400 })
  if (image.length > 6_000_000) return NextResponse.json({ error: 'Image is too large. Capture a smaller frame.' }, { status: 413 })

  let barcodeResult: unknown = null
  if (/^\d{8,14}$/.test(barcode)) {
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`, { signal: AbortSignal.timeout(8_000) }).catch(() => null)
    if (response?.ok) barcodeResult = await response.json().catch(() => null)
  }

  try {
    const result = await generateText({
      model: 'google/gemini-3.8-flash',
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: `Analyze this captured evidence.${barcode ? ` Barcode supplied by operator: ${barcode}. Product lookup: ${JSON.stringify(barcodeResult).slice(0, 3000)}` : ''}` },
          { type: 'image', image },
        ],
      }],
      maxOutputTokens: 900,
      abortSignal: AbortSignal.timeout(30_000),
    })
    const report = result.text.trim().slice(0, 7000)
    const { error: saveError } = await context.supabase.from('investigations').insert({
      id: crypto.randomUUID(),
      user_id: context.user.id,
      domain: barcode ? `capture://barcode/${barcode}` : 'capture://visual-evidence',
      score: 0,
      report: { kind: 'visual-evidence', barcode: barcode || null, barcodeResult, analysis: report },
    })
    if (saveError) return NextResponse.json({ error: 'Analysis completed, but the evidence record could not be saved.' }, { status: 500 })
    return NextResponse.json({ analysis: report, barcode, barcodeResult, saved: true }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('model call failed:', error)
    return NextResponse.json({ error: 'The visual investigation engine is temporarily unavailable.' }, { status: 503 })
  }
}
