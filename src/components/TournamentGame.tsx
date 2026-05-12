import { useState, useEffect, useCallback } from "react";
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
  ChevronDown,
  ChevronRight,
  Home,
  Copy,
  RefreshCw,
  Share2,
  Pencil,
  Trash2,
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
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Evening, Round, Match, Pair, Club, PlayerStats } from "@/types/tournament";
import { SinglesGameComponent } from "@/components/SinglesGame";
import { DiceScoreInput } from "@/components/DiceScoreInput";
import { TournamentEngine } from "@/services/tournamentEngine";
import { fetchPoolConfigs, getPoolConfigForWins, PoolConfig } from "@/data/poolConfig";
import { TeamSelector } from "@/services/teamSelector";
import { useToast } from "@/hooks/use-toast";
import { RemoteStorageService } from "@/services/remoteStorageService";
import { ClubSwapDialog } from "@/components/ClubSwapDialog";
import { getClubsWithOverrides, FIFA_CLUBS } from "@/data/clubs";
import { VoiceResultEntry } from "@/components/VoiceResultEntry";
import { VoiceResultCandidate } from "@/lib/voiceResultParser";

interface TournamentGameProps {
  evening: Evening;
  onBack: () => void;
  onComplete: (evening: Evening) => void;
  onGoHome: () => void;
  onUpdateEvening: (evening: Evening) => void;
  onRoundModeSelection?: (nextRoundIndex: number) => void;
  canStopTournament?: boolean;
  onStopTournament?: () => void;
}

