-- ─── Saved Activities ─────────────────────────────────────────────────────────
-- Run this in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS saved_activities (
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  activity_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, activity_id)
);

ALTER TABLE saved_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own saved activities"
  ON saved_activities FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
