import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { TeamDashboard } from "@/components/TeamDashboard";
import { EveningSetup } from "@/components/EveningSetup";
import { TournamentTypeSelection } from "@/components/TournamentTypeSelection";
import { SinglesSetup } from "@/components/SinglesSetup";
import { TournamentGame } from "@/components/TournamentGame";
import { EveningSummary } from "@/components/EveningSummary";
import { TournamentHistory, EveningWithTeam } from "@/components/TournamentHistory";
import { JoinEvening } from "@/components/JoinEvening";
import { Evening, Player, Club, Pair } from "@/types/tournament";
import { StorageService } from "@/services/storageService";
import { RemoteStorageService } from "@/services/remoteStorageService";
import { useToast } from "@/hooks/use-toast";
import FitToScreen from "@/components/FitToScreen";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { TeamsManager } from "@/components/TeamsManager";
import { FindTeam } from "@/components/FindTeam";
import { TournamentEngine } from "@/services/tournamentEngine";
import { SinglesClubAssignment } from "@/components/SinglesClubAssignment";
import { SinglesMatchSchedule } from "@/components/SinglesMatchSchedule";
import { SinglesGameLive } from "@/components/SinglesGameLive";
import { useActiveEveningPersistence } from "@/hooks/useActiveEveningPersistence";
import { useIsMobile } from "@/hooks/use-mobile";
import { getClubsWithOverrides, FIFA_CLUBS } from "@/data/clubs";
import { PairsGameModeSelection } from "@/components/PairsGameModeSelection";
import { TierQuestionFlow } from "@/components/TierQuestionFlow";
import { FPSetup } from "@/components/FPSetup";
import { FPGame } from "@/components/FPGame";
import { FPSummary } from "@/components/FPSummary";
import { FPEvening } from "@/types/fivePlayerTypes";
import { createFPEvening } from "@/services/fivePlayerEngine";
import { FPBankOverview } from "@/components/FPBankOverview";
import { useTeam } from "@/contexts/TeamContext";
import { FPTeamSelection } from "@/components/FPTeamSelection";

type AppState = 'home' | 'setup' | 'tournament-type' | 'singles-setup' | 'singles-clubs' | 'singles-schedule' | 'game' | 'summary' | 'history' | 'teams' | 'find-team' | 'join' | 'pairs-mode-selection' | 'tier-question-flow' | 'fp-team-selection' | 'fp-setup' | 'fp-bank-overview' | 'fp-game' | 'fp-summary';
type TeamEveningEditReason = "owner_admin" | "playing" | "view_only" | null;
type MatchScoreSubmission = {
  roundIndex: number | null;
  matchIndex: number;
  scoreA: number;
  scoreB: number;
  clubA?: Club | null;
  clubB?: Club | null;
};

const hasMatchScore = (match: any, key = "score") =>
  Array.isArray(match?.[key]) || typeof match?.[key] === "number";

const sameScore = (a: any, b: any) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const getFirstTimeRegularScoreSubmission = (previous: Evening | null, next: Evening): MatchScoreSubmission | null => {
  if (!previous || previous.id !== next.id || (previous as any).completed !== (next as any).completed) {
    return null;
  }

  if (Array.isArray((previous as any).schedule) || Array.isArray((next as any).schedule)) {
    return null;
  }

  let submission: MatchScoreSubmission | null = null;

  if (previous.type === "singles" || next.type === "singles") {
    const oldGames = previous.gameSequence ?? [];
    const newGames = next.gameSequence ?? [];
    if (oldGames.length !== newGames.length) return null;

    for (let i = 0; i < oldGames.length; i += 1) {
      const oldGame = oldGames[i] as any;
      const newGame = newGames[i] as any;
      const oldHasScore = hasMatchScore(oldGame);
      const newHasScore = hasMatchScore(newGame);
      if (oldHasScore && !sameScore(oldGame.score, newGame.score)) return null;
      if (!oldHasScore && newHasScore) {
        if (submission || !Array.isArray(newGame.score)) return null;
        submission = {
          roundIndex: null,
          matchIndex: i,
          scoreA: newGame.score[0],
          scoreB: newGame.score[1],
        };
      }
    }
    return submission;
  }

  const oldRounds = previous.rounds ?? [];
  const newRounds = next.rounds ?? [];
  if (oldRounds.length !== newRounds.length) return null;

  for (let i = 0; i < oldRounds.length; i += 1) {
    const oldMatches = oldRounds[i]?.matches ?? [];
    const newMatches = newRounds[i]?.matches ?? [];
    if (oldMatches.length !== newMatches.length) return null;

    for (let j = 0; j < oldMatches.length; j += 1) {
      const oldMatch = oldMatches[j] as any;
      const newMatch = newMatches[j] as any;
      const oldHasScore = hasMatchScore(oldMatch);
      const newHasScore = hasMatchScore(newMatch);
      if (oldHasScore && !sameScore(oldMatch.score, newMatch.score)) return null;
      if (!oldHasScore && newHasScore) {
        if (submission || !Array.isArray(newMatch.score)) return null;
        submission = {
          roundIndex: i,
          matchIndex: j,
          scoreA: newMatch.score[0],
          scoreB: newMatch.score[1],
          clubA: newMatch.clubs?.[0] ?? null,
          clubB: newMatch.clubs?.[1] ?? null,
        };
      }
    }
  }

  return submission;
};

const hasCompletedGamesAnyMode = (evening: any): boolean => {
  if (!evening) return false;

  if (Array.isArray(evening.schedule)) {
    return evening.schedule.some((match: any) =>
      match?.completed === true &&
      match.scoreA !== null &&
      match.scoreA !== undefined &&
      match.scoreB !== null &&
      match.scoreB !== undefined
    );
  }

  if (Array.isArray(evening.gameSequence)) {
    return evening.gameSequence.some((game: any) =>
      game?.completed === true &&
      Array.isArray(game.score)
    );
  }

  if (Array.isArray(evening.rounds)) {
    return evening.rounds.some((round: any) =>
      Array.isArray(round.matches) &&
      round.matches.some((match: any) =>
        match?.completed === true &&
        Array.isArray(match.score)
      )
    );
  }

  return false;
};

