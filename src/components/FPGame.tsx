import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Trophy,
  Users,
  Check,
  ChevronDown,
  Edit2,
  X,
  Save,
  Share2,
  Eye,
  StopCircle,
  Sparkles,
  MoreHorizontal,
  Layers,
  CalendarDays,
  BarChart3,
  Link,
  Shield,
  CircleDot,
  Shirt,
  Clock3,
} from "lucide-react";
import FPInsightsTab from "@/components/FPInsightsTab";

import { FPEvening, FPTeamBank, FPMatch, FPPair } from "@/types/fivePlayerTypes";
import { Club } from "@/types/tournament";
import { StarRating } from "@/components/StarRating";
import { calculatePairStats, calculatePlayerStats } from "@/services/fivePlayerEngine";
import { useToast } from "@/hooks/use-toast";
import { FPScheduleReorder } from "@/components/FPScheduleReorder";
import { RemoteStorageService } from "@/services/remoteStorageService";
import { sortClubsByStarsDesc } from "@/lib/sortClubs";
import { PlayerPair } from "@/components/PlayerPair";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { TeamBadgeOrFlag, TeamVisual } from "@/components/TeamVisual";
import { ScoreStepper } from "@/components/ScoreStepper";
import {
  CollapsibleSection,
  CompactSummaryCard,
  RecentResultCard,
  SoccerNightBottomNav,
  TournamentStatusPill,
} from "@/components/soccer-night-ui";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface FPGameProps {
  evening: FPEvening;
  onBack: () => void;
  onComplete: (evening: FPEvening) => void;
  onGoHome: () => void;
  onUpdateEvening: (evening: FPEvening) => void;
  canStopTournament?: boolean;
  onStopTournament?: () => void;
  canSubmitNewScore?: boolean;
  canEditExistingResults?: boolean;
  canReorderSchedule?: boolean;
  isViewOnly?: boolean;
  spectatorContext?: {
    shareCode?: string;
    teamId?: string | null;
    selectedPlayerId?: string | null;
    onSwitchPlayer?: () => void;
  };
}


type MatchStep = 'teamA' | 'teamB' | 'score';
type ScoreMode = 'quick' | 'winner' | 'manual';
type WinnerChoice = 'A' | 'draw' | 'B' | null;

const QUICK_SCORES = [0, 1, 2, 3, 4, 5];

const WINNER_SHORTCUTS: Record<string, [number, number][]> = {
  A: [[1, 0], [2, 0], [2, 1], [3, 1], [3, 0]],
  draw: [[0, 0], [1, 1], [2, 2], [3, 3]],
  B: [[0, 1], [0, 2], [1, 2], [1, 3], [0, 3]],
};

