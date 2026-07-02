// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { preClassifyIntent } from "./intent.ts";

// A vocabulary lookup is a very short, punctuation-free word/phrase with no
// conversational structure. When detected, Aria must respond with a strict
// dictionary-style card and stop — no follow-up, no chat.
export function isVocabularyLookup(raw: string): boolean {
  const text = (raw ?? "").trim();
  if (!text) return false;
  if (/[.!?,;:"']/.test(text)) return false;
  if (/[\n\r]/.test(text)) return false;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 2) return false;
  if (text.length > 40) return false;
  // Reject obvious meta-questions ("how do you say", "what does X mean", etc.)
  // — those are handled by the existing translation flow which already chats.
  // A lookup is JUST the word(s).
  const lower = text.toLowerCase();
  const META = [
    "איך","מה","למה","תסביר","תסבירי","how","what","why","when","translate","explain","pronounce",
  ];
  if (META.some((w) => new RegExp(`(^|\\s)${w}(\\s|$)`, "i").test(lower))) return false;
  return true;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const MODEL = "gemini-2.5-flash";

// Gemini 2.5 Flash pricing (USD per 1M tokens) — adjust if rates change.
const PRICE_IN_PER_1M = 0.30;
const PRICE_OUT_PER_1M = 2.50;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Mistake = { type: "grammar" | "fluency" | "vocabulary"; original: string; suggestion: string; explanation: string };
type VocabItem = { word: string; meaning: string; example: string };
type TranslationIntent = {
  is_translation_request: boolean;
  source_language: "he" | "en" | "mixed" | "unknown";
  target_language: "he" | "en" | "unknown";
  token: string;
  token_type: "hebrew_word" | "english_word" | "proper_name" | "unknown";
  confidence: number; // 0..1
  needs_clarification: boolean;
  clarification_question: string;
  notes: string;
};
type IntentCategory =
  | "translation"
  | "grammar"
  | "vocabulary"
  | "pronunciation"
  | "free_conversation";
type Intent = {
  category: IntentCategory;
  confidence: number; // 0..1
  reason: string; // short, why you picked it
  signals: string[]; // surface cues found (e.g. "איך אומרים", "why", "מה זה")
};
type AiReply = {
  conversational_reply: string;
  encouragement: string;
  follow_up_question: string;
  mistakes: Mistake[];
  vocabulary_suggestions: VocabItem[];
  detected_level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  translation_intent?: TranslationIntent | null;
  intent?: Intent | null;
};

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const MISTAKE_TYPES = ["grammar", "fluency", "vocabulary"];
const INTENT_CATEGORIES = [
  "translation",
  "grammar",
  "vocabulary",
  "pronunciation",
  "free_conversation",
];

function validateReplyDetailed(x: any): { ok: boolean; reason?: string } {
  if (!x || typeof x !== "object") return { ok: false, reason: "root is not an object" };
  if (typeof x.conversational_reply !== "string" || !x.conversational_reply.trim())
    return { ok: false, reason: `conversational_reply invalid (typeof=${typeof x.conversational_reply}, empty=${!x.conversational_reply?.trim?.()})` };
  if (typeof x.encouragement !== "string") return { ok: false, reason: `encouragement not string (typeof=${typeof x.encouragement})` };
  if (typeof x.follow_up_question !== "string") return { ok: false, reason: `follow_up_question not string (typeof=${typeof x.follow_up_question})` };
  if (!Array.isArray(x.mistakes)) return { ok: false, reason: `mistakes not array (typeof=${typeof x.mistakes})` };
  for (let i = 0; i < x.mistakes.length; i++) {
    const m = x.mistakes[i];
    if (!m || typeof m !== "object") return { ok: false, reason: `mistakes[${i}] not object` };
    if (!MISTAKE_TYPES.includes(m.type)) return { ok: false, reason: `mistakes[${i}].type invalid: ${JSON.stringify(m.type)}` };
    if (typeof m.original !== "string") return { ok: false, reason: `mistakes[${i}].original not string` };
    if (typeof m.suggestion !== "string") return { ok: false, reason: `mistakes[${i}].suggestion not string` };
    if (typeof m.explanation !== "string") return { ok: false, reason: `mistakes[${i}].explanation not string` };
  }
  if (!Array.isArray(x.vocabulary_suggestions)) return { ok: false, reason: `vocabulary_suggestions not array (typeof=${typeof x.vocabulary_suggestions})` };
  for (let i = 0; i < x.vocabulary_suggestions.length; i++) {
    const v = x.vocabulary_suggestions[i];
    if (!v || typeof v !== "object") return { ok: false, reason: `vocabulary_suggestions[${i}] not object` };
    if (typeof v.word !== "string") return { ok: false, reason: `vocabulary_suggestions[${i}].word not string` };
    if (typeof v.meaning !== "string") return { ok: false, reason: `vocabulary_suggestions[${i}].meaning not string` };
    if (typeof v.example !== "string") return { ok: false, reason: `vocabulary_suggestions[${i}].example not string` };
  }
  if (!LEVELS.includes(x.detected_level)) return { ok: false, reason: `detected_level invalid: ${JSON.stringify(x.detected_level)}` };
  // translation_intent is optional; if present, validate shape loosely
  if (x.translation_intent != null) {
    const ti = x.translation_intent;
    if (typeof ti !== "object") return { ok: false, reason: "translation_intent not object" };
    if (typeof ti.is_translation_request !== "boolean") return { ok: false, reason: "translation_intent.is_translation_request not boolean" };
    if (typeof ti.confidence !== "number") return { ok: false, reason: "translation_intent.confidence not number" };
  }
  if (x.intent != null) {
    const it = x.intent;
    if (typeof it !== "object") return { ok: false, reason: "intent not object" };
    if (!INTENT_CATEGORIES.includes(it.category)) return { ok: false, reason: `intent.category invalid: ${JSON.stringify(it.category)}` };
    if (typeof it.confidence !== "number") return { ok: false, reason: "intent.confidence not number" };
    if (typeof it.reason !== "string") return { ok: false, reason: "intent.reason not string" };
    if (!Array.isArray(it.signals)) return { ok: false, reason: "intent.signals not array" };
  }
  return { ok: true };
}

function abuseCheck(text: string): string | null {
  const t = text.trim();
  if (!t) return "transcript_empty";
  if (t.length > 1000) return "transcript_too_long";
  const distinct = new Set(t.replace(/\s/g, "").toLowerCase()).size;
  if (distinct < 2) return "transcript_spam";
  const counts = new Map<string, number>();
  const stripped = t.replace(/\s/g, "");
  for (const c of stripped.toLowerCase()) counts.set(c, (counts.get(c) ?? 0) + 1);
  for (const n of counts.values()) {
    if (stripped.length >= 10 && n / stripped.length > 0.4) return "transcript_spam";
  }
  const tokens = t.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length >= 4) {
    const wc = new Map<string, number>();
    for (const w of tokens) wc.set(w, (wc.get(w) ?? 0) + 1);
    for (const n of wc.values()) {
      if (n / tokens.length > 0.6) return "transcript_spam";
    }
  }
  return null;
}

async function logUsage(row: Record<string, unknown>) {
  try {
    await admin.from("ai_usage_logs").insert(row);
  } catch (_e) {
    // swallow logging errors
  }
}

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    conversational_reply: { type: "STRING" },
    encouragement: { type: "STRING" },
    follow_up_question: { type: "STRING" },
    mistakes: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          type: { type: "STRING", enum: ["grammar", "fluency", "vocabulary"] },
          original: { type: "STRING" },
          suggestion: { type: "STRING" },
          explanation: { type: "STRING" },
        },
        required: ["type", "original", "suggestion", "explanation"],
      },
    },
    vocabulary_suggestions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          word: { type: "STRING" },
          meaning: { type: "STRING" },
          example: { type: "STRING" },
        },
        required: ["word", "meaning", "example"],
      },
    },
    detected_level: { type: "STRING", enum: LEVELS },
    translation_intent: {
      type: "OBJECT",
      properties: {
        is_translation_request: { type: "BOOLEAN" },
        source_language: { type: "STRING", enum: ["he", "en", "mixed", "unknown"] },
        target_language: { type: "STRING", enum: ["he", "en", "unknown"] },
        token: { type: "STRING" },
        token_type: { type: "STRING", enum: ["hebrew_word", "english_word", "proper_name", "unknown"] },
        confidence: { type: "NUMBER" },
        needs_clarification: { type: "BOOLEAN" },
        clarification_question: { type: "STRING" },
        notes: { type: "STRING" },
      },
      required: [
        "is_translation_request",
        "source_language",
        "target_language",
        "token",
        "token_type",
        "confidence",
        "needs_clarification",
        "clarification_question",
        "notes",
      ],
    },
    intent: {
      type: "OBJECT",
      properties: {
        category: {
          type: "STRING",
          enum: ["translation", "grammar", "vocabulary", "pronunciation", "free_conversation"],
        },
        confidence: { type: "NUMBER" },
        reason: { type: "STRING" },
        signals: { type: "ARRAY", items: { type: "STRING" } },
      },
      required: ["category", "confidence", "reason", "signals"],
    },
  },
  required: [
    "conversational_reply",
    "encouragement",
    "follow_up_question",
    "mistakes",
    "vocabulary_suggestions",
    "detected_level",
    "translation_intent",
    "intent",
  ],
};

