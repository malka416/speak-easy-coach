import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function AchievementBadge({
  icon: Icon,
  label,
  earned = false,
  tone = "tutor",
}: {
  icon: LucideIcon;
  label: string;
  earned?: boolean;
  tone?: "streak" | "xp" | "goal" | "tutor";
}) {
  const colorMap = {
    streak: "bg-streak text-white shadow-tactile-streak",
    xp: "bg-xp text-white shadow-tactile-xp",
    goal: "bg-goal text-white shadow-tactile-goal",
    tutor: "bg-tutor text-white shadow-tactile",
  };
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          "flex h-16 w-16 items-center justify-center rounded-2xl",
          earned ? colorMap[tone] : "bg-muted text-muted-foreground/50",
        )}
      >
        <Icon className="h-7 w-7" strokeWidth={2.5} />
      </div>
      <span
        className={cn(
          "text-[10px] font-extrabold uppercase tracking-widest",
          earned ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </div>
  );
}