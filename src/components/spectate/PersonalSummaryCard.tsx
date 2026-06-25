import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PersonalStats } from "@/services/spectatorPersonalStats";
import { User, TrendingUp, Zap, Target, Trophy, Users, Swords, UserRound } from "lucide-react";

interface PersonalSummaryCardProps {
  personal: PersonalStats;
  onSwitchPlayer: () => void;
  isCompleted?: boolean;
}

import { TIER_LABELS } from "@/lib/tierRanking";

export default function PersonalSummaryCard({ personal, onSwitchPlayer, isCompleted }: PersonalSummaryCardProps) {
  const { player, stats, rank, matchesLeft, winRate, currentStreak, isPlayingNow, isSittingOutNow, currentPartner, currentOpponents, nextPartner, nextOpponents, bestPartner, toughestOpponent } = personal;

  const streakLabel = currentStreak.type === 'W'
    ? `🔥 ${currentStreak.count} ניצחונות ברצף`
    : currentStreak.type === 'L'
    ? `${currentStreak.count} הפסדים ברצף`
    : currentStreak.type === 'D'
    ? `${currentStreak.count} תיקו ברצף`
    : null;

  const tierLabel = rank >= 1 && rank <= 5 ? TIER_LABELS[rank - 1] : null;

  if (isCompleted) {
    return (
      <Card className="bg-gradient-card border-neon-green/30 p-4 shadow-card space-y-3">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-full bg-neon-green/15 border border-neon-green/40 flex items-center justify-center">
              {rank === 1 ? <Trophy className="h-4.5 w-4.5 text-neon-green" /> : <User className="h-4.5 w-4.5 text-neon-green" />}
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground leading-tight">{player.name}</h2>
              <p className="text-[11px] text-muted-foreground">
                {tierLabel && <span className="font-semibold text-foreground">{tierLabel}</span>}
                {tierLabel && ' · '}מקום {rank} · {stats.played} משחקים
              </p>
            </div>
          </div>
          <button
            onClick={onSwitchPlayer}
            className="text-[10px] text-muted-foreground hover:text-foreground border border-border/50 rounded-md px-2 py-1 transition-colors"
          >
            החלף שחקן
          </button>
        </div>

        {/* Completed badge */}
        <Badge variant="outline" className="border-neon-green/30 text-neon-green text-[11px]">
          <Trophy className="h-3 w-3 ml-1" />
          סיכום סופי · מקום {rank}
        </Badge>

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-2">
          <StatBox label="נקודות" value={stats.points} highlight />
          <StatBox label="ניצחונות" value={stats.wins} />
          <StatBox label="תיקו" value={stats.draws} />
          <StatBox label="הפסדים" value={stats.losses} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <StatBox label="הפ. שערים" value={`${stats.goalDiff > 0 ? '+' : ''}${stats.goalDiff}`} />
          <StatBox label="% ניצחון" value={`${winRate}%`} />
          <StatBox label="שערים" value={`${stats.goalsFor}:${stats.goalsAgainst}`} />
        </div>

        {/* Final streak */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">סה״כ {stats.played} משחקים</span>
          {streakLabel && stats.played >= 2 && (
            <span className={`font-medium ${currentStreak.type === 'W' ? 'text-neon-green' : currentStreak.type === 'L' ? 'text-destructive' : 'text-muted-foreground'}`}>
              {streakLabel}
            </span>
          )}
        </div>

        {/* Best partner & toughest opponent */}
        <div className="grid grid-cols-2 gap-2">
          {bestPartner && bestPartner.played >= 1 && (
            <div className="bg-gaming-surface/60 rounded-lg px-2.5 py-1.5 border border-border/30">
              <p className="text-[9px] text-muted-foreground flex items-center gap-1"><Users className="h-2.5 w-2.5" />שותף מוביל</p>
              <p className="text-xs font-bold text-foreground leading-tight mt-0.5">{bestPartner.partner.name}</p>
              <p className="text-[9px] text-muted-foreground">{bestPartner.wins}נ {bestPartner.draws}ת {bestPartner.losses}ה</p>
            </div>
          )}
          {toughestOpponent && toughestOpponent.played >= 1 && (
            <div className="bg-gaming-surface/60 rounded-lg px-2.5 py-1.5 border border-border/30">
              <p className="text-[9px] text-muted-foreground flex items-center gap-1"><Swords className="h-2.5 w-2.5" />יריב קשה</p>
              <p className="text-xs font-bold text-foreground leading-tight mt-0.5">{toughestOpponent.opponent.name}</p>
              <p className="text-[9px] text-muted-foreground">{toughestOpponent.wins}נ {toughestOpponent.draws}ת {toughestOpponent.losses}ה</p>
            </div>
          )}
        </div>
      </Card>
    );
  }

  // ── Live/active tournament card ──
  return (
    <Card className="bg-gradient-card border-neon-green/30 p-4 shadow-card space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-full bg-neon-green/15 border border-neon-green/40 flex items-center justify-center">
            <User className="h-4.5 w-4.5 text-neon-green" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground leading-tight">{player.name}</h2>
            <p className="text-[11px] text-muted-foreground">מקום {rank} • {stats.played} משחקים</p>
          </div>
        </div>
        <button
          onClick={onSwitchPlayer}
          className="text-[10px] text-muted-foreground hover:text-foreground border border-border/50 rounded-md px-2 py-1 transition-colors"
        >
          החלף שחקן
        </button>
      </div>

      {/* Status badge */}
      {isPlayingNow && (
        <Badge className="bg-neon-green/20 text-neon-green border-neon-green/30 text-[11px]">
          <Zap className="h-3 w-3 ml-1" />
          משחק עכשיו
          {currentPartner && <span className="mr-1">עם {currentPartner.name}</span>}
        </Badge>
      )}
      {isSittingOutNow && !isPlayingNow && (
        <div className="space-y-1">
          <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground text-[11px]">
            <UserRound className="h-3 w-3 ml-1" />
            יושב בחוץ במשחק הנוכחי
          </Badge>
          {nextPartner && nextOpponents && (
            <div className="text-[11px] text-muted-foreground">
              <TrendingUp className="h-3 w-3 inline ml-1" />
              הבא: עם <span className="text-foreground font-medium">{nextPartner.name}</span> נגד{' '}
              <span className="text-foreground font-medium">{nextOpponents[0].name} & {nextOpponents[1].name}</span>
            </div>
          )}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-2">
        <StatBox label="נקודות" value={stats.points} highlight />
        <StatBox label="ניצחונות" value={stats.wins} />
        <StatBox label="תיקו" value={stats.draws} />
        <StatBox label="הפסדים" value={stats.losses} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <StatBox label="הפ. שערים" value={`${stats.goalDiff > 0 ? '+' : ''}${stats.goalDiff}`} />
        <StatBox label="% ניצחון" value={`${winRate}%`} />
        <StatBox label="שערים" value={`${stats.goalsFor}:${stats.goalsAgainst}`} />
      </div>

      {/* Streak + matches left */}
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">
          {matchesLeft > 0 ? `${matchesLeft} משחקים נותרו` : 'כל המשחקים הסתיימו'}
        </span>
        {streakLabel && stats.played >= 2 && (
          <span className={`font-medium ${currentStreak.type === 'W' ? 'text-neon-green' : currentStreak.type === 'L' ? 'text-destructive' : 'text-muted-foreground'}`}>
            {streakLabel}
          </span>
        )}
      </div>

      {/* Current opponents */}
      {isPlayingNow && currentOpponents && (
        <div className="text-[11px] text-muted-foreground">
          <Target className="h-3 w-3 inline ml-1" />
          נגד: <span className="text-foreground font-medium">{currentOpponents[0].name} & {currentOpponents[1].name}</span>
        </div>
      )}

      {/* Next match preview */}
      {!isPlayingNow && !isSittingOutNow && nextPartner && nextOpponents && (
        <div className="text-[11px] text-muted-foreground">
          <TrendingUp className="h-3 w-3 inline ml-1" />
          הבא: עם <span className="text-foreground font-medium">{nextPartner.name}</span> נגד{' '}
          <span className="text-foreground font-medium">{nextOpponents[0].name} & {nextOpponents[1].name}</span>
        </div>
      )}
    </Card>
  );
}

function StatBox({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="bg-gaming-surface/60 rounded-lg px-2 py-1.5 text-center border border-border/30">
      <p className={`text-sm font-bold leading-tight ${highlight ? 'text-neon-green' : 'text-foreground'}`}>{value}</p>
      <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">{label}</p>
    </div>
  );
}
