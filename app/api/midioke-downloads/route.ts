import {NextResponse} from 'next/server'
import {readJson,writeJson} from '@/lib/storage'
const PATH='midioke/download-count.json'
type Counter={total:number}
export async function GET(){const c=await readJson<Counter>(PATH,{total:0});return NextResponse.json(c,{headers:{'Cache-Control':'no-store'}})}
export async function POST(){const c=await readJson<Counter>(PATH,{total:0});c.total=(Number(c.total)||0)+1;await writeJson(PATH,c);return NextResponse.json(c,{headers:{'Cache-Control':'no-store'}})}
