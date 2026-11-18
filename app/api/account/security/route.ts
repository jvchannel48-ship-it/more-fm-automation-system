import { type NextRequest, NextResponse } from 'next/server'
import { privateJsonHeaders, requireAccount } from '@/lib/account-api'
import { updateEmail, updatePassword } from '@/lib/account-store'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest) {
  const { user, response } = await requireAccount(request)
  if (response) return response
  const body = await request.json().catch(() => ({})) as { action?: unknown; currentPassword?: unknown; newPassword?: unknown; newEmail?: unknown }
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : ''
  try {
    if (body.action === 'password') {
      if (typeof body.newPassword !== 'string') return NextResponse.json({ error: 'Enter a new password.' }, { status: 400, headers: privateJsonHeaders })
      await updatePassword(user!.id, currentPassword, body.newPassword)
      return NextResponse.json({ ok: true, message: 'Na-update ang password.' }, { headers: privateJsonHeaders })
    }
    if (body.action === 'email') {
      if (typeof body.newEmail !== 'string') return NextResponse.json({ error: 'Enter a new email address.' }, { status: 400, headers: privateJsonHeaders })
      const email = await updateEmail(user!.id, currentPassword, body.newEmail)
      return NextResponse.json({ ok: true, email, message: 'Na-update ang email.' }, { headers: privateJsonHeaders })
    }
    return NextResponse.json({ error: 'Invalid account update.' }, { status: 400, headers: privateJsonHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Hindi na-update ang account.'
    const status = message.includes('Current password') ? 401 : message.includes('already exists') ? 409 : message.includes('must') || message.includes('valid email') ? 400 : 503
    return NextResponse.json({ error: message }, { status, headers: privateJsonHeaders })
  }
}
