import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const revalidate = 300
const DIRECTORY_URL = 'https://www.vpngate.net/api/iphone/'

type Server = { ip: string; country: string; countryCode: string; score: number; ping: number; speed: number; sessions: number; config?: string }

function parseDirectory(csv: string): Server[] {
  const rows = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line && !line.startsWith('*') && !line.startsWith('#'))
  const headerIndex = rows.findIndex((line) => line.startsWith('HostName,IP,Score,'))
  if (headerIndex < 0) throw new Error('VPN Gate directory format is unavailable')
  return rows.slice(headerIndex + 1).map((line) => {
    const fields = line.split(',')
    if (fields.length < 15) return null
    const [host, ip, score, ping, speed, country, countryCode, sessions, , , , , , , config] = fields
    if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip)) return null
    return { ip, country, countryCode, score: Number(score) || 0, ping: Number(ping) || 0, speed: Number(speed) || 0, sessions: Number(sessions) || 0, config }
  }).filter((server): server is Server => Boolean(server?.ip && server.country && server.config))
}

export async function GET() {
  try {
    const response = await fetch(DIRECTORY_URL, { headers: { 'User-Agent': 'RJ-FM-VPN-Directory/1.0' }, next: { revalidate: 300 }, signal: AbortSignal.timeout(12000) })
    if (!response.ok) throw new Error(`VPN Gate returned HTTP ${response.status}`)
    const servers = parseDirectory(await response.text()).map(({ config, ...server }) => server)
    return NextResponse.json({ servers, updatedAt: new Date().toISOString(), source: 'VPN Gate public volunteer relays' }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=300' } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load VPN Gate servers' }, { status: 502 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { ip?: string }
    if (!body.ip || !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(body.ip)) return NextResponse.json({ error: 'Invalid server IP' }, { status: 400 })
    const response = await fetch(DIRECTORY_URL, { headers: { 'User-Agent': 'RJ-FM-VPN-Directory/1.0' }, signal: AbortSignal.timeout(12000) })
    if (!response.ok) throw new Error(`VPN Gate returned HTTP ${response.status}`)
    const server = parseDirectory(await response.text()).find((item) => item.ip === body.ip)
    if (!server?.config) return NextResponse.json({ error: 'Server is no longer listed. Refresh the server list.' }, { status: 404 })
    const config = Buffer.from(server.config, 'base64').toString('utf8')
    if (!config.includes('client') || !config.includes('remote ')) return NextResponse.json({ error: 'Invalid OpenVPN profile received' }, { status: 502 })
    return new Response(config, { headers: { 'Content-Type': 'application/x-openvpn-profile', 'Content-Disposition': `attachment; filename="rjfm-${server.ip.replaceAll('.', '-')}.ovpn"`, 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to download VPN profile' }, { status: 502 })
  }
}
