import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Trophy, Users, Eye, ChevronDown, ChevronUp, ArrowLeft, Home } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Evening, Pair, Round } from "@/types/tournament";
import { StarRating, starText } from "@/components/StarRating";
import {
  computeCouplesPersonalStats,
  computeCouplesPlayerStandings,
  computeCouplesPairStandings,
  couplesPlayerInPair,
} from "@/services/spectatorCouplesStats";
import CouplesPersonalCard from "./CouplesPersonalCard";
import CouplesInsights from "./CouplesInsights";

interface Props {
  evening: Evening;
  selectedPlayerId: string;
  onSwitchPlayer: () => void;
  isCompleted: boolean;
  onBack?: () => void;
  onHome?: () => void;
}

export default function CouplesSpectateView({
  evening,
  selectedPlayerId,
  onSwitchPlayer,
  isCompleted,
  onBack,
  onHome,
}: Props) {
  const [showRecent, setShowRecent] = useState(false);
  const [teamsDrawerOpen, setTeamsDrawerOpen] = useState(false);

  const personal = useMemo(() => computeCouplesPersonalStats(evening, selectedPlayerId), [evening, selectedPlayerId]);
  const playerStandings = useMemo(() => computeCouplesPlayerStandings(evening), [evening]);
  const pairStandings = useMemo(() => computeCouplesPairStandings(evening), [evening]);

  const pairName = (pair: Pair) => `${pair.players[0].name} & ${pair.players[1].name}`;
  const tournamentTitle = evening.type === "singles" ? "טורניר יחידים" : "טורניר זוגות";
  const totalRounds = (evening.rounds || []).length;
  const completedRounds = (evening.rounds || []).filter(r => r.completed).length;
  const totalMatches = (evening.rounds || []).reduce((sum, r) => sum + r.matches.length, 0);
  const completedMatches = (evening.rounds || []).reduce((sum, r) => sum + r.matches.filter(m => m.completed).length, 0);

  const renderStars = (stars: number) => <StarRating stars={stars} size="xs" />;
  const renderStarsText = (stars: number) => starText(stars);

  // Collect all completed matches for results
  const allResults: { match: typeof evening.rounds[0]['matches'][0]; round: Round; matchIndex: number }[] = [];
  (evening.rounds || []).forEach(round => {
    round.matches.forEach((match, mi) => {
      if (match.completed) allResults.push({ match, round, matchIndex: mi });
    });
  });

  // Collect all teams used
  const allTeamPools: { pairName: string; isMyPair: boolean; clubs: { name: string; stars: number; used: boolean }[] }[] = [];
  (evening.rounds || []).forEach(round => {
    if (round.teamPools && round.matches.length > 0) {
      const [pair1, pair2] = [round.matches[0].pairs[0], round.matches[0].pairs[1]];
      [0, 1].forEach(idx => {
        const pair = idx === 0 ? pair1 : pair2;
        const pool = round.teamPools![idx];
        const usedIds = new Set(
          round.matches.filter(m => m.completed).map(m => m.clubs[idx]?.id).filter(Boolean)
        );
        allTeamPools.push({
          pairName: pairName(pair),
          isMyPair: couplesPlayerInPair(selectedPlayerId, pair),
          clubs: pool.map(c => ({ name: c.name, stars: c.stars, used: usedIds.has(c.id) })),
        });
      });
    }
  });

  return (
    <div className="min-h-[100svh] bg-gaming-bg p-3 pb-[max(1rem,env(safe-area-inset-bottom))]" dir="rtl">
      <div className="max-w-md mx-auto space-y-3">
        {/* Header */}
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-1 text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4 rotate-180" />
          חזרה
        </Button>
    
        <Button
          variant="ghost"
          size="sm"
          onClick={onHome}
          className="gap-1 text-muted-foreground"
        >
          <Home className="h-4 w-4" />
          בית
        </Button>
      </div>
    
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Eye className="h-5 w-5 text-neon-green shrink-0" />
          <div className="min-w-0">
            <h1 className="text-base font-bold text-foreground">{tournamentTitle}</h1>
            <p className="text-xs text-muted-foreground truncate">
              {evening.players.map((p) => p.name).join(", ")}
            </p>
          </div>
        </div>
    
        {isCompleted ? (
          <Badge className="bg-yellow-400/20 text-yellow-300 border-yellow-400/30 text-xs shrink-0">
            <Trophy className="h-3 w-3 ml-1" />
            תוצאות סופיות
          </Badge>
        ) : (
          <Badge className="bg-neon-green/20 text-neon-green border-neon-green/30 text-xs shrink-0">
            <Eye className="h-3 w-3 ml-1" />
            צפייה בלבד
          </Badge>
        )}
      </div>

  <Button
    variant="outline"
    size="sm"
    onClick={onSwitchPlayer}
    className="w-full border-border/50 text-muted-foreground"
  >
    החלף שחקן
  </Button>
</div>

        {/* Personal Card */}
        {personal && (
          <CouplesPersonalCard personal={personal} onSwitchPlayer={onSwitchPlayer} isCompleted={isCompleted} />
        )}

        {/* Personal Insights */}
        {personal && <CouplesInsights personal={personal} />}

        {/* Progress */}
        <Card className="bg-gaming-surface/50 border-border/50 p-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {isCompleted ? "הטורניר הסתיים!" : `סיבוב ${completedRounds + 1} מתוך ${evening.pairSchedule?.length || totalRounds}`}
            </span>
            <span>{completedMatches} משחקים הושלמו</span>
          </div>
          {(evening.pairSchedule?.length || totalRounds) > 0 && (
            <div className="w-full bg-gaming-surface rounded-full h-1.5 mt-1.5">
              <div
                className="bg-neon-green rounded-full h-1.5 transition-all duration-500"
                style={{ width: `${(completedRounds / (evening.pairSchedule?.length || totalRounds)) * 100}%` }}
              />
            </div>
          )}
        </Card>

        {/* Standings */}
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

          <TabsContent value="players">
            <Card className="bg-gradient-card border-neon-green/20 p-3 shadow-card overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right text-xs">שחקן</TableHead>
                    <TableHead className="text-center text-xs">מש׳</TableHead>
                    <TableHead className="text-center text-xs">נ</TableHead>
                    <TableHead className="text-center text-xs">ה</TableHead>
                    <TableHead className="text-center text-xs">הפ</TableHead>
                    <TableHead className="text-center text-xs font-bold">נק׳</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {playerStandings.map(s => {
                    const isMe = s.player.id === selectedPlayerId;
                    return (
                      <TableRow key={s.player.id} className={isMe ? 'bg-neon-green/10' : ''}>
                        <TableCell className="text-xs font-medium">{s.player.name}</TableCell>
                        <TableCell className="text-center text-xs">{s.matchesPlayed}</TableCell>
                        <TableCell className="text-center text-xs">{s.matchWins}</TableCell>
                        <TableCell className="text-center text-xs">{s.matchLosses}</TableCell>
                        <TableCell className="text-center text-xs">{s.goalDiff > 0 ? '+' : ''}{s.goalDiff}</TableCell>
                        <TableCell className="text-center text-xs font-bold text-neon-green">{s.points}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="pairs">
            <Card className="bg-gradient-card border-neon-green/20 p-3 shadow-card overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right text-xs">זוג</TableHead>
                    <TableHead className="text-center text-xs">סיב׳</TableHead>
                    <TableHead className="text-center text-xs">מש׳</TableHead>
                    <TableHead className="text-center text-xs">נ</TableHead>
                    <TableHead className="text-center text-xs">ה</TableHead>
                    <TableHead className="text-center text-xs">הפ</TableHead>
                    <TableHead className="text-center text-xs font-bold">נק׳</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pairStandings.map(s => {
                    const isMyPair = couplesPlayerInPair(selectedPlayerId, s.pair);
                    return (
                      <TableRow key={s.pair.id} className={isMyPair ? 'bg-neon-green/10' : ''}>
                        <TableCell className="text-xs font-medium whitespace-nowrap">
                          {pairName(s.pair)}
                          {isMyPair && <span className="text-neon-green text-[9px] mr-1">●</span>}
                        </TableCell>
                        <TableCell className="text-center text-xs">{s.roundWins}</TableCell>
                        <TableCell className="text-center text-xs">{s.matchesPlayed}</TableCell>
                        <TableCell className="text-center text-xs">{s.matchWins}</TableCell>
                        <TableCell className="text-center text-xs">{s.matchLosses}</TableCell>
                        <TableCell className="text-center text-xs">{s.goalDiff > 0 ? '+' : ''}{s.goalDiff}</TableCell>
                        <TableCell className="text-center text-xs font-bold text-neon-green">{s.points}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Results */}
        {allResults.length > 0 && (
          <div>
            <Button
              variant="outline"
              className="w-full border-border/50 text-muted-foreground"
              onClick={() => setShowRecent(!showRecent)}
            >
              {showRecent ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
              כל התוצאות ({allResults.length})
            </Button>
            {showRecent && (
              <Card className="bg-gradient-card border-border/40 p-3 shadow-card mt-2">
                <div className="space-y-2">
                  {[...allResults].reverse().map(({ match, round, matchIndex }) => {
                    const [pair1, pair2] = match.pairs;
                    const mine = couplesPlayerInPair(selectedPlayerId, pair1) || couplesPlayerInPair(selectedPlayerId, pair2);
                    return (
                      <div
                        key={match.id}
                        className={`rounded-lg px-2.5 py-2 border ${
                          mine ? 'bg-neon-green/5 border-neon-green/30' : 'bg-gaming-surface/40 border-border/30'
                        }`}
                      >
                        <p className="text-[10px] text-muted-foreground mb-1">
                          סיבוב {round.number} · משחק {matchIndex + 1}
                          {mine && <span className="text-neon-green mr-2 font-medium">המשחק שלך</span>}
                        </p>
                        <div className="flex items-center justify-between gap-1 text-xs" dir="ltr">
                          <div className="flex-1 text-left">
                            <p className={`font-medium leading-tight ${couplesPlayerInPair(selectedPlayerId, pair1) ? 'text-neon-green' : 'text-foreground'}`}>
                              {pairName(pair1)}
                            </p>
                            {match.clubs[0]?.name && (
                              <p className="text-muted-foreground text-[10px] leading-tight">{match.clubs[0].name}</p>
                            )}
                          </div>
                          <span className="font-bold text-neon-green font-mono px-1.5 text-sm shrink-0">
                            {match.score?.[0]}–{match.score?.[1]}
                          </span>
                          <div className="flex-1 text-right">
                            <p className={`font-medium leading-tight ${couplesPlayerInPair(selectedPlayerId, pair2) ? 'text-neon-green' : 'text-foreground'}`}>
                              {pairName(pair2)}
                            </p>
                            {match.clubs[1]?.name && (
                              <p className="text-muted-foreground text-[10px] leading-tight">{match.clubs[1].name}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* All Teams button */}
        {allTeamPools.length > 0 && (
          <Button
            variant="outline"
            className="w-full border-border/50 text-muted-foreground"
            onClick={() => setTeamsDrawerOpen(true)}
          >
            <Users className="h-4 w-4 ml-1" />
            כל הקבוצות
          </Button>
        )}
      </div>

      {/* Teams Drawer */}
      <Drawer open={teamsDrawerOpen} onOpenChange={setTeamsDrawerOpen}>
        <DrawerContent className="max-h-[85vh]" dir="rtl">
          <DrawerHeader>
            <DrawerTitle className="text-foreground text-right">כל הקבוצות</DrawerTitle>
            <DrawerDescription className="text-right">קבוצות שהוגרלו לכל סיבוב</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6 space-y-3 overflow-auto max-h-[65vh]">
            {allTeamPools.map((pool, i) => (
              <Card
                key={i}
                className={`bg-gradient-card p-3 shadow-card ${pool.isMyPair ? 'border-neon-green/40' : 'border-border/40'}`}
              >
                <p className={`text-sm font-semibold mb-2 ${pool.isMyPair ? 'text-neon-green' : 'text-foreground'}`}>
                  {pool.pairName}
                  {pool.isMyPair && <span className="text-[10px] text-neon-green/70 mr-1">●</span>}
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {pool.clubs.map((club, ci) => (
                    <div
                      key={ci}
                      className={`flex items-center justify-between bg-gaming-surface/60 rounded-md px-2 py-1.5 border border-border/30 ${
                        club.used ? "opacity-40" : ""
                      }`}
                    >
                      <span className={`text-xs text-foreground truncate flex-1 ${club.used ? "line-through" : ""}`}>
                        {club.name}
                      </span>
                      <span className="text-yellow-400 text-[10px] whitespace-nowrap mr-1">
                        {renderStars(club.stars)}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
