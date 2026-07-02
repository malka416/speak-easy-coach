import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { MessageCircle, Clock, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "History — Speak Easy" }] }),
  component: HistoryPage,
});

type SessionRow = {
  id: string;
  started_at: string;
  ended_at: string | null;
  message_count: number;
  xp_earned: number;
  detected_level: string | null;
};

function formatWhen(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return `היום · ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `אתמול · ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function durationMinutes(started: string, ended: string | null) {
  if (!ended) return null;
  const ms = new Date(ended).getTime() - new Date(started).getTime();
  return Math.max(1, Math.round(ms / 60000));
}

function HistoryPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("conversations")
        .select("id, started_at, ended_at, message_count, xp_earned, detected_level")
        .order("started_at", { ascending: false })
        .limit(50);
      if (!cancelled) {
        setSessions((data as SessionRow[]) ?? []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <AppShell title="היסטוריה · History">
        <p className="mt-10 text-center text-sm font-medium text-muted-foreground" dir="rtl" lang="he">טוען…</p>
      </AppShell>
    );
  }

  if (sessions.length === 0) {
    return (
      <AppShell title="היסטוריה · History">
        <div className="mt-10 flex flex-col items-center text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-tutor/10 text-tutor shadow-card-soft">
            <MessageCircle className="h-10 w-10" strokeWidth={2.25} />
          </div>
          <h2 className="mt-6 font-display text-2xl font-extrabold" dir="rtl" lang="he">עדיין אין שיחות</h2>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">No sessions yet</p>
          <p className="mt-3 max-w-xs text-sm font-medium text-muted-foreground" dir="rtl" lang="he">
            השיחה הראשונה שלכם תופיע כאן. כל תרגול מזכה ב-XP ומגדיל את הרצף.
          </p>
          <button className="mt-6 rounded-2xl bg-tutor px-6 py-3 text-white shadow-tactile transition-all active:translate-y-1.5 active:shadow-none">
            <span className="block text-sm font-extrabold" dir="rtl" lang="he">התחילו תרגול ראשון</span>
            <span className="block text-[10px] font-bold uppercase tracking-widest opacity-80">Start your first session</span>
          </button>
        </div>
      </AppShell>
    );
  }
  return (
    <AppShell title="היסטוריה · History">
      <ul className="space-y-3">
        {sessions.map((s) => {
          const minutes = durationMinutes(s.started_at, s.ended_at);
          return (
            <li key={s.id} className="flex items-center gap-4 rounded-3xl border-4 border-border bg-card p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-tutor/10 text-tutor">
                <MessageCircle className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="font-display font-extrabold">
                  <span dir="rtl" lang="he">{s.message_count} {s.message_count === 1 ? "תור" : "תורות"}</span>
                  {s.detected_level ? ` · ${s.detected_level}` : ""}
                </p>
                <p className="text-xs font-medium text-muted-foreground">{formatWhen(s.started_at)}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="flex items-center gap-1 text-xs font-extrabold text-xp">
                  <Star className="h-3 w-3" fill="currentColor" /> +{s.xp_earned}
                </span>
                {minutes != null && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                    <Clock className="h-3 w-3" /> {minutes}m
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </AppShell>
  );
}