import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Trophy, Gamepad2, Users2, User, Users, ChevronDown, ChevronRight,
  Eye, Settings, UserPlus, Star, LogOut, LogIn, X, Play, Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RemoteStorageService } from "@/services/remoteStorageService";
import { useTeam } from "@/contexts/TeamContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface TeamDashboardProps {
  onStartNew: () => void;
  onStartFivePlayer: () => void;
  onStartPairs: () => void;
  onStartSingles: () => void;
  onViewHistory: () => void;
  onResume?: () => void;
  onCloseTournament?: () => void;
  onManageTeams?: () => void;
  onJoinEvening?: () => void;
  isAuthed?: boolean;
  userEmail?: string | null;
  onSignOut?: () => void;
  activeTournamentMode?: string | null;
  activeTournamentProgress?: string | null;
}

export const TeamDashboard = ({
  onStartNew,
  onStartFivePlayer,
  onStartPairs,
  onStartSingles,
  onViewHistory,
  onResume,
  onCloseTournament,
  onManageTeams,
  onJoinEvening,
  isAuthed,
  userEmail,
  onSignOut,
  activeTournamentMode,
  activeTournamentProgress,
}: TeamDashboardProps) => {
  const { teams, activePlayer, loading: teamsLoading } = useTeam();
  const [manageOpen, setManageOpen] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const isAdmin = userEmail === "zivkad12@gmail.com";

  // Load profile display name for the greeting
  useEffect(() => {
    let mounted = true;
    if (!isAuthed) { setDisplayName(null); return; }
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const profile = await RemoteStorageService.getProfile(user.id);
        if (mounted && profile?.display_name) setDisplayName(profile.display_name);
      } catch {}
    })();
    return () => { mounted = false; };
  }, [isAuthed, userEmail]);

  const hasActiveTournament = !!onResume;
  const showNewUserOnboarding = !!isAuthed && !teamsLoading && teams.length === 0 && !hasActiveTournament;
  const showSignedOutOnboarding = !isAuthed;
  // Best-effort greeting name: profile display_name → claimed player name → email local-part
  const greetingName = displayName
    || activePlayer?.player_name
    || (userEmail ? userEmail.split("@")[0] : null);

  return (
    <div
      className="min-h-[100svh] bg-gaming-bg flex flex-col p-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      dir="rtl"
    >
      {/* ── 0. Auth strip ── */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex-1 min-w-0">
          {isAuthed ? (
            <div className="flex items-center gap-2">
              {greetingName && (
                <div className="h-8 w-8 rounded-full bg-neon-green/15 border border-neon-green/30 flex items-center justify-center text-neon-green text-sm font-bold shrink-0">
                  {greetingName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none mb-0.5">מחובר כ</p>
                <p className="text-sm text-foreground font-semibold truncate leading-tight">
                  {greetingName || userEmail}
                </p>
                {greetingName && userEmail && (
                  <p className="text-[10px] text-muted-foreground truncate leading-tight">{userEmail}</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">לא מחובר</p>
          )}
        </div>
        {isAuthed ? (
          <div className="flex items-center gap-1 shrink-0">
            <Button asChild variant="ghost" size="sm">
              <Link to="/profile">פרופיל</Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={onSignOut} className="text-muted-foreground h-8 w-8" title="התנתק">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button asChild variant="ghost" size="sm">
            <Link to="/auth">
              <LogIn className="h-4 w-4 ml-1" />
              התחברות
            </Link>
          </Button>
        )}
      </div>

      {/* ── 1. Title + team summary (non-interactive) ── */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-foreground">Soccer Night</h1>
        {teams.length > 0 && (
          <p className="text-xs text-muted-foreground mt-0.5">
            הקבוצות שלי: {teams.length} {teams.length === 1 ? "קבוצה" : "קבוצות"}
          </p>
        )}
      </div>

      {isAuthed && teamsLoading && (
        <Card className="bg-gradient-card border-border shadow-card mb-4">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              טוען את הקבוצות שלך...
            </p>
          </CardContent>
        </Card>
      )}

      {showSignedOutOnboarding && (
        <Card className="bg-gradient-card border-neon-green/30 shadow-card mb-4">
          <CardContent className="p-4 space-y-4">
            <div className="space-y-1">
              <p className="text-xs text-neon-green font-semibold">ברוך הבא</p>
              <h2 className="text-xl font-bold text-foreground">
                ברוך הבא ל־Soccer Night
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                נהל טורנירי כדורגל עם החברים שלך: קבוצות, שחקנים, תוצאות, היסטוריה וסטטיסטיקות — הכל במקום אחד.
              </p>
            </div>

            <div className="rounded-lg bg-gaming-surface/60 border border-border/50 p-3 space-y-2">
              <p className="text-sm font-semibold text-foreground">איך מתחילים?</p>
              <ol className="text-xs text-muted-foreground leading-relaxed space-y-1 list-decimal list-inside">
                <li>התחבר או צור חשבון.</li>
                <li>צור קבוצה או הצטרף לקבוצה קיימת.</li>
                <li>הוסף חברים ושחקנים.</li>
                <li>התחל טורניר וצפה בסטטיסטיקות.</li>
              </ol>
            </div>

            <Button asChild variant="gaming" size="lg" className="w-full gap-2">
              <Link to="/auth">
                <LogIn className="h-5 w-5" />
                התחבר / צור חשבון
              </Link>
            </Button>

            <div className="rounded-lg bg-gaming-surface/40 border border-border/40 p-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                קיבלת קישור הזמנה מחבר? פתח את הקישור שקיבלת, התחבר, ואנחנו נחזיר אותך אוטומטית להצטרפות לקבוצה.
              </p>
            </div>

            <Button asChild variant="outline" size="sm" className="w-full gap-2">
              <Link to="/settings">
                <Settings className="h-4 w-4" />
                הגדרות ומידע משפטי
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {showNewUserOnboarding && (
        <Card className="bg-gradient-card border-neon-green/30 shadow-card mb-4">
          <CardContent className="p-4 space-y-4">
            <div className="space-y-1">
              <p className="text-xs text-neon-green font-semibold">ברוך הבא</p>
              <h2 className="text-xl font-bold text-foreground">
                בוא ניצור את הקבוצה הראשונה שלך
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                כדי להתחיל טורניר צריך קודם ליצור קבוצה ולהוסיף אליה שחקנים.
                אחרי שתהיה לך קבוצה, תוכל להתחיל ליגת 5 שחקנים, זוגות או יחידים.
              </p>
            </div>

            <div className="rounded-lg bg-gaming-surface/60 border border-border/50 p-3 space-y-2">
              <p className="text-sm font-semibold text-foreground">איך מתחילים?</p>
              <ol className="text-xs text-muted-foreground leading-relaxed space-y-1 list-decimal list-inside">
                <li>צור קבוצה חדשה.</li>
                <li>הוסף את החברים שלך כשחקנים.</li>
                <li>שלח להם קישור הצטרפות כדי שיקשרו את עצמם לשחקן שלהם.</li>
                <li>חזור לעמוד הבית והתחל טורניר.</li>
              </ol>
            </div>
  
            {onManageTeams && (
              <Button variant="gaming" size="lg" onClick={onManageTeams} className="w-full gap-2">
                <Users className="h-5 w-5" />
                צור קבוצה ראשונה
              </Button>
            )}

            <div className="rounded-lg bg-gaming-surface/40 border border-border/40 p-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                קיבלת קישור הזמנה לקבוצה קיימת? פתח את הקישור שקיבלת מהחבר,
                התחבר, ואז תוכל לבחור מי אתה מתוך שחקני הקבוצה.
              </p>
            </div>
  
            <Button asChild variant="outline" size="sm" className="w-full gap-2">
              <Link to="/settings">
                <Settings className="h-4 w-4" />
                הגדרות ומידע משפטי
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── 2. Primary card: active tournament or start new ── */}
      {!teamsLoading && !showNewUserOnboarding && (hasActiveTournament ? (
        <Card className="bg-gradient-card border-neon-green/30 shadow-glow mb-4 overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-neon-green animate-glow-pulse" />
                <span className="text-xs font-medium text-neon-green">טורניר פעיל</span>
              </div>
              {onCloseTournament && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                      <X className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>לסגור את הטורניר?</AlertDialogTitle>
                      <AlertDialogDescription>
                        הנתונים של הטורניר הנוכחי לא יישמרו להיסטוריה. פעולה זו לא ניתנת לביטול.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>ביטול</AlertDialogCancel>
                      <AlertDialogAction onClick={onCloseTournament} className="bg-destructive hover:bg-destructive/90">
                        סגור טורניר
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>

            {activeTournamentMode && (
              <p className="text-sm text-foreground font-semibold mb-1">{activeTournamentMode}</p>
            )}
            {activeTournamentProgress && (
              <p className="text-xs text-muted-foreground mb-3">{activeTournamentProgress}</p>
            )}

            <Button variant="gaming" size="lg" onClick={onResume} className="w-full">
              <Play className="h-5 w-5" />
              המשך טורניר
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card
          className="bg-gradient-card border-neon-green/20 shadow-card mb-4 cursor-pointer hover:border-neon-green/40 transition-all hover:shadow-glow group"
          onClick={onStartFivePlayer}
        >
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-neon-green/10 border border-neon-green/20 flex items-center justify-center group-hover:bg-neon-green/20 transition-colors">
              <Zap className="h-6 w-6 text-neon-green" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-foreground">התחל ליגת 5 שחקנים</h3>
              <p className="text-xs text-muted-foreground">5 שחקנים • 10 זוגות • 15/30 משחקים</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground rotate-180 shrink-0" />
          </CardContent>
        </Card>
      ))}

      {/* ── 3. Tournament mode launcher ── */}
      {!teamsLoading && !hasActiveTournament && !showNewUserOnboarding && (
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2 font-medium">מצבי משחק נוספים</p>
          <div className="grid grid-cols-2 gap-2">
            <Card
              className="bg-card border-border cursor-pointer hover:border-neon-green/30 transition-colors"
              onClick={onStartPairs}
            >
              <CardContent className="p-3 flex items-center gap-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">זוגות</p>
                  <p className="text-[10px] text-muted-foreground">4 שחקנים</p>
                </div>
              </CardContent>
            </Card>
            <Card
              className="bg-card border-border cursor-pointer hover:border-neon-green/30 transition-colors"
              onClick={onStartSingles}
            >
              <CardContent className="p-3 flex items-center gap-3">
                <User className="h-5 w-5 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">יחידים</p>
                  <p className="text-[10px] text-muted-foreground">קבוצות אישיות</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── 4. Tournaments ── */}
      <div className="mb-4 space-y-2">
        <p className="text-xs text-muted-foreground font-medium">טורנירים</p>

        <Card
          className="bg-card border-border cursor-pointer hover:border-neon-green/30 transition-colors"
          onClick={onViewHistory}
        >
          <CardContent className="p-3 flex items-center gap-3">
            <Eye className="h-5 w-5 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">טורנירים</p>
              <p className="text-[10px] text-muted-foreground">צפייה, היסטוריה וניהול כל הטורנירים שלך</p>
            </div>
          </CardContent>
        </Card>

        {onJoinEvening && isAuthed && (
          <Button variant="outline" size="default" onClick={onJoinEvening} className="w-full justify-start gap-3 border-neon-green/20">
            <UserPlus className="h-4 w-4" />
            הצטרף לערב
          </Button>
        )}
      </div>

      {/* ── 5. Team management (collapsible) ── */}
      <Collapsible open={manageOpen} onOpenChange={setManageOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 w-full text-xs text-muted-foreground font-medium mb-2 hover:text-foreground transition-colors">
            <Settings className="h-3.5 w-3.5" />
            ניהול
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${manageOpen ? "rotate-180" : ""}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2">
          {onManageTeams && (
            <Button variant="ghost" size="sm" onClick={onManageTeams} className="w-full justify-start gap-3 text-muted-foreground">
              <Users className="h-4 w-4" />
              ניהול קבוצות
            </Button>
          )}
            <Button asChild variant="ghost" size="sm" className="w-full justify-start gap-3 text-muted-foreground">
              <Link to="/settings">
                <Settings className="h-4 w-4" />
                הגדרות ומידע משפטי
              </Link>
            </Button>
          {isAdmin && (
            <>
              <Button asChild variant="ghost" size="sm" className="w-full justify-start gap-3 text-muted-foreground">
                <Link to="/admin/clubs">
                  <Star className="h-4 w-4" />
                  ניהול מאגר קבוצות
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="w-full justify-start gap-3 text-muted-foreground">
                <Link to="/admin/pool-config">
                  <Settings className="h-4 w-4" />
                  הגדרת הרכב קבוצות
                </Link>
              </Button>
            </>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Footer */}
      <div className="mt-auto pt-4 text-center">
        <p className="text-muted-foreground text-[10px]">Soccer Night</p>
      </div>
    </div>
  );
};
