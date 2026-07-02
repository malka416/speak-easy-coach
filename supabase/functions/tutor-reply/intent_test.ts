import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { preClassifyIntent, type IntentCategory } from "./intent.ts";

type Case = { name: string; input: string; expect: IntentCategory };

const CASES: Case[] = [
  // translation (bare token + explicit asks)
  { name: "bare hebrew word", input: "בית", expect: "translation" },
  { name: "how do you say X (he)", input: "איך אומרים בית באנגלית", expect: "translation" },
  { name: "what does X mean (he)", input: "מה זה house", expect: "translation" },
  { name: "meaning of X (he)", input: "מה פירוש המילה improve", expect: "translation" },
  { name: "how do you say (en)", input: "How do you say bayit?", expect: "translation" },
  { name: "what does X mean (en)", input: "what does improve mean?", expect: "translation" },
  { name: "translate", input: "translate שולחן", expect: "translation" },

  // grammar
  { name: "why went not goed", input: "למה אומרים went ולא goed?", expect: "grammar" },
  { name: "explain in hebrew", input: "תסביר בעברית", expect: "grammar" },
  { name: "difference between", input: "מה ההבדל בין since ל-for?", expect: "grammar" },
  { name: "why is it (en)", input: "why is it 'have been' and not 'had been'?", expect: "grammar" },
  { name: "when do we use", input: "when do we use past perfect?", expect: "grammar" },

  // vocabulary
  { name: "another word for", input: "what's another word for happy?", expect: "vocabulary" },
  { name: "synonym he", input: "מילה אחרת ל-big", expect: "vocabulary" },
  { name: "better word", input: "give me a better word for nice", expect: "vocabulary" },

  // pronunciation
  { name: "how to pronounce", input: "how do you pronounce 'thorough'?", expect: "pronunciation" },
  { name: "how to pronounce he", input: "איך מבטאים את המילה squirrel?", expect: "pronunciation" },

  // free conversation
  { name: "he statement coffee", input: "אני אוהבת קפה", expect: "free_conversation" },
  { name: "he statement beach", input: "היום הייתי בים", expect: "free_conversation" },
  { name: "en statement", input: "Yesterday I went to the beach with my kids.", expect: "free_conversation" },

  // ===== Bare Hebrew nouns → translation (15) =====
  { name: "bare he: dog", input: "כלב", expect: "translation" },
  { name: "bare he: work", input: "עבודה", expect: "translation" },
  { name: "bare he: family", input: "משפחה", expect: "translation" },
  { name: "bare he: love", input: "אהבה", expect: "translation" },
  { name: "bare he: cat", input: "חתול", expect: "translation" },
  { name: "bare he: table", input: "שולחן", expect: "translation" },
  { name: "bare he: book", input: "ספר", expect: "translation" },
  { name: "bare he: water", input: "מים", expect: "translation" },
  { name: "bare he: sun", input: "שמש", expect: "translation" },
  { name: "bare he: school", input: "בית ספר", expect: "translation" },
  { name: "bare he: car", input: "מכונית", expect: "translation" },
  { name: "bare he: child", input: "ילד", expect: "translation" },
  { name: "bare he: friend", input: "חבר", expect: "translation" },
  { name: "bare he: morning", input: "בוקר", expect: "translation" },
  { name: "bare he: night", input: "לילה", expect: "translation" },

  // ===== Hebrew translation questions (10) =====
  { name: "how say dog", input: "איך אומרים כלב באנגלית", expect: "translation" },
  { name: "how say love", input: "איך אומרים אהבה?", expect: "translation" },
  { name: "how write apple", input: "איך כותבים apple", expect: "translation" },
  { name: "what is improve", input: "מה זה improve", expect: "translation" },
  { name: "what means awesome", input: "מה פירוש awesome", expect: "translation" },
  { name: "translation of beautiful", input: "תרגום של beautiful", expect: "translation" },
  { name: "translate this word", input: "תרגמי את המילה הזאת", expect: "translation" },
  { name: "meaning he", input: "מה המשמעות של honest", expect: "translation" },
  { name: "how say happy", input: "איך אומרים happy בעברית", expect: "translation" },
  { name: "what mean integrity", input: "מה זה integrity?", expect: "translation" },

  // ===== Hebrew grammar questions (8) =====
  { name: "why past", input: "למה אומרים was ולא were?", expect: "grammar" },
  { name: "why not", input: "למה לא אומרים goed?", expect: "grammar" },
  { name: "explain he", input: "תסביר לי את ההבדל", expect: "grammar" },
  { name: "explain fem", input: "תסבירי בעברית מתי משתמשים ב-have", expect: "grammar" },
  { name: "diff between", input: "מה ההבדל בין make ל-do", expect: "grammar" },
  { name: "why is it he", input: "למה זה 'I have been' ולא 'I was been'", expect: "grammar" },
  { name: "tense question", input: "מתי משתמשים ב past perfect tense?", expect: "grammar" },
  { name: "why this", input: "למה זה ככה?", expect: "grammar" },

  // ===== Hebrew pronunciation (4) =====
  { name: "pronounce he 1", input: "איך מבטאים thorough?", expect: "pronunciation" },
  { name: "pronounce he 2", input: "איך הוגים את המילה schedule", expect: "pronunciation" },
  { name: "pronounce he 3", input: "איך נשמע המילה squirrel", expect: "pronunciation" },
  { name: "pronounce en", input: "pronunciation of colonel", expect: "pronunciation" },

  // ===== Hebrew vocabulary (3) =====
  { name: "vocab he 1", input: "מילה אחרת ל-happy", expect: "vocabulary" },
  { name: "vocab he 2", input: "תני לי מילה יותר חזקה מ-good", expect: "vocabulary" },
  { name: "vocab he 3", input: "synonym ל-big", expect: "vocabulary" },

  // ===== Hebrew free conversation (8) =====
  { name: "he conv 1", input: "אני אוהב לרוץ בבוקר", expect: "free_conversation" },
  { name: "he conv 2", input: "אתמול הלכתי לקולנוע עם חברים", expect: "free_conversation" },
  { name: "he conv 3", input: "היום אני רוצה לדבר על העבודה שלי", expect: "free_conversation" },
  { name: "he conv 4", input: "אני גרה בתל אביב כבר חמש שנים", expect: "free_conversation" },
  { name: "he conv 5", input: "מחר יש לי פגישה חשובה", expect: "free_conversation" },
  { name: "he conv 6", input: "אני אוהבת לקרוא ספרים בערב", expect: "free_conversation" },
  { name: "he conv 7", input: "היום הייתי בים עם הילדים", expect: "free_conversation" },
  { name: "he conv 8", input: "אני רוצה לשפר את האנגלית שלי", expect: "free_conversation" },

  // ===== Mixed Hebrew + English (8) =====
  { name: "mixed: word lookup", input: "מה זה awesome", expect: "translation" },
  { name: "mixed: how say en token", input: "איך אומרים challenge", expect: "translation" },
  { name: "mixed: short wrapper", input: "ה-meeting היה ארוך", expect: "free_conversation" },
  { name: "mixed: code switch sentence", input: "I went to the חוף today", expect: "free_conversation" },
  { name: "mixed: explain word", input: "תסביר מה זה procrastinate", expect: "grammar" },
  { name: "mixed: pronounce", input: "איך מבטאים entrepreneur בעברית?", expect: "pronunciation" },
  { name: "mixed: synonym", input: "another word for חשוב", expect: "vocabulary" },
  { name: "mixed: bare token he", input: "אהבה", expect: "translation" },
];

for (const c of CASES) {
  Deno.test(`intent: ${c.name}`, () => {
    const out = preClassifyIntent(c.input);
    assertEquals(out.category, c.expect, `got ${out.category} for "${c.input}" (signals: ${JSON.stringify(out.signals)})`);
  });
}