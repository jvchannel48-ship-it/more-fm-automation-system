'use client'
import Link from 'next/link'
import {Home,Info,Music2,Lightbulb} from 'lucide-react'
import {AdminMenu} from './admin-menu'
export function BottomNav(){return <><nav className="fixed bottom-0 inset-x-0 z-40 border-t border-white/10 bg-black/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"><div className="mx-auto grid max-w-3xl grid-cols-4 items-center px-2 py-2 text-xs"><Link href="/" className="flex flex-col items-center gap-1 py-1"><Home className="size-5"/>Home</Link><Link href="/midioke" className="flex flex-col items-center gap-1 py-1"><Music2 className="size-5"/>MidiOke</Link><Link href="/daily-trivia" className="flex flex-col items-center gap-1 py-1"><Lightbulb className="size-5"/>Daily Trivia</Link><Link href="/info" className="flex flex-col items-center gap-1 py-1"><Info className="size-5"/>Info</Link></div></nav><div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-3 z-50"><AdminMenu/></div></>}
