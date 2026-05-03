import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Calendar, Eye, Trash2, Trophy, Users, Filter } from "lucide-react";
import { RemoteStorageService } from "@/services/remoteStorageService";
import { useToast } from "@/hooks/use-toast";
import { Evening } from "@/types/tournament";
import { FPEvening } from "@/types/fivePlayerTypes";
import { calculatePairStats, calculatePlayerStats } from "@/services/fivePlayerEngine";
import {
  computeCouplesPlayerStandings,
  computeCouplesPairStandings,
} from "@/services/spectatorCouplesStats";

type TournamentRow = (Evening | FPEvening | any) & {
  teamId?: string;
  teamName?: string;
  team_id?: string;
  team_name?: string;
  publicCode?: string;
  public_code?: string;
  shareCode?: string;
  share_code?: string;
  _updatedAt?: string;
  _createdAt?: string;
};

type StatusFilter = "all" | "active" | "completed";

function isFivePlayerEvening(evening: TournamentRow) {
  return (
    evening?.mode === "five-player-doubles" ||
    evening?.resolvedMode === "five-player-doubles" ||
    (typeof evening?.id === "string" && evening.id.startsWith("fp-")) ||
    Array.isArray(evening?.schedule)
  );
}

function getTeamId(evening: TournamentRow) {
  return evening.teamId || evening.team_id || "__no_team__";
}

function getTeamName(evening: TournamentRow) {
  return evening.teamName || evening.team_name || "ללא קבוצה";
}

function getShareCode(evening: TournamentRow) {
  return evening.publicCode || evening.public_code || evening.shareCode || evening.share_code || null;
}

function getTournamentTypeLabel(evening: TournamentRow) {
  if (isFivePlayerEvening(evening)) return "ליגת 5 שחקנים";
  if (evening.type === "singles") return "טורניר יחידים";
  if (evening.type === "pairs") return "טורניר זוגות";
  return "טורניר";
}

