-- ============================================================
-- 004_study_notes.sql
-- Study Book: daily notes per user
-- ============================================================

CREATE TABLE IF NOT EXISTS study_notes (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_date   DATE        NOT NULL DEFAULT CURRENT_DATE,
  content     TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),

  -- One note per user per day
  UNIQUE(user_id, note_date)
);

-- Index for fast per-user queries ordered by date
CREATE INDEX IF NOT EXISTS idx_study_notes_user_date
  ON study_notes(user_id, note_date DESC);

-- Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION update_study_notes_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_study_notes_updated_at
  BEFORE UPDATE ON study_notes
  FOR EACH ROW EXECUTE FUNCTION update_study_notes_timestamp();

-- ── Row-Level Security ─────────────────────────────────────
ALTER TABLE study_notes ENABLE ROW LEVEL SECURITY;

-- Users can only read their own notes
CREATE POLICY "Users can view own notes"
  ON study_notes FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own notes
CREATE POLICY "Users can insert own notes"
  ON study_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own notes
CREATE POLICY "Users can update own notes"
  ON study_notes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own notes
CREATE POLICY "Users can delete own notes"
  ON study_notes FOR DELETE
  USING (auth.uid() = user_id);
