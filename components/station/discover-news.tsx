'use client'
import {useMemo,useState} from 'react'
import {Music,Search,Download,ExternalLink} from 'lucide-react'
type Font={name:string;category:string;description:string;url:string;tags:string}
const fonts:Font[]=[
{name:'MegaSoundFont',category:'General MIDI',description:'MegaSoundFont SF2 variants and download sources.',url:'https://www.google.com/search?q=MegaSoundFont+SF2+download',tags:'mega soundfont'},
{name:'GeneralUser GS',category:'General MIDI',description:'Compact, versatile GM/GS bank.',url:'https://schristiancollins.com/generaluser.php',tags:'gm gs general midi'},
{name:'FluidR3 GM',category:'General MIDI',description:'Classic General MIDI soundfont.',url:'https://www.google.com/search?q=FluidR3+GM+SF2+download',tags:'fluid r3 gm'},
{name:'MuseScore General',category:'General MIDI',description:'Open-license General MIDI library.',url:'https://musescore.org/en/handbook/3/soundfonts-and-sfz-files',tags:'musescore gm general'},
{name:'Arachno SoundFont',category:'General MIDI',description:'Large GM soundbank; check non-commercial licence.',url:'https://www.arachnosoft.com/main/download.php?category=soundfonts',tags:'arachno gm'},
{name:'TimGM6mb',category:'General MIDI',description:'Small full GM bank for lighter devices.',url:'https://www.google.com/search?q=TimGM6mb+SF2+download',tags:'tim gm small'},
{name:'Magic Sound Font 2.0',category:'General MIDI',description:'General MIDI soundfont with broad instrument coverage.',url:'https://www.google.com/search?q=Magic+Sound+Font+2.0+SF2',tags:'magic gm'},
{name:'Timbres of Heaven',category:'General MIDI',description:'Rich GM soundbank; multiple versions available.',url:'https://www.google.com/search?q=Timbres+of+Heaven+4.0+SF2',tags:'timbres heaven gm'},
{name:'Yamaha XG SoundFont',category:'General MIDI',description:'Browse XG-style soundfont conversions.',url:'https://www.google.com/search?q=Yamaha+XG+SF2+soundfont',tags:'yamaha xg'},
{name:'Roland Sound Canvas / SC-55',category:'General MIDI',description:'Community SC-55-style banks; verify licensing.',url:'https://www.google.com/search?q=SC-55+soundfont+SF2',tags:'roland sc55 canvas'},
{name:'GM SoundFonts collection',category:'General MIDI',description:'Explore more GM and GS banks.',url:'https://www.google.com/search?q=free+GM+GS+soundfont+sf2',tags:'gm gs'},
{name:'Upright Piano KW',category:'Piano',description:'Free upright piano SF2.',url:'https://freepats.zenvoid.org/',tags:'piano upright'},
{name:'Salamander Grand Piano',category:'Piano',description:'Detailed sampled grand piano soundfont.',url:'https://freepats.zenvoid.org/Piano/acoustic-grand-piano.html',tags:'piano grand salamander'},
{name:'Steinway Piano SF2',category:'Piano',description:'Browse free Steinway-style piano SF2 banks.',url:'https://www.google.com/search?q=Steinway+piano+SF2+soundfont',tags:'piano steinway'},
{name:'Rhodes Electric Piano',category:'Piano',description:'Browse Rhodes electric piano SF2 options.',url:'https://www.google.com/search?q=Rhodes+electric+piano+SF2',tags:'piano rhodes electric'},
{name:'Wurlitzer Electric Piano',category:'Piano',description:'Browse Wurlitzer-style piano SF2 options.',url:'https://www.google.com/search?q=Wurlitzer+SF2+soundfont',tags:'piano wurli'},
{name:'DX7 Piano',category:'Piano',description:'Browse FM piano SF2 banks.',url:'https://www.google.com/search?q=DX7+piano+SF2',tags:'piano fm dx7'},
{name:'Soundfonts4U',category:'Piano & instruments',description:'Collection of acoustic guitars, pianos, basses and more.',url:'https://www.google.com/search?q=Soundfonts4U+soundfonts',tags:'soundfonts4u guitar piano'},
{name:'Spanish Classical Guitar',category:'Guitar',description:'Free classical nylon guitar soundfont.',url:'https://freepats.zenvoid.org/',tags:'guitar nylon classical'},
{name:'FSBS Electric Guitar Clean',category:'Guitar',description:'Clean electric guitar SF2.',url:'https://freepats.zenvoid.org/',tags:'guitar electric clean'},
{name:'Acoustic Guitar SF2',category:'Guitar',description:'Search free acoustic guitar soundfonts.',url:'https://www.google.com/search?q=acoustic+guitar+SF2+soundfont+free',tags:'guitar acoustic'},
{name:'Bass SoundFonts',category:'Bass',description:'Browse electric, acoustic and synth bass soundfonts.',url:'https://www.google.com/search?q=free+bass+SF2+soundfonts',tags:'bass synth electric'},
{name:'Orchestral Strings',category:'Orchestra',description:'Browse string section and solo strings SF2 banks.',url:'https://www.google.com/search?q=free+orchestral+strings+SF2',tags:'orchestra strings violin cello'},
{name:'VSCO 2 Community',category:'Orchestra',description:'Community orchestral library; check SF2/SFZ formats.',url:'https://www.google.com/search?q=VSCO+2+community+SF2+SFZ',tags:'orchestra'},
{name:'Solo Violin',category:'Orchestra',description:'Browse solo violin SF2 instruments.',url:'https://www.google.com/search?q=free+solo+violin+SF2',tags:'violin strings'},
{name:'Solo Cello',category:'Orchestra',description:'Browse solo cello SF2 instruments.',url:'https://www.google.com/search?q=free+solo+cello+SF2',tags:'cello strings'},
{name:'Brass Section',category:'Brass',description:'Browse trumpets, horns and brass section banks.',url:'https://www.google.com/search?q=free+brass+section+SF2',tags:'brass trumpet'},
{name:'Trumpet',category:'Brass',description:'Browse free trumpet soundfonts.',url:'https://www.google.com/search?q=free+trumpet+SF2',tags:'brass trumpet'},
{name:'Saxophone',category:'Brass & winds',description:'Browse saxophone SF2 instruments.',url:'https://www.google.com/search?q=free+saxophone+SF2',tags:'sax saxophone'},
{name:'Flute',category:'Winds',description:'Browse free flute soundfonts.',url:'https://www.google.com/search?q=free+flute+SF2',tags:'flute wind'},
{name:'Choir Aahs',category:'Choir',description:'Browse choir and vocal pad soundfonts.',url:'https://www.google.com/search?q=choir+aahs+SF2+soundfont',tags:'choir vocal'},
{name:'Mellotron Choir',category:'Choir',description:'Browse mellotron vocal soundfont banks.',url:'https://www.google.com/search?q=mellotron+choir+SF2',tags:'choir mellotron'},
{name:'MuldjordKit',category:'Drums',description:'Acoustic drum soundfont.',url:'https://freepats.zenvoid.org/',tags:'drums kit acoustic'},
{name:'TR-808 Drums',category:'Drums',description:'Browse 808 drum soundfonts.',url:'https://www.google.com/search?q=TR-808+SF2+soundfont',tags:'drums 808'},
{name:'Jazz Drum Kit',category:'Drums',description:'Browse jazz drum soundfonts.',url:'https://www.google.com/search?q=jazz+drum+kit+SF2',tags:'drums jazz'},
{name:'World Instruments',category:'World',description:'Browse ethnic and world instrument SF2 libraries.',url:'https://www.google.com/search?q=world+instruments+SF2+soundfont',tags:'world ethnic'},
{name:'FreePats',category:'Collection',description:'Free samples and instrument libraries.',url:'https://freepats.zenvoid.org/',tags:'collection samples'},
{name:'Musical Artifacts',category:'Collection',description:'Community archive of instruments and soundfont resources.',url:'https://musical-artifacts.com/',tags:'collection archive'},
{name:'ZanderJaz 430+ SF2 collection',category:'Collection',description:'Large categorized collection (licences vary by file).',url:'https://www.google.com/search?q=zanderjaz+soundfonts+downloads',tags:'collection 430 sf2'}
]
export function DiscoverNews(){
 const [query,setQuery]=useState('')
 const [category,setCategory]=useState('All')
 const categories=['All',...Array.from(new Set(fonts.map(f=>f.category)))]
 const results=useMemo(()=>fonts.filter(f=>(category==='All'||f.category===category)&& (f.name+' '+f.description+' '+f.category+' '+f.tags).toLowerCase().includes(query.toLowerCase().trim())),[query,category])
 return <section className="mt-6 rounded-2xl border bg-card p-4 sm:p-5"><header className="mb-4 flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-xl bg-primary/10"><Music className="size-6 text-primary"/></div><div><h2 className="text-xl font-bold">Discover MIDIoke</h2><p className="text-sm text-muted-foreground">{fonts.length} soundfonts & sources · free SF2 browsing</p></div></header><div className="relative mb-3"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search piano, MegaSoundFont, strings, drums..." className="w-full rounded-xl border bg-background py-3 pl-10 pr-3 outline-none focus:ring-2 focus:ring-primary"/></div><div className="mb-4 flex gap-2 overflow-x-auto pb-1">{categories.map(c=><button key={c} onClick={()=>setCategory(c)} className={'whitespace-nowrap rounded-full border px-3 py-1.5 text-sm '+(category===c?'bg-primary text-primary-foreground':'')}>{c}</button>)}</div><p className="mb-3 text-xs text-muted-foreground">Download pages and search sources; check file licenses before use. Links are curated discovery links and may not be direct file downloads.</p><div className="flex flex-col gap-3">{results.map(f=><article key={f.name} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-2"><div><h3 className="font-semibold">{f.name}</h3><p className="text-xs text-muted-foreground">{f.category}</p></div></div><p className="mt-1 text-sm text-muted-foreground">{f.description}</p><a href={f.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium"><Download className="size-4"/>Open download source <ExternalLink className="size-3"/></a></article>)}{!results.length&&<p className="py-5 text-center text-sm text-muted-foreground">No matching soundfonts. Try another search.</p>}</div></section>
}