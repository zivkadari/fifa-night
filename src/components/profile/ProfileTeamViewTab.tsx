import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  Trophy,
  Users,
  BarChart3,
  TrendingUp,
  Flame,
  Target,
  Medal,
  Star,
} from "lucide-react";
import type {
  MyEvening,
  UnifiedEvening,
  TeamStats,
  Insight,
} from "@/services/userHistoryService";
import { modeLabelHe, tierLabelHe } from "@/services/userHistoryService";

interface Props {
  teams: Array<{ team_id: string; team_name: string }>;
  selectedTeamId: string | null;
  onSelectTeam: (id: string) => void;
  evenings: UnifiedEvening[];
  myEveningIds: Set<string>;
  myParticipationById: Map<string, MyEvening["participation"]>;
  teamStats: TeamStats | null;
  loading: boolean;
}

const formatDate = (e: UnifiedEvening) => {
  const value = e.date || e._updatedAt || e._createdAt;
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
};

const insightIcon = (icon: Insight["icon"]) => {
  const cls = "h-4 w-4 text-neon-green shrink-0";
  switch (icon) {
    case "trophy":
      return <Trophy className={cls} />;
    case "flame":
      return <Flame className={cls} />;
    case "trending":
      return <TrendingUp className={cls} />;
    case "target":
      return <Target className={cls} />;
    case "users":
      return <Users className={cls} />;
    case "medal":
      return <Medal className={cls} />;
    case "star":
    default:
      return <Star className={cls} />;
  }
};

const StatBox = ({ value, label, color }: { value: number | string; label: string; color: string }) => (
  <div className={`flex flex-col items-center p-2.5 rounded-lg border ${color}`}>
    <span className="text-lg font-bold">{value}</span>
    <span className="text-[10px] text-muted-foreground mt-0.5">{label}</span>
  </div>
);

