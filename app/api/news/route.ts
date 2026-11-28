import { NextResponse } from 'next/server'
export const dynamic='force-dynamic'
function decode(s:string){return s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')}
function tag(item:string,name:string){const re=new RegExp('<'+name+'[^>]*>([\\s\\S]*?)</'+name+'>','i');const m=item.match(re);return m?decode(m[1].trim()):''}
async function fallback(){
 const r=await fetch('https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en',{cache:'no-store',signal:AbortSignal.timeout(12000)})
 if(!r.ok)throw new Error('RSS unavailable')
 const xml=await r.text()
 const results=xml.split('<item>').slice(1).map(part=>{const item=part.split('</item>')[0]||'';return {title:tag(item,'title'),description:tag(item,'description'),link:tag(item,'link'),pubDate:tag(item,'pubDate'),source_id:tag(item,'source')}}).filter(x=>x.title&&x.link).slice(0,30)
 return results
}
export async function GET(){
 try{
  const url='https://newsdata.io/api/1/latest?apikey=pub_4b1ec47b99fd4f8a9be3475f69e0f979&language=en'
  const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(12000)})
  const data=await response.json()
  if(response.ok&&data.status!=='error'&&Array.isArray(data.results)&&data.results.length)return NextResponse.json({results:data.results},{headers:{'Cache-Control':'no-store'}})
  return NextResponse.json({results:await fallback()},{headers:{'Cache-Control':'no-store'}})
 }catch{
  try{return NextResponse.json({results:await fallback()},{headers:{'Cache-Control':'no-store'}})}catch{return NextResponse.json({error:'News service temporarily unavailable. Please refresh.'},{status:502,headers:{'Cache-Control':'no-store'}})}
 }
}