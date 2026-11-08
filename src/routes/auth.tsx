import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Logo } from "@/components/site/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lovable } from "@/integrations/lovable";
import { PAID_PLAN_IDS } from "@/lib/billing";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({ mode: z.enum(["signin", "signup", "forgot"]).optional(), plan: z.enum(PAID_PLAN_IDS).optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — NEXORA AI" },
      { name: "description", content: "Sign in or create your NEXORA AI account." },
      { property: "og:title", content: "Sign in — NEXORA AI" },
      { property: "og:description", content: "Access your NEXORA AI workspace." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode = "signin", plan } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate(plan ? { to: "/app/billing", search: { plan }, replace: true } : { to: "/app", replace: true });
    });
  }, [navigate, plan]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      if (mode === "signup") {
        if (password.length < 8) throw new Error("Password must be at least 8 characters.");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/app", data: { display_name: name.slice(0, 80) } },
        });
        if (error) throw error;
        if (data.session) navigate(plan ? { to: "/app/billing", search: { plan } } : { to: "/app" });
        else setNotice("Check your email to confirm your account, then sign in.");
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/reset-password" });
        if (error) throw error;
        setNotice("If that email has an account, a reset link is on its way.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate(plan ? { to: "/app/billing", search: { plan } } : { to: "/app" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" + (plan ? `?plan=${plan}` : "") });
    if (result.error) {
      toast.error("Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    navigate(plan ? { to: "/app/billing", search: { plan } } : { to: "/app" });
  };

  const title = mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset your password" : "Welcome back";

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-4">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[700px] -translate-x-1/2 rounded-full bg-gradient-brand opacity-20 blur-3xl" />
      <div className="glass relative w-full max-w-sm rounded-2xl p-8 shadow-glow">
        <Logo />
        <h1 className="mt-6 text-2xl font-semibold">{title}</h1>
        {notice && <p role="status" className="mt-4 rounded-lg bg-accent px-3 py-2 text-sm">{notice}</p>}
        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          {mode !== "forgot" && (
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={mode === "signup" ? 8 : 1} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
            </div>
          )}
          <Button type="submit" disabled={busy} className="w-full bg-gradient-brand text-primary-foreground">
            {busy ? "Please wait…" : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in"}
          </Button>
        </form>
        {mode !== "forgot" && (
          <Button variant="outline" className="mt-3 w-full" onClick={google}>
            Continue with Google
          </Button>
        )}
        <div className="mt-6 space-y-1 text-center text-sm text-muted-foreground">
          {mode === "signin" && (
            <>
              <p><Link to="/auth" search={{ mode: "forgot", plan }} className="hover:text-foreground">Forgot password?</Link></p>
              <p>New here? <Link to="/auth" search={{ mode: "signup", plan }} className="text-primary">Create an account</Link></p>
            </>
          )}
          {mode !== "signin" && (
            <p>Have an account? <Link to="/auth" search={{ mode: "signin", plan }} className="text-primary">Sign in</Link></p>
          )}
        </div>
      </div>
    </div>
  );
}
