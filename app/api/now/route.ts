import { NextResponse } from 'next/server'
import { getNowPlaying } from '@/lib/station'
import { getSettings } from '@/lib/storage'
import { getPosts, savePosts } from '@/lib/media-feed'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET() {
  try {
    const data = await getNowPlaying()
    const settings = await getSettings()
    if(settings.autoPost && !data.offAir){
      const now=Date.now(); const track=data.tracks.find(t=>now>=t.startAt && now<t.startAt+t.duration*1000)
      if(track?.uid && track.title && track.artist){
        const original=await getPosts()
        const posts=original.filter(p=>!p.trackUid || Date.now()-new Date(p.createdAt).getTime() < 14*24*60*60*1000)
        const trimmed=posts.length!==original.length
        if(!posts.some(p=>p.trackUid===track.uid)){
          const post={id:track.uid+'ysfmPost',trackUid:track.uid,text:'🎵 Now Playing: '+track.title+' — '+track.artist,createdAt:new Date().toISOString(),reactions:{like:0,love:0,haha:0,wow:0,sad:0,angry:0},userReactions:{}}
          await savePosts([post,...posts])
        } else if(trimmed) {
          await savePosts(posts)
        }
      }
    }
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[morefm] now playing failed', error)
    return NextResponse.json({ error: 'Station unavailable' }, { status: 500 })
  }
}
