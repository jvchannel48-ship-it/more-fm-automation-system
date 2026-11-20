import { type NextRequest, NextResponse } from 'next/server'
import { enqueueSongRequest } from '@/lib/station'
import { privateJsonHeaders, requireAccount } from '@/lib/account-api'
import { chargeSongRequest, refundSongRequest } from '@/lib/account-store'
import { SONG_REQUEST_CREDIT_COST } from '@/lib/credit-math'
import { parseStationId } from '@/lib/stations'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const { user, response: authResponse } = await requireAccount(request)
  if (authResponse) return authResponse
  const body = (await request.json().catch(() => ({}))) as { title?: unknown; artist?: unknown; station?: unknown }
  const station = parseStationId(body.station)
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const artist = typeof body.artist === 'string' ? body.artist.trim() : ''

  if (!title || !artist) return NextResponse.json({ error: 'Enter both a song title and artist.' }, { status: 400 })
  if (title.length > 120 || artist.length > 120) return NextResponse.json({ error: 'Each field must be 120 characters or fewer.' }, { status: 400 })

  let charged = false
  let creditsRemaining: number | undefined
  try {
    const result = await enqueueSongRequest(title, artist, async () => {
      let creditResult: Awaited<ReturnType<typeof chargeSongRequest>>
      try { creditResult = await chargeSongRequest(user!.id) }
      catch { throw new Error('CREDITS_UNAVAILABLE') }
      creditsRemaining = creditResult.creditsRemaining
      if (!creditResult.accepted) throw new Error('CREDITS_EMPTY')
      charged = creditResult.creditsRemaining !== undefined
    }, station)
    return NextResponse.json({ ...result, station, creditsRemaining }, { status: 202, headers: privateJsonHeaders })
  } catch (error) {
    if (error instanceof Error && error.message === 'CREDITS_EMPTY') {
      const remaining = creditsRemaining ?? 0
      const zeroMessage = "YOUR CREDIT IT'S 0 TRY AGAIN TOMORROW FREE DAILY"
      const lowMessage = `You have ${remaining} credits; ${SONG_REQUEST_CREDIT_COST} are needed per song (${SONG_REQUEST_CREDIT_COST * 2} for 2 songs). Try again tomorrow after your free daily credits reset.`
      return NextResponse.json({ error: remaining <= 0 ? zeroMessage : lowMessage, creditsRemaining: remaining, creditEmpty: true }, { status: 402, headers: privateJsonHeaders })
    }
    if (error instanceof Error && error.message === 'CREDITS_UNAVAILABLE') {
      return NextResponse.json({ error: 'Credits are temporarily unavailable. Please try again later.' }, { status: 503, headers: privateJsonHeaders })
    }
    if (charged) {
      try { await refundSongRequest(user!.id) } catch { console.error('[morefm] credit refund failed after enqueue error') }
    }
    console.error('[morefm] song request failed', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "We couldn't find that song right now. Please try a different title or artist." },
      { status: 422, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
