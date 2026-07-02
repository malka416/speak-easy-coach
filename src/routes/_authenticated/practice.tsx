import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { StatTile } from "@/components/gamified/StatTile";
import { Flame, Star, Mic, Sparkles, Settings as SettingsIcon, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis";

import { LiveTranscript } from "@/components/practice/LiveTranscript";
import { ConversationFeed, type FeedMessage } from "@/components/practice/ConversationFeed";
import { FeedbackPanel, type Mistake, type VocabItem } from "@/components/practice/FeedbackPanel";
import { SessionHeader } from "@/components/practice/SessionHeader";
import { useDevMode } from "@/lib/dev-mode";

export const Route = createFileRoute("/_authenticated/practice")({
  head: () => ({ meta: [{ title: "Practice — Speak Easy" }] }),
  component: Practice,
});

function Practice() {
  const [session, setSession] = useState<{ mode: "free_talk" | "guided"; scenario: string | null; initialText?: string; initialLang?: "en-US" | "he-IL" } | null>(null);
  if (session) return <Session mode={session.mode} scenario={session.scenario} initialText={session.initialText} initialLang={session.initialLang} onExit={() => setSession(null)} />;
  return <Dashboard onStart={(mode, scenario, opts) => setSession({ mode, scenario, ...(opts ?? {}) })} />;
}

const SCENARIOS: { key: string; he: string; en: string }[] = [
  { key: "Travel", he: "טיולים", en: "Travel" },
  { key: "Job Interview", he: "ראיון עבודה", en: "Job Interview" },
  { key: "Restaurant", he: "מסעדה", en: "Restaurant" },
  { key: "Hotel", he: "מלון", en: "Hotel" },
  { key: "Business English", he: "אנגלית עסקית", en: "Business English" },
  { key: "Small Talk", he: "סמול טוק", en: "Small Talk" },
  { key: "Studies", he: "לימודים", en: "Studies" },
];

function Dashboard({ onStart }: { onStart: (mode: "free_talk" | "guided", scenario: string | null, opts?: { initialText?: string; initialLang?: "en-US" | "he-IL" }) => void }) {
  const [picker, setPicker] = useState<null | "guided">(null);
  const [custom, setCustom] = useState("");
  const [freeTalkText, setFreeTalkText] = useState("");
  const sr = useSpeechRecognition({ lang: "en-US", silenceTimeoutMs: 2500 });
  const [dashMicMode, setDashMicMode] = useState<"en" | "he">("en");
  const devMode = useDevMode();
  const submitFreeTalkText = () => {
    const text = freeTalkText.trim();
    if (!text) return;
    onStart("free_talk", null, { initialText: text, initialLang: /[\u0590-\u05FF]/.test(text) ? "he-IL" : "en-US" });
  };
  const handleDashMicTap = async (which: "en" | "he") => {
    setDashMicMode(which);
    const lang = which === "he" ? "he-IL" : "en-US";
    if (sr.isListening) { try { sr.stop(); } catch { /* noop */ } return; }
    sr.reset();
    await sr.start(lang);
  };
  useEffect(() => {
    if (!sr.isListening && sr.transcript.trim()) {
      const text = sr.transcript.trim();
      const lang: "en-US" | "he-IL" = /[\u0590-\u05FF]/.test(text) ? "he-IL" : "en-US";
      sr.reset();
      onStart("free_talk", null, { initialText: text, initialLang: lang });
    }
  }, [sr.isListening, sr.transcript]);
  const runSelfTest = async () => {
    try { sr.stop(); } catch { /* noop */ }
    sr.reset();
    await sr.start();
    window.setTimeout(() => { try { sr.stop(); } catch { /* noop */ } }, 5000);
    toast.message("Self-test started — speak now for ~5s");
  };
  return (
    <AppShell title="Today">
      <div className="space-y-4">
        {devMode && (
        <section className="rounded-2xl border-2 border-border bg-card/60 p-3 text-[11px] font-mono leading-relaxed text-muted-foreground">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest opacity-70">STT Debug</span>
            <button
              onClick={runSelfTest}
              disabled={!sr.isSupported || sr.isListening}
              className="rounded-md bg-tutor px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-white disabled:opacity-40"
            >
              {sr.isListening ? "Listening…" : "Run Self Test"}
            </button>
          </div>
          <div>supported: <b>{String(sr.isSupported)}</b> · permission: <b>{sr.permission}</b></div>
          <div>preview iframe: <b>{String(sr.isPreviewFrame)}</b></div>
          <div>listening: <b>{String(sr.isListening)}</b> · speaking: <b>{String(sr.isSpeaking)}</b> · gotResult: <b>{String(sr.gotResult)}</b> · timeout: <b>{String(sr.noResultTimeout)}</b> · autoStopped: <b>{String(sr.autoStopped)}</b></div>
          <div>interim: <span className="opacity-80">{sr.interim || "—"}</span></div>
          <div>final: <span className="opacity-80">{sr.transcript || "—"}</span></div>
          <div>error: <b className={sr.error ? "text-destructive" : ""}>{sr.error ?? "none"}</b></div>
          <div className="pt-1">events:</div>
          <div className="max-h-28 overflow-y-auto rounded-lg bg-muted/40 px-2 py-1">
            {sr.events.length ? sr.events.map((event, index) => (
              <div key={`${event.at}-${event.name}-${index}`}>
                {event.at} · <b>{event.name}</b>{event.detail ? ` · ${event.detail}` : ""}
              </div>
            )) : <div>—</div>}
          </div>
        </section>
        )}

        {/* Hero CTA */}
        <section className="rounded-[2rem] border-4 border-border bg-card p-4 text-center shadow-card-soft">
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-1.5 rounded-full border border-border bg-background p-1.5 shadow-sm">
              <button
                type="button"
                onClick={() => handleDashMicTap("en")}
                disabled={!sr.isSupported}
                className={`flex h-10 shrink-0 items-center justify-center gap-1 rounded-full px-2.5 transition-all active:scale-95 ${sr.isListening && dashMicMode === "en" ? "bg-tutor text-white animate-pulse" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                aria-label="Start English mic"
              >
                <Mic className="h-4 w-4" strokeWidth={2.5} />
                <span className="text-[10px] font-extrabold uppercase tracking-widest">EN</span>
              </button>
              <button
                type="button"
                onClick={() => handleDashMicTap("he")}
                disabled={!sr.isSupported}
                className={`flex h-10 shrink-0 items-center justify-center gap-1 rounded-full px-2.5 transition-all active:scale-95 ${sr.isListening && dashMicMode === "he" ? "bg-tutor text-white animate-pulse" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                aria-label="Start Hebrew mic"
              >
                <Mic className="h-4 w-4" strokeWidth={2.5} />
                <span className="text-[10px] font-extrabold" dir="rtl" lang="he">עב</span>
              </button>
              <input
                type="text"
                value={freeTalkText}
                onChange={(e) => setFreeTalkText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submitFreeTalkText(); }}
                placeholder="Type or speak in Hebrew or English..."
                className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                dir="auto"
              />
              <button
                onClick={submitFreeTalkText}
                disabled={!freeTalkText.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tutor text-white transition-all active:scale-95 disabled:opacity-50"
                aria-label="Send"
              >
                <Send className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2">
            <button
              onClick={() => onStart("free_talk", null)}
              className="rounded-2xl bg-tutor py-3 text-white shadow-tactile transition-all active:translate-y-1.5 active:shadow-none"
            >
              <span className="block text-base font-extrabold" dir="rtl" lang="he">שיחה חופשית</span>
              <span className="block text-[10px] font-bold uppercase tracking-widest opacity-80">Free Talk</span>
            </button>
            <button
              onClick={() => setPicker(picker ? null : "guided")}
              className="rounded-2xl border-4 border-border bg-card py-3 text-foreground shadow-tactile transition-all active:translate-y-1.5 active:shadow-none"
            >
              <span className="block text-base font-extrabold" dir="rtl" lang="he">תרגול מודרך</span>
              <span className="block text-[10px] font-bold uppercase tracking-widest opacity-70">Guided Practice</span>
            </button>
          </div>

          {picker === "guided" && (
            <div className="mt-4 space-y-3 text-left">
              <p className="text-xs font-bold text-muted-foreground" dir="rtl" lang="he">בחרו תרחיש:</p>
              <div className="flex flex-wrap gap-2">
                {SCENARIOS.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => onStart("guided", s.key)}
                    className="rounded-full border-2 border-border bg-background px-3 py-2 text-xs font-bold transition-transform active:scale-95"
                  >
                    <span dir="rtl" lang="he">{s.he}</span>
                    <span className="ml-1 opacity-60">· {s.en}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  placeholder="נושא מותאם אישית · Custom topic"
                  className="flex-1 rounded-xl border-2 border-border bg-background px-3 py-2 text-sm"
                />
                <button
                  onClick={() => custom.trim() && onStart("guided", custom.trim())}
                  disabled={!custom.trim()}
                  className="rounded-xl bg-tutor px-4 py-2 text-xs font-extrabold uppercase tracking-widest text-white disabled:opacity-50"
                >
                  Start
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Streak + XP bento */}
        <div className="grid grid-cols-2 gap-4">
          <StatTile tone="streak" label="רצף ימים · Day Streak" value="7" icon={<Flame className="h-8 w-8" />} />
          <StatTile tone="xp" label="סה״כ XP · Total XP" value="1,240" icon={<Star className="h-8 w-8" fill="currentColor" />} />
        </div>

        {/* Weekly goal */}
        <section className="rounded-[2rem] [background-image:var(--gradient-primary)] p-6 text-white shadow-lg">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[11px] font-extrabold opacity-80" dir="rtl" lang="he">
                יעד שבועי · Weekly Goal
              </p>
              <p className="mt-1 font-display text-xl font-extrabold" dir="rtl" lang="he">מומחי שיחה</p>
            </div>
            <span className="font-display text-2xl font-extrabold">85%</span>
          </div>
          <div className="mt-4 h-4 overflow-hidden rounded-full bg-white/20 p-1">
            <div className="h-full rounded-full bg-white" style={{ width: "85%" }} />
          </div>
          <div className="mt-3 flex justify-between text-[10px] font-bold opacity-80">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <span key={i} className={i < 5 ? "" : "opacity-40"}>
                {d}
              </span>
            ))}
          </div>
        </section>

        {/* Quick access */}
        <div className="grid grid-cols-2 gap-4">
          <button className="flex flex-col items-center gap-2 rounded-3xl border-4 border-border bg-card p-4 transition-transform active:scale-95">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-goal/10 text-goal">
              <Sparkles className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <span className="text-[11px] font-extrabold text-muted-foreground" dir="rtl" lang="he">
              סגנון מורה
            </span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/70">Tutor Tone</span>
          </button>
          <button className="flex flex-col items-center gap-2 rounded-3xl border-4 border-border bg-card p-4 transition-transform active:scale-95">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-xp/10 text-xp">
              <SettingsIcon className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <span className="text-[11px] font-extrabold text-muted-foreground" dir="rtl" lang="he">
              רמה
            </span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/70">Level</span>
          </button>
        </div>
      </div>
    </AppShell>
  );
}

function Session({ onExit, mode, scenario, initialText, initialLang }: { onExit: () => void; mode: "free_talk" | "guided"; scenario: string | null; initialText?: string; initialLang?: "en-US" | "he-IL" }) {
  const [micMode, setMicMode] = useState<"en" | "he">(initialLang === "he-IL" ? "he" : "en");
  const activeMicRef = useRef<"en" | "he">(micMode);
  const recogLang: "en-US" | "he-IL" = micMode === "he" ? "he-IL" : "en-US";
  const sr = useSpeechRecognition({ lang: recogLang, silenceTimeoutMs: 2500 });
  const [lastSentMessage, setLastSentMessage] = useState<string>("");
  const tts = useSpeechSynthesis({ lang: "en-US" });
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<FeedMessage[]>([]);
  const [feedbackByMsg, setFeedbackByMsg] = useState<Record<string, { encouragement?: string; mistakes: Mistake[]; vocabulary: VocabItem[]; followUp?: string }>>({});
  const [processing, setProcessing] = useState(false);
  const [xp, setXp] = useState(0);
  const [typed, setTyped] = useState("");
  const [showDebug, setShowDebug] = useState(true);
  const devMode = useDevMode();
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  // Do NOT auto-focus the textarea on mount: on mobile it opens the keyboard
  // and the browser scrolls the document to keep the input in view, which
  // looks like the page "jumping" upward.
  const [sendStatus, setSendStatus] = useState<"idle" | "sending" | "waiting" | "replied" | "error">("idle");
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastDebug, setLastDebug] = useState<any>(null);
  const [lastTranslationIntent, setLastTranslationIntent] = useState<any>(null);
  const [lastIntent, setLastIntent] = useState<any>(null);
  const submittedRef = useRef<string>("");
  const startedAt = useRef<number>(Date.now());
  const sttStartRef = useRef<number | null>(null);
  const [sttMs, setSttMs] = useState<number | null>(null);
  const [geminiMs, setGeminiMs] = useState<number | null>(null);
  const [totalMs, setTotalMs] = useState<number | null>(null);

  // Track STT duration: from start() to onend
  const prevListeningRef = useRef(false);
  useEffect(() => {
    if (sr.isListening && !prevListeningRef.current) {
      sttStartRef.current = performance.now();
      setSttMs(null);
    } else if (!sr.isListening && prevListeningRef.current && sttStartRef.current != null) {
      setSttMs(Math.round(performance.now() - sttStartRef.current));
    }
    prevListeningRef.current = sr.isListening;
  }, [sr.isListening]);

  // Surface SR errors
  useEffect(() => {
    if (!sr.error) return;
    const map: Record<string, string> = {
      "not-allowed": "אין גישה למיקרופון. הפעילו אותו בהגדרות הדפדפן.",
      "no-speech": "לא קלטתי — ננסה שוב?",
      "network": "תקלת חיבור — נסו שוב.",
      "not-supported": "הדפדפן לא תומך בדיבור. נסו ב-Chrome.",
      "aborted": "",
      "unknown": "משהו השתבש — נסו שוב.",
    };
    const msg = map[sr.error];
    if (msg) toast.error(msg);
  }, [sr.error]);

  const sessionEnd = async () => {
    try { tts.cancel(); sr.stop(); } catch { /* noop */ }
    if (conversationId) {
      await supabase
        .from("conversations")
        .update({
          ended_at: new Date().toISOString(),
          message_count: messages.length,
          xp_earned: xp,
        })
        .eq("id", conversationId);
    }
    onExit();
  };

  const sendTurn = async (raw: string) => {
    const text = raw.trim().slice(0, 1000);
    if (!text) { toast.error("I didn't catch that — try again?"); return; }
    setLastSentMessage(text);
    if (devMode) console.log("[mic] finalMessageSent", { text, selectedMicLanguage: activeMicRef.current, recogLang });
    setProcessing(true);
    setSendStatus("sending");
    setLastError(null);
    setGeminiMs(null);
    setTotalMs(null);
    const turnStart = performance.now();
    const tempId = `local-${Date.now()}`;
    const typingId = `typing-${Date.now()}`;
    // Optimistic: user message + Aria typing placeholder appear instantly
    setMessages((m) => [
      ...m,
      { id: tempId, role: "user", content: text },
      { id: typingId, role: "assistant", content: "אריה חושבת…  ·  Aria is thinking…", tag: "Aria" },
    ]);
    try {
      setSendStatus("waiting");
      const gStart = performance.now();
      const { data, error } = await supabase.functions.invoke("tutor-reply", {
        body: { conversationId: conversationId ?? undefined, userText: text, mode, scenario },
      });
      setGeminiMs(Math.round(performance.now() - gStart));
      if (error) {
        // Remove typing placeholder on error
        setMessages((m) => m.filter((x) => x.id !== typingId));
        // FunctionsHttpError surfaces server response via error.context
        const ctx: any = (error as any).context;
        let payload: any = null;
        try { payload = ctx ? await ctx.json() : null; } catch { /* noop */ }
        const code = payload?.error;
        const friendly: Record<string, string> = {
          rate_limit_minute: "רגע, לאט לאט! נסו שוב בעוד כמה שניות.",
          rate_limit_day: "הגעתם למכסת התרגול היומית. נתראה מחר!",
          transcript_too_long: "זה היה ארוך מדי — נסו תור קצר יותר.",
          transcript_empty: "לא קלטתי — ננסה שוב?",
          transcript_spam: "אמרו משהו חדש ואענה!",
          transcript_duplicate: "אמרו משהו חדש ואענה!",
          malformed_ai_response: "Aria התבלבלה — נסו שוב.",
          unauthenticated: "אנא התחברו מחדש.",
          forbidden_conversation: "לא ניתן לפתוח את השיחה הזו.",
        };
        const msg = friendly[code] ?? "תקלת חיבור — נסו שוב.";
        console.error("[tutor-reply] error", { code, error, payload });
        setLastDebug(payload?.debug ?? payload ?? { error: String(error) });
        setLastError(`${code ?? "unknown"}: ${msg}`);
        setSendStatus("error");
        toast.error(msg);
        return;
      }
      const reply = data as {
        conversationId: string;
        assistantMessageId: string;
        userMessageId: string;
        conversational_reply: string;
        encouragement: string;
        follow_up_question: string;
        mistakes: Mistake[];
        vocabulary_suggestions: VocabItem[];
        detected_level: string;
        translation_intent?: {
          is_translation_request: boolean;
          source_language: string;
          target_language: string;
          token: string;
          token_type: string;
          confidence: number;
          needs_clarification: boolean;
          clarification_question: string;
          notes: string;
        } | null;
      };
      if (!conversationId) setConversationId(reply.conversationId);
      if (reply.translation_intent) {
        setLastTranslationIntent(reply.translation_intent);
        console.log("[tutor-reply] translation_intent", reply.translation_intent);
      }
      if ((reply as any).intent) {
        setLastIntent((reply as any).intent);
        console.log("[tutor-reply] intent", (reply as any).intent);
      }
      // Replace temp user id with server id, replace typing placeholder with real reply
      setMessages((m) => {
        return m
          .map((x) => (x.id === tempId ? { ...x, id: reply.userMessageId } : x))
          .map((x) =>
            x.id === typingId
              ? { id: reply.assistantMessageId, role: "assistant" as const, content: reply.conversational_reply, tag: `Aria · ${reply.detected_level}` }
              : x,
          );
      });
      setFeedbackByMsg((f) => ({
        ...f,
        [reply.userMessageId]: {
          encouragement: reply.encouragement,
          mistakes: reply.mistakes,
          vocabulary: reply.vocabulary_suggestions,
          followUp: reply.follow_up_question,
        },
      }));
      setXp((x) => x + 10);
      const replyText = reply.conversational_reply;
      const isHebrewReply = /[\u0590-\u05FF]/.test(replyText);
      const ttsLang = isHebrewReply ? "he-IL" : "en-US";
      const ttsResult = tts.speak(replyText, ttsLang);
      if (!ttsResult.voiceFound && isHebrewReply) {
        toast.message("הדפדפן לא מצא קול עברי זמין.");
      }
      setSendStatus("replied");
      setTotalMs(Math.round(performance.now() - turnStart));
    } catch (_e) {
      setMessages((m) => m.filter((x) => x.id !== typingId));
      console.error("[tutor-reply] threw", _e);
      setLastError(String((_e as Error)?.message ?? _e));
      setSendStatus("error");
      toast.error("תקלת חיבור — נסו שוב.");
    } finally {
      setProcessing(false);
    }
  };

  const handleMicTap = async (which: "en" | "he") => {
    if (processing) return;
    if (sr.isListening) {
      const finalText = sr.transcript || sr.interim;
      sr.stop();
      const text = finalText.trim();
      sr.reset();
      if (text) await sendTurn(text);
      return;
    }
    setMicMode(which);
    activeMicRef.current = which;
    const lang: "en-US" | "he-IL" = which === "he" ? "he-IL" : "en-US";
    tts.cancel();
    submittedRef.current = "";
    setSendStatus("idle");
    if (devMode) console.log("[mic] start", { selectedMicLanguage: which, "recognition.lang": lang });
    await sr.start(lang);
  };

  // Auto-submit when recognition ends with a final transcript (continuous=false auto-ends).
  useEffect(() => {
    if (sr.isListening) return;
    const text = sr.transcript.trim();
    if (!text) return;
    if (processing) return;
    if (submittedRef.current === text) return;
    submittedRef.current = text;
    const toSend = text;
    sr.reset();
    void sendTurn(toSend);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sr.isListening, sr.transcript]);

  const micState: "idle" | "listening" | "processing" = processing ? "processing" : sr.isListening || sr.autoStopped ? "listening" : "idle";
  const turns = useMemo(() => messages.filter((m) => m.role === "user").length, [messages]);

  const submitTyped = async () => {
    const t = typed.trim();
    if (!t || processing) return;
    setTyped("");
    await sendTurn(t);
  };

  // Auto-send the dashboard's Hebrew helper text once on mount
  const initialSentRef = useRef(false);
  useEffect(() => {
    if (initialSentRef.current) return;
    const t = initialText?.trim();
    if (!t) return;
    initialSentRef.current = true;
    void sendTurn(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSelfTest = async () => {
    try { sr.stop(); } catch { /* noop */ }
    sr.reset();
    await sr.start(recogLang);
    // Auto-stop after 5s so the lifecycle (onend/timeout) reports cleanly.
    window.setTimeout(() => { try { sr.stop(); } catch { /* noop */ } }, 5000);
    toast.message("Self-test started — speak now for ~5s");
  };

  const needsFallback =
    !sr.isSupported ||
    sr.error === "not-supported" ||
    sr.error === "not-allowed" ||
    sr.error === "audio-capture" ||
    sr.error === "service-not-allowed" ||
    sr.error === "start-failed" ||
    sr.error === "network" ||
    sr.noResultTimeout;

  return (
    <div
      className="mx-auto flex w-full max-w-md flex-col bg-background px-6 pt-6 overscroll-contain"
      style={{
        height: "100dvh",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
      }}
    >
      <SessionHeader turns={turns} xp={xp} onExit={sessionEnd} />

      {!sr.isSupported && (
        <div className="mt-4 rounded-2xl border-2 border-dashed border-border bg-muted/40 px-4 py-3 text-xs font-medium text-muted-foreground space-y-1">
          <p dir="rtl" lang="he">זיהוי דיבור לא נתמך כאן. פתחו את Speak Easy ב-Chrome במחשב או באנדרואיד כדי להתחיל לתרגל.</p>
          <p className="opacity-70">Speech recognition isn't supported here. Open Speak Easy in Chrome on desktop or Android.</p>
        </div>
      )}

      {sr.isPreviewFrame && (
        <div className="mt-4 rounded-2xl border-2 border-dashed border-border bg-muted/40 px-4 py-3 text-xs font-bold text-muted-foreground">
          Voice recognition may not work inside Preview mode. Test again after publishing.
        </div>
      )}

      {devMode && (
      <div className="mt-3 rounded-xl border border-border bg-card/60 px-3 py-2 text-[10px] font-mono leading-relaxed text-muted-foreground">
        <div className="mb-1 flex items-center justify-between gap-2">
          <button onClick={() => setShowDebug((s) => !s)} className="text-[10px] font-bold uppercase tracking-widest opacity-70">
            {showDebug ? "Hide" : "Show"} STT debug
          </button>
          <button
            onClick={runSelfTest}
            disabled={!sr.isSupported || sr.isListening}
            className="rounded-md bg-tutor px-2 py-1 text-[10px] font-extrabold uppercase tracking-widest text-white disabled:opacity-40"
          >
            Run self-test
          </button>
        </div>
        {showDebug && (
          <div className="space-y-0.5">
            <div>supported: <b>{String(sr.isSupported)}</b> · permission: <b>{sr.permission}</b></div>
            <div>preview iframe: <b>{String(sr.isPreviewFrame)}</b></div>
            <div>listening: <b>{String(sr.isListening)}</b> · speaking: <b>{String(sr.isSpeaking)}</b> · gotResult: <b>{String(sr.gotResult)}</b> · timeout: <b>{String(sr.noResultTimeout)}</b> · autoStopped: <b>{String(sr.autoStopped)}</b></div>
            <div>interim: <span className="opacity-80">{sr.interim || "—"}</span></div>
            <div>final: <span className="opacity-80">{sr.transcript || "—"}</span></div>
            <div>error: <b className={sr.error ? "text-destructive" : ""}>{sr.error ?? "none"}</b></div>
            <div>selectedMicMode: <b>{micMode === "he" ? "עזרה בעברית" : "English practice"}</b></div>
            <div>recognition.lang: <b>{recogLang}</b></div>
            <div>rawTranscript: <span className="opacity-80">{sr.transcript || "—"}</span></div>
            <div>finalMessageSent: <span className="opacity-80">{lastSentMessage || "—"}</span></div>
            <div>transcriptLanguageGuess: <b>{/[\u0590-\u05FF]/.test(sr.transcript) ? "he" : sr.transcript ? "en" : "—"}</b></div>
            <div className="pt-1 border-t border-border/40 mt-1">
              send: <b>{sendStatus}</b>
              <div>timing: stt=<b>{sttMs ?? "—"}ms</b> · gemini=<b>{geminiMs ?? "—"}ms</b> · total=<b>{totalMs ?? "—"}ms</b></div>
              {lastError && <div className="text-destructive">last error: {lastError}</div>}
              {lastIntent && (
                <div className="mt-1 rounded bg-muted/40 p-2">
                  <div className="font-bold uppercase tracking-widest opacity-70">intent</div>
                  <div>category: <b>{lastIntent.category}</b> · conf: <b>{Number(lastIntent.confidence ?? 0).toFixed(2)}</b></div>
                  {lastIntent.reason && <div>reason: <span className="opacity-80">{lastIntent.reason}</span></div>}
                  {Array.isArray(lastIntent.signals) && lastIntent.signals.length > 0 && (
                    <div>signals: <span className="opacity-80">{lastIntent.signals.join(" · ")}</span></div>
                  )}
                </div>
              )}
              {lastTranslationIntent && (
                <div className="mt-1 rounded bg-muted/40 p-2">
                  <div className="font-bold uppercase tracking-widest opacity-70">translation intent</div>
                  <div>request: <b>{String(lastTranslationIntent.is_translation_request)}</b> · conf: <b>{Number(lastTranslationIntent.confidence ?? 0).toFixed(2)}</b></div>
                  <div>token: <b>{lastTranslationIntent.token || "—"}</b> · type: <b>{lastTranslationIntent.token_type}</b></div>
                  <div>src→tgt: <b>{lastTranslationIntent.source_language}</b> → <b>{lastTranslationIntent.target_language}</b></div>
                  {lastTranslationIntent.needs_clarification && (
                    <div>clarify: <span className="opacity-80">{lastTranslationIntent.clarification_question}</span></div>
                  )}
                  {lastTranslationIntent.notes && <div className="opacity-70">notes: {lastTranslationIntent.notes}</div>}
                </div>
              )}
              {lastDebug && (
                <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/40 p-2 text-[10px] leading-tight">
{JSON.stringify(lastDebug, null, 2)}
                </pre>
              )}
            </div>
            {sr.transcript && !sr.isListening && sendStatus !== "sending" && sendStatus !== "waiting" && (
              <button
                onClick={() => { const t = sr.transcript.trim(); sr.reset(); submittedRef.current = t; void sendTurn(t); }}
                className="mt-1 rounded-md bg-tutor px-2 py-1 text-[10px] font-extrabold uppercase tracking-widest text-white"
              >
                Send to Aria
              </button>
            )}
            <div className="pt-1">events:</div>
            <div className="max-h-24 overflow-y-auto rounded-lg bg-muted/40 px-2 py-1">
              {sr.events.length ? sr.events.map((event, index) => (
                <div key={`${event.at}-${event.name}-${index}`}>
                  {event.at} · <b>{event.name}</b>{event.detail ? ` · ${event.detail}` : ""}
                </div>
              )) : <div>—</div>}
            </div>
          </div>
        )}
      </div>
      )}

      <div className="mt-6 min-h-0 flex-1">
        {messages.length === 0 ? (
          <div className="flex h-full items-start gap-3 overflow-y-auto">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl [background-image:var(--gradient-primary)] font-display text-lg font-extrabold text-white">
              A
            </div>
            <div className="rounded-2xl rounded-tl-md bg-muted px-4 py-3">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Aria</p>
              <p className="mt-1 text-sm font-medium text-foreground" dir="rtl" lang="he">
                היי! הקישו על המיקרופון וספרו לי כל דבר — איך עבר היום, מה אכלתם, מקום שאתם אוהבים. אני אדאג שהשיחה תמשיך באנגלית.
              </p>
              <p className="mt-2 text-xs font-medium text-muted-foreground/80">
                Hey! Tap the mic and tell me anything — how your day went, what you ate, a place you love. I'll keep us chatting.
              </p>
            </div>
          </div>
        ) : (
          <ConversationFeed messages={messages}>
            {/* Inline feedback under each user message */}
            {messages
              .filter((m) => m.role === "user" && feedbackByMsg[m.id])
              .slice(-1)
              .map((m) => (
                <FeedbackPanel
                  key={`fb-${m.id}`}
                  encouragement={feedbackByMsg[m.id]?.encouragement}
                  mistakes={feedbackByMsg[m.id]?.mistakes ?? []}
                  vocabulary={feedbackByMsg[m.id]?.vocabulary ?? []}
                  followUp={feedbackByMsg[m.id]?.followUp}
                />
              ))}
          </ConversationFeed>
        )}
      </div>

      <div className="mt-4 space-y-3 pt-4">
        <LiveTranscript finalText={sr.transcript} interim={sr.interim} />
        {/* Unified composer: mic | textarea | send */}
        <div className="flex items-end gap-1.5 rounded-[1.75rem] border border-border bg-card p-1.5 shadow-sm transition-all focus-within:border-tutor focus-within:ring-2 focus-within:ring-tutor/20">
          <button
            onClick={() => handleMicTap("en")}
            disabled={!sr.isSupported || processing || (sr.isListening && micMode !== "en")}
            className={`flex h-10 shrink-0 items-center justify-center gap-1 rounded-full px-2.5 transition-all active:scale-95 ${sr.isListening && micMode === "en" ? "bg-tutor text-white animate-pulse" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
            aria-label={sr.isListening && micMode === "en" ? "Stop English mic" : "Start English mic"}
          >
            {processing && micMode === "en" ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />
            ) : (
              <Mic className="h-4 w-4" strokeWidth={2.5} />
            )}
            <span className="text-[10px] font-extrabold uppercase tracking-widest">EN</span>
          </button>
          <button
            onClick={() => handleMicTap("he")}
            disabled={!sr.isSupported || processing || (sr.isListening && micMode !== "he")}
            className={`flex h-10 shrink-0 items-center justify-center gap-1 rounded-full px-2.5 transition-all active:scale-95 ${sr.isListening && micMode === "he" ? "bg-tutor text-white animate-pulse" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
            aria-label={sr.isListening && micMode === "he" ? "Stop Hebrew mic" : "Start Hebrew mic"}
          >
            {processing && micMode === "he" ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />
            ) : (
              <Mic className="h-4 w-4" strokeWidth={2.5} />
            )}
            <span className="text-[10px] font-extrabold" dir="rtl" lang="he">עב</span>
          </button>

          <textarea
            ref={inputRef}
            value={typed}
            onChange={(e) => {
              setTyped(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submitTyped();
              }
            }}
            placeholder="Type or speak in Hebrew or English..."
            rows={1}
            className="min-w-0 flex-1 resize-none bg-transparent py-3 pl-1 pr-1 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            dir="auto"
            style={{ minHeight: "40px", maxHeight: "120px" }}
          />

          <button
            onClick={submitTyped}
            disabled={processing || !typed.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tutor text-white transition-all active:scale-95 disabled:opacity-50"
            aria-label="Send"
          >
            <Send className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>

        {needsFallback && (
          <div className="rounded-2xl border-2 border-dashed border-border bg-muted/40 p-3 text-center">
            <p className="text-xs font-medium text-muted-foreground" dir="rtl" lang="he">
              המיקרופון לא זמין כרגע — אפשר להקליד.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}