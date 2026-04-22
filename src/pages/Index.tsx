import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
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

type AppState = 'home' | 'setup' | 'tournament-type' | 'singles-setup' | 'singles-clubs' | 'singles-schedule' | 'game' | 'summary' | 'history' | 'teams' | 'join' | 'pairs-mode-selection' | 'tier-question-flow' | 'fp-setup' | 'fp-bank-overview' | 'fp-game' | 'fp-summary';

const Index = () => {
  const location = useLocation();
  const { activeTeamId: contextTeamId } = useTeam();
  const [appState, setAppState] = useState<AppState>('home');
  const [currentEvening, setCurrentEvening] = useState<Evening | null>(null);
  const [tournamentHistory, setTournamentHistory] = useState<EveningWithTeam[]>([]);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [isAuthed, setIsAuthed] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [currentTeamId, setCurrentTeamId] = useState<string | null>(null);
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
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Realtime sync: subscribe to current evening when in game state
  useEffect(() => {
    if (appState !== 'game' || !currentEvening) return;

    // Helper: count total completed matches across all rounds as a progress metric
    const countCompletedMatches = (e: Evening) =>
      e.rounds.reduce((sum, r) => sum + r.matches.filter(m => m.completed).length, 0);

    const unsubscribe = RemoteStorageService.subscribeToEvening(currentEvening.id, (remoteEvening) => {
      const local = currentEveningRef.current;
      if (!local) {
        setCurrentEvening(remoteEvening);
        return;
      }

      const localProgress = countCompletedMatches(local);
      const remoteProgress = countCompletedMatches(remoteEvening);

      // Only accept remote state if it has equal or more progress than local.
      // This prevents stale server data (from before an internet outage) from
      // overwriting newer local progress when the connection is restored.
      if (remoteProgress >= localProgress) {
        setCurrentEvening(remoteEvening);
      } else {
        console.warn('[Realtime] Ignored stale remote state', { localProgress, remoteProgress });
        // Re-push local state to server so it catches up
        RemoteStorageService.upsertEveningLive(local).catch(() => {});
      }
    });
    return () => unsubscribe && unsubscribe();
  }, [appState, currentEvening?.id]);

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
    setSelectedTournamentType(null);
  };

  const handleViewHistory = () => {
    goTo('history');
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
    // Local persistence protects against iOS killing the Safari/PWA instance in background
    if (!evening.completed) persistActiveEveningNow(evening);
    RemoteStorageService.upsertEveningLive(evening).catch(() => {});
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
    // Delete remote record so spectator link doesn't show stale cancelled tournament
    if (currentEvening?.id) {
      RemoteStorageService.deleteEvening(currentEvening.id).catch(() => {});
    }
    clearActiveEvening();
    setCurrentEvening(null);
  };

  // Handle successful join from JoinEvening component
  const handleJoinSuccess = async (eveningId: string) => {
    try {
      const evenings = await RemoteStorageService.loadEvenings();
      const joinedEvening = evenings.find(e => e.id === eveningId);
      if (joinedEvening && !joinedEvening.completed) {
        setCurrentEvening(joinedEvening);
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
          tournamentProgress = `${completed} / ${fpEvening.schedule.length} משחקים`;
        } else if (activeRegular && currentEvening) {
          tournamentMode = currentEvening.type === 'singles' ? "טורניר יחידים" : "טורניר זוגות";
          const completedMatches = currentEvening.rounds.reduce((s, r) => s + r.matches.filter(m => m.completed).length, 0);
          tournamentProgress = `${completedMatches} משחקים שהושלמו`;
        }

        return (
          <TeamDashboard
            onStartNew={handleStartNewEvening}
            onStartFivePlayer={async () => {
              // Load team players if we have an active team with exactly 5 players
              if (contextTeamId && RemoteStorageService.isEnabled()) {
                try {
                  const tp = await RemoteStorageService.listTeamPlayers(contextTeamId);
                  if (tp.length === 5) {
                    setTeamPlayersForFP(tp.map(p => ({ id: p.id, name: p.name })));
                  } else {
                    setTeamPlayersForFP(null);
                  }
                } catch {
                  setTeamPlayersForFP(null);
                }
              } else {
                setTeamPlayersForFP(null);
              }
              goTo('fp-setup');
            }}
            onStartPairs={() => { setSelectedTournamentType('pairs'); goTo('setup'); }}
            onStartSingles={() => { setSelectedTournamentType('singles'); goTo('singles-setup'); }}
            onViewHistory={handleViewHistory}
            onResume={
              activeFP
                ? () => goTo('fp-game')
                : activeRegular
                  ? () => goTo('game')
                  : undefined
            }
            onCloseTournament={
              activeFP
                ? () => {
                    RemoteStorageService.deleteEvening(fpEvening!.id).catch(() => {});
                    StorageService.clearFPActive();
                    setFpEvening(null);
                  }
                : activeRegular
                  ? handleCloseTournament
                  : undefined
            }
            onManageTeams={() => goTo('teams')}
            onJoinEvening={isAuthed ? () => goTo('join') : undefined}
            isAuthed={isAuthed}
            userEmail={userEmail}
            onSignOut={handleSignOut}
            activeTournamentMode={tournamentMode}
            activeTournamentProgress={tournamentProgress}
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
              await RemoteStorageService.upsertEveningLiveWithTeam(updatedEvening, effectiveTeamId).catch(() => {});

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
              RemoteStorageService.upsertEveningLiveWithTeam(currentEvening, currentTeamId ?? null).catch(() => {});
              
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
              clubsWithOverrides={clubsWithOverrides}
            />
          ) : (
            <TournamentGame
              evening={currentEvening}
              onBack={() => window.history.back()}
              onComplete={handleCompleteEvening}
              onGoHome={handleGoHome}
              onUpdateEvening={handleUpdateEvening}
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
                goTo('setup');
              }}
            />
          );
        
        case 'join':
          return (
            <JoinEvening
              onBack={() => window.history.back()}
              onJoinSuccess={handleJoinSuccess}
            />
          );
        
        case 'fp-setup':
          return (
            <FPSetup
              teamPlayers={teamPlayersForFP ?? undefined}
              onBack={() => window.history.back()}
              onStart={async (players, matchCount) => {
                // Try strict (max 2 appearances)
                const result = createFPEvening(players, clubsWithOverrides, 2, matchCount);
                if (typeof result === 'string') {
                  // Strict failed – show deadlock dialog
                  setFpDeadlockPlayers(players);
                  setShowFpDeadlock(true);
                  return;
                }
                setFpEvening(result);
                StorageService.saveFPActive(result);
                // Use active team context or auto-detect
                let teamId = contextTeamId || fpTeamId;
                if (!teamId && RemoteStorageService.isEnabled()) {
                  try {
                    teamId = await RemoteStorageService.ensureTeamForPlayers(players, 5);
                  } catch {}
                }
                if (teamId) setFpTeamId(teamId);
                // Create via RPC (enforces one active evening per team)
                RemoteStorageService.createTeamEvening(result as any, teamId).catch(() => {});
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
                RemoteStorageService.upsertEveningLiveWithTeam(ev as any, fpTeamId ?? null).catch(() => {});
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
              onUpdateEvening={(ev) => {
                setFpEvening(ev);
                if (!ev.completed) StorageService.saveFPActive(ev);
                RemoteStorageService.upsertEveningLiveWithTeam(ev as any, fpTeamId ?? null).catch(() => {});
              }}
            />
          ) : null;
        
        case 'fp-summary':
          return fpEvening ? (
            <FPSummary
              evening={fpEvening}
              onSave={(ev) => {
                StorageService.saveFPEvening(ev);
                StorageService.clearFPActive();
                // Push final completed state to Supabase so historical spectator links work
                RemoteStorageService.upsertEveningLiveWithTeam(ev as any, fpTeamId ?? null).catch(() => {});
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
