-- ================================================================
-- Japanese Learning Platform — Initial Schema
-- Run this in your Supabase SQL editor
-- ================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- TABLES
-- ================================================================

-- Chapters
CREATE TABLE IF NOT EXISTS public.chapters (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  chapter_number INTEGER NOT NULL UNIQUE,
  name_en     TEXT NOT NULL,
  name_jp     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Sections
CREATE TABLE IF NOT EXISTS public.sections (
  id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  chapter_id     UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  section_number INTEGER NOT NULL,
  name           TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chapter_id, section_number)
);

-- Vocabulary
CREATE TABLE IF NOT EXISTS public.vocabulary (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  chapter_id   UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  section_id   UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  order_number INTEGER NOT NULL,
  word         TEXT NOT NULL,
  reading      TEXT NOT NULL,
  meaning      TEXT NOT NULL,
  example_jp   TEXT,
  example_en   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- User Vocabulary Status
CREATE TYPE IF NOT EXISTS vocab_status AS ENUM ('unread', 'studying', 'studied');

CREATE TABLE IF NOT EXISTS public.user_vocab_status (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vocab_id   UUID NOT NULL REFERENCES public.vocabulary(id) ON DELETE CASCADE,
  status     vocab_status NOT NULL DEFAULT 'unread',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, vocab_id)
);

