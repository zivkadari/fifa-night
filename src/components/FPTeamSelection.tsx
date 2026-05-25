import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Users, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RemoteStorageService } from "@/services/remoteStorageService";

interface TeamOption {
  id: string;
  name: string;
  role: string;
  players: Array<{ id: string; name: string }>;
  loading?: boolean;
}

interface FPTeamSelectionProps {
  onBack: () => void;
  onCreateNew: () => void;
  onSelectTeam: (teamId: string, teamName: string) => void;
}

export const FPTeamSelection = ({ onBack, onCreateNew, onSelectTeam }: FPTeamSelectionProps) => {
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const myTeams = await RemoteStorageService.listTeams();

        const withPlayers = await Promise.all(
          myTeams.map(async (team) => {
            const players = await RemoteStorageService.listTeamPlayers(team.id);
            return {
              ...team,
              players,
            };
          })
        );

        if (mounted) {
          setTeams(withPlayers);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-[100svh] bg-gaming-bg p-4 pt-[max(1rem,env(safe-area-inset-top))]" dir="rtl">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5 rotate-180" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">בחר קבוצה למוד 5</h1>
            <p className="text-xs text-muted-foreground">
              אפשר להתחיל רק עם קבוצה שיש בה בדיוק 5 שחקנים
            </p>
          </div>
        </div>

        <Button variant="gaming" size="lg" className="w-full" onClick={onCreateNew}>
          <Plus className="h-5 w-5" />
          צור קבוצה חדשה של 5 שחקנים
        </Button>

        {loading && (
          <Card className="bg-gaming-surface border-border/40 p-4 text-center">
            <p className="text-sm text-muted-foreground">טוען קבוצות...</p>
          </Card>
        )}

        {!loading && teams.length === 0 && (
          <Card className="bg-gaming-surface border-border/40 p-4 text-center">
            <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">אין לך עדיין קבוצות</p>
          </Card>
        )}

        <div className="space-y-3">
          {teams.map((team) => {
            const canUse = team.players.length === 5;

            return (
              <Card
                key={team.id}
                className={`bg-gradient-card border p-4 shadow-card ${
                  canUse ? "border-neon-green/30" : "border-border/40 opacity-70"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h2 className="text-base font-bold text-foreground">{team.name}</h2>
                    <p className="text-xs text-muted-foreground">
                      {team.players.length}/5 שחקנים
                    </p>
                  </div>

                  <Badge variant={canUse ? "default" : "outline"}>
                    {canUse ? "זמינה" : "לא זמינה"}
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground mb-3">
                  {team.players.length > 0
                    ? team.players.map(p => p.name).join(" • ")
                    : "אין שחקנים בקבוצה"}
                </p>

                <Button
                  variant={canUse ? "gaming" : "outline"}
                  className="w-full"
                  disabled={!canUse}
                  onClick={() => onSelectTeam(team.id, team.name)}
                >
                  <Play className="h-4 w-4" />
                  התחל עם קבוצה זו
                </Button>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};