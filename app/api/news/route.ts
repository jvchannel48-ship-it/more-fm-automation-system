import { NextResponse } from 'next/server'
export const dynamic='force-dynamic'
function decode(s:string){return s.replace(/<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>/g,'$1').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#(\\d+);/g,(_,n)=>String.fromCharCode(Number(n)))}
function strip(s:string){return decode(s).replace(/<script[\\s\\S]*?<\\/script>/gi,'').replace(/<style[\\s\\S]*?<\\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/\\s+/g,' ').trim()}
function tag(item:string,name:string){const re=new RegExp('<'+name+'(?:\\\\s[^>]*)?>([\\s\\S]*?)</'+name+'>','i');const m=item.match(re);return m?decode(m[1].trim()):''}
function extractImage(item:string){const candidates=[item.match(/<media:content[^>]+url=["']([^"']+)["']/i)?.[1],item.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i)?.[1],item.match(/<enclosure[^>]+url=["']([^"']+)["']/i)?.[1],item.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1]];return candidates.find(x=>x&&/^https?:\\/\\//i.test(x))}
async function fallback(){
 const r=await fetch('https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en',{cache:'no-store',signal:AbortSignal.timeout(12000)})
 if(!r.ok)throw new Error('RSS unavailable')
 const xml=await r.text()
 const results=xml.split(/<item\\s*>/i).slice(1).map(part=>{const item=part.split(/<\\/item>/i)[0]||'';const source=tag(item,'source');const desc=tag(item,'description');return {title:strip(tag(item,'title')),description:strip(desc),image_url:extractImage(item)||extractImage(desc),link:tag(item,'link'),pubDate:tag(item,'pubDate'),source_id:strip(source)||'Google News'}}).filter(x=>x.title&&x.link).slice(0,30)
 if(!results.length)throw new Error('No RSS articles found')
 return results
}
export async function GET(){
 try{
  const url='https://newsdata.io/api/1/latest?apikey=pub_4b1ec47b99fd4f8a9be3475f69e0f979&language=en'
  const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(12000)})
  const data=await response.json()
  if(response.ok&&data.status!=='error'&&Array.isArray(data.results)&&data.results.length){const results=data.results.map((a:any)=>({title:strip(a.title||''),description:strip(a.description||a.content||''),image_url:a.image_url||a.image||null,creator:a.creator,source_id:a.source_id||a.source_name,link:a.link,pubDate:a.pubDate})).filter((a:any)=>a.title&&a.link);return NextResponse.json({results},{headers:{'Cache-Control':'no-store'}})}
  return NextResponse.json({results:await fallback()},{headers:{'Cache-Control':'no-store'}})
 }catch{
  try{return NextResponse.json({results:await fallback()},{headers:{'Cache-Control':'no-store'}})}catch{return NextResponse.json({error:'News service temporarily unavailable. Please refresh.'},{status:502,headers:{'Cache-Control':'no-store'}})}
 }
}
