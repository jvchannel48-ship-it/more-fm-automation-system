import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'

export const ADMIN_COOKIE = 'morefm_admin'
const SESSION_DAYS = 30

/** Default admin password used when ADMIN_PASSWORD env is not set on Render. */
const DEFAULT_ADMIN_PASSWORD = '09485054936'

function adminPassword() {
  return process.env.ADMIN_PASSWORD?.trim() || DEFAULT_ADMIN_PASSWORD
}

function secret() {
  return process.env.ADMIN_SECRET?.trim() || adminPassword()
}

function sign(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('hex')
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

export function isAdminConfigured() {
  return Boolean(adminPassword())
}

export function checkPassword(input: string) {
  const configuredPassword = adminPassword()
  return Boolean(configuredPassword && safeEqual(input.trim(), configuredPassword))
}

export function createSessionToken() {
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  const payload = `admin.${exp}`
  return { token: `${payload}.${sign(payload)}`, maxAge: SESSION_DAYS * 24 * 60 * 60 }
}

export async function isAdmin() {
  const store = await cookies()
  const token = store.get(ADMIN_COOKIE)?.value
  if (!token) return false
  const parts = token.split('.')
  if (parts.length !== 3) return false
  const [role, exp, sig] = parts
  if (role !== 'admin' || Number(exp) < Date.now()) return false
  try {
    return safeEqual(sig, sign(`${role}.${exp}`))
  } catch {
    return false
  }
}
