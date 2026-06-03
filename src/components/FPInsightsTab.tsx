import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { User } from "lucide-react";
import { FPEvening } from "@/types/fivePlayerTypes";
import { calculatePlayerStats } from "@/services/fivePlayerEngine";
import { computePersonalStats } from "@/services/spectatorPersonalStats";
import { computeAllTimeStats, computeAllTimeStatsForAll } from "@/services/allTimeStatsService";
import { generateInsights } from "@/services/insightGenerator";
import { useFivePlayerAllTimeHistory } from "@/hooks/useFivePlayerAllTimeHistory";
import PersonalSummaryCard from "@/components/spectate/PersonalSummaryCard";
import PersonalInsights from "@/components/spectate/PersonalInsights";
import AllTimeStatsCard from "@/components/spectate/AllTimeStatsCard";
import AllTimeLeaderboard from "@/components/spectate/AllTimeLeaderboard";

interface FPInsightsTabProps {
  evening: FPEvening;
  shareCode?: string;
  initialPlayerId?: string | null;
  onSwitchPlayer?: () => void;
  isCompleted?: boolean;
}

export default function FPInsightsTab({
  evening,
  shareCode,
  initialPlayerId,
  onSwitchPlayer,
  isCompleted,
}: FPInsightsTabProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(
    initialPlayerId ?? null
  );

  useEffect(() => {
    if (initialPlayerId) setSelectedPlayerId(initialPlayerId);
  }, [initialPlayerId]);

  // Reset if player isn't in this evening
  useEffect(() => {
    if (selectedPlayerId && !evening.players.some((p) => p.id === selectedPlayerId)) {
      setSelectedPlayerId(null);
    }
  }, [evening, selectedPlayerId]);

  const playerStats = useMemo(() => calculatePlayerStats(evening), [evening]);

  const { history: fpHistory } = useFivePlayerAllTimeHistory({
    currentEvening: evening,
    shareCode: shareCode || "",
  });

  const personal = useMemo(
    () =>
      selectedPlayerId
        ? computePersonalStats(evening, selectedPlayerId, playerStats)
        : null,
    [evening, selectedPlayerId, playerStats]
  );

  const allTimeStats = useMemo(
    () =>
      selectedPlayerId
        ? computeAllTimeStats(fpHistory, evening, selectedPlayerId)
        : null,
    [fpHistory, evening, selectedPlayerId]
  );

  const allPlayersAllTime = useMemo(
    () => computeAllTimeStatsForAll(fpHistory, evening),
    [fpHistory, evening]
  );

  const insights = useMemo(
    () => (allTimeStats ? generateInsights(allTimeStats, allPlayersAllTime) : []),
    [allTimeStats, allPlayersAllTime]
  );

  const handleSwitch = () => {
    setSelectedPlayerId(null);
    onSwitchPlayer?.();
  };

  if (!selectedPlayerId || !personal) {
    return (
      <Card className="bg-gradient-card border-neon-green/20 p-3 shadow-card space-y-3">
        <div className="text-center space-y-1">
          <h3 className="text-sm font-bold text-foreground">תובנות אישיות</h3>
          <p className="text-xs text-muted-foreground">בחר שחקן כדי לראות סטטיסטיקות ותובנות</p>
        </div>
        <div className="space-y-2">
          {evening.players.map((player) => (
            <button
              key={player.id}
              onClick={() => setSelectedPlayerId(player.id)}
              className="w-full bg-gaming-surface/60 border border-border/40 hover:border-neon-green/50 rounded-lg px-3 py-2.5 flex items-center gap-2 transition-all active:scale-[0.98]"
            >
              <div className="h-7 w-7 rounded-full bg-neon-green/10 border border-neon-green/30 flex items-center justify-center shrink-0">
                <User className="h-4 w-4 text-neon-green" />
              </div>
              <span className="text-sm font-semibold text-foreground">{player.name}</span>
            </button>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <PersonalSummaryCard
        personal={personal}
        onSwitchPlayer={handleSwitch}
        isCompleted={isCompleted}
      />
      <PersonalInsights personal={personal} />
      {allTimeStats && <AllTimeStatsCard stats={allTimeStats} />}
      {allPlayersAllTime.length > 0 && (
        <AllTimeLeaderboard
          allPlayersStats={allPlayersAllTime}
          selectedPlayerId={selectedPlayerId}
        />
      )}
      {insights.length > 0 && (
        <Card className="bg-gradient-card border-border/40 p-3 shadow-card space-y-1.5">
          <h4 className="text-xs font-semibold text-muted-foreground">תובנות</h4>
          {insights.map((ins, i) => (
            <p key={i} className="text-xs text-foreground">
              • {ins.title}
              {ins.detail ? <span className="text-muted-foreground"> — {ins.detail}</span> : null}
            </p>
          ))}
        </Card>
      )}
    </div>
  );
}
