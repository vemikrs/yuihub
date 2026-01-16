import TinySegmenter from 'tiny-segmenter';

// Simple text processing for Japanese Terms Extraction
// Using TinySegmenter (Compact, JS-only)

const segmenter = new TinySegmenter();

// Term Extraction Logic
// 1. Segment text
// 2. Filter for potential keywords (length > 1, no symbols)
// 3. TF-IDF is hard without corpus stats, so just simple frequency or unique list for now.
//    YuiHub V1 requirement says "TF-IDF/MeCab equivalent".
//    For MVP, we extract Noun-like segments. TinySegmenter doesn't provide POS tags.
//    So we rely on heuristics: Kanji/Katakana usually imply content words.

// Heuristics:
// - Keep Kanji/Katakana words len >= 2
// - Keep English words len >= 3
// - Exclude Hiragana-only (often particles/verbs)

function isContentWord(term: string): boolean {
  if (term.length < 2) return false;
  
  // Kanji or Katakana presence
  const hasKanji = /[\u4e00-\u9faf]/.test(term);
  const hasKatakana = /[\u30a0-\u30ff]/.test(term);
  const isHiraganaOnly = /^[\u3040-\u309f]+$/.test(term);
  const isAlpha = /^[a-zA-Z0-9_-]+$/.test(term);

  if (isHiraganaOnly) return false; // Skip pure hiragana (likely particles/auxiliary verbs)
  if (isAlpha && term.length < 3) return false; // Skip short alpha

  return hasKanji || hasKatakana || isAlpha;
}

export function extractTerms(text: string, limit: number = 10): string[] {
  const segments = segmenter.segment(text);
  const uniqueTerms = new Set<string>();

  for (const seg of segments) {
    if (isContentWord(seg)) {
      uniqueTerms.add(seg);
    }
  }

  // TODO: Frequency based sort?
  return Array.from(uniqueTerms).slice(0, limit);
}
