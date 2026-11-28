import { type NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'
import { getAdminStatus, refreshQueue } from '@/lib/station'
import { getSettings, SETTINGS_PATH, writeJson } from '@/lib/storage'

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(await getAdminStatus())
}

export async function PUT(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = (await request.json().catch(() => ({}))) as { broadcastEnabled?: unknown; remixMode?: unknown; fullBass?: unknown; autoPost?: unknown; whatsNew?: unknown; screenBannerEnabled?: unknown; screenBanners?: unknown; customArtists?: unknown; cloudflareVerification?: unknown; autoAddArtistNames?: unknown }
  const current = await getSettings()
  const next = {
    broadcastEnabled: typeof body.broadcastEnabled === 'boolean' ? body.broadcastEnabled : current.broadcastEnabled,
    remixMode: typeof body.remixMode === 'boolean' ? body.remixMode : current.remixMode,
    fullBass: typeof body.fullBass === 'boolean' ? body.fullBass : current.fullBass,
    autoPost: typeof body.autoPost === 'boolean' ? body.autoPost : current.autoPost,
    whatsNew: typeof body.whatsNew === 'string' ? body.whatsNew.slice(0, 5000) : current.whatsNew ?? '',
    screenBannerEnabled: typeof body.screenBannerEnabled === 'boolean' ? body.screenBannerEnabled : current.screenBannerEnabled ?? true,
    screenBanners: Array.isArray(body.screenBanners) ? body.screenBanners.filter((v): v is string => typeof v === 'string' && v.startsWith('data:image/')).slice(0,3) : current.screenBanners ?? [],
    customArtists: Array.isArray(body.customArtists) ? body.customArtists.filter((a:any)=>a&&typeof a.name==='string'&&typeof a.genre==='string'&&(a.language==='english'||a.language==='tagalog')).slice(0,100) : current.customArtists ?? [],
    cloudflareVerification: typeof body.cloudflareVerification==='boolean' ? body.cloudflareVerification : current.cloudflareVerification ?? false,\n    autoAddArtistNames: typeof body.autoAddArtistNames==='boolean' ? body.autoAddArtistNames : current.autoAddArtistNames ?? false,
  }
  await writeJson(SETTINGS_PATH, next)
  return NextResponse.json(await getAdminStatus())
}

export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await refreshQueue()
  return NextResponse.json(await getAdminStatus())
}
