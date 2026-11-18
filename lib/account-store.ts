import 'server-only'
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import type { PoolClient } from 'pg'
import { getDb } from './db'
import { needsManilaDailyReset, spendCredits, SONG_REQUEST_CREDIT_COST } from './credit-math'

const scrypt = promisify(scryptCallback)
const SESSION_DAYS = 30
export const USER_SESSION_COOKIE = 'morefm_user'
const PASSWORD_BYTES = 64

type AccountSession = { id: string; email: string; display_name: string; avatar_mime: string | null; avatar_data: Buffer | null; daily_credits: number; bonus_credits: number; credit_date: string; updated_at: string }

function passwordIsValid(password: string) { return password.length >= 8 && password.length <= 256 }
async function hashPassword(password: string, saltHex = randomBytes(16).toString('hex')) {
  const key = await scrypt(password, saltHex, PASSWORD_BYTES) as Buffer
  return { salt: saltHex, hash: key.toString('hex') }
}
async function verifyPassword(password: string, salt: string, hash: string) {
  if (!passwordIsValid(password)) return false
  const candidate = await hashPassword(password, salt)
  const a = Buffer.from(candidate.hash, 'hex')
  const b = Buffer.from(hash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}
function tokenDigest(token: string) { return createHash('sha256').update(token).digest('hex') }
function manilaTodaySql() { return "(timezone('Asia/Manila', now()))::date" }

export function normalizeEmail(email: string) { return email.trim().toLowerCase() }
export function isValidEmail(email: string) { return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) }
export function validatePassword(password: string) { return passwordIsValid(password) }

export async function createAccount(emailInput: string, displayNameInput: string, password: string) {
  const email = normalizeEmail(emailInput)
  const displayName = displayNameInput.trim()
  if (!isValidEmail(email)) throw new Error('Enter a valid email address.')
  if (!displayName || displayName.length > 60) throw new Error('Name must be 1–60 characters.')
  if (!passwordIsValid(password)) throw new Error('Password must be 8–256 characters.')
  const credentials = await hashPassword(password)
  const client = await getDb().connect()
  try {
    await client.query('BEGIN')
    const settings = await client.query<{ daily_allowance: number }>('SELECT daily_allowance FROM morefm_credit_settings WHERE id = true FOR SHARE')
    const allowance = settings.rows[0]?.daily_allowance ?? 0
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO morefm_listener_accounts(email, display_name, password_salt, password_ roghash, daily_credits, bonus_credits, credit_date)
       VALUES ($1, $2, $3, $4, $5, 0, ${manilaTodaySql()}) RETURNING id`,
      [email, displayName, credentials.salt, credentials.hash, allowance],
    )
    await client.query('COMMIT')
    const session = await createSession(inserted.rows[0].id)
    return { accountId: inserted.rows[0].id, token: session.token, expiresAt: session.expiresAt }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    if ((error as { code?: string })?.code === '23505') throw new Error('An account with this email already exists.')
    throw error
  } finally { client.release() }
}
