import 'server-only'
import { getDb } from './db'

let schemaReady: Promise<void> | null = null

/** Create listener credit tables if missing (fixes admin “relation does not exist”). */
export async function ensureListenerSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = getDb()
      await db.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`)
      await db.query(`
CREATE TABLE IF NOT EXISTS morefm_listener_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 60),
  password_salt text NOT NULL,
  password_hash text NOT NULL,
  daily_credits integer NOT NULL DEFAULT 0 CHECK (daily_credits >= 0),
  bonus_credits integer NOT NULL DEFAULT 0 CHECK (bonus_credits >= 0),
  credit_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Manila')::date),
	  avatar_mime text,
	  avatar_data bytea,
	  last_active_at timestamptz,
	  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listener_account_avatar_pair CHECK (
    (avatar_mime IS NULL AND avatar_data IS NULL) OR (avatar_mime IS NOT NULL AND avatar_data IS NOT NULL)
  )
);
CREATE TABLE IF NOT EXISTS morefm_listener_sessions (
  token_hash char(64) PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES morefm_listener_accounts(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS listener_sessions_expiry_idx ON morefm_listener_sessions(expires_at);
CREATE INDEX IF NOT EXISTS listener_sessions_account_idx ON morefm_listener_sessions(account_id);
	CREATE TABLE IF NOT EXISTS morefm_credit_settings (
	  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
	  daily_allowance integer NOT NULL DEFAULT 0 CHECK (daily_allowance >= 0),
	  credits_enabled boolean NOT NULL DEFAULT true,
	  updated_at timestamptz NOT NULL DEFAULT now()
	);
	CREATE TABLE IF NOT EXISTS morefm_credit_usage (
	  account_id uuid NOT NULL REFERENCES morefm_listener_accounts(id) ON DELETE CASCADE,
	  usage_date date NOT NULL,
	  credits_used integer NOT NULL DEFAULT 0 CHECK (credits_used >= 0),
	  requests_count integer NOT NULL DEFAULT 0 CHECK (requests_count >= 0),
	  updated_at timestamptz NOT NULL DEFAULT now(),
	  PRIMARY KEY (account_id, usage_date)
	);
	ALTER TABLE morefm_listener_accounts ADD COLUMN IF NOT EXISTS last_active_at timestamptz;
	ALTER TABLE morefm_credit_settings ADD COLUMN IF NOT EXISTS credits_enabled boolean NOT NULL DEFAULT true;
	CREATE INDEX IF NOT EXISTS listener_accounts_active_idx ON morefm_listener_accounts(last_active_at);
INSERT INTO morefm_credit_settings(id, daily_allowance)
VALUES (true, 0)
ON CONFLICT (id) DO NOTHING;
`)
    })().catch((error) => {
      schemaReady = null
      throw error
    })
  }
  await schemaReady
}
