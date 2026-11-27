'use client'
import {useState} from 'react'
import useSWR from 'swr'
import {Loader2,Pause,Play,Moon,Radio} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {useBroadcast} from '@/hooks/use-broadcast'
import type {NowResponse} from '@/lib/types'
const fetcher=(url:string)=>fetch(url,{cache:'no-store'}).then(r=>r.json() as Promise<NowResponse>)
export function RadioPlayer(){const [playing,setPlaying]=useState(false);const {data,error}=useSWR('/api/now',fetcher,{refreshInterval:playing?8000:15000,keepPreviousData:true,revalidateOnFocus:true});const {buffering,unlock}=useBroadcast(data,playing,0.7);const offAir=data?.offAir??false;const loading=!data&&!error;return <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] inset-x-0 z-30 border-t border-white/10 bg-zinc-900/95 backdrop-blur-xl"><div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5"><div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Radio className="size-6"/></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">YS FM 107.1 · Live Radio</p><p className="truncate text-xs text-muted-foreground">{error?'Unable to connect':loading?'Connecting to station…':offAir?'Currently off air':'Live stream · YOUR HOME OF ROMANTIC MUSIC'}</p></div><Button variant="ghost" size="icon" className="size-12 shrink-0" aria-label={playing?'Pause live radio':'Play live radio'} disabled={offAir||loading||!!error} onClick={()=>{unlock();setPlaying(p=>!p)}}>{loading?<Loader2 className="animate-spin"/>:offAir?<Moon/>:playing&&buffering?<Loader2 className="animate-spin"/>:playing?<Pause className="size-7"/>:<Play className="size-7"/>}</Button></div></div>}
