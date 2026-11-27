'use client'
import {useState} from 'react'
import useSWR from 'swr'
import {Loader2,Pause,Play,Moon} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {useBroadcast} from '@/hooks/use-broadcast'
import type {NowResponse} from '@/lib/types'
const fetcher=(url:string)=>fetch(url,{cache:'no-store'}).then(r=>r.json() as Promise<NowResponse>)
export function RadioPlayer(){const [playing,setPlaying]=useState(false);const {data}=useSWR('/api/now',fetcher,{refreshInterval:playing?8000:30000,keepPreviousData:true});const {buffering,unlock}=useBroadcast(data,playing,0.7);const offAir=data?.offAir??false;const track=data?.tracks?.[0];return <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] inset-x-0 z-30 border-t border-white/10 bg-zinc-900/95 backdrop-blur-xl"><div className="mx-auto flex max-w-3xl items-center gap-3 px-3 py-2"><div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-black text-primary">YS FM</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{offAir?'YS FM · Off Air':track?.title||'YS FM 107.1 Live'}</p><p className="truncate text-xs text-muted-foreground">{track?.artist||'YOUR HOME OF ROMANTIC MUSIC'}</p></div><Button variant="ghost" size="icon" aria-label={playing?'Pause stream':'Play stream'} disabled={offAir} onClick={()=>{unlock();setPlaying(p=>!p)}}>{offAir?<Moon/>:playing&&buffering?<Loader2 className="animate-spin"/>:playing?<Pause/>:<Play/>}</Button></div></div>}
