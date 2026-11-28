import {NextResponse} from 'next/server'
import {readJson,writeJson} from '@/lib/storage'
const PATH='midioke/ratings.json'
type Ratings={ratings:number[]}
export async function GET(){const r=await readJson<Ratings>(PATH,{ratings:[]});const a=r.ratings||[];return NextResponse.json({count:a.length,average:a.length?a.reduce((x,y)=>x+y,0)/a.length:0,ratings:a},{headers:{'Cache-Control':'no-store'}})}
export async function POST(req:Request){const body=await req.json().catch(()=>null);const score=Number(body?.rating);if(!Number.isInteger(score)||score<1||score>5)return NextResponse.json({error:'Rating must be 1-5 stars'},{status:400});const r=await readJson<Ratings>(PATH,{ratings:[]});r.ratings=[...(r.ratings||[]),score].slice(-10000);await writeJson(PATH,r);const a=r.ratings;return NextResponse.json({count:a.length,average:a.reduce((x,y)=>x+y,0)/a.length})}
