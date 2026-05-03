import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { RemoteStorageService } from "@/services/remoteStorageService";
import { ArrowLeft, Users, Plus, Trash2, Trophy, RefreshCw, UserPlus, Pencil, Check, X, Link2, Copy } from "lucide-react";
import { validateTeamName, validatePlayerName } from "@/lib/validation";
import { SelectExistingPlayerDialog } from "./SelectExistingPlayerDialog";

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

interface TeamsManagerProps {
  onBack: () => void;
  onStartEveningForTeam: (teamId: string) => void;
}

export const TeamsManager = ({ onBack, onStartEveningForTeam }: TeamsManagerProps) => {
  const { toast } = useToast();
  const [teams, setTeams] = useState<Array<{ id: string; name: string }>>([]);
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
  const [loadingInvite, setLoadingInvite] = useState(false);

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
    if (!selectedTeamId) { setInviteCode(null); return; }
    const loadTeam = async () => {
      setLoading(true);
      try {
        const [players, stats, code] = await Promise.all([
          RemoteStorageService.listTeamPlayers(selectedTeamId),
          RemoteStorageService.getTeamLeaderboard(selectedTeamId),
          RemoteStorageService.getTeamInviteCode(selectedTeamId),
        ]);
        setTeamPlayers(players);
        setLeaderboard(stats);
        setInviteCode(code);
      } finally {
        setLoading(false);
      }
    };
    loadTeam();
  }, [selectedTeamId]);

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

  const deleteTeam = async (teamId: string) => {
    if (!window.confirm("אתה בטוח שברצונך למחוק את הקבוצה? הפעולה לא ניתנת לביטול.")) return;
    const ok = await RemoteStorageService.deleteTeam(teamId);
    if (ok) {
      setTeams((prev) => prev.filter((t) => t.id !== teamId));
      if (selectedTeamId === teamId) {
        setSelectedTeamId(null);
        setTeamPlayers([]);
        setLeaderboard([]);
      }
      toast({ title: "קבוצה נמחקה", description: "הקבוצה נמחקה בהצלחה" });
    } else {
      toast({ title: "שגיאה במחיקת קבוצה", variant: "destructive" });
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

  return (
    <div className="min-h-screen bg-gaming-bg p-4 mobile-optimized">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="חזרה">
            <ArrowLeft className="h-5 w-5 rotate-180" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">ניהול קבוצות</h1>
            <p className="text-muted-foreground text-sm">יצירה, הוספה וניהול שחקנים בקבוצה</p>
          </div>
        </div>

        {/* Teams list and create */}
        <Card className="bg-gradient-card border-neon-green/20 p-6 shadow-card mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-neon-green" />
            <h2 className="text-lg font-semibold text-foreground">הקבוצות שלי</h2>
          </div>
          <div className="flex gap-2 mb-3">
            <Input
              placeholder="שם קבוצה חדשה"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              className="bg-gaming-surface border-border"
            />
            <Button variant="outline" onClick={createTeam}>
              <Plus className="h-4 w-4" />
              צור
            </Button>
          </div>
          <div className="space-y-2">
            {teams.map((t) => (
              <div key={t.id} className="flex items-center gap-2">
                {editingTeamId === t.id ? (
                  <>
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
                  </>
                ) : (
                  <>
                    <Button
                      variant={t.id === selectedTeamId ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => setSelectedTeamId(t.id)}
                      className="flex-1"
                    >
                      {t.name}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={() => startEditingTeam(t)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={() => deleteTeam(t.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            ))}
            {!teams.length && (
              <p className="text-sm text-muted-foreground">אין קבוצות עדיין</p>
            )}
          </div>
        </Card>

        {selectedTeamId && (
          <>
            {/* Team invite link */}
            {inviteCode && (
              <Card className="bg-gaming-surface/50 border-border/50 p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Link2 className="h-4 w-4 text-neon-green" />
                  <h3 className="font-semibold text-foreground text-sm">קישור הזמנה לקבוצה</h3>
                </div>
                <div className="flex gap-2 items-center">
                  <code className="bg-gaming-bg border border-border rounded px-3 py-1.5 text-sm text-foreground flex-1 overflow-hidden text-ellipsis">
                    {`${window.location.origin}/join-team/${inviteCode}`}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/join-team/${inviteCode}`);
                      toast({ title: "הקישור הועתק!" });
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">שתף את הקישור כדי שחברים יצטרפו לקבוצה</p>
              </Card>
            )}

            {/* Players management */}
            <Card className="bg-gaming-surface/50 border-border/50 p-4 mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-foreground">שחקני הקבוצה</h3>
                <Button variant="gaming" size="sm" onClick={() => onStartEveningForTeam(selectedTeamId!)}>
                  התחל ערב לקבוצה זו
                </Button>
              </div>
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
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {teamPlayers.map((p) => (
                  <div key={p.id} className="flex items-center justify-between border-b border-border/50 py-1">
                    <span className="text-foreground">{p.name}</span>
                    <Button variant="ghost" size="icon" onClick={() => removePlayer(p.id)} aria-label="הסר">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {!teamPlayers.length && <p className="text-sm text-muted-foreground">אין שחקנים עדיין</p>}
              </div>
            </Card>

            {/* Team leaderboard */}
            <Card className="bg-gradient-card border-neon-green/20 p-6 shadow-card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-neon-green" />
                  <h2 className="text-lg font-semibold text-foreground">טבלת על של הקבוצה</h2>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleSyncStats}
                  disabled={syncing}
                >
                  <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              <div className="text-xs text-muted-foreground mb-3">
                סטטיסטיקות מחושבות מכל הערבים המשויכים לקבוצה
              </div>
              <Separator className="mb-3" />
              <div className="space-y-2">
                {loading ? (
                  <p className="text-sm text-muted-foreground">טוען...</p>
                ) : leaderboard.length ? (
                  leaderboard.map((s, idx) => (
                    <div key={s.player_id} className="flex items-center justify-between border-b border-border/50 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground w-5 text-right">{idx + 1}</span>
                        <span className="text-foreground font-medium">{s.player_name}</span>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        <span className="inline-block min-w-[4ch]">ניצ׳ {s.games_won}</span>
                        <span className="inline-block min-w-[7ch] ml-3">שערים {s.goals_for}:{s.goals_against}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">אין נתונים להצגה. לחץ על כפתור הרענון לעדכון סטטיסטיקות.</p>
                )}
              </div>
            </Card>
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
