import {NextResponse} from 'next/server'
import {getSettings} from '@/lib/storage'
export async function GET(){const s=await getSettings();return NextResponse.json({enabled:s.screenBannerEnabled??true,banners:s.screenBanners??[]},{headers:{'Cache-Control':'no-store'}})}
