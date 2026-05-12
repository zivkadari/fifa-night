import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Clock, 
  Trophy, 
  Users, 
  Play, 
  Pause, 
  RotateCcw,
  Crown,
  Home
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Evening, SinglesGame, PlayerStats } from "@/types/tournament";
import { DiceScoreInput } from "@/components/DiceScoreInput";
import { TournamentEngine } from "@/services/tournamentEngine";
import { useToast } from "@/hooks/use-toast";
import { RemoteStorageService } from "@/services/remoteStorageService";

interface SinglesGameProps {
  evening: Evening;
  onBack: () => void;
  onComplete: (evening: Evening) => void;
  onGoHome: () => void;
  onUpdateEvening: (evening: Evening) => void;
  canStopTournament?: boolean;
  onStopTournament?: () => void;
}

export const SinglesGameComponent = ({ evening, onBack, onComplete, onGoHome, onUpdateEvening }: SinglesGameProps) => {
  const { toast } = useToast();
  const [currentEvening, setCurrentEvening] = useState(evening);
  const [currentGame, setCurrentGame] = useState<SinglesGame | null>(null);
  const [gamePhase, setGamePhase] = useState<'game-selection' | 'countdown' | 'result-entry'>('game-selection');
  const [countdown, setCountdown] = useState(60);
  const [isCountdownActive, setIsCountdownActive] = useState(false);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);

  useEffect(() => {
    setCurrentEvening(evening);
    updatePlayerStats(evening);
    
    // Auto-select next game if available
    if (evening.gameSequence && evening.currentGameIndex !== undefined) {
      const nextGame = evening.gameSequence[evening.currentGameIndex];
      if (nextGame && !nextGame.completed) {
        setCurrentGame(nextGame);
        setGamePhase('countdown');
      } else if (TournamentEngine.isSinglesComplete(evening)) {
        setShowCompletionDialog(true);
      }
    }
  }, [evening]);

  const updatePlayerStats = (evening: Evening) => {
    const stats = TournamentEngine.getSinglesStats(evening);
    setPlayerStats(stats);
  };

  const startGame = () => {
    if (!currentGame) return;
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
        
        // Move to next game
        const nextIncompleteIndex = updatedEvening.gameSequence.findIndex(g => !g.completed);
        updatedEvening.currentGameIndex = nextIncompleteIndex >= 0 ? nextIncompleteIndex : updatedEvening.gameSequence.length;
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
      // Move to next game
      const nextGame = updatedEvening.gameSequence?.[updatedEvening.currentGameIndex || 0];
      if (nextGame) {
        setCurrentGame(nextGame);
        setGamePhase('countdown');
      }
    }
  };

  const getGameProgress = () => {
    if (!currentEvening.gameSequence) return 0;
    const completed = currentEvening.gameSequence.filter(g => g.completed).length;
    return (completed / currentEvening.gameSequence.length) * 100;
  };

  const getRemainingGames = () => {
    if (!currentEvening.gameSequence) return 0;
    return currentEvening.gameSequence.filter(g => !g.completed).length;
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
          <Card className="bg-gaming-surface/50 border-border/50 p-4">
            <div className="text-center">
              <Trophy className="h-8 w-8 text-neon-green mx-auto mb-2" />
              <h3 className="text-base font-semibold text-foreground">הטורניר הושלם!</h3>
            </div>
          </Card>
        );
      }

      return (
        <Card className="bg-gradient-card border-neon-green/20 p-4 shadow-card">
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center gap-3">
              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-gaming-surface border-2 border-neon-green flex items-center justify-center mb-1">
                  <span className="text-xs font-bold text-neon-green">
                    {currentGame.players[0].name.slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <p className="text-sm font-medium text-foreground">{currentGame.players[0].name}</p>
                <p className="text-xs text-muted-foreground">{currentGame.clubs[0].name}</p>
              </div>
              
              <div className="text-center px-2">
                <div className="text-lg font-bold text-muted-foreground">VS</div>
                {gamePhase === 'countdown' && (
                  <div className="text-2xl font-bold text-neon-green">
                    {formatTime(countdown)}
                  </div>
                )}
              </div>
              
              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-gaming-surface border-2 border-neon-green flex items-center justify-center mb-1">
                  <span className="text-xs font-bold text-neon-green">
                    {currentGame.players[1].name.slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <p className="text-sm font-medium text-foreground">{currentGame.players[1].name}</p>
                <p className="text-xs text-muted-foreground">{currentGame.clubs[1].name}</p>
              </div>
            </div>

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
          
          <Button variant="ghost" size="icon" onClick={onGoHome}>
            <Home className="h-5 w-5" />
          </Button>
        </div>

        {/* Progress - Compact */}
        <Card className="bg-gaming-surface/50 border-border/50 p-2 mb-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">התקדמות</span>
            <span className="text-neon-green font-medium">{Math.round(getGameProgress())}%</span>
          </div>
          <Progress value={getGameProgress()} className="h-1.5" />
        </Card>

        {/* Current Game */}
        {renderCurrentGame()}

        {/* Player Stats - Compact */}
        {playerStats.length > 0 && (
          <Card className="bg-gaming-surface/50 border-border/50 p-3 mt-3">
            <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <Crown className="h-4 w-4 text-neon-green" />
              דירוג
            </h3>
            <div className="space-y-1">
              {playerStats.map((stat, index) => (
                <div key={stat.player.id} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-4">{index + 1}</span>
                    <span className="text-sm font-medium text-foreground">{stat.player.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-neon-green font-medium">{stat.wins}W</span>
                    <span className="text-muted-foreground">{stat.goalsFor}-{stat.goalsAgainst}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

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
