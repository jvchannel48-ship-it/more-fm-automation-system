'use client'
import {useCallback,useEffect,useState} from 'react'
import {RefreshCw,Newspaper,Heart,Copy,Share2,MoreVertical,Download,X,ExternalLink} from 'lucide-react'
type Article={title?:string;description?:string;image_url?:string;creator?:string|string[];source_id?:string;link?:string;pubDate?:string}
function cleanText(value?:string){if(!value)return '';return value.replace(/<\/?(?:ol|ul|li|a|p|div|span|font|br)[^>]*>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/\s+/g,' ').trim()}
export function DiscoverNews(){
 const [items,setItems]=useState<Article[]>([]);const [loading,setLoading]=useState(false);const [error,setError]=useState('')
 const [selected,setSelected]=useState<Article|null>(null);const [menu,setMenu]=useState(false);const [liked,setLiked]=useState<Record<string,boolean>>({})
 const refresh=useCallback(async()=>{
  setLoading(true);setError('')
  try{
   const r=await fetch('/api/news',{cache:'no-store'})
   let d:any
   try{d=await r.json()}catch{throw new Error('Invalid response from news service')}
   if(!r.ok)throw new Error(typeof d?.error==='string'?d.error:'News unavailable')
   if(!Array.isArray(d?.results))throw new Error('News feed format is invalid')
   setItems(d.results.filter((a:any)=>a&&typeof a==='object'&&(a.title||a.link)).slice(0,30))
  }catch(e){setError(e instanceof Error?e.message:'Unable to load news');setItems([])}
  finally{setLoading(false)}
 },[])
 useEffect(()=>{void refresh()},[refresh])
 const key=(a:Article)=>a.link||a.title||''
 const share=async(a:Article)=>{const url=a.link||window.location.href;const text=[a.title,a.description].filter(Boolean).join('\n\n');try{if(navigator.share)await navigator.share({title:a.title||'YS FM News',text,url});else{await navigator.clipboard.writeText(text+'\n'+url);alert('News copied!')}}catch{}}
 const copy=async(a:Article)=>{try{await navigator.clipboard.writeText([a.title,a.description,a.link].filter(Boolean).join('\n\n'));alert('News text copied!')}catch{alert('Copy failed')}}
 const download=async(a:Article)=>{if(!a.image_url)return;try{const r=await fetch(a.image_url);if(!r.ok)throw new Error('Image download unavailable');const blob=await r.blob();const u=URL.createObjectURL(blob);const el=document.createElement('a');el.href=u;el.download='news-image.jpg';document.body.appendChild(el);el.click();el.remove();setTimeout(()=>URL.revokeObjectURL(u),1500)}catch{window.open(a.image_url,'_blank','noopener,noreferrer')}}
 return <section className="mt-6"><div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Newspaper className="size-5 text-primary"/><h2 className="text-xl font-bold">Discover News</h2></div><button onClick={()=>void refresh()} disabled={loading} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm disabled:opacity-50"><RefreshCw className={loading?'size-4 animate-spin':'size-4'}/>Refresh</button></div>
 {error&&<div className="rounded-xl border p-4 text-sm text-muted-foreground"><p>{error}</p><button onClick={()=>void refresh()} className="mt-2 underline">Try again</button></div>}{loading&&!items.length&&<p className="py-6 text-center text-sm text-muted-foreground">Loading news…</p>}
 <div className="flex flex-col gap-4">{items.map((a,i)=><article key={key(a)||i} className="overflow-hidden rounded-2xl border bg-card">
 {a.image_url&&<button onClick={()=>{setSelected(a);setMenu(false)}} className="block w-full text-left"><img src={a.image_url} alt={a.title||'News image'} loading="lazy" className="max-h-64 w-full object-cover" onError={e=>{e.currentTarget.style.display='none'}}/></button>}
 <div className="p-4"><p className="text-xs text-muted-foreground">{Array.isArray(a.creator)?a.creator.join(', '):a.creator||a.source_id||'News'}{a.pubDate?' · '+new Date(a.pubDate).toLocaleString():''}</p><h3 className="mt-2 font-semibold leading-snug">{cleanText(a.title)||'Untitled news article'}</h3>{a.description&&<p className="mt-2 text-sm leading-relaxed text-muted-foreground">{cleanText(a.description)}</p>}
 <div className="mt-4 flex items-center justify-between"><button onClick={()=>setLiked(p=>({...p,[key(a)]:!p[key(a)]}))} aria-label="Like news" className="group flex items-center gap-2 rounded-full border px-3 py-2"><Heart className={liked[key(a)]?'size-5 fill-red-500 text-red-500 transition-transform duration-200 scale-110':'size-5 text-muted-foreground transition-transform group-active:scale-125'}/><span className="text-sm">{liked[key(a)]?'Liked':'Like'}</span></button><div className="flex gap-2"><button onClick={()=>void copy(a)} className="rounded-full border p-2" aria-label="Copy news"><Copy className="size-4"/></button><button onClick={()=>void share(a)} className="rounded-full border p-2" aria-label="Share news"><Share2 className="size-4"/></button></div></div>
 {a.link&&<a href={a.link} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary underline">Read full story <ExternalLink className="size-3"/></a>}</div></article>)}</div>{!loading&&!error&&!items.length&&<p className="text-sm text-muted-foreground">No articles available at the moment.</p>}
 {selected&&<div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/95 p-3" onClick={()=>{setSelected(null);setMenu(false)}}><div className="relative flex max-h-[95vh] w-full max-w-3xl flex-col" onClick={e=>e.stopPropagation()}><div className="flex items-center justify-between p-3 text-white"><button onClick={()=>setSelected(null)} className="rounded-full p-2"><X/></button><button onClick={()=>setMenu(v=>!v)} className="rounded-full p-2" aria-label="Image options"><MoreVertical/></button></div>{selected.image_url&&<img src={selected.image_url} alt={selected.title||'News image'} className="max-h-[75vh] w-full object-contain"/>}{menu&&<div className="absolute right-3 top-14 z-10 overflow-hidden rounded-xl bg-white text-black shadow-2xl"><button onClick={()=>void download(selected)} className="flex items-center gap-3 px-5 py-4"><Download/>Download this image</button></div>}<div className="mt-2 max-h-24 overflow-auto text-white"><p className="font-semibold">{cleanText(selected.title)}</p><p className="text-sm text-white/70">{cleanText(selected.description)}</p></div></div></div>}
 </section>
}