const Index = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { activeTeamId: contextTeamId } = useTeam();
  const [appState, setAppState] = useState<AppState>('home');
  const [currentEvening, setCurrentEvening] = useState<Evening | null>(null);
  const [tournamentHistory, setTournamentHistory] = useState<EveningWithTeam[]>([]);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [isAuthed, setIsAuthed] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [currentTeamId, setCurrentTeamId] = useState<string | null>(null);
  const [currentTeamEditReason, setCurrentTeamEditReason] = useState<TeamEveningEditReason>(null);
  const [singlesFlowState, setSinglesFlowState] = useState<'club-assignment' | 'match-schedule' | 'game'>('club-assignment');
  const [selectedTournamentType, setSelectedTournamentType] = useState<'pairs' | 'singles' | null>(null);
  const [clubsWithOverrides, setClubsWithOverrides] = useState<Club[]>(FIFA_CLUBS);
  const [pendingPairsPlayers, setPendingPairsPlayers] = useState<Player[] | null>(null);
  const [pendingWinsToComplete, setPendingWinsToComplete] = useState<number>(4);
  const [pendingTeamId, setPendingTeamId] = useState<string | undefined>(undefined);
  const [pendingRoundIndex, setPendingRoundIndex] = useState<number>(0);
  // 5-Player Doubles state
  const [fpEvening, setFpEvening] = useState<FPEvening | null>(null);
  const [fpTeamId, setFpTeamId] = useState<string | null>(null);
  const [fpDeadlockPlayers, setFpDeadlockPlayers] = useState<Player[] | null>(null);
  const [showFpDeadlock, setShowFpDeadlock] = useState(false);
  const [teamPlayersForFP, setTeamPlayersForFP] = useState<Player[] | null>(null);
  const [fpSelectedTeamName, setFpSelectedTeamName] = useState<string | null>(null);
  const [activeTeamEvenings, setActiveTeamEvenings] = useState<Awaited<ReturnType<typeof RemoteStorageService.listActiveEveningsForMyTeams>>>([]);
  const [routeTeamId, setRouteTeamId] = useState<string | null>(null);

   // Navigation helper that also pushes into browser history so Back goes to previous screen
  function goTo(next: AppState) {
    if (window.history.state?.appState !== next) {
      window.history.pushState({ appState: next }, "", "");
    }
    setAppState(next);
  }
  
  const { persistNow: persistActiveEveningNow, clearActive: clearActiveEvening } = useActiveEveningPersistence({
    currentEvening,
  });
  
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const screen = params.get("screen");
    const teamId = params.get("teamId");
    const openEvening = params.get("openEvening");
  
    if (openEvening) {
      RemoteStorageService.loadEveningById(openEvening)
        .then(async (evening) => {
          if (!evening) {
            toast({
              title: "לא ניתן לפתוח טורניר",
              description: "הטורניר לא נמצא או שכבר אינו פעיל.",
              variant: "destructive",
            });
            return;
          }
  
          if ((evening as any).cancelled || evening.completed) {
            toast({
              title: "הטורניר כבר הסתיים",
              variant: "destructive",
            });
            return;
          }
  
          const isFP = Array.isArray((evening as any)?.schedule);

          let editReason: TeamEveningEditReason = "playing";
          const teamId = (evening as any)._team_id || null;
          
          if (teamId && RemoteStorageService.isEnabled()) {
            try {
              const memberStatus = await RemoteStorageService.getMyTeamMemberStatus(teamId);
              const role = memberStatus?.role;
              if (role === "owner" || role === "admin") {
                editReason = "owner_admin";
              }
            } catch (error: any) {
              console.warn("Failed to resolve openEvening permissions:", error?.message || error);
            }
          }
          
          if (isFP) {
            setFpEvening(evening as any);
            setFpTeamId(teamId);
            StorageService.saveFPActive(evening as any);
            setCurrentTeamEditReason(editReason);
            setAppState("fp-game");
          } else {
            setCurrentEvening(evening);
            setCurrentTeamId(teamId);
            persistActiveEveningNow(evening);
            setCurrentTeamEditReason(editReason);
            setAppState("game");
          }
  
          window.history.replaceState(
            { appState: isFP ? "fp-game" : "game" },
            "",
            window.location.pathname
          );
        })
        .catch((error) => {
          console.error("openEvening failed:", error?.message || error);
          toast({
            title: "שגיאה בפתיחת הטורניר",
            description: "לא ניתן לפתוח את הטורניר כרגע.",
            variant: "destructive",
          });
        });
  
      return;
    }
  
    if (screen === "teams") {
      setRouteTeamId(teamId);
      setAppState("teams");
  
      window.history.replaceState(
        { appState: "teams" },
        "",
        window.location.pathname
      );
    }
  }, [location.search, toast, persistActiveEveningNow]);

  // Ref to access latest currentEvening inside realtime callbacks (avoids stale closures)
  const currentEveningRef = useRef(currentEvening);
  useEffect(() => {
    currentEveningRef.current = currentEvening;
  }, [currentEvening]);

