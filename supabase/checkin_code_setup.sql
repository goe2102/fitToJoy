-- ─── Check-in code ────────────────────────────────────────────────────────────
-- Run this in the Supabase SQL editor.

ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS checkin_mode text DEFAULT 'button'
    CHECK (checkin_mode IN ('button', 'code'));

ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS checkin_code varchar(4);
