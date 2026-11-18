import { type NextRequest, NextResponse } from 'next/server'
import { enqueueSongRequest } from '@/lib/station'
import { privateJsonHeaders, requireAccount } from '@/lib/account-api'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const { user, client, response: authResponse } = await requireAccount(request.headers.get('authorization'))
  if (authResponse) return authResponse
  const body = (await request.json().catch(() => ({}))) as { title?: unknown; artist?: unknown }
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const artist = typeof body.artist === 'string' ? body.artist.trim() : ''

  if (!title || !artist) return NextResponse.json({ error: 'Enter both a song title and artist.' }, { status: 400 })
  if (title.length > 120 || artist.length > 120) return NextResponse.json({ error: 'Each field must be 120 characters or fewer.' }, { status: 400 })

  let charged = false
  let creditsRemaining: number | undefined
  try {
    const result = await enqueueSongRequest(title, artist, async () => {
      const { data, error } = await client!.rpc('charge_song_request', { p_user_id: user!.id }).maybeSingle()
      if (error || !data) throw new Error('CREDITS_UNAVAILABLE')
      const creditResult = data as { accepted: boolean; credits_remaining: number }
      creditsRemaining = creditResult.credits_remaining
      if (!creditResult.accepted) throw new Error('CREDITS_EMPTY')
      charged = true
    })
    return NextResponse.json({ ...result, creditsRemaining }, { status: 202, headers: privateJsonHeaders })
  } catch (error) {
    if (error instanceof Error && error.message === 'CREDITS_EMPTY') {
      return NextResponse.json({ error: `You have ${creditsRemaining ?? 0} credits; 20 are needed per request. Try again tomorrow after your daily credits reset.`, creditsRemaining: creditsRemaining ?? 0, creditEmpty: true }, { status: 402, headers: privateJsonHeaders })
    }
    if (error instanceof Error && error.message === 'CREDITS_UNAVAILABLE') {
      return NextResponse.json({ error: 'Credits are temporarily unavailable. Please try again later.' }, { status: 503, headers: privateJsonHeaders })
    }
    if (charged) {
      try { await client!.rpc('refund_song_request', { p_user_id: user!.id }) } catch { console.error('[morefm] credit refund failed after enqueue error') }
    }
    console.error('[morefm] song request failed', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "We couldn't find that song right now. Please try a different title or artist." },
      { status: 422, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
