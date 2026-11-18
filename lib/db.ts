import 'server-only'
import { Pool } from 'pg'

let pool: Pool | null = null

export function getDb() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('Render Postgres is not connected. Set DATABASE_URL to the database Internal URL in the Render web service environment.')
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 8_000,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    })
    pool.on('error', (error) => console.error('[morefm] Postgres pool error', error.message))
  }
  return pool
}