async function callGemini(systemInstruction: string, contents: any[]): Promise<{ data: any; latencyMs: number; httpStatus: number; errorText?: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      return { data: null, latencyMs, httpStatus: res.status, errorText };
    }
    const data = await res.json();
    return { data, latencyMs, httpStatus: res.status };
  } finally {
    clearTimeout(timer);
  }
}

export function buildSystemInstruction(
  profile: { level?: string | null; tutor_style?: string | null; native_language?: string | null },
  context: { mode: "free_talk" | "guided"; scenario?: string | null; turnNumber: number },
) {
  const level = profile.level || "B1";
  const style = profile.tutor_style || "friendly";
  const native = profile.native_language || "Hebrew";
  const isBeginner = level === "A1" || level === "A2";
  const isAdvanced = level === "C1" || level === "C2";

  const base = [
    "You are Aria, a warm, encouraging English speaking coach for Hebrew-speaking adult learners in Israel.",
    `Learner CEFR level: ${level}. Tutor style: ${style}. Native language: ${native}.`,
    "Talk like a real human coach over coffee — warm, friendly, spoken-style. NOT like a grammar report.",
    "conversational_reply: react genuinely to WHAT the learner said first (1–2 short sentences), like you actually heard them. Don't open with praise. Vary your wording every turn — never reuse openers like 'Great job', 'Awesome', 'Nice job', 'Well done'. Often skip praise entirely and just respond to the content.",
    "follow_up_question: ONE short, simple, genuinely curious question that flows from what they said. Don't quiz them.",
    "encouragement: keep it SHORT and specific (max ~8 words), or leave it as an empty string most turns. Never use generic praise like 'Great job!' or 'You're doing great!'. Prefer specific notes like 'nice use of past tense' — or just \"\".",
    "mistakes: pick AT MOST 1–2 corrections per turn — only the most useful one(s). If the learner is understandable, return an empty array and say so naturally in the reply. Never list more than 2. Each explanation must be 1 short sentence, conversational, not textbook-style.",
    "vocabulary_suggestions: usually empty []. Only add 1 item when a specific word would genuinely unlock what they're trying to say.",
    "detected_level: your best CEFR estimate; update as they show new ability.",
    "Return ONLY JSON matching the provided schema. No markdown, no commentary outside JSON.",
  ];

  base.push(
    "TRANSLATION REQUESTS: If the learner's message contains Hebrew words — especially patterns like 'How do you say X?', 'איך אומרים X?', 'מה זה X באנגלית?', or just a bare Hebrew word/phrase — treat it as a translation request. In conversational_reply: (1) give the English translation(s) (e.g., 'house / home'), (2) one short natural example sentence in English, (3) a brief Hebrew clarification ONLY when the nuance matters (e.g., house vs home), (4) flow into the chat with a simple follow-up question that invites them to use the new word. Do NOT put the translation inside the mistakes array — it's not a mistake. Keep mistakes empty for pure translation turns unless there's also a clear error worth fixing.",
  );

  base.push(
    "TRANSLATION INTENT DETECTION — you MUST always populate the translation_intent field, even when the turn is not a translation request (set is_translation_request=false). Before answering any translation-style turn, detect: (a) source_language (he/en/mixed/unknown), (b) target_language (he/en/unknown), (c) the specific token the learner is asking about, (d) token_type — 'hebrew_word' (Hebrew letters, real Hebrew vocabulary), 'english_word' (an English dictionary word transliterated or written in Latin letters), 'proper_name' (a person/place/brand name like 'Caleb', 'David', 'London'), or 'unknown' (ambiguous, gibberish, or you can't tell), (e) confidence 0..1. RULES: (1) If token_type='proper_name', DO NOT translate — in conversational_reply say e.g. \"Caleb is already an English name.\" and briefly explain it's a proper name, then ask a friendly follow-up. (2) If token_type='hebrew_word' with confidence >= 0.7, translate normally (English word, short example, optional Hebrew nuance). (3) If confidence < 0.7 OR the token is ambiguous (e.g. could be Hebrew 'כלב'=dog or the English name 'Caleb'), set needs_clarification=true, write a short bilingual clarification_question (e.g. \"Did you mean 'כלב' (dog) or 'Caleb' the name?\"), and put that same clarification in conversational_reply — never guess. (4) Never invent a translation when confidence is low. (5) For non-translation turns, still fill translation_intent with is_translation_request=false, token=\"\", token_type='unknown', confidence reflecting your certainty that it's NOT a translation request, needs_clarification=false, clarification_question=\"\", notes=\"\".",
  );

  base.push(
    [
      "INTENT CLASSIFICATION — you MUST always populate the intent field. Pick exactly ONE category that best describes the learner's CURRENT turn, plus 0..1 confidence, a short reason (English, <=20 words), and the surface signals you detected (Hebrew or English cue phrases/tokens).",
      "Categories and how to choose:",
      "1) translation — learner asks for the meaning/translation of a specific word or phrase, OR sends a bare Hebrew word/short phrase clearly expecting a translation. Cues: 'איך אומרים X', 'מה זה X', 'מה פירוש X', 'איך כותבים X', 'תרגום', 'how do you say', 'what does X mean', 'translate', bare token like 'בית'.",
      "2) grammar — learner asks WHY/HOW a grammatical form works, or asks for an explanation of a tense/structure/rule, often in Hebrew. Cues: 'למה אומרים', 'למה זה', 'מה ההבדל בין', 'תסביר', 'תסבירי בעברית', 'explain', 'why is it', 'difference between', 'when do we use'.",
      "3) vocabulary — learner asks about word choice, synonyms, collocations, register, or which English word fits a meaning. Cues: 'איך יותר טוב לומר', 'מילה אחרת ל', 'synonym', 'better word', 'what's another word for'. Translation of a single bare token belongs to 'translation', NOT here.",
      "4) pronunciation — learner asks how a word is pronounced/sounds. Cues: 'איך מבטאים', 'איך אומרים את זה' (about sound), 'how do you pronounce', 'how is it said', IPA mentions.",
      "5) free_conversation — everything else: statements, stories, opinions, small talk, scenario roleplay turns, answering your follow-up question. Cues: any normal sentence in English or Hebrew without an explicit meta-question about the language.",
      "Disambiguation rules: (a) A bare Hebrew word/phrase with no verb defaults to 'translation' with confidence ~0.85. (b) 'מה זה X' / 'what does X mean' is ALWAYS 'translation', not vocabulary. (c) 'למה' / 'why' + a form is ALWAYS 'grammar'. (d) 'תסביר בעברית' on its own continues the previous turn's intent — re-classify by what is being explained; if unclear, use 'grammar'. (e) Hebrew sentences describing the learner's life/opinions ('אני אוהבת קפה', 'היום הייתי בים') are 'free_conversation' even though they are in Hebrew. (f) If torn between two categories, pick the more specific one and lower confidence to ~0.5–0.7.",
      "Behavioral consequences (MUST follow):",
      "- translation → follow the TRANSLATION REQUESTS rule; do NOT also lecture about grammar. mistakes=[] unless there is a separate clear error.",
      "- grammar → answer the question DIRECTLY. If the learner asked in Hebrew or said 'תסביר בעברית', explain in Hebrew (2–4 short sentences), then give ONE short English example. Do not deflect with 'great question!' filler.",
      "- vocabulary → suggest the best 1–2 English options with a one-line nuance note; optionally add one item to vocabulary_suggestions.",
      "- pronunciation → give a simple phonetic hint in plain letters (e.g. 'improve → im-PROOV'), optionally a Hebrew transliteration ('אִים־פְּרוּב'), and one short example sentence. No IPA unless the learner used it.",
      "- free_conversation → react like a human to the content first, then ONE short curious follow-up question. Stay in English unless rule (E) in BILINGUAL HANDLING applies.",
      "Never respond with generic AI filler like 'I am an AI language model', 'Sure! Here is...', 'As your tutor I...', or empty acknowledgements. Always answer the actual intent.",
    ].join(" "),
  );

  base.push(
    "BILINGUAL HANDLING — English is the PRIMARY language; Hebrew is a SUPPORT language only. Defaults: (A) Learner speaks English → reply mostly in English. Hebrew may appear only inside a correction's explanation for A1–A2 learners. (B) Learner asks for a translation (e.g. 'איך אומרים X באנגלית?', 'how do you say X?') → answer in Hebrew + English: give the English word/phrase, one short English example sentence, and a brief Hebrew gloss (e.g. 'X = …'). Follow the TRANSLATION REQUESTS rule above. (C) Learner asks for a grammar explanation (e.g. 'why is it ...?', 'מה ההבדל בין...', 'תסבירי את הזמן הזה') → explain in Hebrew so the concept lands, then give a short English example. (D) Learner explicitly says 'Explain in Hebrew' or 'תסבירי בעברית' → switch to Hebrew explanation mode for that turn (and stay in Hebrew explanation mode until they shift back to English practice). (E) Learner writes a Hebrew statement of intent (e.g. 'אני רוצה לדבר על עבודה') → ONE short Hebrew acknowledgement, then give the natural English sentence they should try in quotes, then invite them to say it in English. (F) Never refuse to understand Hebrew, never reply with vague filler. Always answer the actual question first, then gently steer them back to speaking English. Keep Hebrew short and purposeful — never translate everything.",
  );

  base.push(
    [
      "HEBREW-PRIMARY ANSWER MODE — When the learner's CURRENT turn is primarily Hebrew (more Hebrew characters than Latin letters, OR a Hebrew meta-question like 'מה זה X?', 'איך אומרים X?', 'מה ההבדל בין X ל-Y?'):",
      "1) Reply in Hebrew. Be CONCISE — 1 short sentence whenever possible, max 2 short sentences.",
      "2) Answer ONLY the exact question that was asked. Do NOT add example sentences, pronunciation hints, vocabulary exercises, or follow-up questions automatically.",
      "3) Set follow_up_question=\"\" and encouragement=\"\". Set mistakes=[] and vocabulary_suggestions=[].",
      "4) When giving an English word inside a Hebrew sentence, keep the English word in Latin letters (e.g. 'House פירושו בית.' or 'House.').",
      "5) Examples of correct answers:",
      "   - User: 'מה זה family?' → conversational_reply: 'Family פירושו משפחה.'",
      "   - User: 'איך אומרים בית באנגלית?' → conversational_reply: 'House.'",
      "   - User: 'מה ההבדל בין house ל-home?' → conversational_reply: 'House מתייחס למבנה פיזי. Home מתייחס למקום שמרגיש בית.'",
      "6) ONLY add an example sentence if the learner EXPLICITLY asks for one with phrases like 'תני דוגמה', 'תני משפט לדוגמה', 'אפשר דוגמה?', 'give me an example'. Otherwise NO examples.",
      "7) Do NOT switch to English teaching mode or steer them back to English in this turn. Just answer.",
      "This rule OVERRIDES rules (B), (C), (E) above and the TRANSLATION REQUESTS rule when the learner's turn is primarily Hebrew. English-primary turns are unchanged.",
    ].join(" "),
  );

  if (isBeginner) {
    base.push(
      "Beginner (A1–A2): very simple English, short sentences. conversational_reply stays in English. For corrections, the explanation field MAY include one short friendly Hebrew clause prefixed 'בעברית: …' when it actually reduces confusion — keep it short, don't translate everything. Tone: warm and patient.",
    );
  } else if (isAdvanced) {
    base.push(
      "Advanced (C1–C2): natural, idiomatic English only — no Hebrew. Minimal corrections (often []). Ask richer, more thought-provoking follow-ups.",
    );
  } else {
    base.push(
      "Intermediate (B1–B2): natural conversational English. Hebrew only inside a correction's explanation if a concept is genuinely confusing — otherwise English.",
    );
  }

  if (context.mode === "guided" && context.scenario) {
    base.push(
      `Guided practice scenario: "${context.scenario}". You LEAD the roleplay — set the scene briefly, play the relevant role (e.g., interviewer, waiter, hotel receptionist, colleague), and steer the conversation to stay on this scenario.`,
    );
    if (context.turnNumber <= 1) {
      base.push(
        "This is the opening turn. If the learner wrote in Hebrew, acknowledge warmly in one short Hebrew clause, then switch to English to start the scenario. From the next turn onward, conduct the roleplay in English.",
      );
    } else {
      base.push("Keep the roleplay running in English. Stay in character for the scenario.");
    }
  } else {
    base.push("Free Talk mode: follow the learner's topic. Adapt difficulty to their detected level.");
    if (context.turnNumber <= 1) {
      base.push("If the learner wrote in Hebrew, acknowledge briefly then continue in English.");
    }
  }

  return base.join(" ");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  // Auth
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "unauthenticated" });
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return json(401, { error: "unauthenticated" });
  const jwtUserId = userData.user.id;

  // Parse body
  let body: any;
  try { body = await req.json(); } catch { return json(400, { error: "invalid_json" }); }
  const conversationIdInput: string | undefined = typeof body?.conversationId === "string" ? body.conversationId : undefined;
  const userText: string = typeof body?.userText === "string" ? body.userText : "";
  const modeInput: "free_talk" | "guided" =
    body?.mode === "guided" ? "guided" : "free_talk";
  const scenarioInput: string | null =
    typeof body?.scenario === "string" && body.scenario.trim()
      ? body.scenario.trim().slice(0, 80)
      : null;

  // Validate transcript
  const abuse = abuseCheck(userText);
  if (abuse) {
    await logUsage({ user_id: jwtUserId, event: "validation_error", error_code: abuse, transcript_length: userText.length });
    return json(400, { error: abuse });
  }
  const cleanText = userText.trim();

  // Rate limits
  const nowIso = new Date().toISOString();
  const minuteAgo = new Date(Date.now() - 60_000).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60_000).toISOString();

  const { count: minuteCount } = await admin
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", jwtUserId)
    .eq("role", "user")
    .gte("created_at", minuteAgo);
  if ((minuteCount ?? 0) >= 10) {
    await logUsage({ user_id: jwtUserId, event: "rate_limit_minute", transcript_length: cleanText.length });
    return json(429, { error: "rate_limit_minute", retry_after: 60, message: "Whoa, slow down! Try again in a few seconds." });
  }
  const { count: dayCount } = await admin
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", jwtUserId)
    .eq("role", "user")
    .gte("created_at", dayAgo);
  if ((dayCount ?? 0) >= 200) {
    await logUsage({ user_id: jwtUserId, event: "rate_limit_day", transcript_length: cleanText.length });
    return json(429, { error: "rate_limit_day", message: "You've hit today's practice limit. Come back tomorrow!" });
  }

  // Resolve conversation
  let conversationId = conversationIdInput;
  let convMetaCached: { mode: string | null; scenario: string | null } | null = null;
  if (conversationId) {
    const { data: conv } = await admin
      .from("conversations")
      .select("id, user_id, mode, scenario")
      .eq("id", conversationId)
      .maybeSingle();
    if (!conv || conv.user_id !== jwtUserId) return json(403, { error: "forbidden_conversation" });
    convMetaCached = { mode: (conv as any).mode ?? null, scenario: (conv as any).scenario ?? null };
  } else {
    const { data: newConv, error: convErr } = await admin
      .from("conversations")
      .insert({
        user_id: jwtUserId,
        started_at: nowIso,
        mode: modeInput,
        scenario: modeInput === "guided" ? scenarioInput : null,
      })
      .select("id")
      .single();
    if (convErr || !newConv) return json(500, { error: "conversation_create_failed" });
    conversationId = newConv.id;
    convMetaCached = { mode: modeInput, scenario: modeInput === "guided" ? scenarioInput : null };
  }

  // Parallel: profile + last 4 messages
  const [profileRes, historyRes] = await Promise.all([
    admin.from("profiles").select("level, tutor_style, native_language").eq("id", jwtUserId).maybeSingle(),
    admin
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(4),
  ]);
  const profile = profileRes.data;
  const historyDesc = historyRes.data;
  const history = (historyDesc ?? []).slice().reverse();

  // Duplicate check (last user message)
  const lastUser = [...history].reverse().find((m) => m.role === "user");
  if (lastUser && lastUser.content.trim().toLowerCase() === cleanText.toLowerCase()) {
    await logUsage({ user_id: jwtUserId, event: "validation_error", error_code: "transcript_duplicate", transcript_length: cleanText.length });
    return json(400, { error: "transcript_duplicate" });
  }

  // Build Gemini contents
  const contents = [
    ...history.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    { role: "user", parts: [{ text: cleanText }] },
  ];
  const turnNumber = history.filter((m) => m.role === "user").length + 1;
  const systemInstruction = buildSystemInstruction(profile ?? {}, {
    mode: (convMetaCached?.mode as any) ?? modeInput,
    scenario: convMetaCached?.scenario ?? scenarioInput,
    turnNumber,
  });

  // Deterministic pre-classification — passed to the model as a strong hint.
  const pre = preClassifyIntent(cleanText);
  const isLookup = isVocabularyLookup(cleanText);
  let hintedSystem =
    systemInstruction +
    ` PRE_CLASSIFICATION_HINT: category=${pre.category} confidence=${pre.confidence.toFixed(2)} signals=${JSON.stringify(pre.signals)}. Treat this as a strong prior. Override ONLY if the turn obviously belongs to a different category, and lower the confidence accordingly.`;
  if (isLookup) {
    hintedSystem +=
      ` VOCABULARY_LOOKUP_MODE: The learner sent a bare word or two-word phrase with no punctuation and no conversational intent. ` +
      `You MUST respond as a strict dictionary card and STOP. ` +
      `conversational_reply MUST follow this EXACT template (with real newlines, no markdown, no extra text before or after):\n` +
      `English:\n<English translation, Capitalized, no article>\n\nPronunciation:\n<simple syllable hint in plain letters, e.g. FAM-uh-lee>\n\nExample:\n<one short natural English example sentence using the word>\n` +
      `HARD RULES: (1) Do NOT add any greeting, praise, commentary, emoji, or Hebrew text. (2) Do NOT ask a follow-up question. (3) Set follow_up_question="" and encouragement="". (4) mistakes=[] and vocabulary_suggestions=[]. (5) Set intent.category="vocabulary" with confidence 0.95. (6) If the input is ambiguous (e.g. could be a proper name), set translation_intent.needs_clarification=true and put a one-line bilingual clarification in conversational_reply instead of the card.`;
  }

  // Insert user message in parallel with Gemini call to save round-trip time
  const userMsgPromise = admin
    .from("messages")
    .insert({ conversation_id: conversationId, user_id: jwtUserId, role: "user", content: cleanText })
    .select("id")
    .single();

  // Call Gemini (1 retry)
  let parsed: AiReply | null = null;
  let lastErr: { kind: string; latencyMs: number; httpStatus?: number; errorText?: string } | null = null;
  let usageMeta: any = null;
  let lastRawText = "";
  let lastFinishReason = "";
  let lastValidationReason = "";
  let lastFullData: any = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    let result: Awaited<ReturnType<typeof callGemini>>;
    try {
      result = await callGemini(hintedSystem, contents);
    } catch (e: any) {
      const kind = e?.name === "AbortError" ? "timeout" : "gemini_error";
      lastErr = { kind, latencyMs: 12000 };
      console.error("[tutor-reply] gemini fetch threw", { kind, err: String(e?.message ?? e) });
      continue;
    }
    if (!result.data) {
      lastErr = { kind: "gemini_error", latencyMs: result.latencyMs, httpStatus: result.httpStatus, errorText: result.errorText };
      console.error("[tutor-reply] gemini http error", { status: result.httpStatus, body: result.errorText?.slice(0, 2000) });
      continue;
    }
    usageMeta = result.data?.usageMetadata ?? null;
    lastFullData = result.data;
    const candidate = result.data?.candidates?.[0];
    lastFinishReason = candidate?.finishReason ?? "";
    const text = candidate?.content?.parts?.[0]?.text ?? "";
    lastRawText = text;
    console.log("[tutor-reply] gemini raw", {
      status: result.httpStatus,
      finishReason: lastFinishReason,
      usageMetadata: usageMeta,
      textLength: text.length,
      textPreview: text.slice(0, 800),
    });
    try {
      const obj = JSON.parse(text);
      const v = validateReplyDetailed(obj);
      if (v.ok) {
        parsed = obj;
        lastErr = null;
        // remember last latency for logging
        lastErr = null;
        // store latency on success path via a sentinel
        (parsed as any).__latencyMs = result.latencyMs;
        break;
      }
      lastValidationReason = v.reason ?? "unknown";
      console.error("[tutor-reply] validation failed", { reason: lastValidationReason, parsedKeys: Object.keys(obj ?? {}) });
      lastErr = { kind: "malformed_response", latencyMs: result.latencyMs };
    } catch (e) {
      lastValidationReason = `JSON.parse failed: ${String((e as Error)?.message ?? e)}`;
      console.error("[tutor-reply] JSON.parse failed", { err: lastValidationReason, textPreview: text.slice(0, 800) });
      lastErr = { kind: "malformed_response", latencyMs: result.latencyMs };
    }
  }

  if (!parsed) {
    await logUsage({
      user_id: jwtUserId,
      event: lastErr?.kind ?? "gemini_error",
      model: MODEL,
      latency_ms: lastErr?.latencyMs,
      transcript_length: cleanText.length,
      error_code: lastErr?.httpStatus ? String(lastErr.httpStatus) : undefined,
    });
    return json(502, {
      error: "malformed_ai_response",
      message: "Aria got tongue-tied — try that again.",
      debug: {
        kind: lastErr?.kind,
        httpStatus: lastErr?.httpStatus,
        errorText: lastErr?.errorText?.slice(0, 1000),
        finishReason: lastFinishReason,
        validationReason: lastValidationReason,
        rawTextLength: lastRawText.length,
        rawTextPreview: lastRawText.slice(0, 1500),
        usageMetadata: usageMeta,
        candidatesCount: lastFullData?.candidates?.length ?? 0,
        promptFeedback: lastFullData?.promptFeedback ?? null,
      },
    });
  }

  const latencyMs = (parsed as any).__latencyMs as number | undefined;
  delete (parsed as any).__latencyMs;

  // Enforce vocabulary-lookup contract regardless of model output.
  if (isLookup) {
    parsed.follow_up_question = "";
    parsed.encouragement = "";
    parsed.mistakes = [];
    parsed.vocabulary_suggestions = [];
    if (parsed.intent) {
      parsed.intent.category = "vocabulary";
    }
  }

  if (parsed.translation_intent) {
    console.log("[tutor-reply] translation_intent", parsed.translation_intent);
  }
  if (parsed.intent) {
    console.log("[tutor-reply] intent", parsed.intent);
  }

  // Await the user-message insert that ran in parallel with Gemini.
  const { data: userMsg, error: userMsgErr } = await userMsgPromise;
  if (userMsgErr || !userMsg) return json(500, { error: "message_insert_failed" });

  // Insert assistant message
  const { data: asstMsg, error: asstErr } = await admin
    .from("messages")
    .insert({
      conversation_id: conversationId,
      user_id: jwtUserId,
      role: "assistant",
      content: parsed.conversational_reply,
      metadata: {
        encouragement: parsed.encouragement,
        follow_up_question: parsed.follow_up_question,
        vocabulary_suggestions: parsed.vocabulary_suggestions,
        detected_level: parsed.detected_level,
      },
    })
    .select("id")
    .single();
  if (asstErr || !asstMsg) return json(500, { error: "assistant_insert_failed" });

  // Insert corrections
  if (parsed.mistakes.length > 0) {
    await admin.from("corrections").insert(
      parsed.mistakes.map((m) => ({
        message_id: userMsg.id,
        user_id: jwtUserId,
        type: m.type,
        original: m.original,
        suggestion: m.suggestion,
        explanation: m.explanation,
      })),
    );
  }

  // Update conversation counters
  const { count: msgCount } = await admin
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId);
  await admin
    .from("conversations")
    .update({ message_count: msgCount ?? 0, detected_level: parsed.detected_level })
    .eq("id", conversationId)
    .eq("user_id", jwtUserId);

  // Usage log
  const promptTokens = usageMeta?.promptTokenCount ?? null;
  const completionTokens = usageMeta?.candidatesTokenCount ?? null;
  const totalTokens = usageMeta?.totalTokenCount ?? null;
  const costEstimate =
    promptTokens != null && completionTokens != null
      ? (promptTokens * PRICE_IN_PER_1M + completionTokens * PRICE_OUT_PER_1M) / 1_000_000
      : null;
  await logUsage({
    user_id: jwtUserId,
    event: "request",
    model: MODEL,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokens,
    cost_estimate_usd: costEstimate,
    latency_ms: latencyMs,
    transcript_length: cleanText.length,
  });

  return json(200, {
    conversationId,
    assistantMessageId: asstMsg.id,
    userMessageId: userMsg.id,
    conversational_reply: parsed.conversational_reply,
    encouragement: parsed.encouragement,
    follow_up_question: parsed.follow_up_question,
    mistakes: parsed.mistakes,
    vocabulary_suggestions: parsed.vocabulary_suggestions,
    detected_level: parsed.detected_level,
    translation_intent: parsed.translation_intent ?? null,
    intent: parsed.intent ?? null,
  });
});