import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Trophy,
  BarChart3,
  Users,
  Flame,
  TrendingUp,
  Target,
  Medal,
  Star,
} from "lucide-react";
import type { OverviewStats, Insight } from "@/services/userHistoryService";

interface Props {
  stats: OverviewStats | null;
  loading: boolean;
}

const StatTile = ({ value, label, color }: { value: number | string; label: string; color: string }) => (
  <div className={`flex flex-col items-center p-3 rounded-lg border ${color}`}>
    <span className="text-2xl font-bold">{value}</span>
    <span className="text-xs text-muted-foreground mt-0.5">{label}</span>
  </div>
);

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

export const ProfileOverviewTab = ({ stats, loading }: Props) => {
  if (loading) {
    return (
      <Card className="bg-gradient-card border-primary/20 p-6 shadow-card">
        <p className="text-sm text-muted-foreground">טוען סטטיסטיקות...</p>
      </Card>
    );
  }
  if (!stats || stats.tournamentsPlayed === 0) {
    return (
      <Card className="bg-gradient-card border-primary/20 p-6 shadow-card text-center">
        <BarChart3 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          אין עדיין נתוני משחק לחשבון שלך. קשר את עצמך לשחקן בקבוצה כדי שטורנירים ייספרו.
        </p>
      </Card>
    );
  }

  const winRatePct = Math.round(stats.winRate * 100);
  const gd = stats.goalsFor - stats.goalsAgainst;

  return (
    <div className="space-y-4">
      {/* Headline summary */}
      <Card className="bg-gradient-card border-primary/20 p-4 shadow-card">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="h-5 w-5 text-neon-green" />
          <h3 className="text-base font-semibold text-foreground">סיכום אישי – כל הקבוצות</h3>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center p-3 bg-gaming-surface rounded-lg">
            <div className="text-2xl font-bold text-neon-green">{stats.tournamentsPlayed}</div>
            <div className="text-xs text-muted-foreground">טורנירים</div>
          </div>
          <div className="text-center p-3 bg-gaming-surface rounded-lg">
            <div className="text-2xl font-bold text-foreground">{stats.gamesPlayed}</div>
            <div className="text-xs text-muted-foreground">משחקים</div>
          </div>
          <div className="text-center p-3 bg-gaming-surface rounded-lg">
            <div className="text-2xl font-bold text-foreground">{winRatePct}%</div>
            <div className="text-xs text-muted-foreground">אחוז ניצחון</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <StatTile value={stats.wins} label="ניצחונות" color="bg-neon-green/10 border-neon-green/30 text-neon-green" />
          <StatTile value={stats.draws} label="תיקו" color="bg-muted border-border text-foreground" />
          <StatTile value={stats.losses} label="הפסדים" color="bg-destructive/10 border-destructive/30 text-destructive" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <StatTile value={stats.goalsFor} label="שערי זכות" color="bg-gaming-surface border-border text-foreground" />
          <StatTile value={stats.goalsAgainst} label="שערי חובה" color="bg-gaming-surface border-border text-foreground" />
          <StatTile
            value={gd > 0 ? `+${gd}` : `${gd}`}
            label="הפרש"
            color={`bg-gaming-surface border-border ${gd >= 0 ? "text-neon-green" : "text-destructive"}`}
          />
        </div>
      </Card>

      {/* Tier counts */}
      <Card className="bg-gradient-card border-primary/20 p-4 shadow-card">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="h-5 w-5 text-neon-green" />
          <h3 className="text-base font-semibold text-foreground">סיומים לפי דרג</h3>
        </div>
        <div className="grid grid-cols-5 gap-2">
          <StatTile value={stats.alpha} label="אלפא" color="bg-yellow-500/10 border-yellow-500/30 text-yellow-500" />
          <StatTile value={stats.beta} label="בטא" color="bg-slate-400/10 border-slate-400/30 text-slate-300" />
          <StatTile value={stats.gamma} label="גמא" color="bg-amber-500/10 border-amber-500/30 text-amber-500" />
          <StatTile value={stats.delta} label="דלתא" color="bg-sky-400/10 border-sky-400/30 text-sky-400" />
          <StatTile value={stats.epsilon} label="אפסילון" color="bg-purple-400/10 border-purple-400/30 text-purple-300" />
        </div>
      </Card>

      {/* Global insights */}
      {stats.insights.length > 0 && (
        <Card className="bg-gradient-card border-primary/20 p-4 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-5 w-5 text-neon-green" />
            <h3 className="text-base font-semibold text-foreground">תובנות גלובליות</h3>
          </div>
          <div className="space-y-2">
            {stats.insights.map((ins) => (
              <div
                key={ins.id}
                className="flex items-start gap-2 p-2 bg-gaming-surface rounded-lg"
              >
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

      {/* Per-team breakdown */}
      <Card className="bg-gradient-card border-primary/20 p-4 shadow-card">
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-5 w-5 text-neon-green" />
          <h3 className="text-base font-semibold text-foreground">לפי קבוצה</h3>
        </div>
        <div className="space-y-2">
          {stats.perTeam.map((row) => (
            <div
              key={row.teamId}
              className="flex items-center justify-between gap-3 p-2 bg-gaming-surface rounded-lg"
            >
              <div className="min-w-0">
                <div className="font-medium text-foreground break-words">{row.teamName}</div>
                <div className="text-xs text-muted-foreground break-words">
                  שיחקת בשם: {row.playerName}
                  {row.games > 0 && ` · ${Math.round(row.winRate * 100)}% ניצחון`}
                </div>
              </div>
              <Badge variant="secondary" className="shrink-0">
                <Trophy className="h-3 w-3 ml-1" />
                {row.tournaments}
              </Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
