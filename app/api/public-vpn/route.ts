import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function parseCsvLine(line: string): string[] {
  const values: string[] = []
  let value = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { value += '"'; i++ }
      else quoted = !quoted
    } else if (char === ',' && !quoted) {
      values.push(value); value = ''
    } else value += char
  }
  values.push(value)
  return values
}

async function getRows() {
  const response = await fetch('https://www.vpngate.net/api/iphone/', {
    cache: 'no-store',
    headers: { 'User-Agent': 'RJFM-Public-Server-Directory/1.0' },
    signal: AbortSignal.timeout(12000),
  })
  if (!response.ok) throw new Error('VPN Gate directory unavailable')
  const raw = await response.text()
  const lines = raw.split(/\r?\n/).filter((line) => line && !line.startsWith('*'))
  const headerIndex = lines.findIndex((line) => line.startsWith('HostName,'))
  if (headerIndex < 0) throw new Error('Invalid VPN Gate directory response')
  const headers = parseCsvLine(lines[headerIndex])
  return lines.slice(headerIndex + 1).map(parseCsvLine).map((cells) => {
    const row: Record<string, string> = {}
    headers.forEach((header, index) => { row[header] = cells[index] ?? '' })
    return row
  }).filter((row) => row.IP && row.OpenVPN_ConfigData_Base64)
}

export async function GET(request: NextRequest) {
  try {
    const rows = await getRows()
    const ip = request.nextUrl.searchParams.get('ip')
    if (ip) {
      const row = rows.find((item) => item.IP === ip)
      if (!row) return NextResponse.json({ error: 'Server is no longer listed. Refresh and choose another.' }, { status: 404 })
      const config = Buffer.from(row.OpenVPN_ConfigData_Base64, 'base64').toString('utf8')
      if (!config.includes('client') || !config.includes('remote ')) {
        return NextResponse.json({ error: 'Invalid OpenVPN profile.' }, { status: 502 })
      }
      return new NextResponse(config, {
        headers: {
          'Content-Type': 'application/x-openvpn-profile',
          'Content-Disposition': `attachment; filename="rjfm-${ip.replace(/[^0-9.]/g, '-')}.ovpn"`,
          'Cache-Control': 'no-store',
        },
      })
    }
    const servers = rows
      .map((row) => ({
        ip: row.IP,
        country: row.CountryLong || 'Unknown',
        countryCode: row.CountryShort || '',
        ping: Number(row.Ping) || null,
        speed: Number(row.Speed) || 0,
        sessions: Number(row.NumVpnSessions) || 0,
        score: Number(row.Score) || 0,
        host: row.HostName || row.IP,
      }))
      .sort((a, b) => (b.speed - a.speed) || ((a.ping ?? 999999) - (b.ping ?? 999999)))
      .slice(0, 60)
    return NextResponse.json({ servers, updatedAt: new Date().toISOString(), source: 'VPN Gate public relay directory' }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('[rjfm] public VPN directory failed', error)
    return NextResponse.json({ error: 'Public VPN server list is temporarily unavailable.' }, { status: 502 })
  }
}