export const TournamentGame = ({ evening, onBack, onComplete, onGoHome, onUpdateEvening, onRoundModeSelection, canStopTournament, onStopTournament }: TournamentGameProps) => {
  // If this is a singles tournament, use the singles component
  if (evening.type === 'singles') {
    return (
      <SinglesGameComponent
        evening={evening}
        onBack={onBack}
        onComplete={onComplete}
        onGoHome={onGoHome}
        onUpdateEvening={onUpdateEvening}
        canStopTournament={canStopTournament}
        onStopTournament={onStopTournament}
      />
    );
  }

  // Continue with pairs tournament logic
  const { toast } = useToast();
  const [currentEvening, setCurrentEvening] = useState(evening);
  const [currentRound, setCurrentRound] = useState(0);
  const [currentMatch, setCurrentMatch] = useState<Match | null>(null);
  const [currentRoundPairs, setCurrentRoundPairs] = useState<Pair[]>([]); // Store pairs for current round
  const [originalTeamPools, setOriginalTeamPools] = useState<[Club[], Club[]]>([[], []]); // Keep original pools for the round
  const [teamPools, setTeamPools] = useState<[Club[], Club[]]>([[], []]);
  const [selectedClubs, setSelectedClubs] = useState<[Club | null, Club | null]>([null, null]);
  const [usedClubCounts, setUsedClubCounts] = useState<Record<string, number>>({});
  // Track consumed club allocations this round as an array (supports duplicate IDs for recycled clubs)
  const [consumedClubIdsThisRound, setConsumedClubIdsThisRound] = useState<string[]>([]);
  const [recycledClubIds, setRecycledClubIds] = useState<Set<string>>(new Set()); // Track clubs that were recycled (reused because star rating exhausted)

  /**
   * Allocation-aware pool filter: removes only consumed allocation instances, not all occurrences of a club ID.
   * If a club appears N times in the pool (due to recycling) and was consumed M times, N-M instances remain.
   */
  const filterPoolByAllocations = (pool: Club[], consumedIds: string[], extraExcludeId?: string): Club[] => {
    // Count how many times each club ID was consumed
    const consumedCounts = new Map<string, number>();
    consumedIds.forEach(id => consumedCounts.set(id, (consumedCounts.get(id) || 0) + 1));

    // Track how many instances of each club ID we've already emitted
    const emittedCounts = new Map<string, number>();
    
    // Count how many times each club ID appears in the pool (total allocations)
    const poolCounts = new Map<string, number>();
    pool.forEach(c => poolCounts.set(c.id, (poolCounts.get(c.id) || 0) + 1));

    return pool.filter(club => {
      if (extraExcludeId && club.id === extraExcludeId) return false;
      
      const totalAllocations = poolCounts.get(club.id) || 0;
      const consumed = consumedCounts.get(club.id) || 0;
      const remaining = totalAllocations - consumed;
      const emitted = emittedCounts.get(club.id) || 0;

      if (emitted < remaining) {
        emittedCounts.set(club.id, emitted + 1);
        return true;
      }
      return false;
    });
  };
  const [gamePhase, setGamePhase] = useState<'team-selection' | 'countdown' | 'result-entry'>('team-selection');
  const [countdown, setCountdown] = useState(60);
  const [isCountdownActive, setIsCountdownActive] = useState(false);
  const [showRoundWinnerDialog, setShowRoundWinnerDialog] = useState(false);
  const [roundWinnerMessage, setRoundWinnerMessage] = useState('');
  // Use the evening's persistent pair schedule to ensure teams don't change
  const pairSchedule = currentEvening.pairSchedule ?? TournamentEngine.generatePairs(evening.players);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [showShareCodeDialog, setShowShareCodeDialog] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<string | undefined>("");
  const [expandedPlayerIds, setExpandedPlayerIds] = useState<Set<string>>(new Set());
  const [showRankings, setShowRankings] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [editScore1, setEditScore1] = useState(0);
  const [editScore2, setEditScore2] = useState(0);
  
  // Club swap dialog state
  const [showSwapDialog, setShowSwapDialog] = useState(false);
  const [clubToSwap, setClubToSwap] = useState<{ club: Club; pairIndex: 0 | 1; clubIndex: number } | null>(null);
  
  // Clubs with overrides from database
  const [clubsWithOverrides, setClubsWithOverrides] = useState<Club[]>(FIFA_CLUBS);
  const [overridesLoaded, setOverridesLoaded] = useState(false);

  // Helper function to get current star rating from database overrides
  const getDisplayStars = (club: Club): number => {
    const override = clubsWithOverrides.find(c => c.id === club.id);
    return override?.stars ?? club.stars;
  };

  // Sync local state when the parent evening prop changes (e.g. after resume/hydration)
  useEffect(() => {
    setCurrentEvening(evening);
  }, [evening]);

  // Persist evening state to avoid losing teams when navigating
  useEffect(() => {
    const saveCurrentState = () => {
      if (currentEvening && !currentEvening.completed) {
        onUpdateEvening(currentEvening);
      }
    };
    saveCurrentState();
  }, [currentEvening, onUpdateEvening]);

  // Fetch share code for sharing via WhatsApp
  useEffect(() => {
    const fetchShareCode = async () => {
      const code = await RemoteStorageService.getShareCode(currentEvening.id);
      setShareCode(code);
    };
    fetchShareCode();
  }, [currentEvening.id]);

  // Generate WhatsApp share link
  const shareViaWhatsApp = () => {
    if (!shareCode) {
      toast({ title: "טוען קוד שיתוף...", description: "נסה שוב בעוד רגע" });
      return;
    }
    const appUrl = window.location.origin;
    const spectateUrl = `${appUrl}/spectate/${shareCode}`;
    const message = `🎮 צפו בטורניר שלנו בשידור חי!\n\n${spectateUrl}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  // Load clubs with database overrides on mount
  useEffect(() => {
    getClubsWithOverrides().then(clubs => {
      setClubsWithOverrides(clubs);
      setOverridesLoaded(true);
    });
  }, []);

  // Initialize first round (wait for overrides to load from database)
  useEffect(() => {
    if (!overridesLoaded) return;

    if (process.env.NODE_ENV !== 'production') {
      console.log('[DEV] TournamentGame init', {
        eveningId: currentEvening.id,
        roundsCount: currentEvening.rounds.length,
        rounds: currentEvening.rounds.map((r, i) => ({
          index: i,
          completed: r.completed,
          matchCount: r.matches.length,
          completedMatches: r.matches.filter(m => m.completed).length,
          pairScores: r.pairScores,
          hasTeamPools: !!(r.teamPools && r.teamPools[0]?.length),
        })),
      });
    }

    if (currentEvening.rounds.length === 0) {
      startNextRound(0);
    } else {
      // Find the correct round to resume:
      // 1. First, check if any round is explicitly not completed
      // 2. Also verify by checking if a "completed" round actually has all wins scored
      let activeRoundIndex = -1;
      for (let i = 0; i < currentEvening.rounds.length; i++) {
        const r = currentEvening.rounds[i];
        const isActuallyComplete = r.completed || TournamentEngine.isRoundComplete(r, currentEvening.winsToComplete);
        if (!isActuallyComplete) {
          activeRoundIndex = i;
          break;
        }
        // Mark completed if not already
        if (!r.completed && isActuallyComplete) {
          r.completed = true;
        }
      }
      
      if (activeRoundIndex >= 0) {
        setCurrentRound(activeRoundIndex);
        loadCurrentRound(activeRoundIndex);
      } else {
        // All existing rounds are complete. Check if we need to start a new round.
        const lastRoundIndex = currentEvening.rounds.length - 1;
        if (lastRoundIndex < 2) {
          // Need to start next round
          const nextIdx = lastRoundIndex + 1;
          setCurrentRound(nextIdx);
          startNextRound(nextIdx);
        } else {
          // Tournament should be complete
          setCurrentRound(lastRoundIndex);
          loadCurrentRound(lastRoundIndex);
        }
      }
    }
  }, [overridesLoaded]);

  // Countdown timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCountdownActive && countdown > 0) {
      interval = setInterval(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    } else if (countdown === 0) {
      setIsCountdownActive(false);
      setGamePhase('result-entry');
    }
    return () => clearInterval(interval);
  }, [isCountdownActive, countdown]);

  const startNextRound = async (targetRoundIndex?: number) => {
    const roundIndex = targetRoundIndex ?? currentRound;
    const roundNumber = roundIndex + 1;
    const roundPairs = pairSchedule[roundIndex];
    
    if (!roundPairs) {
      // Tournament complete
      completeEvening();
      return;
    }

    // Store the pairs for this round
    setCurrentRoundPairs(roundPairs);

    const newRound = TournamentEngine.createRound(roundNumber, roundPairs, currentEvening.winsToComplete);
    
    // Create first match immediately and persist it to the round so selection survives navigation
    const firstMatch = TournamentEngine.createNextMatch(newRound, roundPairs);
    const roundWithMatch = { ...newRound, matches: [firstMatch] };

    const updatedEvening = {
      ...currentEvening,
      rounds: [...currentEvening.rounds, roundWithMatch]
    };
    setCurrentEvening(updatedEvening);
    onUpdateEvening(updatedEvening);
    
    // Generate team pools for the entire round, excluding clubs that were ACTUALLY PLAYED this evening
    // Note: We only exclude clubs from usedClubCounts (clubs that were selected and played),
    // NOT clubs that were just in a pool but never selected
    const teamSelector = new TeamSelector(clubsWithOverrides);
    const maxMatches = currentEvening.winsToComplete * 2 - 1;
    console.log('Generating pools for round with maxMatches:', maxMatches);
    const actuallyPlayedClubIds = Object.keys(usedClubCounts).filter(id => (usedClubCounts[id] ?? 0) >= 1);
    const poolConfigs = await fetchPoolConfigs();
    const poolConfig = getPoolConfigForWins(poolConfigs, currentEvening.winsToComplete);
    const poolResult = poolConfig
      ? teamSelector.generateTeamPoolsFromConfig(roundPairs, poolConfig, actuallyPlayedClubIds)
      : teamSelector.generateTeamPools(roundPairs, actuallyPlayedClubIds, maxMatches);
    // DEV diagnostics: verify no cross-pool duplicates
    if (process.env.NODE_ENV !== 'production') {
      const ids0 = new Set(poolResult.pools[0].map(c => c.id));
      const ids1 = new Set(poolResult.pools[1].map(c => c.id));
      const duplicates = [...ids0].filter(id => ids1.has(id));
      console.log('[DEV] startNextRound pool generation', {
        roundIndex: roundIndex,
        pair0_clubs: poolResult.pools[0].map(c => `${c.name}(${c.stars}★)`),
        pair1_clubs: poolResult.pools[1].map(c => `${c.name}(${c.stars}★)`),
        recycled: Array.from(poolResult.recycledClubIds),
        duplicatesAcrossPools: duplicates,
      });
      if (duplicates.length > 0) {
        console.error('[DEV] ERROR: Duplicate clubs across pools!', duplicates);
      }
    }
    setRecycledClubIds(poolResult.recycledClubIds);

    // Persist pools and recycled club IDs on the round so they don't change on navigation
    const updatedEveningWithPools: Evening = {
      ...updatedEvening,
      rounds: [
        ...updatedEvening.rounds.slice(0, updatedEvening.rounds.length - 1),
        { 
          ...updatedEvening.rounds[updatedEvening.rounds.length - 1], 
          teamPools: [poolResult.pools[0], poolResult.pools[1]],
          recycledClubIds: Array.from(poolResult.recycledClubIds)
        },
      ],
    };
    setCurrentEvening(updatedEveningWithPools);
    onUpdateEvening(updatedEveningWithPools);

    setOriginalTeamPools([poolResult.pools[0], poolResult.pools[1]]);
    setTeamPools([poolResult.pools[0], poolResult.pools[1]]);
    
    // Reset game state for new round
    setSelectedClubs([null, null]);
    setGamePhase('team-selection');
    setConsumedClubIdsThisRound([]);
    
    // Start first match
    setCurrentMatch(firstMatch);
  };

  const createNextMatch = async (evening: Evening, roundIndex: number, pairs?: Pair[]) => {
    // Use stored round pairs if pairs not provided
    const roundPairs = pairs || currentRoundPairs;
    const round = evening.rounds[roundIndex];
    
    // Check if round is complete or tied
    if (TournamentEngine.isRoundComplete(round, evening.winsToComplete)) {
      if (TournamentEngine.isRoundTied(round, evening.winsToComplete)) {
        // Create decider match
        const deciderMatch = TournamentEngine.createDeciderMatch(round, roundPairs);
        setCurrentMatch(deciderMatch);

        // For decider, don't pre-generate pools. We'll draw balanced teams via button.
        setTeamPools([[], []]);

        toast({
          title: "Sudden Death!",
          description: `Tied at ${evening.winsToComplete}-${evening.winsToComplete}. Tap \"Draw Balanced Teams\" to start the decider.`,
        });

        // Mark round as decider and append the decider match so it persists
        const updatedRound = { ...round, isDeciderMatch: true, matches: [...round.matches, deciderMatch] };
        const updatedEvening = {
          ...evening,
          rounds: [
            ...evening.rounds.slice(0, roundIndex),
            updatedRound,
            ...evening.rounds.slice(roundIndex + 1)
          ]
        };
        setCurrentEvening(updatedEvening);
        onUpdateEvening(updatedEvening);
      } else {
        // Round complete, move to next round
        handleRoundComplete();
      }
    } else {
      // Create next regular match
      const nextMatch = TournamentEngine.createNextMatch(round, roundPairs);
      setCurrentMatch(nextMatch);

      // Persist the new in-progress match so selections survive navigation
      const updatedRoundPersist = { ...round, matches: [...round.matches, nextMatch] };
      const updatedEveningPersist = {
        ...evening,
        rounds: [
          ...evening.rounds.slice(0, roundIndex),
          updatedRoundPersist,
          ...evening.rounds.slice(roundIndex + 1)
        ]
      };
      setCurrentEvening(updatedEveningPersist);
      onUpdateEvening(updatedEveningPersist);
      
      // Generate team pools if we don't have them yet or filter existing ones
      if (originalTeamPools[0].length === 0) {
        const basePools: [Club[], Club[]] | null = (round.teamPools as [Club[], Club[]] | undefined) ?? null;
        if (basePools) {
          setOriginalTeamPools([basePools[0], basePools[1]]);
          setTeamPools([basePools[0], basePools[1]]);
          // Restore recycled club IDs from round
          setRecycledClubIds(new Set(round.recycledClubIds ?? []));
        } else {
          const teamSelector = new TeamSelector(clubsWithOverrides);
          const maxMatches = currentEvening.winsToComplete * 2 - 1;
          // Only exclude clubs that were ACTUALLY PLAYED (from usedClubCounts)
          const actuallyPlayedClubIds = Object.keys(usedClubCounts).filter(id => (usedClubCounts[id] ?? 0) >= 1);
          const poolConfigs = await fetchPoolConfigs();
          const poolConfig = getPoolConfigForWins(poolConfigs, currentEvening.winsToComplete);
          const poolResult = poolConfig
            ? teamSelector.generateTeamPoolsFromConfig(roundPairs, poolConfig, actuallyPlayedClubIds)
            : teamSelector.generateTeamPools(roundPairs, actuallyPlayedClubIds, maxMatches);
          // Track recycled clubs
          setRecycledClubIds(poolResult.recycledClubIds);
          // Persist these pools on the round
          const roundWithPools: Round = { 
            ...updatedRoundPersist, 
            teamPools: [poolResult.pools[0], poolResult.pools[1]],
            recycledClubIds: Array.from(poolResult.recycledClubIds)
          } as Round;
          const evWithPools: Evening = {
            ...updatedEveningPersist,
            rounds: [
              ...updatedEveningPersist.rounds.slice(0, roundIndex),
              roundWithPools,
              ...updatedEveningPersist.rounds.slice(roundIndex + 1)
            ],
          };
          setCurrentEvening(evWithPools);
          onUpdateEvening(evWithPools);
          setOriginalTeamPools([poolResult.pools[0], poolResult.pools[1]]);
          setTeamPools([poolResult.pools[0], poolResult.pools[1]]);
        }
      } else {
        // Use allocation-aware filtering: recycled clubs stay until their allocation is consumed
        const filteredPools: [Club[], Club[]] = [
          filterPoolByAllocations(originalTeamPools[0], consumedClubIdsThisRound),
          filterPoolByAllocations(originalTeamPools[1], consumedClubIdsThisRound)
        ];
        setTeamPools(filteredPools);

        if (process.env.NODE_ENV !== 'production') {
          console.log('[DEV] createNextMatch pool filter (allocation-aware)', {
            roundIndex,
            pair0_original: originalTeamPools[0].length,
            pair0_remaining: filteredPools[0].length,
            pair1_original: originalTeamPools[1].length,
            pair1_remaining: filteredPools[1].length,
            consumedThisRound: consumedClubIdsThisRound,
            recycledClubIds: Array.from(recycledClubIds),
          });
        }
      }
    }
    
    setSelectedClubs([null, null]);
    setGamePhase('team-selection');
  };

  const loadCurrentRound = async (targetIndex?: number) => {
    const idx = targetIndex ?? currentRound;
    const round = currentEvening.rounds[idx];
    if (!round) return;

    if (process.env.NODE_ENV !== 'production') {
      console.log('[DEV] loadCurrentRound', {
        roundIndex: idx,
        matchCount: round.matches.length,
        completedMatches: round.matches.filter(m => m.completed).length,
        pairScores: round.pairScores,
        hasTeamPools: !!(round.teamPools && round.teamPools[0]?.length),
        teamPoolSizes: round.teamPools ? [round.teamPools[0]?.length, round.teamPools[1]?.length] : null,
      });
    }

    // Restore pairs for this round
    const allPairs = pairSchedule;
    const roundPairs = allPairs[idx];
    setCurrentRoundPairs(roundPairs);

    // Restore used clubs from all completed matches across the evening up to this round
    const counts: Record<string, number> = {};
    currentEvening.rounds.forEach((r) => {
      r.matches.forEach((match) => {
        if (match.completed) {
          counts[match.clubs[0].id] = (counts[match.clubs[0].id] ?? 0) + 1;
          counts[match.clubs[1].id] = (counts[match.clubs[1].id] ?? 0) + 1;
        }
      });
    });
    setUsedClubCounts(counts);

    // Build per-round consumed club IDs (only from completed matches — tracks allocation instances)
    const consumedThisRound: string[] = [];
    round.matches.forEach((match) => {
      if (match.completed && match.clubs[0]?.id && match.clubs[1]?.id) {
        consumedThisRound.push(match.clubs[0].id);
        consumedThisRound.push(match.clubs[1].id);
      }
    });
    setConsumedClubIdsThisRound(consumedThisRound);

    // Generate/restore team pools for this round (persisted to avoid changes on navigation)
    const basePools: [Club[], Club[]] | null = (round.teamPools as [Club[], Club[]] | undefined) ?? null;
    if (basePools) {
      setOriginalTeamPools([basePools[0], basePools[1]]);
      // Restore recycled club IDs from round
      setRecycledClubIds(new Set(round.recycledClubIds ?? []));
      // Use allocation-aware filtering
      const filtered: [Club[], Club[]] = [
        filterPoolByAllocations(basePools[0], consumedThisRound),
        filterPoolByAllocations(basePools[1], consumedThisRound),
      ];
      setTeamPools(filtered);

      // DEV diagnostics
      if (process.env.NODE_ENV !== 'production') {
        console.log('[DEV] loadCurrentRound pool check (allocation-aware)', {
          roundIndex: idx,
          pair0_assigned: basePools[0].map(c => c.id),
          pair1_assigned: basePools[1].map(c => c.id),
          recycledClubIds: round.recycledClubIds ?? [],
          consumedThisRound,
          pair0_remaining: filtered[0].map(c => c.id),
          pair1_remaining: filtered[1].map(c => c.id),
        });
      }

      // DEV invariant check: verify pool sizes
      if (process.env.NODE_ENV !== 'production') {
        const maxMatches = currentEvening.winsToComplete * 2 - 1;
        console.log('[DEV] loadCurrentRound pool check', {
          roundIndex: idx,
          pair0_assigned: basePools[0].length,
          pair1_assigned: basePools[1].length,
          pair0_remaining: filtered[0].length,
          pair1_remaining: filtered[1].length,
          consumedThisRound,
          expectedPoolSize: maxMatches,
        });
        if (basePools[0].length < maxMatches || basePools[1].length < maxMatches) {
          console.warn('[DEV] Pool size smaller than expected maxMatches!', {
            pair0Missing: maxMatches - basePools[0].length,
            pair1Missing: maxMatches - basePools[1].length,
          });
        }
      }
    } else {
      const teamSelector = new TeamSelector(clubsWithOverrides);
      const maxMatches = currentEvening.winsToComplete * 2 - 1;
      const eveningMaxed = Object.keys(counts).filter((id) => (counts[id] ?? 0) >= 1);
      const excludeIds = [...new Set([...eveningMaxed, ...consumedThisRound])];
      const poolConfigs = await fetchPoolConfigs();
      const poolConfig = getPoolConfigForWins(poolConfigs, currentEvening.winsToComplete);
      const poolResult = poolConfig
        ? teamSelector.generateTeamPoolsFromConfig(roundPairs, poolConfig, excludeIds)
        : teamSelector.generateTeamPools(roundPairs, excludeIds, maxMatches);
      // Track recycled clubs
      setRecycledClubIds(poolResult.recycledClubIds);
      // Persist pools on the round in evening state
      const roundWithPools: Round = { 
        ...round, 
        teamPools: [poolResult.pools[0], poolResult.pools[1]],
        recycledClubIds: Array.from(poolResult.recycledClubIds)
      } as Round;
      const evWithPools: Evening = {
        ...currentEvening,
        rounds: [
          ...currentEvening.rounds.slice(0, idx),
          roundWithPools,
          ...currentEvening.rounds.slice(idx + 1),
        ],
      };
      setCurrentEvening(evWithPools);
      onUpdateEvening(evWithPools);
      setOriginalTeamPools([poolResult.pools[0], poolResult.pools[1]]);
      setTeamPools([poolResult.pools[0], poolResult.pools[1]]);
    }
    // Check if we have an incomplete match that was in progress
    const currentMatchInProgress = round.matches.find(m => !m.completed);
    if (currentMatchInProgress) {
      // If match was already in progress, preserve any selected clubs
      setCurrentMatch(currentMatchInProgress);
      setCurrentRound(idx);
      // Check if clubs were already selected for this match
      if (currentMatchInProgress.clubs && currentMatchInProgress.clubs[0]?.id && currentMatchInProgress.clubs[1]?.id) {
        setSelectedClubs([currentMatchInProgress.clubs[0], currentMatchInProgress.clubs[1]]);
        setGamePhase('countdown'); // Resume from countdown phase
      } else {
        // No clubs selected yet, start fresh
        setSelectedClubs([null, null]);
        setGamePhase('team-selection');
      }
    } else {
      // Create next match if needed
      setCurrentRound(idx);
      createNextMatch(currentEvening, idx, roundPairs);
      setSelectedClubs([null, null]);
      setGamePhase('team-selection');
    }
  };
  const selectClub = (pairIndex: 0 | 1, club: Club) => {
    const newSelected = [...selectedClubs] as [Club | null, Club | null];
    newSelected[pairIndex] = club;
    setSelectedClubs(newSelected);
    
    // Close accordion after selection
    setOpenAccordion("");

    if (newSelected[0] && newSelected[1]) {
      // Persist selected clubs into the current in-progress match
      const round = currentEvening.rounds[currentRound];
      if (round && round.matches.length > 0) {
        const lastIdx = round.matches.length - 1;
        const updatedMatch: Match = { ...round.matches[lastIdx], clubs: [newSelected[0]!, newSelected[1]!] as [Club, Club] };
        const updatedRound: Round = {
          ...round,
          matches: [...round.matches.slice(0, lastIdx), updatedMatch, ...round.matches.slice(lastIdx + 1)]
        };
        const updatedEvening: Evening = {
          ...currentEvening,
          rounds: [
            ...currentEvening.rounds.slice(0, currentRound),
            updatedRound,
            ...currentEvening.rounds.slice(currentRound + 1)
          ]
        };
        setCurrentEvening(updatedEvening);
        onUpdateEvening(updatedEvening);
        setCurrentMatch(updatedMatch);
      }

      // Both teams selected, start countdown
      setGamePhase('countdown');
      setCountdown(60);
      toast({
        title: "Teams Selected!",
        description: "60-second countdown started. Get ready to play!",
      });
    }
  };

  // Auto-draw balanced teams for decider matches (stars >= 4, diff <= 1)
  const drawDeciderTeams = () => {
    const teamSelector = new TeamSelector(clubsWithOverrides);
    const eveningMaxed = Object.keys(usedClubCounts).filter(id => (usedClubCounts[id] ?? 0) >= 1);
    const excludeIds = [...new Set([...eveningMaxed, ...consumedClubIdsThisRound])];
    const [club1, club2] = teamSelector.generateBalancedDeciderTeams(excludeIds, 4, 1);
    setSelectedClubs([club1, club2]);
    setUsedClubCounts(prev => ({
      ...prev,
      [club1.id]: (prev[club1.id] ?? 0) + 1,
      [club2.id]: (prev[club2.id] ?? 0) + 1,
    }));
    setConsumedClubIdsThisRound(prev => [...prev, club1.id, club2.id]);
    setGamePhase('countdown');
    setCountdown(60);
    toast({
      title: 'Balanced Teams Drawn',
      description: `${club1.name} vs ${club2.name} (stars >= 4, diff <= 1)`,
    });
  };

  // Handle swapping a club in the pool
  const handleSwapClub = (newClub: Club) => {
    if (!clubToSwap) return;
    
    const { pairIndex, clubIndex } = clubToSwap;
    
    // Update original team pools
    const newOriginalPools: [Club[], Club[]] = [
      [...originalTeamPools[0]],
      [...originalTeamPools[1]]
    ];
    newOriginalPools[pairIndex][clubIndex] = newClub;
    setOriginalTeamPools(newOriginalPools);
    
    // Update current team pools
    const newTeamPools: [Club[], Club[]] = [
      [...teamPools[0]],
      [...teamPools[1]]
    ];
    // Find and replace in filtered pool
    const oldClubId = clubToSwap.club.id;
    const filteredIndex = newTeamPools[pairIndex].findIndex(c => c.id === oldClubId);
    if (filteredIndex >= 0) {
      newTeamPools[pairIndex][filteredIndex] = newClub;
    }
    setTeamPools(newTeamPools);
    
    // Also update the round's persisted teamPools
    const round = currentEvening.rounds[currentRound];
    if (round?.teamPools) {
      const updatedRoundPools = [...round.teamPools] as [Club[], Club[]];
      const roundPoolIndex = updatedRoundPools[pairIndex].findIndex(c => c.id === oldClubId);
      if (roundPoolIndex >= 0) {
        updatedRoundPools[pairIndex][roundPoolIndex] = newClub;
      }
      const updatedRound = { ...round, teamPools: updatedRoundPools };
      const updatedEvening = {
        ...currentEvening,
        rounds: [
          ...currentEvening.rounds.slice(0, currentRound),
          updatedRound,
          ...currentEvening.rounds.slice(currentRound + 1)
        ]
      };
      setCurrentEvening(updatedEvening);
      onUpdateEvening(updatedEvening);
    }
    
    toast({
      title: "הקבוצה הוחלפה",
      description: `${clubToSwap.club.name} → ${newClub.name}`,
    });
    
    setClubToSwap(null);
  };

  const toggleCountdown = () => {
    setIsCountdownActive(!isCountdownActive);
  };

  const resetCountdown = () => {
    setCountdown(60);
    setIsCountdownActive(false);
  };

  // Allow undoing a wrong team selection: clear selection and clear clubs on the in-progress match
  const undoTeamSelection = () => {
    const round = currentEvening.rounds[currentRound];
    if (round && round.matches.length > 0) {
      const lastIdx = round.matches.length - 1;
      const blankClub: Club = { id: '', name: '', stars: 0, league: '' };
      const updatedMatch: Match = { ...round.matches[lastIdx], clubs: [blankClub, blankClub], completed: false, score: undefined, winner: undefined };
      const updatedRound: Round = {
        ...round,
        matches: [...round.matches.slice(0, lastIdx), updatedMatch, ...round.matches.slice(lastIdx + 1)]
      };
      const updatedEvening: Evening = {
        ...currentEvening,
        rounds: [
          ...currentEvening.rounds.slice(0, currentRound),
          updatedRound,
          ...currentEvening.rounds.slice(currentRound + 1)
        ]
      };
      setCurrentEvening(updatedEvening);
      onUpdateEvening(updatedEvening);
      setCurrentMatch(updatedMatch);
    }

    setSelectedClubs([null, null]);
    setIsCountdownActive(false);
    setGamePhase('team-selection');
    toast({ title: 'בוטלה הבחירה', description: 'בחרו מחדש את הקבוצות' });
  };

  // Edit an already-submitted match result
  const editMatchResult = (matchId: string, newScore1: number, newScore2: number) => {
    const round = currentEvening.rounds[currentRound];
    if (!round) return;
    const matchIdx = round.matches.findIndex(m => m.id === matchId);
    if (matchIdx < 0) return;
    const match = round.matches[matchIdx];
    if (!match.completed) return;

    // Recalculate pair scores from scratch
    const updatedMatch: Match = { ...match, score: [newScore1, newScore2] };
    // Determine new winner
    if (newScore1 > newScore2) updatedMatch.winner = match.pairs[0].id;
    else if (newScore2 > newScore1) updatedMatch.winner = match.pairs[1].id;
    else updatedMatch.winner = '';

    const updatedMatches = [...round.matches];
    updatedMatches[matchIdx] = updatedMatch;

    // Recalculate ALL pair scores from scratch
    const newPairScores: { [pairId: string]: number } = {};
    newPairScores[round.matches[0]?.pairs[0]?.id] = 0;
    newPairScores[round.matches[0]?.pairs[1]?.id] = 0;
    updatedMatches.forEach(m => {
      if (m.completed && m.winner) {
        newPairScores[m.winner] = (newPairScores[m.winner] || 0) + 1;
      }
    });

    const updatedRound = { ...round, matches: updatedMatches, pairScores: newPairScores };
    const updatedEvening = {
      ...currentEvening,
      rounds: [
        ...currentEvening.rounds.slice(0, currentRound),
        updatedRound,
        ...currentEvening.rounds.slice(currentRound + 1)
      ]
    };
    setCurrentEvening(updatedEvening);
    onUpdateEvening(updatedEvening);
    setEditingMatch(null);
    toast({ title: 'תוצאה עודכנה', description: `${newScore1}-${newScore2}` });
  };

  // Delete a completed match entirely
  const deleteMatch = (matchId: string) => {
    const round = currentEvening.rounds[currentRound];
    if (!round) return;
    const matchIdx = round.matches.findIndex(m => m.id === matchId);
    if (matchIdx < 0) return;
    const match = round.matches[matchIdx];
    if (!match.completed) return;

    // Return clubs to pool by removing from used sets
    const c1 = match.clubs[0];
    const c2 = match.clubs[1];
    
    setUsedClubCounts(prev => {
      const updated = { ...prev };
      if (c1?.id) updated[c1.id] = Math.max(0, (updated[c1.id] ?? 0) - 1);
      if (c2?.id) updated[c2.id] = Math.max(0, (updated[c2.id] ?? 0) - 1);
      return updated;
    });
    // Recompute teamPools from originalTeamPools using updated consumed list
    setConsumedClubIdsThisRound(prev => {
      const updatedConsumed = [...prev];
      // Remove one instance of each club (not all)
      if (c1?.id) { const i = updatedConsumed.indexOf(c1.id); if (i >= 0) updatedConsumed.splice(i, 1); }
      if (c2?.id) { const i = updatedConsumed.indexOf(c2.id); if (i >= 0) updatedConsumed.splice(i, 1); }
      // Also update teamPools based on updated consumed list
      setTeamPools([
        filterPoolByAllocations(originalTeamPools[0], updatedConsumed),
        filterPoolByAllocations(originalTeamPools[1], updatedConsumed)
      ]);
      return updatedConsumed;
    });

    // Remove match and recalculate scores
    const updatedMatches = round.matches.filter(m => m.id !== matchId);
    const newPairScores: { [pairId: string]: number } = {};
    const pairIds = Object.keys(round.pairScores);
    pairIds.forEach(id => { newPairScores[id] = 0; });
    updatedMatches.forEach(m => {
      if (m.completed && m.winner) {
        newPairScores[m.winner] = (newPairScores[m.winner] || 0) + 1;
      }
    });

    const updatedRound = { ...round, matches: updatedMatches, pairScores: newPairScores, completed: false };
    const updatedEvening = {
      ...currentEvening,
      rounds: [
        ...currentEvening.rounds.slice(0, currentRound),
        updatedRound,
        ...currentEvening.rounds.slice(currentRound + 1)
      ]
    };
    setCurrentEvening(updatedEvening);
    onUpdateEvening(updatedEvening);

    // If no current in-progress match, create one
    const hasInProgress = updatedMatches.some(m => !m.completed);
    if (!hasInProgress) {
      createNextMatch(updatedEvening, currentRound);
    }

    toast({ title: 'משחק נמחק', description: 'הקבוצות הוחזרו למאגר' });
  };
  const submitResult = (score1: number, score2: number) => {
    if (!currentMatch) return;
    
    let winner: string;
    if (score1 > score2) {
      winner = currentMatch.pairs[0].id;
    } else if (score2 > score1) {
      winner = currentMatch.pairs[1].id;
    } else {
      // Draw - no winner
      winner = '';
    }

    const completedMatch: Match = {
      ...currentMatch,
      clubs: [selectedClubs[0]!, selectedClubs[1]!],
      score: [score1, score2],
      winner,
      completed: true
    };

    // Update round with completed match
    const round = currentEvening.rounds[currentRound];
    const idx = round.matches.findIndex(m => m.id === currentMatch.id);
    const updatedMatches = [...round.matches];
    if (idx >= 0) {
      updatedMatches[idx] = completedMatch;
    } else {
      updatedMatches.push(completedMatch);
    }
    
    // Update pair scores if there's a winner
    const updatedPairScores = { ...round.pairScores };
    if (winner) {
      updatedPairScores[winner] = (updatedPairScores[winner] || 0) + 1;
    }

    const updatedRound = {
      ...round,
      matches: updatedMatches,
      pairScores: updatedPairScores
    };

    const updatedEvening = {
      ...currentEvening,
      rounds: [
        ...currentEvening.rounds.slice(0, currentRound),
        updatedRound,
        ...currentEvening.rounds.slice(currentRound + 1)
      ]
    };

    setCurrentEvening(updatedEvening);
    onUpdateEvening(updatedEvening);

    // Mark selected clubs as used only after match completion
    const c1 = selectedClubs[0]!;
    const c2 = selectedClubs[1]!;
    
    // Update club usage counts
    setUsedClubCounts(prev => ({
      ...prev,
      [c1.id]: (prev[c1.id] ?? 0) + 1,
      [c2.id]: (prev[c2.id] ?? 0) + 1,
    }));
    const newConsumed = [...consumedClubIdsThisRound, c1.id, c2.id];
    setConsumedClubIdsThisRound(newConsumed);

    // Immediately filter current team pools using allocation-aware logic
    setTeamPools([
      filterPoolByAllocations(originalTeamPools[0], newConsumed),
      filterPoolByAllocations(originalTeamPools[1], newConsumed)
    ]);

    // Calculate winner names for notification
    const winnerNames = winner ? 
      (winner === currentMatch.pairs[0].id ? 
        currentMatch.pairs[0].players.map(p => p.name).join(' + ') :
        currentMatch.pairs[1].players.map(p => p.name).join(' + ')
      ) : 'Draw';

    toast({
      title: `Match Complete!`,
      description: winner ? `${winnerNames} wins ${score1}-${score2}!` : `Draw ${score1}-${score2}`,
    });

    

    // Check if round is complete after this match using TournamentEngine
    console.log('Checking round completion:', {
      roundPairScores: updatedRound.pairScores,
      winsToComplete: currentEvening.winsToComplete,
      isComplete: TournamentEngine.isRoundComplete(updatedRound, currentEvening.winsToComplete),
      isTied: TournamentEngine.isRoundTied(updatedRound, currentEvening.winsToComplete)
    });
    if (TournamentEngine.isRoundComplete(updatedRound, currentEvening.winsToComplete)) {
      if (TournamentEngine.isRoundTied(updatedRound, currentEvening.winsToComplete)) {
        // Tie! Need decider match
        setTimeout(() => {
          createNextMatch(updatedEvening, currentRound);
        }, 2000);
      } else {
        // Round winner determined - announce winner
        const roundWinner = TournamentEngine.getRoundWinner(updatedRound);
        if (roundWinner) {
          const winnerPair = currentRoundPairs.find(pair => pair.id === roundWinner);
          if (winnerPair) {
            const winnerNames = winnerPair.players.map(p => p.name).join(' + ');
            setRoundWinnerMessage(`${winnerNames} wins Round ${currentRound + 1}!`);
            setShowRoundWinnerDialog(true);
          }
        }
      }
    } else {
      // Continue with next match
      setTimeout(() => {
        createNextMatch(updatedEvening, currentRound);
      }, 2000);
    }
  };

  /**
   * Apply voice-recognized results through the same manual entry logic.
   * Each candidate is applied sequentially as if the user selected clubs and submitted a score.
   */
  const applyVoiceResults = useCallback((results: VoiceResultCandidate[]) => {
    if (!currentMatch) return;
    const roundData = currentEvening.rounds[currentRound];
    if (!roundData) return;

    let latestEvening = currentEvening;
    let latestRound = currentEvening.rounds[currentRound];
    let latestConsumed = [...consumedClubIdsThisRound];
    let latestUsedCounts = { ...usedClubCounts };

    for (const result of results) {
      if (!result.pairAClub || !result.pairBClub || result.scoreA === null || result.scoreB === null) continue;

      const score1 = result.scoreA;
      const score2 = result.scoreB;

      let winner = '';
      if (score1 > score2) winner = result.pairAId || currentMatch.pairs[0].id;
      else if (score2 > score1) winner = result.pairBId || currentMatch.pairs[1].id;

      // Find the in-progress match in the latest round state
      const roundIdx = currentRound;
      const round = latestEvening.rounds[roundIdx];
      const inProgressIdx = round.matches.findIndex(m => !m.completed);
      
      if (inProgressIdx < 0) break; // No more in-progress matches

      const matchToComplete: Match = {
        ...round.matches[inProgressIdx],
        clubs: [result.pairAClub, result.pairBClub],
        score: [score1, score2],
        winner,
        completed: true,
      };

      const updatedMatches = [...round.matches];
      updatedMatches[inProgressIdx] = matchToComplete;

      const updatedPairScores = { ...round.pairScores };
      if (winner) {
        updatedPairScores[winner] = (updatedPairScores[winner] || 0) + 1;
      }

      const updatedRound = { ...round, matches: updatedMatches, pairScores: updatedPairScores };
      latestEvening = {
        ...latestEvening,
        rounds: [
          ...latestEvening.rounds.slice(0, roundIdx),
          updatedRound,
          ...latestEvening.rounds.slice(roundIdx + 1),
        ],
      };
      latestRound = updatedRound;

      // Track club consumption
      latestUsedCounts[result.pairAClub.id] = (latestUsedCounts[result.pairAClub.id] ?? 0) + 1;
      latestUsedCounts[result.pairBClub.id] = (latestUsedCounts[result.pairBClub.id] ?? 0) + 1;
      latestConsumed.push(result.pairAClub.id, result.pairBClub.id);

      // Check if round is complete after this result
      if (TournamentEngine.isRoundComplete(updatedRound, currentEvening.winsToComplete)) {
        break; // Don't add more matches if round is done
      }

      // Create next match for the next voice result
      if (results.indexOf(result) < results.length - 1) {
        const nextMatch = TournamentEngine.createNextMatch(updatedRound, currentRoundPairs);
        const roundWithNext = { ...updatedRound, matches: [...updatedRound.matches, nextMatch] };
        latestEvening = {
          ...latestEvening,
          rounds: [
            ...latestEvening.rounds.slice(0, roundIdx),
            roundWithNext,
            ...latestEvening.rounds.slice(roundIdx + 1),
          ],
        };
        latestRound = roundWithNext;
      }
    }

    // Apply all state updates at once
    setCurrentEvening(latestEvening);
    onUpdateEvening(latestEvening);
    setUsedClubCounts(latestUsedCounts);
    setConsumedClubIdsThisRound(latestConsumed);
    setTeamPools([
      filterPoolByAllocations(originalTeamPools[0], latestConsumed),
      filterPoolByAllocations(originalTeamPools[1], latestConsumed),
    ]);

    toast({
      title: `${results.length} תוצאות הוחלו`,
      description: 'התוצאות עודכנו בהצלחה מהקלטה קולית',
    });

    // Check round completion and proceed
    if (TournamentEngine.isRoundComplete(latestRound, currentEvening.winsToComplete)) {
      if (TournamentEngine.isRoundTied(latestRound, currentEvening.winsToComplete)) {
        setTimeout(() => createNextMatch(latestEvening, currentRound), 1500);
      } else {
        const roundWinner = TournamentEngine.getRoundWinner(latestRound);
        if (roundWinner) {
          const winnerPair = currentRoundPairs.find(p => p.id === roundWinner);
          if (winnerPair) {
            setRoundWinnerMessage(`${winnerPair.players.map(p => p.name).join(' + ')} wins Round ${currentRound + 1}!`);
            setShowRoundWinnerDialog(true);
          }
        }
      }
    } else {
      setTimeout(() => createNextMatch(latestEvening, currentRound), 1500);
    }
  }, [currentMatch, currentEvening, currentRound, currentRoundPairs, consumedClubIdsThisRound, usedClubCounts, originalTeamPools, onUpdateEvening, toast]);

  const handleRoundWinnerConfirm = () => {
    setShowRoundWinnerDialog(false);
    handleRoundComplete();
  };

  const handleRoundComplete = () => {
    // Mark current round as completed
    const round = currentEvening.rounds[currentRound];
    if (round && !round.completed) {
      const completedRound = { ...round, completed: true };
      const updatedEvening = {
        ...currentEvening,
        rounds: [
          ...currentEvening.rounds.slice(0, currentRound),
          completedRound,
          ...currentEvening.rounds.slice(currentRound + 1)
        ]
      };
      setCurrentEvening(updatedEvening);
      onUpdateEvening(updatedEvening);
    }

    if (currentRound === 2) { 
      // Tournament complete
      completeEvening();
    } else {
      // Move to next round
      // If tier-question mode, callback to parent to show mode selection
      if (currentEvening.teamSelectionMode === 'tier-question') {
        // Signal parent that we need round mode selection
        if (onRoundModeSelection) {
          onRoundModeSelection(currentRound + 1);
          return;
        }
      }
      setCurrentRound(prev => {
        const next = prev + 1;
        startNextRound(next);
        return next;
      });
    }
  };

  const completeEvening = () => {
    const playerStats = TournamentEngine.calculatePlayerStats(currentEvening);
    const rankings = TournamentEngine.calculateRankings(playerStats);
    
    const completedEvening = {
      ...currentEvening,
      completed: true,
      rankings
    };

    onComplete(completedEvening);
  };

  const currentRoundData = currentEvening.rounds[currentRound];
  const currentRoundScore = currentRoundData && currentMatch ? 
    [currentRoundData.pairScores[currentMatch.pairs[0].id] || 0, currentRoundData.pairScores[currentMatch.pairs[1].id] || 0] : 
    [0, 0];
  const maxMatchesInRound = currentEvening.winsToComplete * 2 - 1;
  const completedMatches = currentRoundData ? currentRoundData.matches.filter(m => m.completed).length : 0;

  return (
    <div className="h-screen bg-gaming-bg p-3 flex flex-col overflow-hidden">
      <div className="max-w-md mx-auto flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-2 flex-shrink-0">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5 rotate-180" />
          </Button>
          <div className="text-center">
            <h1 className="text-lg font-bold text-foreground">
              Round {currentRoundData?.number || 1}
            </h1>
            <p className="text-xs text-muted-foreground">
              First to {currentEvening.winsToComplete} wins
            </p>
            {currentRoundData && (
              <p className="text-base font-bold text-neon-green">
                {currentRoundScore[0]} - {currentRoundScore[1]}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={shareViaWhatsApp}
              aria-label="Share via WhatsApp"
              className="text-neon-green"
            >
              <Share2 className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (!currentMatch) return;
                const round = currentEvening.rounds[currentRound];
                const allPools = round?.teamPools as [Club[], Club[]] | undefined;
                if (!allPools || !allPools[0]?.length || !allPools[1]?.length) return;
                const lines: string[] = [];
                currentMatch.pairs.forEach((pair, index) => {
                  const pairName = pair.players.map(p => p.name).join(' ו');
                  lines.push(pairName);
                  allPools[index].forEach((club) => {
                    const used = consumedClubIdsThisRound.includes(club.id) ? ' ✓' : '';
                    lines.push(`${club.name}${used}`);
                  });
                  lines.push('');
                });
                navigator.clipboard.writeText(lines.join('\n').trim());
                toast({ title: "הועתק!", description: "רשימת כל הקבוצות של הסיבוב הועתקה ללוח" });
              }}
              aria-label="Copy teams"
            >
              <Copy className="h-5 w-5" />
            </Button>
            {shareCode && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { navigator.clipboard.writeText(shareCode!); toast({ title: "העתקנו את הקוד", description: shareCode! }); }}
                aria-label="Share code"
                className="text-xs px-2 py-1 h-7"
              >
                קוד: {shareCode}
              </Button>
            )}
            {/* Voice mic button moved to team-selection phase below */}
            <Button variant="ghost" size="icon" onClick={onGoHome} aria-label="Home">
              <Home className="h-5 w-5" />
            </Button>
            {canStopTournament && onStopTournament && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()} className="text-destructive" aria-label="Stop tournament">
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

        {/* Progress - Compact */}
        <div className="mb-2 flex-shrink-0">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Round {currentRound + 1}/3</span>
            <span>{completedMatches}/{maxMatchesInRound} matches</span>
          </div>
          <Progress 
            value={currentRoundData ? (Math.max(...Object.values(currentRoundData.pairScores)) / currentEvening.winsToComplete) * 100 : 0} 
            className="h-1" 
          />
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto min-h-0">
        {/* Current Matchup - Single compact card */}
        {currentMatch && (
          <Card className="bg-gradient-card border-neon-green/20 p-2 mb-2 shadow-card flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="text-center flex-1">
                <p className="text-xs text-muted-foreground truncate max-w-[90px]">
                  {currentMatch.pairs[0].players.map(p => p.name).join(' + ')}
                </p>
                <p className="text-lg font-bold text-neon-green">{currentRoundScore[0]}</p>
              </div>
              <div className="text-neon-green font-bold px-2 text-sm">VS</div>
              <div className="text-center flex-1">
                <p className="text-xs text-muted-foreground truncate max-w-[90px]">
                  {currentMatch.pairs[1].players.map(p => p.name).join(' + ')}
                </p>
                <p className="text-lg font-bold text-neon-green">{currentRoundScore[1]}</p>
              </div>
            </div>
            {currentRoundData?.isDeciderMatch && (
              <div className="text-center mt-1">
                <Badge variant="destructive" className="animate-pulse text-xs">Decider</Badge>
              </div>
            )}
          </Card>
        )}

        {/* Game Phases */}
        {gamePhase === 'team-selection' && currentMatch && (
          <div className="space-y-3">

            {/* Decider Match - Draw Balanced Teams Button */}
            {currentRoundData?.isDeciderMatch && (
              <div className="text-center space-y-3">
                <p className="text-sm text-muted-foreground">Stars ≥ 4, difference ≤ 1</p>
                <Button variant="gaming" onClick={drawDeciderTeams} className="w-full">Draw Balanced Teams</Button>
                <Button variant="outline" onClick={() => {
                  // Open manual selection for decider - generate balanced pool to choose from
                  const teamSelector = new TeamSelector(clubsWithOverrides);
                  const eveningMaxed = Object.keys(usedClubCounts).filter(id => (usedClubCounts[id] ?? 0) >= 1);
                  // For manual decider, exclude only clubs used in THIS round (not previous rounds)
                  const excludeIds = [...new Set([...consumedClubIdsThisRound])];
                  const candidates = clubsWithOverrides
                    .filter(c => c.stars >= 4 && !excludeIds.includes(c.id))
                    .sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name));
                  // Set pools for manual selection from decider candidates (split equally)
                   setTeamPools([candidates, candidates]);
                  // Switch off decider flag temporarily to show accordion
                  const round = currentEvening.rounds[currentRound];
                  if (round) {
                    const updatedRound = { ...round, isDeciderMatch: false };
                    const updatedEvening = {
                      ...currentEvening,
                      rounds: [
                        ...currentEvening.rounds.slice(0, currentRound),
                        updatedRound,
                        ...currentEvening.rounds.slice(currentRound + 1)
                      ]
                    };
                    setCurrentEvening(updatedEvening);
                  }
                }} className="w-full">בחר ידנית</Button>
              </div>
            )}

            {/* Pre-compute filtered pools to detect deadlock */}
            {(() => {
              if (!teamPools[0] || !teamPools[1] || currentRoundData?.isDeciderMatch) return null;
              // Filter only by round usage + other pair's current selection.
              // Do NOT filter by usedClubCounts — recycled clubs are legitimately in the pool.
              const computeFiltered = (pool: Club[], pairIdx: number) => {
                const otherSelId = selectedClubs[pairIdx === 0 ? 1 : 0]?.id || '';
                return filterPoolByAllocations(pool, consumedClubIdsThisRound, otherSelId);
              };
              const filtered0 = computeFiltered(teamPools[0], 0);
              const filtered1 = computeFiltered(teamPools[1], 1);
              const bothEmpty = filtered0.length === 0 && filtered1.length === 0;
              const roundNotComplete = currentRoundData && !TournamentEngine.isRoundComplete(currentRoundData, currentEvening.winsToComplete);

              // Deadlock: pools exhausted (filtered) but round not done
              if (bothEmpty && roundNotComplete) {
                return (
                  <div className="text-center space-y-3">
                    <p className="text-sm text-muted-foreground">הקבוצות נגמרו, אבל אף זוג לא הגיע ל-{currentEvening.winsToComplete} ניצחונות</p>
                    <p className="text-sm text-muted-foreground">Stars ≥ 4, difference ≤ 1</p>
                    <Button variant="gaming" onClick={drawDeciderTeams} className="w-full">הגרל קבוצות מאוזנות</Button>
                    <Button variant="outline" onClick={() => {
                      const excludeIds = [...new Set([...consumedClubIdsThisRound])];
                      const candidates = clubsWithOverrides
                        .filter(c => c.stars >= 4 && !excludeIds.includes(c.id))
                        .sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name));
                       setTeamPools([candidates, candidates]);
                    }} className="w-full">בחר ידנית</Button>
                  </div>
                );
              }

              // Normal: show accordion
              if (teamPools[0].length > 0 && teamPools[1].length > 0) return null; // handled below
              return null;
            })()}
            {!currentRoundData?.isDeciderMatch && teamPools[0] && teamPools[1] && teamPools[0].length > 0 && teamPools[1].length > 0 && (() => {
              // Re-check: if both filtered are empty, the deadlock block above handles it
              const computeFiltered2 = (pool: Club[], pairIdx: number) => {
                const otherSelId = selectedClubs[pairIdx === 0 ? 1 : 0]?.id || '';
                return filterPoolByAllocations(pool, consumedClubIdsThisRound, otherSelId);
              };
              const f0 = computeFiltered2(teamPools[0], 0);
              const f1 = computeFiltered2(teamPools[1], 1);
              if (f0.length === 0 && f1.length === 0 && currentRoundData && !TournamentEngine.isRoundComplete(currentRoundData, currentEvening.winsToComplete)) return false;
              return true;
            })() && (
              <Accordion type="single" collapsible value={openAccordion} onValueChange={setOpenAccordion} className="space-y-2">
                {teamPools.map((pool, pairIndex) => {
                  const pairNames = currentMatch.pairs[pairIndex].players.map(p => p.name).join(' + ');
                  const selectedClub = selectedClubs[pairIndex];
                  // Filter out clubs that:
                  // 1. Are already used in THIS round (usedClubIdsThisRound)
                  // 2. Are currently selected by the OTHER pair in this match
                  // Note: Do NOT filter by usedClubCounts — recycled clubs from previous rounds
                  // are legitimately part of this round's pool and must remain selectable.
                  const otherPairSelectedId = selectedClubs[pairIndex === 0 ? 1 : 0]?.id || '';
                  const filtered = filterPoolByAllocations(pool, consumedClubIdsThisRound, otherPairSelectedId);

                  return (
                    <AccordionItem 
                      key={pairIndex} 
                      value={`pair-${pairIndex}`}
                      className="border rounded-lg bg-gaming-surface overflow-hidden"
                    >
                      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
                        <div className="flex items-center justify-between w-full pr-2">
                          <span className="font-medium text-foreground">{pairNames}</span>
                          {selectedClub ? (
                            <Badge variant="default" className="bg-neon-green text-background">
                              {selectedClub.name} {selectedClub.isPrime ? 'Pr' : `${getDisplayStars(selectedClub)}★`}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              לחץ לבחירה
                            </Badge>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-2 pb-2">
                        <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto">
                          {filtered.map((club, clubIdx) => {
                            // Find original index in the full pool for swap
                            const originalIndex = originalTeamPools[pairIndex].findIndex(c => c.id === club.id);
                            return (
                            <div key={club.id} className="flex items-center gap-1">
                              <Button
                                variant={selectedClub?.id === club.id ? "gaming" : "ghost"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  selectClub(pairIndex as 0 | 1, club);
                                }}
                                className="justify-between h-auto py-2 px-3 flex-1"
                              >
                                <span className="font-medium truncate">{club.name}</span>
                                <div className="flex items-center gap-2">
                                  {recycledClubIds.has(club.id) && (
                                    <Badge variant="outline" className="text-xs bg-amber-500/20 text-amber-400 border-amber-500/30">
                                      ♻️
                                    </Badge>
                                  )}
                                  <Badge variant="secondary" className="text-xs ltr-numbers">
                                    {club.isPrime ? 'Pr' : `${getDisplayStars(club)}★`}
                                  </Badge>
                                  {club.isNational && (
                                    <Badge variant="outline" className="text-xs">נבח׳</Badge>
                                  )}
                                </div>
                              </Button>
                              {/* Swap button */}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 flex-shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  setClubToSwap({ club, pairIndex: pairIndex as 0 | 1, clubIndex: originalIndex >= 0 ? originalIndex : clubIdx });
                                  setShowSwapDialog(true);
                                }}
                                title="החלף קבוצה"
                              >
                                <RefreshCw className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                              </Button>
                            </div>
                          )})}
                          {filtered.length === 0 && (
                            <p className="text-xs text-muted-foreground text-center py-2">אין קבוצות זמינות</p>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}

            {/* Voice Result Entry - prominent button below team selection */}
            {currentMatch && !currentRoundData?.completed && (
              <VoiceResultEntry
                currentPairs={currentRoundPairs}
                availableClubs={[...originalTeamPools[0], ...originalTeamPools[1]]}
                allClubs={clubsWithOverrides}
                onApplyResults={applyVoiceResults}
                disabled={!currentMatch || !!currentRoundData?.completed}
              />
            )}

            {/* Old deadlock block removed - handled above in pre-compute */}

            {/* Loading State */}
            {!currentRoundData?.isDeciderMatch && (!teamPools[0] || !teamPools[1]) && (
              <div className="text-center text-muted-foreground py-8">
                <p>Loading teams...</p>
              </div>
            )}

            {/* Player Rankings Button & Dialog */}
            <Button 
              variant="outline" 
              className="w-full justify-between mb-2"
              onClick={() => setShowRankings(true)}
            >
              <span className="flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                דירוג שחקנים ({currentEvening.players.length})
              </span>
              <ChevronRight className="w-4 h-4" />
            </Button>
            
            <Dialog open={showRankings} onOpenChange={setShowRankings}>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Trophy className="w-5 h-5" />
                    דירוג שחקנים
                  </DialogTitle>
                </DialogHeader>
                <div className="overflow-x-auto">
                {(() => {
                  // Define match info type
                  type MatchInfo = {
                    roundNumber: number;
                    partnerName: string;
                    myClub: Club;
                    opponentClub: Club;
                    opponentNames: string;
                    score: [number, number];
                    result: 'win' | 'draw' | 'loss';
                  };
                  
                  // Calculate player stats with wins/draws/losses and match history
                  const statsMap = new Map<string, { 
                    player: typeof currentEvening.players[0]; 
                    wins: number; 
                    draws: number; 
                    losses: number;
                    goalsFor: number; 
                    goalsAgainst: number;
                    matches: MatchInfo[];
                  }>();
                  
                  currentEvening.players.forEach(player => {
                    statsMap.set(player.id, { player, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, matches: [] });
                  });
                  
                  currentEvening.rounds.forEach((round, roundIdx) => {
                    round.matches.forEach(match => {
                      if (match.completed && match.score) {
                        const [score1, score2] = match.score;
                        const [pair1, pair2] = match.pairs;
                        const isDraw = score1 === score2;
                        const pair1Wins = score1 > score2;
                        const pair2Wins = score2 > score1;
                        
                        // Update stats for pair1 players
                        pair1.players.forEach(p => {
                          const s = statsMap.get(p.id);
                          if (s) { 
                            s.goalsFor += score1; 
                            s.goalsAgainst += score2;
                            if (isDraw) s.draws++;
                            else if (pair1Wins) s.wins++;
                            else s.losses++;
                            
                            // Add match info
                            const partner = pair1.players.find(pl => pl.id !== p.id);
                            s.matches.push({
                              roundNumber: roundIdx + 1,
                              partnerName: partner?.name || '',
                              myClub: match.clubs[0],
                              opponentClub: match.clubs[1],
                              opponentNames: pair2.players.map(pl => pl.name).join(' + '),
                              score: [score1, score2],
                              result: isDraw ? 'draw' : pair1Wins ? 'win' : 'loss'
                            });
                          }
                        });
                        
                        // Update stats for pair2 players
                        pair2.players.forEach(p => {
                          const s = statsMap.get(p.id);
                          if (s) { 
                            s.goalsFor += score2; 
                            s.goalsAgainst += score1;
                            if (isDraw) s.draws++;
                            else if (pair2Wins) s.wins++;
                            else s.losses++;
                            
                            // Add match info
                            const partner = pair2.players.find(pl => pl.id !== p.id);
                            s.matches.push({
                              roundNumber: roundIdx + 1,
                              partnerName: partner?.name || '',
                              myClub: match.clubs[1],
                              opponentClub: match.clubs[0],
                              opponentNames: pair1.players.map(pl => pl.name).join(' + '),
                              score: [score2, score1],
                              result: isDraw ? 'draw' : pair2Wins ? 'win' : 'loss'
                            });
                          }
                        });
                      }
                    });
                  });
                  
                  const sortedStats = Array.from(statsMap.values())
                    .sort((a, b) => b.wins - a.wins || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst));
                  
                  const togglePlayer = (playerId: string) => {
                    setExpandedPlayerIds(prev => {
                      const next = new Set(prev);
                      if (next.has(playerId)) {
                        next.delete(playerId);
                      } else {
                        next.add(playerId);
                      }
                      return next;
                    });
                  };
                  
                  return (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">שחקן</TableHead>
                          <TableHead className="text-center">נצ׳</TableHead>
                          <TableHead className="text-center">תיקו</TableHead>
                          <TableHead className="text-center">הפס׳</TableHead>
                          <TableHead className="text-center">למע׳</TableHead>
                          <TableHead className="text-center">נגד</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedStats.map((stats, idx) => {
                          const isExpanded = expandedPlayerIds.has(stats.player.id);
                          return (
                            <>
                              <TableRow 
                                key={stats.player.id} 
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => togglePlayer(stats.player.id)}
                              >
                                <TableCell className="text-right font-medium">
                                  <div className="flex items-center gap-1">
                                    {isExpanded ? (
                                      <ChevronDown className="w-3 h-3 text-muted-foreground" />
                                    ) : (
                                      <ChevronRight className="w-3 h-3 text-muted-foreground" />
                                    )}
                                    {idx === 0 && stats.wins > 0 && <Trophy className="w-3 h-3 text-yellow-500" />}
                                    {stats.player.name}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center font-bold text-green-500">{stats.wins}</TableCell>
                                <TableCell className="text-center text-muted-foreground">{stats.draws}</TableCell>
                                <TableCell className="text-center text-red-500">{stats.losses}</TableCell>
                                <TableCell className="text-center text-muted-foreground">{stats.goalsFor}</TableCell>
                                <TableCell className="text-center text-muted-foreground">{stats.goalsAgainst}</TableCell>
                              </TableRow>
                              {isExpanded && stats.matches.length > 0 && (
                                <TableRow key={`${stats.player.id}-matches`}>
                                  <TableCell colSpan={6} className="p-0 bg-muted/30">
                                    <div className="px-4 py-2 space-y-1.5 text-xs">
                                      {stats.matches.map((m, mIdx) => (
                                        <div key={mIdx} className="flex items-center gap-2 text-muted-foreground">
                                          <Badge variant="outline" className="text-[10px] px-1">ס{m.roundNumber}</Badge>
                                          <span className="font-medium text-foreground">{stats.player.name}+{m.partnerName}</span>
                                          <span className="text-muted-foreground">({m.myClub?.name} {m.myClub?.isPrime ? 'Pr' : `${m.myClub?.stars}★`})</span>
                                          <span className="text-muted-foreground">vs</span>
                                          <span>{m.opponentNames}</span>
                                          <span className="text-muted-foreground">({m.opponentClub?.name} {m.opponentClub?.isPrime ? 'Pr' : `${m.opponentClub?.stars}★`})</span>
                                          <span className="font-bold ml-auto">
                                            {m.score[0]}:{m.score[1]}
                                          </span>
                                          <span className={m.result === 'win' ? 'text-green-500' : m.result === 'loss' ? 'text-red-500' : 'text-yellow-500'}>
                                            {m.result === 'win' ? '✓' : m.result === 'loss' ? '✗' : '='}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </>
                          );
                        })}
                      </TableBody>
                    </Table>
                  );
                })()}
                </div>
              </DialogContent>
            </Dialog>

            {/* Match History with Edit/Delete */}
            {currentRoundData && currentRoundData.matches.filter(m => m.completed).length > 0 && (
              <div className="space-y-2 mt-3">
                <h3 className="text-sm font-medium text-muted-foreground">משחקים שהושלמו בסיבוב</h3>
                {currentRoundData.matches.filter(m => m.completed).map((match, idx) => (
                  <Card key={match.id} className="bg-gaming-surface border-border/30 p-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex-1">
                        <span className="text-foreground">{match.clubs[0]?.name}</span>
                        <span className="text-neon-green font-bold mx-2">{match.score?.[0]}-{match.score?.[1]}</span>
                        <span className="text-foreground">{match.clubs[1]?.name}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                          setEditingMatch(match);
                          setEditScore1(match.score?.[0] ?? 0);
                          setEditScore2(match.score?.[1] ?? 0);
                        }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteMatch(match.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Edit Match Dialog */}
            <Dialog open={!!editingMatch} onOpenChange={(open) => { if (!open) setEditingMatch(null); }}>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>עריכת תוצאה</DialogTitle>
                </DialogHeader>
                {editingMatch && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center gap-4">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">{editingMatch.clubs[0]?.name}</p>
                        <Input
                          type="number"
                          min={0}
                          value={editScore1}
                          onChange={(e) => setEditScore1(parseInt(e.target.value) || 0)}
                          className="w-16 text-center"
                        />
                      </div>
                      <span className="text-neon-green font-bold">-</span>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">{editingMatch.clubs[1]?.name}</p>
                        <Input
                          type="number"
                          min={0}
                          value={editScore2}
                          onChange={(e) => setEditScore2(parseInt(e.target.value) || 0)}
                          className="w-16 text-center"
                        />
                      </div>
                    </div>
                    <Button variant="gaming" className="w-full" onClick={() => editMatchResult(editingMatch.id, editScore1, editScore2)}>
                      שמור שינויים
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        )}

        {gamePhase === 'countdown' && (
          <div className="text-center space-y-6">
            <h2 className="text-lg font-semibold text-foreground">Get Ready to Play!</h2>
            
            {/* Selected Teams */}
            <div className="grid grid-cols-2 gap-4">
              {selectedClubs.map((club, index) => (
                club && (
                  <Card key={index} className="bg-gaming-surface border-neon-green/30 p-3">
                    <p className="text-xs text-muted-foreground mb-1">
                      {currentMatch?.pairs[index].players.map(p => p.name).join(' + ')}
                    </p>
                    <p className="font-semibold text-neon-green text-sm">{club.name}</p>
                  </Card>
                )
              ))}
            </div>

            {/* Countdown */}
            <Card className="bg-gradient-card border-neon-green/20 p-8 shadow-glow">
              <div className="text-center">
                <Clock className="h-12 w-12 text-neon-green mx-auto mb-4 animate-glow-pulse" />
                <div className="text-4xl font-bold text-neon-green mb-4">
                  {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
                </div>
                <div className="flex justify-center gap-4">
                  <Button variant="gaming" onClick={toggleCountdown}>
                    {isCountdownActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {isCountdownActive ? 'Pause' : 'Start'}
                  </Button>
                  <Button variant="outline" onClick={resetCountdown}>
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </Button>
                  <Button variant="outline" onClick={undoTeamSelection}>
                    <RotateCcw className="h-4 w-4" />
                    בטל בחירה
                  </Button>
                </div>
              </div>
            </Card>

            <Button 
              variant="neon" 
              onClick={() => setGamePhase('result-entry')}
              className="w-full"
            >
              Skip to Result Entry
            </Button>
          </div>
        )}

        {gamePhase === 'result-entry' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-center text-foreground">Enter Match Result</h2>
            
            {/* Selected Teams Display */}
            <div className="grid grid-cols-2 gap-4">
              {selectedClubs.map((club, index) => (
                club && (
                  <Card key={index} className="bg-gaming-surface border-neon-green/30 p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">
                      {currentMatch?.pairs[index].players.map(p => p.name).join(' + ')}
                    </p>
                    <p className="font-semibold text-neon-green">{club.name}</p>
                  </Card>
                )
              ))}
            </div>

            {/* Actions */}
            <div className="flex justify-center">
              <Button variant="outline" onClick={undoTeamSelection}>בטל בחירה</Button>
            </div>

            {/* Dice Score Input */}
            <DiceScoreInput onSubmit={submitResult} />
          </div>
        )}
        </div>{/* End Scrollable Content Area */}

        {/* Share Code Dialog */}
        <Dialog open={showShareCodeDialog} onOpenChange={setShowShareCodeDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>קוד שיתוף לערב</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                שתפו את הקוד עם המשתתפים כדי להצטרף לערב ולצפות בזמן אמת.
              </p>
              {shareCode && (
                <Button
                  variant="outline"
                  onClick={() => { navigator.clipboard.writeText(shareCode); toast({ title: "הקוד הועתק", description: shareCode }); }}
                >
                  קוד: {shareCode}
                </Button>
              )}
              <Button onClick={() => setShowShareCodeDialog(false)} className="w-full">
                סגור
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Round Winner Dialog */}
        <Dialog open={showRoundWinnerDialog} onOpenChange={setShowRoundWinnerDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 justify-center">
                <Crown className="w-6 h-6 text-yellow-500" />
                Round Complete!
              </DialogTitle>
            </DialogHeader>
            <div className="text-center py-6">
              <div className="text-lg font-bold text-primary mb-4">
                {roundWinnerMessage}
              </div>
              <Button onClick={handleRoundWinnerConfirm} className="w-full">
                Continue to Next Round
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Club Swap Dialog */}
        {clubToSwap && (
          <ClubSwapDialog
            open={showSwapDialog}
            onOpenChange={(open) => {
              setShowSwapDialog(open);
              if (!open) setClubToSwap(null);
            }}
            clubToSwap={clubToSwap.club}
            currentPoolClubIds={originalTeamPools[clubToSwap.pairIndex].map(c => c.id)}
            otherPoolClubIds={originalTeamPools[clubToSwap.pairIndex === 0 ? 1 : 0].map(c => c.id)}
            usedClubIdsThisEvening={Object.keys(usedClubCounts).filter(id => (usedClubCounts[id] ?? 0) >= 1)}
            onSwap={handleSwapClub}
            clubsWithOverrides={clubsWithOverrides}
          />
        )}
      </div>
    </div>
  );
};
