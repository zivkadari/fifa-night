import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RemoteStorageService } from "@/services/remoteStorageService";
import { Users, Search, Check } from "lucide-react";

interface PlayerWithTeams {
  id: string;
  name: string;
  teams: Array<{ id: string; name: string }>;
}

interface SelectExistingPlayerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTeamId: string;
  currentTeamPlayers: Array<{ id: string; name: string }>;
  onPlayerSelected: (playerId: string, playerName: string) => void;
  /**
   * When true (default), the picker is strictly limited to players that
   * already belong to the current team (`currentTeamPlayers`). This prevents
   * cross-team linking — a user must NOT be able to link to a player from a
   * different team while operating in the current team's context.
   * Set to false only for admin/global flows that intentionally need it.
   */
  teamScopedOnly?: boolean;
}

export const SelectExistingPlayerDialog = ({
  open,
  onOpenChange,
  currentTeamId,
  currentTeamPlayers,
  onPlayerSelected,
  teamScopedOnly = true,
}: SelectExistingPlayerDialogProps) => {
  const [players, setPlayers] = useState<PlayerWithTeams[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) {
      loadPlayers();
    }
  }, [open, teamScopedOnly, currentTeamId]);

  const loadPlayers = async () => {
    setLoading(true);
    try {
      if (teamScopedOnly) {
        // Strictly team-scoped: only show players that belong to the active team.
        // Use the already-loaded currentTeamPlayers as the candidate pool, so
        // players from other teams (e.g. Epsilons) cannot leak into a different
        // team's linking flow (e.g. Alphot B).
        setPlayers(
          currentTeamPlayers.map((p) => ({
            id: p.id,
            name: p.name,
            teams: [{ id: currentTeamId, name: "" }],
          }))
        );
      } else {
        const allPlayers = await RemoteStorageService.listAllMyPlayers();
        setPlayers(allPlayers);
      }
    } finally {
      setLoading(false);
    }
  };

  const currentPlayerIds = new Set(currentTeamPlayers.map((p) => p.id));

  const filteredPlayers = players.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  // Sort: players not in current team first
  const sortedPlayers = [...filteredPlayers].sort((a, b) => {
    const aInTeam = currentPlayerIds.has(a.id);
    const bInTeam = currentPlayerIds.has(b.id);
    if (aInTeam && !bInTeam) return 1;
    if (!aInTeam && bInTeam) return -1;
    return a.name.localeCompare(b.name, "he");
  });

  const handleSelect = (player: PlayerWithTeams) => {
    if (currentPlayerIds.has(player.id)) return;
    onPlayerSelected(player.id, player.name);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gaming-surface border-border max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Users className="h-5 w-5 text-neon-green" />
            בחר שחקן קיים
          </DialogTitle>
        </DialogHeader>

        <div className="relative mb-4">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="חפש שחקן..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-gaming-bg border-border pr-10"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 min-h-[200px] max-h-[400px]">
          {loading ? (
            <div className="text-center text-muted-foreground py-8">טוען...</div>
          ) : sortedPlayers.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {search ? "לא נמצאו שחקנים" : "אין שחקנים קיימים עדיין"}
            </div>
          ) : (
            sortedPlayers.map((player) => {
              const isInCurrentTeam = currentPlayerIds.has(player.id);
              return (
                <Button
                  key={player.id}
                  variant="ghost"
                  className={`w-full justify-start h-auto py-3 px-4 ${
                    isInCurrentTeam
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-neon-green/10"
                  }`}
                  onClick={() => handleSelect(player)}
                  disabled={isInCurrentTeam}
                >
                  <div className="flex flex-col items-start gap-1 w-full">
                    <div className="flex items-center gap-2 w-full">
                      <span className="font-medium text-foreground">
                        {player.name}
                      </span>
                      {isInCurrentTeam && (
                        <Check className="h-4 w-4 text-neon-green mr-auto" />
                      )}
                    </div>
                    {player.teams.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {player.teams.map((team) => (
                          <Badge
                            key={team.id}
                            variant="secondary"
                            className={`text-xs ${
                              team.id === currentTeamId
                                ? "bg-neon-green/20 text-neon-green"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {team.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </Button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