export const ProfileTeamViewTab = ({
  teams,
  selectedTeamId,
  onSelectTeam,
  evenings,
  myEveningIds,
  myParticipationById,
  teamStats,
  loading,
}: Props) => {
  const [filter, setFilter] = useState<"all" | "mine">("all");

  const filtered = useMemo(() => {
    if (filter === "mine") return evenings.filter((e) => myEveningIds.has(e.id));
    return evenings;
  }, [evenings, filter, myEveningIds]);

  if (teams.length === 0) {
    return (
      <Card className="bg-gradient-card border-primary/20 p-6 shadow-card text-center">
        <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">אינך חבר בקבוצה כלשהי עדיין.</p>
      </Card>
    );
  }

  const winRatePct = teamStats ? Math.round(teamStats.winRate * 100) : 0;
  const gd = teamStats ? teamStats.goalsFor - teamStats.goalsAgainst : 0;

  return (
    <div className="space-y-4">
      {/* Team selector */}
      <Card className="bg-gradient-card border-primary/20 p-3 shadow-card">
        <Select value={selectedTeamId ?? ""} onValueChange={onSelectTeam}>
          <SelectTrigger className="w-full bg-gaming-surface border-border">
            <SelectValue placeholder="בחר קבוצה" />
          </SelectTrigger>
          <SelectContent>
            {teams.map((t) => (
              <SelectItem key={t.team_id} value={t.team_id}>
                {t.team_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {/* Team header + my stats */}
      {teamStats && (
        <Card className="bg-gradient-card border-primary/20 p-4 shadow-card">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <Users className="h-5 w-5 text-neon-green shrink-0" />
              <h3 className="text-base font-semibold text-foreground break-words">
                {teamStats.teamName}
              </h3>
            </div>
            <Badge variant="outline" className="shrink-0 text-xs">
              {teamStats.teamTournamentsTotal} טורנירים בקבוצה
            </Badge>
          </div>

          {teamStats.tournamentsPlayed === 0 ? (
            <p className="text-sm text-muted-foreground">
              עדיין לא השתתפת בטורנירים בקבוצה זו.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <StatBox value={teamStats.tournamentsPlayed} label="טורנירים שלי" color="bg-gaming-surface border-border text-neon-green" />
                <StatBox value={teamStats.gamesPlayed} label="משחקים" color="bg-gaming-surface border-border text-foreground" />
                <StatBox value={`${winRatePct}%`} label="ניצחון" color="bg-gaming-surface border-border text-foreground" />
              </div>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <StatBox value={teamStats.wins} label="W" color="bg-neon-green/10 border-neon-green/30 text-neon-green" />
                <StatBox value={teamStats.draws} label="D" color="bg-muted border-border text-foreground" />
                <StatBox value={teamStats.losses} label="L" color="bg-destructive/10 border-destructive/30 text-destructive" />
              </div>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <StatBox value={teamStats.goalsFor} label="GF" color="bg-gaming-surface border-border text-foreground" />
                <StatBox value={teamStats.goalsAgainst} label="GA" color="bg-gaming-surface border-border text-foreground" />
                <StatBox
                  value={gd > 0 ? `+${gd}` : `${gd}`}
                  label="GD"
                  color={`bg-gaming-surface border-border ${gd >= 0 ? "text-neon-green" : "text-destructive"}`}
                />
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                <StatBox value={teamStats.alpha} label="α" color="bg-yellow-500/10 border-yellow-500/30 text-yellow-500" />
                <StatBox value={teamStats.beta} label="β" color="bg-slate-400/10 border-slate-400/30 text-slate-300" />
                <StatBox value={teamStats.gamma} label="γ" color="bg-amber-500/10 border-amber-500/30 text-amber-500" />
                <StatBox value={teamStats.delta} label="δ" color="bg-sky-400/10 border-sky-400/30 text-sky-400" />
                <StatBox value={teamStats.epsilon} label="ε" color="bg-purple-400/10 border-purple-400/30 text-purple-300" />
              </div>
            </>
          )}
        </Card>
      )}

      {/* Team insights */}
      {teamStats && teamStats.insights.length > 0 && (
        <Card className="bg-gradient-card border-primary/20 p-4 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-5 w-5 text-neon-green" />
            <h3 className="text-base font-semibold text-foreground">תובנות בקבוצה</h3>
          </div>
          <div className="space-y-2">
            {teamStats.insights.map((ins) => (
              <div key={ins.id} className="flex items-start gap-2 p-2 bg-gaming-surface rounded-lg">
                {insightIcon(ins.icon)}
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground break-words">{ins.title}</div>
                  {ins.detail && (
                    <div className="text-xs text-muted-foreground break-words">{ins.detail}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* History filter */}
      <Card className="bg-gradient-card border-primary/20 p-3 shadow-card">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="h-4 w-4 text-neon-green" />
          <span className="text-sm font-medium text-foreground">היסטוריית הקבוצה</span>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={filter === "all" ? "gaming" : "outline"}
            onClick={() => setFilter("all")}
            className="flex-1"
          >
            הכל ({evenings.length})
          </Button>
          <Button
            size="sm"
            variant={filter === "mine" ? "gaming" : "outline"}
            onClick={() => setFilter("mine")}
            className="flex-1"
          >
            רק שלי ({myEveningIds.size})
          </Button>
        </div>
      </Card>

      {/* History list */}
      {loading ? (
        <Card className="bg-gradient-card border-primary/20 p-6 shadow-card">
          <p className="text-sm text-muted-foreground">טוען...</p>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="bg-gradient-card border-primary/20 p-6 shadow-card text-center">
          <p className="text-sm text-muted-foreground">
            {filter === "mine" ? "לא השתתפת בטורנירים בקבוצה זו." : "אין טורנירים לקבוצה זו."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((e) => {
            const isMine = myEveningIds.has(e.id);
            const participation = myParticipationById.get(e.id);
            return (
              <Card
                key={e.id}
                className={`bg-gradient-card p-4 shadow-card transition-shadow hover:shadow-glow ${
                  isMine ? "border-neon-green/60" : "border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Calendar className="h-4 w-4 text-neon-green shrink-0" />
                    <span className="font-semibold text-foreground">{formatDate(e)}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {modeLabelHe[e.resolvedMode]}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {isMine && (
                    <Badge variant="secondary" className="text-xs bg-neon-green/15 text-neon-green border-neon-green/40">
                      <Trophy className="h-3 w-3 ml-1" />
                      השתתפת
                    </Badge>
                  )}
                  {participation?.tier && (
                    <Badge variant="outline" className="text-xs">
                      {tierLabelHe[participation.tier]}
                    </Badge>
                  )}
                  {participation && participation.played > 0 && (
                    <Badge variant="outline" className="text-xs">
                      <span dir="ltr">{participation.wins}W-{participation.draws}D-{participation.losses}L</span>
                    </Badge>
                  )}
                </div>

                <p className="text-xs text-muted-foreground break-words">
                  {e.players.length} שחקנים: {e.players.map((p) => p.name).join(", ")}
                </p>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
