import { ArrowLeft } from "lucide-react";

export function SessionHeader({ turns, xp, onExit }: { turns: number; xp: number; onExit: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <button
        onClick={onExit}
        className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted"
        aria-label="End session"
      >
        <ArrowLeft className="h-5 w-5" strokeWidth={2.5} />
      </button>
      <div className="rounded-full bg-muted px-3 py-1 text-[11px] font-extrabold text-muted-foreground">
        <span dir="rtl" lang="he">{turns} {turns === 1 ? "תור" : "תורות"}</span>
        <span className="ms-1.5 opacity-70">· {turns} {turns === 1 ? "turn" : "turns"}</span>
      </div>
      <div className="flex h-10 min-w-10 items-center justify-center rounded-2xl bg-xp/10 px-2 text-xs font-extrabold text-xp">
        +{xp}
      </div>
    </div>
  );
}