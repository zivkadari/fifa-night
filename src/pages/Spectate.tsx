import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Trophy, Users, Eye, Loader2, AlertCircle, ChevronDown, ChevronUp, ArrowLeft, Home } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { FPEvening, FPMatch, FPPair, FPTeamBank } from "@/types/fivePlayerTypes";
import { Evening } from "@/types/tournament";
import { StarRating, starText } from "@/components/StarRating";
import { calculatePairStats, calculatePlayerStats } from "@/services/fivePlayerEngine";
import { computePersonalStats, playerInMatch, playerInFPPair } from "@/services/spectatorPersonalStats";
import { computeAllTimeStats, computeAllTimeStatsForAll } from "@/services/allTimeStatsService";
import { generateInsights } from "@/services/insightGenerator";
import { useFivePlayerAllTimeHistory } from "@/hooks/useFivePlayerAllTimeHistory";
import PlayerPicker from "@/components/spectate/PlayerPicker";
import PersonalSummaryCard from "@/components/spectate/PersonalSummaryCard";
import PersonalInsights from "@/components/spectate/PersonalInsights";
import AllTimeStatsCard from "@/components/spectate/AllTimeStatsCard";
import AllTimeLeaderboard from "@/components/spectate/AllTimeLeaderboard";
import { FPTimingCard } from "@/components/FPTimingCard";
import InsightCards from "@/components/spectate/InsightCards";
import TeamSetupButton from "@/components/spectate/TeamSetupButton";
import CouplesSpectateView from "@/components/spectate/CouplesSpectateView";
import { TIER_LABELS, TIER_EMOJIS, TIER_COLORS, TIER_TEXT, computeTierIndices } from "@/lib/tierRanking";

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || "ikbywydyidnkohbdrqdk";
const POLL_INTERVAL = 4000;

type SpectateState = "loading" | "error" | "live";
type EveningMode = "five-player" | "couples";

function getStorageKey(code: string) {
  return `spectate-player-${code}`;
}

