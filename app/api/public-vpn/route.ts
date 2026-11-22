import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const DIRECTORY_URL = 'https://proxyfreeonly.com/api/free-vpn-list?limit=500&page=1&sortBy=lastChecked&sortType=desc'
const VPN_GATE_URL = 'https://www.vpngate.net/api/iphone/'

function isIPv4(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const parts = value.split('.')
  return parts.length === 4 && parts.every((part) => /^\\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255)
}

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

async function getVpnGateProfile(ip: string) {
  const response = await fetch(VPN_GATE_URL, {
    cache: 'no-store',
    headers: { 'User-Agent': 'RJFM-Public-Server-Directory/1.0' },
    signal: AbortSignal.timeout(12000),
  })
  if (!response.ok) throw new Error('VPN Gate profile directory unavailable')
  const lines = (await response.text()).split(/\\r?\\n/).filter((line) => line && !line.startsWith('*'))
  const headerIndex = lines.findIndex((line) => line.startsWith('HostName,'))
  if (headerIndex < 0) throw new Error('Invalid VPN Gate directory response')
  const headers = parseCsvLine(lines[headerIndex])
  const row = lines.slice(headerIndex + 1).map(parseCsvLine).map((cells) => {
    const item: Record<string, string> = {}
    headers.forEach((header, index) => { item[header] = cells[index] ?? '' })
    return item
  }).find((item) => item.IP === ip && item.OpenVPN_ConfigData_Base64)
  if (!row) return null
  const config = Buffer.from(row.OpenVPN_ConfigData_Base64, 'base64').toString('utf8')
  return config.includes('client') && config.includes('remote ') ? config : null
}

export async function GET(request: NextRequest) {
  try {
    const ip = request.nextUrl.searchParams.get('ip')
    if (ip) {
      if (!isIPv4(ip)) return NextResponse.json({ error: 'Invalid server IP address.' }, { status: 400 })
      const config = await getVpnGateProfile(ip)
      if (!config) {
        return NextResponse.json({
          error: 'Nakalista ang server sa ProxyFreeOnly, pero walang katugmang downloadable OpenVPN profile sa VPN Gate. Hindi kami gagawa ng profile na walang tunay na configuration.',
        }, { status: 404 })
      }
      return new NextResponse(config, {
        headers: {
          'Content-Type': 'application/x-openvpn-profile',
          'Content-Disposition': `attachment; filename="rjfm-${ip.replace(/[^0-9.]/g, '-')}.ovpn"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    const response = await fetch(DIRECTORY_URL, {
      cache: 'no-store',
      headers: { Accept: 'application/json', 'User-Agent': 'RJFM-MSIC-Public-VPN/1.0' },
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) throw new Error(`ProxyFreeOnly returned HTTP ${response.status}`)
    const payload: unknown = await response.json()
    const sourceRows = Array.isArray(payload)
      ? payload
      : payload && typeof payload === 'object' && Array.isArray((payload as { servers?: unknown }).servers)
        ? (payload as { servers: unknown[] }).servers
        : []
    if (!sourceRows.length) throw new Error('ProxyFreeOnly returned an empty or unsupported server list')

    const seen = new Set<string>()
    const servers = sourceRows.flatMap((value) => {
      if (!value || typeof value !== 'object') return []
      const row = value as Record<string, unknown>
      const ipValue = row.__0 ?? row.ip ?? row.IP ?? row.host
      const ip = isIPv4(ipValue) ? ipValue : ''
      const hostValue = row.vpn_servers ?? row.name ?? row.server ?? ip
      const countryValue = row.__4 ?? row.countryCode ?? row.country ?? ''
      if (!ip || seen.has(ip)) return []
      seen.add(ip)
      const countryCode = typeof countryValue === 'string' ? countryValue.toUpperCase().slice(0, 2) : ''
      return [{
        ip,
        host: typeof hostValue === 'string' ? hostValue : ip,
        country: countryCode || 'Unknown',
        countryCode,
        ping: null,
        speed: 0,
        sessions: 0,
        score: 0,
      }]
    })

    return NextResponse.json({
      servers,
      updatedAt: new Date().toISOString(),
      source: 'ProxyFreeOnly public VPN list',
      profileSource: 'VPN Gate (matching IP only)',
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[rjfm] public VPN directory failed', error)
    return NextResponse.json({ error: 'Hindi makuha ang ProxyFreeOnly VPN list sa ngayon. Subukang i-refresh mamaya.' }, { status: 502 })
  }
}
