'use client'
import {useEffect,useState} from 'react'
import {DiscoverNews} from '@/components/station/discover-news'
import {X} from 'lucide-react'
const PROMO='/midioke-promo.svg'
export default function Home(){
 const [show,setShow]=useState(false)
 useEffect(()=>{setShow(true)},[])
 return <main className="mx-auto min-h-[45vh] max-w-3xl px-4 pt-5 pb-40"><div className="flex items-center gap-3"><img src="/ys-fm-logo.svg" alt="YS FM" className="size-16 rounded-full"/><div><h1 className="text-2xl font-bold">YS FM <span className="text-primary">107.1</span></h1><p className="text-sm text-muted-foreground">YOUR HOME OF ROMANTIC MUSIC</p></div></div><DiscoverNews/>
 {show&&<div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-3" role="dialog" aria-modal="true" aria-label="YS FM and Midioke partnership"><div className="relative max-h-[94vh] w-full max-w-lg overflow-auto rounded-2xl"><button onClick={()=>setShow(false)} aria-label="Close announcement" className="absolute right-2 top-2 z-10 rounded-full bg-black/75 p-2 text-white"><X className="size-6"/></button><img src={PROMO} alt="YS FM x Midioke partnership announcement with APK and remote download options" className="w-full"/></div></div>}
 </main>
}