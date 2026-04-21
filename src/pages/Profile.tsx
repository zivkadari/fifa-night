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

  const hasLinkablePlayers = teamPlayers.length > 0;

  return (
    <div className="min-h-screen bg-gaming-bg p-4">
      <div className="max-w-md mx-auto">
...
      {/* Claim player dialog */}
      {showClaimDialog && activeTeamId && (
        <SelectExistingPlayerDialog
          open={showClaimDialog}
          onOpenChange={setShowClaimDialog}
          currentTeamId={activeTeamId}
          currentTeamPlayers={teamPlayers}
          disabledPlayerIds={[]}
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
