'use client'
import Link from 'next/link'
import {Home,Radio,Info,Menu} from 'lucide-react'
import {AdminMenu} from './admin-menu'
export function BottomNav(){return <><nav className="fixed bottom-0 inset-x-0 z-40 border-t border-white/10 bg-black/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"><div className="mx-auto grid max-w-3xl grid-cols-3 items-center px-3 py-2 text-xs"><Link href="/" className="flex flex-col items-center gap-1 py-1"><Home className="size-5"/>Home</Link><Link href="/media" className="flex flex-col items-center gap-1 py-1"><Radio className="size-5"/>Media Feed</Link><Link href="/info" className="flex flex-col items-center gap-1 py-1"><Info className="size-5"/>Info</Link></div></nav><div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-3 z-50"><AdminMenu/></div></>}