useEffect(() => {
    let mounted = true;

    // Load active regular tournament
    const active = StorageService.loadActiveEvening();
    if (active && !active.completed) {
      setCurrentEvening(active);
    }
    // Load active FP tournament
    const fpActive = StorageService.loadFPActive();
    if (fpActive && !fpActive.completed) {
      setFpEvening(fpActive);
      // Auto-detect team for FP players
      if (RemoteStorageService.isEnabled()) {
        RemoteStorageService.ensureTeamForPlayers(fpActive.players, 5)
          .then((tid) => { if (mounted && tid) setFpTeamId(tid); })
          .catch(() => {});
      }
    } else {
      // Even if no active FP, detect team from last saved FP evening for Hub link
      const fpHistory = StorageService.loadFPEvenings();
      if (fpHistory.length > 0 && RemoteStorageService.isEnabled()) {
        RemoteStorageService.ensureTeamForPlayers(fpHistory[0].players, 5)
          .then((tid) => { if (mounted && tid) setFpTeamId(tid); })
          .catch(() => {});
      }
    }

    const loadHistory = async () => {
      try {
        const local = StorageService.loadEvenings();
        let remote: EveningWithTeam[] = [];
        if (RemoteStorageService.isEnabled()) {
          remote = await RemoteStorageService.loadEveningsWithTeams();
        }
        if (!mounted) return;
        setTournamentHistory(remote.length ? remote : local);
      } catch (e) {
        setTournamentHistory(StorageService.loadEvenings());
      }
    };

    loadHistory();

    // Initialize history state and popstate handler
    if (!window.history.state || !window.history.state.appState) {
      window.history.replaceState({ appState: 'home' }, '', '');
    }
    const onPop = (e: PopStateEvent) => {
      const state = (e.state?.appState as AppState) || 'home';
      setAppState(state);
    };
    window.addEventListener('popstate', onPop);
    return () => {
      mounted = false;
      window.removeEventListener('popstate', onPop);
    };
  }, []);

  // Load clubs with database overrides on mount
  useEffect(() => {
    getClubsWithOverrides().then(setClubsWithOverrides);
  }, []);

  // Auth state listener for header logout/login
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthed(!!session?.user);
      setUserEmail(session?.user?.email ?? null);
    });
    supabase.auth.getSession().then(({ data }) => {
      setIsAuthed(!!data.session?.user);
      setUserEmail(data.session?.user?.email ?? null);
      setAuthLoading(false);
    }).catch(() => {
      setAuthLoading(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Load active tournaments across the user's teams when on home
  useEffect(() => {
    if (!isAuthed || appState !== 'home') return;
    let mounted = true;
    RemoteStorageService.listActiveEveningsForMyTeams()
      .then((list) => { if (mounted) setActiveTeamEvenings(list); })
      .catch(() => { if (mounted) setActiveTeamEvenings([]); });
    return () => { mounted = false; };
  }, [isAuthed, appState, currentEvening?.id, fpEvening?.id]);

  useEffect(() => {
    if (!isAuthed || !RemoteStorageService.isEnabled()) return;
  
    const shouldRefreshLive =
      appState === "home" ||
      appState === "game" ||
      appState === "fp-game";
  
    if (!shouldRefreshLive) return;
  
    let cancelled = false;
  
    const refreshActiveEvenings = async () => {
      try {
        const list = await RemoteStorageService.listActiveEveningsForMyTeams();
  
        if (cancelled) return;
  
        setActiveTeamEvenings(list);
  
        if (currentEvening?.id) {
          const updatedRegular = list.find(
            (entry) =>
              entry.evening_id === currentEvening.id &&
              !Array.isArray((entry.evening as any)?.schedule)
          );
  
          if (updatedRegular) {
            setCurrentEvening(updatedRegular.evening);
            setCurrentTeamId(updatedRegular.team_id);
            setCurrentTeamEditReason(updatedRegular.reason);
          }
        }
  
        if (fpEvening?.id) {
          const updatedFP = list.find(
            (entry) =>
              entry.evening_id === fpEvening.id &&
              Array.isArray((entry.evening as any)?.schedule)
          );
  
          if (updatedFP) {
            const latestFpEvening = updatedFP.evening as any;
  
            setFpEvening(latestFpEvening);
            setFpTeamId(updatedFP.team_id);
            setCurrentTeamEditReason(updatedFP.reason);
            StorageService.saveFPActive(latestFpEvening);
          }
        }
      } catch (error: any) {
        console.warn("Failed to refresh active team evenings:", error?.message || error);
      }
    };
  
    refreshActiveEvenings();
  
    const intervalId = window.setInterval(refreshActiveEvenings, 2500);
  
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isAuthed, appState, currentEvening?.id, fpEvening?.id]);

  const handleOpenTeamEvening = (entry: typeof activeTeamEvenings[number]) => {
    if (entry.can_edit) {
      const isFP = Array.isArray((entry.evening as any)?.schedule);
      if (isFP) {
        const evening = entry.evening as unknown as FPEvening;
        setFpEvening(evening);
        setFpTeamId(entry.team_id);
        setCurrentTeamEditReason(entry.reason);
        StorageService.saveFPActive(evening);
        goTo('fp-game');
      } else {
        setCurrentEvening(entry.evening);
        setCurrentTeamId(entry.team_id);
        setCurrentTeamEditReason(entry.reason);
        goTo('game');
      }
    } else {
      if (entry.share_code) {
        navigate(`/spectate/${encodeURIComponent(entry.share_code)}`);
      } else {
        console.error("Missing share code for view-only active tournament", {
          eveningId: entry.evening_id,
          teamId: entry.team_id,
        });
        toast({
          title: "לא ניתן לפתוח לצפייה",
          description: "חסר קוד צפייה לטורניר הזה.",
          variant: "destructive",
        });
      }
    }
  };

  useEffect(() => {
    if (currentEvening?.id) {
      const entry = activeTeamEvenings.find((item) => item.evening_id === currentEvening.id);
      if (entry && !Array.isArray((entry.evening as any)?.schedule)) {
        setCurrentEvening(entry.evening);
        setCurrentTeamId(entry.team_id);
        setCurrentTeamEditReason(entry.reason);
      }
    }
    if (fpEvening?.id) {
      const entry = activeTeamEvenings.find((item) => item.evening_id === fpEvening.id);
      if (entry && Array.isArray((entry.evening as any)?.schedule)) {
        setFpEvening(entry.evening as any);
        setFpTeamId(entry.team_id);
        setCurrentTeamEditReason(entry.reason);
      }
    }
  }, [activeTeamEvenings, currentEvening?.id, fpEvening?.id]);

  const getCancelledByName = (evening: Evening | FPEvening | any) =>
    evening?.cancelled_by_name || "משתמש מורשה";

  const handleCancelledEvening = (evening: Evening | FPEvening | any) => {
    toast({
      title: `הטורניר הופסק על ידי ${getCancelledByName(evening)}`,
    });
    clearActiveEvening();
    StorageService.clearFPActive();
    setCurrentEvening(null);
    setFpEvening(null);
    setCurrentTeamEditReason(null);
    goTo('home');
  };

  const handleStopTournament = async (eveningId: string, kind: "regular" | "fp" = "regular") => {
    try {
      const localEvening = kind === "fp" ? fpEvening : currentEvening;
      const hasGames = hasCompletedGamesAnyMode(localEvening);
  
      let cancelled: any = null;
  
      if (hasGames) {
        cancelled = await RemoteStorageService.cancelTeamEvening(eveningId);
      } else {
        await RemoteStorageService.deleteEvening(eveningId);
      }
      if (kind === "fp") {
        StorageService.clearFPActive();
        setFpEvening(null);
      } else {
        clearActiveEvening();
        setCurrentEvening(null);
      }
      setCurrentTeamEditReason(null);
      toast({ title: "הטורניר הופסק" });
      goTo('home');
      return cancelled;
    } catch (error: any) {
      console.error("cancelTeamEvening failed:", error?.message || error);
      toast({
        title: "שגיאה בהפסקת הטורניר",
        description: error?.message || "לא ניתן להפסיק את הטורניר כרגע.",
        variant: "destructive",
      });
      return null;
    }
  };

  const handleResumeActiveTournament = async (kind: "regular" | "fp") => {
    const eveningId = kind === "fp" ? fpEvening?.id : currentEvening?.id;
    if (!eveningId) return;

    // Resolve role/team from the active team evenings list so that linked
    // players resume as participants (not view-only) and the correct team_id
    // is attached for live sync. Falls through to raw load if no entry exists.
    const entry = activeTeamEvenings.find((e) => e.evening_id === eveningId);
    if (entry) {
      handleOpenTeamEvening(entry);
      return;
    }

    try {
      const latest = await RemoteStorageService.loadEveningById(eveningId);
      if (!latest) {
        throw new Error("Evening not found");
      }
      if ((latest as any).cancelled) {
        handleCancelledEvening(latest);
        return;
      }
      if ((latest as any).completed) {
        toast({ title: "הטורניר כבר הסתיים" });
        clearActiveEvening();
        StorageService.clearFPActive();
        setCurrentEvening(null);
        setFpEvening(null);
        goTo('home');
        return;
      }
      if (kind === "fp") {
        setFpEvening(latest as any);
        StorageService.saveFPActive(latest as any);
        goTo('fp-game');
      } else {
        setCurrentEvening(latest);
        persistActiveEveningNow(latest);
        goTo('game');
      }
    } catch (error: any) {
      console.error("load latest active evening failed:", error?.message || error);
      toast({
        title: "שגיאה בטעינת הטורניר",
        description: "לא ניתן לטעון את מצב הטורניר העדכני.",
        variant: "destructive",
      });
    }
  };

  // Realtime + polling sync: keep current live tournament updated while in game state
  useEffect(() => {
    if (appState !== 'game' || !currentEvening) return;
  
    let disposed = false;
  
    // Helpers for realtime/polling conflict protection.
    // A remote update is newer only if it has more completed matches,
    // or if completed count is equal but it does not lose existing match records.
    const countCompletedMatches = (e: Evening) =>
      e.rounds.reduce((sum, r) => sum + r.matches.filter(m => m.completed).length, 0);
  
    const countTotalMatches = (e: Evening) =>
      e.rounds.reduce((sum, r) => sum + r.matches.length, 0);
  
    const applyRemoteEvening = (remoteEvening: Evening) => {
      if (disposed) return;
  
      if ((remoteEvening as any).cancelled === true) {
        handleCancelledEvening(remoteEvening);
        return;
      }
  
      const local = currentEveningRef.current;
      if (!local) {
        setCurrentEvening(remoteEvening);
        StorageService.saveActiveEvening(remoteEvening);
        return;
      }
  
      const localProgress = countCompletedMatches(local);
      const remoteProgress = countCompletedMatches(remoteEvening);
  
      const localTotalMatches = countTotalMatches(local);
      const remoteTotalMatches = countTotalMatches(remoteEvening);
  
      const remoteIsNotStale =
        remoteProgress > localProgress ||
        (remoteProgress === localProgress && remoteTotalMatches >= localTotalMatches);
  
      // Only accept remote state if it does not remove local match records.
      // This prevents saved score updates from overwriting a newly-created next match.
      if (remoteIsNotStale) {
        setCurrentEvening(remoteEvening);
        StorageService.saveActiveEvening(remoteEvening);
      } else {
        console.warn('[Live Sync] Ignored stale remote state', {
          localProgress,
          remoteProgress,
          localTotalMatches,
          remoteTotalMatches,
        });
  
        if (currentTeamEditReason === "owner_admin" || currentTeamEditReason === null) {
          RemoteStorageService.upsertEveningLive(local).catch((error) => {
            console.error("Failed to re-push local evening after stale live update:", error?.message || error);
          });
        }
      }
    };
  
    const unsubscribe = RemoteStorageService.subscribeToEvening(
      currentEvening.id,
      applyRemoteEvening,
      () => {
        if (disposed) return;
        toast({ title: "הטורניר הופסק" });
        clearActiveEvening();
        setCurrentEvening(null);
        setCurrentTeamEditReason(null);
        goTo('home');
      }
    );
  
    // Fallback polling: Realtime is not always reliable on mobile / preview tabs.
    // This keeps all users synced without leaving and re-entering the tournament.
    const intervalId = window.setInterval(() => {
      RemoteStorageService.loadEveningById(currentEvening.id)
        .then((latest) => {
          if (!latest) return;
          applyRemoteEvening(latest);
        })
        .catch((error) => {
          console.warn("[Live Sync] Polling failed:", error?.message || error);
        });
    }, 2000);
  
    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      unsubscribe?.();
    };
  }, [appState, currentEvening?.id, currentTeamEditReason]);

  // Handle joined evening from deep link navigation
  useEffect(() => {
    const state = location.state as { joinedEveningId?: string } | null;
    if (state?.joinedEveningId) {
      // Clear the state to prevent re-triggering
      window.history.replaceState({}, '', location.pathname);
      
      // Load the joined evening and navigate to game
      const loadJoinedEvening = async () => {
        try {
          const evenings = await RemoteStorageService.loadEvenings();
          const joinedEvening = evenings.find(e => e.id === state.joinedEveningId);
          if (joinedEvening && !joinedEvening.completed) {
            setCurrentEvening(joinedEvening);
            setCurrentTeamEditReason("playing");
            goTo('game');
            toast({
              title: "הצטרפת לטורניר!",
              description: "אתה יכול לראות ולעדכן ציונים בזמן אמת",
            });
          } else if (joinedEvening?.completed) {
            toast({
              title: "הטורניר הסתיים",
              description: "הטורניר שהצטרפת אליו כבר הסתיים",
              variant: "destructive",
            });
          }
        } catch (error) {
          console.error('Error loading joined evening:', error);
        }
      };
      loadJoinedEvening();
    }
  }, [location.state]);

  const handleStartNewEvening = () => {
    clearActiveEvening();
    goTo('tournament-type');
    setCurrentEvening(null);
    setCurrentTeamEditReason(null);
    setSelectedTournamentType(null);
  };

  const handleViewHistory = () => {
    navigate("/tournaments");
  };

  const handleBackToHome = () => {
    setAppState('home');
    // Don't clear currentEvening here so we can preserve players if going back to setup
  };

  const handleBackToSetup = () => {
    setAppState('setup');
    // Keep currentEvening to preserve player data
  };

  const handleStartRandomEvening = async (players: Player[], winsToComplete: number, teamId?: string) => {
    await startEvening(players, winsToComplete, teamId);
  };

  const handleStartCustomEvening = async (players: Player[], winsToComplete: number, customTeams: [string[], string[]], teamId?: string) => {
    // TODO: Implement custom teams logic here
    // For now, just start with random mode
    await startEvening(players, winsToComplete, teamId);
  };

  const startEvening = async (players: Player[], winsToComplete: number, teamId?: string) => {
    // Generate a deterministic pairs schedule once and persist it to the evening to avoid changes on navigation
    const pairSchedule = TournamentEngine.generatePairs(players);

    const newEvening: Evening = {
      id: `evening-${Date.now()}`,
      date: new Date().toISOString(),
      players,
      rounds: [],
      winsToComplete,
      completed: false,
      type: 'pairs', // Explicitly set as pairs tournament
      pairSchedule,
      teamSelectionMode: 'random', // Random mode (tier-question mode handled separately)
    };

    // Persist immediately so iOS backgrounding won't reset an in-progress tournament
    persistActiveEveningNow(newEvening);

    // Determine team automatically if not provided
    let effectiveTeamId = teamId ?? currentTeamId ?? contextTeamId ?? null;
    if (!effectiveTeamId && RemoteStorageService.isEnabled()) {
      try {
        effectiveTeamId = await RemoteStorageService.ensureTeamForPlayers(players);
      } catch {}
    }

    setCurrentEvening(newEvening);
    setCurrentTeamId(effectiveTeamId);
    setCurrentTeamEditReason("owner_admin");
    // Create via server-side RPC (enforces one active evening per team)
    try {
      await RemoteStorageService.createTeamEvening(newEvening, effectiveTeamId);
    } catch (err: any) {
      if (err?.message?.includes('team already has an active evening')) {
        console.warn('Team already has an active evening – creation blocked');
        // TODO: surface a toast to the user in a future iteration
      }
      // Still let them proceed locally for now
    }
    
    goTo('game');
  };

  const handleCompleteEvening = (evening: Evening) => {
    // Completed evenings should not auto-resume into game
    clearActiveEvening();
    setCurrentEvening(evening);
    goTo('summary');
  };

 const handleSaveToHistory = async (evening: Evening) => {
     // Do not save empty tournaments (no completed matches)
     if (!TournamentEngine.hasCompletedGames(evening)) return;

     // Ensure rankings are saved (TournamentHistory relies on `evening.rankings`)
     const eveningToSave: Evening = evening.rankings
       ? evening
       : { ...evening, rankings: TournamentEngine.calculateRankings(TournamentEngine.calculatePlayerStats(evening)) };

     try {
       // Ensure we have a team id so team history + leaderboard work
       let effectiveTeamId = currentTeamId ?? null;
       if (!effectiveTeamId && RemoteStorageService.isEnabled()) {
         try {
           effectiveTeamId = await RemoteStorageService.ensureTeamForPlayers(eveningToSave.players);
         } catch {}
       }

       if (RemoteStorageService.isEnabled()) {
         await RemoteStorageService.saveEveningWithTeam(eveningToSave, effectiveTeamId);
         // Trigger server-side stats calculation so Teams leaderboard updates
         await RemoteStorageService.syncStats(eveningToSave.id);
       }

       StorageService.saveEvening(eveningToSave);
       clearActiveEvening();
     } finally {
       // IMPORTANT: if user isn't authenticated, remote load returns [] – fallback to local.
       const local = StorageService.loadEvenings();
       let remote: Evening[] = [];
       if (RemoteStorageService.isEnabled()) {
         try {
           remote = await RemoteStorageService.loadEvenings();
         } catch {
           remote = [];
         }
       }
       setTournamentHistory(remote.length ? remote : local);
     }
   };

  const handleDeleteEvening = async (eveningId: string) => {
    if (RemoteStorageService.isEnabled()) {
      try {
        await RemoteStorageService.deleteEvening(eveningId);
        toast({ title: "הטורניר נמחק בהצלחה" });
      } catch (e: any) {
        toast({ 
          title: "שגיאה במחיקה", 
          description: e.message || "לא ניתן למחוק את הטורניר",
          variant: "destructive" 
        });
        return; // Don't update local state if remote delete failed
      }
    }
    // Keep local history in sync
    StorageService.deleteEvening(eveningId);
    const local = StorageService.loadEvenings();
    let remote: Evening[] = [];
    if (RemoteStorageService.isEnabled()) {
      try {
        remote = await RemoteStorageService.loadEvenings();
      } catch {
        remote = [];
      }
    }
    setTournamentHistory(remote.length ? remote : local);
  };

const handleGoHome = () => {
    goTo('home');
  };

  const handleUpdateEvening = (evening: Evening) => {
    setCurrentEvening(evening);
  
    if (!evening.completed) {
      persistActiveEveningNow(evening);
    }
  };

  const handleSaveEveningRemote = (evening: Evening) => {
    const previousEvening = currentEveningRef.current;
    const submission = getFirstTimeRegularScoreSubmission(previousEvening, evening);
  
    if (!RemoteStorageService.isEnabled()) return;
  
    if (currentTeamEditReason === "playing") {
      if (!submission) {
        console.warn("Skipped remote save for regular player; no first-time score submission detected", {
          eveningId: evening.id,
        });
        return;
      }
  
      RemoteStorageService.submitMatchScore(evening.id, submission)
        .catch((error) => {
          console.error("submitMatchScore failed:", error?.message || error);
          toast({
            title: "שגיאה בשמירת התוצאה",
            description: error?.message || "לא ניתן לשמור את התוצאה. נסה שוב בעוד רגע.",
            variant: "destructive",
          });
        });
  
      return;
    }
  
    RemoteStorageService.upsertEveningLive(evening)
      .catch((error) => {
        console.error("upsertEveningLive failed:", error?.message || error);
        toast({
          title: "שגיאה בשמירת הטורניר",
          description: error?.message || "לא ניתן לשמור את העדכון כרגע.",
          variant: "destructive",
        });
      });
  };

  // Auth helpers available globally from home page
  const cleanupAuthState = () => {
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("supabase.auth") || key.includes("sb-")) localStorage.removeItem(key);
      });
      Object.keys(sessionStorage || {}).forEach((key) => {
        if (key.startsWith("supabase.auth") || key.includes("sb-")) sessionStorage.removeItem(key);
      });
    } catch {}
  };

  const handleSignOut = async () => {
    try {
      cleanupAuthState();
      try { await supabase.auth.signOut({ scope: "global" }); } catch {}
    } finally {
      window.location.href = "/auth";
    }
  };

  const handleCloseTournament = () => {
    if (currentEvening?.id) {
      handleStopTournament(currentEvening.id, "regular");
    }
  };

  // Handle successful join from JoinEvening component
  const handleJoinSuccess = async (eveningId: string) => {
    try {
      const evenings = await RemoteStorageService.loadEvenings();
      const joinedEvening = evenings.find(e => e.id === eveningId);
      if (joinedEvening && !joinedEvening.completed) {
        setCurrentEvening(joinedEvening);
        setCurrentTeamEditReason("playing");
        goTo('game');
        toast({
          title: "הצטרפת לטורניר!",
          description: "אתה יכול לראות ולעדכן ציונים בזמן אמת",
        });
      } else {
        toast({
          title: "הטורניר הסתיים",
          description: "הטורניר שהצטרפת אליו כבר הסתיים",
          variant: "destructive",
        });
        goTo('home');
      }
    } catch (error) {
      console.error('Error loading joined evening:', error);
      goTo('home');
    }
  };

  const renderCurrentState = () => {
    switch (appState) {
      case 'home': {
        // Determine active tournament info for dashboard
        const activeFP = fpEvening && !fpEvening.completed;
        const activeRegular = currentEvening && !currentEvening.completed;
        let tournamentMode: string | null = null;
        let tournamentProgress: string | null = null;
        if (activeFP && fpEvening) {
          tournamentMode = "ליגת 5 שחקנים";
          const completed = fpEvening.schedule.filter(m => m.scoreA !== undefined).length;
          tournamentProgress = `${completed} מתוך ${fpEvening.schedule.length} משחקים`;
        } else if (activeRegular && currentEvening) {
          tournamentMode = currentEvening.type === 'singles' ? "טורניר יחידים" : "טורניר זוגות";
          const completedMatches = currentEvening.rounds.reduce((s, r) => s + r.matches.filter(m => m.completed).length, 0);
          tournamentProgress = `${completedMatches} משחקים שהושלמו`;
        }
        const currentActiveEveningId = activeFP ? fpEvening?.id : activeRegular ? currentEvening?.id : null;
        const activeTournamentTeamName =
          currentTeamId
            ? activeTeamEvenings.find((entry) => entry.team_id === currentTeamId)?.team_name
              ?? null
            : null;

        return (
          <TeamDashboard
            onStartNew={handleStartNewEvening}
            onStartFivePlayer={() => {
              setTeamPlayersForFP(null);
              setFpTeamId(null);
              setFpSelectedTeamName(null);
              goTo('fp-team-selection');
            }}
            onStartPairs={() => { setSelectedTournamentType('pairs'); goTo('setup'); }}
            onStartSingles={() => { setSelectedTournamentType('singles'); goTo('singles-setup'); }}
            onViewHistory={handleViewHistory}
            onResume={
              activeFP
                ? () => handleResumeActiveTournament("fp")
                : activeRegular
                  ? () => handleResumeActiveTournament("regular")
                  : undefined
            }
            onCloseTournament={
              activeFP
                ? () => handleStopTournament(fpEvening!.id, "fp")
                : activeRegular
                  ? handleCloseTournament
                  : undefined
            }
            onManageTeams={() => goTo('teams')}
            onFindTeam={() => goTo('find-team')}
            isAuthed={isAuthed}
            userEmail={userEmail}
            onSignOut={handleSignOut}
            activeTournamentMode={
              activeTournamentTeamName
                ? `${tournamentMode} · ${activeTournamentTeamName}`
                : tournamentMode
            }
            activeTournamentProgress={tournamentProgress}
            activeTeamEvenings={activeTeamEvenings}
            currentActiveEveningId={currentActiveEveningId ?? null}
            authLoading={authLoading}
            onOpenTeamEvening={handleOpenTeamEvening}
          />
        );
      }
      
      case 'tournament-type':
        return (
           <TournamentTypeSelection
            onBack={() => window.history.back()}
            onSelectPairs={() => {
              setSelectedTournamentType('pairs');
              goTo('setup');
            }}
            onSelectSingles={() => {
              setSelectedTournamentType('singles');
              goTo('singles-setup');
            }}
            onSelectFivePlayer={() => {
              goTo('fp-setup');
            }}
          />
        );
      
      case 'setup':
        // This is only for pairs tournament - after setup, go to mode selection
        return (
          <EveningSetup
            onBack={() => window.history.back()}
            onStartEvening={(players: Player[], winsToComplete: number, teamId?: string) => {
              // Store pending data and go to pairs mode selection
              setPendingPairsPlayers(players);
              setPendingWinsToComplete(winsToComplete);
              setPendingTeamId(teamId);
              goTo('pairs-mode-selection');
            }}
            savedPlayers={pendingPairsPlayers || currentEvening?.players}
            savedWinsToComplete={pendingWinsToComplete || currentEvening?.winsToComplete}
            savedTeamId={pendingTeamId ?? currentTeamId ?? undefined}
          />
        );
      
      case 'pairs-mode-selection':
        return (
          <PairsGameModeSelection
            onBack={() => window.history.back()}
            onSelectRandom={() => {
              if (currentEvening && currentEvening.rounds.length > 0) {
                // Mid-tournament: go back to game, random mode will auto-generate pools
                goTo('game');
              } else if (pendingPairsPlayers) {
                handleStartRandomEvening(pendingPairsPlayers, pendingWinsToComplete, pendingTeamId);
              }
            }}
            onSelectTierQuestion={() => {
              if (currentEvening && currentEvening.rounds.length > 0) {
                // Mid-tournament: go to tier-question flow for this round
                goTo('tier-question-flow');
              } else if (pendingPairsPlayers) {
                // Initial tournament creation with tier-question mode
                const pairSchedule = TournamentEngine.generatePairs(pendingPairsPlayers);
                const newEvening: Evening = {
                  id: `evening-${Date.now()}`,
                  date: new Date().toISOString(),
                  players: pendingPairsPlayers,
                  rounds: [],
                  winsToComplete: pendingWinsToComplete,
                  completed: false,
                  type: 'pairs',
                  pairSchedule,
                  teamSelectionMode: 'tier-question',
                };
                persistActiveEveningNow(newEvening);
                setCurrentEvening(newEvening);
                setCurrentTeamId(pendingTeamId ?? null);
                setCurrentTeamEditReason("owner_admin");
                goTo('tier-question-flow');
              }
            }}
          />
        );
      
      case 'tier-question-flow':
        if (!currentEvening || !currentEvening.pairSchedule || currentEvening.pairSchedule.length === 0) {
          return null;
        }
        // Get pairs for round 0 (or current round if resuming)
        const roundIndex = currentEvening.rounds.length;
        const pairs = currentEvening.pairSchedule[roundIndex] as [Pair, Pair] | undefined;
        if (!pairs) {
          return null;
        }
        return (
          <TierQuestionFlow
            evening={currentEvening}
            pairs={pairs}
            clubsWithOverrides={clubsWithOverrides}
            onBack={() => window.history.back()}
            onComplete={async (pools: [Club[], Club[]]) => {
              // Pools are assigned - now start the game with these pools
              // Create the first round with pre-assigned pools
              const roundNumber = currentEvening.rounds.length + 1;
              const newRound = TournamentEngine.createRound(roundNumber, pairs, currentEvening.winsToComplete);
              const firstMatch = TournamentEngine.createNextMatch(newRound, pairs);
              const roundWithMatch = { 
                ...newRound, 
                matches: [firstMatch],
                teamPools: pools,
              };

              const updatedEvening: Evening = {
                ...currentEvening,
                rounds: [...currentEvening.rounds, roundWithMatch],
                tierQuestionState: undefined, // Clear state after completing
              };

              persistActiveEveningNow(updatedEvening);
              setCurrentEvening(updatedEvening);

              // Push to remote for collaboration
              const effectiveTeamId = pendingTeamId ?? currentTeamId ?? null;
              await RemoteStorageService.upsertEveningLiveWithTeam(updatedEvening, effectiveTeamId).catch((error) => {
                console.error("Failed to save tier-question evening:", error?.message || error);
              });

              goTo('game');
            }}
            onUpdateEvening={handleUpdateEvening}
          />
        );
      
      case 'singles-setup':
        return (
          <SinglesSetup
            onBack={() => window.history.back()}
            onStartSingles={(players: Player[], clubsPerPlayer: number) => {
              const singlesEvening = TournamentEngine.createSinglesEvening(players, clubsPerPlayer, currentTeamId ?? undefined, clubsWithOverrides);
              persistActiveEveningNow(singlesEvening);
              setCurrentEvening(singlesEvening);
              setCurrentTeamEditReason("owner_admin");
              setSinglesFlowState('club-assignment');
              goTo('singles-clubs');
            }}
            savedPlayers={currentEvening?.players}
          />
        );
      
      case 'singles-clubs':
        return currentEvening && currentEvening.type === 'singles' ? (
          <SinglesClubAssignment
            onBack={() => window.history.back()}
            onContinue={() => {
              setSinglesFlowState('match-schedule');
              goTo('singles-schedule');
            }}
            players={currentEvening.players}
            playerClubs={currentEvening.playerClubs || {}}
            clubsPerPlayer={currentEvening.clubsPerPlayer || 0}
            clubsWithOverrides={clubsWithOverrides}
          />
        ) : null;
      
      case 'singles-schedule':
        return currentEvening && currentEvening.type === 'singles' ? (
          <SinglesMatchSchedule
            onBack={() => window.history.back()}
            onStartTournament={() => {
              // Push to remote storage for sharing
              RemoteStorageService.upsertEveningLiveWithTeam(currentEvening, currentTeamId ?? null).catch((error) => {
                console.error("Failed to save singles evening before start:", error?.message || error);
              });
              
              setSinglesFlowState('game');
              goTo('game');
            }}
            gameSequence={currentEvening.gameSequence || []}
          />
        ) : null;
      
      case 'game':
        return currentEvening ? (
          currentEvening.type === 'singles' ? (
            <SinglesGameLive
              evening={currentEvening}
              onBack={() => window.history.back()}
              onComplete={handleCompleteEvening}
              onGoHome={handleGoHome}
              onUpdateEvening={handleUpdateEvening}
              canStopTournament={currentTeamEditReason === "owner_admin"}
              onStopTournament={() => currentEvening && handleStopTournament(currentEvening.id, "regular")}
              clubsWithOverrides={clubsWithOverrides}
            />
          ) : (
            <TournamentGame
              evening={currentEvening}
              onBack={() => window.history.back()}
              onComplete={handleCompleteEvening}
              onGoHome={handleGoHome}
              onUpdateEvening={handleUpdateEvening}
              onSaveEveningRemote={handleSaveEveningRemote}
              canStopTournament={currentTeamEditReason === "owner_admin"}
              canEditCompletedMatches={currentTeamEditReason === "owner_admin"}
              onStopTournament={() => currentEvening && handleStopTournament(currentEvening.id, "regular")}
              onRoundModeSelection={(nextRoundIndex) => {
                setPendingRoundIndex(nextRoundIndex);
                goTo('pairs-mode-selection');
              }}
            />
          )
        ) : null;
      
      case 'summary':
        return currentEvening ? (
          <EveningSummary
            evening={currentEvening}
            onSaveToHistory={handleSaveToHistory}
            onBackToHome={handleGoHome}
          />
        ) : null;
      
      case 'history':
        return (
          <TournamentHistory
            evenings={tournamentHistory}
            onBack={() => window.history.back()}
            onDeleteEvening={handleDeleteEvening}
            onRefresh={async () => {
              const updated = await RemoteStorageService.loadEveningsWithTeams();
              setTournamentHistory(updated);
              toast({ title: "הטורניר שויך לקבוצה בהצלחה" });
            }}
          />
        );
        case 'teams':
          return (
            <TeamsManager
              onBack={() => window.history.back()}
              onStartEveningForTeam={(teamId) => {
                setCurrentTeamId(teamId);
                setCurrentTeamEditReason("owner_admin");
                goTo('setup');
              }}
              initialTeamId={routeTeamId}
            />
          );
        
        case 'join':
          return (
            <JoinEvening
              onBack={() => window.history.back()}
              onJoinSuccess={handleJoinSuccess}
            />
          );

        case 'fp-team-selection':
          return (
            <FPTeamSelection
              onBack={() => window.history.back()}
              onCreateNew={() => {
                setTeamPlayersForFP(null);
                setFpTeamId(null);
                setFpSelectedTeamName(null);
                goTo('fp-setup');
              }}
              onSelectTeam={async (teamId, teamName) => {
                try {
                  const players = await RemoteStorageService.listTeamPlayers(teamId);
        
                  if (players.length !== 5) {
                    toast({
                      title: "מוד 5 דורש בדיוק 5 שחקנים",
                      description: `בקבוצה ${teamName} יש ${players.length} שחקנים.`,
                      variant: "destructive",
                    });
                    return;
                  }
        
                  setFpTeamId(teamId);
                  setFpSelectedTeamName(teamName);
                  setTeamPlayersForFP(players.map(p => ({ id: p.id, name: p.name })));
                  goTo('fp-setup');
                } catch (error: any) {
                  toast({
                    title: "שגיאה בטעינת הקבוצה",
                    description: error?.message || "לא ניתן לטעון את שחקני הקבוצה.",
                    variant: "destructive",
                  });
                }
              }}
            />
          );
        
        case 'fp-setup':
          return (
            <FPSetup
              teamPlayers={teamPlayersForFP ?? undefined}
              teamId={fpTeamId}
              teamName={fpSelectedTeamName}
              onBack={() => window.history.back()}
              onStart={async (players, matchCount, setupOptions) => {
                // Try strict (max 2 appearances)
                const result = createFPEvening(players, clubsWithOverrides, 2, matchCount);
                if (typeof result === 'string') {
                  // Strict failed – show deadlock dialog
                  setFpDeadlockPlayers(players);
                  setShowFpDeadlock(true);
                  return;
                }
                setFpEvening(result);
                setCurrentTeamEditReason("owner_admin");
                StorageService.saveFPActive(result);
                // Use active team context or auto-detect
                let teamId = contextTeamId || fpTeamId;
                if (!teamId && RemoteStorageService.isEnabled()) {
                  try {
                    teamId = await RemoteStorageService.ensureTeamForPlayers(players, 5);
                  } catch {}
                }
                if (!teamId) {
                  toast({
                    title: "צריך לבחור או ליצור קבוצה",
                    description: "מוד 5 חייב להיות משויך לקבוצה אמיתית.",
                    variant: "destructive",
                  });
                  return;
                }
                
                setFpTeamId(teamId);
                
                // Create via RPC (enforces one active evening per team)
                // IMPORTANT: wait for this before moving on, otherwise Home / other users may not see the active tournament.
                try {
                  await RemoteStorageService.createTeamEvening(result as any, teamId);
                
                  if (teamId) {
                    try {
                      const updatedActive = await RemoteStorageService.listActiveEveningsForMyTeams();
                      setActiveTeamEvenings(updatedActive);
                    } catch (refreshError: any) {
                      console.warn("Failed to refresh active team evenings:", refreshError?.message || refreshError);
                    }
                  }
                } catch (error: any) {
                  console.error("Failed to create FP team evening:", error?.message || error);
                  toast({
                    title: "שגיאה ביצירת טורניר פעיל",
                    description: error?.message || "לא ניתן היה לשמור את הטורניר כפעיל בקבוצה.",
                    variant: "destructive",
                  });
                  return;
                }
                
                goTo('fp-bank-overview');
              }}
            />
          );
        
        case 'fp-bank-overview':
          return fpEvening ? (
            <FPBankOverview
              evening={fpEvening}
              allClubs={clubsWithOverrides}
              onBack={() => window.history.back()}
              onContinue={() => goTo('fp-game')}
              onUpdateEvening={(ev) => {
                setFpEvening(ev);
                StorageService.saveFPActive(ev);
                RemoteStorageService.upsertEveningLiveWithTeam(ev as any, fpTeamId ?? null).catch((error) => {
                  console.error("Failed to save FP bank update:", error?.message || error);
                });
              }}
            />
          ) : null;
        
        case 'fp-game':
          return fpEvening ? (
            <FPGame
              evening={fpEvening}
              onBack={() => window.history.back()}
              onComplete={(ev) => {
                StorageService.clearFPActive();
                setFpEvening(ev);
                goTo('fp-summary');
              }}
              onGoHome={() => goTo('home')}
              canStopTournament={currentTeamEditReason === "owner_admin"}
              onStopTournament={() => fpEvening && handleStopTournament(fpEvening.id, "fp")}
              canSubmitNewScore={currentTeamEditReason !== "view_only"}
              canEditExistingResults={currentTeamEditReason === "owner_admin"}
              canReorderSchedule={currentTeamEditReason === "owner_admin"}
              isViewOnly={currentTeamEditReason === "view_only"}
              spectatorContext={{ teamId: fpTeamId }}

              onUpdateEvening={(ev) => {
                setFpEvening(ev);
              
                if (!ev.completed) {
                  StorageService.saveFPActive(ev);
                }
              
                if (currentTeamEditReason === "playing") {
                  RemoteStorageService.submitFPMatchScore(ev as any)
                    .then((serverEvening) => {
                      setFpEvening(serverEvening as any);
                      StorageService.saveFPActive(serverEvening as any);
                    })
                    .catch((error) => {
                      console.error("Failed to submit FP score:", error?.message || error);
                      toast({
                        title: "שגיאה בשמירת התוצאה",
                        description: error?.message || "לא ניתן לשמור את התוצאה. נסה שוב בעוד רגע.",
                        variant: "destructive",
                      });
                    });
              
                  return;
                }
              
                if (currentTeamEditReason === "owner_admin") {
                  RemoteStorageService.upsertEveningLiveWithTeam(ev as any, fpTeamId ?? null).catch((error) => {
                    console.error("Failed to save FP evening update:", error?.message || error);
                    toast({
                      title: "שגיאה בשמירת הטורניר",
                      description: error?.message || "לא ניתן לשמור את העדכון כרגע.",
                      variant: "destructive",
                    });
                  });
                }
              }}
            />
          ) : null;
        
        case 'find-team':
          return <FindTeam onBack={handleBackToHome} />;

        case 'fp-summary':
          return fpEvening ? (
            <FPSummary
              evening={fpEvening}
              onSave={(ev) => {
                StorageService.saveFPEvening(ev);
                StorageService.clearFPActive();
                // Push final completed state to Supabase so historical spectator links work
                RemoteStorageService.upsertEveningLiveWithTeam(ev as any, fpTeamId ?? null).catch((error) => {
                  console.error("Failed to save FP summary:", error?.message || error);
                });
              }}
              onBackToHome={() => {
                setFpEvening(null);
                goTo('home');
              }}
            />
          ) : null;

        default:
          return null;
    }
  };

  return (
    <div className="font-sans antialiased">
      {appState === 'home' ? (
        // Home page handles its own full-screen layout
        renderCurrentState()
      ) : isMobile ? (
        <FitToScreen minScale={0.62} maxScale={1}>
          {renderCurrentState()}
        </FitToScreen>
      ) : (
        <div className="w-full flex items-start justify-center">
          {renderCurrentState()}
        </div>
      )}

      {/* FP Deadlock Dialog */}
      <Dialog open={showFpDeadlock} onOpenChange={setShowFpDeadlock}>
        <DialogContent className="bg-gaming-bg border-border" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-foreground">לא ניתן ליצור ליגה</DialogTitle>
            <DialogDescription className="text-muted-foreground">
               אין מספיק קבוצות/נבחרות זמינות כדי ליצור בנקים חוקיים לכל 10 הזוגות תחת האילוצים המחמירים (מקסימום 2 הופעות לקבוצת 5 כוכבים, הופעה אחת ל-4/4.5 כוכבים).
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ניתן לנסות שוב עם אילוץ מרוכך: לאפשר לכל קבוצה להופיע עד 3 פעמים בערב.
          </p>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => { setShowFpDeadlock(false); setFpDeadlockPlayers(null); }}>
              ביטול
            </Button>
            <Button
              variant="gaming"
              onClick={() => {
                if (!fpDeadlockPlayers) return;
                const result = createFPEvening(fpDeadlockPlayers, clubsWithOverrides, 3);
                if (typeof result === 'string') {
                  toast({ title: result, variant: "destructive" });
                  return;
                }
                setShowFpDeadlock(false);
                setFpDeadlockPlayers(null);
                setFpEvening(result);
                setCurrentTeamEditReason("owner_admin");
                StorageService.saveFPActive(result);
                goTo('fp-bank-overview');
              }}
            >
              נסה עם מקסימום 3 הופעות (5 כוכבים בלבד)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
