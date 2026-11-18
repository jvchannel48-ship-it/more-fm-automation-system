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
      `INSERT INTO morefm_listener_accounts(email, display_name, password_salt, password_hash, daily_credits, bonus_credits, credit_date)
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

export async function loginAccount(emailInput: string, password: string) {
  const email = normalizeEmail(emailInput)
  if (!isValidEmail(email) || !passwordIsValid(password)) throw new Error('Incorrect email or password.')
  const { rows } = await getDb().query<{ id: string; password_salt: string; password_hash: string }>(
    'SELECT id, password_salt, password_hash FROM morefm_listener_accounts WHERE email = $1', [email],
  )
  const row = rows[0]
  if (!row || !(await verifyPassword(password, row.password_salt, row.password_hash))) throw new Error('Incorrect email or password.')
  const session = await createSession(row.id)
  return { accountId: row.id, token: session.token, expiresAt: session.expiresAt }
}

async function createSession(accountId: string) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  const client = await getDb().connect()
  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM morefm_listener_sessions WHERE expires_at <= now()')
    await client.query('INSERT INTO morefm_listener_sessions(token_hash, account_id, expires_at) VALUES ($1,$2,$3)', [tokenDigest(token), accountId, expiresAt])
    await client.query('COMMIT')
  } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error }
  finally { client.release() }
  return { token, expiresAt }
}

export async function getAccountFromToken(token: string | undefined) {
  if (!token || token.length > 100) return null
  const { rows } = await getDb().query<{ id: string; email: string; display_name: string }>(
    `SELECT a.id, a.email, a.display_name FROM morefm_listener_sessions s
     JOIN morefm_listener_accounts a ON a.id = s.account_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`, [tokenDigest(token)],
  )
  return rows[0] ?? null
}

export async function removeSession(token: string | undefined) {
  if (!token || token.length > 100) return
  await getDb().query('DELETE FROM morefm_listener_sessions WHERE token_hash = $1', [tokenDigest(token)])
}

export async function getProfile(accountId: string) {
  const client = await getDb().connect()
  try {
    await client.query('BEGIN')
    const profile = await refreshDailyCredits(client, accountId)
    await client.query('COMMIT')
    return profile
  } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error }
  finally { client.release() }
}

async function refreshDailyCredits(client: PoolClient, accountId: string) {
  const today = manilaTodaySql()
  const { rows } = await client.query<AccountSession & { daily_allowance: number }>(
    `SELECT a.id, a.email, a.display_name, a.avatar_mime, a.avatar_data, a.daily_credits, a.bonus_credits,
            a.credit_date::text AS credit_date, a.updated_at::text AS updated_at,
            COALESCE(s.daily_allowance,0) AS daily_allowance
     FROM morefm_listener_accounts a CROSS JOIN morefm_credit_settings s
     WHERE a.id = $1 AND s.id = true FOR UPDATE OF a`, [accountId],
  )
  const row = rows[0]
  if (!row) return null
  if (needsManilaDailyReset(row.credit_date, (await client.query<{ today: string }>(`SELECT ${today}::text AS today`)).rows[0].today)) {
    await client.query(`UPDATE morefm_listener_accounts SET daily_credits = $2, credit_date = ${today}, updated_at = now() WHERE id = $1`, [accountId, row.daily_allowance])
    row.daily_credits = row.daily_allowance
  }
  return row
}

export async function chargeSongRequest(accountId: string) {
  const client = await getDb().connect()
  try {
    await client.query('BEGIN')
    const row = await refreshDailyCredits(client, accountId)
    if (!row) throw new Error('Account not found.')
    const spent = spendCredits(row.daily_credits, row.bonus_credits, SONG_REQUEST_CREDIT_COST)
    if (!spent.accepted) {
      await client.query('COMMIT')
      return { accepted: false, creditsRemaining: spent.creditsRemaining }
    }
    await client.query('UPDATE morefm_listener_accounts SET daily_credits = $2, bonus_credits = $3, updated_at = now() WHERE id = $1', [accountId, spent.dailyCredits, spent.bonusCredits])
    await client.query('COMMIT')
    return { accepted: true, creditsRemaining: spent.creditsRemaining }
  } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error }
  finally { client.release() }
}

export async function refundSongRequest(accountId: string) {
  await getDb().query('UPDATE morefm_listener_accounts SET bonus_credits = bonus_credits + $2, updated_at = now() WHERE id = $1', [accountId, SONG_REQUEST_CREDIT_COST])
}

export async function updateDisplayName(accountId: string, nameInput: string) {
  const name = nameInput.trim()
  if (!name || name.length > 60) throw new Error('Name must be 1–60 characters.')
  await getDb().query('UPDATE morefm_listener_accounts SET display_name = $2, updated_at = now() WHERE id = $1', [accountId, name])
  return name
}

export async function updateEmail(accountId: string, currentPassword: string, nextEmailInput: string) {
  const email = normalizeEmail(nextEmailInput)
  if (!isValidEmail(email)) throw new Error('Enter a valid email address.')
  const { rows } = await getDb().query<{ password_salt: string; password_hash: string }>('SELECT password_salt,password_hash FROM morefm_listener_accounts WHERE id=$1', [accountId])
  const row = rows[0]
  if (!row || !(await verifyPassword(currentPassword, row.password_salt, row.password_hash))) throw new Error('Current password is incorrect.')
  try { await getDb().query('UPDATE morefm_listener_accounts SET email=$2, updated_at=now() WHERE id=$1', [accountId, email]) }
  catch (error) { if ((error as { code?: string })?.code === '23505') throw new Error('An account with this email already exists.'); throw error }
  return email
}

export async function updatePassword(accountId: string, currentPassword: string, nextPassword: string) {
  if (!passwordIsValid(nextPassword)) throw new Error('Password must be 8–256 characters.')
  const { rows } = await getDb().query<{ password_salt: string; password_hash: string }>('SELECT password_salt,password_hash FROM morefm_listener_accounts WHERE id=$1', [accountId])
  const row = rows[0]
  if (!row || !(await verifyPassword(currentPassword, row.password_salt, row.password_hash))) throw new Error('Current password is incorrect.')
  const next = await hashPassword(nextPassword)
  await getDb().query('UPDATE morefm_listener_accounts SET password_salt=$2,password_hash=$3,updated_at=now() WHERE id=$1', [accountId, next.salt, next.hash])
}

export async function saveAvatar(accountId: string, mime: string, data: Buffer) {
  await getDb().query('UPDATE morefm_listener_accounts SET avatar_mime=$2,avatar_data=$3,updated_at=now() WHERE id=$1', [accountId, mime, data])
}

export async function getAvatar(accountId: string) {
  const { rows } = await getDb().query<{ avatar_mime: string | null; avatar_data: Buffer | null }>('SELECT avatar_mime,avatar_data FROM morefm_listener_accounts WHERE id=$1', [accountId])
  return rows[0] ?? null
}

export async function setDailyAllowance(amount: number) {
  if (!Number.isInteger(amount) || amount < 0 || amount > 1_000_000) throw new Error('Daily credits must be a whole number from 0 to 1,000,000.')
  await getDb().query('UPDATE morefm_credit_settings SET daily_allowance=$1,updated_at=now() WHERE id=true', [amount])
  return amount
}

export async function addCreditsToAll(amount: number) {
  if (!Number.isInteger(amount) || amount < 1 || amount > 1_000_000) throw new Error('Add-credit amount must be a whole number from 1 to 1,000,000.')
  const { rowCount } = await getDb().query('UPDATE morefm_listener_accounts SET bonus_credits=bonus_credits+$1,updated_at=now()', [amount])
  return rowCount ?? 0
}

export async function getAdminCreditData() {
  const today = manilaTodaySql()
  await getDb().query(
    `UPDATE morefm_listener_accounts a SET daily_credits=s.daily_allowance,credit_date=${today},updated_at=now()
     FROM morefm_credit_settings s WHERE s.id=true AND a.credit_date < ${today}`,
  )
  const [{ rows: settings }, { rows: users }] = await Promise.all([
    getDb().query<{ daily_allowance: number }>('SELECT daily_allowance FROM morefm_credit_settings WHERE id=true'),
    getDb().query<{ id: string; email: string; display_name: string; daily_credits: number; bonus_credits: number; credit_date: string }>(
      'SELECT id,email,display_name,daily_credits,bonus_credits,credit_date::text AS credit_date FROM morefm_listener_accounts ORDER BY created_at DESC',
    ),
  ])
  return { dailyAllowance: settings[0]?.daily_allowance ?? 0, profiles: users.map((user) => ({ user_id: user.id, email: user.email, display_name: user.display_name, daily_credits: user.daily_credits, bonus_credits: user.bonus_credits, credit_date: user.credit_date })) }
}
