-- Render Postgres schema for listener accounts and song-request credits.
-- Additive and idempotent; does not touch station playback tables or existing listeners.

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
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO morefm_credit_settings(id, daily_allowance)
VALUES (true, 0)
ON CONFLICT (id) DO NOTHING;
