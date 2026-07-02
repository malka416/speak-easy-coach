import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { Flame } from "lucide-react";

export function AppShell({
  children,
  title,
  streak = 7,
}: {
  children: ReactNode;
  title?: string;
  streak?: number;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-6 pt-6 pb-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight">Speak Easy</h1>
            {title ? (
              <p className="text-xs font-bold text-muted-foreground">
                {title}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-streak/10 px-3 py-1.5">
            <Flame className="h-4 w-4 text-streak" />
            <span className="text-sm font-extrabold text-streak">{streak}</span>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-6 pb-28 pt-2">{children}</main>
      <BottomNav />
    </div>
  );
}