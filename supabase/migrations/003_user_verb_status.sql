-- ================================================================
-- 003: verb read policy + user_verb_status table
-- Run this entire file in Supabase SQL Editor
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Allow all authenticated users to READ the verb table
--    (verb is shared data, not user-specific)
-- ----------------------------------------------------------------

ALTER TABLE public.verb ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read verbs" ON public.verb;

CREATE POLICY "Authenticated users can read verbs"
ON public.verb
FOR SELECT
TO authenticated
USING (true);


-- ----------------------------------------------------------------
-- 2. user_verb_status table
--    Tracks each user's study status per verb
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_verb_status (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verb_id     BIGINT NOT NULL REFERENCES public.verb(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'unread'
                CHECK (status IN ('unread', 'studying', 'studied')),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, verb_id)
);

-- Row Level Security for user_verb_status
ALTER TABLE public.user_verb_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own verb status" ON public.user_verb_status;

CREATE POLICY "Users manage own verb status"
ON public.user_verb_status
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_verb_status_user
  ON public.user_verb_status(user_id);

CREATE INDEX IF NOT EXISTS idx_user_verb_status_verb
  ON public.user_verb_status(user_id, verb_id);
