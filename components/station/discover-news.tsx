'use client'
import {useMemo,useState} from 'react'
import {Music,Search,Download,ExternalLink} from 'lucide-react'
type Soundfont={name:string;description:string;url:string;tags:string}
const fonts:Soundfont[]=[
{name:'MegaSoundFont',description:'Search for MegaSoundFont SF2 downloads and mirrors.',url:'https://www.google.com/search?q=MegaSoundFont+SF2+free+download',tags:'mega soundfont sf2'},
{name:'GeneralUser GS',description:'Popular General MIDI soundfont; download page and license details.',url:'https://www.google.com/search?q=GeneralUser+GS+SoundFont+SF2+download',tags:'general midi gs'},
{name:'FluidR3 GM',description:'Classic General MIDI soundfont, commonly used for MIDI playback.',url:'https://www.google.com/search?q=FluidR3+GM+SF2+download',tags:'fluid fluidr3 gm'},
{name:'Timbres of Heaven',description:'Search for this free MIDI soundfont and download information.',url:'https://www.google.com/search?q=Timbres+of+Heaven+SF2+download',tags:'timbres heaven'},
{name:'Arachno SoundFont',description:'A well-known GM soundfont; check the official download and terms.',url:'https://www.google.com/search?q=Arachno+SoundFont+SF2+download',tags:'arachno'},
{name:'FreePats',description:'Browse free instrument samples and soundfont resources.',url:'https://freepats.zenvoid.org/',tags:'freepats free samples'},
{name:'Musical Artifacts',description:'Community archive of instruments and soundfont resources.',url:'https://musical-artifacts.com/',tags:'musical artifacts sf2'}
]
export function DiscoverNews(){
 const [query,setQuery]=useState('')
 const results=useMemo(()=>fonts.filter(f=>(f.name+' '+f.description+' '+f.tags).toLowerCase().includes(query.toLowerCase().trim())),[query])
 return <section className="mt-6 rounded-2xl border bg-card p-4 sm:p-5"><header className="mb-4 flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-xl bg-primary/10"><Music className="size-6 text-primary"/></div><div><h2 className="text-xl font-bold">Discover MIDIoke</h2><p className="text-sm text-muted-foreground">Free SF2 soundfonts</p></div></header><div className="relative mb-4"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search soundfonts (e.g. MegaSoundFont)..." className="w-full rounded-xl border bg-background py-3 pl-10 pr-3 outline-none focus:ring-2 focus:ring-primary"/></div><p className="mb-3 text-xs text-muted-foreground">Browse soundfont download pages. Verify each file's license and safety before downloading; these links search or open source pages rather than hosting SF2 files here.</p><div className="flex flex-col gap-3">{results.map(f=><article key={f.name} className="rounded-xl border p-4"><h3 className="font-semibold">{f.name}</h3><p className="mt-1 text-sm text-muted-foreground">{f.description}</p><a href={f.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium"><Download className="size-4"/>Find / download <ExternalLink className="size-3"/></a></article>)}{!results.length&&<p className="py-5 text-center text-sm text-muted-foreground">No matching soundfonts. Try another search.</p>}</div></section>
}