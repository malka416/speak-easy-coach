import { useCallback, useEffect, useRef, useState } from "react";

export function useSpeechSynthesis(opts?: { voiceName?: string | null; lang?: string }) {
  const [isSupported, setIsSupported] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    setIsSupported(true);
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  const pickVoice = useCallback((lang: string): SpeechSynthesisVoice | null => {
    if (!voices.length) return null;
    if (opts?.voiceName) {
      const exact = voices.find((v) => v.name === opts.voiceName);
      if (exact && exact.lang.startsWith(lang.slice(0, 2))) return exact;
    }
    const prefix = lang.slice(0, 2);
    return (
      voices.find((v) => v.lang === lang) ??
      voices.find((v) => v.lang.startsWith(prefix)) ??
      null
    );
  }, [voices, opts?.voiceName]);

  const speak = useCallback((text: string, langOverride?: string): { spoken: boolean; voiceFound: boolean } => {
    if (!isSupported || !text) return { spoken: false, voiceFound: false };
    const lang = langOverride || opts?.lang || "en-US";
    // Ensure voices are loaded (some browsers return [] until first call)
    let available = voices;
    if (!available.length) {
      available = window.speechSynthesis.getVoices();
    }
    const prefix = lang.slice(0, 2);
    let v: SpeechSynthesisVoice | null =
      available.find((x) => x.lang === lang) ??
      available.find((x) => x.lang.toLowerCase().startsWith(prefix)) ??
      null;
    const voiceFound = !!v;
    if (!v && available.length) {
      // Fallback: use first available voice so the user still hears something.
      v = available[0];
      console.warn("[tts] no voice for", lang, "— falling back to", v?.name, v?.lang);
    }
    console.log("[tts] speak", {
      requestedLang: lang,
      voiceFound,
      pickedVoice: v?.name,
      pickedLang: v?.lang,
      availableLangs: available.map((x) => x.lang),
      textPreview: text.slice(0, 60),
    });
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (v) u.voice = v;
    u.lang = lang;
    u.rate = 1;
    u.pitch = 1;
    u.onstart = () => { console.log("[tts] start", lang, v?.name); setSpeaking(true); };
    u.onend = () => { console.log("[tts] end", lang); setSpeaking(false); };
    u.onerror = (e) => { console.error("[tts] error", (e as SpeechSynthesisErrorEvent).error, lang); setSpeaking(false); };
    utterRef.current = u;
    try {
      window.speechSynthesis.speak(u);
      return { spoken: true, voiceFound };
    } catch {
      return { spoken: false, voiceFound };
    }
  }, [isSupported, voices, opts?.lang]);

  const cancel = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [isSupported]);

  return { isSupported, speak, cancel, speaking };
}