import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Home, Trophy, Users, Check, ChevronDown, Edit2, X, Save, ListOrdered, Share2, Copy, Eye, StopCircle } from "lucide-react";
import { FPEvening, FPTeamBank, FPMatch, FPPair, FPBlockTiming } from "@/types/fivePlayerTypes";
import { Club } from "@/types/tournament";
import { StarRating } from "@/components/StarRating";
import { calculatePairStats, calculatePlayerStats } from "@/services/fivePlayerEngine";
import { useToast } from "@/hooks/use-toast";
import { FPScheduleReorder } from "@/components/FPScheduleReorder";
import { RemoteStorageService } from "@/services/remoteStorageService";
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
  canSubmitNewScore?: boolean;
  canEditExistingResults?: boolean;
  canReorderSchedule?: boolean;
  isViewOnly?: boolean;
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
}: FPGameProps) => {
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

  // Reset state on match change
  useEffect(() => {
    if (!currentMatch) return;
    const hasClubA = currentMatch.clubA || null;
    const hasClubB = currentMatch.clubB || null;
    setSelectedClubA(hasClubA);
    setSelectedClubB(hasClubB);
    setScoreA(currentMatch.scoreA !== undefined ? String(currentMatch.scoreA) : '');
    setScoreB(currentMatch.scoreB !== undefined ? String(currentMatch.scoreB) : '');
    setScoreMode('quick');
    setWinnerChoice(null);
    setManualScoreSide(null);
    setShowSaved(false);
    if (hasClubA && hasClubB) {
      setActiveStep('score');
    } else if (hasClubA) {
      setActiveStep('teamB');
    } else {
      setActiveStep('teamA');
    }
  }, [currentEvening.currentMatchIndex]);

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
    let blockTimings = currentEvening.blockTimings ? [...currentEvening.blockTimings] : [];
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

    setShowSaved(true);
    setTimeout(() => {
      setCurrentEvening(updated);
      onUpdateEvening(updated);
      setSelectedClubA(null);
      setSelectedClubB(null);
      setScoreA('');
      setScoreB('');
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
        await RemoteStorageService.upsertEveningLiveWithTeam(currentEvening as any, null);
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

  if (!currentMatch) return null;

  const roundNum = currentMatch.roundIndex + 1;
  const matchInRound = currentMatch.matchIndex + 1;
  const totalMatches = currentEvening.schedule.length;

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
            {bank.clubs.map(club => {
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
                      : isUsed
                        ? 'border-border/20 bg-gaming-surface/20 opacity-30 pointer-events-none'
                        : canSubmitNewScore
                          ? 'border-border/40 bg-gaming-surface/80 cursor-pointer hover:border-neon-green/50 hover:bg-gaming-surface active:scale-[0.98]'
                          : 'border-border/40 bg-gaming-surface/40 opacity-60'
                      : isDisabled
                        ? 'border-border/20 bg-gaming-surface/20 opacity-40 cursor-not-allowed'
                        : 'border-border/40 bg-gaming-surface/80 cursor-pointer hover:border-neon-green/50 hover:bg-gaming-surface active:scale-[0.98]'
                  }`}
                  onClick={() => {
                    if (!isUsed && canSubmitNewScore) onSelect(club);
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

  return (
    <div className="min-h-[100svh] bg-gaming-bg p-3 pb-[max(1rem,env(safe-area-inset-bottom))]" dir="rtl">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-5 w-5 rotate-180" />
            </Button>
            <div>
              <h1 className="text-base font-bold text-foreground flex items-center gap-2">
                ליגת 5 שחקנים
                {isViewOnly && (
                  <Badge variant="outline" className="text-[10px] border-border/40 text-muted-foreground font-normal">
                    צפייה בלבד
                  </Badge>
                )}
              </h1>
              <p className="text-xs text-muted-foreground">
                סיבוב {roundNum} • משחק {matchInRound}/5 • סה״כ {currentEvening.currentMatchIndex + 1}/{totalMatches}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleShare}
              disabled={shareLoading}
              title="שתף קישור צפייה"
            >
              {shareCopied ? <Check className="h-4 w-4 text-neon-green" /> : shareCode ? <Eye className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
            </Button>
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

        {isViewOnly && (
          <Badge variant="outline" className="mb-2 text-xs">
            צפייה בלבד
          </Badge>
        )}

        <Tabs defaultValue="match" className="w-full">
          <TabsList className="w-full grid grid-cols-4 mb-2">
            <TabsTrigger value="match">משחק</TabsTrigger>
            <TabsTrigger value="schedule">
              <ListOrdered className="h-3.5 w-3.5 ml-1" />
              סדר
            </TabsTrigger>
            <TabsTrigger value="pairs">זוגות</TabsTrigger>
            <TabsTrigger value="players">שחקנים</TabsTrigger>
          </TabsList>

          <TabsContent value="match" className="space-y-2">
            {showSaved && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="bg-gaming-surface border border-neon-green/40 rounded-xl px-8 py-5 flex flex-col items-center gap-2 animate-in zoom-in-95 fade-in duration-300">
                  <Check className="h-10 w-10 text-neon-green" />
                  <span className="text-lg font-bold text-foreground">נשמר!</span>
                </div>
              </div>
            )}

            <Card className="bg-gaming-surface/50 border-border/50 p-2">
              <p className="text-center text-sm text-muted-foreground">
                יושב בחוץ: <strong className="text-foreground">{currentMatch.sittingOut.name}</strong>
              </p>
            </Card>

            <Card className="bg-gradient-card border-neon-green/20 p-3 shadow-card">
              <div className="text-center">
                <p className="text-base font-bold text-foreground">{pairName(currentMatch.pairA)}</p>
                <p className="text-xs text-muted-foreground my-0.5">vs</p>
                <p className="text-base font-bold text-foreground">{pairName(currentMatch.pairB)}</p>
              </div>
            </Card>

            {renderStepIndicator()}

            {renderTeamBank(
              bankA, selectedClubA, handleSelectClubA,
              `בנק ${pairName(currentMatch.pairA)}`, 'teamA'
            )}

            {renderTeamBank(
              bankB, selectedClubB, handleSelectClubB,
              `בנק ${pairName(currentMatch.pairB)}`, 'teamB'
            )}

            {renderScoreEntry()}

            <Button
              variant="gaming"
              className={`w-full transition-all duration-200 ${canSubmit && canSubmitNewScore ? 'scale-[1.02] shadow-lg shadow-neon-green/20' : ''}`}
              disabled={!canSubmit || !canSubmitNewScore}
              onClick={handleSubmitResult}
            >
              {currentEvening.currentMatchIndex + 1 >= totalMatches ? 'סיים ליגה' : 'שמור תוצאה ← הבא'}
            </Button>
          </TabsContent>

          <TabsContent value="schedule">
            <Card className="bg-gradient-card border-neon-green/20 p-3 shadow-card">
              {canReorderSchedule ? (
                <FPScheduleReorder
                  evening={currentEvening}
                  onUpdateEvening={(updated) => {
                    setCurrentEvening(updated);
                    onUpdateEvening(updated);
                  }}
                />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  סידור המשחקים זמין למנהל בלבד.
                </p>
              )}
              <FPScheduleReorder
                evening={currentEvening}
                canEditSchedule={canReorderSchedule}
                onUpdateEvening={(updated) => {
                  setCurrentEvening(updated);
                  onUpdateEvening(updated);
                }}
              />
            </Card>
          </TabsContent>

          <TabsContent value="pairs">
            <Card className="bg-gradient-card border-neon-green/20 p-3 shadow-card overflow-auto">
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-neon-green" /> טבלת זוגות
              </h3>
              <p className="text-[10px] text-muted-foreground mb-2">לחץ על זוג לפרטי משחקים</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right text-xs">#</TableHead>
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
                  {pairStats.map((s, idx) => (
                    <TableRow
                      key={s.pair.id}
                      className="cursor-pointer hover:bg-gaming-surface/30 transition-colors"
                      onClick={() => openPairDetails(s.pair.id)}
                    >
                      <TableCell className="text-xs">{idx + 1}</TableCell>
                      <TableCell className="text-xs font-medium whitespace-nowrap">
                        {s.pair.players[0].name} & {s.pair.players[1].name}
                      </TableCell>
                      <TableCell className="text-center text-xs">{s.played}</TableCell>
                      <TableCell className="text-center text-xs">{s.wins}</TableCell>
                      <TableCell className="text-center text-xs">{s.draws}</TableCell>
                      <TableCell className="text-center text-xs">{s.losses}</TableCell>
                      <TableCell className="text-center text-xs">{s.goalDiff > 0 ? '+' : ''}{s.goalDiff}</TableCell>
                      <TableCell className="text-center text-xs font-bold text-neon-green">{s.points}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="players">
            <Card className="bg-gradient-card border-neon-green/20 p-3 shadow-card overflow-auto">
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <Users className="h-4 w-4 text-neon-green" /> טבלת שחקנים
              </h3>
              <p className="text-[10px] text-muted-foreground mb-2">לחץ על שחקן לפרטי משחקים</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right text-xs">#</TableHead>
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
                  {playerStats.map((s, idx) => (
                    <TableRow
                      key={s.player.id}
                      className="cursor-pointer hover:bg-gaming-surface/30 transition-colors"
                      onClick={() => openPlayerDetails(s.player.id)}
                    >
                      <TableCell className="text-xs">{idx + 1}</TableCell>
                      <TableCell className="text-xs font-medium">{s.player.name}</TableCell>
                      <TableCell className="text-center text-xs">{s.played}</TableCell>
                      <TableCell className="text-center text-xs">{s.wins}</TableCell>
                      <TableCell className="text-center text-xs">{s.draws}</TableCell>
                      <TableCell className="text-center text-xs">{s.losses}</TableCell>
                      <TableCell className="text-center text-xs">{s.goalDiff > 0 ? '+' : ''}{s.goalDiff}</TableCell>
                      <TableCell className="text-center text-xs font-bold text-neon-green">{s.points}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Details Drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="bg-gaming-bg border-border" dir="rtl">
          {renderDrawerContent()}
        </DrawerContent>
      </Drawer>
    </div>
  );
};
