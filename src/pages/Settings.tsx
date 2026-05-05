import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  FileText,
  ShieldCheck,
  Home,
  Info,
  Mail,
  Settings as SettingsIcon,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

const VIBRATION_SETTING_KEY = "settings-vibration-enabled";
const ONBOARDING_SETTING_KEY = "settings-show-new-user-tips";

const SettingsPage = () => {
  const navigate = useNavigate();

  const [vibrationEnabled, setVibrationEnabled] = useState(false);
  const [showNewUserTips, setShowNewUserTips] = useState(true);
  const [vibrationSupported, setVibrationSupported] = useState(false);

  useEffect(() => {
    setVibrationSupported(typeof navigator !== "undefined" && "vibrate" in navigator);

    const savedVibration = localStorage.getItem(VIBRATION_SETTING_KEY);
    const savedTips = localStorage.getItem(ONBOARDING_SETTING_KEY);

    setVibrationEnabled(savedVibration === "true");
    setShowNewUserTips(savedTips !== "false");
  }, []);

  const toggleVibration = () => {
    const next = !vibrationEnabled;
    setVibrationEnabled(next);
    localStorage.setItem(VIBRATION_SETTING_KEY, String(next));

    if (next && "vibrate" in navigator) {
      navigator.vibrate(20);
    }
  };

  const toggleNewUserTips = () => {
    const next = !showNewUserTips;
    setShowNewUserTips(next);
    localStorage.setItem(ONBOARDING_SETTING_KEY, String(next));
  };

  return (
    <div className="min-h-[100svh] bg-gaming-bg p-4" dir="rtl">
      <div className="max-w-md mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5 rotate-180" />
          </Button>

          <div>
            <h1 className="text-2xl font-bold text-foreground">הגדרות</h1>
            <p className="text-sm text-muted-foreground">
              התאמות אישיות, מידע משפטי ויצירת קשר
            </p>
          </div>
        </div>

        {/* App info */}
        <Card className="bg-gradient-card border-neon-green/20 shadow-card">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5 text-neon-green" />
              <h2 className="text-lg font-semibold text-foreground">Soccer Night</h2>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              אפליקציה לניהול טורנירי כדורגל עם חברים, קבוצות, תוצאות וסטטיסטיקות.
            </p>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Soccer Night היא אפליקציה עצמאית ואינה קשורה ל־FIFA, EA Sports,
              Electronic Arts או כל מפיצת משחקים אחרת.
            </p>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card className="bg-gradient-card border-border shadow-card">
          <CardContent className="p-4 space-y-4">
            <h2 className="text-base font-semibold text-foreground">העדפות</h2>

            <div className="flex items-center justify-between gap-3 rounded-lg bg-gaming-surface/60 border border-border/50 p-3">
              <div className="flex items-start gap-2 min-w-0">
                <Bell className="h-4 w-4 text-neon-green mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">רטט בלחיצה</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    יופעל בלחיצה על כפתורים רק במכשירים ודפדפנים שתומכים בזה.
                  </p>
                  {!vibrationSupported && (
                    <p className="text-[11px] text-yellow-300 mt-1">
                      ייתכן שהמכשיר או הדפדפן שלך לא תומכים ברטט.
                    </p>
                  )}
                </div>
              </div>

              <Switch
                checked={vibrationEnabled}
                onCheckedChange={toggleVibration}
                aria-label="toggle vibration"
              />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg bg-gaming-surface/60 border border-border/50 p-3">
              <div className="flex items-start gap-2 min-w-0">
                <Sparkles className="h-4 w-4 text-neon-green mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">הצג הסברים למשתמש חדש</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    בהמשך נשתמש בזה כדי להציג הכוונה קצרה למשתמשים חדשים.
                  </p>
                </div>
              </div>

              <Switch
                checked={showNewUserTips}
                onCheckedChange={toggleNewUserTips}
                aria-label="toggle new user tips"
              />
            </div>
          </CardContent>
        </Card>

        {/* Legal */}
        <Card className="bg-gradient-card border-border shadow-card">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-neon-green" />
              <h2 className="text-base font-semibold text-foreground">מידע משפטי</h2>
            </div>

            <Button asChild variant="outline" className="w-full justify-start gap-3">
              <Link to="/terms">
                <FileText className="h-4 w-4" />
                תנאי שימוש
              </Link>
            </Button>

            <Button asChild variant="outline" className="w-full justify-start gap-3">
              <Link to="/privacy">
                <ShieldCheck className="h-4 w-4" />
                מדיניות פרטיות
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card className="bg-gradient-card border-border/60 shadow-card">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-neon-green" />
              <h2 className="text-base font-semibold text-foreground">יצירת קשר</h2>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              לשאלות, בקשות, דיווח על תקלה או בקשת מחיקת מידע:
            </p>

            <a
              href="mailto:zivkad12@gmail.com"
              className="text-sm text-neon-green underline break-all"
            >
              zivkad12@gmail.com
            </a>
          </CardContent>
        </Card>

        <Button asChild variant="secondary" className="w-full gap-2">
          <Link to="/">
            <Home className="h-4 w-4" />
            חזרה לעמוד הבית
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default SettingsPage;