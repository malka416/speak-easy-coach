import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Sign in — Speak Easy Coach" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: redirect ?? "/practice" });
    });
  }, [navigate, redirect]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const fn = mode === "signin" ? supabase.auth.signInWithPassword({ email, password }) : supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
      const { error } = await fn;
      if (error) throw error;
      navigate({ to: redirect ?? "/practice" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      toast.error("Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    navigate({ to: redirect ?? "/practice" });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-[var(--shadow-elegant)]">
        <h1 className="text-2xl font-bold text-foreground" dir="rtl" lang="he">
          {mode === "signin" ? "ברוכים השבים" : "יצירת חשבון"}
        </h1>
        <p className="mt-0.5 text-sm font-medium text-muted-foreground/70">
          {mode === "signin" ? "Welcome back" : "Create account"}
        </p>
        <p className="mt-2 text-sm text-muted-foreground" dir="rtl" lang="he">
          תרגלו דיבור עם המאמנת החכמה שלכם.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email"><span dir="rtl" lang="he">אימייל</span> · Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password"><span dir="rtl" lang="he">סיסמה</span> · Password</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "..." : (
              <>
                <span dir="rtl" lang="he">{mode === "signin" ? "כניסה" : "הרשמה"}</span>
                <span className="ms-2 opacity-80">· {mode === "signin" ? "Sign in" : "Sign up"}</span>
              </>
            )}
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> <span dir="rtl" lang="he">או</span> / OR <div className="h-px flex-1 bg-border" />
        </div>

        <Button variant="outline" className="w-full" onClick={handleGoogle}>
          <span dir="rtl" lang="he">המשך עם Google</span>
          <span className="ms-2 opacity-70">· Continue with Google</span>
        </Button>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <span dir="rtl" lang="he">{mode === "signin" ? "אין חשבון?" : "כבר רשומים?"}</span>{" "}
          <button type="button" className="font-medium text-primary hover:underline" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
            <span dir="rtl" lang="he">{mode === "signin" ? "הרשמה" : "כניסה"}</span>
          </button>
        </p>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link to="/"><span dir="rtl" lang="he">חזרה לדף הבית</span> · Back home</Link>
        </p>
      </div>
    </main>
  );
}