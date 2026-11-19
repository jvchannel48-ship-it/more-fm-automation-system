-- RJ FM: daily request usage and active phone listener visibility.
ALTER TABLE morefm_listener_accounts
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz;

CREATE TABLE IF NOT EXISTS morefm_credit_usage (
  account_id uuid NOT NULL REFERENCES morefm_listener_accounts(id) ON DELETE CASCADE,
  usage_date date NOT NULL,
  credits_used integer NOT NULL DEFAULT 0 CHECK (credits_used >= 0),
  requests_count integer NOT NULL DEFAULT 0 CHECK (requests_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, usage_date)
);

CREATE INDEX IF NOT EXISTS listener_accounts_active_idx
  ON morefm_listener_accounts(last_active_at);
