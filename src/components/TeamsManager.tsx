import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { RemoteStorageService } from "@/services/remoteStorageService";
import { ArrowLeft, Users, Plus, Trash2, RefreshCw, UserPlus, Pencil, Check, X, Copy } from "lucide-react";
import { validateTeamName, validatePlayerName } from "@/lib/validation";
import { SelectExistingPlayerDialog } from "./SelectExistingPlayerDialog";
import { TeamMemberIdentityCard } from "./TeamMemberIdentityCard";
import { useTeam } from "@/contexts/TeamContext";

interface TeamLeaderboardEntry {
  player_id: string;
  player_name: string;
  games_played: number;
  games_won: number;
  games_lost: number;
  games_drawn: number;
  goals_for: number;
  goals_against: number;
  alpha_count: number;
  beta_count: number;
  gamma_count: number;
  delta_count: number;
}

interface TeamJoinRequest {
  id: string;
  team_id: string;
  user_id: string;
  status: string;
  message: string | null;
  created_at: string;
  user_display_name?: string | null;
  user_email?: string | null;
}

interface TeamsManagerProps {
  onBack: () => void;
  onStartEveningForTeam: (teamId: string) => void;
}

export const TeamsManager = ({ onBack, onStartEveningForTeam }: TeamsManagerProps) => {
  const { toast } = useToast();
  const { refresh: refreshTeamsContext, setActiveTeamId } = useTeam();
  const [teams, setTeams] = useState<Array<{ id: string; name: string; role?: string }>>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [teamPlayers, setTeamPlayers] = useState<Array<{ id: string; name: string }>>([]);
  const [newTeamName, setNewTeamName] = useState("");
  const [newPlayerName, setNewPlayerName] = useState("");
  const [leaderboard, setLeaderboard] = useState<TeamLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectPlayerOpen, setSelectPlayerOpen] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingTeamName, setEditingTeamName] = useState("");
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [teamVisibility, setTeamVisibility] = useState<"private" | "searchable" | "public">("private");
  const [teamDescription, setTeamDescription] = useState("");
  const [savingDiscovery, setSavingDiscovery] = useState(false);
  const [joinRequests, setJoinRequests] = useState<TeamJoinRequest[]>([]);
  const [handlingRequestId, setHandlingRequestId] = useState<string | null>(null);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showPlayers, setShowPlayers] = useState(false);
  const [showFullLeaderboard, setShowFullLeaderboard] = useState(false);
  const [showAdminSettings, setShowAdminSettings] = useState(false);
  const selectedTeam = teams.find((t) => t.id === selectedTeamId) || null;
  const selectedTeamRole = selectedTeam?.role || "member";
  const canManageSelectedTeam =
    selectedTeamRole === "owner" || selectedTeamRole === "admin";

  useEffect(() => {
    const load = async () => {
      const list = await RemoteStorageService.listTeams();
      setTeams(list);
      if (list.length && !selectedTeamId) {
        setSelectedTeamId(list[0].id);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!selectedTeamId) {
      setInviteCode(null);
      setTeamVisibility("private");
      setTeamDescription("");
      setJoinRequests([]);
      setTeamPlayers([]);
      setLeaderboard([]);
      return;
    }
  
    const loadTeam = async () => {
      setLoading(true);
  
      try {
        const [players, stats] = await Promise.all([
          RemoteStorageService.listTeamPlayers(selectedTeamId),
          RemoteStorageService.getTeamLeaderboard(selectedTeamId),
        ]);
  
        setTeamPlayers(players);
        setLeaderboard(stats);
  
        if (canManageSelectedTeam) {
          const [code, discovery, requests] = await Promise.all([
            RemoteStorageService.getTeamInviteCode(selectedTeamId),
            RemoteStorageService.getTeamDiscoverySettings(selectedTeamId),
            RemoteStorageService.listTeamJoinRequests(selectedTeamId),
          ]);
  
          setInviteCode(code);
          setJoinRequests(requests);
  
          if (discovery) {
            setTeamVisibility(discovery.visibility);
            setTeamDescription(discovery.description || "");
          } else {
            setTeamVisibility("private");
            setTeamDescription("");
          }
        } else {
          setInviteCode(null);
          setJoinRequests([]);
          setTeamVisibility("private");
          setTeamDescription("");
        }
      } finally {
        setLoading(false);
      }
    };
  
    loadTeam();
  }, [selectedTeamId, canManageSelectedTeam]);
  const handleSyncStats = async () => {
    setSyncing(true);
    try {
      const success = await RemoteStorageService.syncStats(undefined, true);
      if (success) {
        toast({ title: "סטטיסטיקות עודכנו", description: "הנתונים חושבו מחדש מכל הערבים" });
        // Reload leaderboard
        if (selectedTeamId) {
          const stats = await RemoteStorageService.getTeamLeaderboard(selectedTeamId);
          setLeaderboard(stats);
        }
      } else {
        toast({ title: "שגיאה בעדכון סטטיסטיקות", variant: "destructive" });
      }
    } finally {
      setSyncing(false);
    }
  };

  const createTeam = async () => {
    const name = newTeamName.trim();
    if (!name) return;
    
    // Validate team name
    const validation = validateTeamName(name);
    if (!validation.valid) {
      toast({ title: "שגיאה בשם הקבוצה", description: validation.error, variant: "destructive" });
      return;
    }
    
    try {
      const created = await RemoteStorageService.createTeam(validation.value);
      if (created) {
        // Refresh teams list from server to ensure RLS/membership is properly reflected
        const freshTeams = await RemoteStorageService.listTeams();
        setTeams(freshTeams);
        setNewTeamName("");
        setSelectedTeamId(created.id);
        toast({ title: "קבוצה נוצרה", description: validation.value });
      } else {
        toast({ title: "שגיאה ביצירת קבוצה", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "שגיאה ביצירת קבוצה", description: error instanceof Error ? error.message : "שגיאה לא ידועה", variant: "destructive" });
    }
  };

  const addPlayer = async () => {
    if (!selectedTeamId) return;
    const name = newPlayerName.trim();
    if (!name) return;
    
    // Validate player name
    const validation = validatePlayerName(name);
    if (!validation.valid) {
      toast({ title: "שגיאה בשם השחקן", description: validation.error, variant: "destructive" });
      return;
    }
    
    try {
      const ok = await RemoteStorageService.addPlayerToTeamByName(selectedTeamId, validation.value);
      if (ok) {
        setNewPlayerName("");
        const players = await RemoteStorageService.listTeamPlayers(selectedTeamId);
        setTeamPlayers(players);
      } else {
        toast({ title: "שגיאה בהוספת שחקן", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "שגיאה בהוספת שחקן", description: error instanceof Error ? error.message : "שגיאה לא ידועה", variant: "destructive" });
    }
  };

  const handleSelectExistingPlayer = async (playerId: string, playerName: string) => {
    if (!selectedTeamId) return;
    try {
      const ok = await RemoteStorageService.addExistingPlayerToTeam(selectedTeamId, playerId);
      if (ok) {
        const players = await RemoteStorageService.listTeamPlayers(selectedTeamId);
        setTeamPlayers(players);
        toast({ title: "שחקן נוסף", description: playerName });
      } else {
        toast({ title: "שגיאה בהוספת שחקן", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "שגיאה בהוספת שחקן", description: error instanceof Error ? error.message : "שגיאה לא ידועה", variant: "destructive" });
    }
  };

  const removePlayer = async (pid: string) => {
    if (!selectedTeamId) return;
    const ok = await RemoteStorageService.removePlayerFromTeam(selectedTeamId, pid);
    if (ok) {
      setTeamPlayers((prev) => prev.filter((p) => p.id !== pid));
    } else {
      toast({ title: "שגיאה במחיקה", variant: "destructive" });
    }
  };

  const leaveTeam = async (teamId: string, teamName?: string) => {
    if (
      !window.confirm(
        `להסיר את ${teamName || "הקבוצה"} מהקבוצות שלך? הקבוצה לא תימחק לשאר המשתמשים.`
      )
    ) {
      return;
    }
    
    const ok = await RemoteStorageService.leaveTeam(teamId);
    
    if (ok) {
      const freshTeams = await RemoteStorageService.listTeams();
      setTeams(freshTeams);
    
      const nextTeamId = freshTeams[0]?.id ?? null;
      setSelectedTeamId(nextTeamId);
      setActiveTeamId(nextTeamId);
    
      if (!nextTeamId) {
        setTeamPlayers([]);
        setLeaderboard([]);
        setInviteCode(null);
      }
    
      await refreshTeamsContext();
    
      toast({
        title: "הקבוצה הוסרה",
        description: "הקבוצה הוסרה מרשימת הקבוצות שלך",
      });
    } else {
      toast({
        title: "שגיאה בהסרת הקבוצה",
        variant: "destructive",
      });
    }
  };

  const saveDiscoverySettings = async () => {
    if (!selectedTeamId) return;
  
    setSavingDiscovery(true);
  
    try {
      const ok = await RemoteStorageService.updateTeamDiscoverySettings(
        selectedTeamId,
        teamVisibility,
        teamDescription
      );
  
      if (ok) {
        toast({
          title: "הגדרות החיפוש נשמרו",
          description:
            teamVisibility === "private"
              ? "הקבוצה פרטית ותהיה זמינה רק דרך קישור הזמנה"
              : "הקבוצה תהיה ניתנת לחיפוש על ידי משתמשים אחרים",
        });
      } else {
        toast({
          title: "שגיאה בשמירת הגדרות החיפוש",
          variant: "destructive",
        });
      }
    } finally {
      setSavingDiscovery(false);
    }
  };

  const approveRequest = async (requestId: string) => {
    setHandlingRequestId(requestId);
  
    try {
      const ok = await RemoteStorageService.approveJoinRequest(requestId);
  
      if (ok) {
        setJoinRequests((prev) => prev.filter((req) => req.id !== requestId));
        toast({
          title: "בקשת ההצטרפות אושרה",
          description: "המשתמש נוסף לקבוצה",
        });
      } else {
        toast({
          title: "שגיאה באישור הבקשה",
          description: "ייתכן שאין לך הרשאה לאשר בקשות לקבוצה הזו",
          variant: "destructive",
        });
      }
    } finally {
      setHandlingRequestId(null);
    }
  };

  const rejectRequest = async (requestId: string) => {
    setHandlingRequestId(requestId);
  
    try {
      const ok = await RemoteStorageService.rejectJoinRequest(requestId);
  
      if (ok) {
        setJoinRequests((prev) => prev.filter((req) => req.id !== requestId));
        toast({
          title: "בקשת ההצטרפות נדחתה",
        });
      } else {
        toast({
          title: "שגיאה בדחיית הבקשה",
          variant: "destructive",
        });
      }
    } finally {
      setHandlingRequestId(null);
    }
  };

  const startEditingTeam = (team: { id: string; name: string }) => {
    setEditingTeamId(team.id);
    setEditingTeamName(team.name);
  };

  const cancelEditingTeam = () => {
    setEditingTeamId(null);
    setEditingTeamName("");
  };

  const saveTeamName = async () => {
    if (!editingTeamId) return;
    const name = editingTeamName.trim();
    if (!name) return;

    const validation = validateTeamName(name);
    if (!validation.valid) {
      toast({ title: "שגיאה בשם הקבוצה", description: validation.error, variant: "destructive" });
      return;
    }

    try {
      const ok = await RemoteStorageService.renameTeam(editingTeamId, validation.value);
      if (ok) {
        setTeams((prev) => prev.map((t) => t.id === editingTeamId ? { ...t, name: validation.value } : t));
        toast({ title: "שם הקבוצה עודכן", description: validation.value });
        cancelEditingTeam();
      } else {
        toast({ title: "שגיאה בעדכון שם הקבוצה", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "שגיאה בעדכון שם הקבוצה", description: error instanceof Error ? error.message : "שגיאה לא ידועה", variant: "destructive" });
    }
  };

  const selectedTeamName = selectedTeam?.name || "קבוצה";
  const roleLabel =
    selectedTeamRole === "owner"
      ? "מנהל הקבוצה"
      : selectedTeamRole === "admin"
        ? "אדמין"
        : "חבר קבוצה";
  
  const playerNames = teamPlayers.map((p) => p.name);
  const playerPreview =
    playerNames.length <= 3
      ? playerNames.join(", ")
      : `${playerNames.slice(0, 3).join(", ")} ועוד ${playerNames.length - 3}`;
  
  const topLeaderboard = leaderboard.slice(0, 3);

  return (
    <div className="min-h-screen bg-gaming-bg p-4 mobile-optimized">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-5">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="חזרה">
            <ArrowLeft className="h-5 w-5 rotate-180" />
          </Button>
  
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-foreground">הקבוצות שלי</h1>
            <p className="text-muted-foreground text-sm">
              זהות בקבוצה, טבלה ופעולות מהירות
            </p>
          </div>
        </div>
  
        {/* Team selector */}
        <Card className="bg-gradient-card border-neon-green/20 p-4 shadow-card mb-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <Users className="h-5 w-5 text-neon-green shrink-0" />
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-foreground">בחר קבוצה</h2>
                <p className="text-xs text-muted-foreground">
                  {teams.length} {teams.length === 1 ? "קבוצה" : "קבוצות"}
                </p>
              </div>
            </div>
  
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateTeam((v) => !v)}
            >
              <Plus className="h-4 w-4" />
              צור
            </Button>
          </div>
  
          {showCreateTeam && (
            <div className="flex gap-2 mb-3">
              <Input
                placeholder="שם קבוצה חדשה"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                className="bg-gaming-surface border-border"
              />
              <Button variant="outline" onClick={createTeam}>
                צור
              </Button>
            </div>
          )}
  
          <div className="flex gap-2 overflow-x-auto pb-1">
            {teams.map((t) => (
              <Button
                key={t.id}
                variant={t.id === selectedTeamId ? "secondary" : "outline"}
                size="sm"
                onClick={() => {
                  setSelectedTeamId(t.id);
                  setShowPlayers(false);
                  setShowFullLeaderboard(false);
                  setShowAdminSettings(false);
                }}
                className="shrink-0"
              >
                {t.name}
              </Button>
            ))}
          </div>
  
          {!teams.length && (
            <p className="text-sm text-muted-foreground mt-2">אין קבוצות עדיין</p>
          )}
        </Card>
  
        {selectedTeamId && (
          <>
            {/* Selected team overview */}
            <Card className="bg-gaming-surface/50 border-border/50 p-4 mb-4">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-neon-green font-semibold mb-1">
                      {roleLabel}
                    </p>
                    <h2 className="text-xl font-bold text-foreground truncate">
                      {selectedTeamName}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      {teamPlayers.length} שחקנים · {leaderboard.length ? "יש נתוני טבלה" : "אין נתוני טבלה עדיין"}
                    </p>
                  </div>
            
                  {canManageSelectedTeam && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => selectedTeam && startEditingTeam(selectedTeam)}
                      aria-label="ערוך שם קבוצה"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
            
                {editingTeamId === selectedTeamId && (
                  <div className="flex gap-2">
                    <Input
                      value={editingTeamName}
                      onChange={(e) => setEditingTeamName(e.target.value)}
                      className="bg-gaming-surface border-border flex-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveTeamName();
                        if (e.key === "Escape") cancelEditingTeam();
                      }}
                    />
                    <Button variant="outline" size="icon" onClick={saveTeamName} className="text-neon-green">
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={cancelEditingTeam}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
            
                <Separator />
            
                <TeamMemberIdentityCard
                  teamId={selectedTeamId}
                  teamName={selectedTeamName}
                  compact
                />
            
                <Separator />
            
                <div>
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <div>
                      <h3 className="font-semibold text-foreground">שחקני הקבוצה</h3>
                      <p className="text-xs text-muted-foreground">
                        {teamPlayers.length
                          ? `${teamPlayers.length} שחקנים · ${playerPreview}`
                          : "אין שחקנים עדיין"}
                      </p>
                    </div>
            
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPlayers((v) => !v)}
                    >
                      {showPlayers ? "הסתר" : "הצג שחקנים"}
                    </Button>
                  </div>
            
                  {showPlayers && (
                    <div className="mt-3 rounded-lg border border-border/50 bg-gaming-bg/40 p-3 space-y-2">
                      {canManageSelectedTeam && (
                        <div className="flex gap-2 mb-3">
                          <Input
                            placeholder="שם שחקן חדש"
                            value={newPlayerName}
                            onChange={(e) => setNewPlayerName(e.target.value)}
                            className="bg-gaming-surface border-border flex-1"
                          />
                          <Button variant="outline" onClick={addPlayer} title="הוסף שחקן חדש">
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setSelectPlayerOpen(true)}
                            title="בחר שחקן קיים"
                          >
                            <UserPlus className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
            
                      {teamPlayers.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between border-b border-border/50 py-2 last:border-b-0"
                        >
                          <span className="text-foreground">{p.name}</span>
            
                          {canManageSelectedTeam && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removePlayer(p.id)}
                              aria-label="הסר"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
            
                      {!teamPlayers.length && (
                        <p className="text-sm text-muted-foreground">אין שחקנים עדיין</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Card>
  
            {/* Quick team overview */}
            <Card className="bg-gaming-surface/50 border-border/50 p-4 mb-4">
              <div className="space-y-4">
                
                {/* Leaderboard summary */}
                <div>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div>
                      <h3 className="font-semibold text-foreground">טבלת הקבוצה</h3>
                      <p className="text-xs text-muted-foreground">
                        תקציר ביצועים מכל הערבים בקבוצה
                      </p>
                    </div>
  
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleSyncStats}
                        disabled={syncing}
                      >
                        <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                      </Button>
  
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowFullLeaderboard((v) => !v)}
                      >
                        {showFullLeaderboard ? "הסתר" : "טבלה מלאה"}
                      </Button>
                    </div>
                  </div>
  
                  {loading ? (
                    <p className="text-sm text-muted-foreground">טוען...</p>
                  ) : leaderboard.length ? (
                    <div className="space-y-2">
                      {(showFullLeaderboard ? leaderboard : topLeaderboard).map((s, idx) => (
                        <div
                          key={s.player_id}
                          className="flex items-center justify-between border-b border-border/50 py-2 last:border-b-0"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground w-5 text-right">{idx + 1}</span>
                            <span className="text-foreground font-medium">{s.player_name}</span>
                          </div>
  
                          <div className="text-right text-xs text-muted-foreground">
                            <span>ניצ׳ {s.games_won}</span>
                            <span className="mr-3">שערים {s.goals_for}:{s.goals_against}</span>
                          </div>
                        </div>
                      ))}
  
                      {!showFullLeaderboard && leaderboard.length > 3 && (
                        <p className="text-xs text-muted-foreground text-center pt-1">
                          ועוד {leaderboard.length - 3} שחקנים בטבלה
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      אין נתונים להצגה. לחץ על רענון לעדכון סטטיסטיקות.
                    </p>
                  )}
                </div>
              </div>
            </Card>
  
            {/* Admin area */}
            {canManageSelectedTeam && (
              <Card className="bg-gaming-surface/50 border-border/50 p-3 mb-4">
                <div className="mb-2">
                  <h3 className="font-semibold text-foreground text-sm">ניהול קבוצה</h3>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="gaming"
                    size="sm"
                    onClick={() => selectedTeamId && onStartEveningForTeam(selectedTeamId)}
                  >
                    התחל ערב
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!inviteCode}
                    onClick={() => {
                      if (!inviteCode) return;
                      navigator.clipboard.writeText(`${window.location.origin}/join-team/${inviteCode}`);
                      toast({ title: "הקישור הועתק!" });
                    }}
                  >
                    <Copy className="h-4 w-4" />
                    הזמן
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAdminSettings((v) => !v)}
                  >
                    הגדרות
                  </Button>
                </div>
  
                {showAdminSettings && (
                  <div className="mt-4 space-y-4">
                    {/* Discovery settings */}
                    <div className="rounded-lg border border-border/50 bg-gaming-bg/40 p-3 space-y-3">
                      <div>
                        <h4 className="font-semibold text-foreground text-sm">גילוי והצטרפות</h4>
                        <p className="text-xs text-muted-foreground">
                          בחר האם משתמשים אחרים יוכלו למצוא את הקבוצה ולבקש להצטרף.
                        </p>
                      </div>
  
                      <select
                        value={teamVisibility}
                        onChange={(e) =>
                          setTeamVisibility(e.target.value as "private" | "searchable" | "public")
                        }
                        className="w-full rounded-md border border-border bg-gaming-surface px-3 py-2 text-sm text-foreground"
                      >
                        <option value="private">פרטית — רק עם קישור הזמנה</option>
                        <option value="searchable">ניתנת לחיפוש — אפשר לבקש להצטרף</option>
                        <option value="public">ציבורית — תופיע בחיפוש</option>
                      </select>
  
                      <Input
                        value={teamDescription}
                        onChange={(e) => setTeamDescription(e.target.value)}
                        placeholder="תיאור קצר לקבוצה"
                        className="bg-gaming-surface border-border"
                      />
  
                      <Button
                        variant="outline"
                        onClick={saveDiscoverySettings}
                        disabled={savingDiscovery}
                        className="w-full"
                      >
                        {savingDiscovery ? "שומר..." : "שמור הגדרות"}
                      </Button>
                    </div>
  
                    {/* Join requests */}
                    {joinRequests.length > 0 && (
                      <div className="rounded-lg border border-border/50 bg-gaming-bg/40 p-3 space-y-2">
                        <h4 className="font-semibold text-foreground text-sm">בקשות הצטרפות</h4>
  
                        {joinRequests.map((request) => (
                          <div
                            key={request.id}
                            className="rounded-lg border border-border/50 bg-gaming-surface/50 p-3 space-y-2"
                          >
                            <div>
                              <p className="text-sm font-semibold text-foreground">
                                {request.user_display_name ||
                                  request.user_email ||
                                  `משתמש ${request.user_id.slice(0, 8)}`}
                              </p>
  
                              {request.user_email && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {request.user_email}
                                </p>
                              )}
  
                              {request.message && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  הודעה: {request.message}
                                </p>
                              )}
                            </div>
  
                            <div className="flex gap-2">
                              <Button
                                variant="gaming"
                                size="sm"
                                className="flex-1"
                                disabled={handlingRequestId === request.id}
                                onClick={() => approveRequest(request.id)}
                              >
                                אשר
                              </Button>
  
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                disabled={handlingRequestId === request.id}
                                onClick={() => rejectRequest(request.id)}
                              >
                                דחה
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )}
  
            {/* Leave team */}
            {selectedTeam && selectedTeamRole !== "owner" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => leaveTeam(selectedTeam.id, selectedTeam.name)}
                className="w-full text-destructive hover:text-destructive mb-4"
              >
                עזוב קבוצה
              </Button>
            )}
          </>
        )}
  
        {/* Select existing player dialog */}
        <SelectExistingPlayerDialog
          open={selectPlayerOpen}
          onOpenChange={setSelectPlayerOpen}
          currentTeamId={selectedTeamId || ""}
          currentTeamPlayers={teamPlayers}
          onPlayerSelected={handleSelectExistingPlayer}
        />
      </div>
    </div>
  );
};