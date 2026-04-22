import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Users,
  User,
  Edit2,
  Check,
  X,
  UserCheck,
  UserPlus,
  ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RemoteStorageService } from "@/services/remoteStorageService";
import { toast } from "sonner";
import { useTeam } from "@/contexts/TeamContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SelectExistingPlayerDialog } from "@/components/SelectExistingPlayerDialog";
import {
  UserHistoryService,
  type MyEvening,
  type OverviewStats,
  type TeamStats,
  type UnifiedEvening,
} from "@/services/userHistoryService";
import { ProfileOverviewTab } from "@/components/profile/ProfileOverviewTab";
import { ProfileMyHistoryTab } from "@/components/profile/ProfileMyHistoryTab";
import { ProfileTeamViewTab } from "@/components/profile/ProfileTeamViewTab";

const Profile = () => {
  const {
    teams,
    activeTeamId,
    setActiveTeamId,
    activePlayer,
    claimedPlayers,
    refresh: refreshTeamContext,
    loading: teamLoading,
  } = useTeam();

  // ===== Identity =====
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);

  // ===== Player linking (per active team) =====
  const [teamPlayers, setTeamPlayers] = useState<Array<{ id: string; name: string }>>([]);
  const [showClaimDialog, setShowClaimDialog] = useState(false);
  const [showCreatePlayer, setShowCreatePlayer] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");

  // ===== Unified history data =====
  const [allEvenings, setAllEvenings] = useState<UnifiedEvening[]>([]);
  const [myEvenings, setMyEvenings] = useState<MyEvening[]>([]);
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Team View selected team (defaults to active team)
  const [teamViewId, setTeamViewId] = useState<string | null>(null);
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);

  // ----- Identity load -----
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (mounted) setProfileLoading(false);
          return;
        }
        if (mounted) setUserEmail(user.email ?? null);
        const profile = await RemoteStorageService.getProfile(user.id);
        if (mounted && profile) setDisplayName(profile.display_name);
      } finally {
        if (mounted) setProfileLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // ----- Unified history load (re-run when claims change) -----
  useEffect(() => {
    let mounted = true;
    (async () => {
      setHistoryLoading(true);
      try {
        const all = await UserHistoryService.loadAllVisibleEvenings();
        const mine = await UserHistoryService.loadMyEvenings(all);
        const ov = await UserHistoryService.loadOverview(mine);
        if (!mounted) return;
        setAllEvenings(all);
        setMyEvenings(mine);
        setOverview(ov);
      } finally {
        if (mounted) setHistoryLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [claimedPlayers.length, claimedPlayers.map((c) => c.player_id).join("|")]);

  // ----- Default Team View to active team -----
  useEffect(() => {
    if (!teamViewId && (activeTeamId || teams[0]?.team_id)) {
      setTeamViewId(activeTeamId ?? teams[0]?.team_id ?? null);
    }
  }, [activeTeamId, teams, teamViewId]);

  // ----- Compute TeamStats for the selected Team View -----
  useEffect(() => {
    let mounted = true;
    if (!teamViewId) {
      setTeamStats(null);
      return;
    }
    const team = teams.find((t) => t.team_id === teamViewId);
    if (!team) {
      setTeamStats(null);
      return;
    }
    UserHistoryService.loadTeamStats(teamViewId, team.team_name, allEvenings, myEvenings)
      .then((ts) => {
        if (mounted) setTeamStats(ts);
      })
      .catch(() => {
        if (mounted) setTeamStats(null);
      });
    return () => {
      mounted = false;
    };
  }, [teamViewId, teams, allEvenings, myEvenings]);

  // ----- Team players for the linking dialog -----
  useEffect(() => {
    if (!activeTeamId) {
      setTeamPlayers([]);
      return;
    }
    RemoteStorageService.listTeamPlayers(activeTeamId)
      .then(setTeamPlayers)
      .catch(() => setTeamPlayers([]));
  }, [activeTeamId]);

  // ----- Identity actions -----
  const handleUpdateDisplayName = async () => {
    if (!newDisplayName.trim()) {
      toast.error("שם התצוגה לא יכול להיות ריק");
      return;
    }
    const ok = await RemoteStorageService.updateProfile({ display_name: newDisplayName.trim() });
    if (ok) {
      setDisplayName(newDisplayName.trim());
      setEditingName(false);
      toast.success("שם התצוגה עודכן בהצלחה");
    } else {
      toast.error("שגיאה בעדכון שם התצוגה");
    }
  };

  const handleUnclaimForTeam = async (teamId: string) => {
    const ok = await RemoteStorageService.unclaimPlayerForTeam(teamId);
    if (ok) {
      await refreshTeamContext();
      toast.success("הקישור לשחקן הוסר");
    } else toast.error("שגיאה בהסרת הקישור");
  };

  const handleClaimPlayer = async (playerId: string) => {
    if (!activeTeamId) return;
    const result = await RemoteStorageService.claimPlayerForTeam(playerId, activeTeamId);
    if (result.ok) {
      await refreshTeamContext();
      setShowClaimDialog(false);
      toast.success("השחקן קושר בהצלחה!");
    } else {
      toast.error(result.error || "שגיאה בקישור השחקן");
    }
  };

  const handleCreateAndClaim = async () => {
    if (!activeTeamId || !newPlayerName.trim()) return;
    const added = await RemoteStorageService.addPlayerToTeamByName(activeTeamId, newPlayerName.trim());
    if (!added) {
      toast.error("שגיאה ביצירת שחקן");
      return;
    }
    const players = await RemoteStorageService.listTeamPlayers(activeTeamId);
    setTeamPlayers(players);
    const created = players.find(
      (p) => p.name.toLowerCase() === newPlayerName.trim().toLowerCase()
    );
    if (created) await handleClaimPlayer(created.id);
    setShowCreatePlayer(false);
    setNewPlayerName("");
  };

  // ----- Derived for Team View -----
  const teamViewEvenings = useMemo(
    () => (teamViewId ? allEvenings.filter((e) => e.teamId === teamViewId) : []),
    [allEvenings, teamViewId]
  );
  const myEveningIdsForTeam = useMemo(
    () => new Set(myEvenings.filter((e) => e.teamId === teamViewId).map((e) => e.id)),
    [myEvenings, teamViewId]
  );
  const myParticipationById = useMemo(() => {
    const m = new Map<string, MyEvening["participation"]>();
    for (const e of myEvenings) m.set(e.id, e.participation);
    return m;
  }, [myEvenings]);

  const activeTeam = teams.find((t) => t.team_id === activeTeamId);
  const hasLinkablePlayers = teamPlayers.length > 0;
  const overallLoading = profileLoading || teamLoading;

  return (
    <div className="min-h-screen bg-gaming-bg p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft className="h-5 w-5 rotate-180" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-foreground break-words">הפרופיל שלי</h1>
            <p className="text-muted-foreground text-sm break-words">{userEmail || "לא מחובר"}</p>
          </div>
        </div>

        {overallLoading ? (
          <Card className="bg-gradient-card border-primary/20 p-6 shadow-card">טוען פרופיל...</Card>
        ) : !userEmail ? (
          <Card className="bg-gradient-card border-primary/20 p-6 shadow-card text-center">
            <p className="mb-4">כדי לראות היסטוריה וקבוצות, התחבר לחשבון.</p>
            <Button variant="gaming" onClick={() => (window.location.href = "/auth")}>
              התחבר
            </Button>
          </Card>
        ) : (
          <>
            {/* Active team picker */}
            {teams.length > 1 && (
              <Card className="bg-gradient-card border-primary/20 p-3 mb-4 shadow-card">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">קבוצה פעילה:</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1">
                        {activeTeam?.team_name || "בחר קבוצה"}
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {teams.map((t) => (
                        <DropdownMenuItem key={t.team_id} onClick={() => setActiveTeamId(t.team_id)}>
                          {t.team_name}
                          {t.team_id === activeTeamId && (
                            <Check className="h-3.5 w-3.5 mr-2 text-neon-green" />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>
            )}

            {/* Identity + linked players card */}
            <Card className="bg-gradient-card border-primary/20 p-4 mb-4 shadow-card">
              <div className="flex items-center gap-2 mb-3">
                <User className="h-5 w-5 text-neon-green" />
                <h2 className="text-lg font-semibold text-foreground">פרטי המשתמש</h2>
              </div>

              <div className="space-y-3">
                {/* Display name */}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">שם תצוגה:</span>
                  {editingName ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={newDisplayName}
                        onChange={(e) => setNewDisplayName(e.target.value)}
                        className="h-8 w-32"
                        maxLength={50}
                      />
                      <Button size="icon" variant="ghost" onClick={handleUpdateDisplayName}>
                        <Check className="h-4 w-4 text-neon-green" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setEditingName(false)}>
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground break-words">{displayName}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setNewDisplayName(displayName);
                          setEditingName(true);
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Linked players across teams */}
                <div>
                  <p className="text-sm text-muted-foreground mb-2">השחקנים המקושרים שלך:</p>
                  {claimedPlayers.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      אין שחקנים מקושרים. בחר קבוצה פעילה ולחץ "קשר שחקן".
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {claimedPlayers.map((claim) => {
                        const team = teams.find((t) => t.team_id === claim.team_id);
                        return (
                          <div
                            key={claim.team_id}
                            className="flex items-center justify-between p-2 bg-gaming-surface rounded-lg gap-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Badge variant="secondary" className="flex items-center gap-1 shrink-0">
                                <UserCheck className="h-3 w-3" />
                                {claim.player_name}
                              </Badge>
                              {team && (
                                <span className="text-xs text-muted-foreground break-words">
                                  ב{team.team_name}
                                </span>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleUnclaimForTeam(claim.team_id)}
                            >
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Link controls for active team */}
                {activeTeamId && !activePlayer && (
                  <div className="pt-2 border-t border-border/40">
                    <p className="text-xs text-muted-foreground mb-2">
                      אינך מקושר לשחקן ב{activeTeam?.team_name}. קשר עכשיו:
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {hasLinkablePlayers && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowClaimDialog(true)}
                          className="gap-1"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          קשר שחקן קיים
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowCreatePlayer(true)}
                        className="gap-1"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        צור שחקן חדש
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-3">
                <TabsTrigger value="overview">סיכום</TabsTrigger>
                <TabsTrigger value="mine">ההיסטוריה שלי</TabsTrigger>
                <TabsTrigger value="team">לפי קבוצה</TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <ProfileOverviewTab stats={overview} loading={historyLoading} />
              </TabsContent>

              <TabsContent value="mine">
                <ProfileMyHistoryTab evenings={myEvenings} loading={historyLoading} />
              </TabsContent>

              <TabsContent value="team">
                <ProfileTeamViewTab
                  teams={teams}
                  selectedTeamId={teamViewId}
                  onSelectTeam={setTeamViewId}
                  evenings={teamViewEvenings}
                  myEveningIds={myEveningIdsForTeam}
                  myParticipationById={myParticipationById}
                  teamStats={teamStats}
                  loading={historyLoading}
                />
              </TabsContent>
            </Tabs>

            {/* Teams list (kept for clarity of role) */}
            <Card className="bg-gradient-card border-primary/20 p-4 mt-4 shadow-card">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-5 w-5 text-neon-green" />
                <h2 className="text-base font-semibold text-foreground">הקבוצות שלי</h2>
              </div>
              {teams.length === 0 ? (
                <p className="text-sm text-muted-foreground">לא נמצאו קבוצות.</p>
              ) : (
                <div className="space-y-2">
                  {teams.map((m) => (
                    <div
                      key={m.team_id}
                      className="flex items-center justify-between p-2 bg-gaming-surface rounded-lg"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-foreground break-words">{m.team_name}</span>
                        {m.team_id === activeTeamId && (
                          <Badge variant="outline" className="text-[10px]">
                            פעילה
                          </Badge>
                        )}
                      </div>
                      <Badge variant={m.role === "owner" ? "default" : "secondary"}>
                        {m.role === "owner" ? "בעלים" : "חבר"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
      </div>

      {showClaimDialog && activeTeamId && (
        <SelectExistingPlayerDialog
          open={showClaimDialog}
          onOpenChange={setShowClaimDialog}
          currentTeamId={activeTeamId}
          currentTeamPlayers={teamPlayers}
          disabledPlayerIds={[]}
          onPlayerSelected={async (playerId) => {
            await handleClaimPlayer(playerId);
          }}
        />
      )}

      {showCreatePlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <Card className="p-6 w-80 space-y-4">
            <h3 className="text-lg font-semibold text-foreground">צור שחקן חדש</h3>
            <Input
              placeholder="שם השחקן"
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              maxLength={50}
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowCreatePlayer(false);
                  setNewPlayerName("");
                }}
              >
                ביטול
              </Button>
              <Button variant="gaming" onClick={handleCreateAndClaim} disabled={!newPlayerName.trim()}>
                צור וקשר
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Profile;
