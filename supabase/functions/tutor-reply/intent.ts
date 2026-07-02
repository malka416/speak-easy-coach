// Deterministic, offline intent pre-classifier.
// Used both as a hint passed to the LLM and as the unit-test target.

export type IntentCategory =
  | "translation"
  | "grammar"
  | "vocabulary"
  | "pronunciation"
  | "free_conversation";

export type PreIntent = {
  category: IntentCategory;
  confidence: number; // 0..1
  signals: string[];
};

const HEBREW_RE = /[\u0590-\u05FF]/;
const HEBREW_WORD_RE = /[\u0590-\u05FF]+/g;

// Cue lists. Order matters: pronunciation > grammar > translation > vocabulary.
const CUES_PRONUNCIATION = [
  "איך מבטאים",
  "איך הוגים",
  "איך נשמע",
  "how do you pronounce",
  "how is .* pronounced",
  "pronunciation of",
];
const CUES_GRAMMAR = [
  "למה אומרים",
  "למה זה",
  "למה לא",
  "מה ההבדל בין",
  "תסביר",
  "תסבירי",
  "explain (in hebrew|בעברית)",
  "why is it",
  "why do (we|you) say",
  "when do (we|you) use",
  "difference between",
  "grammar",
  "tense",
];
const CUES_TRANSLATION = [
  "איך אומרים",
  "איך כותבים",
  "מה זה",
  "מה פירוש",
  "מה המשמעות",
  "תרגום",
  "תרגמ",
  "how do you say",
  "what does .* mean",
  "what is .* in english",
  "translate",
  "meaning of",
];
const CUES_VOCABULARY = [
  "מילה אחרת",
  "איך יותר טוב",
  "מילה יותר",
  "synonym",
  "another word for",
  "better word",
  "word for",
];

function matchAny(text: string, patterns: string[]): string[] {
  const lower = text.toLowerCase();
  const hits: string[] = [];
  for (const p of patterns) {
    const re = new RegExp(p, "i");
    if (re.test(lower)) hits.push(p);
  }
  return hits;
}

/**
 * Pre-classify a learner turn into one of 5 intent categories using
 * deterministic surface cues. This is a HINT layer — the LLM can override,
 * but for the obvious patterns we lock the answer.
 */
export function preClassifyIntent(rawText: string): PreIntent {
  const text = (rawText ?? "").trim();
  if (!text) return { category: "free_conversation", confidence: 0.1, signals: [] };

  const pron = matchAny(text, CUES_PRONUNCIATION);
  if (pron.length) return { category: "pronunciation", confidence: 0.9, signals: pron };

  const gram = matchAny(text, CUES_GRAMMAR);
  if (gram.length) return { category: "grammar", confidence: 0.9, signals: gram };

  const trans = matchAny(text, CUES_TRANSLATION);
  if (trans.length) return { category: "translation", confidence: 0.9, signals: trans };

  const vocab = matchAny(text, CUES_VOCABULARY);
  if (vocab.length) return { category: "vocabulary", confidence: 0.8, signals: vocab };

  // Bare Hebrew token(s) with no verb/sentence structure → likely translation.
  const hebrewWords = text.match(HEBREW_WORD_RE) ?? [];
  const hasLatinLetters = /[A-Za-z]/.test(text);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const mostlyHebrew = HEBREW_RE.test(text) && !hasLatinLetters;
  // Sentence markers (pronouns, time words, copulas, conjunctions) indicate a real Hebrew utterance,
  // not a lookup. Presence of any → free_conversation.
  const SENTENCE_MARKERS = [
    "אני","אתה","את","אנחנו","הם","הן","הוא","היא",
    "היום","אתמול","מחר","עכשיו","אז","כי","אבל",
    "הייתי","היה","הייתה","יש","אין","רוצה","אוהב","אוהבת","הולך","הולכת",
  ];
  const hasSentenceMarker = SENTENCE_MARKERS.some((w) =>
    new RegExp(`(^|\\s)${w}(\\s|$|[.,!?])`).test(text),
  );
  if (mostlyHebrew && !hasSentenceMarker && hebrewWords.length <= 3 && wordCount <= 3) {
    return { category: "translation", confidence: 0.8, signals: ["bare_hebrew_token"] };
  }

  // Mixed Hebrew + English: short Hebrew wrapper around a single English word → translation lookup.
  const latinWords = text.match(/[A-Za-z]+/g) ?? [];
  if (HEBREW_RE.test(text) && latinWords.length === 1 && wordCount <= 5 && !hasSentenceMarker) {
    return { category: "translation", confidence: 0.7, signals: ["mixed_single_english_token"] };
  }

  return { category: "free_conversation", confidence: 0.7, signals: [] };
}