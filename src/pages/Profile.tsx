import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Users, Trophy, User, Edit2, Check, X, UserCheck, Target, Medal, Award, BarChart3, UserPlus, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RemoteStorageService } from "@/services/remoteStorageService";
import { StorageService } from "@/services/storageService";
import type { Evening } from "@/types/tournament";
import { toast } from "sonner";
import { useTeam } from "@/contexts/TeamContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SelectExistingPlayerDialog } from "@/components/SelectExistingPlayerDialog";

interface TeamStats {
  team_id: string;
  team_name: string;
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

const Profile = () => {
  const { teams, activeTeamId, setActiveTeamId, activePlayer, claimedPlayers, refresh: refreshTeamContext, loading: teamLoading } = useTeam();
  
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [evenings, setEvenings] = useState<Evening[]>([]);
  
  // Profile state
  const [displayName, setDisplayName] = useState<string>("");
  const [editingName, setEditingName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState("");

  // Stats for active team's player
  const [activeTeamStats, setActiveTeamStats] = useState<TeamStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Player linking
  const [teamPlayers, setTeamPlayers] = useState<Array<{ id: string; name: string }>>([]);
  const [showClaimDialog, setShowClaimDialog] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [showCreatePlayer, setShowCreatePlayer] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }
        setUserEmail(user.email ?? null);

        const profile = await RemoteStorageService.getProfile(user.id);
        if (profile && mounted) setDisplayName(profile.display_name);

        // Load evenings
        let evs: Evening[] = [];
        try { evs = await RemoteStorageService.loadEvenings(); } catch {}
        if (!evs.length) evs = StorageService.loadEvenings();
        if (mounted) setEvenings(evs);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Load stats whenever activePlayer changes
  useEffect(() => {
    if (!activePlayer || !activeTeamId) {
      setActiveTeamStats(null);
      return;
    }
    let mounted = true;
    (async () => {
      setStatsLoading(true);
      try {
        const byTeam = await RemoteStorageService.getPlayerStatsByTeam(activePlayer.player_id);
        const match = byTeam.find(t => t.team_id === activeTeamId);
        if (mounted) setActiveTeamStats(match || null);
      } catch {}
      if (mounted) setStatsLoading(false);
    })();
    return () => { mounted = false; };
  }, [activePlayer?.player_id, activeTeamId]);

  // Load team players when active team changes (for claim dialog)
  useEffect(() => {
    if (!activeTeamId) { setTeamPlayers([]); return; }
    RemoteStorageService.listTeamPlayers(activeTeamId).then(setTeamPlayers).catch(() => setTeamPlayers([]));
  }, [activeTeamId]);

  const handleUpdateDisplayName = async () => {
    if (!newDisplayName.trim()) { toast.error("שם התצוגה לא יכול להיות ריק"); return; }
    const success = await RemoteStorageService.updateProfile({ display_name: newDisplayName.trim() });
    if (success) {
      setDisplayName(newDisplayName.trim());
      setEditingName(false);
      toast.success("שם התצוגה עודכן בהצלחה");
    } else {
      toast.error("שגיאה בעדכון שם התצוגה");
    }
  };

  const handleUnclaimForTeam = async (teamId: string) => {
    const success = await RemoteStorageService.unclaimPlayerForTeam(teamId);
    if (success) {
      await refreshTeamContext();
      toast.success("הקישור לשחקן הוסר");
    } else {
      toast.error("שגיאה בהסרת הקישור");
    }
  };

  const handleClaimPlayer = async (playerId: string) => {
    if (!activeTeamId) return;
    const success = await RemoteStorageService.claimPlayerForTeam(playerId, activeTeamId);
    if (success) {
      await refreshTeamContext();
      setShowClaimDialog(false);
      toast.success("השחקן קושר בהצלחה!");
    } else {
      toast.error("שגיאה בקישור השחקן");
    }
  };

  const handleCreateAndClaim = async () => {
    if (!activeTeamId || !newPlayerName.trim()) return;
    const added = await RemoteStorageService.addPlayerToTeamByName(activeTeamId, newPlayerName.trim());
    if (!added) { toast.error("שגיאה ביצירת שחקן"); return; }
    // Re-fetch players to get the new ID
    const players = await RemoteStorageService.listTeamPlayers(activeTeamId);
    setTeamPlayers(players);
    const newPlayer = players.find(p => p.name.toLowerCase() === newPlayerName.trim().toLowerCase());
    if (newPlayer) {
      await handleClaimPlayer(newPlayer.id);
    }
    setShowCreatePlayer(false);
    setNewPlayerName("");
  };

  const activeTeam = teams.find(t => t.team_id === activeTeamId);
  const winRate = activeTeamStats && activeTeamStats.games_played > 0
    ? Math.round((activeTeamStats.games_won / activeTeamStats.games_played) * 100) : 0;

  // Player-aware history filter.
  //
  // Priority:
  //   1. If a player is linked to the active team → show ONLY evenings where
  //      that exact linked player participated (true player-aware history).
  //      Match by player.id OR by slugified-name fallback (legacy data where
  //      historical entries used a different id but the same display name).
  //   2. Otherwise → fall back to team-tagged evenings for the active team.
  //   3. If neither team nor player is selected → show all.
  const slugify = (s: string) =>
    s.toLowerCase().trim().replace(/[^a-z0-9\u0590-\u05ff]+/g, "-").replace(/^-+|-+$/g, "");

  const teamEvenings = (() => {
    let filtered: Evening[];
    if (!activeTeamId) {
      filtered = evenings;
    } else {
      const linkedPlayerId = activePlayer?.player_id ?? null;
      const linkedPlayerName = activePlayer?.player_name ?? null;
      const linkedSlug = linkedPlayerName ? slugify(linkedPlayerName) : null;

      if (linkedPlayerId) {
        filtered = evenings.filter((e) => {
          if (!Array.isArray(e.players)) return false;
          return e.players.some(
            (p) =>
              p.id === linkedPlayerId ||
              (linkedSlug && slugify(p.name) === linkedSlug)
          );
        });
      } else {
        // No linked player: fall back to team-tagged evenings only
        filtered = evenings.filter(
          (e) => ((e as any)._team_id as string | undefined) === activeTeamId
        );
      }
    }

    // Always sort newest → oldest, deterministically.
    // Priority: tournament `date` → `updated_at` → `created_at`.
    const tsOf = (e: Evening): number => {
      const candidates = [
        (e as any).date,
        (e as any).updated_at,
        (e as any).created_at,
      ];
      for (const c of candidates) {
        if (!c) continue;
        const t = new Date(c).getTime();
        if (!Number.isNaN(t)) return t;
      }
      return 0;
    };
    return [...filtered].sort((a, b) => tsOf(b) - tsOf(a));
  })();

  // Derive Alpha/Beta/Gamma/Delta counts from the filtered (player-aware)
  // history. This is a robust client-side computation that always reflects the
  // linked player's true historical participation, even when the aggregate
  // stats table hasn't been synced yet.
  const derivedTiers = (() => {
    if (!activePlayer) return null;
    const linkedSlug = slugify(activePlayer.player_name);
    let alpha = 0, beta = 0, gamma = 0, delta = 0;
    for (const e of teamEvenings) {
      const r = e.rankings;
      if (!r) continue;
      const inTier = (group?: { id: string; name: string }[]) =>
        Array.isArray(group) &&
        group.some(
          (p) =>
            p.id === activePlayer.player_id || slugify(p.name) === linkedSlug
        );
      if (inTier(r.alpha)) alpha++;
      else if (inTier(r.beta)) beta++;
      else if (inTier(r.gamma)) gamma++;
      else if (inTier(r.delta)) delta++;
    }
    return { alpha, beta, gamma, delta };
  })();

  // Merge: prefer aggregate table for game/goal counts, but always overlay
  // derived tiers so the Alpha-Delta cards are never blank when history exists.
  const mergedStats = (() => {
    if (!activePlayer) return null;
    const base = activeTeamStats || {
      team_id: activeTeamId!,
      team_name: activeTeam?.team_name || "",
      games_played: 0, games_won: 0, games_lost: 0, games_drawn: 0,
      goals_for: 0, goals_against: 0,
      alpha_count: 0, beta_count: 0, gamma_count: 0, delta_count: 0,
    };
    if (!derivedTiers) return base;
    return {
      ...base,
      alpha_count: Math.max(base.alpha_count, derivedTiers.alpha),
      beta_count: Math.max(base.beta_count, derivedTiers.beta),
      gamma_count: Math.max(base.gamma_count, derivedTiers.gamma),
      delta_count: Math.max(base.delta_count, derivedTiers.delta),
    };
  })();

  // Players already claimed (exclude from selection)
  const alreadyClaimed = claimedPlayers.filter(c => c.team_id === activeTeamId).map(c => c.player_id);
  const availablePlayers = teamPlayers.filter(p => !alreadyClaimed.includes(p.id));

  return (
    <div className="min-h-screen bg-gaming-bg p-4">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft className="h-5 w-5 rotate-180" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">הפרופיל שלי</h1>
            <p className="text-muted-foreground text-sm">{userEmail || "לא מחובר"}</p>
          </div>
        </div>

        {loading || teamLoading ? (
          <Card className="bg-gradient-card border-primary/20 p-6 shadow-card">טוען פרופיל...</Card>
        ) : !userEmail ? (
          <Card className="bg-gradient-card border-primary/20 p-6 shadow-card text-center">
            <p className="mb-4">כדי לראות היסטוריה וקבוצות, התחבר לחשבון.</p>
            <Button variant="gaming" onClick={() => (window.location.href = "/auth")}>התחבר</Button>
          </Card>
        ) : (
          <>
            {/* Team Selector */}
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
                      {teams.map(t => (
                        <DropdownMenuItem key={t.team_id} onClick={() => setActiveTeamId(t.team_id)}>
                          {t.team_name}
                          {t.team_id === activeTeamId && <Check className="h-3.5 w-3.5 mr-2 text-neon-green" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>
            )}

            {teams.length === 0 && (
              <Card className="bg-gradient-card border-primary/20 p-4 mb-4 shadow-card text-center">
                <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-3">אתה עדיין לא חבר בקבוצה.</p>
                <p className="text-xs text-muted-foreground">בקש קישור הזמנה מחבר כדי להצטרף לקבוצה.</p>
              </Card>
            )}

            {/* Profile Info */}
            <Card className="bg-gradient-card border-primary/20 p-4 mb-4 shadow-card">
              <div className="flex items-center gap-2 mb-3">
                <User className="h-5 w-5 text-neon-green" />
                <h2 className="text-lg font-semibold text-foreground">פרטי פרופיל</h2>
              </div>
              
              <div className="space-y-4">
                {/* Display Name */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">שם תצוגה:</span>
                  {editingName ? (
                    <div className="flex items-center gap-2">
                      <Input value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} className="h-8 w-32" maxLength={50} />
                      <Button size="icon" variant="ghost" onClick={handleUpdateDisplayName}><Check className="h-4 w-4 text-green-500" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setEditingName(false)}><X className="h-4 w-4 text-red-500" /></Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{displayName}</span>
                      <Button size="icon" variant="ghost" onClick={() => { setNewDisplayName(displayName); setEditingName(true); }}><Edit2 className="h-4 w-4" /></Button>
                    </div>
                  )}
                </div>

                {/* Active Team Player Identity */}
                {activeTeamId && (
                  <div>
                    <span className="text-sm text-muted-foreground">
                      שחקן מקושר {activeTeam ? `(${activeTeam.team_name})` : ""}:
                    </span>
                    {activePlayer ? (
                      <div className="flex items-center justify-between mt-1">
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <UserCheck className="h-3 w-3" />
                          {activePlayer.player_name}
                        </Badge>
                        <Button size="sm" variant="ghost" onClick={() => handleUnclaimForTeam(activeTeamId)}>
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-2 space-y-2">
                        <p className="text-xs text-muted-foreground">אין שחקן מקושר בקבוצה זו.</p>
                        <div className="flex gap-2">
                          {availablePlayers.length > 0 && (
                            <Button size="sm" variant="outline" onClick={() => setShowClaimDialog(true)} className="gap-1">
                              <UserPlus className="h-3.5 w-3.5" />
                              קשר שחקן קיים
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => setShowCreatePlayer(true)} className="gap-1">
                            <UserPlus className="h-3.5 w-3.5" />
                            צור שחקן חדש
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>

            {/* Team Stats for active team's player */}
            {activeTeamId && activePlayer && (
              <Card className="bg-gradient-card border-primary/20 p-4 mb-4 shadow-card">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="h-5 w-5 text-neon-green" />
                  <h2 className="text-lg font-semibold text-foreground">
                    סטטיסטיקות {activeTeam?.team_name || ""}
                  </h2>
                </div>
                
                {statsLoading ? (
                  <p className="text-sm text-muted-foreground">טוען סטטיסטיקות...</p>
                ) : mergedStats && (mergedStats.games_played > 0 || teamEvenings.length > 0) ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center p-3 bg-gaming-surface rounded-lg">
                        <div className="text-2xl font-bold text-neon-green">{mergedStats.games_played}</div>
                        <div className="text-xs text-muted-foreground">משחקים</div>
                      </div>
                      <div className="text-center p-3 bg-gaming-surface rounded-lg">
                        <div className="text-2xl font-bold text-green-400">{mergedStats.games_won}</div>
                        <div className="text-xs text-muted-foreground">נצחונות</div>
                      </div>
                      <div className="text-center p-3 bg-gaming-surface rounded-lg">
                        <div className="text-2xl font-bold text-foreground">{mergedStats.games_played > 0 ? Math.round((mergedStats.games_won / mergedStats.games_played) * 100) : 0}%</div>
                        <div className="text-xs text-muted-foreground">אחוז נצחון</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gaming-surface rounded-lg">
                      <span className="text-sm text-muted-foreground">שערים</span>
                      <span className="font-bold text-foreground">{mergedStats.goals_for} : {mergedStats.goals_against}</span>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <div className="flex flex-col items-center p-2 bg-yellow-400/10 rounded-lg border border-yellow-400/30">
                        <Trophy className="h-4 w-4 text-yellow-400 mb-1" />
                        <span className="text-lg font-bold text-yellow-400">{mergedStats.alpha_count}</span>
                        <span className="text-xs text-muted-foreground">אלפא</span>
                      </div>
                      <div className="flex flex-col items-center p-2 bg-gray-400/10 rounded-lg border border-gray-400/30">
                        <Medal className="h-4 w-4 text-gray-400 mb-1" />
                        <span className="text-lg font-bold text-gray-400">{mergedStats.beta_count}</span>
                        <span className="text-xs text-muted-foreground">בטא</span>
                      </div>
                      <div className="flex flex-col items-center p-2 bg-amber-600/10 rounded-lg border border-amber-600/30">
                        <Award className="h-4 w-4 text-amber-500 mb-1" />
                        <span className="text-lg font-bold text-amber-500">{mergedStats.gamma_count}</span>
                        <span className="text-xs text-muted-foreground">גמא</span>
                      </div>
                      <div className="flex flex-col items-center p-2 bg-sky-400/10 rounded-lg border border-sky-400/30">
                        <Target className="h-4 w-4 text-sky-400 mb-1" />
                        <span className="text-lg font-bold text-sky-400">{mergedStats.delta_count}</span>
                        <span className="text-xs text-muted-foreground">דלתא</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">אין נתונים עדיין. הסטטיסטיקות יתעדכנו לאחר סיום טורנירים.</p>
                )}
              </Card>
            )}

            {/* Other team claims */}
            {claimedPlayers.length > 1 && (
              <Card className="bg-gradient-card border-primary/20 p-4 mb-4 shadow-card">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-5 w-5 text-neon-green" />
                  <h2 className="text-lg font-semibold text-foreground">שחקנים בקבוצות נוספות</h2>
                </div>
                <div className="space-y-1.5">
                  {claimedPlayers
                    .filter(c => c.team_id !== activeTeamId)
                    .map(claim => {
                      const team = teams.find(t => t.team_id === claim.team_id);
                      return (
                        <div key={claim.team_id} className="flex items-center justify-between p-2 bg-gaming-surface rounded-lg">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="flex items-center gap-1">
                              <UserCheck className="h-3 w-3" />
                              {claim.player_name}
                            </Badge>
                            {team && <span className="text-xs text-muted-foreground">({team.team_name})</span>}
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => handleUnclaimForTeam(claim.team_id)}>
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      );
                    })}
                </div>
              </Card>
            )}

            {/* My Team Memberships */}
            <Card className="bg-gradient-card border-primary/20 p-4 mb-4 shadow-card">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-5 w-5 text-neon-green" />
                <h2 className="text-lg font-semibold text-foreground">הקבוצות שלי</h2>
              </div>
              {teams.length === 0 ? (
                <p className="text-sm text-muted-foreground">לא נמצאו קבוצות.</p>
              ) : (
                <div className="space-y-2">
                  {teams.map((m) => (
                    <div key={m.team_id} className="flex items-center justify-between p-2 bg-gaming-surface rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{m.team_name}</span>
                        {m.team_id === activeTeamId && <Badge variant="outline" className="text-[10px]">פעילה</Badge>}
                      </div>
                      <Badge variant={m.role === 'owner' ? 'default' : 'secondary'}>
                        {m.role === 'owner' ? 'בעלים' : 'חבר'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Tournament history */}
            <Card className="bg-gradient-card border-primary/20 p-4 shadow-card">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="h-5 w-5 text-neon-green" />
                <h2 className="text-lg font-semibold text-foreground">היסטוריית טורנירים</h2>
              </div>
              {teamEvenings.length === 0 ? (
                <p className="text-sm text-muted-foreground">אין ערבים בהיסטוריה שלך עדיין.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-left">תאריך</TableHead>
                      <TableHead className="text-left">שחקנים</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamEvenings.map((e) => (
                      <TableRow key={e.id} className="hover:bg-gaming-surface/50">
                        <TableCell className="text-left">{new Date(e.date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-left">
                          <div className="flex flex-wrap gap-1">
                            {e.players.map((p) => (
                              <Badge key={p.id} variant="secondary">{p.name}</Badge>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </>
        )}
      </div>

      {/* Claim player dialog */}
      {showClaimDialog && activeTeamId && (
        <SelectExistingPlayerDialog
          open={showClaimDialog}
          onOpenChange={setShowClaimDialog}
          currentTeamId={activeTeamId}
          currentTeamPlayers={availablePlayers}
          onPlayerSelected={async (playerId) => { await handleClaimPlayer(playerId); }}
        />
      )}

      {/* Create new player inline */}
      {showCreatePlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <Card className="p-6 w-80 space-y-4">
            <h3 className="text-lg font-semibold text-foreground">צור שחקן חדש</h3>
            <Input
              placeholder="שם השחקן"
              value={newPlayerName}
              onChange={e => setNewPlayerName(e.target.value)}
              maxLength={50}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => { setShowCreatePlayer(false); setNewPlayerName(""); }}>ביטול</Button>
              <Button variant="gaming" onClick={handleCreateAndClaim} disabled={!newPlayerName.trim()}>צור וקשר</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Profile;
