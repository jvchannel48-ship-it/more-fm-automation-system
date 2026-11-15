'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Plus, RefreshCw, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type PlaylistGroup = 'RJ TOP SONGS' | 'RJ PLAYED'
type PlaylistSong = { title: string; artist: string; youtube_id: string; duration_seconds: number; playlist_group: PlaylistGroup; picture: string | null }
type SearchSong = { id: string; title: string; artist: string; duration: string; durationSeconds: number; channel?: string; picture: string }

type PlaylistResponse = { songs?: PlaylistSong[]; results?: SearchSong[]; error?: string }

async function requestPlaylist(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, cache: 'no-store' })
  const result = await response.json().catch(() => ({})) as PlaylistResponse
  if (!response.ok) throw new Error(result.error ?? 'Could not update the songs playlist.')
  return result
}

export function SongsPlaylistManager() {
  const [songs, setSongs] = useState<PlaylistSong[]>([])
  const [results, setResults] = useState<SearchSong[]>([])
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<PlaylistGroup>('RJ TOP SONGS')
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const refreshSongs = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await requestPlaylist('/api/admin/playlist')
      setSongs(result.songs ?? [])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load the songs playlist.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refreshSongs() }, [])

  const search = async (event: FormEvent) => {
    event.preventDefault()
    const cleanQuery = query.trim()
    if (cleanQuery.length < 2) return
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const result = await requestPlaylist(`/api/admin/playlist?q=${encodeURIComponent(cleanQuery)}`)
      setResults(result.results ?? [])
      if ((result.results ?? []).length === 0) setMessage('No suitable YouTube songs found. Try the title and artist together.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'YouTube search failed.')
    } finally {
      setLoading(false)
    }
  }

  const addSong = async (song: SearchSong) => {
    setBusyId(song.id)
    setError('')
    setMessage('')
    try {
      await requestPlaylist('/api/admin/playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: song.title, artist: song.artist, youtubeId: song.id, durationSeconds: song.durationSeconds, playlistGroup: group, picture: song.picture }),
      })
      await refreshSongs()
      setMessage(`${song.title} added to ${group}.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not add the song.')
    } finally {
      setBusyId(null)
    }
  }

  const removeSong = async (song: PlaylistSong) => {
    setBusyId(song.youtube_id)
    setError('')
    try {
      await requestPlaylist('/api/admin/playlist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeId: song.youtube_id }),
      })
      setSongs((current) => current.filter((item) => item.youtube_id !== song.youtube_id))
      setMessage(`${song.title} removed from the active playlist.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not remove the song.')
    } finally {
      setBusyId(null)
    }
  }

  return <section className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
    <div className="flex items-start justify-between gap-3">
      <div><Label>Songs Playlist</Label><p className="mt-1 text-xs text-muted-foreground">Search updated YouTube songs server-side without a YouTube API key, then add them to the station catalog.</p></div>
      <Button type="button" variant="ghost" size="sm" disabled={loading} onClick={() => void refreshSongs()}><RefreshCw className={loading ? 'size-3.5 animate-spin' : 'size-3.5'} aria-hidden="true" /> Refresh</Button>
    </div>
    <form onSubmit={search} className="flex gap-2">
      <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title and artist" aria-label="Search YouTube songs" maxLength={120} />
      <Button type="submit" variant="secondary" disabled={loading || query.trim().length < 2}><Search aria-hidden="true" /> Search</Button>
    </form>
    <div className="flex items-center gap-2">
      <Label htmlFor="playlist-group" className="shrink-0 text-xs">Add to</Label>
      <select id="playlist-group" value={group} onChange={(event) => setGroup(event.target.value as PlaylistGroup)} className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring">
        <option value="RJ TOP SONGS">RJ TOP SONGS</option>
        <option value="RJ PLAYED">RJ PLAYED</option>
      </select>
    </div>
    {error && <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">{error}</p>}
    {message && <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300" role="status">{message}</p>}
    {results.length > 0 && <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border border-border/70 p-2">
      {results.map((song) => <div key={song.id} className="flex items-center gap-2 rounded-md bg-background/45 p-2">
        <img src={song.picture} alt="" className="size-10 shrink-0 rounded object-cover" loading="lazy" />
        <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{song.title}</p><p className="truncate text-[11px] text-muted-foreground">{song.artist} · {song.duration}{song.channel ? ` · ${song.channel}` : ''}</p></div>
        <Button type="button" size="sm" disabled={busyId === song.id} onClick={() => void addSong(song)}><Plus aria-hidden="true" /> Add</Button>
      </div>)}
    </div>}
    <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border border-border/70 p-2">
      <p className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Active playlist · {songs.length}</p>
      {songs.length > 0 ? songs.map((song) => <div key={song.youtube_id} className="flex items-center gap-2 rounded-md px-1 py-1.5 text-xs hover:bg-background/45">
        <div className="min-w-0 flex-1"><p className="truncate font-medium">{song.title}</p><p className="truncate text-[11px] text-muted-foreground">{song.artist} · {song.playlist_group}</p></div>
        <Button type="button" variant="ghost" size="icon-xs" aria-label={`Remove ${song.title}`} disabled={busyId === song.youtube_id} onClick={() => void removeSong(song)}><Trash2 aria-hidden="true" /></Button>
      </div>) : <p className="px-1 py-2 text-xs text-muted-foreground">No saved playlist songs yet. Add a result from YouTube search.</p>}
    </div>
  </section>
}
