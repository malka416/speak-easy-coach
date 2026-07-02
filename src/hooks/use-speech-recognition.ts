import { useCallback, useEffect, useRef, useState } from "react";

type SR = any;
type SpeechRecognitionLifecycleEvent = {
  name: "start()" | "onstart" | "onaudiostart" | "onspeechstart" | "onresult" | "onerror" | "onend" | "onsoundstart" | "onspeechend" | "timeout";
  detail?: string;
  at: string;
};

const LOG = (...args: unknown[]) => console.log("[SR]", ...args);

// Collapse immediate repeated words and short phrases (1-5 word windows).
// "I want I want to go to Venice Venice" -> "I want to go to Venice".
function dedupeConsecutive(input: string): string {
  if (!input) return input;
  const tokens = input.split(/(\s+)/); // keep whitespace
  const words = tokens.filter((t) => t.trim().length > 0);
  if (words.length < 2) return input.trim();
  const out: string[] = [];
  let i = 0;
  while (i < words.length) {
    let matched = false;
    for (let n = Math.min(5, Math.floor((words.length - i) / 2)); n >= 1; n--) {
      const a = words.slice(i, i + n).join(" ").toLowerCase();
      const b = words.slice(i + n, i + 2 * n).join(" ").toLowerCase();
      if (a && a === b) {
        // skip the duplicate window
        for (let k = 0; k < n; k++) out.push(words[i + k]);
        i += 2 * n;
        matched = true;
        break;
      }
    }
    if (!matched) { out.push(words[i]); i++; }
  }
  return out.join(" ");
}

