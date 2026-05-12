import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StarRating } from "@/components/StarRating";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ArrowLeft, 
  Clock, 
  Trophy, 
  Users, 
  Play, 
  Pause, 
  RotateCcw,
  Crown,
  Home,
  Star,
  History,
  StopCircle
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Evening, SinglesGame, PlayerStats, Club } from "@/types/tournament";
import { DiceScoreInput } from "@/components/DiceScoreInput";
import { TournamentEngine } from "@/services/tournamentEngine";
import { useToast } from "@/hooks/use-toast";

interface SinglesGameLiveProps {
  clubsWithOverrides: Club[];
  evening: Evening;
  onBack: () => void;
  onComplete: (evening: Evening) => void;
  onGoHome: () => void;
  onUpdateEvening: (evening: Evening) => void;
  canStopTournament?: boolean;
  onStopTournament?: () => void;
}

export const SinglesGameLive = ({ evening, onBack, onComplete, onGoHome, onUpdateEvening, clubsWithOverrides, canStopTournament, onStopTournament }: SinglesGameLiveProps) => {
  const { toast } = useToast();
  const [currentEvening, setCurrentEvening] = useState(evening);
  const [currentGame, setCurrentGame] = useState<SinglesGame | null>(null);
  const [gamePhase, setGamePhase] = useState<'club-selection' | 'countdown' | 'result-entry'>('club-selection');
  const [countdown, setCountdown] = useState(60);
  const [isCountdownActive, setIsCountdownActive] = useState(false);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [selectedClubs, setSelectedClubs] = useState<[Club | null, Club | null]>([null, null]);
  const [showGamesHistory, setShowGamesHistory] = useState(false);

  // Helper function to get current star rating from database overrides
  const getDisplayStars = (club: Club): number => {
    const override = clubsWithOverrides.find(c => c.id === club.id);
    return override?.stars ?? club.stars;
  };

  useEffect(() => {
    setCurrentEvening(evening);
    updatePlayerStats(evening);
    
    // Auto-select next playable game if available
    if (evening.gameSequence && evening.currentGameIndex !== undefined) {
      const nextPlayableIndex = findNextPlayableGameIndex(evening);
      if (nextPlayableIndex >= 0) {
        const nextGame = evening.gameSequence[nextPlayableIndex];
        setCurrentGame(nextGame);
        setGamePhase('club-selection');
        setSelectedClubs([null, null]); // Always start with no clubs selected
      } else if (TournamentEngine.isSinglesComplete(evening)) {
        setCurrentGame(null);
        setShowCompletionDialog(true);
      }
    }
  }, [evening]);

  const updatePlayerStats = (evening: Evening) => {
    const stats = TournamentEngine.getSinglesStats(evening);
    setPlayerStats(stats);
  };

  // Helper: available clubs for a player within a given evening state
  const getAvailableClubsInEvening = (ev: Evening, playerId: string): Club[] => {
    if (!ev.playerClubs || !ev.gameSequence) return [];
    const allClubs = ev.playerClubs[playerId] || [];
    const used = new Set<string>();
    ev.gameSequence.forEach((game) => {
      if (!game.completed) return;
      const idx = game.players.findIndex((p) => p.id === playerId);
      if (idx !== -1) {
        const club = game.clubs[idx];
        if (club && club.id) used.add(club.id);
      }
    });
    return allClubs.filter((c) => !used.has(c.id));
  };

  // Helper: find next game that both players can actually play (both have remaining clubs)
  const findNextPlayableGameIndex = (ev: Evening): number => {
    if (!ev.gameSequence) return -1;
    for (let i = 0; i < ev.gameSequence.length; i++) {
      const g = ev.gameSequence[i];
      if (g.completed) continue;
      const aHas = getAvailableClubsInEvening(ev, g.players[0].id).length > 0;
      const bHas = getAvailableClubsInEvening(ev, g.players[1].id).length > 0;
      if (aHas && bHas) return i;
    }
    return -1;
  };

  const getAvailableClubs = (playerId: string): Club[] => {
    if (!currentEvening.playerClubs || !currentEvening.gameSequence) return [];
    
    // Get all clubs for this player
    const allClubs = currentEvening.playerClubs[playerId] || [];
    
    // Find which clubs have been used in completed games
    const usedClubs = new Set<string>();
    currentEvening.gameSequence.forEach(game => {
      if (game.completed) {
        const playerIndex = game.players.findIndex(p => p.id === playerId);
        if (playerIndex !== -1 && game.clubs[playerIndex] && game.clubs[playerIndex].id) {
          usedClubs.add(game.clubs[playerIndex].id);
        }
      }
    });
    
    // Return clubs not yet used
    return allClubs.filter(club => !usedClubs.has(club.id));
  };

  const canStartGame = () => {
    return selectedClubs[0] && selectedClubs[1];
  };

  const startGameWithSelectedClubs = () => {
    if (!currentGame || !selectedClubs[0] || !selectedClubs[1]) return;
    
    // Update the current game with selected clubs
    const updatedGame = {
      ...currentGame,
      clubs: [selectedClubs[0], selectedClubs[1]] as [Club, Club]
    };
    setCurrentGame(updatedGame);
    
    setGamePhase('countdown');
    setCountdown(60);
    setIsCountdownActive(true);
  };

  const pauseCountdown = () => {
    setIsCountdownActive(false);
  };

  const resumeCountdown = () => {
    setIsCountdownActive(true);
  };

  const resetCountdown = () => {
    setCountdown(60);
    setIsCountdownActive(false);
  };

  const proceedToScoring = () => {
    setIsCountdownActive(false);
    setGamePhase('result-entry');
  };

  const handleGameComplete = (score1: number, score2: number) => {
    if (!currentGame) return;

    const winner = score1 > score2 ? currentGame.players[0].id : currentGame.players[1].id;
    
    const updatedGame: SinglesGame = {
      ...currentGame,
      score: [score1, score2],
      winner,
      completed: true
    };

    const updatedEvening = { ...currentEvening };
    if (updatedEvening.gameSequence) {
      const gameIndex = updatedEvening.gameSequence.findIndex(g => g.id === currentGame.id);
      if (gameIndex !== -1) {
        updatedEvening.gameSequence[gameIndex] = updatedGame;
        
        // Move to next playable game
        const nextPlayableIndex = findNextPlayableGameIndex(updatedEvening);
        updatedEvening.currentGameIndex = nextPlayableIndex >= 0 ? nextPlayableIndex : updatedEvening.gameSequence.length;
      }
    }

    setCurrentEvening(updatedEvening);
    updatePlayerStats(updatedEvening);
    onUpdateEvening(updatedEvening);

    toast({
      title: "משחק הושלם!",
      description: `${currentGame.players.find(p => p.id === winner)?.name} ניצח ${score1}-${score2}`,
    });

    // Check if tournament is complete
    if (TournamentEngine.isSinglesComplete(updatedEvening)) {
      updatedEvening.completed = true;
      setShowCompletionDialog(true);
    } else {
      // Move to next playable game
      const nextGame = updatedEvening.gameSequence?.[updatedEvening.currentGameIndex || 0];
      if (nextGame) {
        setCurrentGame(nextGame);
        setGamePhase('club-selection');
        setSelectedClubs([null, null]); // Reset for next game
      } else {
        // No playable games left
        setCurrentGame(null);
        setShowCompletionDialog(true);
      }
    }
  };

  const getGameProgress = () => {
    if (!currentEvening.gameSequence) return 0;
    // Progress based on how many clubs have been used out of all assigned clubs
    const totalAssigned = Object.values(currentEvening.playerClubs || {}).reduce((sum, clubs) => sum + clubs.length, 0);
    if (totalAssigned === 0) return 0;
    const usedTotal = currentEvening.players.reduce((acc, p) => {
      const assigned = currentEvening.playerClubs?.[p.id]?.length || 0;
      const available = getAvailableClubs(p.id).length;
      return acc + Math.min(assigned, assigned - available);
    }, 0);
    return Math.min(100, (usedTotal / totalAssigned) * 100);
  };

  const getRemainingGames = () => {
    if (!currentEvening.gameSequence) return 0;
    return currentEvening.gameSequence.filter(g => !g.completed)
      .filter(g => getAvailableClubs(g.players[0].id).length > 0 && getAvailableClubs(g.players[1].id).length > 0)
      .length;
  };

  // Countdown effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCountdownActive && countdown > 0) {
      interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            setIsCountdownActive(false);
            proceedToScoring();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isCountdownActive, countdown]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderCurrentGame = () => {
    if (!currentGame) {
      return (
        <Card className="bg-gaming-surface/50 border-border/50 p-6">
          <div className="text-center">
            <Trophy className="h-12 w-12 text-neon-green mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">הטורניר הושלם!</h3>
            <p className="text-muted-foreground">כל המשחקים הסתיימו</p>
          </div>
        </Card>
      );
    }

    return (
      <Card className="bg-gradient-card border-neon-green/20 p-6 shadow-card">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gaming-surface border-2 border-neon-green flex items-center justify-center mb-2">
                <span className="text-sm font-bold text-neon-green">
                  {currentGame.players[0].name.slice(0, 2).toUpperCase()}
                </span>
              </div>
              <h3 className="font-semibold text-foreground">{currentGame.players[0].name}</h3>
              
              {gamePhase === 'club-selection' && (
                <div className="mt-2">
                  <Select
                    value={selectedClubs[0]?.id || ""}
                    onValueChange={(value) => {
                      const availableClubs = getAvailableClubs(currentGame.players[0].id);
                      const selectedClub = availableClubs.find(c => c.id === value);
                      setSelectedClubs([selectedClub || null, selectedClubs[1]]);
                    }}
                  >
                    <SelectTrigger className="w-full bg-gaming-surface border-border">
                      <SelectValue placeholder="בחר קבוצה" />
                    </SelectTrigger>
                    <SelectContent className="bg-gaming-surface z-[60]">
                      {getAvailableClubs(currentGame.players[0].id).map(club => (
                        <SelectItem key={club.id} value={club.id}>
                          <div className="flex items-center gap-2">
                            <span>{club.name}</span>
                            <StarRating stars={getDisplayStars(club)} size="sm" neonGreen />
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {gamePhase !== 'club-selection' && selectedClubs[0] && (
                <Badge variant="outline" className="text-xs mt-2">
                  {selectedClubs[0].name}
                </Badge>
              )}
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-muted-foreground mb-2">VS</div>
              {gamePhase === 'countdown' && (
                <div className="text-3xl font-bold text-neon-green">
                  {formatTime(countdown)}
                </div>
              )}
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gaming-surface border-2 border-neon-green flex items-center justify-center mb-2">
                <span className="text-sm font-bold text-neon-green">
                  {currentGame.players[1].name.slice(0, 2).toUpperCase()}
                </span>
              </div>
              <h3 className="font-semibold text-foreground">{currentGame.players[1].name}</h3>
              
              {gamePhase === 'club-selection' && (
                <div className="mt-2">
                  <Select
                    value={selectedClubs[1]?.id || ""}
                    onValueChange={(value) => {
                      const availableClubs = getAvailableClubs(currentGame.players[1].id);
                      const selectedClub = availableClubs.find(c => c.id === value);
                      setSelectedClubs([selectedClubs[0], selectedClub || null]);
                    }}
                  >
                    <SelectTrigger className="w-full bg-gaming-surface border-border">
                      <SelectValue placeholder="בחר קבוצה" />
                    </SelectTrigger>
                    <SelectContent className="bg-gaming-surface z-[60]">
                      {getAvailableClubs(currentGame.players[1].id).map(club => (
                        <SelectItem key={club.id} value={club.id}>
                          <div className="flex items-center gap-2">
                            <span>{club.name}</span>
                            <StarRating stars={getDisplayStars(club)} size="sm" neonGreen />
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {gamePhase !== 'club-selection' && selectedClubs[1] && (
                <Badge variant="outline" className="text-xs mt-2">
                  {selectedClubs[1].name}
                </Badge>
              )}
            </div>
          </div>

          {gamePhase === 'club-selection' && (
            <Button 
              onClick={startGameWithSelectedClubs} 
              disabled={!canStartGame()}
              variant="gaming"
              size="lg"
              className="w-full"
            >
              <Play className="h-4 w-4 mr-2" />
              התחל משחק
            </Button>
          )}

          {gamePhase === 'countdown' && (
            <div className="space-y-4">
              <div className="flex justify-center gap-2">
                {!isCountdownActive ? (
                  <Button onClick={resumeCountdown} size="sm">
                    <Play className="h-4 w-4 mr-1" />
                    המשך
                  </Button>
                ) : (
                  <Button onClick={pauseCountdown} size="sm" variant="outline">
                    <Pause className="h-4 w-4 mr-1" />
                    השהה
                  </Button>
                )}
                <Button onClick={resetCountdown} size="sm" variant="outline">
                  <RotateCcw className="h-4 w-4 mr-1" />
                  איפוס
                </Button>
                <Button onClick={proceedToScoring} size="sm" variant="secondary">
                  דלג לניקוד
                </Button>
              </div>
            </div>
          )}

          {gamePhase === 'result-entry' && (
            <DiceScoreInput
              onSubmit={handleGameComplete}
            />
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gaming-bg p-4 mobile-optimized">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5 rotate-180" />
          </Button>
          
          <div className="text-center">
            <h1 className="text-xl font-bold text-foreground">טורניר יחידים</h1>
            <p className="text-xs text-muted-foreground">
              {getRemainingGames()} משחקים נשארו
            </p>
          </div>
          
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={onGoHome}>
              <Home className="h-5 w-5" />
            </Button>
            {canStopTournament && onStopTournament && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-destructive" aria-label="Stop tournament">
                    <StopCircle className="h-5 w-5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>להפסיק את הטורניר?</AlertDialogTitle>
                    <AlertDialogDescription>
                      הטורניר יסומן כמופסק וכל המשתתפים יחזרו למסך הבית.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>ביטול</AlertDialogCancel>
                    <AlertDialogAction onClick={onStopTournament} className="bg-destructive hover:bg-destructive/90">
                      הפסק טורניר
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* Progress */}
        <Card className="bg-gaming-surface/50 border-border/50 p-4 mb-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">התקדמות טורניר</span>
              <span className="text-neon-green font-medium">{Math.round(getGameProgress())}%</span>
            </div>
            <Progress value={getGameProgress()} className="h-2" />
          </div>
        </Card>

        {/* Current Game */}
        {renderCurrentGame()}

        {/* Player Stats */}
        {playerStats.length > 0 && (
          <Card className="bg-gaming-surface/50 border-border/50 p-4 mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Crown className="h-5 w-5 text-neon-green" />
                דירוג שחקנים
              </h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowGamesHistory(true)}
                className="h-8 w-8"
              >
                <History className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {playerStats.map((stat, index) => (
                <div key={stat.player.id} className="flex items-center justify-between p-2 rounded bg-gaming-surface/50">
                  <div className="flex items-center gap-3">
                    <Badge variant={index === 0 ? "default" : "outline"} className="min-w-[24px] h-6">
                      {index + 1}
                    </Badge>
                    <span className="font-medium text-foreground">{stat.player.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-neon-green">{stat.wins} ניצחונות</div>
                    <div className="text-xs text-muted-foreground">
                      {stat.goalsFor}-{stat.goalsAgainst}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Games History Dialog */}
        <Dialog open={showGamesHistory} onOpenChange={setShowGamesHistory}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                היסטוריית משחקים
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {currentEvening.gameSequence?.filter(game => game.completed).map((game, index) => (
                <Card key={game.id} className="bg-gaming-surface/30 border-border/50 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground mb-1">משחק {index + 1}</div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm">
                          <span className="font-medium">{game.players[0].name}</span>
                          <span className="text-xs text-muted-foreground block">{game.clubs[0].name}</span>
                        </div>
                        <Badge variant="outline" className="text-xs px-2">
                          {game.score?.[0]} - {game.score?.[1]}
                        </Badge>
                        <div className="text-sm">
                          <span className="font-medium">{game.players[1].name}</span>
                          <span className="text-xs text-muted-foreground block">{game.clubs[1].name}</span>
                        </div>
                      </div>
                    </div>
                    {game.winner && (
                      <Trophy className={`h-4 w-4 ml-2 ${
                        game.winner === game.players[0].id ? 'text-neon-green' : 'text-muted-foreground'
                      }`} />
                    )}
                  </div>
                </Card>
              ))}
              {(!currentEvening.gameSequence?.some(g => g.completed)) && (
                <div className="text-center text-muted-foreground py-8">
                  עדיין לא נשחקו משחקים
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Completion Dialog */}
        <Dialog open={showCompletionDialog} onOpenChange={setShowCompletionDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-center">
                <Trophy className="h-8 w-8 text-neon-green mx-auto mb-2" />
                טורניר הושלם!
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {playerStats.length > 0 && (
                <div>
                  <h4 className="font-semibold text-center mb-3">הזוכה: {playerStats[0].player.name}!</h4>
                  <div className="space-y-2">
                    {playerStats.slice(0, 3).map((stat, index) => (
                      <div key={stat.player.id} className="flex items-center justify-between p-2 rounded bg-gaming-surface/50">
                        <div className="flex items-center gap-2">
                          <Badge variant={index === 0 ? "default" : "outline"}>
                            {index + 1}
                          </Badge>
                          <span className="font-medium">{stat.player.name}</span>
                        </div>
                        <span className="text-neon-green font-semibold">{stat.wins} ניצחונות</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={() => onComplete(currentEvening)} className="flex-1">
                  שמור לתולדות
                </Button>
                <Button variant="outline" onClick={onGoHome} className="flex-1">
                  בית
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
