import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Users, Play, ChevronDown, ChevronUp } from "lucide-react";
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
  const [showUnavailableTeams, setShowUnavailableTeams] = useState(false);

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
      } catch (error) {
        console.error("Failed to load teams for FP mode:", error);
        if (mounted) {
          setTeams([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const availableTeams = teams
    .filter((team) => team.players.length === 5)
    .sort((a, b) => a.name.localeCompare(b.name));

  const unavailableTeams = teams
    .filter((team) => team.players.length !== 5)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div
      className="min-h-[100svh] bg-gaming-bg p-4 pt-[max(1rem,env(safe-area-inset-top))]"
      dir="rtl"
    >
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

        <Button
          variant="gaming"
          size="lg"
          className="w-full"
          onClick={onCreateNew}
        >
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
          {availableTeams.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-neon-green px-1">
                קבוצות זמינות למוד 5
              </p>

              {availableTeams.map((team) => (
                <Card
                  key={team.id}
                  className="bg-gradient-card border border-neon-green/30 p-4 shadow-card"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h2 className="text-base font-bold text-foreground">
                        {team.name}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {team.players.length}/5 שחקנים
                      </p>
                    </div>

                    <Badge variant="default">זמינה</Badge>
                  </div>

                  <p className="text-xs text-muted-foreground mb-3">
                    {team.players.map((p) => p.name).join(" • ")}
                  </p>

                  <Button
                    variant="gaming"
                    className="w-full"
                    onClick={() => onSelectTeam(team.id, team.name)}
                  >
                    <Play className="h-4 w-4" />
                    התחל עם קבוצה זו
                  </Button>
                </Card>
              ))}
            </div>
          )}

          {teams.length > 0 && availableTeams.length === 0 && !loading && (
            <Card className="bg-gaming-surface border-border/40 p-4 text-center">
              <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                אין כרגע קבוצות עם בדיוק 5 שחקנים
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                אפשר ליצור קבוצה חדשה למוד 5
              </p>
            </Card>
          )}

          {unavailableTeams.length > 0 && (
            <div className="space-y-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-between border-border/50 text-muted-foreground"
                onClick={() => setShowUnavailableTeams((prev) => !prev)}
              >
                <span>קבוצות לא זמינות למוד 5 ({unavailableTeams.length})</span>

                {showUnavailableTeams ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>

              {showUnavailableTeams && (
                <div className="space-y-2">
                  {unavailableTeams.map((team) => (
                    <Card
                      key={team.id}
                      className="bg-gaming-surface/50 border border-border/40 p-3 opacity-75"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <h2 className="text-sm font-bold text-foreground">
                            {team.name}
                          </h2>
                          <p className="text-xs text-muted-foreground">
                            {team.players.length}/5 שחקנים
                          </p>
                        </div>

                        <Badge variant="outline">לא זמינה</Badge>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        {team.players.length > 0
                          ? team.players.map((p) => p.name).join(" • ")
                          : "אין שחקנים בקבוצה"}
                      </p>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};