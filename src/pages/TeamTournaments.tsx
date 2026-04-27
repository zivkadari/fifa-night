import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  Eye,
  Filter,
  Loader2,
  Trophy,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RemoteStorageService } from "@/services/remoteStorageService";
import { calculatePairStats, calculatePlayerStats } from "@/services/fivePlayerEngine";
import { Evening } from "@/types/tournament";
import { FPEvening } from "@/types/fivePlayerTypes";

type StatusFilter = "all" | "active" | "completed";

type TournamentRow = Evening & {
  teamId?: string;
  teamName?: string;
  mode?: string;
  matchCount?: number;
  schedule?: any[];
  completed?: boolean;
  _updatedAt?: string;
  _createdAt?: string;
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("he-IL", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function isFivePlayerEvening(evening: TournamentRow) {
  return (
    evening.mode === "five-player-doubles" ||
    evening.id?.startsWith("fp-") ||
    Array.isArray(evening.schedule)
  );
}

function getCompletedGames(evening: TournamentRow) {
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

function getTotalGames(evening: TournamentRow) {
  if (Array.isArray(evening.schedule)) {
    return evening.matchCount || evening.schedule.length || 30;
  }

  if (Array.isArray(evening.rounds)) {
    const total = evening.rounds.reduce((sum, round) => {
      return sum + (round.matches || []).length;
    }, 0);

    return total || getCompletedGames(evening);
  }

  return getCompletedGames(evening);
}

function getTournamentTypeLabel(evening: TournamentRow) {
  if (isFivePlayerEvening(evening)) return "ליגת 5 שחקנים";
  if (evening.type === "singles") return "טורניר יחידים";
  if (evening.type === "pairs") return "טורניר זוגות";
  return "טורניר";
}

export default function TeamTournaments() {
  const { teamId } = useParams<{ teamId?: string }>();
  const navigate = useNavigate();

  const [tournaments, setTournaments] = useState<TournamentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [teamFilter, setTeamFilter] = useState<string>(teamId || "all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);

      try {
        let rows: TournamentRow[] = [];

        if (RemoteStorageService.isEnabled()) {
          rows = (await RemoteStorageService.loadEveningsWithTeams()) as TournamentRow[];
        }

        if (!mounted) return;

        setTournaments(rows);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (teamId) {
      setTeamFilter(teamId);
    }
  }, [teamId]);

  const teams = useMemo(() => {
    const map = new Map<string, string>();

    tournaments.forEach((t) => {
      if (t.teamId) {
        map.set(t.teamId, t.teamName || "קבוצה ללא שם");
      }
    });

    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tournaments]);

  const filteredTournaments = useMemo(() => {
    return [...tournaments]
      .filter((t) => {
        if (teamFilter !== "all" && t.teamId !== teamFilter) return false;
        if (statusFilter === "active" && t.completed) return false;
        if (statusFilter === "completed" && !t.completed) return false;
        return true;
      })
      .sort((a, b) => {
        if (!!a.completed !== !!b.completed) {
          return a.completed ? 1 : -1;
        }

        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
  }, [tournaments, teamFilter, statusFilter]);

  const openSpectate = async (evening: TournamentRow) => {
    setOpeningId(evening.id);

    try {
      const code = await RemoteStorageService.getShareCode(evening.id);

      if (code) {
        navigate(`/spectate/${code}`);
        return;
      }

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
            <h1 className="text-3xl font-bold text-foreground">טורנירים</h1>
            <p className="text-sm text-muted-foreground">
              כל הטורנירים שמקושרים אליך
            </p>
          </div>
        </div>

        <Card className="bg-gradient-card border-neon-green/20 p-3 space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="h-4 w-4 text-neon-green" />
            סינון
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button
              variant={statusFilter === "all" ? "gaming" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("all")}
            >
              הכל
            </Button>
            <Button
              variant={statusFilter === "active" ? "gaming" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("active")}
            >
              פעילים
            </Button>
            <Button
              variant={statusFilter === "completed" ? "gaming" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("completed")}
            >
              הסתיימו
            </Button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            <Button
              variant={teamFilter === "all" ? "gaming" : "outline"}
              size="sm"
              className="shrink-0"
              onClick={() => setTeamFilter("all")}
            >
              כל הקבוצות
            </Button>

            {teams.map((team) => (
              <Button
                key={team.id}
                variant={teamFilter === team.id ? "gaming" : "outline"}
                size="sm"
                className="shrink-0"
                onClick={() => setTeamFilter(team.id)}
              >
                {team.name}
              </Button>
            ))}
          </div>
        </Card>

        {filteredTournaments.length === 0 ? (
          <Card className="bg-gradient-card border-border p-6 text-center">
            <Trophy className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
            <h2 className="text-lg font-semibold text-foreground">אין טורנירים להצגה</h2>
            <p className="text-sm text-muted-foreground mt-1">
              נסה לשנות סינון או לבדוק קבוצה אחרת.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredTournaments.map((evening) => {
              const isFive = isFivePlayerEvening(evening);
              const completed = getCompletedGames(evening);
              const total = getTotalGames(evening);
              const typeLabel = getTournamentTypeLabel(evening);

              let topText = "";
              let playerStatsText = "";

              if (isFive && evening.schedule && evening.players) {
                try {
                  const fp = evening as unknown as FPEvening;
                  const pairStats = calculatePairStats(fp);
                  const playerStats = calculatePlayerStats(fp);

                  if (pairStats[0]) {
                    topText = `${pairStats[0].pair.players[0].name} & ${pairStats[0].pair.players[1].name}`;
                  }

                  if (playerStats[0]) {
                    playerStatsText = `מוביל: ${playerStats[0].player.name} · ${playerStats[0].points} נק׳`;
                  }
                } catch {
                  topText = "";
                  playerStatsText = "";
                }
              }

              return (
                <Card
                  key={evening.id}
                  className={`bg-gradient-card p-4 shadow-card space-y-3 ${
                    evening.completed
                      ? "border-border"
                      : "border-neon-green/40 shadow-glow"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="h-4 w-4 text-neon-green shrink-0" />
                        <span className="text-xl font-bold text-foreground">
                          {formatDate(evening.date)}
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground truncate">
                        {evening.teamName || "ללא קבוצה"}
                      </p>
                    </div>

                    <Button
                      variant={evening.completed ? "outline" : "gaming"}
                      size="sm"
                      disabled={openingId === evening.id}
                      onClick={() => openSpectate(evening)}
                      className="shrink-0"
                    >
                      {openingId === evening.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                      צפה
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {typeLabel}
                    </Badge>

                    <Badge variant="outline" className="text-xs">
                      {completed}/{total} משחקים
                    </Badge>

                    <Badge
                      className={
                        evening.completed
                          ? "text-xs bg-yellow-400/20 text-yellow-300 border-yellow-400/30"
                          : "text-xs bg-neon-green/15 text-neon-green border-neon-green/30"
                      }
                    >
                      {evening.completed ? "הסתיים" : "פעיל"}
                    </Badge>
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

                  <p className="text-xs text-muted-foreground line-clamp-2">
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