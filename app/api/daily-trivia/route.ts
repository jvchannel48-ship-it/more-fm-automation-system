import {NextRequest,NextResponse} from 'next/server'
import {isAdmin} from '@/lib/auth'
import {readJson,writeJson} from '@/lib/storage'
import type {TriviaPost} from '@/lib/daily-trivia'
const PATH='station/daily-trivia.json'
export async function GET(){const posts=await readJson<TriviaPost[]>(PATH,[]);return NextResponse.json(posts.sort((a,b)=>b.createdAt-a.createdAt))}
export async function POST(req:NextRequest){if(!(await isAdmin()))return NextResponse.json({error:'Unauthorized'},{status:401});const body=await req.json().catch(()=>({})) as {text?:string;image?:string};if(!body.text?.trim()&&!body.image)return NextResponse.json({error:'Add text or an image'},{status:400});const posts=await readJson<TriviaPost[]>(PATH,[]);const post:TriviaPost={id:crypto.randomUUID(),text:(body.text||'').slice(0,5000),image:body.image,createdAt:Date.now(),likes:[],comments:[]};await writeJson(PATH,[post,...posts].slice(0,100));return NextResponse.json(post)}
export async function DELETE(req:NextRequest){if(!(await isAdmin()))return NextResponse.json({error:'Unauthorized'},{status:401});const id=req.nextUrl.searchParams.get('id');const posts=await readJson<TriviaPost[]>(PATH,[]);await writeJson(PATH,posts.filter(p=>p.id!==id));return NextResponse.json({ok:true})}
