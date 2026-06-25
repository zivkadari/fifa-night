import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Copy, Check, Play, Edit2, ArrowLeftRight, X, AlertCircle, GripVertical, UserRound, ChevronDown, CalendarDays } from "lucide-react";
import { FPEvening, FPTeamBank, FPPair } from "@/types/fivePlayerTypes";
import { Club } from "@/types/tournament";
import { StarRating, starText } from "@/components/StarRating";
import { PlayerPair } from "@/components/PlayerPair";
import { TeamVisual } from "@/components/TeamVisual";
import { useToast } from "@/hooks/use-toast";
import { sortClubsByStarsDesc } from "@/lib/sortClubs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface FPBankOverviewProps {
  evening: FPEvening;
  allClubs: Club[];
  onContinue: () => void;
  onBack: () => void;
  onUpdateEvening: (evening: FPEvening) => void;
}

interface SortableMatchRowProps {
  match: FPEvening["schedule"][number];
  index: number;
  pairName: (pair: FPPair) => string;
}

const SortableMatchRow = ({ match, index, pairName }: SortableMatchRowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: match.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 text-xs bg-gaming-surface/50 border border-border/30 rounded-md p-2 ${
        isDragging ? "opacity-70 border-neon-green/60 shadow-lg" : ""
      }`}
    >
      <button
        type="button"
        className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-gaming-surface active:scale-95 touch-none"
        {...attributes}
        {...listeners}
        aria-label="גרור לשינוי סדר"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <span className="text-muted-foreground font-mono w-5 shrink-0">
        {index + 1}.
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-foreground font-medium">
            {pairName(match.pairA)}
          </span>
          <span className="text-muted-foreground">vs</span>
          <span className="text-foreground font-medium">
            {pairName(match.pairB)}
          </span>
        </div>

        <Badge
          variant="outline"
          className="gap-1 text-[10px] px-1.5 py-0 mt-1 border-muted-foreground/30 text-muted-foreground"
        >
          <UserRound className="h-3 w-3" aria-hidden="true" />
          {match.sittingOut.name}
        </Badge>
      </div>
    </div>
  );
};

export const FPBankOverview = ({ evening, allClubs, onContinue, onBack, onUpdateEvening }: FPBankOverviewProps) => {
  const { toast } = useToast();
  const [copiedAll, setCopiedAll] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 180,
        tolerance: 8,
      },
    })
  );

  // Edit state
  const [editingPairId, setEditingPairId] = useState<string | null>(null);
  const [editingClubIdx, setEditingClubIdx] = useState<number | null>(null);
  const [editMode, setEditMode] = useState<'replace' | 'swap' | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const pairName = (pair: FPPair) =>
    `${pair.players[0].name} & ${pair.players[1].name}`;
  
  const handleScheduleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
  
    if (!over || active.id === over.id) return;
  
    const firstCycleLength = Math.min(15, evening.schedule.length);
    const firstCycleIds = evening.schedule
      .slice(0, firstCycleLength)
      .map(match => match.id);
  
    const oldIndex = firstCycleIds.indexOf(String(active.id));
    const newIndex = firstCycleIds.indexOf(String(over.id));
  
    if (oldIndex < 0 || newIndex < 0) return;
  
    const firstCycle = evening.schedule.slice(0, firstCycleLength);
    const reorderedFirstCycle = arrayMove(firstCycle, oldIndex, newIndex).map((match, index) => ({
      ...match,
      globalIndex: index,
      roundIndex: Math.floor(index / 5),
      matchIndex: index % 5,
    }));
  
    const updatedSchedule = [...evening.schedule];
  
    reorderedFirstCycle.forEach((match, index) => {
      updatedSchedule[index] = match;
    });
  
    // For 30-match tournaments, keep cycle 2 aligned with the edited first cycle.
    if (evening.matchCount !== 15 && updatedSchedule.length > 15) {
      for (let i = 0; i < firstCycleLength; i += 1) {
        const source = updatedSchedule[i];
        const targetIndex = i + 15;
        const existingSecondCycleMatch = updatedSchedule[targetIndex];
  
        if (!existingSecondCycleMatch) continue;
  
        updatedSchedule[targetIndex] = {
          ...source,
          id: existingSecondCycleMatch.id,
          globalIndex: targetIndex,
          roundIndex: Math.floor(targetIndex / 5),
          matchIndex: targetIndex % 5,
          completed: existingSecondCycleMatch.completed,
          scoreA: existingSecondCycleMatch.scoreA,
          scoreB: existingSecondCycleMatch.scoreB,
          clubA: existingSecondCycleMatch.clubA,
          clubB: existingSecondCycleMatch.clubB,
        };
      }
    }
  
    onUpdateEvening({
      ...evening,
      schedule: updatedSchedule,
      setupOptions: {
        ...evening.setupOptions,
        scheduleManuallyReordered: true,
      },
    });
  
    toast({ title: "סדר המשחקים עודכן" });
  };
  
  const renderStars = (stars: number) => <StarRating stars={stars} size="xs" />;
  const renderStarsText = (stars: number) => starText(stars);

  // --- First cycle = matches 0-14 (15 matches) ---
  const firstCycle = evening.schedule.filter(m => m.globalIndex < 15);

  const formatMatchOrder = () => {
    return firstCycle.map((m, i) => {
      const sitting = m.sittingOut.name;
      return `${i + 1}. ${pairName(m.pairA)} vs ${pairName(m.pairB)}  יושב בחוץ: ${sitting}`;
    }).join('\n');
  };

  // --- Format helpers ---
  const formatPairBank = (pair: FPPair, bank: FPTeamBank) => {
    const lines = [`*${pair.players[0].name} & ${pair.players[1].name}*`];
    sortClubsByStarsDesc(bank.clubs).forEach(club => {
      lines.push(club.name);
    });
    return lines.join('\n');
  };

  const formatAllBanks = () => {
    const matchOrder = `📋 *סדר משחקים (מחזור 1 מתוך 2)*\n${formatMatchOrder()}`;
    const sections = evening.pairs.map(pair => {
      const bank = evening.teamBanks.find(b => b.pairId === pair.id);
      if (!bank) return '';
      return formatPairBank(pair, bank);
    });
    return `🏆 *5 Player League*\n${evening.players.map(p => p.name).join(', ')}\n\n${matchOrder}\n\n${sections.join('\n\n')}`;
  };

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(formatAllBanks());
      setCopiedAll(true);
      toast({ title: "הועתק בהצלחה!" });
      setTimeout(() => setCopiedAll(false), 1500);
    } catch {
      toast({ title: "שגיאה בהעתקה", variant: "destructive" });
    }
  };

  // --- Validation helpers ---
  const getGlobalClubCount = (clubId: string, excludePairId?: string, excludeClubIdx?: number): number => {
    let count = 0;
    for (const bank of evening.teamBanks) {
      for (let i = 0; i < bank.clubs.length; i++) {
        if (bank.clubs[i].id === clubId) {
          if (bank.pairId === excludePairId && i === excludeClubIdx) continue;
          count++;
        }
      }
    }
    return count;
  };

  const getPlayerClubIds = (playerId: string, excludePairId?: string, excludeClubIdx?: number): Set<string> => {
    const ids = new Set<string>();
    for (const pair of evening.pairs) {
      if (!pair.players.some(p => p.id === playerId)) continue;
      const bank = evening.teamBanks.find(b => b.pairId === pair.id);
      if (!bank) continue;
      for (let i = 0; i < bank.clubs.length; i++) {
        if (pair.id === excludePairId && i === excludeClubIdx) continue;
        ids.add(bank.clubs[i].id);
      }
    }
    return ids;
  };

  const getMaxAppearancesForTier = (stars: number): number => {
    if (stars === 5) return 2;
    return 1;
  };

  const validateReplacement = (pairId: string, clubIdx: number, newClub: Club): string | null => {
    const bank = evening.teamBanks.find(b => b.pairId === pairId)!;
    const oldClub = bank.clubs[clubIdx];
    const pair = evening.pairs.find(p => p.id === pairId)!;

    // Must be same star tier
    if (newClub.stars !== oldClub.stars) {
      return `הקבוצה חייבת להיות ${oldClub.stars} כוכבים (הקבוצה שנבחרה היא ${newClub.stars} כוכבים)`;
    }

    // Check not already in this bank
    if (bank.clubs.some((c, i) => i !== clubIdx && c.id === newClub.id)) {
      return 'הקבוצה כבר קיימת בבנק הזה';
    }

    // Player-level no-repeat
    for (const p of pair.players) {
      const playerClubs = getPlayerClubIds(p.id, pairId, clubIdx);
      if (playerClubs.has(newClub.id)) {
        return `${p.name} כבר מקבל/ת את הקבוצה הזו בזוג אחר`;
      }
    }

    // Global max appearances
    const maxApp = getMaxAppearancesForTier(newClub.stars);
    const currentCount = getGlobalClubCount(newClub.id, pairId, clubIdx);
    if (currentCount >= maxApp) {
      return `הקבוצה כבר מופיעה ${currentCount} פעמים (מקסימום ${maxApp})`;
    }

    return null;
  };

  const validateSwap = (
    pairId1: string, clubIdx1: number,
    pairId2: string, clubIdx2: number
  ): string | null => {
    const bank1 = evening.teamBanks.find(b => b.pairId === pairId1)!;
    const bank2 = evening.teamBanks.find(b => b.pairId === pairId2)!;
    const club1 = bank1.clubs[clubIdx1];
    const club2 = bank2.clubs[clubIdx2];
    const pair1 = evening.pairs.find(p => p.id === pairId1)!;
    const pair2 = evening.pairs.find(p => p.id === pairId2)!;

    // Must be same star tier
    if (club1.stars !== club2.stars) {
      return 'ניתן להחליף רק בין קבוצות מאותו דירוג כוכבים';
    }

    // Check club2 not already in bank1 (excluding the slot being swapped)
    if (bank1.clubs.some((c, i) => i !== clubIdx1 && c.id === club2.id)) {
      return `${club2.name} כבר קיימת בבנק של ${pairName(pair1)}`;
    }
    if (bank2.clubs.some((c, i) => i !== clubIdx2 && c.id === club1.id)) {
      return `${club1.name} כבר קיימת בבנק של ${pairName(pair2)}`;
    }

    // Player-level no-repeat for pair1 getting club2
    for (const p of pair1.players) {
      const playerClubs = getPlayerClubIds(p.id, pairId1, clubIdx1);
      // Also exclude the swap source
      if (pair2.players.some(pp => pp.id === p.id)) {
        // shared player - need to also exclude clubIdx2 from pair2
        playerClubs.delete(club2.id); // will be removed from pair2
      }
      if (playerClubs.has(club2.id)) {
        return `${p.name} כבר מקבל/ת את ${club2.name} בזוג אחר`;
      }
    }

    // Player-level no-repeat for pair2 getting club1
    for (const p of pair2.players) {
      const playerClubs = getPlayerClubIds(p.id, pairId2, clubIdx2);
      if (pair1.players.some(pp => pp.id === p.id)) {
        playerClubs.delete(club1.id);
      }
      if (playerClubs.has(club1.id)) {
        return `${p.name} כבר מקבל/ת את ${club1.name} בזוג אחר`;
      }
    }

    return null;
  };

  // --- Actions ---
  const handleReplace = (newClub: Club) => {
    if (editingPairId === null || editingClubIdx === null) return;
    const error = validateReplacement(editingPairId, editingClubIdx, newClub);
    if (error) {
      setValidationError(error);
      return;
    }

    const updatedBanks = evening.teamBanks.map(bank => {
      if (bank.pairId !== editingPairId) return bank;
      const newClubs = [...bank.clubs];
      newClubs[editingClubIdx] = newClub;
      return { ...bank, clubs: newClubs };
    });

    const updated = { ...evening, teamBanks: updatedBanks };
    onUpdateEvening(updated);
    closeEdit();
    toast({ title: "הקבוצה הוחלפה בהצלחה" });
  };

  const handleSwap = (targetPairId: string, targetClubIdx: number) => {
    if (editingPairId === null || editingClubIdx === null) return;
    const error = validateSwap(editingPairId, editingClubIdx, targetPairId, targetClubIdx);
    if (error) {
      setValidationError(error);
      return;
    }

    const bank1 = evening.teamBanks.find(b => b.pairId === editingPairId)!;
    const bank2 = evening.teamBanks.find(b => b.pairId === targetPairId)!;
    const club1 = bank1.clubs[editingClubIdx];
    const club2 = bank2.clubs[targetClubIdx];

    const updatedBanks = evening.teamBanks.map(bank => {
      if (bank.pairId === editingPairId) {
        const newClubs = [...bank.clubs];
        newClubs[editingClubIdx] = club2;
        return { ...bank, clubs: newClubs };
      }
      if (bank.pairId === targetPairId) {
        const newClubs = [...bank.clubs];
        newClubs[targetClubIdx] = club1;
        return { ...bank, clubs: newClubs };
      }
      return bank;
    });

    const updated = { ...evening, teamBanks: updatedBanks };
    onUpdateEvening(updated);
    closeEdit();
    toast({ title: "הקבוצות הוחלפו בהצלחה" });
  };

  const openEdit = (pairId: string, clubIdx: number) => {
    setEditingPairId(pairId);
    setEditingClubIdx(clubIdx);
    setEditMode(null);
    setValidationError(null);
  };

  const closeEdit = () => {
    setEditingPairId(null);
    setEditingClubIdx(null);
    setEditMode(null);
    setValidationError(null);
  };

  // Get replacement candidates for the current editing context
  const getReplacementCandidates = (): Club[] => {
    if (editingPairId === null || editingClubIdx === null) return [];
    const bank = evening.teamBanks.find(b => b.pairId === editingPairId)!;
    const oldClub = bank.clubs[editingClubIdx];
    const tier = oldClub.stars;

    return allClubs
      .filter(c => c.stars === tier && !c.isPrime && c.id !== oldClub.id)
      .map(c => {
        const error = validateReplacement(editingPairId, editingClubIdx, c);
        return { club: c, error };
      })
      .sort((a, b) => {
        // Valid first, then alphabetical
        if (!a.error && b.error) return -1;
        if (a.error && !b.error) return 1;
        return a.club.name.localeCompare(b.club.name);
      })
      .map(({ club }) => club);
  };

  // Get swap targets from other pairs
  const getSwapTargets = (): { pairId: string; pairLabel: string; clubIdx: number; club: Club; error: string | null }[] => {
    if (editingPairId === null || editingClubIdx === null) return [];
    const bank = evening.teamBanks.find(b => b.pairId === editingPairId)!;
    const oldClub = bank.clubs[editingClubIdx];
    const tier = oldClub.stars;
    const targets: { pairId: string; pairLabel: string; clubIdx: number; club: Club; error: string | null }[] = [];

    for (const otherBank of evening.teamBanks) {
      if (otherBank.pairId === editingPairId) continue;
      const otherPair = evening.pairs.find(p => p.id === otherBank.pairId)!;
      for (let i = 0; i < otherBank.clubs.length; i++) {
        if (otherBank.clubs[i].stars !== tier) continue;
        const error = validateSwap(editingPairId, editingClubIdx, otherBank.pairId, i);
        targets.push({
          pairId: otherBank.pairId,
          pairLabel: pairName(otherPair),
          clubIdx: i,
          club: otherBank.clubs[i],
          error,
        });
      }
    }

    // Valid first
    targets.sort((a, b) => {
      if (!a.error && b.error) return -1;
      if (a.error && !b.error) return 1;
      return a.club.name.localeCompare(b.club.name);
    });

    return targets;
  };

  const editingBank = editingPairId ? evening.teamBanks.find(b => b.pairId === editingPairId) : null;
  const editingClub = editingBank && editingClubIdx !== null ? editingBank.clubs[editingClubIdx] : null;
  const editingPair = editingPairId ? evening.pairs.find(p => p.id === editingPairId) : null;

  return (
    <div id="bank-top" className="min-h-[100dvh] bg-gaming-bg px-4 pb-[calc(5.75rem+env(safe-area-inset-bottom))] pt-3 sm:px-3" dir="rtl">
      <div className="mx-auto w-full space-y-3 sm:max-w-md">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5 rotate-180" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-foreground">סקירת בנקים</h1>
            <p className="truncate text-xs text-muted-foreground">
              {evening.players.map(p => p.name).join(', ')}
            </p>
          </div>
        </div>

        <Card className="overflow-hidden border-border/40 bg-gradient-card shadow-card">
          <button
            type="button"
            className="flex min-h-14 w-full items-center justify-between gap-3 px-3 py-2 text-right"
            onClick={() => setOpenSection(openSection === "schedule" ? null : "schedule")}
          >
            <span className="flex min-w-0 items-center gap-2">
              <CalendarDays className="h-4 w-4 shrink-0 text-neon-green" />
              <span className="font-semibold text-foreground">סדר משחקים</span>
            </span>
            <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
              {evening.schedule.length} משחקים
              <ChevronDown className={`h-4 w-4 transition-transform ${openSection === "schedule" ? "rotate-180" : ""}`} />
            </span>
          </button>
          {openSection === "schedule" && (
            <div className="border-t border-border/40 p-3">
              <p className="mb-2 text-[11px] text-muted-foreground">
                החזק וגרור משחק כדי לשנות את הסדר לפני תחילת הליגה
              </p>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleScheduleDragEnd}>
                <SortableContext items={firstCycle.map(match => match.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-1.5">
                    {firstCycle.map((match, index) => (
                      <SortableMatchRow key={match.id} match={match} index={index} pairName={pairName} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}
        </Card>

        {evening.pairs.map((pair) => {
          const bank = evening.teamBanks.find(b => b.pairId === pair.id);
          if (!bank) return null;
          const isOpen = openSection === pair.id;
          const sortedClubs = bank.clubs
            .map((club, originalIdx) => ({ club, originalIdx }))
            .sort((a, b) => {
              if (b.club.stars !== a.club.stars) return b.club.stars - a.club.stars;
              return a.club.name.localeCompare(b.club.name);
            });

          return (
            <Card key={pair.id} className="overflow-hidden border-border/40 bg-gradient-card shadow-card">
              <button
                type="button"
                className="grid min-h-16 w-full grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2 text-right"
                onClick={() => setOpenSection(isOpen ? null : pair.id)}
              >
                <PlayerPair players={pair.players} size="sm" showNames={false} />
                <span className="min-w-0">
                  <span className="block break-words text-sm font-semibold leading-tight text-foreground">{pairName(pair)}</span>
                  <span className="mt-1 block font-mono text-xs text-neon-green">{bank.clubs.length}/{bank.clubs.length} קבוצות</span>
                </span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="grid grid-cols-3 gap-2 border-t border-border/40 p-3">
                  {sortedClubs.map(({ club, originalIdx }) => (
                    <button
                      key={`${club.id}-${originalIdx}`}
                      type="button"
                      className="rounded-lg border border-border/30 bg-gaming-surface/60 p-2 text-center transition-colors hover:border-neon-green/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-green"
                      onClick={() => openEdit(pair.id, originalIdx)}
                      aria-label={`עריכת ${club.name}`}
                    >
                      <TeamVisual club={club} size="sm" />
                    </button>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-border/50 bg-gaming-bg/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur supports-[backdrop-filter]:bg-gaming-bg/88">
        <div className="mx-auto grid w-full grid-cols-[1fr_minmax(9rem,1.35fr)_1fr] items-center gap-2 sm:max-w-md" dir="rtl">
          <Button variant="outline" className="h-12 border-border/50 bg-gaming-surface/70" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 rotate-180" />
            חזרה
          </Button>
          <Button variant="gaming" className="h-12 rounded-xl text-base font-black shadow-[0_0_22px_rgba(57,255,136,0.32)]" onClick={onContinue}>
            <Play className="h-5 w-5" />
            התחל טורניר
          </Button>
          <Button variant="outline" className="h-12 border-neon-green/30 bg-gaming-surface/70" onClick={handleCopyAll}>
            {copiedAll ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            העתק הכל
          </Button>
        </div>
      </footer>

      {/* Edit Dialog */}
      <Dialog open={!!editingPairId} onOpenChange={(open) => { if (!open) closeEdit(); }}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base">
              {editMode === 'replace' ? 'החלף קבוצה' : editMode === 'swap' ? 'החלף עם זוג אחר' : 'עריכת קבוצה'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editingPair && editingClub && (
                <span>{pairName(editingPair)} · {editingClub.name} ({renderStars(editingClub.stars)})</span>
              )}
            </DialogDescription>
          </DialogHeader>

          {validationError && (
            <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-xs">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {!editMode && (
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => { setEditMode('replace'); setValidationError(null); }}
              >
                <Edit2 className="h-4 w-4" />
                החלף עם קבוצה אחרת
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => { setEditMode('swap'); setValidationError(null); }}
              >
                <ArrowLeftRight className="h-4 w-4" />
                החלף עם זוג אחר
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-muted-foreground"
                onClick={closeEdit}
              >
                <X className="h-4 w-4" />
                ביטול
              </Button>
            </div>
          )}

          {editMode === 'replace' && (
            <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
              <Button variant="ghost" size="sm" onClick={() => { setEditMode(null); setValidationError(null); }} className="text-xs mb-1">
                ← חזור
              </Button>
              {getReplacementCandidates().map(club => {
                const error = validateReplacement(editingPairId!, editingClubIdx!, club);
                return (
                  <button
                    key={club.id}
                    onClick={() => !error && handleReplace(club)}
                    disabled={!!error}
                    className={`w-full flex items-center justify-between p-2 rounded-md text-xs border transition-all ${
                      error
                        ? 'border-border/20 bg-gaming-surface/20 opacity-40 cursor-not-allowed'
                        : 'border-border/40 bg-gaming-surface/60 hover:border-neon-green/50 cursor-pointer active:scale-[0.98]'
                    }`}
                    title={error || undefined}
                  >
                    <span className="text-foreground">{club.name}</span>
                    <span className="text-yellow-400 text-[10px]">{renderStars(club.stars)}</span>
                  </button>
                );
              })}
            </div>
          )}

          {editMode === 'swap' && (
            <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
              <Button variant="ghost" size="sm" onClick={() => { setEditMode(null); setValidationError(null); }} className="text-xs mb-1">
                ← חזור
              </Button>
              {getSwapTargets().map((target, i) => (
                <button
                  key={`${target.pairId}-${target.clubIdx}-${i}`}
                  onClick={() => !target.error && handleSwap(target.pairId, target.clubIdx)}
                  disabled={!!target.error}
                  className={`w-full flex items-center justify-between p-2 rounded-md text-xs border transition-all ${
                    target.error
                      ? 'border-border/20 bg-gaming-surface/20 opacity-40 cursor-not-allowed'
                      : 'border-border/40 bg-gaming-surface/60 hover:border-neon-green/50 cursor-pointer active:scale-[0.98]'
                  }`}
                  title={target.error || undefined}
                >
                  <div className="flex flex-col items-start gap-0.5">
                    <span className="text-foreground">{target.club.name}</span>
                    <span className="text-muted-foreground text-[10px]">{target.pairLabel}</span>
                  </div>
                  <span className="text-yellow-400 text-[10px]">{renderStars(target.club.stars)}</span>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
