import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "streak" | "xp" | "goal" | "tutor";

const toneClass: Record<Tone, string> = {
  streak: "bg-streak shadow-tactile-streak",
  xp: "bg-xp shadow-tactile-xp",
  goal: "bg-goal shadow-tactile-goal",
  tutor: "bg-tutor shadow-tactile",
};

export function StatTile({
  label,
  value,
  icon,
  tone,
  className,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  tone: Tone;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex aspect-square flex-col justify-between rounded-[2rem] p-5 text-white",
        toneClass[tone],
        className,
      )}
    >
      <div className="opacity-90">{icon}</div>
      <div>
        <div className="font-display text-3xl font-extrabold leading-none">{value}</div>
        <div className="mt-1 text-[10px] font-extrabold uppercase tracking-widest opacity-80">
          {label}
        </div>
      </div>
    </div>
  );
}