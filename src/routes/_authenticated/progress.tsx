import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { ProgressRing } from "@/components/gamified/ProgressRing";
import { AchievementBadge } from "@/components/gamified/Badge";
import { Flame, Trophy, Mic, Zap, Crown, Medal } from "lucide-react";

export const Route = createFileRoute("/_authenticated/progress")({
  head: () => ({ meta: [{ title: "Progress — Speak Easy" }] }),
  component: ProgressPage,
});

function ProgressPage() {
  const weekly = [40, 70, 90, 55, 85, 30, 0];
  const labels = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <AppShell title="Progress">
      <div className="space-y-4">
        {/* XP Ring hero */}
        <section className="flex flex-col items-center rounded-[2.5rem] border-4 border-border bg-card p-6 shadow-card-soft">
          <ProgressRing value={68} size={160} stroke={14}>
            <span className="font-display text-4xl font-extrabold">680</span>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
              of 1000 XP
            </span>
          </ProgressRing>
          <p className="mt-3 text-sm font-semibold text-muted-foreground">
            320 XP until <span className="text-tutor">Level 4</span>
          </p>
        </section>

        {/* Weekly bars */}
        <section className="rounded-[2rem] border-4 border-border bg-card p-5">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h3 className="font-display text-base font-extrabold">This Week</h3>
              <p className="text-xs font-medium text-muted-foreground">5 of 7 days</p>
            </div>
            <span className="font-display text-xl font-extrabold text-goal">370 XP</span>
          </div>
          <div className="flex h-24 items-end justify-between gap-2">
            {weekly.map((h, i) => (
              <div
                key={i}
                className={`flex-1 rounded-full ${h > 0 ? "[background-image:var(--gradient-primary)]" : "bg-muted"}`}
                style={{ height: `${Math.max(h, 6)}%` }}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] font-extrabold text-muted-foreground">
            {labels.map((d, i) => <span key={i} className="flex-1 text-center">{d}</span>)}
          </div>
        </section>

        {/* Achievements */}
        <section className="rounded-[2rem] border-4 border-border bg-card p-5">
          <h3 className="mb-4 font-display text-base font-extrabold">Achievements</h3>
          <div className="grid grid-cols-4 gap-3">
            <AchievementBadge icon={Flame} label="7-Day" earned tone="streak" />
            <AchievementBadge icon={Mic} label="First Talk" earned tone="tutor" />
            <AchievementBadge icon={Zap} label="1k XP" earned tone="xp" />
            <AchievementBadge icon={Trophy} label="Goal Hit" earned tone="goal" />
            <AchievementBadge icon={Crown} label="30-Day" />
            <AchievementBadge icon={Medal} label="5k XP" />
            <AchievementBadge icon={Trophy} label="Marathon" />
            <AchievementBadge icon={Crown} label="Polyglot" />
          </div>
        </section>
      </div>
    </AppShell>
  );
}