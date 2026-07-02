import { Mic, Loader2 } from "lucide-react";

type State = "idle" | "listening" | "processing";

export function MicButton({ state, onClick, disabled }: { state: State; onClick: () => void; disabled?: boolean }) {
  const listening = state === "listening";
  const processing = state === "processing";
  const heLabel = processing ? "Aria חושבת…" : listening ? "מקשיבה… הקישו כדי לשלוח" : "הקישו כדי לדבר";
  const enLabel = processing ? "Aria is thinking…" : listening ? "Listening… tap to send" : "Tap to speak";
  return (
    <div className="flex flex-col items-center">
      <p className="mb-1 text-sm font-extrabold text-muted-foreground" dir="rtl" lang="he">
        {heLabel}
      </p>
      <p className="mb-5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
        {enLabel}
      </p>
      <button
        onClick={onClick}
        disabled={disabled || processing}
        className="relative flex h-28 w-28 items-center justify-center rounded-full bg-tutor text-white shadow-tactile transition-all active:translate-y-1.5 active:shadow-none disabled:opacity-70"
        aria-label={listening ? "Stop and send" : "Start recording"}
      >
        {listening && (
          <>
            <span className="absolute inset-0 animate-mic-pulse rounded-full bg-tutor/40" />
            <span className="absolute inset-0 animate-mic-pulse rounded-full bg-tutor/30" style={{ animationDelay: "0.5s" }} />
          </>
        )}
        {processing ? (
          <Loader2 className="relative h-12 w-12 animate-spin" strokeWidth={2.5} />
        ) : (
          <Mic className="relative h-12 w-12" strokeWidth={2.5} />
        )}
      </button>
    </div>
  );
}