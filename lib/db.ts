import 'server-only'
import { Pool } from 'pg'

let pool: Pool | null = null

/**
 * Prefer the Render Postgres Internal URL (same private network as the web service).
 * Accept a few common env aliases so misnamed keys still connect.
 */
export function getDatabaseUrl(): string | null {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_CONNECTION_STRING,
    process.env.RENDER_DATABASE_URL,
  ]
  for (const value of candidates) {
    const trimmed = value?.trim()
    if (trimmed) return trimmed
  }
  return null
}

export function isDatabaseConfigured() {
  return Boolean(getDatabaseUrl())
}

export function getDb() {
  const connectionString = getDatabaseUrl()
  if (!connectionString) {
    throw new Error(
      'Render Postgres is not connected. Set DATABASE_URL to the database Internal URL in the Render web service environment.',
    )
  }
  if (!pool) {
    // Render managed Postgres requires SSL. Internal URLs still work with rejectUnauthorized:false.
    const useSsl =
      process.env.NODE_ENV === 'production' ||
      /render\.com|amazonaws\.com|sslmode=require/i.test(connectionString)

    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    })
    pool.on('error', (error) => console.error('[morefm] Postgres pool error', error.message))
  }
  return pool
}

/** Lightweight connectivity check for health/admin diagnostics. */
export async function pingDatabase(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isDatabaseConfigured()) {
    return {
      ok: false,
      error: 'DATABASE_URL is missing. Set it to the Internal Database URL from your Render Postgres (mor-naga-db) on the web service.',
    }
  }
  try {
    const result = await getDb().query('SELECT 1 AS ok')
    if (result.rows[0]?.ok !== 1) return { ok: false, error: 'Unexpected database response.' }
    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database connection failed'
    return {
      ok: false,
      error: `${message}. Confirm DATABASE_URL uses the Internal URL and the web service is in the same Render region as the database.`,
    }
  }
}
