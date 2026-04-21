import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RemoteStorageService } from "@/services/remoteStorageService";

interface TeamMembership {
  team_id: string;
  team_name: string;
  role: string;
}

interface ClaimedPlayer {
  team_id: string;
  player_id: string;
  player_name: string;
}

interface TeamContextValue {
  /** All teams the user belongs to */
  teams: TeamMembership[];
  /** The currently active/selected team */
  activeTeamId: string | null;
  /** Set the active team */
  setActiveTeamId: (teamId: string | null) => void;
  /** The claimed player for the active team (or null) */
  activePlayer: ClaimedPlayer | null;
  /** All claimed players across teams */
  claimedPlayers: ClaimedPlayer[];
  /** Get claimed player for a specific team */
  getPlayerForTeam: (teamId: string) => ClaimedPlayer | null;
  /** Whether data is still loading */
  loading: boolean;
  /** Refresh teams and claims from server */
  refresh: () => Promise<void>;
}

const TeamContext = createContext<TeamContextValue>({
  teams: [],
  activeTeamId: null,
  setActiveTeamId: () => {},
  activePlayer: null,
  claimedPlayers: [],
  getPlayerForTeam: () => null,
  loading: true,
  refresh: async () => {},
});

const ACTIVE_TEAM_KEY = "ea-fc-active-team";

export function TeamProvider({ children }: { children: ReactNode }) {
  const [teams, setTeams] = useState<TeamMembership[]>([]);
  const [claimedPlayers, setClaimedPlayers] = useState<ClaimedPlayer[]>([]);
  const [activeTeamId, setActiveTeamIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const setActiveTeamId = useCallback((teamId: string | null) => {
    setActiveTeamIdState(teamId);
    if (teamId) {
      localStorage.setItem(ACTIVE_TEAM_KEY, teamId);
    } else {
      localStorage.removeItem(ACTIVE_TEAM_KEY);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setTeams([]);
      setClaimedPlayers([]);
      setActiveTeamIdState(null);
      setLoading(false);
      return;
    }
    setUserId(user.id);

    const [memberships, claims] = await Promise.all([
      RemoteStorageService.getUserTeamMemberships(),
      RemoteStorageService.getClaimedPlayersByTeam(),
    ]);

    console.log("[TeamContext.refresh] memberships", memberships);
    console.log("[TeamContext.refresh] claims", claims);

    setTeams(memberships);
    setClaimedPlayers(claims);

    // Resolve active team
    const stored = localStorage.getItem(ACTIVE_TEAM_KEY);
    const validStored = stored && memberships.some(m => m.team_id === stored);

    if (validStored) {
      setActiveTeamIdState(stored);
    } else if (memberships.length === 1) {
      setActiveTeamId(memberships[0].team_id);
    } else if (memberships.length > 1) {
      // Pick first team as default
      setActiveTeamId(memberships[0].team_id);
    } else {
      setActiveTeamIdState(null);
    }

    setLoading(false);
  }, [setActiveTeamId]);

  // Listen for auth changes
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id !== userId) {
        refresh();
      }
    });
    refresh();
    return () => listener.subscription.unsubscribe();
  }, []);

  const activePlayer = activeTeamId
    ? claimedPlayers.find(c => c.team_id === activeTeamId) ?? null
    : null;

  const getPlayerForTeam = useCallback(
    (teamId: string) => claimedPlayers.find(c => c.team_id === teamId) ?? null,
    [claimedPlayers]
  );

  return (
    <TeamContext.Provider value={{
      teams,
      activeTeamId,
      setActiveTeamId,
      activePlayer,
      claimedPlayers,
      getPlayerForTeam,
      loading,
      refresh,
    }}>
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  return useContext(TeamContext);
}
