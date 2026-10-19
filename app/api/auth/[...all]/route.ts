import { NextResponse } from 'next/server'

function disabled() {
  return NextResponse.json({ error: 'Use Supabase Auth.' }, { status: 410 })
}

export const GET = disabled
export const POST = disabled