export const FPGame = ({
  evening,
  onBack,
  onComplete,
  onGoHome,
  onUpdateEvening,
  canStopTournament,
  onStopTournament,
  canSubmitNewScore = true,
  canEditExistingResults = true,
  canReorderSchedule = true,
  isViewOnly = false,
  spectatorContext,
}: FPGameProps) => {

  const { toast } = useToast();
  const [currentEvening, setCurrentEvening] = useState(evening);
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [selectedClubA, setSelectedClubA] = useState<Club | null>(null);
  const [selectedClubB, setSelectedClubB] = useState<Club | null>(null);
  const [activeStep, setActiveStep] = useState<MatchStep>('teamA');
  const [scoreMode, setScoreMode] = useState<ScoreMode>('quick');
  const [winnerChoice, setWinnerChoice] = useState<WinnerChoice>(null);
  const [manualScoreSide, setManualScoreSide] = useState<'A' | 'B' | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const scoreRef = useRef<HTMLDivElement>(null);

  // Drill-down state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerType, setDrawerType] = useState<'pair' | 'player'>('pair');
  const [selectedPairId, setSelectedPairId] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  // Edit match state
  const [editingMatchIdx, setEditingMatchIdx] = useState<number | null>(null);
  const [editScoreA, setEditScoreA] = useState('');
  const [editScoreB, setEditScoreB] = useState('');

  // Share / spectator link state
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  useEffect(() => {
    setCurrentEvening(evening);
  }, [evening]);

  const currentMatch = currentEvening.schedule[currentEvening.currentMatchIndex] ?? null;
  const currentMatchKey = currentMatch
    ? `${currentMatch.id}-${currentMatch.globalIndex ?? currentEvening.currentMatchIndex}`
    : "no-match";

  // Reset state on match change
  useEffect(() => {
    if (!currentMatch) return;
    const hasClubA = currentMatch.clubA || null;
    const hasClubB = currentMatch.clubB || null;
    setSelectedClubA(hasClubA);
    setSelectedClubB(hasClubB);
    setScoreA(currentMatch.scoreA !== undefined ? String(currentMatch.scoreA) : '0');
    setScoreB(currentMatch.scoreB !== undefined ? String(currentMatch.scoreB) : '0');
    setScoreMode('quick');
    setWinnerChoice(null);
    setManualScoreSide(null);
    if (hasClubA && hasClubB) {
      setActiveStep('score');
    } else if (hasClubA) {
      setActiveStep('teamB');
    } else {
      setActiveStep('teamA');
    }
  }, [currentMatchKey]);

  const withAvatar = useCallback(
    <T extends { id: string; name: string }>(player: T): T => player,
    []
  );

  const withAvatarPair = useCallback(
    <T extends FPPair>(pair: T): T => ({
      ...pair,
      players: pair.players.map(withAvatar) as T["players"],
    }),
    [withAvatar]
  );

  const displayCurrentMatch = useMemo(() => {
    if (!currentMatch) return null;
    return {
      ...currentMatch,
      pairA: withAvatarPair(currentMatch.pairA),
      pairB: withAvatarPair(currentMatch.pairB),
      sittingOut: withAvatar(currentMatch.sittingOut),
    };
  }, [currentMatch, withAvatar, withAvatarPair]);

  const handleSelectClubA = useCallback((club: Club) => {
    if (!canSubmitNewScore) return;
    if (selectedClubA?.id === club.id) {
      setSelectedClubA(null);
      return;
    }
    setSelectedClubA(club);
    setTimeout(() => setActiveStep('teamB'), 200);
  }, [canSubmitNewScore, selectedClubA]);

  const handleSelectClubB = useCallback((club: Club) => {
    if (!canSubmitNewScore) return;
    if (selectedClubB?.id === club.id) {
      setSelectedClubB(null);
      return;
    }
    setSelectedClubB(club);
    setTimeout(() => {
      setActiveStep('score');
      setTimeout(() => scoreRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    }, 200);
  }, [canSubmitNewScore, selectedClubB]);

  const handleQuickScore = useCallback((side: 'A' | 'B', value: number) => {
    if (!canSubmitNewScore) return;
    if (side === 'A') {
      setScoreA(String(value));
      setManualScoreSide(null);
    } else {
      setScoreB(String(value));
      setManualScoreSide(null);
    }
  }, [canSubmitNewScore]);

  const handleWinnerShortcut = useCallback((scores: [number, number]) => {
    if (!canSubmitNewScore) return;
    setScoreA(String(scores[0]));
    setScoreB(String(scores[1]));
    setManualScoreSide(null);
  }, [canSubmitNewScore]);

  const handleSubmitResult = useCallback(() => {
    if (!canSubmitNewScore) {
      toast({ title: "צפייה בלבד", description: "אין לך הרשאה לעדכן תוצאה", variant: "destructive" });
      return;
    }
    if (!currentMatch || !selectedClubA || !selectedClubB || scoreA === '' || scoreB === '') return;
    const sA = parseInt(scoreA, 10);
    const sB = parseInt(scoreB, 10);
    if (isNaN(sA) || isNaN(sB) || sA < 0 || sB < 0) {
      toast({ title: "ציון לא תקין", variant: "destructive" });
      return;
    }

    const updatedSchedule = [...currentEvening.schedule];
    updatedSchedule[currentEvening.currentMatchIndex] = {
      ...currentMatch,
      clubA: selectedClubA,
      clubB: selectedClubB,
      scoreA: sA,
      scoreB: sB,
      completed: true,
    };

    const updatedBanks = currentEvening.teamBanks.map(bank => {
      if (bank.pairId === currentMatch.pairA.id && !bank.usedClubIds.includes(selectedClubA.id)) {
        return { ...bank, usedClubIds: [...bank.usedClubIds, selectedClubA.id] };
      }
      if (bank.pairId === currentMatch.pairB.id && !bank.usedClubIds.includes(selectedClubB.id)) {
        return { ...bank, usedClubIds: [...bank.usedClubIds, selectedClubB.id] };
      }
      return bank;
    });

    const totalMatches = currentEvening.schedule.length;
    const nextIndex = currentEvening.currentMatchIndex + 1;
    const isComplete = nextIndex >= totalMatches;

    const completedAt = isComplete ? new Date().toISOString() : undefined;
    const durationMinutes = isComplete && currentEvening.startedAt && completedAt
      ? Math.round((new Date(completedAt).getTime() - new Date(currentEvening.startedAt).getTime()) / 60000)
      : undefined;

    // Auto-capture block timing: each block = 5 matches
    const blockTimings = currentEvening.blockTimings ? [...currentEvening.blockTimings] : [];
    const completedMatchCount = updatedSchedule.filter(m => m.completed).length;
    if (completedMatchCount > 0 && completedMatchCount % 5 === 0) {
      const blockIndex = (completedMatchCount / 5) - 1;
      if (!blockTimings.find(bt => bt.blockIndex === blockIndex)) {
        blockTimings.push({ blockIndex, completedAt: new Date().toISOString() });
      }
    }

    const updated: FPEvening = {
      ...currentEvening,
      schedule: updatedSchedule,
      teamBanks: updatedBanks,
      currentMatchIndex: isComplete ? currentEvening.currentMatchIndex : nextIndex,
      completed: isComplete,
      blockTimings,
      ...(completedAt ? { completedAt, durationMinutes } : {}),
    };

    setCurrentEvening(updated);
    onUpdateEvening(updated);
    if (!isComplete) {
      setSelectedClubA(null);
      setSelectedClubB(null);
      setScoreA('0');
      setScoreB('0');
      setWinnerChoice(null);
      setManualScoreSide(null);
      setScoreMode('quick');
      setActiveStep('teamA');
    }
    setShowSaved(true);
    setTimeout(() => {
      setShowSaved(false);

      if (isComplete) {
        onComplete(updated);
      }
    }, 600);
  }, [canSubmitNewScore, currentEvening, currentMatch, selectedClubA, selectedClubB, scoreA, scoreB, onComplete, onUpdateEvening, toast]);

  // Edit existing result
  const handleSaveEdit = useCallback((matchGlobalIdx: number) => {
    if (!canEditExistingResults) {
      toast({ title: "אין הרשאה לעריכת תוצאות", variant: "destructive" });
      return;
    }
    const sA = parseInt(editScoreA, 10);
    const sB = parseInt(editScoreB, 10);
    if (isNaN(sA) || isNaN(sB) || sA < 0 || sB < 0) {
      toast({ title: "ציון לא תקין", variant: "destructive" });
      return;
    }

    const updatedSchedule = [...currentEvening.schedule];
    const match = updatedSchedule[matchGlobalIdx];
    if (!match) return;

    updatedSchedule[matchGlobalIdx] = {
      ...match,
      scoreA: sA,
      scoreB: sB,
    };

    const updated: FPEvening = {
      ...currentEvening,
      schedule: updatedSchedule,
    };

    setCurrentEvening(updated);
    onUpdateEvening(updated);
    setEditingMatchIdx(null);
    toast({ title: "התוצאה עודכנה בהצלחה" });
  }, [canEditExistingResults, currentEvening, editScoreA, editScoreB, onUpdateEvening, toast]);

  const pairStats = calculatePairStats(currentEvening);
  const playerStats = calculatePlayerStats(currentEvening);

  const shareUrl = useCallback((code: string) => `${window.location.origin}/spectate/${code}`, []);

  const doShare = useCallback(async (url: string) => {
    const shareText = `🏆 בואו לעקוב אחרי הליגה שלנו בלייב!\n${url}`;
    // Try native share first (works great on mobile → WhatsApp etc.)
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }
    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
      toast({ title: "קישור צפייה הועתק!" });
    } catch {
      toast({ title: "שגיאה בהעתקה", variant: "destructive" });
    }
  }, [toast]);

  const handleShare = useCallback(async () => {
    if (shareCode) {
      await doShare(shareUrl(shareCode));
      return;
    }
    setShareLoading(true);
    try {
      try {
        await RemoteStorageService.upsertEveningLiveWithTeam(
          currentEvening as unknown as Parameters<typeof RemoteStorageService.upsertEveningLiveWithTeam>[0],
          null
        );
      } catch (upsertErr) {
        console.warn("handleShare upsert warning:", upsertErr);
      }
      const code = await RemoteStorageService.getShareCode(currentEvening.id);
      if (code) {
        setShareCode(code);
        await doShare(shareUrl(code));
      } else {
        toast({ title: "לא ניתן ליצור קישור. ודא שאתה מחובר.", variant: "destructive" });
      }
    } catch (err) {
      console.error("handleShare error:", err);
      toast({ title: "שגיאה ביצירת קישור", variant: "destructive" });
    } finally {
      setShareLoading(false);
    }
  }, [currentEvening, shareCode, toast, doShare, shareUrl]);

  if (!currentMatch || !displayCurrentMatch) return null;

  const roundNum = currentMatch.roundIndex + 1;
  const matchInRound = currentMatch.matchIndex + 1;
  const totalMatches = currentEvening.schedule.length;
  const matchProgressLabel = `${currentEvening.currentMatchIndex + 1} / ${totalMatches}`;

  const bankA = currentEvening.teamBanks.find(b => b.pairId === currentMatch.pairA.id)!;
  const bankB = currentEvening.teamBanks.find(b => b.pairId === currentMatch.pairB.id)!;

  const canSubmit = canSubmitNewScore && selectedClubA && selectedClubB && scoreA !== '' && scoreB !== '';
  const bothTeamsSelected = !!selectedClubA && !!selectedClubB;

  const pairName = (pair: { players: [{ name: string }, { name: string }] }) =>
    `${pair.players[0].name} & ${pair.players[1].name}`;

  const renderStars = (stars: number) => <StarRating stars={stars} size="xs" />;

  const currentStepNum = activeStep === 'teamA' ? 1 : activeStep === 'teamB' ? 2 : 3;

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-3">
      {(['teamA', 'teamB', 'score'] as MatchStep[]).map((step, i) => {
        const isActive = activeStep === step;
        const isDone = step === 'teamA' ? !!selectedClubA
          : step === 'teamB' ? !!selectedClubB
          : (scoreA !== '' && scoreB !== '');
        const labels = ['קבוצה א׳', 'קבוצה ב׳', 'תוצאה'];
        return (
          <div key={step} className="flex items-center gap-1">
            {i > 0 && <div className={`w-6 h-0.5 ${isDone || isActive ? 'bg-neon-green/60' : 'bg-border/40'}`} />}
            <button
              onClick={() => {
                if (step === 'teamB' && !selectedClubA) return;
                if (step === 'score' && !bothTeamsSelected) return;
                setActiveStep(step);
              }}
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all ${
                isActive
                  ? 'bg-neon-green/20 text-neon-green border border-neon-green/40'
                  : isDone
                    ? 'bg-neon-green/10 text-neon-green/70 border border-neon-green/20'
                    : 'bg-gaming-surface/50 text-muted-foreground border border-border/30'
              }`}
            >
              {isDone && !isActive ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}
              <span>{labels[i]}</span>
            </button>
          </div>
        );
      })}
    </div>
  );

  const renderTeamBank = (
    bank: FPTeamBank,
    selected: Club | null,
    onSelect: (c: Club) => void,
    label: string,
    step: MatchStep,
  ) => {
    const isActive = activeStep === step;
    const isCompleted = !!selected;
    const isLocked = !canSubmitNewScore || (step === 'teamB' && !selectedClubA);

    return (
      <Card className={`border p-3 transition-all duration-200 ${
        isActive
          ? 'bg-gradient-card border-neon-green/40 shadow-card shadow-neon-green/5'
          : isCompleted
            ? 'bg-gradient-card border-neon-green/20 shadow-card'
            : 'bg-gaming-surface/30 border-border/30 opacity-60'
      }`}>
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => {
            if (isLocked) return;
            setActiveStep(step);
          }}
        >
          <span className={`text-sm font-semibold ${isActive ? 'text-neon-green' : 'text-foreground'}`}>
            {label}
          </span>
          <div className="flex items-center gap-2">
            {selected && (
              <Badge className="bg-neon-green/20 text-neon-green border-neon-green/30 text-xs">
                {selected.name} {renderStars(selected.stars)}
              </Badge>
            )}
            {!isLocked && (
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isActive ? 'rotate-180' : ''}`} />
            )}
          </div>
        </div>

        {isActive && (
          <div className="space-y-1 mt-2">
            {sortClubsByStarsDesc(bank.clubs).map(club => {
              const isSelected = selected?.id === club.id;
            
              // אם הקבוצה כבר ב-usedClubIds אבל היא הבחירה הנוכחית,
              // עדיין נציג אותה כבחירה ירוקה ולא כ"שוחק".
              const isUsed = bank.usedClubIds.includes(club.id) && !isSelected;
              const isDisabled = isUsed || !canSubmitNewScore;
            
              return (
                <div
                  key={club.id}
                  className={`flex items-center justify-between p-2.5 rounded-lg text-sm border transition-all ${
                    isSelected
                      ? 'border-neon-green bg-neon-green/15 scale-[1.01]'
                      : isDisabled
                        ? 'border-border/20 bg-gaming-surface/20 opacity-40 cursor-not-allowed'
                        : 'border-border/40 bg-gaming-surface/80 cursor-pointer hover:border-neon-green/50 hover:bg-gaming-surface active:scale-[0.98]'
                  }`}
                  onClick={() => {
                    if (isDisabled) return;
                    onSelect(club);
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isUsed && (
                      <span className="text-[10px] text-muted-foreground/60 bg-muted/20 px-1.5 py-0.5 rounded shrink-0">
                        שוחק
                      </span>
                    )}
            
                    {isSelected && (
                      <span className="text-[10px] text-neon-green bg-neon-green/10 px-1.5 py-0.5 rounded shrink-0">
                        נבחרה
                      </span>
                    )}
            
                    <span
                      className={`truncate ${
                        isUsed
                          ? 'line-through text-muted-foreground/40'
                          : isSelected
                            ? 'text-neon-green font-semibold'
                            : 'text-foreground'
                      }`}
                    >
                      {club.name}
                    </span>
                  </div>
            
                  <div className="flex items-center gap-2 shrink-0">
                    {renderStars(club.stars)}
                    {isSelected && <Check className="h-3.5 w-3.5 text-neon-green" />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    );
  };

  const renderQuickScoreChips = (side: 'A' | 'B', value: string, onChange: (v: string) => void) => {
    const isManual = manualScoreSide === side;
    return (
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground text-center">
          {side === 'A' ? selectedClubA?.name : selectedClubB?.name}
        </p>
        <div className="flex flex-wrap justify-center gap-1.5">
          {QUICK_SCORES.map(n => (
            <button
              key={n}
              onClick={() => handleQuickScore(side, n)}
              className={`w-9 h-9 rounded-lg text-sm font-bold transition-all ${
                value === String(n) && !isManual
                  ? 'bg-neon-green text-neon-green-foreground scale-105'
                  : 'bg-gaming-surface border border-border/50 text-foreground hover:border-neon-green/40 active:scale-95'
              }`}
            >
              {n}
            </button>
          ))}
          <button
            onClick={() => {
              setManualScoreSide(side);
              onChange('');
            }}
            className={`px-2.5 h-9 rounded-lg text-xs font-medium transition-all ${
              isManual
                ? 'bg-neon-green/20 text-neon-green border border-neon-green/40'
                : 'bg-gaming-surface border border-border/50 text-muted-foreground hover:border-neon-green/40'
            }`}
          >
            אחר
          </button>
        </div>
        {isManual && (
          <Input
            type="number"
            min="0"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="text-center text-lg font-bold bg-gaming-surface border-border w-20 mx-auto mt-1"
            inputMode="numeric"
            autoFocus
            placeholder="?"
          />
        )}
      </div>
    );
  };

  const renderWinnerMode = () => (
    <div className="space-y-3">
      <div className="flex gap-2 justify-center">
        {([
          { key: 'A' as const, label: `ניצחון ${pairName(currentMatch.pairA).split(' & ')[0]}` },
          { key: 'draw' as const, label: 'תיקו' },
          { key: 'B' as const, label: `ניצחון ${pairName(currentMatch.pairB).split(' & ')[0]}` },
        ]).map(opt => (
          <button
            key={opt.key}
            onClick={() => { setWinnerChoice(opt.key); setScoreA(''); setScoreB(''); }}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
              winnerChoice === opt.key
                ? 'bg-neon-green/20 text-neon-green border border-neon-green/50'
                : 'bg-gaming-surface border border-border/40 text-muted-foreground hover:border-neon-green/30'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {winnerChoice && (
        <div className="space-y-2">
          <div className="flex flex-wrap justify-center gap-2">
            {WINNER_SHORTCUTS[winnerChoice].map(([a, b]) => (
              <button
                key={`${a}-${b}`}
                onClick={() => handleWinnerShortcut([a, b])}
                className={`px-3 py-2 rounded-lg text-sm font-bold transition-all ${
                  scoreA === String(a) && scoreB === String(b)
                    ? 'bg-neon-green text-neon-green-foreground scale-105'
                    : 'bg-gaming-surface border border-border/40 text-foreground hover:border-neon-green/40 active:scale-95'
                }`}
              >
                {a} - {b}
              </button>
            ))}
            <button
              onClick={() => { setScoreMode('quick'); setWinnerChoice(null); setScoreA(''); setScoreB(''); }}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-gaming-surface border border-border/40 text-muted-foreground hover:border-neon-green/40"
            >
              אחר
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderScoreEntry = () => {
    if (!canSubmitNewScore) {
      return (
        <Card className="bg-gaming-surface/40 border-border/40 p-3 text-center">
          <p className="text-sm font-medium text-foreground">צפייה בלבד</p>
          <p className="text-xs text-muted-foreground mt-1">אין לך הרשאה להזין תוצאה בטורניר הזה.</p>
        </Card>
      );
    }

    const isActive = activeStep === 'score';
    const isLocked = !bothTeamsSelected;

    return (
      <Card
        ref={scoreRef}
        className={`border p-3 transition-all duration-200 ${
          isActive
            ? 'bg-gradient-card border-neon-green/40 shadow-card shadow-neon-green/5'
            : isLocked
              ? 'bg-gaming-surface/30 border-border/30 opacity-40'
              : 'bg-gradient-card border-neon-green/20 shadow-card'
        }`}
      >
        <div
          className="flex items-center justify-between cursor-pointer mb-2"
          onClick={() => { if (!isLocked) setActiveStep('score'); }}
        >
          <span className={`text-sm font-semibold ${isActive ? 'text-neon-green' : 'text-foreground'}`}>
            תוצאה
          </span>
          {scoreA !== '' && scoreB !== '' && !isActive && (
            <Badge className="bg-neon-green/20 text-neon-green border-neon-green/30 text-xs">
              {scoreA} - {scoreB}
            </Badge>
          )}
        </div>

        {isActive && !isLocked && (
          <div className="space-y-3">
            <div className="flex gap-1 justify-center">
              <button
                onClick={() => { setScoreMode('quick'); setWinnerChoice(null); }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  scoreMode === 'quick'
                    ? 'bg-neon-green/20 text-neon-green border border-neon-green/40'
                    : 'bg-gaming-surface/50 text-muted-foreground border border-border/30'
                }`}
              >
                מהיר
              </button>
              <button
                onClick={() => { setScoreMode('winner'); setScoreA(''); setScoreB(''); setManualScoreSide(null); }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  scoreMode === 'winner'
                    ? 'bg-neon-green/20 text-neon-green border border-neon-green/40'
                    : 'bg-gaming-surface/50 text-muted-foreground border border-border/30'
                }`}
              >
                לפי מנצח
              </button>
            </div>

            {scoreMode === 'winner' ? renderWinnerMode() : (
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  {renderQuickScoreChips('A', scoreA, setScoreA)}
                </div>
                <span className="text-xl font-bold text-muted-foreground mt-7">:</span>
                <div className="flex-1">
                  {renderQuickScoreChips('B', scoreB, setScoreB)}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    );
  };

  // Get matches for a specific pair
  const getMatchesForPair = (pairId: string): FPMatch[] => {
    return currentEvening.schedule.filter(
      m => m.completed && (m.pairA.id === pairId || m.pairB.id === pairId)
    );
  };

  // Get matches for a specific player
  const getMatchesForPlayer = (playerId: string): FPMatch[] => {
    return currentEvening.schedule.filter(
      m => m.completed && (
        m.pairA.players.some(p => p.id === playerId) ||
        m.pairB.players.some(p => p.id === playerId)
      )
    );
  };

  const openPairDetails = (pairId: string) => {
    setSelectedPairId(pairId);
    setSelectedPlayerId(null);
    setDrawerType('pair');
    setDrawerOpen(true);
  };

  const openPlayerDetails = (playerId: string) => {
    setSelectedPlayerId(playerId);
    setSelectedPairId(null);
    setDrawerType('player');
    setDrawerOpen(true);
  };

  const renderMatchRow = (match: FPMatch, perspectivePairId?: string, perspectivePlayerId?: string) => {
    const isEditing = canEditExistingResults && editingMatchIdx === match.globalIndex;
    
    // Determine "our" side
    let isOurSideA = true;
    if (perspectivePairId) {
      isOurSideA = match.pairA.id === perspectivePairId;
    } else if (perspectivePlayerId) {
      isOurSideA = match.pairA.players.some(p => p.id === perspectivePlayerId);
    }

    const ourScore = isOurSideA ? match.scoreA : match.scoreB;
    const theirScore = isOurSideA ? match.scoreB : match.scoreA;
    const ourPair = isOurSideA ? match.pairA : match.pairB;
    const theirPair = isOurSideA ? match.pairB : match.pairA;
    const ourClub = isOurSideA ? match.clubA : match.clubB;
    const theirClub = isOurSideA ? match.clubB : match.clubA;

    const result = ourScore !== undefined && theirScore !== undefined
      ? ourScore > theirScore ? 'W' : ourScore < theirScore ? 'L' : 'D'
      : null;

    const resultColor = result === 'W' ? 'text-neon-green' : result === 'L' ? 'text-destructive' : 'text-muted-foreground';
    const resultLabel = result === 'W' ? 'ניצחון' : result === 'L' ? 'הפסד' : 'תיקו';

    if (isEditing) {
      return (
        <div key={match.id} className="bg-gaming-surface/60 rounded-lg p-3 border border-neon-green/30 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">סיבוב {match.roundIndex + 1} • משחק {match.matchIndex + 1}</span>
            <div className="flex gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setEditingMatchIdx(null)}
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-foreground">
            {pairName(match.pairA)} vs {pairName(match.pairB)}
          </p>
          <div className="flex items-center justify-center gap-3">
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground mb-1">{pairName(match.pairA)}</p>
              <Input
                type="number"
                min="0"
                value={editScoreA}
                onChange={e => setEditScoreA(e.target.value)}
                className="w-16 h-9 text-center text-lg font-bold bg-gaming-surface border-border"
                inputMode="numeric"
              />
            </div>
            <span className="text-lg font-bold text-muted-foreground mt-4">:</span>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground mb-1">{pairName(match.pairB)}</p>
              <Input
                type="number"
                min="0"
                value={editScoreB}
                onChange={e => setEditScoreB(e.target.value)}
                className="w-16 h-9 text-center text-lg font-bold bg-gaming-surface border-border"
                inputMode="numeric"
              />
            </div>
          </div>
          <Button
            variant="gaming"
            size="sm"
            className="w-full"
            onClick={() => handleSaveEdit(match.globalIndex)}
            disabled={editScoreA === '' || editScoreB === ''}
          >
            <Save className="h-3.5 w-3.5" />
            שמור שינויים
          </Button>
        </div>
      );
    }

    return (
      <div key={match.id} className="bg-gaming-surface/40 rounded-lg p-2.5 border border-border/30">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">סיבוב {match.roundIndex + 1} • משחק {match.matchIndex + 1}</span>
          <div className="flex items-center gap-1.5">
            <Badge className={`text-[10px] px-1.5 py-0 ${
              result === 'W' ? 'bg-neon-green/20 text-neon-green border-neon-green/30'
              : result === 'L' ? 'bg-destructive/20 text-destructive border-destructive/30'
              : 'bg-muted/20 text-muted-foreground border-border/40'
            }`}>
              {resultLabel}
            </Badge>
            {canEditExistingResults && (
              <button
                onClick={() => {
                  setEditingMatchIdx(match.globalIndex);
                  setEditScoreA(String(match.scoreA ?? ''));
                  setEditScoreB(String(match.scoreB ?? ''));
                }}
                className="p-1 rounded hover:bg-gaming-surface/80 transition-colors"
              >
                <Edit2 className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <div className="flex-1">
            <p className="text-xs text-foreground font-medium">vs {pairName(theirPair)}</p>
            {ourClub && theirClub && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {ourClub.name} vs {theirClub.name}
              </p>
            )}
          </div>
          <span className={`text-lg font-bold ${resultColor}`}>
            {ourScore}-{theirScore}
          </span>
        </div>
      </div>
    );
  };

  const renderDrawerContent = () => {
    if (drawerType === 'pair' && selectedPairId) {
      const pair = currentEvening.pairs.find(p => p.id === selectedPairId);
      if (!pair) return null;
      const matches = getMatchesForPair(selectedPairId);
      const stats = pairStats.find(s => s.pair.id === selectedPairId);

      return (
        <>
          <DrawerHeader>
            <DrawerTitle className="text-foreground text-right">{pairName(pair)}</DrawerTitle>
            <DrawerDescription className="text-right">
              {stats && `${stats.points} נק׳ • ${stats.wins}נ ${stats.draws}ת ${stats.losses}ה • הפ: ${stats.goalDiff > 0 ? '+' : ''}${stats.goalDiff}`}
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6 space-y-2 max-h-[60vh] overflow-auto">
            {matches.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-4">אין משחקים עדיין</p>
            )}
            {matches.map(m => renderMatchRow(m, selectedPairId, undefined))}
          </div>
        </>
      );
    }

    if (drawerType === 'player' && selectedPlayerId) {
      const player = currentEvening.players.find(p => p.id === selectedPlayerId);
      if (!player) return null;
      const matches = getMatchesForPlayer(selectedPlayerId);
      const stats = playerStats.find(s => s.player.id === selectedPlayerId);

      return (
        <>
          <DrawerHeader>
            <DrawerTitle className="text-foreground text-right">{player.name}</DrawerTitle>
            <DrawerDescription className="text-right">
              {stats && `${stats.points} נק׳ • ${stats.played} משחקים • ${stats.wins}נ ${stats.draws}ת ${stats.losses}ה`}
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6 space-y-2 max-h-[60vh] overflow-auto">
            {matches.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-4">אין משחקים עדיין</p>
            )}
            {matches.map(m => renderMatchRow(m, undefined, selectedPlayerId))}
          </div>
        </>
      );
    }

    return null;
  };

  const completedMatches = currentEvening.schedule.filter((match) => match.completed);
  const recentMatches = completedMatches.slice(-1).reverse();
  const nextMatch = currentEvening.schedule
    .slice(currentEvening.currentMatchIndex + 1)
    .find((match) => !match.completed);
  const leader = pairStats[0];
  const leadingPlayer = playerStats[0];
  const totalRemainingClubs = currentEvening.teamBanks.reduce(
    (sum, bank) => sum + Math.max(0, bank.clubs.length - bank.usedClubIds.length),
    0
  );
  const visibleTeamSelectors = !isViewOnly && (!bothTeamsSelected || activeStep !== "score");

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const standingsPreview = leader
    ? completedMatches.length > 0
      ? `${pairName(leader.pair)} · ${leader.points} נק׳`
      : "יתעדכן אחרי המשחק הראשון"
    : "אין דירוג";

  return (
    <div id="top" className="min-h-[100dvh] bg-[#05070A] text-[#F4F7F5]" dir="rtl">
      <div className="mx-auto flex min-h-[100dvh] w-full flex-col px-4 pb-[calc(6.25rem+env(safe-area-inset-bottom))] pt-3 sm:max-w-md sm:px-3">
        {showSaved && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="flex flex-col items-center gap-2 rounded-xl border border-[#39FF88]/50 bg-[#0F141B] px-8 py-5 shadow-[0_0_28px_rgba(57,255,136,0.25)] animate-in zoom-in-95 fade-in duration-300">
              <Check className="h-10 w-10 text-[#39FF88]" />
              <span className="text-lg font-bold text-[#F4F7F5]">נשמר</span>
            </div>
          </div>
        )}

        <header className="mb-3 flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9 shrink-0 text-[#A4ADB8] hover:bg-[#151C26]" aria-label="חזרה">
              <ArrowLeft className="h-5 w-5 rotate-180" />
            </Button>
            <div className="shrink-0 leading-none">
              <div className="font-display text-[1.45rem] font-black uppercase tracking-normal">
                <span className="block leading-[0.85] text-[#F4F7F5]">SOCCER</span>
                <span className="block leading-[0.85] text-[#39FF88]">NIGHT</span>
              </div>
            </div>
            <TournamentStatusPill active={!currentEvening.completed}>
              <span dir="ltr">{matchProgressLabel}</span>
            </TournamentStatusPill>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2">
            <span className="inline-flex h-9 items-center gap-1 rounded-full border border-[#26313D] bg-[#0F141B] px-2.5 text-xs font-bold text-[#F4F7F5]">
              {isViewOnly ? "צופה" : canStopTournament ? "אדמין" : "שחקן"}
              <Shield className="h-3.5 w-3.5 text-[#39FF88]" />
            </span>
            <PlayerAvatar player={withAvatar(currentMatch.pairA.players[0])} size="md" />
          </div>
        </header>

        <main className="space-y-3">
          <section className="relative overflow-hidden rounded-xl border border-[#26313D] bg-[#0F141B] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(57,255,136,0.16),transparent_38%),linear-gradient(180deg,rgba(21,28,38,0.7),rgba(5,7,10,0.2))]" />
            <div className="relative">
              <div className="mb-3 flex items-center justify-between">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-lg border border-[#26313D] bg-[#05070A]/70 text-[#A4ADB8]">
                      <MoreHorizontal className="h-5 w-5" />
                      <span className="sr-only">פעולות טורניר</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="bg-[#0F141B] text-[#F4F7F5] border-[#26313D]">
                    <DropdownMenuItem onClick={handleShare} disabled={shareLoading}>
                      {shareCode ? <Eye className="ml-2 h-4 w-4" /> : <Share2 className="ml-2 h-4 w-4" />}
                      שתף קישור צפייה
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => scrollToSection("fp-schedule")}>
                      <CalendarDays className="ml-2 h-4 w-4" />
                      סדר משחקים
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {canStopTournament && onStopTournament && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem
                            className="text-[#FF4D4D] focus:text-[#FF4D4D]"
                            onSelect={(event) => event.preventDefault()}
                          >
                            <StopCircle className="ml-2 h-4 w-4" />
                            הפסק טורניר
                          </DropdownMenuItem>
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
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="rounded-b-xl border-x border-b border-[#26313D] bg-[#05070A]/70 px-5 py-1 text-center text-xs font-bold text-[#39FF88]">
                  משחק נוכחי
                </div>
                <span className="h-10 w-10" aria-hidden="true" />
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2">
                <div className="min-w-0 space-y-2">
                  <PlayerPair players={displayCurrentMatch.pairA.players} size="sm" />
                  <TeamVisual club={selectedClubA} size="lg" selected={activeStep === "teamA"} />
                </div>

                <div className="flex min-w-[4.15rem] flex-col items-center gap-2 pt-10">
                  <span className="font-display text-3xl font-black text-[#39FF88] drop-shadow-[0_0_12px_rgba(57,255,136,0.45)]">VS</span>
                </div>

                <div className="min-w-0 space-y-2">
                  <PlayerPair players={displayCurrentMatch.pairB.players} size="sm" />
                  <TeamVisual club={selectedClubB} size="lg" selected={activeStep === "teamB"} />
                </div>
              </div>

              <div ref={scoreRef} className="mt-3 rounded-xl border border-[#26313D] bg-[#05070A]/78 p-2.5">
                <div className="text-center">
                  <div className="whitespace-nowrap font-mono text-4xl font-black tabular-nums text-[#F4F7F5]" dir="ltr">
                    {scoreA === "" ? "0" : scoreA} : {scoreB === "" ? "0" : scoreB}
                  </div>
                </div>

                {!isViewOnly && (
                  <div className="mt-3 grid grid-cols-2 gap-2" dir="rtl">
                    <div className="rounded-lg border border-[#26313D]/70 bg-[#151C26]/55 p-2">
                      <p className="mb-1 text-center text-[10px] font-bold leading-tight text-[#A4ADB8]" dir="auto">
                        {selectedClubA?.name ?? pairName(currentMatch.pairA)}
                      </p>
                      <ScoreStepper
                        label={pairName(currentMatch.pairA)}
                        value={scoreA}
                        onChange={setScoreA}
                        disabled={!canSubmitNewScore}
                        className="justify-center"
                      />
                    </div>
                    <div className="rounded-lg border border-[#26313D]/70 bg-[#151C26]/55 p-2">
                      <p className="mb-1 text-center text-[10px] font-bold leading-tight text-[#A4ADB8]" dir="auto">
                        {selectedClubB?.name ?? pairName(currentMatch.pairB)}
                      </p>
                      <ScoreStepper
                        label={pairName(currentMatch.pairB)}
                        value={scoreB}
                        onChange={setScoreB}
                        disabled={!canSubmitNewScore}
                        className="justify-center"
                      />
                    </div>
                  </div>
                )}

                <div className="mt-2 flex items-center justify-center gap-2 rounded-lg border border-[#26313D]/80 bg-[#151C26]/70 px-3 py-1.5">
                  <span className="text-xs font-bold text-[#A4ADB8]">יושב בחוץ:</span>
                  <PlayerAvatar player={displayCurrentMatch.sittingOut} size="xs" />
                  <span className="min-w-0 truncate text-xs font-semibold text-[#F4F7F5]">{displayCurrentMatch.sittingOut.name}</span>
                </div>
              </div>

              {!isViewOnly && (
                <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                  <Button
                    variant="gaming"
                    className="h-12 rounded-lg bg-[#39FF88] text-base font-black text-[#05070A] shadow-[0_0_22px_rgba(57,255,136,0.35)] hover:bg-[#39FF88]/90"
                    disabled={!canSubmit || !canSubmitNewScore}
                    onClick={handleSubmitResult}
                  >
                    <Check className="h-5 w-5" />
                    {currentEvening.currentMatchIndex + 1 >= totalMatches ? "סיים ליגה" : "שמור תוצאה"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 rounded-lg border-[#26313D] bg-[#151C26] px-3 text-[#F4F7F5]"
                    onClick={() => setActiveStep(activeStep === "teamA" ? "teamB" : "teamA")}
                    disabled={!canSubmitNewScore}
                  >
                    <Shirt className="h-5 w-5" />
                    {bothTeamsSelected ? "החלפת קבוצות" : "בחירת קבוצות"}
                  </Button>
                </div>
              )}
            </div>
          </section>

          {visibleTeamSelectors && (
            <section className="space-y-2">
              {renderStepIndicator()}
              {renderTeamBank(bankA, selectedClubA, handleSelectClubA, `בנק ${pairName(currentMatch.pairA)}`, "teamA")}
              {renderTeamBank(bankB, selectedClubB, handleSelectClubB, `בנק ${pairName(currentMatch.pairB)}`, "teamB")}
            </section>
          )}

          <section className="space-y-2">
            <article className="rounded-lg border border-[#26313D] bg-[#0F141B] p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 text-sm font-black text-[#F4F7F5]">
                  <CircleDot className="h-5 w-5 text-[#39FF88]" />
                  המשחק הבא
                </h3>
                {nextMatch && (
                  <span className="text-xs font-semibold text-[#A4ADB8]">
                    משחק {nextMatch.globalIndex + 1}
                  </span>
                )}
              </div>
              {nextMatch ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-[#151C26]/65 px-2 py-1.5">
                    <PlayerPair players={withAvatarPair(nextMatch.pairA).players} size="sm" layout="inline" />
                    <span className="font-mono text-xs font-black text-[#39FF88]">VS</span>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-[#151C26]/65 px-2 py-1.5">
                    <PlayerPair players={withAvatarPair(nextMatch.pairB).players} size="sm" layout="inline" />
                    <span className="rounded-full border border-[#26313D] px-2 py-0.5 text-[10px] font-bold text-[#A4ADB8]">
                      טרם שוחק
                    </span>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-1 text-xs text-[#A4ADB8]">
                    <span>בחוץ:</span>
                    <PlayerAvatar player={withAvatar(nextMatch.sittingOut)} size="xs" />
                    <span className="font-semibold text-[#F4F7F5]">{nextMatch.sittingOut.name}</span>
                  </div>
                </div>
              ) : (
                <p className="text-center text-xs text-[#A4ADB8]">אין משחק הבא</p>
              )}
            </article>

            <div className="grid grid-cols-2 gap-2">
              <CompactSummaryCard icon={<Trophy className="h-5 w-5" />} title="מובילים" className="min-h-[6.25rem]">
                {completedMatches.length > 0 && leader ? (
                  <div className="space-y-1">
                    <PlayerPair players={withAvatarPair(leader.pair).players} size="sm" layout="inline" />
                    <p className="font-mono text-2xl font-black tabular-nums text-[#39FF88]">{leader.points} נק׳</p>
                  </div>
                ) : (
                  <p className="text-xs leading-relaxed text-[#A4ADB8]">הדירוג יתעדכן אחרי המשחק הראשון</p>
                )}
              </CompactSummaryCard>

              <CompactSummaryCard icon={<Layers className="h-5 w-5" />} title="קבוצות" className="min-h-[6.25rem]">
                <div className="space-y-1">
                  {currentEvening.teamBanks.slice(0, 2).map((bank) => {
                    const pair = currentEvening.pairs.find((p) => p.id === bank.pairId);
                    const remaining = Math.max(0, bank.clubs.length - bank.usedClubIds.length);
                    const total = bank.clubs.length || 1;
                    return (
                      <div key={bank.pairId} className="space-y-1 text-[10px]">
                        <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                          <span className="min-w-0 text-[#A4ADB8] leading-tight">{pair ? pairName(pair) : "זוג"}</span>
                          <span className="font-mono text-[#F4F7F5]">{remaining}/{bank.clubs.length}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-[#26313D]">
                          <div
                            className="h-full rounded-full bg-[#39FF88]"
                            style={{ width: `${Math.max(0, Math.min(100, (remaining / total) * 100))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-[10px] font-semibold text-[#39FF88]">{totalRemainingClubs} זמינות</p>
                </div>
              </CompactSummaryCard>
            </div>
          </section>

          {recentMatches.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-base font-black text-[#F4F7F5]">
                  <Clock3 className="h-5 w-5 text-[#39FF88]" />
                  תוצאה אחרונה
                </h2>
                <button type="button" className="text-xs font-bold text-[#39FF88]" onClick={() => scrollToSection("fp-results")}>
                  הצג הכל
                </button>
              </div>
              <div className="space-y-2">
                {recentMatches.map((match) => (
                  <RecentResultCard key={match.id}>
                    <div className="grid grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-2">
                      <div className="text-center text-[10px] text-[#A4ADB8]">
                        <div>משחק {match.globalIndex + 1}</div>
                      </div>
                      <div className="flex items-center justify-end gap-1">
                        <PlayerPair players={withAvatarPair(match.pairA).players} size="sm" showNames={false} />
                        <TeamBadgeOrFlag club={match.clubA} size="sm" />
                      </div>
                      <div className="font-mono text-2xl font-black tabular-nums text-[#F4F7F5]" dir="ltr">
                        {match.scoreA} : {match.scoreB}
                      </div>
                      <div className="flex items-center justify-start gap-1">
                        <TeamBadgeOrFlag club={match.clubB} size="sm" />
                        <PlayerPair players={withAvatarPair(match.pairB).players} size="sm" showNames={false} />
                      </div>
                      {canEditExistingResults && (
                        <button
                          type="button"
                          className="rounded-md p-2 text-[#A4ADB8] hover:bg-[#151C26] hover:text-[#F4F7F5]"
                          onClick={() => {
                            setEditingMatchIdx(match.globalIndex);
                            setEditScoreA(String(match.scoreA ?? ""));
                            setEditScoreB(String(match.scoreB ?? ""));
                          }}
                          aria-label="ערוך תוצאה"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </RecentResultCard>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-2">
            <CollapsibleSection
              title="בנקי קבוצות"
              preview={`${totalRemainingClubs} קבוצות זמינות`}
              icon={<Shirt className="h-5 w-5" />}
            >
              <div className="space-y-2">
                {currentEvening.teamBanks.map((bank) => {
                  const pair = currentEvening.pairs.find((p) => p.id === bank.pairId);
                  if (!pair) return null;
                  return (
                    <div key={bank.pairId} className="rounded-lg border border-[#26313D] bg-[#151C26] p-2">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-bold text-[#F4F7F5]">{pairName(pair)}</span>
                        <PlayerPair players={withAvatarPair(pair).players} size="sm" showNames={false} />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {sortClubsByStarsDesc(bank.clubs).map((club) => (
                          <TeamVisual
                            key={club.id}
                            club={club}
                            size="sm"
                            used={bank.usedClubIds.includes(club.id)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CollapsibleSection>

            <div id="fp-schedule">
              <CollapsibleSection
                title="סדר משחקים"
                preview={`${totalMatches} משחקים`}
                icon={<CalendarDays className="h-5 w-5" />}
              >
                <FPScheduleReorder
                  evening={currentEvening}
                  canEditSchedule={canReorderSchedule}
                  onUpdateEvening={(updated) => {
                    setCurrentEvening(updated);
                    onUpdateEvening(updated);
                  }}
                />
              </CollapsibleSection>
            </div>

            <div id="fp-standings">
              <CollapsibleSection title="דירוגים" preview={standingsPreview} icon={<Trophy className="h-5 w-5" />}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-sm font-black text-[#F4F7F5]">זוגות</h3>
                    {pairStats.map((s, idx) => (
                      <button
                        key={s.pair.id}
                        type="button"
                        className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-[#26313D] bg-[#151C26] p-2 text-right"
                        onClick={() => openPairDetails(s.pair.id)}
                      >
                        <span className="font-mono text-sm font-black text-[#6F7A86]">{idx + 1}</span>
                        <PlayerPair players={withAvatarPair(s.pair).players} size="sm" layout="inline" />
                        <div className="text-left">
                          <p className="font-mono text-xl font-black tabular-nums text-[#39FF88]">{s.points}</p>
                          <p className="text-[10px] text-[#A4ADB8]">{s.wins}נ {s.draws}ת {s.losses}ה</p>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-black text-[#F4F7F5]">שחקנים</h3>
                    {playerStats.map((s, idx) => (
                      <button
                        key={s.player.id}
                        type="button"
                        className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-[#26313D] bg-[#151C26] p-2 text-right"
                        onClick={() => openPlayerDetails(s.player.id)}
                      >
                        <span className="font-mono text-sm font-black text-[#6F7A86]">{idx + 1}</span>
                        <div className="flex min-w-0 items-center gap-2">
                          <PlayerAvatar player={withAvatar(s.player)} size="sm" />
                          <span className="min-w-0 truncate text-sm font-bold text-[#F4F7F5]">{s.player.name}</span>
                        </div>
                        <div className="text-left">
                          <p className="font-mono text-xl font-black tabular-nums text-[#39FF88]">{s.points}</p>
                          <p className="text-[10px] text-[#A4ADB8]">{s.wins}נ {s.draws}ת {s.losses}ה</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </CollapsibleSection>
            </div>

            <div id="fp-results">
              {completedMatches.length > 0 && (
                <CollapsibleSection
                  title="תוצאות ונתונים"
                  preview={`${completedMatches.length} תוצאות`}
                  icon={<BarChart3 className="h-5 w-5" />}
                >
                  <div className="space-y-3">
                    <div className="space-y-2">
                      {[...completedMatches].reverse().map((match) => renderMatchRow(match))}
                    </div>
                    <FPInsightsTab
                      evening={currentEvening}
                      shareCode={spectatorContext?.shareCode}
                      initialPlayerId={spectatorContext?.selectedPlayerId ?? null}
                      onSwitchPlayer={spectatorContext?.onSwitchPlayer}
                      isCompleted={currentEvening.completed}
                    />
                  </div>
                </CollapsibleSection>
              )}
            </div>
          </section>
        </main>
      </div>

      <SoccerNightBottomNav
        items={[
          { label: "קבוצה", icon: <Users className="h-5 w-5" />, onClick: onGoHome },
          { label: "שיתוף", icon: <Link className="h-5 w-5" />, onClick: handleShare, disabled: shareLoading || isViewOnly },
          { label: "טורניר", icon: <CircleDot className="h-7 w-7" />, onClick: () => scrollToSection("top"), active: true },
          { label: "דירוגים", icon: <BarChart3 className="h-5 w-5" />, onClick: () => scrollToSection("fp-standings") },
        ]}
      />

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="bg-[#05070A] border-[#26313D]" dir="rtl">
          {renderDrawerContent()}
        </DrawerContent>
      </Drawer>
    </div>
  );
};
