import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Mic, Sparkles, MessageCircle, Trophy } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aria — Your Personal English Speaking Coach" },
      { name: "description", content: "Learn English by speaking. Built for Hebrew speakers. Beginners welcome — no perfect English needed." },
      { property: "og:title", content: "Aria — Your Personal English Speaking Coach" },
      { property: "og:description", content: "Learn English by speaking. Built for Hebrew speakers. Beginners welcome." },
    ],
  }),
  component: Index,
});

function FeatureChip({
  icon,
  label,
  hebrew,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  hebrew: string;
  tone: "tutor" | "goal" | "streak" | "xp";
}) {
  const toneClasses = {
    tutor: "bg-tutor/10 text-tutor",
    goal: "bg-goal/10 text-goal",
    streak: "bg-streak/10 text-streak",
    xp: "bg-xp/10 text-xp",
  };
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex items-center gap-1.5 rounded-full ${toneClasses[tone]} px-3 py-1.5 text-xs font-bold cursor-default`}>
          {icon} {label}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p>{hebrew}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function Index() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between bg-background p-6">
      <TooltipProvider>
        <div className="mt-12 w-full max-w-md text-center">
          {/* Aria avatar */}
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl [background-image:var(--gradient-primary)] text-3xl font-extrabold text-white shadow-tactile">
            A
          </div>

          <p className="mt-5 text-sm font-extrabold uppercase tracking-widest text-muted-foreground" dir="rtl" lang="he">
            הכירו את Aria 👋
          </p>
          <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight leading-tight" dir="rtl" lang="he">
            המאמנת האישית שלכם לדיבור באנגלית.
          </h1>
          <p className="mt-2 text-sm font-medium text-muted-foreground/70 leading-relaxed">
            Your personal English speaking coach
          </p>
          <p className="mt-4 text-base font-semibold text-foreground leading-relaxed" dir="rtl" lang="he">
            תרגלו שיחות אמיתיות באנגלית, קבלו משוב מיידי והשתפרו בקצב שלכם.
          </p>
          <p className="mt-2 text-xs font-medium text-muted-foreground/70 leading-relaxed">
            Practice real conversations, get instant feedback, and improve at your own pace.
          </p>
          <p className="mt-3 text-sm font-medium text-muted-foreground leading-relaxed" dir="rtl" lang="he">
            לא משנה אם אתם מתחילים או מתקדמים — Aria תתאים את עצמה לרמה שלכם.
          </p>

          {/* Benefit badge */}
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-goal/10 px-4 py-2 text-sm font-bold text-goal" dir="rtl" lang="he">
            <span>🎯</span>
            <span>Aria מזהה את רמת האנגלית שלכם אוטומטית ומתאימה את התרגול בהתאם.</span>
          </div>

          {/* Feature pills */}
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <FeatureChip
              icon={<Mic className="h-3.5 w-3.5" strokeWidth={2.5} />}
              label="Voice Practice"
              hebrew="תרגול דיבור"
              tone="tutor"
            />
            <FeatureChip
              icon={<Sparkles className="h-3.5 w-3.5" strokeWidth={2.5} />}
              label="AI Feedback"
              hebrew="תיקונים חכמים"
              tone="goal"
            />
            <FeatureChip
              icon={<Trophy className="h-3.5 w-3.5" strokeWidth={2.5} />}
              label="Streaks"
              hebrew="רצף תרגול"
              tone="streak"
            />
            <FeatureChip
              icon={<MessageCircle className="h-3.5 w-3.5" strokeWidth={2.5} />}
              label="Real Talk"
              hebrew="שיחות אמיתיות"
              tone="xp"
            />
          </div>
        </div>

        <div className="mb-10 w-full max-w-md">
          {/* Social proof bubble */}
          <div className="mb-6 rounded-2xl bg-muted px-5 py-4 text-center">
            <p className="text-sm font-medium text-muted-foreground" dir="rtl" lang="he">
              "Aria עזרה לי סוף סוף להרגיש בטוח להזמין קפה באנגלית."
            </p>
            <p className="mt-1 text-xs font-medium text-muted-foreground/70">
              "Aria helped me finally feel confident ordering coffee in English."
            </p>
            <p className="mt-1 text-xs font-bold text-muted-foreground opacity-60" dir="rtl" lang="he">
              — לומדת מרוצה
            </p>
          </div>

          {/* Beginner reassurance */}
          <p className="mb-2 text-center text-sm font-semibold text-foreground" dir="rtl" lang="he">
            מתחילים מאיפה שנוח לכם.
          </p>
          <p className="mb-4 text-center text-sm font-medium text-muted-foreground" dir="rtl" lang="he">
            Aria תעזור לכם להשתפר צעד אחר צעד.
          </p>

          <Button
            asChild
            className="h-16 w-full rounded-2xl bg-tutor text-base font-extrabold tracking-wider text-white shadow-tactile transition-all hover:bg-tutor active:translate-y-1.5 active:shadow-none"
          >
            <Link to="/auth">
              <span className="block text-base font-extrabold" dir="rtl" lang="he">
                התחילו לדבר עם Aria
              </span>
              <span className="block text-xs font-bold uppercase tracking-wider opacity-80">
                Start Talking To Aria
              </span>
            </Link>
          </Button>

          <p className="mt-3 text-center text-xs font-semibold text-muted-foreground" dir="rtl" lang="he">
            התחילו בחינם
          </p>
          <p className="text-center text-[10px] font-medium text-muted-foreground/70">
            Start for free
          </p>

          {/* Onboarding hint */}
          <div className="mt-4 rounded-2xl border-2 border-dashed border-border bg-muted/40 px-4 py-3 text-center">
            <p className="text-xs font-extrabold text-muted-foreground" dir="rtl" lang="he">
              מתחילים מאפס?
            </p>
            <p className="text-xs font-medium text-muted-foreground" dir="rtl" lang="he">
              אפשר להתחיל גם בעברית.
            </p>
          </div>
        </div>
      </TooltipProvider>
    </main>
  );
}
