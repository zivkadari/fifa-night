import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Trophy, History, Gamepad2, Users2, User, Users, ChevronDown, ChevronRight,
  Eye, Settings, UserPlus, Star, LogOut, LogIn, X, Play, Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RemoteStorageService } from "@/services/remoteStorageService";
import { useTeam } from "@/contexts/TeamContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  fpTeamId?: string | null;
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
  fpTeamId,
}: TeamDashboardProps) => {
  const { teams, activeTeamId, setActiveTeamId, activePlayer } = useTeam();
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

  const activeTeam = teams.find((t) => t.team_id === activeTeamId);
  const hasActiveTournament = !!onResume;
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

      {/* ── 1. Active team header ── */}
      <div className="mb-4">
        {teams.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 text-right w-full group">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">קבוצה פעילה</p>
                  <h1 className="text-xl font-bold text-foreground truncate">
                    {activeTeam?.team_name ?? "בחר קבוצה"}
                  </h1>
                </div>
                <ChevronDown className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              {teams.map((t) => (
                <DropdownMenuItem
                  key={t.team_id}
                  onClick={() => setActiveTeamId(t.team_id)}
                  className={t.team_id === activeTeamId ? "bg-secondary" : ""}
                >
                  {t.team_name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : activeTeam ? (
          <div>
            <p className="text-xs text-muted-foreground">קבוצה פעילה</p>
            <h1 className="text-xl font-bold text-foreground">{activeTeam.team_name}</h1>
          </div>
        ) : (
          <div>
            <p className="text-xs text-muted-foreground">ברוך הבא</p>
            <h1 className="text-xl font-bold text-foreground">EA FC 26</h1>
          </div>
        )}
      </div>

      {/* ── 2. Primary card: active tournament or start new ── */}
      {hasActiveTournament ? (
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
      )}

      {/* ── 3. Tournament mode launcher ── */}
      {!hasActiveTournament && (
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

      {/* ── 4. Spectator + History ── */}
      <div className="mb-4 space-y-2">
        <p className="text-xs text-muted-foreground font-medium">צפייה והיסטוריה</p>

        <Button variant="secondary" size="default" onClick={onViewHistory} className="w-full justify-start gap-3">
          <History className="h-4 w-4" />
          היסטוריית טורנירים
        </Button>

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
          {isAdmin && (
            <>
              <Button asChild variant="ghost" size="sm" className="w-full justify-start gap-3 text-muted-foreground">
                <Link to="/admin/clubs">
                  <Star className="h-4 w-4" />
                  ניהול קבוצות FIFA
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
        <p className="text-muted-foreground text-[10px]">EA FC 26 • Tournament Manager</p>
      </div>
    </div>
  );
};
