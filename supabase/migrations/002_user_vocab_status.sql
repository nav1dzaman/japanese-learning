-- ================================================================
-- user_vocab_status table
-- Tracks each user's study status per vocabulary word
-- identified by chapter + section + no (matching the vocabulary table)
-- ================================================================

CREATE TABLE IF NOT EXISTS public.user_vocab_status (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter     INTEGER NOT NULL,
  section     INTEGER NOT NULL,
  no          INTEGER NOT NULL,
  status      TEXT NOT NULL DEFAULT 'unread'
                CHECK (status IN ('unread', 'studying', 'studied')),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, chapter, section, no)
);

-- ================================================================
-- Row Level Security
-- ================================================================

ALTER TABLE public.user_vocab_status ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own status rows
CREATE POLICY "Users manage own vocab status"
ON public.user_vocab_status
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ================================================================
-- Index for fast lookups
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_user_vocab_status_user
  ON public.user_vocab_status(user_id);

CREATE INDEX IF NOT EXISTS idx_user_vocab_status_word
  ON public.user_vocab_status(user_id, chapter, section, no);
