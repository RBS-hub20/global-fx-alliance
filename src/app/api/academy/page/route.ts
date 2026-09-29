import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const path = req.nextUrl.searchParams.get('path')
    if (!path) {
      return NextResponse.json({ error: 'Missing path' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

    if (!supabaseUrl || !serviceKey) {
      console.error('Missing Supabase env')
      return NextResponse.json({ error: 'Server config missing' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)
    const cleanPath = path.replace(/^\/+/, '').trim()

    const { data, error } = await supabase
      .storage
      .from('academy-books')
      .createSignedUrl(cleanPath, 60 * 5)

    if (error) {
      console.error('Signed URL error:', error, 'path:', cleanPath)
      return NextResponse.json({ error: error.message, path: cleanPath }, { status: 500 })
    }

    return NextResponse.json(
      { url: data.signedUrl },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    )
  } catch (e: any) {
    console.error('Academy page error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
