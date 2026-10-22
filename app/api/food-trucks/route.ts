import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveRole } from '@/lib/roles'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Food truck tracker API.
 *  GET  ?active=1            public list of trucks currently on the map
 *  POST { action: ... }      operator actions (register, set location) and member comments
 */

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'private, no-store' } })
}

const LICENSE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\-/ ]{2,40}$/

type LocationRow = { latitude: number; longitude: number; place_note: string | null; active: boolean; updated_at: string }
type CommentRow = { id: string; body: string; emoji: string | null; created_at: string }
// PostgREST returns one object (not an array) when the related table is one-to-one.
function firstLocation(value: unknown): LocationRow | null {
  if (Array.isArray(value)) return (value[0] as LocationRow | undefined) ?? null
  return (value as LocationRow | null) ?? null
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const activeOnly = request.nextUrl.searchParams.get('active') !== '0'

  const { data, error } = await supabase
    .from('food_trucks')
    .select('id, business_name, cuisine, description, truck_photo_url, menu_photo_url, verified, food_truck_locations(latitude, longitude, place_note, active, updated_at), food_truck_comments(id, body, emoji, created_at)')
    .eq('verified', true)
    .order('business_name')

  if (error) return jsonError('The food truck tracker is temporarily unavailable.', 502)

  const trucks = (data ?? [])
    .filter((row) => !activeOnly || firstLocation(row.food_truck_locations)?.active)
    .map((row) => {
      const location = firstLocation(row.food_truck_locations) ?? null
      return {
        id: row.id,
        businessName: row.business_name,
        cuisine: row.cuisine,
        description: row.description,
        truckPhotoUrl: row.truck_photo_url,
        menuPhotoUrl: row.menu_photo_url,
        verified: row.verified,
        location: location
          ? { latitude: location.latitude, longitude: location.longitude, placeNote: location.place_note, active: location.active, updatedAt: location.updated_at }
          : null,
        comments: ((row.food_truck_comments as CommentRow[] | null) ?? []).slice(-20).map((comment) => ({
          id: comment.id,
          body: comment.body,
          emoji: comment.emoji,
          createdAt: comment.created_at,
        })),
      }
    })

  return NextResponse.json({ trucks }, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return jsonError('Sign in to register a truck or leave a comment.', 401)

  const body = await request.json().catch(() => null) as null | Record<string, unknown>
  if (!body?.action) return jsonError('An action is required.', 400)

  if (body.action === 'register') {
    const businessName = typeof body.businessName === 'string' ? body.businessName.trim().slice(0, 80) : ''
    const licenseNumber = typeof body.licenseNumber === 'string' ? body.licenseNumber.trim() : ''
    const licenseState = typeof body.licenseState === 'string' ? body.licenseState.trim().toUpperCase().slice(0, 10) : ''
    if (!businessName) return jsonError('Business name is required.', 400)
    if (!LICENSE_PATTERN.test(licenseNumber)) return jsonError('Enter the business license number exactly as printed on the license.', 400)
    if (!licenseState) return jsonError('The issuing state is required.', 400)

    const { data: truck, error } = await supabase
      .from('food_trucks')
      .upsert({
        operator_id: user.id,
        business_name: businessName,
        license_number: licenseNumber,
        license_state: licenseState,
        cuisine: typeof body.cuisine === 'string' ? body.cuisine.trim().slice(0, 60) : null,
        description: typeof body.description === 'string' ? body.description.trim().slice(0, 500) : null,
        truck_photo_url: typeof body.truckPhotoUrl === 'string' && body.truckPhotoUrl.startsWith('https://') ? body.truckPhotoUrl.slice(0, 400) : null,
        menu_photo_url: typeof body.menuPhotoUrl === 'string' && body.menuPhotoUrl.startsWith('https://') ? body.menuPhotoUrl.slice(0, 400) : null,
      }, { onConflict: 'operator_id' })
      .select('id, business_name, verified')
      .single()

    if (error || !truck) return jsonError('The truck profile could not be saved.', 500)
    return NextResponse.json({
      truck: { id: truck.id, businessName: truck.business_name, verified: truck.verified },
      message: truck.verified
        ? 'Profile saved. Your listing is verified.'
        : 'Profile saved. Staff verify business licenses first. Your listing appears on the map once you are approved.',
    })
  }

  if (body.action === 'set_location') {
    const truckId = typeof body.truckId === 'string' ? body.truckId : ''
    const latitude = typeof body.latitude === 'number' ? body.latitude : Number.NaN
    const longitude = typeof body.longitude === 'number' ? body.longitude : Number.NaN
    if (!truckId) return jsonError('Truck id is required.', 400)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 85 || Math.abs(longitude) > 180) {
      return jsonError('A valid latitude and longitude are required.', 400)
    }

    const { data: owned } = await supabase.from('food_trucks').select('id').eq('id', truckId).eq('operator_id', user.id).maybeSingle()
    if (!owned) return jsonError('You can only update the location of your own truck.', 403)

    const { error } = await supabase.from('food_truck_locations').upsert({
      truck_id: truckId,
      latitude,
      longitude,
      place_note: typeof body.placeNote === 'string' ? body.placeNote.trim().slice(0, 120) : null,
      active: body.active !== false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'truck_id' })
    if (error) return jsonError('The location could not be updated.', 500)
    return NextResponse.json({ ok: true, message: body.active !== false ? 'You are live on the public map.' : 'You are hidden from the map.' })
  }

  if (body.action === 'comment') {
    const truckId = typeof body.truckId === 'string' ? body.truckId : ''
    const text = typeof body.body === 'string' ? body.body.trim().slice(0, 400) : ''
    const emoji = typeof body.emoji === 'string' && body.emoji.length <= 4 ? body.emoji : null
    if (!truckId || (!text && !emoji)) return jsonError('A comment or emoji is required.', 400)
    // Strip control characters (except tab/newline/CR) server-side so raw
    // control bytes can never be stored, even from a hand-crafted request.
    const cleanText = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim()
    if (!cleanText && !emoji) return jsonError('The comment has no usable content.', 400)
    const { data: exists } = await supabase.from('food_trucks').select('id').eq('id', truckId).maybeSingle()
    if (!exists) return jsonError('That truck does not exist.', 404)

    const { error } = await supabase.from('food_truck_comments').insert({ truck_id: truckId, author_id: user.id, body: cleanText, emoji })
    if (error) return jsonError('The comment could not be posted.', 500)
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'delete_comment') {
    const commentId = typeof body.commentId === 'string' ? body.commentId : ''
    if (!commentId) return jsonError('Comment id is required.', 400)
    // RLS decides: authors may delete their own comment, staff/owner may
    // moderate any comment. Double-check with the role registry server-side.
    const { data: comment } = await supabase
      .from('food_truck_comments').select('author_id').eq('id', commentId).maybeSingle()
    if (!comment) return jsonError('That comment does not exist.', 404)
    const role = await resolveRole(user.id, user.email)
    if (comment.author_id !== user.id && !role.isAdmin) {
      return jsonError('You can only delete your own comment.', 403)
    }
    const { error } = await supabase.from('food_truck_comments').delete().eq('id', commentId)
    if (error) return jsonError('The comment could not be deleted.', 500)
    return NextResponse.json({ ok: true })
  }

  return jsonError('Unknown action.', 400)
}
