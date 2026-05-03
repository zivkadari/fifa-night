import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Utility to aggressively clean local auth state and prevent limbo
const cleanupAuthState = () => {
  try {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("supabase.auth") || key.includes("sb-")) localStorage.removeItem(key);
    });
    Object.keys(sessionStorage || {}).forEach((key) => {
      if (key.startsWith("supabase.auth") || key.includes("sb-")) sessionStorage.removeItem(key);
    });
  } catch {}
};

const Auth = () => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/";
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthed(!!session?.user);
      // Defer any follow-up fetches if needed
      if (session?.user) {
        setTimeout(() => {}, 0);
      }
    });
    supabase.auth.getSession().then(({ data }) => setIsAuthed(!!data.session?.user));
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      cleanupAuthState();
      try { await supabase.auth.signOut({ scope: "global" }); } catch {}

      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Redirect to the stored path (could be /join/:code)
        window.location.href = redirectPath;
      } else {
        const redirectUrl = `${window.location.origin}${redirectPath}`;
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectUrl },
        });
        if (error) throw error;
        toast({ title: "Signed up", description: "Check your email to confirm, then sign in." });
      }
    } catch (err: any) {
      toast({ title: "Authentication error", description: err?.message || "Please try again", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      cleanupAuthState();
      try { await supabase.auth.signOut({ scope: "global" }); } catch {}
    } finally {
      window.location.href = "/auth";
    }
  };

  return (
    <div className="min-h-screen bg-gaming-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className={`bg-gradient-card border-neon-green/20 p-8 shadow-card ${mode === "signup" ? "ring-2 ring-primary/40" : ""}`}>
          <h1 className="text-2xl font-bold text-foreground mb-2 text-center">{mode === "signin" ? "Sign in" : "Create account"}</h1>
          
          {redirectPath !== "/" && (
            <p className="text-sm text-muted-foreground text-center mb-4">
              התחבר כדי להצטרף לטורניר
            </p>
          )}

          {isAuthed ? (
            <div className="space-y-4 text-center"> 
              <p className="text-muted-foreground">You are signed in. You can start and save history to the cloud.</p>
              <Button variant="secondary" onClick={() => (window.location.href = redirectPath)}>
                {redirectPath !== "/" ? "המשך להצטרפות" : "Back to Home"}
              </Button>
              <Button variant="destructive" onClick={handleSignOut}>Sign out</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {mode === "signin" ? "Sign in" : "Sign up"}
              </Button>
              <Button type="button" variant="secondary" className="w-full" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              >{mode === "signin" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}</Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Auth;