-- Quiz Sessions
CREATE TABLE IF NOT EXISTS public.quiz_sessions (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_questions  INTEGER NOT NULL DEFAULT 0,
  correct_answers  INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER,
  source_filter    JSONB DEFAULT '{}',
  completed_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Quiz Answers
CREATE TABLE IF NOT EXISTS public.quiz_answers (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id    UUID NOT NULL REFERENCES public.quiz_sessions(id) ON DELETE CASCADE,
  vocab_id      UUID NOT NULL REFERENCES public.vocabulary(id) ON DELETE CASCADE,
  user_answer   TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  is_correct    BOOLEAN NOT NULL,
  answered_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- ROW LEVEL SECURITY
-- ================================================================

ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocabulary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_vocab_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;

-- Public read access for vocabulary data
CREATE POLICY "Anyone can read chapters" ON public.chapters FOR SELECT USING (true);
CREATE POLICY "Anyone can read sections" ON public.sections FOR SELECT USING (true);
CREATE POLICY "Anyone can read vocabulary" ON public.vocabulary FOR SELECT USING (true);

-- User-specific access for progress data
CREATE POLICY "Users manage own vocab status" ON public.user_vocab_status
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own quiz sessions" ON public.quiz_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own quiz answers" ON public.quiz_answers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.quiz_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
  );

-- ================================================================
-- INDEXES
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_sections_chapter ON public.sections(chapter_id);
CREATE INDEX IF NOT EXISTS idx_vocabulary_section ON public.vocabulary(section_id);
CREATE INDEX IF NOT EXISTS idx_vocabulary_chapter ON public.vocabulary(chapter_id);
CREATE INDEX IF NOT EXISTS idx_user_vocab_user ON public.user_vocab_status(user_id);
CREATE INDEX IF NOT EXISTS idx_user_vocab_status ON public.user_vocab_status(user_id, status);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user ON public.quiz_sessions(user_id);

-- ================================================================
-- SEED DATA — Chapter 1: Daily Life & Home
-- ================================================================

INSERT INTO public.chapters (chapter_number, name_en, name_jp) VALUES
(1, 'Daily Life & Home', '毎日の生活'),
(2, 'Work & School', '仕事と学校'),
(3, 'Travel & Transport', '旅行と交通'),
(4, 'Food & Dining', '食べ物と食事'),
(5, 'Health & Body', '健康と体')
ON CONFLICT (chapter_number) DO NOTHING;

-- Section 1: Time & Frequency (Chapter 1)
WITH ch AS (SELECT id FROM public.chapters WHERE chapter_number = 1)
INSERT INTO public.sections (chapter_id, section_number, name)
SELECT ch.id, 1, 'Time & Frequency' FROM ch
ON CONFLICT (chapter_id, section_number) DO NOTHING;

-- Section 2: Daily Activities (Chapter 1)
WITH ch AS (SELECT id FROM public.chapters WHERE chapter_number = 1)
INSERT INTO public.sections (chapter_id, section_number, name)
SELECT ch.id, 2, 'Daily Activities' FROM ch
ON CONFLICT (chapter_id, section_number) DO NOTHING;

-- Section 3: Home & Living (Chapter 1)
WITH ch AS (SELECT id FROM public.chapters WHERE chapter_number = 1)
INSERT INTO public.sections (chapter_id, section_number, name)
SELECT ch.id, 3, 'Home & Living' FROM ch
ON CONFLICT (chapter_id, section_number) DO NOTHING;

-- Vocabulary: Chapter 1, Section 1 — Time & Frequency
WITH sec AS (
  SELECT s.id FROM public.sections s
  JOIN public.chapters c ON s.chapter_id = c.id
  WHERE c.chapter_number = 1 AND s.section_number = 1
),
ch AS (SELECT id FROM public.chapters WHERE chapter_number = 1)
INSERT INTO public.vocabulary (chapter_id, section_id, order_number, word, reading, meaning, example_jp, example_en)
SELECT ch.id, sec.id, v.order_number, v.word, v.reading, v.meaning, v.example_jp, v.example_en
FROM ch, sec,
(VALUES
  (1, 'たった今', 'たったいま', 'just (now)', '電車はたった今出たところです。', 'The train just left.'),
  (2, '今にも', 'いまにも', 'at any time; at any moment', '空が暗くなって、今にも雨が降りそうです。', 'The sky is dark; it looks like it could rain at any moment.'),
  (3, 'もうすぐ', 'もうすぐ', 'soon', '今11時半。もうすぐランチの時間です。', 'It''s now 11:30. It will be lunch time soon.'),
  (4, 'さっき', 'さっき', 'just now; a while ago', 'A「山下さんは？」 B「山下さんなら、さっき帰りましたよ。」', 'A: Where is Yamashita-san? B: Yamashita-san went home just now.'),
  (5, 'このごろ', 'このごろ', 'recently; these days', 'このごろ、寒い日が多いですね。', 'There have been many cold days recently.'),
  (6, '最近', 'さいきん', 'recently', '最近、スペイン語を勉強しています。', 'I have been studying Spanish recently.'),
  (7, 'この間', 'このあいだ', 'just a while ago', 'A「田中さんは元気ですか。」 B「ええ。この間会いましたよ。」', 'A: Is Tanaka-san doing well? B: Yes. I saw him just a while ago.'),
  (8, '今度', 'こんど', 'this time; next time', '今度のテストはとてもむずかしかった。', 'The test this time was really difficult.'),
  (9, 'いつも', 'いつも', 'always; usually', 'いつも早く起きます。', 'I always wake up early.'),
  (10, 'たまに', 'たまに', 'occasionally; once in a while', 'たまに映画を見に行きます。', 'I go to the movies occasionally.'),
  (11, 'めったに〜ない', 'めったにない', 'rarely; seldom', 'めったに外食しません。', 'I rarely eat out.'),
  (12, 'なかなか〜ない', 'なかなかない', 'not easily; not readily', 'なかなか時間がありません。', 'I don''t have time easily.'),
  (13, 'もう', 'もう', 'already; not anymore', 'もう宿題をしました。', 'I already did my homework.'),
  (14, 'まだ', 'まだ', 'still; not yet', 'まだ食べています。', 'I am still eating.'),
  (15, 'やっと', 'やっと', 'finally; at last', 'やっと宿題が終わった。', 'I finally finished my homework.')
) AS v(order_number, word, reading, meaning, example_jp, example_en);

-- Vocabulary: Chapter 1, Section 2 — Daily Activities
WITH sec AS (
  SELECT s.id FROM public.sections s
  JOIN public.chapters c ON s.chapter_id = c.id
  WHERE c.chapter_number = 1 AND s.section_number = 2
),
ch AS (SELECT id FROM public.chapters WHERE chapter_number = 1)
INSERT INTO public.vocabulary (chapter_id, section_id, order_number, word, reading, meaning, example_jp, example_en)
SELECT ch.id, sec.id, v.order_number, v.word, v.reading, v.meaning, v.example_jp, v.example_en
FROM ch, sec,
(VALUES
  (1, '起きる', 'おきる', 'to wake up; to get up', '毎朝6時に起きます。', 'I wake up at 6 every morning.'),
  (2, '寝る', 'ねる', 'to sleep; to go to bed', '11時ごろ寝ます。', 'I go to bed around 11.'),
  (3, '食べる', 'たべる', 'to eat', 'ご飯を食べます。', 'I eat rice.'),
  (4, '飲む', 'のむ', 'to drink', 'お茶を飲みます。', 'I drink tea.'),
  (5, '歩く', 'あるく', 'to walk', '毎日歩いて学校に行きます。', 'I walk to school every day.'),
  (6, '走る', 'はしる', 'to run', '公園で走ります。', 'I run in the park.'),
  (7, '働く', 'はたらく', 'to work', '毎日8時間働きます。', 'I work 8 hours every day.'),
  (8, '休む', 'やすむ', 'to rest; to take a break', '週末は休みます。', 'I rest on weekends.'),
  (9, '洗う', 'あらう', 'to wash', '手を洗います。', 'I wash my hands.'),
  (10, '着る', 'きる', 'to wear (shirt/upper body)', '今日は青いシャツを着ます。', 'Today I wear a blue shirt.'),
  (11, '脱ぐ', 'ぬぐ', 'to take off (clothes)', '靴を脱いでください。', 'Please take off your shoes.'),
  (12, '掃除する', 'そうじする', 'to clean; to tidy', '毎週部屋を掃除します。', 'I clean my room every week.')
) AS v(order_number, word, reading, meaning, example_jp, example_en);

-- Vocabulary: Chapter 1, Section 3 — Home & Living
WITH sec AS (
  SELECT s.id FROM public.sections s
  JOIN public.chapters c ON s.chapter_id = c.id
  WHERE c.chapter_number = 1 AND s.section_number = 3
),
ch AS (SELECT id FROM public.chapters WHERE chapter_number = 1)
INSERT INTO public.vocabulary (chapter_id, section_id, order_number, word, reading, meaning, example_jp, example_en)
SELECT ch.id, sec.id, v.order_number, v.word, v.reading, v.meaning, v.example_jp, v.example_en
FROM ch, sec,
(VALUES
  (1, '家', 'いえ', 'house; home', '私の家は駅の近くです。', 'My house is near the station.'),
  (2, '部屋', 'へや', 'room', '私の部屋はせまいです。', 'My room is small.'),
  (3, '台所', 'だいどころ', 'kitchen', '台所で料理します。', 'I cook in the kitchen.'),
  (4, 'お風呂', 'おふろ', 'bath; bathtub', '毎晩お風呂に入ります。', 'I take a bath every night.'),
  (5, '窓', 'まど', 'window', '窓を開けてください。', 'Please open the window.'),
  (6, '扉/ドア', 'とびら/ドア', 'door', 'ドアを閉めてください。', 'Please close the door.'),
  (7, '電気', 'でんき', 'electricity; light', '電気をつけてください。', 'Please turn on the light.'),
  (8, 'エアコン', 'えあこん', 'air conditioner', '夏はエアコンをつけます。', 'I use the air conditioner in summer.'),
  (9, '冷蔵庫', 'れいぞうこ', 'refrigerator', '冷蔵庫に牛乳があります。', 'There is milk in the refrigerator.'),
  (10, '洗濯機', 'せんたくき', 'washing machine', '洗濯機で服を洗います。', 'I wash clothes with the washing machine.')
) AS v(order_number, word, reading, meaning, example_jp, example_en);

-- Section 1: Workplace (Chapter 2)
WITH ch AS (SELECT id FROM public.chapters WHERE chapter_number = 2)
INSERT INTO public.sections (chapter_id, section_number, name)
SELECT ch.id, 1, 'Workplace Vocabulary' FROM ch
ON CONFLICT (chapter_id, section_number) DO NOTHING;

-- Vocabulary: Chapter 2, Section 1 — Workplace
WITH sec AS (
  SELECT s.id FROM public.sections s
  JOIN public.chapters c ON s.chapter_id = c.id
  WHERE c.chapter_number = 2 AND s.section_number = 1
),
ch AS (SELECT id FROM public.chapters WHERE chapter_number = 2)
INSERT INTO public.vocabulary (chapter_id, section_id, order_number, word, reading, meaning, example_jp, example_en)
SELECT ch.id, sec.id, v.order_number, v.word, v.reading, v.meaning, v.example_jp, v.example_en
FROM ch, sec,
(VALUES
  (1, '仕事', 'しごと', 'work; job', '仕事が好きです。', 'I like my job.'),
  (2, '会社', 'かいしゃ', 'company; office', '毎朝9時に会社に行きます。', 'I go to the office at 9 every morning.'),
  (3, '会議', 'かいぎ', 'meeting; conference', '午後3時に会議があります。', 'There is a meeting at 3 PM.'),
  (4, '報告', 'ほうこく', 'report; reporting', '上司に報告します。', 'I report to my supervisor.'),
  (5, '締め切り', 'しめきり', 'deadline', '明日が締め切りです。', 'Tomorrow is the deadline.'),
  (6, '残業', 'ざんぎょう', 'overtime work', '今日は残業します。', 'I will work overtime today.'),
  (7, '同僚', 'どうりょう', 'colleague; coworker', '同僚と昼ご飯を食べます。', 'I eat lunch with my colleague.'),
  (8, '上司', 'じょうし', 'supervisor; boss', '上司に相談します。', 'I consult with my boss.'),
  (9, '部下', 'ぶか', 'subordinate', '部下を指導します。', 'I guide my subordinates.'),
  (10, '給料', 'きゅうりょう', 'salary; pay', '給料日は25日です。', 'Payday is the 25th.')
) AS v(order_number, word, reading, meaning, example_jp, example_en);

-- Section 1: Transportation (Chapter 3)
WITH ch AS (SELECT id FROM public.chapters WHERE chapter_number = 3)
INSERT INTO public.sections (chapter_id, section_number, name)
SELECT ch.id, 1, 'Transportation' FROM ch
ON CONFLICT (chapter_id, section_number) DO NOTHING;

-- Vocabulary: Chapter 3, Section 1 — Transportation
WITH sec AS (
  SELECT s.id FROM public.sections s
  JOIN public.chapters c ON s.chapter_id = c.id
  WHERE c.chapter_number = 3 AND s.section_number = 1
),
ch AS (SELECT id FROM public.chapters WHERE chapter_number = 3)
INSERT INTO public.vocabulary (chapter_id, section_id, order_number, word, reading, meaning, example_jp, example_en)
SELECT ch.id, sec.id, v.order_number, v.word, v.reading, v.meaning, v.example_jp, v.example_en
FROM ch, sec,
(VALUES
  (1, '電車', 'でんしゃ', 'train (electric)', '電車で通勤します。', 'I commute by train.'),
  (2, 'バス', 'バス', 'bus', 'バスで学校に行きます。', 'I go to school by bus.'),
  (3, '地下鉄', 'ちかてつ', 'subway; underground', '地下鉄は速いです。', 'The subway is fast.'),
  (4, 'タクシー', 'タクシー', 'taxi', 'タクシーを呼びます。', 'I call a taxi.'),
  (5, '飛行機', 'ひこうき', 'airplane', '飛行機で旅行します。', 'I travel by plane.'),
  (6, '駅', 'えき', 'station', '駅はどこですか。', 'Where is the station?'),
  (7, '乗り換え', 'のりかえ', 'transfer; changing trains', '新宿で乗り換えてください。', 'Please transfer at Shinjuku.'),
  (8, '切符', 'きっぷ', 'ticket', '切符を買います。', 'I buy a ticket.'),
  (9, '定期券', 'ていきけん', 'commuter pass', '定期券を使います。', 'I use a commuter pass.'),
  (10, '時刻表', 'じこくひょう', 'timetable; schedule', '時刻表を確認します。', 'I check the timetable.')
) AS v(order_number, word, reading, meaning, example_jp, example_en);
