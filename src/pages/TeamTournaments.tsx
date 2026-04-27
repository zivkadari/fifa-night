import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, Eye, Loader2, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RemoteStorageService } from "@/services/remoteStorageService";
import { calculatePairStats, calculatePlayerStats } from "@/services/fivePlayerEngine";
import { Evening } from "@/types/tournament";
import { FPEvening } from "@/types/fivePlayerTypes";

type Team = {
  id: string;
  name: string;
};

type TeamEvening = Evening & {
  mode?: string;
  matchCount?: number;
  schedule?: any[];
  completed?: boolean;
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("he-IL", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function isFivePlayerEvening(evening: TeamEvening) {
  return evening.mode === "five-player-doubles" || evening.id?.startsWith("fp-");
}

function completedGames(evening: TeamEvening) {
  if (Array.isArray(evening.schedule)) {
    return evening.schedule.filter((m) => m.completed).length;
  }

  if (Array.isArray(evening.rounds)) {
    return evening.rounds.reduce((sum, round) => {
      return sum + (round.matches || []).filter((m) => m.completed).length;
    }, 0);
  }

  return 0;
}

export default function TeamTournaments() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();

  const [team, setTeam] = useState<Team | null>(null);
  const [evenings, setEvenings] = useState<TeamEvening[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!teamId) return;

      setLoading(true);

      try {
        const teams = await RemoteStorageService.listTeams();
        const foundTeam = teams.find((t) => t.id === teamId) || null;

        const teamEvenings = await RemoteStorageService.loadEveningsByTeam(teamId);

        if (!mounted) return;

        setTeam(foundTeam);
        setEvenings(teamEvenings as TeamEvening[]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [teamId]);

  const sortedEvenings = useMemo(() => {
    return [...evenings].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [evenings]);

  const openSpectate = async (evening: TeamEvening) => {
    setOpeningId(evening.id);

    try {
      const code = await RemoteStorageService.getShareCode(evening.id);

      if (code) {
        navigate(`/spectate/${code}`);
        return;
      }

      // Fallback: no share code found, stay on the page.
      alert("לא נמצא קישור צפייה לטורניר הזה");
    } finally {
      setOpeningId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gaming-bg p-4 flex items-center justify-center" dir="rtl">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 text-neon-green animate-spin mx-auto" />
          <p className="text-muted-foreground">טוען טורנירים...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gaming-bg p-4" dir="rtl">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5 rotate-180" />
          </Button>

          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">טורנירי הקבוצה</h1>
            <p className="text-sm text-muted-foreground">
              {team?.name || "קבוצה"} · {sortedEvenings.length} טורנירים
            </p>
          </div>
        </div>

        {sortedEvenings.length === 0 ? (
          <Card className="bg-gradient-card border-neon-green/20 p-6 text-center">
            <Trophy className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
            <h2 className="text-lg font-semibold text-foreground">אין טורנירים עדיין</h2>
            <p className="text-sm text-muted-foreground mt-1">
              טורנירים שמקושרים לקבוצה יופיעו כאן.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {sortedEvenings.map((evening) => {
              const isFive = isFivePlayerEvening(evening);
              const games = completedGames(evening);
              const totalGames = isFive
                ? evening.matchCount || evening.schedule?.length || 30
                : games;

              let topText = "";
              let playerStatsText = "";

              if (isFive && evening.schedule && evening.players) {
                const fp = evening as unknown as FPEvening;
                const pairStats = calculatePairStats(fp);
                const playerStats = calculatePlayerStats(fp);

                if (pairStats[0]) {
                  topText = `${pairStats[0].pair.players[0].name} & ${pairStats[0].pair.players[1].name}`;
                }

                if (playerStats[0]) {
                  playerStatsText = `מוביל: ${playerStats[0].player.name} · ${playerStats[0].points} נק׳`;
                }
              }

              return (
                <Card
                  key={evening.id}
                  className="bg-gradient-card border-neon-green/20 p-4 shadow-card space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="h-4 w-4 text-neon-green" />
                        <span className="text-lg font-bold text-foreground">
                          {formatDate(evening.date)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {isFive ? "5 שחקנים" : "טורניר"}
                        </Badge>

                        <Badge variant="outline" className="text-xs">
                          {games}/{totalGames} משחקים
                        </Badge>

                        {evening.completed && (
                          <Badge className="text-xs bg-yellow-400/20 text-yellow-300 border-yellow-400/30">
                            הסתיים
                          </Badge>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="neon"
                      size="sm"
                      disabled={openingId === evening.id}
                      onClick={() => openSpectate(evening)}
                    >
                      {openingId === evening.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                      צפה
                    </Button>
                  </div>

                  {isFive && topText && (
                    <div className="text-sm text-muted-foreground">
                      <Trophy className="h-3 w-3 inline text-yellow-400 ml-1" />
                      זוג מוביל: <span className="text-foreground">{topText}</span>
                    </div>
                  )}

                  {isFive && playerStatsText && (
                    <div className="text-sm text-muted-foreground">
                      <Users className="h-3 w-3 inline text-neon-green ml-1" />
                      {playerStatsText}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    שחקנים: {evening.players?.map((p) => p.name).join(", ")}
                  </p>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}