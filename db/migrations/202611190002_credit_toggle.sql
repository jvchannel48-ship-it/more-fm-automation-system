-- RJ FM: global credits enable/disable switch.
ALTER TABLE morefm_credit_settings
  ADD COLUMN IF NOT EXISTS credits_enabled boolean NOT NULL DEFAULT true;
