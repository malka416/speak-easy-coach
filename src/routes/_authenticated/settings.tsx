import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Smile, Zap, Sparkles, Volume2, LogOut, Save } from "lucide-react";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useDevMode, setDevMode } from "@/lib/dev-mode";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Speak Easy" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const saveProfile = useServerFn(updateMyProfile);
  const { data } = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const profile = data?.profile;

  const [displayName, setDisplayName] = useState("");
  const [level, setLevel] = useState<string>("beginner");
  const [tutorStyle, setTutorStyle] = useState<string>("friendly");
  const [timezone, setTimezone] = useState("UTC");
  const [voice, setVoice] = useState<string>("aria");
  const devMode = useDevMode();

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setLevel(profile.level ?? "beginner");
      setTutorStyle(profile.tutor_style ?? "friendly");
      setTimezone(profile.timezone ?? "UTC");
    }
  }, [profile]);

  async function save() {
    try {
      await saveProfile({ data: { display_name: displayName, level: level as never, tutor_style: tutorStyle as never, timezone } });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <AppShell title="הגדרות · Settings">
      <div className="space-y-5">
        {/* Display name */}
        <Section label="השם שלכם · Your name">
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="h-12 rounded-2xl border-2 px-4 text-base font-medium"
            placeholder="איך לקרוא לכם?"
          />
        </Section>

        {/* Tutor personality */}
        <Section label="אופי המורה · Tutor personality">
          <div className="grid grid-cols-3 gap-3">
            <PickerCard active={tutorStyle === "friendly"} onClick={() => setTutorStyle("friendly")} icon={<Smile className="h-6 w-6" />} label="ידידותית" sub="Friendly" tone="tutor" />
            <PickerCard active={tutorStyle === "strict"} onClick={() => setTutorStyle("strict")} icon={<Zap className="h-6 w-6" />} label="קפדנית" sub="Strict" tone="streak" />
            <PickerCard active={tutorStyle === "playful"} onClick={() => setTutorStyle("playful")} icon={<Sparkles className="h-6 w-6" />} label="שובבה" sub="Playful" tone="goal" />
          </div>
        </Section>

        {/* Voice */}
        <Section label="קול המורה · Tutor voice">
          <div className="space-y-2">
            {[
              { id: "aria", name: "Aria", desc: "חמה ומעודדת · Warm & encouraging" },
              { id: "leo", name: "Leo", desc: "רגוע וברור · Calm & clear" },
              { id: "mira", name: "Mira", desc: "אנרגטית ומהירה · Energetic & quick" },
            ].map((v) => (
              <button
                key={v.id}
                onClick={() => setVoice(v.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border-4 p-3 text-left transition-all",
                  voice === v.id ? "border-tutor bg-tutor/5" : "border-border bg-card",
                )}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full [background-image:var(--gradient-primary)] font-display font-extrabold text-white">
                  {v.name[0]}
                </div>
                <div className="flex-1">
                  <p className="font-display text-sm font-extrabold">{v.name}</p>
                  <p className="text-xs font-medium text-muted-foreground">{v.desc}</p>
                </div>
                <Volume2 className={cn("h-5 w-5", voice === v.id ? "text-tutor" : "text-muted-foreground")} />
              </button>
            ))}
          </div>
        </Section>

        {/* Level */}
        <Section label="רמת לימוד · Learning level">
          <div className="grid grid-cols-3 gap-3">
            {[
              { v: "beginner", label: "מתחילים", sub: "A1–A2" },
              { v: "intermediate", label: "ביניים", sub: "B1–B2" },
              { v: "advanced", label: "מתקדמים", sub: "C1+" },
            ].map((l) => (
              <button
                key={l.v}
                onClick={() => setLevel(l.v)}
                className={cn(
                  "rounded-2xl border-4 p-3 text-center transition-all",
                  level === l.v ? "border-xp bg-xp/5" : "border-border bg-card",
                )}
              >
                <p className="font-display text-sm font-extrabold" dir="rtl" lang="he">{l.label}</p>
                <p className="text-[10px] font-bold text-muted-foreground">{l.sub}</p>
              </button>
            ))}
          </div>
        </Section>

        {/* Timezone (compact) */}
        <Section label="אזור זמן · Timezone">
          <Input
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="h-12 rounded-2xl border-2 px-4 text-base font-medium"
          />
        </Section>

        {/* Developer Mode */}
        <Section label="מצב מפתח · Developer Mode">
          <button
            onClick={() => setDevMode(!devMode)}
            className={cn(
              "flex w-full items-center justify-between rounded-2xl border-4 p-4 text-left transition-all",
              devMode ? "border-tutor bg-tutor/5" : "border-border bg-card",
            )}
          >
            <div>
              <p className="font-display text-sm font-extrabold">Developer Mode</p>
              <p className="text-xs font-medium text-muted-foreground">
                Show STT debug, timing, events & recognition language on Practice
              </p>
            </div>
            <span
              className={cn(
                "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                devMode ? "bg-tutor" : "bg-muted",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
                  devMode ? "left-[22px]" : "left-0.5",
                )}
              />
            </span>
          </button>
        </Section>

        <button
          onClick={save}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-tutor py-4 text-white shadow-tactile transition-all active:translate-y-1.5 active:shadow-none"
        >
          <Save className="h-5 w-5" />
          <span className="text-base font-extrabold" dir="rtl" lang="he">שמירה</span>
          <span className="text-[11px] font-bold uppercase tracking-widest opacity-80">· Save</span>
        </button>

        <button
          onClick={signOut}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-4 border-border bg-card py-4 text-muted-foreground transition-transform active:scale-95"
        >
          <LogOut className="h-4 w-4" />
          <span className="text-sm font-extrabold" dir="rtl" lang="he">התנתקות</span>
          <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">· Sign out</span>
        </button>
      </div>
    </AppShell>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="mb-2 px-1 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      {children}
    </section>
  );
}

function PickerCard({
  active,
  onClick,
  icon,
  label,
  sub,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  sub?: string;
  tone: "tutor" | "streak" | "goal";
}) {
  const toneBg = { tutor: "bg-tutor/5 border-tutor text-tutor", streak: "bg-streak/5 border-streak text-streak", goal: "bg-goal/5 border-goal text-goal" }[tone];
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 rounded-2xl border-4 p-4 transition-all",
        active ? toneBg : "border-border bg-card text-muted-foreground",
      )}
    >
      {icon}
      <span className="text-sm font-extrabold" dir="rtl" lang="he">{label}</span>
      {sub && <span className="text-[9px] font-bold uppercase tracking-widest opacity-70">{sub}</span>}
    </button>
  );
}