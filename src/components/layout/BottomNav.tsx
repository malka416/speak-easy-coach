import { Link, useLocation } from "@tanstack/react-router";
import { Mic, History, TrendingUp, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/practice", label: "תרגול", sub: "Practice", icon: Mic },
  { to: "/history", label: "היסטוריה", sub: "History", icon: History },
  { to: "/progress", label: "התקדמות", sub: "Progress", icon: TrendingUp },
  { to: "/settings", label: "הגדרות", sub: "Settings", icon: Settings },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur">
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-4 py-3">
        {tabs.map(({ to, label, sub, icon: Icon }) => {
          const active = pathname === to;
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                className="flex flex-col items-center gap-1.5 py-1"
              >
                <div
                  className={cn(
                    "flex h-10 w-14 items-center justify-center rounded-2xl transition-all",
                    active ? "bg-primary/10 text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.75 : 2} />
                </div>
                <span
                  className={cn(
                    "text-[11px] font-extrabold leading-none",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                  dir="rtl"
                  lang="he"
                >
                  {label}
                </span>
                <span
                  className={cn(
                    "text-[8px] font-bold uppercase tracking-tight leading-none",
                    active ? "text-primary/70" : "text-muted-foreground/60",
                  )}
                >
                  {sub}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}