function getSRCtor(): any | null {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export type SpeechRecognitionError =
  | "not-supported"
  | "not-allowed"
  | "no-speech"
  | "network"
  | "aborted"
  | "audio-capture"
  | "service-not-allowed"
  | "start-failed"
  | "unknown";

export function useSpeechRecognition(opts?: { lang?: string; silenceTimeoutMs?: number }) {
  const silenceTimeoutMs = opts?.silenceTimeoutMs ?? 2500;
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<SpeechRecognitionError | null>(null);
  const [permission, setPermission] = useState<"unknown" | "granted" | "denied" | "prompt">("unknown");
  const [gotResult, setGotResult] = useState(false);
  const [noResultTimeout, setNoResultTimeout] = useState(false);
  const [events, setEvents] = useState<SpeechRecognitionLifecycleEvent[]>([]);
  const [isPreviewFrame, setIsPreviewFrame] = useState(false);
  const [autoStopped, setAutoStopped] = useState(false);
  const recRef = useRef<SR | null>(null);
  const startingRef = useRef(false);
  const noResultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gotResultRef = useRef(false);
  const finalRef = useRef<string>("");
  const permissionRef = useRef<"unknown" | "granted" | "denied" | "prompt">("unknown");

  useEffect(() => {
    setIsSupported(!!getSRCtor());
    setIsPreviewFrame(window.self !== window.top);
    if (typeof navigator !== "undefined" && (navigator as any).permissions?.query) {
      (navigator as any).permissions
        .query({ name: "microphone" as PermissionName })
        .then((p: any) => {
          setPermission(p.state);
          permissionRef.current = p.state;
          p.onchange = () => {
            setPermission(p.state);
            permissionRef.current = p.state;
          };
        })
        .catch(() => { /* noop */ });
    }
  }, []);

  useEffect(() => {
    permissionRef.current = permission;
  }, [permission]);

  const stop = useCallback(() => {
    if (noResultTimerRef.current) {
      clearTimeout(noResultTimerRef.current);
      noResultTimerRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    try { recRef.current?.stop(); } catch { /* noop */ }
  }, []);

  const reset = useCallback(() => {
    finalRef.current = "";
    setTranscript("");
    setInterim("");
    setError(null);
    setGotResult(false);
    setNoResultTimeout(false);
    setAutoStopped(false);
    setIsSpeaking(false);
    gotResultRef.current = false;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const recordEvent = useCallback((name: SpeechRecognitionLifecycleEvent["name"], detail?: string) => {
    setEvents((current) => [...current.slice(-11), { name, detail, at: new Date().toLocaleTimeString() }]);
  }, []);

  const armNoResultTimer = useCallback(() => {
    if (noResultTimerRef.current) clearTimeout(noResultTimerRef.current);
    noResultTimerRef.current = setTimeout(() => {
      if (!gotResultRef.current) {
        LOG("no-result timeout after 8s");
        recordEvent("timeout", "no result after 8s");
        setNoResultTimeout(true);
        try { recRef.current?.stop(); } catch { /* noop */ }
      }
    }, 8000);
  }, [recordEvent]);

  const start = useCallback(async (langOverride?: string) => {
    if (startingRef.current || recRef.current) {
      LOG("start() ignored — already starting/listening");
      return;
    }
    startingRef.current = true;
    const Ctor = getSRCtor();
    if (!Ctor) { setError("not-supported"); startingRef.current = false; return; }
    setError(null);
    setAutoStopped(false);
    setIsSpeaking(false);
    finalRef.current = "";
    setTranscript("");
    setInterim("");
    setGotResult(false);
    setNoResultTimeout(false);
    setEvents([]);
    gotResultRef.current = false;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    try {
      if (permissionRef.current === "granted") {
        LOG("mic permission already granted");
      } else if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        setPermission("granted");
        permissionRef.current = "granted";
        LOG("mic permission granted");
      }
    } catch {
      setError("not-allowed");
      setPermission("denied");
      startingRef.current = false;
      LOG("mic permission denied");
      return;
    }

    const rec: SR = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = langOverride || opts?.lang || "en-US";
    LOG("created recognition", { lang: rec.lang, continuous: rec.continuous, interimResults: rec.interimResults, silenceTimeoutMs });

    rec.onstart = () => {
      LOG("onstart");
      recordEvent("onstart");
      setIsListening(true);
    };
    rec.onend = () => {
      LOG("onend", { gotResult: gotResultRef.current, final: finalRef.current, autoStopped: autoStopped });
      recordEvent("onend", `gotResult=${gotResultRef.current} autoStopped=${autoStopped}`);
      setIsListening(false);
      setIsSpeaking(false);
      startingRef.current = false;
      recRef.current = null;
      if (noResultTimerRef.current) { clearTimeout(noResultTimerRef.current); noResultTimerRef.current = null; }
      if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    };
    rec.onaudiostart = () => { LOG("onaudiostart"); recordEvent("onaudiostart"); };
    rec.onsoundstart = () => { LOG("onsoundstart"); recordEvent("onsoundstart"); };
    rec.onspeechstart = () => {
      LOG("onspeechstart");
      recordEvent("onspeechstart");
      setIsSpeaking(true);
      if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    };
    rec.onspeechend = () => {
      LOG("onspeechend");
      recordEvent("onspeechend");
      setIsSpeaking(false);
    };
    rec.onerror = (ev: any) => {
      const code = ev?.error as string;
      LOG("onerror", code, ev?.message);
      recordEvent("onerror", code || "unknown");
      const map: Record<string, SpeechRecognitionError> = {
        "not-allowed": "not-allowed",
        "service-not-allowed": "service-not-allowed",
        "no-speech": "no-speech",
        "network": "network",
        "aborted": "aborted",
        "audio-capture": "audio-capture",
      };
      setError(map[code] ?? "unknown");
      setIsListening(false);
      setIsSpeaking(false);
      startingRef.current = false;
      if (noResultTimerRef.current) { clearTimeout(noResultTimerRef.current); noResultTimerRef.current = null; }
      if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    };
    rec.onresult = (ev: any) => {
      // Rebuild final + interim from the full results list every event.
      // In continuous mode some browsers re-emit previously finalized results,
      // and accumulating with `+=` across events produces duplicated phrases
      // ("I want I want I want..."). Reading the entire array each time is
      // the canonical, duplicate-free pattern.
      let finalText = "";
      let interimText = "";
      for (let i = 0; i < ev.results.length; i++) {
        const r = ev.results[i];
        const t = r[0]?.transcript ?? "";
        if (r.isFinal) finalText += t;
        else interimText += t;
      }
      // Collapse immediate consecutive duplicate words/phrases that some
      // engines emit when a phrase is re-recognized after a short pause.
      finalText = dedupeConsecutive(finalText);
      finalRef.current = finalText;
      LOG("onresult", { final: finalRef.current, interim: interimText });
      recordEvent("onresult", `final=${Boolean(finalRef.current)} interim=${Boolean(interimText)}`);
      setTranscript(finalRef.current);
      setInterim(interimText);
      setGotResult(true);
      gotResultRef.current = true;

      // Reset silence timer on every new result — user is still speaking or just finished a phrase
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        LOG("silence timeout after", silenceTimeoutMs, "ms — stopping recognition");
        recordEvent("timeout", `silence after ${silenceTimeoutMs}ms`);
        setAutoStopped(true);
        try { recRef.current?.stop(); } catch { /* noop */ }
      }, silenceTimeoutMs);
    };

    recRef.current = rec;
    try {
      recordEvent("start()", "calling");
      rec.start();
      armNoResultTimer();
      LOG("rec.start() called");
      recordEvent("start()", "called");
    } catch (e) {
      LOG("rec.start() threw", e);
      recordEvent("start()", "threw");
      setError("start-failed");
      setIsListening(false);
      startingRef.current = false;
      recRef.current = null;
    }
  }, [armNoResultTimer, opts?.lang, silenceTimeoutMs, recordEvent]);

  useEffect(() => () => { try { recRef.current?.abort?.(); } catch { /* noop */ } }, []);

  return { isSupported, isListening, isSpeaking, transcript, interim, error, permission, gotResult, noResultTimeout, events, isPreviewFrame, autoStopped, start, stop, reset };
}