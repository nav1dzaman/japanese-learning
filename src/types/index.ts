export type VocabStatus = 'unread' | 'studying' | 'studied';

// Matches the actual flat Supabase `vocabulary` table
export interface VocabRow {
  chapter: number;
  chapter_name: string;
  section: number;
  section_name: string;
  no: number;
  word_kanji: string;
  reading: string;
  meaning: string;
  jp_example?: string;
  en_example?: string;
}

// Derived "chapter" built from grouping VocabRows
export interface Chapter {
  chapter: number;
  chapter_name: string;
}

// Derived "section" built from grouping VocabRows
export interface Section {
  chapter: number;
  section: number;
  section_name: string;
}

// For UI vocab cards — id is a composite string "ch_sec_no" for global uniqueness
export interface Vocabulary {
  id: string;          // composite: `${chapter}_${section}_${no}`
  chapter: number;
  chapter_name: string;
  section: number;
  section_name: string;
  order_number: number;
  word: string;        // = word_kanji
  reading: string;
  meaning: string;
  example_jp?: string; // = jp_example
  example_en?: string; // = en_example
}

export interface QuizQuestion {
  vocab: Vocabulary;
  options: string[];
  correctAnswer: string;
}

export interface SectionWithCount extends Section {
  totalCount: number;
  studiedCount: number;
  studyingCount: number;
  unreadCount: number;
}

export interface ChapterWithStats extends Chapter {
  sectionCount: number;
  totalVocab: number;
  studiedCount: number;
  studyingCount: number;
}
