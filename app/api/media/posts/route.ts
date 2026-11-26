import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'
import { getPosts, savePosts, type Post } from '@/lib/media-feed'
import { put } from '@vercel/blob'
export const dynamic='force-dynamic'
export async function GET(){return NextResponse.json(await getPosts())}
export async function POST(req:Request){
 if(!await isAdmin()) return NextResponse.json({error:'Admin only'}, {status:401})
 try { const form=await req.formData(); const text=String(form.get('text')||'').trim(); const file=form.get('image'); if(!text && !(file instanceof File)) return NextResponse.json({error:'Add text or image'}, {status:400});
 let image:string|undefined; if(file instanceof File && file.size){if(file.size>8*1024*1024)return NextResponse.json({error:'Image max 8MB'}, {status:413}); if(!file.type.startsWith('image/'))return NextResponse.json({error:'Images only'}, {status:400}); const blob=await put('station/media/'+Date.now()+'-'+file.name,file,{access:'private',addRandomSuffix:true}); image=blob.url;}
 const posts=await getPosts(); const p:Post={id:Date.now().toString()+'ysfmPost',text,image,createdAt:new Date().toISOString(),reactions:{like:0,love:0,haha:0,wow:0,sad:0,angry:0},userReactions:{}}; await savePosts([p,...posts]); return NextResponse.json(p,{status:201})
 }catch{return NextResponse.json({error:'Could not save post'}, {status:500})}}
