import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { completeOnboarding } from "@/lib/profile.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Welcome — Speak Easy" }] }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const finish = useServerFn(completeOnboarding);
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [level, setLevel] = useState("beginner");
  const [tutorStyle, setTutorStyle] = useState("friendly");
  const [nativeLanguage, setNativeLanguage] = useState("English");
  const [saving, setSaving] = useState(false);

  const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";

  async function submit() {
    setSaving(true);
    try {
      await finish({
        data: {
          display_name: displayName || "Friend",
          level: level as never,
          tutor_style: tutorStyle as never,
          native_language: nativeLanguage,
          timezone: tz,
        },
      });
      navigate({ to: "/practice" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-[var(--shadow-elegant)]">
        <div className="mb-6 text-xs text-muted-foreground">Step {step + 1} of 4</div>

        {step === 0 && (
          <>
            <h1 className="text-2xl font-bold">What should we call you?</h1>
            <Input className="mt-4" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
          </>
        )}
        {step === 1 && (
          <>
            <h1 className="text-2xl font-bold">Your level?</h1>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger className="mt-4"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}
        {step === 2 && (
          <>
            <h1 className="text-2xl font-bold">Pick a tutor style</h1>
            <Select value={tutorStyle} onValueChange={setTutorStyle}>
              <SelectTrigger className="mt-4"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="friendly">Friendly</SelectItem>
                <SelectItem value="strict">Strict</SelectItem>
                <SelectItem value="playful">Playful</SelectItem>
              </SelectContent>
            </Select>
            <Label className="mt-4 block">Native language</Label>
            <Input className="mt-2" value={nativeLanguage} onChange={(e) => setNativeLanguage(e.target.value)} />
          </>
        )}
        {step === 3 && (
          <>
            <h1 className="text-2xl font-bold">All set!</h1>
            <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
              <li>Name: {displayName || "Friend"}</li>
              <li>Level: {level}</li>
              <li>Tutor: {tutorStyle}</li>
              <li>Native language: {nativeLanguage}</li>
              <li>Timezone: {tz}</li>
            </ul>
          </>
        )}

        <div className="mt-8 flex gap-3">
          {step > 0 && <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">Back</Button>}
          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)} className="flex-1">Next</Button>
          ) : (
            <Button onClick={submit} disabled={saving} className="flex-1">{saving ? "..." : "Finish"}</Button>
          )}
        </div>
      </div>
    </main>
  );
}