function getTournamentDate(evening: TournamentRow) {
  return new Date(evening.date || evening.created_at || Date.now()).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function tsOf(evening: TournamentRow) {
  for (const value of [evening.date, evening._updatedAt, evening.updated_at, evening._createdAt, evening.created_at]) {
    if (!value) continue;
    const t = new Date(value).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

function getCompletedGames(evening: TournamentRow) {
  if (isFivePlayerEvening(evening)) {
    return Array.isArray(evening.schedule)
      ? evening.schedule.filter((m: any) => m.completed || m.scoreA != null || m.scoreB != null).length
      : 0;
  }

  return Array.isArray(evening.rounds)
    ? evening.rounds.reduce((sum: number, r: any) => {
        return sum + (Array.isArray(r.matches) ? r.matches.filter((m: any) => m.completed).length : 0);
      }, 0)
    : 0;
}

function getTotalGames(evening: TournamentRow) {
  if (isFivePlayerEvening(evening)) {
    return Array.isArray(evening.schedule) ? evening.schedule.length : 0;
  }

  return Array.isArray(evening.rounds)
    ? evening.rounds.reduce((sum: number, r: any) => {
        return sum + (Array.isArray(r.matches) ? r.matches.length : 0);
      }, 0)
    : 0;
}

function joinNames(names: string[]) {
  return names.join(" & ");
}

function getTournamentLeaders(evening: TournamentRow) {
  let playerLeaderText = "";
  let pairLeaderText = "";

  try {
    if (isFivePlayerEvening(evening) && evening.schedule && evening.players) {
      const fp = evening as unknown as FPEvening;
      const playerStats = calculatePlayerStats(fp);
      const pairStats = calculatePairStats(fp);

      if (playerStats[0]) {
        const topPoints = playerStats[0].points;
        const alphaPlayers = playerStats.filter((s) => s.points === topPoints);
        const playerLabel = alphaPlayers.length > 1 ? "שחקנים מובילים" : "שחקן מוביל";

        playerLeaderText = `${playerLabel}: ${joinNames(
          alphaPlayers.map((s) => s.player.name)
        )} · ${topPoints} נק׳`;
      }

      if (pairStats[0]) {
        const topPairPoints = pairStats[0].points;
        const topPairs = pairStats.filter((s) => s.points === topPairPoints);
        const pairLabel = topPairs.length > 1 ? "זוגות מובילים" : "זוג מוביל";

        pairLeaderText = `${pairLabel}: ${topPairs
          .map((s) => `${s.pair.players[0].name} & ${s.pair.players[1].name}`)
          .join(" / ")}`;
      }

      return { playerLeaderText, pairLeaderText };
    }

    const playerStandings = computeCouplesPlayerStandings(evening as Evening);
    const pairStandings = computeCouplesPairStandings(evening as Evening);

    if (playerStandings[0] && playerStandings[0].matchesPlayed > 0) {
      const topPoints = playerStandings[0].points;
      const topPlayers = playerStandings.filter(
        (s) => s.matchesPlayed > 0 && s.points === topPoints
      );
      const playerLabel = topPlayers.length > 1 ? "שחקנים מובילים" : "שחקן מוביל";

      playerLeaderText = `${playerLabel}: ${joinNames(
        topPlayers.map((s) => s.player.name)
      )} · ${topPoints} נק׳`;
    }

    if (
      evening.type !== "singles" &&
      pairStandings[0] &&
      pairStandings[0].matchesPlayed > 0
    ) {
      const topPairPoints = pairStandings[0].points;
      const topPairs = pairStandings.filter(
        (s) => s.matchesPlayed > 0 && s.points === topPairPoints
      );
      const pairLabel = topPairs.length > 1 ? "זוגות מובילים" : "זוג מוביל";

      pairLeaderText = `${pairLabel}: ${topPairs
        .map((s) => `${s.pair.players[0].name} & ${s.pair.players[1].name}`)
        .join(" / ")}`;
    }
  } catch {
    return { playerLeaderText: "", pairLeaderText: "" };
  }

  return { playerLeaderText, pairLeaderText };
}

const Tournaments = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [tournaments, setTournaments] = useState<TournamentRow[]>([]);
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);

  const loadTournaments = async () => {
    setLoading(true);
    try {
      const remote = await RemoteStorageService.loadEveningsWithTeams();
      setTournaments([...remote].sort((a: any, b: any) => tsOf(b) - tsOf(a)));
    } catch {
      setTournaments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTournaments();
  }, []);

  const teams = useMemo(() => {
    const map = new Map<string, string>();
    tournaments.forEach((t) => {
      map.set(getTeamId(t), getTeamName(t));
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [tournaments]);

  const filteredTournaments = useMemo(() => {
    return tournaments.filter((t) => {
      const byTeam = teamFilter === "all" || getTeamId(t) === teamFilter;
      const byStatus =
        statusFilter === "all" ||
        (statusFilter === "completed" && t.completed) ||
        (statusFilter === "active" && !t.completed);

      return byTeam && byStatus;
    });
  }, [tournaments, teamFilter, statusFilter]);

  const handleDelete = async (eveningId: string) => {
    try {
      await RemoteStorageService.deleteEvening(eveningId);
      setTournaments((prev) => prev.filter((t) => t.id !== eveningId));
      toast({ title: "הטורניר נמחק בהצלחה" });
    } catch {
      toast({ title: "שגיאה במחיקת הטורניר", variant: "destructive" });
    }
  };

  const handleView = (evening: TournamentRow) => {
    const code = getShareCode(evening);

    if (!code) {
      toast({
        title: "אין קישור צפייה לטורניר הזה",
        description: "אפשר עדיין לראות אותו בהיסטוריה, אבל לא נמצא קוד צפייה ציבורי.",
        variant: "destructive",
      });
      return;
    }

    navigate(`/spectate/${code}`);
  };

  return (
    <div className="min-h-[100svh] bg-gaming-bg p-4" dir="rtl">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-start justify-between gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5 rotate-180" />
          </Button>

          <div className="flex-1">
            <h1 className="text-4xl font-bold text-foreground">טורנירים</h1>
            <p className="text-muted-foreground mt-1">כל הטורנירים שמקושרים אליך</p>
          </div>
        </div>

        <Card className="bg-gradient-card border-neon-green/30 shadow-card">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-neon-green" />
                <span className="font-semibold text-foreground">סינון</span>
              </div>
              <span className="text-xs text-muted-foreground">
                מציג {filteredTournaments.length}/{tournaments.length} טורנירים
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={statusFilter === "all" ? "gaming" : "secondary"}
                onClick={() => setStatusFilter("all")}
              >
                הכל
              </Button>
              <Button
                variant={statusFilter === "active" ? "gaming" : "secondary"}
                onClick={() => setStatusFilter("active")}
              >
                פעילים
              </Button>
              <Button
                variant={statusFilter === "completed" ? "gaming" : "secondary"}
                onClick={() => setStatusFilter("completed")}
              >
                הסתיימו
              </Button>
            </div>

            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="bg-gaming-surface border-border">
                <SelectValue placeholder="בחר קבוצה" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הקבוצות</SelectItem>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <p className="text-xs text-muted-foreground">
              {teamFilter === "all"
                ? `כל הקבוצות · מציג ${filteredTournaments.length}/${tournaments.length}`
                : `${teams.find((t) => t.id === teamFilter)?.name || "קבוצה"} · מציג ${filteredTournaments.length}/${tournaments.length}`}
            </p>
          </CardContent>
        </Card>

        {loading ? (
          <Card className="bg-gradient-card border-border p-6 text-center">
            <p className="text-muted-foreground">טוען טורנירים...</p>
          </Card>
        ) : filteredTournaments.length === 0 ? (
          <Card className="bg-gradient-card border-border p-6 text-center">
            <p className="text-foreground font-semibold">אין טורנירים להצגה</p>
            <p className="text-sm text-muted-foreground mt-1">
              נסה לשנות סינון או להתחיל טורניר חדש.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredTournaments.map((evening) => {
              const completed = getCompletedGames(evening);
              const total = getTotalGames(evening);
              const typeLabel = getTournamentTypeLabel(evening);
              const { playerLeaderText, pairLeaderText } = getTournamentLeaders(evening);

              return (
                <Card
                  key={evening.id}
                  className="bg-gradient-card border-neon-green/20 shadow-card"
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-neon-green" />
                          <h2 className="text-2xl font-bold text-foreground">
                            {getTournamentDate(evening)}
                          </h2>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {getTeamName(evening)}
                        </p>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(evening.id)}
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{typeLabel}</Badge>
                      <Badge variant="outline">
                        {completed}/{total} משחקים
                      </Badge>
                      {evening.completed && (
                        <Badge className="bg-yellow-400/20 text-yellow-300 border-yellow-400/30">
                          הסתיים
                        </Badge>
                      )}
                      {!evening.completed && (
                        <Badge className="bg-neon-green/20 text-neon-green border-neon-green/30">
                          פעיל
                        </Badge>
                      )}
                    </div>

                    {playerLeaderText && (
                      <div className="text-sm text-muted-foreground">
                        <Users className="h-3 w-3 inline text-neon-green ml-1" />
                        {playerLeaderText}
                      </div>
                    )}

                    {pairLeaderText && (
                      <div className="text-sm text-muted-foreground">
                        <Trophy className="h-3 w-3 inline text-yellow-400 ml-1" />
                        {pairLeaderText}
                      </div>
                    )}

                    {Array.isArray(evening.players) && (
                      <p className="text-sm text-muted-foreground">
                        שחקנים: {evening.players.map((p: any) => p.name).join(", ")}
                      </p>
                    )}

                    <Button
                      variant="gaming"
                      className="w-full"
                      onClick={() => handleView(evening)}
                    >
                      <Eye className="h-4 w-4 ml-1" />
                      צפה
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Tournaments;