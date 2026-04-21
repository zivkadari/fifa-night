import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Award, Target, BarChart3, Users } from "lucide-react";
import type { OverviewStats } from "@/services/userHistoryService";

interface Props {
  stats: OverviewStats | null;
  loading: boolean;
}

const StatTile = ({ value, label, color }: { value: number; label: string; color: string }) => (
  <div className={`flex flex-col items-center p-3 rounded-lg border ${color}`}>
    <span className="text-2xl font-bold">{value}</span>
    <span className="text-xs text-muted-foreground mt-0.5">{label}</span>
  </div>
);

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

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-card border-primary/20 p-4 shadow-card">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="h-5 w-5 text-neon-green" />
          <h3 className="text-base font-semibold text-foreground">סיכום אישי – כל הקבוצות</h3>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="text-center p-3 bg-gaming-surface rounded-lg">
            <div className="text-2xl font-bold text-neon-green">{stats.tournamentsPlayed}</div>
            <div className="text-xs text-muted-foreground">סה"כ טורנירים</div>
          </div>
          <div className="text-center p-3 bg-gaming-surface rounded-lg">
            <div className="text-2xl font-bold text-foreground">{stats.perTeam.length}</div>
            <div className="text-xs text-muted-foreground">קבוצות פעילות</div>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-2">
          <StatTile value={stats.alpha} label="אלפא" color="bg-yellow-500/10 border-yellow-500/30 text-yellow-500" />
          <StatTile value={stats.beta} label="בטא" color="bg-slate-400/10 border-slate-400/30 text-slate-300" />
          <StatTile value={stats.gamma} label="גמא" color="bg-amber-500/10 border-amber-500/30 text-amber-500" />
          <StatTile value={stats.delta} label="דלתא" color="bg-sky-400/10 border-sky-400/30 text-sky-400" />
          <StatTile value={stats.epsilon} label="אפסילון" color="bg-purple-400/10 border-purple-400/30 text-purple-300" />
        </div>
      </Card>

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
                <div className="text-xs text-muted-foreground break-words">מקושר ל: {row.playerName}</div>
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
