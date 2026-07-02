import { Sparkles, BookOpen, Wand2 } from "lucide-react";

export type Mistake = { type: "grammar" | "fluency" | "vocabulary"; original: string; suggestion: string; explanation: string };
export type VocabItem = { word: string; meaning: string; example: string };

export function FeedbackPanel({
  encouragement,
  mistakes,
  vocabulary,
  followUp,
  onUseFollowUp,
}: {
  encouragement?: string;
  mistakes: Mistake[];
  vocabulary: VocabItem[];
  followUp?: string;
  onUseFollowUp?: (q: string) => void;
}) {
  const trimmedEnc = encouragement?.trim();
  // Filter out generic, repetitive praise so it doesn't appear as a banner.
  const GENERIC = /^(great job|good job|well done|awesome|nice job|amazing|perfect|excellent|you're doing great|keep it up|fantastic|wonderful)[!.\s]*$/i;
  const showEnc = trimmedEnc && !GENERIC.test(trimmedEnc);
  const hasAny = showEnc || mistakes.length || vocabulary.length || followUp;
  if (!hasAny) return null;
  return (
    <div className="space-y-2">
      {showEnc && (
        <div className="flex items-center gap-2 rounded-full bg-success/10 px-3 py-1.5 text-xs font-medium text-success">
          <Sparkles className="h-3.5 w-3.5 shrink-0" /> <span>{trimmedEnc}</span>
        </div>
      )}
      {mistakes.map((m, i) => (
        <div key={i} className="rounded-2xl border border-border/60 bg-card px-3 py-2">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-tutor/80">
            <Wand2 className="h-3 w-3" /> <span dir="rtl" lang="he">תיקון קטן</span> · small fix
          </div>
          <p className="mt-1 text-xs font-medium">
            <span className="text-muted-foreground line-through">{m.original}</span>{" "}
            <span className="font-bold text-foreground">→ {m.suggestion}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{m.explanation}</p>
        </div>
      ))}
      {vocabulary.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card px-3 py-2">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-goal/80">
            <BookOpen className="h-3 w-3" /> <span dir="rtl" lang="he">מילה שימושית</span> · useful word
          </div>
          <ul className="mt-1 space-y-1">
            {vocabulary.map((v, i) => (
              <li key={i} className="text-xs">
                <span className="font-bold">{v.word}</span>
                <span className="text-muted-foreground"> — {v.meaning}</span>
                <div className="text-[11px] italic text-muted-foreground">"{v.example}"</div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {followUp && (
        <button
          onClick={() => onUseFollowUp?.(followUp)}
          className="w-full rounded-2xl border border-dashed border-tutor/40 bg-tutor/5 px-3 py-2 text-left text-xs font-medium text-tutor"
        >
          {followUp}
        </button>
      )}
    </div>
  );
}