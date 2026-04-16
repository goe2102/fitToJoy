-- ─── Reports ──────────────────────────────────────────────────────────────────
-- Run this in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS reports (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason       text NOT NULL CHECK (reason IN ('spam', 'harassment', 'inappropriate', 'fake', 'other')),
  description  text,
  created_at   timestamptz DEFAULT now(),
  UNIQUE (reporter_id, reported_id)
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Users can submit reports for themselves
CREATE POLICY "Users can insert own reports"
  ON reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- Users can read their own reports
CREATE POLICY "Users can view own reports"
  ON reports FOR SELECT
  USING (auth.uid() = reporter_id);
