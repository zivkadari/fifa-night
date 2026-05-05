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
      if (key.startsWith("supabase.auth") || key.includes("sb-")) {
        localStorage.removeItem(key);
      }
    });

    Object.keys(sessionStorage || {}).forEach((key) => {
      if (key.startsWith("supabase.auth") || key.includes("sb-")) {
        sessionStorage.removeItem(key);
      }
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
    });

    supabase.auth.getSession().then(({ data }) => {
      setIsAuthed(!!data.session?.user);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      cleanupAuthState();

      try {
        await supabase.auth.signOut({ scope: "global" });
      } catch {}

      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        window.location.href = redirectPath;
        return;
      }

      const redirectUrl = `${window.location.origin}${redirectPath}`;

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) throw error;

      toast({
        title: "החשבון נוצר",
        description: "בדוק את המייל כדי לאשר את החשבון ואז התחבר.",
      });
    } catch (err: any) {
      toast({
        title: "שגיאת התחברות",
        description: err?.message || "נסה שוב",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);

    try {
      cleanupAuthState();

      try {
        await supabase.auth.signOut({ scope: "global" });
      } catch {}

      const redirectUrl = `${window.location.origin}${redirectPath}`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) throw error;
    } catch (err: any) {
      toast({
        title: "שגיאה בהתחברות עם Google",
        description: err?.message || "נסה שוב",
        variant: "destructive",
      });

      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      cleanupAuthState();

      try {
        await supabase.auth.signOut({ scope: "global" });
      } catch {}
    } finally {
      window.location.href = "/auth";
    }
  };

  return (
    <div
      className="min-h-screen bg-gaming-bg flex items-center justify-center p-4"
      dir="rtl"
    >
      <div className="w-full max-w-md">
        <Card
          className={`bg-gradient-card border-neon-green/20 p-8 shadow-card ${
            mode === "signup" ? "ring-2 ring-primary/40" : ""
          }`}
        >
          <h1 className="text-2xl font-bold text-foreground mb-2 text-center">
            {mode === "signin" ? "התחברות" : "יצירת חשבון"}
          </h1>

          {redirectPath !== "/" && (
            <p className="text-sm text-muted-foreground text-center mb-4">
              התחבר כדי להמשיך
            </p>
          )}

          {isAuthed ? (
            <div className="space-y-4 text-center">
              <p className="text-muted-foreground">אתה כבר מחובר.</p>

              <Button
                variant="secondary"
                onClick={() => {
                  window.location.href = redirectPath;
                }}
              >
                {redirectPath !== "/" ? "המשך" : "חזרה לבית"}
              </Button>

              <Button variant="destructive" onClick={handleSignOut}>
                התנתק
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Button
                type="button"
                variant="outline"
                className="w-full bg-background border-border"
                onClick={handleGoogleSignIn}
                disabled={loading}
              >
                המשך עם Google
              </Button>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">או</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">אימייל</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    dir="ltr"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">סיסמה</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    dir="ltr"
                  />
                </div>

                <Button type="submit" disabled={loading} className="w-full">
                  {mode === "signin" ? "התחבר" : "צור חשבון"}
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    setMode(mode === "signin" ? "signup" : "signin");
                  }}
                >
                  {mode === "signin"
                    ? "אין לך חשבון? צור חשבון"
                    : "כבר יש לך חשבון? התחבר"}
                </Button>
              </form>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Auth;