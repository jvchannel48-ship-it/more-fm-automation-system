import type { Metadata } from 'next'
import { RjFmEmbedPlayer } from '@/components/station/rjfm-embed-player'

export const metadata: Metadata = {
  title: 'RJ FM 93.5 Embed Player',
  description: 'Listen to RJ FM 93.5 with this compact embeddable radio player.',
}

export default function RjFmEmbedPage() {
  return (
    <main className="min-h-screen bg-[#080b12] p-2">
      <RjFmEmbedPlayer />
    </main>
  )
}
