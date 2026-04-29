// ============================================================
// Voice Cadence Score Engine
// Modified Flesch-Kincaid Grade Level adapted for voice/audio
// Score = 206.835 - 1.015*(words/sentences) - 84.6*(syllables/words)
// Higher score = more listenable (easier to follow by ear)
// ============================================================

export interface CadenceAnalysis {
  score: number;           // 0–100 Voice Cadence Score
  grade: string;           // "Excellent" | "Good" | "Fair" | "Poor"
  totalWords: number;
  totalSentences: number;
  totalSyllables: number;
  avgWordsPerSentence: number;
  avgSyllablesPerWord: number;
  longSentences: number;   // sentences > 20 words (voice danger zone)
  hardWords: number;       // words with ≥4 syllables
  issues: string[];        // human-readable issues detected
}

// ─── Korean syllable counter ─────────────────────────────────
// Each Korean character (가-힣) is exactly 1 syllable block
function countKoreanSyllables(text: string): number {
  let count = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= 0xAC00 && cp <= 0xD7A3) count++; // Hangul syllable block
  }
  return count;
}

// ─── English syllable estimator (rule-based) ─────────────────
// Heuristic: count vowel groups, handle silent-e, -le endings
function countEnglishSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length === 0) return 0;
  if (word.length <= 3) return 1;

  // Remove trailing silent-e (not after vowel)
  word = word.replace(/(?<=[^aeiou])e$/, '');
  // Count vowel groups
  const matches = word.match(/[aeiouy]+/g);
  let count = matches ? matches.length : 1;
  // Adjust for common patterns
  if (word.endsWith('le') && word.length > 2 && !/[aeiou]/.test(word[word.length - 3])) count++;
  if (word.endsWith('es') || word.endsWith('ed')) count = Math.max(1, count - 1);
  return Math.max(1, count);
}

// ─── Language detection (simple heuristic) ───────────────────
function detectLanguage(text: string): 'ko' | 'en' | 'mixed' {
  const koreanChars = (text.match(/[\uAC00-\uD7A3]/g) ?? []).length;
  const latinChars = (text.match(/[a-zA-Z]/g) ?? []).length;
  if (koreanChars > latinChars * 2) return 'ko';
  if (latinChars > koreanChars * 2) return 'en';
  return 'mixed';
}

// ─── Sentence splitter ────────────────────────────────────────
function splitIntoSentences(text: string): string[] {
  // Split on . ! ? and Korean sentence terminators (。！？)
  const raw = text
    .split(/[.!?。！？]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  return raw.length > 0 ? raw : [text];
}

// ─── Word tokenizer (handles Korean + English) ────────────────
function tokenizeWords(text: string): string[] {
  // For Korean: split by whitespace after normalization. 
  // We don't need to pad Korean blocks specifically if we trust spaces in modern text, 
  // but let's keep a safer split that separates punctuation from words.
  const tokens = text
    .replace(/([.!?%,()])/g, ' $1 ') // separate punctuation
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length > 0); // Allow 1-char words (common in Korean)
  return tokens;
}

// ─── Syllable counter (multilingual) ─────────────────────────
function countSyllables(word: string): number {
  const korSyllables = countKoreanSyllables(word);
  const engSyllables = countEnglishSyllables(word);
  return korSyllables + engSyllables;
}

// ─── Main scoring function ────────────────────────────────────
export function analyzeVoiceCadence(text: string): CadenceAnalysis {
  const lang = detectLanguage(text);
  const sentences = splitIntoSentences(text);
  const words = tokenizeWords(text);

  const totalSentences = Math.max(1, sentences.length);
  const totalWords = Math.max(1, words.length);

  let totalSyllables = 0;
  let hardWords = 0;

  for (const word of words) {
    const syl = countSyllables(word);
    totalSyllables += syl;
    if (syl >= 4) hardWords++;
  }

  const avgWordsPerSentence = totalWords / totalSentences;
  const avgSyllablesPerWord = totalSyllables / totalWords;

  // Modified Flesch-Kincaid for voice.
  // English: Original coefficients work well.
  // Korean: Words are denser (more syllables), so we use a tuned formula.
  let rawScore: number;
  if (lang === 'ko') {
    rawScore = 220 - (1.2 * avgWordsPerSentence) - (35 * avgSyllablesPerWord);
  } else {
    rawScore = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);
  }

  // Clamp to 0–100
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  // Long sentences analysis
  const longSentences = sentences.filter(s => tokenizeWords(s).length > 20).length;

  // Issue detection
  const issues: string[] = [];
  if (avgWordsPerSentence > 20) issues.push(`Average sentence length ${avgWordsPerSentence.toFixed(1)} words - too long for breath (Recommended: < 15)`);
  if (avgSyllablesPerWord > 2.5) issues.push(`Average syllables per word ${avgSyllablesPerWord.toFixed(1)} - high pronunciation complexity (Recommended: < 2.0)`);
  if (hardWords / totalWords > 0.15) issues.push(`High ratio of complex words (${((hardWords / totalWords) * 100).toFixed(0)}%) - risk of listener fatigue`);
  if (longSentences > 0) issues.push(`${longSentences} sentence(s) exceed 20 words - consider splitting`);

  // Grade
  let grade: string;
  if (score >= 70) grade = 'Excellent';
  else if (score >= 55) grade = 'Good';
  else if (score >= 40) grade = 'Fair';
  else grade = 'Poor';

  return {
    score,
    grade,
    totalWords,
    totalSentences,
    totalSyllables,
    avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
    avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 100) / 100,
    longSentences,
    hardWords,
    issues,
  };
}
