-- ================================================================
-- 005_general_words.sql
-- General Words + User Study Status Schema
-- Run this in your Supabase SQL Editor
-- ================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. General Words Table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.general_words (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  word_english      TEXT NOT NULL,
  word_japanese     TEXT NOT NULL,
  word_hiragana     TEXT NOT NULL,
  word_romaji       TEXT NOT NULL,
  word_type         TEXT NOT NULL DEFAULT 'noun', -- 'verb', 'noun', 'adjective', 'adverb', 'particle', 'expression', 'other'
  verb_forms        JSONB DEFAULT NULL,          -- e.g. {"nai": "食べない", "te": "食べて", "potential": "食べられる", "volitional": "食べよう", "masu": "食べます", "ta": "食べた"}
  sentence_english  TEXT,
  sentence_japanese TEXT,                        -- Kanji with bracketed furigana: e.g. "私[わたし]は毎朝[まいあさ]りんごを食[た]べます。"
  category          TEXT DEFAULT 'General',      -- e.g. 'Food', 'Travel', 'Daily Life', 'Business', 'JLPT N5'
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. User General Word Status Table ────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_general_word_status (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word_id     UUID NOT NULL REFERENCES public.general_words(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'unread'
                CHECK (status IN ('unread', 'studying', 'studied')),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, word_id)
);

-- ── 3. Performance Indexes ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_general_words_user ON public.general_words(user_id);
CREATE INDEX IF NOT EXISTS idx_general_words_category ON public.general_words(category);
CREATE INDEX IF NOT EXISTS idx_general_words_type ON public.general_words(word_type);
CREATE INDEX IF NOT EXISTS idx_user_gw_status_user ON public.user_general_word_status(user_id);
CREATE INDEX IF NOT EXISTS idx_user_gw_status_word ON public.user_general_word_status(user_id, word_id);

-- ── 4. Auto-update updated_at Trigger ────────────────────────────
CREATE OR REPLACE FUNCTION update_general_words_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_general_words_updated_at ON public.general_words;
CREATE TRIGGER trg_general_words_updated_at
  BEFORE UPDATE ON public.general_words
  FOR EACH ROW EXECUTE FUNCTION update_general_words_timestamp();

-- ── 5. Row-Level Security (RLS) ──────────────────────────────────
ALTER TABLE public.general_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_general_word_status ENABLE ROW LEVEL SECURITY;

-- General Words: Users can view public words or their own words, and insert/update/delete their own
DROP POLICY IF EXISTS "Users can view general words" ON public.general_words;
CREATE POLICY "Users can view general words"
  ON public.general_words FOR SELECT
  TO authenticated
  USING (user_id IS NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own general words" ON public.general_words;
CREATE POLICY "Users can insert own general words"
  ON public.general_words FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own general words" ON public.general_words;
CREATE POLICY "Users can update own general words"
  ON public.general_words FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own general words" ON public.general_words;
CREATE POLICY "Users can delete own general words"
  ON public.general_words FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- User General Word Status: Users manage their own status
DROP POLICY IF EXISTS "Users manage own general word status" ON public.user_general_word_status;
CREATE POLICY "Users manage own general word status"
  ON public.user_general_word_status FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