export default function Spectate() {
  const { code } = useParams<{ code: string }>();
  const [state, setState] = useState<SpectateState>("loading");
  const [evening, setEvening] = useState<FPEvening | null>(null);
  const [couplesEvening, setCouplesEvening] = useState<Evening | null>(null);
  const [eveningMode, setEveningMode] = useState<EveningMode | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [bankDrawerOpen, setBankDrawerOpen] = useState(false);
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(() => {
    if (!code) return null;
    return localStorage.getItem(getStorageKey(code)) || null;
  });
  const lastUpdatedAt = useRef<string>("");

  const selectPlayer = useCallback((playerId: string) => {
    setSelectedPlayerId(playerId);
    if (code) localStorage.setItem(getStorageKey(code), playerId);
  }, [code]);

  const clearPlayer = useCallback(() => {
    setSelectedPlayerId(null);
    if (code) localStorage.removeItem(getStorageKey(code));
  }, [code]);

  const fetchEvening = useCallback(async () => {
    if (!code) return;
    try {
      const res = await fetch(
        `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/get-public-evening?code=${encodeURIComponent(code)}`
      );
      if (!res.ok) {
        if (state === "loading") {
          setState("error");
          setErrorMsg("לא נמצא טורניר עם הקוד הזה");
        }
        return;
      }
      const json = await res.json();
      if (json.updated_at !== lastUpdatedAt.current) {
        lastUpdatedAt.current = json.updated_at;
        const data = json.data;
        if (data && data.mode === "five-player-doubles") {
          setEvening(data as FPEvening);
          setEveningMode("five-player");
          if (json.team_id) setTeamId(json.team_id);
          setState("live");
        } else if (data && data.players && data.players.length > 0) {
          setCouplesEvening(data as Evening);
          setEveningMode("couples");
          if (json.team_id) setTeamId(json.team_id);
          // Couples / pairs mode
          setCouplesEvening(data as Evening);
          setEveningMode("couples");
          setState("live");
        } else {
          setState("error");
          setErrorMsg("הטורניר הזה לא נתמך בתצוגת צפייה");
        }
      } else if (state === "loading") {
        setState("live");
      }
    } catch {
      if (state === "loading") {
        setState("error");
        setErrorMsg("שגיאה בטעינת הטורניר");
      }
    }
  }, [code, state]);

  const isCompleted = eveningMode === "five-player"
    ? evening?.completed === true
    : couplesEvening?.completed === true;

  useEffect(() => {
    fetchEvening();
    if (isCompleted) return;
    const interval = setInterval(fetchEvening, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchEvening, isCompleted]);

  // Validate stored player still exists in evening
  useEffect(() => {
    const players = eveningMode === "five-player" ? evening?.players : couplesEvening?.players;
    if (players && selectedPlayerId) {
      const exists = players.some(p => p.id === selectedPlayerId);
      if (!exists) clearPlayer();
    }
  }, [evening, couplesEvening, selectedPlayerId, clearPlayer, eveningMode]);

  if (state === "loading") {
    return (
      <div className="min-h-[100svh] bg-gaming-bg flex items-center justify-center" dir="rtl">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 text-neon-green animate-spin mx-auto" />
          <p className="text-muted-foreground">טוען טורניר...</p>
        </div>
      </div>
    );
  }

  if (state === "error" || (!evening && !couplesEvening)) {
    return (
      <div className="min-h-[100svh] bg-gaming-bg flex items-center justify-center p-4" dir="rtl">
        <Card className="bg-gradient-card border-destructive/30 p-6 max-w-sm text-center space-y-3">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
          <h1 className="text-lg font-bold text-foreground">שגיאה</h1>
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
        </Card>
      </div>
    );
  }

  // Determine players for picker
  const allPlayers = eveningMode === "five-player" ? evening!.players : couplesEvening!.players;

  // Show player picker if no player selected
  if (!selectedPlayerId) {
    const title = eveningMode === "five-player" ? "ליגת 5 שחקנים" : "טורניר זוגות";
    return <PlayerPicker players={allPlayers} onSelect={selectPlayer} title={title} />;
  }

  // Couples mode
  if (eveningMode === "couples" && couplesEvening) {
    return (
      <CouplesSpectateView
        evening={couplesEvening}
        selectedPlayerId={selectedPlayerId}
        onSwitchPlayer={clearPlayer}
        isCompleted={!!isCompleted}
      />
    );
  }

  // Five-player mode
  return (
    <PersonalizedSpectateView
      evening={evening!}
      selectedPlayerId={selectedPlayerId}
      onSwitchPlayer={clearPlayer}
      bankDrawerOpen={bankDrawerOpen}
      setBankDrawerOpen={setBankDrawerOpen}
      showUpcoming={showUpcoming}
      setShowUpcoming={setShowUpcoming}
      showRecent={showRecent}
      setShowRecent={setShowRecent}
      isCompleted={!!isCompleted}
      shareCode={code!}
      teamId={teamId}
    />
  );
}

/* ─── Main personalized view ─── */

interface PersonalizedViewProps {
  evening: FPEvening;
  selectedPlayerId: string;
  onSwitchPlayer: () => void;
  bankDrawerOpen: boolean;
  setBankDrawerOpen: (v: boolean) => void;
  showUpcoming: boolean;
  setShowUpcoming: (v: boolean) => void;
  showRecent: boolean;
  setShowRecent: (v: boolean) => void;
  isCompleted: boolean;
  shareCode: string;
  teamId: string | null;
}

function PersonalizedSpectateView({
  evening, selectedPlayerId, onSwitchPlayer,
  bankDrawerOpen, setBankDrawerOpen,
  showUpcoming, setShowUpcoming,
  showRecent, setShowRecent,
  isCompleted, shareCode, teamId,
}: PersonalizedViewProps) {
  const navigate = useNavigate();
  const pairStats = useMemo(() => calculatePairStats(evening), [evening]);
  const playerStats = useMemo(() => calculatePlayerStats(evening), [evening]);
  const personal = useMemo(
    () => computePersonalStats(evening, selectedPlayerId, playerStats),
    [evening, selectedPlayerId, playerStats]
  );

  const { history: fpHistory } = useFivePlayerAllTimeHistory({
    currentEvening: evening,
    shareCode,
  });

  const allTimeStats = useMemo(
    () => computeAllTimeStats(fpHistory, evening, selectedPlayerId),
    [fpHistory, evening, selectedPlayerId]
  );

  const allPlayersAllTime = useMemo(
    () => computeAllTimeStatsForAll(fpHistory, evening),
    [fpHistory, evening]
  );

  const insights = useMemo(
    () => allTimeStats ? generateInsights(allTimeStats, allPlayersAllTime) : [],
    [allTimeStats, allPlayersAllTime]
  );

  const currentMatch = evening.schedule[evening.currentMatchIndex] ?? null;
  const totalMatches = evening.schedule.length;
  const completedCount = evening.schedule.filter((m) => m.completed).length;

  const pairName = (pair: FPPair) =>
    `${pair.players[0].name} & ${pair.players[1].name}`;

  const renderStars = (stars: number) => <StarRating stars={stars} size="xs" />;

  const isMyMatch = (m: FPMatch) => playerInMatch(selectedPlayerId, m);

  // State for expanded table rows (to show teams)
  const [expandedPairId, setExpandedPairId] = useState<string | null>(null);
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  // Unified matches section for active tournaments
  const [showMatches, setShowMatches] = useState(false);

  // Helper: get teams for a pair with duplicate markers
  const getTeamsForPair = (pairId: string) => {
    const bank = evening.teamBanks.find((b) => b.pairId === pairId);
    if (!bank) return [];
    // Count occurrences of each club
    const clubCounts = new Map<string, { club: typeof bank.clubs[0]; count: number; usedCount: number }>();
    bank.clubs.forEach((club) => {
      const key = club.id;
      const existing = clubCounts.get(key);
      if (existing) {
        existing.count++;
      } else {
        clubCounts.set(key, { club, count: 1, usedCount: 0 });
      }
    });
    // Count used occurrences
    bank.usedClubIds.forEach((id) => {
      const entry = clubCounts.get(id);
      if (entry) entry.usedCount++;
    });
    return Array.from(clubCounts.values());
  };

  // Helper: get teams for a player (all pairs containing this player)
  const getTeamsForPlayer = (playerId: string) => {
    const playerPairs = evening.pairs.filter(p =>
      p.players.some(pl => pl.id === playerId)
    );
    return playerPairs.map(pair => ({
      pair,
      pairLabel: pairName(pair),
      teams: getTeamsForPair(pair.id),
    }));
  };

  // Render team chips for a pair
  const renderTeamChips = (pairId: string) => {
    const teams = getTeamsForPair(pairId);
    if (teams.length === 0) return null;
    return (
      <div className="grid grid-cols-2 gap-1.5 mt-2 px-1">
        {teams.map(({ club, count, usedCount }) => {
          const fullyUsed = isCompleted ? false : usedCount >= count;
          return (
            <div
              key={club.id}
              className={`flex items-center justify-between bg-gaming-surface/60 rounded-md px-2 py-1.5 border border-border/30 ${
                !isCompleted && fullyUsed ? "opacity-40" : ""
              }`}
            >
              <span className={`text-xs text-foreground truncate flex-1 ${!isCompleted && fullyUsed ? "line-through" : ""}`}>
                {club.name}
              </span>
              <span className="flex items-center gap-1">
                {count > 1 && (
                  <span className="text-[9px] text-muted-foreground font-medium">×{count}</span>
                )}
                <span className="text-yellow-400 text-[10px] whitespace-nowrap">
                  {renderStars(club.stars)}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  // Render team chips for a player
  const renderPlayerTeamChips = (playerId: string) => {
    const pairTeams = getTeamsForPlayer(playerId);
    if (pairTeams.length === 0) return null;
    return (
      <div className="mt-2 space-y-2 px-1">
        {pairTeams.map(({ pair, pairLabel, teams }) => (
          <div key={pair.id}>
            <p className="text-[10px] text-muted-foreground mb-1">{pairLabel}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {teams.map(({ club, count, usedCount }) => {
                const fullyUsed = isCompleted ? false : usedCount >= count;
                return (
                  <div
                    key={club.id}
                    className={`flex items-center justify-between bg-gaming-surface/60 rounded-md px-2 py-1.5 border border-border/30 ${
                      !isCompleted && fullyUsed ? "opacity-40" : ""
                    }`}
                  >
                    <span className={`text-xs text-foreground truncate flex-1 ${!isCompleted && fullyUsed ? "line-through" : ""}`}>
                      {club.name}
                    </span>
                    <span className="flex items-center gap-1">
                      {count > 1 && (
                        <span className="text-[9px] text-muted-foreground font-medium">×{count}</span>
                      )}
                      <span className="text-yellow-400 text-[10px] whitespace-nowrap">
                        {renderStars(club.stars)}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ── Match result card renderer ──
  const renderMatchResult = (m: FPMatch) => {
    const cycle = Math.floor(m.roundIndex / 2) + 1;
    const block = (m.roundIndex % 2) + 1;
    const matchInBlock = m.matchIndex + 1;
    const mine = isMyMatch(m);
    return (
      <div
        key={m.id}
        className={`rounded-lg px-2.5 py-2 border ${
          mine ? 'bg-neon-green/5 border-neon-green/30' : 'bg-gaming-surface/40 border-border/30'
        }`}
      >
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] text-muted-foreground">
            #{m.globalIndex + 1} / {totalMatches} · מחזור {cycle} · בלוק {block} משחק {matchInBlock}
          </p>
          {mine && (
            <span className="text-[9px] text-neon-green font-medium">המשחק שלך</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-1 text-xs" dir="ltr">
          <div className="flex-1 text-left">
            <p className={`font-medium leading-tight ${playerInFPPair(selectedPlayerId, m.pairA) ? 'text-neon-green' : 'text-foreground'}`}>
              {pairName(m.pairA)}
            </p>
            {m.clubA && (
              <p className="text-muted-foreground text-[10px] leading-tight">{m.clubA.name}</p>
            )}
          </div>
          {m.completed ? (
            <span className="font-bold text-neon-green font-mono px-1.5 text-sm shrink-0">
              {m.scoreA}–{m.scoreB}
            </span>
          ) : (
            <span className="text-muted-foreground font-mono px-1.5 text-sm shrink-0">vs</span>
          )}
          <div className="flex-1 text-right">
            <p className={`font-medium leading-tight ${playerInFPPair(selectedPlayerId, m.pairB) ? 'text-neon-green' : 'text-foreground'}`}>
              {pairName(m.pairB)}
            </p>
            {m.clubB && (
              <p className="text-muted-foreground text-[10px] leading-tight">{m.clubB.name}</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Upcoming match renderer ──
  const renderUpcomingMatch = (m: FPMatch) => (
    <div
      key={m.id}
      className={`flex items-center justify-between bg-gaming-surface/40 rounded-lg px-2.5 py-1.5 border text-xs ${
        isMyMatch(m) ? 'border-neon-green/30 bg-neon-green/5' : 'border-border/30'
      }`}
    >
      <div className="flex-1">
        <span className={`font-medium ${playerInFPPair(selectedPlayerId, m.pairA) ? 'text-neon-green' : 'text-foreground'}`}>
          {pairName(m.pairA)}
        </span>
        <span className="text-muted-foreground mx-1">vs</span>
        <span className={`font-medium ${playerInFPPair(selectedPlayerId, m.pairB) ? 'text-neon-green' : 'text-foreground'}`}>
          {pairName(m.pairB)}
        </span>
      </div>
      <span className="text-muted-foreground text-[10px] mr-2">
        {m.sittingOut.id === selectedPlayerId ? '🪑 אתה' : `🪑 ${m.sittingOut.name}`}
      </span>
    </div>
  );

  // ── Standings tables (reusable) ──
  const renderStandings = () => (
    <Tabs defaultValue="players">
      <TabsList className="w-full grid grid-cols-2">
        <TabsTrigger value="pairs">
          <Trophy className="h-3.5 w-3.5 ml-1" />
          זוגות
        </TabsTrigger>
        <TabsTrigger value="players">
          <Users className="h-3.5 w-3.5 ml-1" />
          שחקנים
        </TabsTrigger>
      </TabsList>

      <TabsContent value="pairs">
        <Card className="bg-gradient-card border-neon-green/20 p-3 shadow-card overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right text-xs">זוג</TableHead>
                <TableHead className="text-center text-xs">מש׳</TableHead>
                <TableHead className="text-center text-xs">נ</TableHead>
                <TableHead className="text-center text-xs">ת</TableHead>
                <TableHead className="text-center text-xs">ה</TableHead>
                <TableHead className="text-center text-xs">הפ</TableHead>
                <TableHead className="text-center text-xs font-bold">נק׳</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pairStats.map((s) => {
                const isMyPair = playerInFPPair(selectedPlayerId, s.pair);
                const isExpanded = expandedPairId === s.pair.id;
                return (
                  <React.Fragment key={s.pair.id}>
                    <TableRow
                      className={`cursor-pointer ${isMyPair ? 'bg-neon-green/10' : ''} ${isExpanded ? 'border-b-0' : ''}`}
                      onClick={() => setExpandedPairId(isExpanded ? null : s.pair.id)}
                    >
                      <TableCell className="text-xs font-medium whitespace-nowrap">
                        {pairName(s.pair)}
                        {isMyPair && <span className="text-neon-green text-[9px] mr-1">●</span>}
                        <ChevronDown className={`inline h-3 w-3 mr-1 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </TableCell>
                      <TableCell className="text-center text-xs">{s.played}</TableCell>
                      <TableCell className="text-center text-xs">{s.wins}</TableCell>
                      <TableCell className="text-center text-xs">{s.draws}</TableCell>
                      <TableCell className="text-center text-xs">{s.losses}</TableCell>
                      <TableCell className="text-center text-xs">{s.goalDiff > 0 ? "+" : ""}{s.goalDiff}</TableCell>
                      <TableCell className="text-center text-xs font-bold text-neon-green">{s.points}</TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow className={isMyPair ? 'bg-neon-green/5' : 'bg-gaming-surface/30'}>
                        <TableCell colSpan={7} className="p-2">
                          {renderTeamChips(s.pair.id)}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </TabsContent>

      <TabsContent value="players">
        <Card className="bg-gradient-card border-neon-green/20 p-3 shadow-card overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right text-xs">שחקן</TableHead>
                <TableHead className="text-center text-xs">מש׳</TableHead>
                <TableHead className="text-center text-xs">נ</TableHead>
                <TableHead className="text-center text-xs">ת</TableHead>
                <TableHead className="text-center text-xs">ה</TableHead>
                <TableHead className="text-center text-xs">הפ</TableHead>
                <TableHead className="text-center text-xs font-bold">נק׳</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {playerStats.map((s) => {
                const isMe = s.player.id === selectedPlayerId;
                const isExpanded = expandedPlayerId === s.player.id;
                return (
                  <React.Fragment key={s.player.id}>
                    <TableRow
                      className={`cursor-pointer ${isMe ? 'bg-neon-green/10' : ''} ${isExpanded ? 'border-b-0' : ''}`}
                      onClick={() => setExpandedPlayerId(isExpanded ? null : s.player.id)}
                    >
                      <TableCell className="text-xs font-medium">
                        {s.player.name}
                        <ChevronDown className={`inline h-3 w-3 mr-1 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </TableCell>
                      <TableCell className="text-center text-xs">{s.played}</TableCell>
                      <TableCell className="text-center text-xs">{s.wins}</TableCell>
                      <TableCell className="text-center text-xs">{s.draws}</TableCell>
                      <TableCell className="text-center text-xs">{s.losses}</TableCell>
                      <TableCell className="text-center text-xs">{s.goalDiff > 0 ? "+" : ""}{s.goalDiff}</TableCell>
                      <TableCell className={`text-center text-xs font-bold ${isMe ? 'text-neon-green' : 'text-neon-green'}`}>{s.points}</TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow className={isMe ? 'bg-neon-green/5' : 'bg-gaming-surface/30'}>
                        <TableCell colSpan={7} className="p-2">
                          {renderPlayerTeamChips(s.player.id)}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </TabsContent>
    </Tabs>
  );

  // ── Current match section (active only) ──
  const renderCurrentMatch = () => {
    if (!currentMatch || evening.completed) return null;
    const isPlaying = playerInMatch(selectedPlayerId, currentMatch);
    const inA = playerInFPPair(selectedPlayerId, currentMatch.pairA);
    const myClub = isPlaying ? (inA ? currentMatch.clubA : currentMatch.clubB) : undefined;

    const nextMatch = !isPlaying
      ? evening.schedule.find((m, i) => !m.completed && i !== evening.currentMatchIndex && playerInMatch(selectedPlayerId, m))
      : undefined;
    const nextInA = nextMatch ? playerInFPPair(selectedPlayerId, nextMatch.pairA) : false;
    const nextClub = nextMatch ? (nextInA ? nextMatch.clubA : nextMatch.clubB) : undefined;

    return (
      <Card className={`bg-gradient-card p-4 shadow-card ${isMyMatch(currentMatch) ? 'border-neon-green/50 ring-1 ring-neon-green/20' : 'border-neon-green/30'}`}>
        <p className="text-[10px] text-muted-foreground text-center mb-1">
          משחק נוכחי • סיבוב {currentMatch.roundIndex + 1} • משחק {currentMatch.matchIndex + 1}
        </p>
        <div className="text-center space-y-1">
          <p className={`text-lg font-bold ${playerInFPPair(selectedPlayerId, currentMatch.pairA) ? 'text-neon-green' : 'text-foreground'}`}>
            {pairName(currentMatch.pairA)}
          </p>
          <p className="text-xs text-muted-foreground">vs</p>
          <p className={`text-lg font-bold ${playerInFPPair(selectedPlayerId, currentMatch.pairB) ? 'text-neon-green' : 'text-foreground'}`}>
            {pairName(currentMatch.pairB)}
          </p>
        </div>

        {(currentMatch.clubA || currentMatch.clubB) && (
          <div className="flex items-center justify-center gap-3 mt-2 text-xs">
            {currentMatch.clubA && (
              <Badge variant="outline" className="border-border/50 text-foreground">{currentMatch.clubA.name}</Badge>
            )}
            {currentMatch.clubA && currentMatch.clubB && <span className="text-muted-foreground">vs</span>}
            {currentMatch.clubB && (
              <Badge variant="outline" className="border-border/50 text-foreground">{currentMatch.clubB.name}</Badge>
            )}
          </div>
        )}

        {currentMatch.scoreA !== undefined && currentMatch.scoreB !== undefined && currentMatch.completed && (
          <div className="text-center mt-2">
            <span className="text-2xl font-bold text-neon-green">{currentMatch.scoreA} - {currentMatch.scoreB}</span>
          </div>
        )}

        <div className="text-center mt-2">
          <Badge
            variant="outline"
            className={`text-[10px] ${currentMatch.sittingOut.id === selectedPlayerId ? 'border-neon-green/30 text-neon-green' : 'border-muted-foreground/30 text-muted-foreground'}`}
          >
            🪑 יושב בחוץ: {currentMatch.sittingOut.name}
          </Badge>
        </div>

        <div className="flex justify-center mt-3">
          {isPlaying && myClub && (
            <TeamSetupButton club={myClub} matchLabel="משחק נוכחי" tournamentId={evening.id} />
          )}
          {!isPlaying && nextClub && (
            <TeamSetupButton club={nextClub} matchLabel="המשחק הבא" tournamentId={evening.id} />
          )}
        </div>
      </Card>
    );
  };

  // ── Final results card (completed only) ──
  const renderFinalResults = () => {
    if (!evening.completed) return null;
    const top5 = playerStats.slice(0, 5);
    const tierIndices = computeTierIndices(top5.map(s => s.points));
    return (
      <Card className="bg-gradient-card border-yellow-400/30 p-4 shadow-card space-y-3">
        <div className="text-center">
          <Trophy className="h-8 w-8 text-yellow-400 mx-auto mb-1" />
          <h2 className="text-lg font-bold text-foreground">תוצאות סופיות</h2>
          <p className="text-[11px] text-muted-foreground">דירוג שחקנים סופי</p>
        </div>
        <div className="space-y-2">
          {top5.map((s, idx) => {
            const ti = tierIndices[idx];
            const isMe = s.player.id === selectedPlayerId;
            return (
              <div
                key={s.player.id}
                className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 bg-gradient-to-l border ${TIER_COLORS[ti]} ${ti === 0 ? 'ring-1' : ''} ${isMe ? 'ring-1 ring-neon-green/40' : ''}`}
              >
                <span className="text-lg">{TIER_EMOJIS[ti]}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold tracking-wider ${TIER_TEXT[ti]}`}>{TIER_LABELS[ti]}</span>
                    {isMe && <span className="text-[9px] text-neon-green">●</span>}
                  </div>
                  <p className={`text-sm font-bold leading-tight ${isMe ? 'text-neon-green' : 'text-foreground'}`}>{s.player.name}</p>
                </div>
                <div className="text-left shrink-0">
                  <p className={`text-sm font-bold ${TIER_TEXT[ti]}`}>{s.points} <span className="text-[10px] font-normal text-muted-foreground">נק׳</span></p>
                  <p className="text-[10px] text-muted-foreground">{s.wins}נ {s.draws}ת {s.losses}ה</p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    );
  };

  return (
    <div
      className="min-h-[100svh] bg-gaming-bg p-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
      dir="rtl"
    >
      <div className="max-w-md mx-auto space-y-3">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-muted-foreground">
            <ArrowLeft className="h-4 w-4 ml-1 rotate-180" />
            חזרה
          </Button>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={onSwitchPlayer} className="text-muted-foreground">
              <Users className="h-4 w-4 ml-1" />
              החלף שחקן
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-muted-foreground">
              <Home className="h-4 w-4 ml-1" />
              בית
            </Button>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-neon-green" />
            <div>
              <h1 className="text-base font-bold text-foreground">ליגת 5 שחקנים</h1>
              <p className="text-xs text-muted-foreground">
                {evening.players.map((p) => p.name).join(", ")}
              </p>
            </div>
          </div>
          {isCompleted ? (
            <Badge className="bg-yellow-400/20 text-yellow-300 border-yellow-400/30 text-xs">
              <Trophy className="h-3 w-3 ml-1" />
              תוצאות סופיות
            </Badge>
          ) : (
            <Badge className="bg-neon-green/20 text-neon-green border-neon-green/30 text-xs">
              <Eye className="h-3 w-3 ml-1" />
              צפייה בלבד
            </Badge>
          )}
        </div>

        {isCompleted ? (
          <>
            {/* ═══ COMPLETED TOURNAMENT LAYOUT ═══ */}

            {/* 1. Timing */}
            <FPTimingCard evening={evening} allHistory={fpHistory} showProgress />

            {/* 2. Final Results (Alpha/Beta/etc) */}
            {renderFinalResults()}

            {/* 3. Personal Summary Card */}
            {personal && (
              <PersonalSummaryCard personal={personal} onSwitchPlayer={onSwitchPlayer} isCompleted={isCompleted} />
            )}

            {/* 4. Tournament Tables (Players / Pairs) */}
            {renderStandings()}

            {/* 5. Match Results */}
            {completedCount > 0 && (
              <div>
                <Button
                  variant="outline"
                  className="w-full border-border/50 text-muted-foreground"
                  onClick={() => setShowRecent(!showRecent)}
                >
                  {showRecent ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
                  תוצאות המשחקים ({completedCount})
                </Button>
                {showRecent && (
                  <Card className="bg-gradient-card border-border/40 p-3 shadow-card mt-2">
                    <div className="space-y-2">
                      {evening.schedule
                        .filter((m) => m.completed)
                        .reverse()
                        .map(renderMatchResult)}
                    </div>
                  </Card>
                )}
              </div>
            )}

            {/* 6. All-Time Stats */}
            {allTimeStats && allTimeStats.eveningsPlayed > 0 && (
              <AllTimeStatsCard stats={allTimeStats} />
            )}

            {/* 7. Insights */}
            {insights.length > 0 && (
              <InsightCards insights={insights} />
            )}

            {/* 8. All-Time Leaderboard */}
            {allPlayersAllTime.size > 0 && (
              <AllTimeLeaderboard allPlayersStats={allPlayersAllTime} selectedPlayerId={selectedPlayerId} />
            )}
          </>
        ) : (
          <>
            {/* ═══ ACTIVE TOURNAMENT LAYOUT ═══ */}

            {/* 1. Timing */}
            <FPTimingCard evening={evening} allHistory={fpHistory} showProgress />

            {/* 2. Current Match */}
            {renderCurrentMatch()}

            {/* 3. Live Summary (Personal Card) */}
            {personal && (
              <PersonalSummaryCard personal={personal} onSwitchPlayer={onSwitchPlayer} isCompleted={false} />
            )}

            {/* 4. Personal Insights */}
            {personal && <PersonalInsights personal={personal} />}

            {/* 5. Tournament Tables (Players / Pairs) */}
            {renderStandings()}

            {/* 6. Unified Matches Section (completed + upcoming) */}
            {(() => {
              const completedMatches = evening.schedule.filter((m) => m.completed);
              const upcoming = evening.schedule.filter((m, i) => !m.completed && i !== evening.currentMatchIndex);
              const totalInSection = completedMatches.length + upcoming.length;
              if (totalInSection === 0) return null;
              return (
                <div>
                  <Button
                    variant="outline"
                    className="w-full border-border/50 text-muted-foreground"
                    onClick={() => setShowMatches(!showMatches)}
                  >
                    {showMatches ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
                    משחקי הטורניר ({completedMatches.length}/{totalMatches})
                  </Button>
                  {showMatches && (
                    <Card className="bg-gradient-card border-border/40 p-3 shadow-card mt-2">
                      <div className="space-y-2">
                        {completedMatches.length > 0 && (
                          <>
                            <p className="text-[10px] text-muted-foreground font-medium">תוצאות ({completedMatches.length})</p>
                            {[...completedMatches].reverse().map(renderMatchResult)}
                          </>
                        )}
                        {upcoming.length > 0 && (
                          <>
                            <p className="text-[10px] text-muted-foreground font-medium mt-3">משחקים הבאים ({upcoming.length})</p>
                            <div className="space-y-1.5">
                              {upcoming.map(renderUpcomingMatch)}
                            </div>
                          </>
                        )}
                      </div>
                    </Card>
                  )}
                </div>
              );
            })()}

            {/* 7. Insights */}
            {insights.length > 0 && (
              <InsightCards insights={insights} />
            )}

            {/* 8. All-Time Leaderboard */}
            {allPlayersAllTime.size > 0 && (
              <AllTimeLeaderboard allPlayersStats={allPlayersAllTime} selectedPlayerId={selectedPlayerId} />
            )}
          </>
        )}
      </div>
    </div>
  );
}