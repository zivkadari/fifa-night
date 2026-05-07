import { Evening, Player } from "@/types/tournament";
import { supabase } from "@/integrations/supabase/client";
import { validateTeamName, validatePlayerName } from "@/lib/validation";

const EVENINGS_TABLE = "evenings";
const TEAMS_TABLE = "teams";
const TEAM_PLAYERS_TABLE = "team_players";
const PLAYERS_TABLE = "players";
const PROFILES_TABLE = "profiles";
const PLAYER_ACCOUNTS_TABLE = "player_accounts";
const TEAM_MEMBERS_TABLE = "team_members";
const TEAM_JOIN_REQUESTS_TABLE = "team_join_requests";

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9\u0590-\u05FF]+/g, "-").replace(/^-+|-+$/g, "");
}

type EveningRow = {
  id: string;
  owner_id: string;
  data: Evening;
  updated_at?: string;
  created_at?: string;
  team_id?: string | null;
};

export class RemoteStorageService {
  static isEnabled() {
    return Boolean(supabase);
  }

  // ========== Evenings ==========
  static async saveEvening(evening: Evening): Promise<void> {
    // Backward-compatible: saves without team relation
    return this.saveEveningWithTeam(evening, null);
  }

  static async saveEveningWithTeam(evening: Evening, teamId: string | null): Promise<void> {
    if (!supabase) return;
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return; // Not authenticated; skip remote save

    const row = { id: evening.id, owner_id: user.id, data: evening, team_id: teamId } as any;
    const { error } = await supabase
      .from(EVENINGS_TABLE)
      .upsert(row, { onConflict: "id" });
    if (error) console.error("Supabase saveEvening error:", error.message);
  }

  /**
   * Create a new evening for a team using the server-side RPC that enforces
   * one-active-evening-per-team. Falls back to direct upsert if no teamId.
   */
  static async createTeamEvening(evening: Evening, teamId: string | null): Promise<void> {
    if (!supabase) return;
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return;

    if (teamId) {
      const { error } = await supabase.rpc("create_team_evening", {
        _evening_id: evening.id,
        _team_id: teamId,
        _data: evening as any,
      });
      if (error) {
        // Surface the server error so the caller can handle it
        throw new Error(error.message);
      }
      return;
    }

    // No team — fallback to direct upsert (legacy / teamless flow)
    await this.upsertEveningLiveWithTeam(evening, null);
  }

  static async upsertEveningLive(evening: Evening): Promise<void> {
    if (!supabase) return;
    await supabase
      .from(EVENINGS_TABLE)
      .update({ data: evening as any, updated_at: new Date().toISOString() } as any)
      .eq("id", evening.id);
  }

  static async upsertEveningLiveWithTeam(evening: Evening, teamId: string | null): Promise<void> {
    if (!supabase) return;
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return;

    const row: any = { 
      id: evening.id, 
      owner_id: user.id, 
      data: evening, 
      updated_at: new Date().toISOString()
    };
    // Only set team_id when explicitly provided — null means "don't change"
    if (teamId !== null) {
      row.team_id = teamId;
    }
    
    await supabase
      .from(EVENINGS_TABLE)
      .upsert(row, { onConflict: "id" });
  }

  static async loadEvenings(): Promise<Evening[]> {
    if (!supabase) return [];
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from(EVENINGS_TABLE)
      .select("data, team_id")
      .order("updated_at", { ascending: false });
    if (error) {
      console.error("Supabase loadEvenings error:", error.message);
      return [];
    }
    return (data || []).map((r: any) => {
      const evening = r.data as Evening;
      if (r.team_id) (evening as any)._team_id = r.team_id;
      return evening;
    });
  }

  static async loadAllFPEvenings(): Promise<any[]> {
    if (!supabase) return [];
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from(EVENINGS_TABLE)
      .select("data")
      .order("updated_at", { ascending: false });
    if (error) return [];
    return (data || [])
      .map((r: any) => r.data)
      .filter((d: any) => d && d.mode === 'five-player-doubles');
  }

  static async loadEveningsByTeam(teamId: string): Promise<Evening[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from(EVENINGS_TABLE)
      .select("data")
      .eq("team_id", teamId)
      .order("updated_at", { ascending: false });

    if (!error && data && data.length > 0) {
      return (data || []).map((r: any) => r.data as Evening);
    }

    // Fallback: derive by matching majority of evening's players to team players
    try {
      const teamPlayers = await this.listTeamPlayers(teamId);
      if (teamPlayers.length === 0) return [];
      const teamPlayerIds = new Set(teamPlayers.map((p) => p.id));
      const all = await this.loadEvenings();
      
      const filtered = all.filter((e) => {
        if (e.players.length === 0) return false;
        const matchingPlayers = e.players.filter((p) => teamPlayerIds.has(p.id));
        // Require at least 50% of players OR at least 2 players (whichever is higher)
        const minRequired = Math.max(2, Math.ceil(e.players.length / 2));
        return matchingPlayers.length >= minRequired;
      });
      
      return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch {
      return [];
    }
  }

  static async deleteEvening(eveningId: string): Promise<boolean> {
    if (!this.isEnabled() || !supabase) return false;
  
    const { error } = await supabase
      .from(EVENINGS_TABLE)
      .delete()
      .eq("id", eveningId);
  
    if (error) {
      console.error("Supabase deleteEvening error:", error.message);
      throw new Error(error.message);
    }
  
    return true;
  }

  static async leaveTeam(teamId: string): Promise<boolean> {
    if (!supabase) return false;
  
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
  
    if (userErr || !user) return false;
  
    try {
      // Get all players that belong to this team.
      const { data: teamPlayerRows, error: teamPlayersError } = await supabase
        .from(TEAM_PLAYERS_TABLE)
        .select("player_id")
        .eq("team_id", teamId);
  
      if (teamPlayersError) {
        console.error("leaveTeam teamPlayers error:", teamPlayersError.message);
        return false;
      }
  
      const playerIds = (teamPlayerRows || [])
        .map((row: any) => row.player_id)
        .filter(Boolean);
  
      // Remove claimed player links for this user inside this team.
      if (playerIds.length > 0) {
        const { error: playerAccountsError } = await supabase
          .from(PLAYER_ACCOUNTS_TABLE)
          .delete()
          .eq("user_id", user.id)
          .in("player_id", playerIds);
  
        if (playerAccountsError) {
          console.error("leaveTeam playerAccounts error:", playerAccountsError.message);
          return false;
        }
      }
  
      // Remove the current user's membership in the team.
      const { data: deletedMemberships, error: membershipDeleteError } = await supabase
        .from(TEAM_MEMBERS_TABLE)
        .delete()
        .eq("team_id", teamId)
        .eq("user_id", user.id)
        .select("team_id,user_id");
  
      if (membershipDeleteError) {
        console.error("leaveTeam membership delete error:", membershipDeleteError.message);
        return false;
      }
  
      if (!deletedMemberships || deletedMemberships.length === 0) {
        console.warn("leaveTeam: no membership row was deleted");
      }
  
      // Verify membership is gone.
      const { data: remainingMembership, error: verifyError } = await supabase
        .from(TEAM_MEMBERS_TABLE)
        .select("team_id")
        .eq("team_id", teamId)
        .eq("user_id", user.id)
        .maybeSingle();
  
      if (verifyError) {
        console.error("leaveTeam verify error:", verifyError.message);
        return false;
      }
  
      if (remainingMembership) {
        console.error("leaveTeam: membership still exists after delete");
        return false;
      }
  
      return true;
    } catch (error) {
      console.error("leaveTeam unexpected error:", error);
      return false;
    }
  }

  // Link an existing evening to a team and recalculate stats
  static async linkEveningToTeam(eveningId: string, teamId: string): Promise<boolean> {
    if (!supabase) return false;
    
    const { data, error } = await supabase
      .from(EVENINGS_TABLE)
      .update({ team_id: teamId })
      .eq("id", eveningId)
      .select("id")
      .maybeSingle();
    
    if (error) {
      console.error("linkEveningToTeam error:", error.message);
      return false;
    }
    
    if (!data) {
      console.error("linkEveningToTeam: evening not found or no permission");
      return false;
    }
    
    // Trigger stats recalculation - don't fail if this errors
    try {
      await this.syncStats(eveningId);
    } catch (e) {
      console.warn("syncStats after link failed:", e);
    }
    
    return true;
  }

  // Load evenings with their team info
  static async loadEveningsWithTeams(): Promise<Array<Evening & { teamId?: string; teamName?: string; _updatedAt?: string; _createdAt?: string }>> {
    if (!supabase) return [];
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // Try with JOIN first
    const { data, error } = await supabase
      .from(EVENINGS_TABLE)
      .select("data, team_id, updated_at, created_at, teams(name)")
      .order("updated_at", { ascending: false });

    if (!error && data && data.length > 0) {
      return data.map((r: any) => ({
        ...(r.data as Evening),
        teamId: r.team_id || undefined,
        teamName: r.teams?.name || undefined,
        _updatedAt: r.updated_at || undefined,
        _createdAt: r.created_at || undefined,
      }));
    }

    if (error) {
      console.warn("loadEveningsWithTeams JOIN failed, falling back:", error.message);
    }

    const { data: simpleData, error: simpleError } = await supabase
      .from(EVENINGS_TABLE)
      .select("data, team_id, updated_at, created_at")
      .order("updated_at", { ascending: false });

    if (simpleError || !simpleData || simpleData.length === 0) {
      if (simpleError) {
        console.error("loadEveningsWithTeams fallback also failed:", simpleError.message);
      }
      return [];
    }

    const teamIds = [...new Set(simpleData.map((r: any) => r.team_id).filter(Boolean))] as string[];
    let teamMap: Record<string, string> = {};

    if (teamIds.length > 0) {
      const { data: teams } = await supabase
        .from(TEAMS_TABLE)
        .select("id, name")
        .in("id", teamIds);
      if (teams) {
        teamMap = Object.fromEntries(teams.map((t: any) => [t.id, t.name]));
      }
    }

    return simpleData.map((r: any) => ({
      ...(r.data as Evening),
      teamId: r.team_id || undefined,
      teamName: r.team_id ? teamMap[r.team_id] : undefined,
      _updatedAt: r.updated_at || undefined,
      _createdAt: r.created_at || undefined,
    }));
  }

  static async getTeamDiscoverySettings(teamId: string): Promise<{
    visibility: "private" | "searchable" | "public";
    description: string | null;
  } | null> {
    if (!supabase) return null;
  
    const { data, error } = await supabase
      .from(TEAMS_TABLE)
      .select("visibility, description")
      .eq("id", teamId)
      .maybeSingle();
  
    if (error) {
      console.error("getTeamDiscoverySettings error:", error.message);
      return null;
    }
  
    return {
      visibility: (data?.visibility || "private") as "private" | "searchable" | "public",
      description: data?.description || null,
    };
  }
  
  static async updateTeamDiscoverySettings(
    teamId: string,
    visibility: "private" | "searchable" | "public",
    description?: string | null
  ): Promise<boolean> {
    if (!supabase) return false;
  
    const { error } = await supabase
      .from(TEAMS_TABLE)
      .update({
        visibility,
        description: description?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", teamId);
  
    if (error) {
      console.error("updateTeamDiscoverySettings error:", error.message);
      return false;
    }
  
    return true;
  }

  // Subscribe to realtime changes for a specific evening id
  static subscribeToEvening(eveningId: string, onChange: (evening: Evening) => void) {
    if (!this.isEnabled() || !supabase) return () => {};

    const channel = supabase
      .channel(`evening:${eveningId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: EVENINGS_TABLE, filter: `id=eq.${eveningId}` },
        (payload: any) => {
          const newRow = (payload?.new as EveningRow) || null;
          if (newRow?.data) onChange(newRow.data);
        }
      )
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch {}
    };
  }

  static async getShareCode(eveningId: string): Promise<string | null> {
    if (!supabase) return null;
    // Try RPC first (owner-only secure function)
    const { data, error } = await supabase.rpc('get_evening_share_code', { _evening_id: eveningId });
    if (error) {
      console.error('getShareCode RPC error:', error.message);
    }
    if (data) return data;

    // Fallback: direct select (owner has SELECT via RLS)
    const { data: row, error: selErr } = await supabase
      .from(EVENINGS_TABLE)
      .select('share_code')
      .eq('id', eveningId)
      .maybeSingle();
    if (selErr) {
      console.error('getShareCode select fallback error:', selErr.message);
      return null;
    }
    return row?.share_code || null;
  }

  static async joinEveningByCode(code: string): Promise<string | null> {
    if (!supabase) return null;
    const cleaned = code.trim().toUpperCase();

    // Validate code length and format before sending to server
    if (cleaned.length === 0 || cleaned.length > 20) {
      console.error('Invalid code length');
      return null;
    }
    if (!/^[A-Z0-9-]+$/.test(cleaned)) {
      console.error('Invalid code format');
      return null;
    }

    // Use RPC function which handles membership insertion and RLS properly
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('join_evening_by_code', { _code: cleaned });
      if (!rpcError && rpcData && rpcData.length > 0) {
        return rpcData[0].evening_id;
      }
      console.error('joinEveningByCode error:', rpcError?.message || 'Invalid code');
      return null;
    } catch (error) {
      console.error('joinEveningByCode RPC error:', error);
      return null;
    }
  }

  // ========== Teams ==========
  static async listTeams(): Promise<Array<{ id: string; name: string }>> {
    if (!supabase) return [];
  
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
  
    if (userErr || !user) return [];
  
    const { data, error } = await supabase
      .from(TEAM_MEMBERS_TABLE)
      .select(`
        team_id,
        teams!inner (
          id,
          name
        )
      `)
      .eq("user_id", user.id);
  
    if (error) {
      console.error("listTeams error:", error.message);
      return [];
    }
  
    return (data || [])
      .map((row: any) => ({
        id: row.team_id,
        name: row.teams?.name || "קבוצה ללא שם",
      }))
      .filter((team) => team.id && team.name);
  }

  static async createTeam(name: string): Promise<{ id: string; name: string } | null> {
    if (!supabase) return null;
    
    // Validate team name
    const validation = validateTeamName(name);
    if (!validation.valid) {
      console.error("createTeam validation error:", validation.error);
      throw new Error(validation.error);
    }
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from(TEAMS_TABLE)
      .insert({ name: validation.value, owner_id: user.id })
      .select("id, name")
      .maybeSingle();
    if (error) {
      console.error("createTeam error:", error.message);
      return null;
    }
    return data as { id: string; name: string };
  }

  static async renameTeam(teamId: string, name: string): Promise<boolean> {
    if (!supabase) return false;
    
    // Validate team name
    const validation = validateTeamName(name);
    if (!validation.valid) {
      console.error("renameTeam validation error:", validation.error);
      throw new Error(validation.error);
    }
    
    const { error } = await supabase
      .from(TEAMS_TABLE)
      .update({ name: validation.value })
      .eq("id", teamId);
    if (error) {
      console.error("renameTeam error:", error.message);
      return false;
    }
    return true;
  }

  static async deleteTeam(teamId: string): Promise<boolean> {
    if (!supabase) return false;
    
    // First delete all team_players links
    const { error: playersError } = await supabase
      .from(TEAM_PLAYERS_TABLE)
      .delete()
      .eq("team_id", teamId);
    
    if (playersError) {
      console.error("deleteTeam/remove players error:", playersError.message);
    }
    
    // Then delete the team
    const { error } = await supabase
      .from(TEAMS_TABLE)
      .delete()
      .eq("id", teamId);
    if (error) {
      console.error("deleteTeam error:", error.message);
      return false;
    }
    return true;
  }


  // ========== Team Players ==========
  static async listTeamPlayers(teamId: string): Promise<Array<{ id: string; name: string }>> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from(TEAM_PLAYERS_TABLE)
      .select("player_id")
      .eq("team_id", teamId);
    if (error || !data?.length) return [];
    const ids = data.map((l: any) => l.player_id);
    const { data: players, error: pErr } = await supabase
      .from(PLAYERS_TABLE)
      .select("id, display_name")
      .in("id", ids);
    if (pErr) return [];
    return (players || []).map((p: any) => ({ id: p.id as string, name: p.display_name as string }));
  }

  static async addPlayerToTeamByName(teamId: string, name: string): Promise<boolean> {
    if (!supabase) return false;
    
    // Validate player name
    const validation = validatePlayerName(name);
    if (!validation.valid) {
      console.error("addPlayerToTeamByName validation error:", validation.error);
      throw new Error(validation.error);
    }
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const playerId = `player-${slugify(validation.value)}`;
    // Upsert player row
    const { error: upErr } = await supabase
      .from(PLAYERS_TABLE)
      .upsert({ id: playerId, display_name: validation.value, created_by: user.id }, { onConflict: "id" });
    if (upErr) {
      console.error("addPlayerToTeamByName/insert player error:", upErr.message);
      return false;
    }

    const { error: linkInsertErr } = await supabase
      .from(TEAM_PLAYERS_TABLE)
      .insert({ team_id: teamId, player_id: playerId });
    if (linkInsertErr) {
      console.error("addPlayerToTeamByName/link error:", linkInsertErr.message);
      return false;
    }
    return true;
  }

  static async removePlayerFromTeam(teamId: string, playerId: string): Promise<boolean> {
    if (!supabase) return false;
    const { error } = await supabase
      .from(TEAM_PLAYERS_TABLE)
      .delete()
      .eq("team_id", teamId)
      .eq("player_id", playerId);
    if (error) {
      console.error("removePlayerFromTeam error:", error.message);
      return false;
    }
    return true;
  }

  // List all players the user has access to, with their team memberships
  static async listAllMyPlayers(): Promise<Array<{ id: string; name: string; teams: Array<{ id: string; name: string }> }>> {
    if (!supabase) return [];
  
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
  
    const { data: players, error: playerError } = await supabase
      .from(PLAYERS_TABLE)
      .select("id, display_name")
      .order("display_name", { ascending: true });
  
    if (playerError || !players || players.length === 0) {
      if (playerError) {
        console.error("listAllMyPlayers players error:", playerError.message);
      }
      return [];
    }
  
    const playerIds = players.map((p: any) => p.id);
  
    const { data: links, error: linksErr } = await supabase
      .from(TEAM_PLAYERS_TABLE)
      .select("player_id, team_id")
      .in("player_id", playerIds);
  
    if (linksErr) {
      console.error("listAllMyPlayers links error:", linksErr.message);
    }
  
    const teamIds = [...new Set((links || []).map((l: any) => l.team_id))] as string[];
    let teamMap: Record<string, string> = {};
  
    if (teamIds.length > 0) {
      const { data: teams } = await supabase
        .from(TEAMS_TABLE)
        .select("id, name")
        .in("id", teamIds);
  
      if (teams) {
        teamMap = Object.fromEntries(teams.map((t: any) => [t.id, t.name]));
      }
    }
  
    const linksByPlayer: Record<string, Array<{ id: string; name: string }>> = {};
  
    for (const link of (links || []) as any[]) {
      if (!linksByPlayer[link.player_id]) {
        linksByPlayer[link.player_id] = [];
      }
  
      if (teamMap[link.team_id]) {
        linksByPlayer[link.player_id].push({
          id: link.team_id,
          name: teamMap[link.team_id],
        });
      }
    }
  
    return players.map((p: any) => ({
      id: p.id as string,
      name: p.display_name as string,
      teams: linksByPlayer[p.id] || [],
    }));
  }

  // Add existing player to a team (by player ID)
  static async addExistingPlayerToTeam(teamId: string, playerId: string): Promise<boolean> {
    if (!supabase) return false;
    
    // Check if already in team
    const { data: existing } = await supabase
      .from(TEAM_PLAYERS_TABLE)
      .select("player_id")
      .eq("team_id", teamId)
      .eq("player_id", playerId)
      .maybeSingle();
    
    if (existing) {
      // Already in team
      return true;
    }

    const { error } = await supabase
      .from(TEAM_PLAYERS_TABLE)
      .insert({ team_id: teamId, player_id: playerId });
    
    if (error) {
      console.error("addExistingPlayerToTeam error:", error.message);
      return false;
    }
    return true;
  }

  // Ensure a reusable team exists for the given N players; return team_id
  static async ensureTeamForPlayers(players: Player[], expectedCount: number = 4): Promise<string | null> {
    if (!supabase || players.length !== expectedCount) return null;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Upsert players by deterministic id based on name
    const playerIds: string[] = [];
    for (const p of players) {
      // Validate player name
      const validation = validatePlayerName(p.name);
      if (!validation.valid) {
        console.error("ensureTeamForPlayers validation error:", validation.error);
        continue; // Skip invalid players
      }
      
      const pid = `player-${slugify(validation.value)}`;
      playerIds.push(pid);
      const { error: upErr } = await supabase
        .from(PLAYERS_TABLE)
        .upsert({ id: pid, display_name: validation.value, created_by: user.id }, { onConflict: "id" });
      if (upErr) {
        console.error("ensureTeamForPlayers upsert player error:", upErr.message);
      }
    }

    // Try to find existing team owned by user with exactly these N players
    // Match by slugified name to handle varying player IDs across sessions
    const playerSlugs = new Set(players.map(p => slugify(p.name)));
    
    const { data: teams, error: tErr } = await supabase
      .from(TEAMS_TABLE)
      .select("id, name")
    if (tErr) {
      console.error("ensureTeamForPlayers teams fetch error:", tErr.message);
      return null;
    }
    if (teams && teams.length) {
      for (const t of teams as any[]) {
        const { data: links } = await supabase
          .from(TEAM_PLAYERS_TABLE)
          .select("player_id")
          .eq("team_id", t.id);
        if (!links || links.length !== expectedCount) continue;
        
        const linkedIds = new Set((links).map((l: any) => l.player_id));
        
        // First try exact ID match
        const exactMatch = playerIds.every((id) => linkedIds.has(id)) && linkedIds.size === expectedCount;
        if (exactMatch) return t.id as string;
        
        // Then try name-based match: fetch display_names for linked players
        const { data: linkedPlayers } = await supabase
          .from(PLAYERS_TABLE)
          .select("id, display_name")
          .in("id", Array.from(linkedIds));
        if (linkedPlayers && linkedPlayers.length === expectedCount) {
          const linkedSlugs = new Set(linkedPlayers.map((p: any) => slugify(p.display_name)));
          const nameMatch = playerSlugs.size === linkedSlugs.size && 
            [...playerSlugs].every(s => linkedSlugs.has(s));
          if (nameMatch) {
            // Found by name — also add missing player links
            for (const pid of playerIds) {
              if (!linkedIds.has(pid)) {
                await supabase.from(TEAM_PLAYERS_TABLE)
                  .insert({ team_id: t.id, player_id: pid })
                  .then(() => {});
              }
            }
            return t.id as string;
          }
        }
      }
    }

    // Create new team with next number
    const nextNumber = (teams?.length || 0) + 1;
    const teamName = `קבוצה ${nextNumber}`;
    const { data: created, error: cErr } = await supabase
      .from(TEAMS_TABLE)
      .insert({ name: teamName, owner_id: user.id })
      .select("id")
      .maybeSingle();
    if (cErr || !created?.id) {
      console.error("ensureTeamForPlayers create team error:", cErr?.message);
      return null;
    }
    const teamId = created.id as string;

    const inserts = playerIds.map((pid) => ({ team_id: teamId, player_id: pid }));
    const { error: linkErr } = await supabase
      .from(TEAM_PLAYERS_TABLE)
      .insert(inserts);
    if (linkErr) {
      console.error("ensureTeamForPlayers link insert error:", linkErr.message);
    }

    return teamId;
  }

  // ========== Share Code Helpers ==========
  // Share codes are generated server-side by the database default (gen_random_bytes).
  // No client-side generation needed.
  // ========== User Profile ==========
  static async getProfile(userId: string): Promise<{ display_name: string; avatar_url: string | null } | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from(PROFILES_TABLE)
      .select("display_name, avatar_url")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      console.error("getProfile error:", error.message);
      return null;
    }
    return data;
  }

  static async updateProfile(updates: { display_name?: string; avatar_url?: string }): Promise<boolean> {
    if (!supabase) return false;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    
    const { error } = await supabase
      .from(PROFILES_TABLE)
      .update(updates)
      .eq("id", user.id);
    if (error) {
      console.error("updateProfile error:", error.message);
      return false;
    }
    return true;
  }

  // ========== Player Accounts (team-scoped claim) ==========

  /** Get all claimed players for the current user, keyed by team */
  static async getClaimedPlayersByTeam(): Promise<Array<{ team_id: string; player_id: string; player_name: string }>> {
    if (!supabase) return [];
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from(PLAYER_ACCOUNTS_TABLE)
      .select("player_id, team_id")
      .eq("user_id", user.id);
    if (error || !data || data.length === 0) return [];

    // Get player names
    const playerIds = [...new Set(data.map(d => d.player_id))];
    const { data: players } = await supabase
      .from(PLAYERS_TABLE)
      .select("id, display_name")
      .in("id", playerIds);
    const nameMap = new Map((players || []).map(p => [p.id, p.display_name]));

    return data
      .filter(d => d.team_id)
      .map(d => ({
        team_id: d.team_id!,
        player_id: d.player_id,
        player_name: nameMap.get(d.player_id) || d.player_id
      }));
  }

  /** Backward-compat: get the first claimed player (legacy global usage) */
  static async getClaimedPlayer(): Promise<{ player_id: string; player_name: string } | null> {
    const claims = await this.getClaimedPlayersByTeam();
    if (claims.length === 0) {
      // Also check legacy claims without team_id
      if (!supabase) return null;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from(PLAYER_ACCOUNTS_TABLE)
        .select("player_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (!data) return null;
      const { data: player } = await supabase
        .from(PLAYERS_TABLE)
        .select("display_name")
        .eq("id", data.player_id)
        .maybeSingle();
      return { player_id: data.player_id, player_name: player?.display_name || data.player_id };
    }
    return { player_id: claims[0].player_id, player_name: claims[0].player_name };
  }

  /** Get claimed player for a specific team */
  static async getClaimedPlayerForTeam(teamId: string): Promise<{ player_id: string; player_name: string } | null> {
    if (!supabase) return null;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from(PLAYER_ACCOUNTS_TABLE)
      .select("player_id")
      .eq("user_id", user.id)
      .eq("team_id", teamId)
      .maybeSingle();
    if (error || !data) return null;

    const { data: player } = await supabase
      .from(PLAYERS_TABLE)
      .select("display_name")
      .eq("id", data.player_id)
      .maybeSingle();

    return { player_id: data.player_id, player_name: player?.display_name || data.player_id };
  }

  static async getMyTeamMemberStatus(teamId: string): Promise<{
    role: string;
    member_mode: "unset" | "player" | "spectator";
    linked_player_id: string | null;
    linked_player_name: string | null;
  } | null> {
    if (!supabase) return null;
  
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
  
    const { data: membership, error: membershipError } = await supabase
      .from(TEAM_MEMBERS_TABLE)
      .select("role, member_mode")
      .eq("team_id", teamId)
      .eq("user_id", user.id)
      .maybeSingle();
  
    if (membershipError || !membership) {
      console.error("getMyTeamMemberStatus membership error:", membershipError?.message);
      return null;
    }
  
    const claimed = await this.getClaimedPlayerForTeam(teamId);
  
    return {
      role: (membership as any).role,
      member_mode: ((membership as any).member_mode || "unset") as "unset" | "player" | "spectator",
      linked_player_id: claimed?.player_id || null,
      linked_player_name: claimed?.player_name || null,
    };
  }
  
  static async getAvailablePlayersForClaim(teamId: string): Promise<Array<{
    id: string;
    name: string;
    claimed: boolean;
  }>> {
    if (!supabase) return [];
  
    const { data: teamPlayerRows, error: teamPlayersError } = await supabase
      .from(TEAM_PLAYERS_TABLE)
      .select("player_id")
      .eq("team_id", teamId);
  
    if (teamPlayersError) {
      console.error("getAvailablePlayersForClaim teamPlayers error:", teamPlayersError.message);
      return [];
    }
  
    const playerIds = (teamPlayerRows || [])
      .map((row: any) => row.player_id)
      .filter(Boolean);
  
    if (playerIds.length === 0) return [];
  
    const [{ data: players }, { data: claimedRows }] = await Promise.all([
      supabase
        .from(PLAYERS_TABLE)
        .select("id, display_name")
        .in("id", playerIds),
      supabase
        .from(PLAYER_ACCOUNTS_TABLE)
        .select("player_id")
        .eq("team_id", teamId)
        .in("player_id", playerIds),
    ]);
  
    const claimedIds = new Set((claimedRows || []).map((row: any) => row.player_id));
  
    return (players || [])
      .map((player: any) => ({
        id: player.id,
        name: player.display_name,
        claimed: claimedIds.has(player.id),
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name, "he"));
  }
  
  static async createAndClaimPlayerForTeam(teamId: string, playerName: string): Promise<{ ok: boolean; error?: string }> {
    if (!supabase) return { ok: false, error: "אין חיבור לשרת" };
  
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "יש להתחבר כדי ליצור שחקן" };
  
    const validation = validatePlayerName(playerName);
    if (!validation.valid) {
      return { ok: false, error: validation.error };
    }
  
    const playerId = `player-${slugify(validation.value)}`;
  
    const { error: playerError } = await supabase
      .from(PLAYERS_TABLE)
      .upsert(
        {
          id: playerId,
          display_name: validation.value,
          created_by: user.id,
        },
        { onConflict: "id" }
      );
  
    if (playerError) {
      console.error("createAndClaimPlayerForTeam player error:", playerError.message);
      return { ok: false, error: "שגיאה ביצירת שחקן" };
    }
  
    const { error: teamPlayerError } = await supabase
      .from(TEAM_PLAYERS_TABLE)
      .insert({
        team_id: teamId,
        player_id: playerId,
      });
  
    if (teamPlayerError && teamPlayerError.code !== "23505") {
      console.error("createAndClaimPlayerForTeam team player error:", teamPlayerError.message);
      return { ok: false, error: "שגיאה בהוספת השחקן לקבוצה" };
    }
  
    return this.claimPlayerForTeam(playerId, teamId);
  }
  
  static async setSpectatorModeForTeam(teamId: string): Promise<boolean> {
    if (!supabase) return false;
  
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
  
    // If the user was linked to a player in this team, remove that link.
    await supabase
      .from(PLAYER_ACCOUNTS_TABLE)
      .delete()
      .eq("user_id", user.id)
      .eq("team_id", teamId);
  
    const { error } = await supabase
      .from(TEAM_MEMBERS_TABLE)
      .update({ member_mode: "spectator" })
      .eq("team_id", teamId)
      .eq("user_id", user.id);
  
    if (error) {
      console.error("setSpectatorModeForTeam error:", error.message);
      return false;
    }
  
    return true;
  }

  /** Team-scoped claim. Returns { ok, error } where error is a user-friendly Hebrew message. */
  static async claimPlayerForTeam(
    playerId: string,
    teamId: string
  ): Promise<{ ok: boolean; error?: string }> {
    if (!supabase) return { ok: false, error: "אין חיבור לשרת" };
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "יש להתחבר כדי לקשר שחקן" };

    const { error } = await supabase
      .from(PLAYER_ACCOUNTS_TABLE)
      .insert({ player_id: playerId, user_id: user.id, team_id: teamId });
    if (error) {
      console.error("claimPlayerForTeam error:", error);
      const msg = (error.message || "").toLowerCase();
      const code = (error as any).code as string | undefined;

      // 23505 = unique_violation
      if (code === "23505" || msg.includes("duplicate key")) {
        if (msg.includes("team_user")) {
          return { ok: false, error: "אתה כבר מקושר לשחקן בקבוצה הזו" };
        }
        if (msg.includes("team_player")) {
          return { ok: false, error: "השחקן הזה כבר תפוס על ידי משתמש אחר בקבוצה" };
        }
        if (msg.includes("user_id_key")) {
          return {
            ok: false,
            error: "מגבלת סכמה ישנה חוסמת קישור מרובה-קבוצות. יש להריץ את המיגרציה.",
          };
        }
        return { ok: false, error: "השחקן או המשתמש כבר משויכים בקבוצה זו" };
      }

      // 23503 = foreign_key_violation, 42501 = insufficient_privilege (RLS)
      if (code === "23503") return { ok: false, error: "קבוצה או שחקן לא תקינים" };
      if (code === "42501" || msg.includes("row-level security")) {
        return { ok: false, error: "אין הרשאה לקשר שחקן בקבוצה זו" };
      }

      return { ok: false, error: error.message || "שגיאה בקישור השחקן" };
    }
    const { error: memberModeError } = await supabase
      .from(TEAM_MEMBERS_TABLE)
      .update({ member_mode: "player" })
      .eq("team_id", teamId)
      .eq("user_id", user.id);
    
    if (memberModeError) {
      console.error("claimPlayerForTeam member_mode error:", memberModeError.message);
      return { ok: false, error: "השחקן קושר, אבל לא הצלחנו לעדכן את מצב החברות בקבוצה" };
    }
    return { ok: true };
  }

  /** Legacy global claim (backward compat) */
  static async claimPlayer(playerId: string): Promise<boolean> {
    if (!supabase) return false;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from(PLAYER_ACCOUNTS_TABLE)
      .insert({ player_id: playerId, user_id: user.id });
    if (error) {
      console.error("claimPlayer error:", error.message);
      return false;
    }
    return true;
  }

  /** Unclaim player for a specific team */
  static async unclaimPlayerForTeam(teamId: string): Promise<boolean> {
    if (!supabase) return false;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from(PLAYER_ACCOUNTS_TABLE)
      .delete()
      .eq("user_id", user.id)
      .eq("team_id", teamId);
    if (error) {
      console.error("unclaimPlayerForTeam error:", error.message);
      return false;
    }
    return true;
  }

  /** Legacy: unclaim all (backward compat) */
  static async unclaimPlayer(): Promise<boolean> {
    if (!supabase) return false;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from(PLAYER_ACCOUNTS_TABLE)
      .delete()
      .eq("user_id", user.id);
    if (error) {
      console.error("unclaimPlayer error:", error.message);
      return false;
    }
    return true;
  }

  // ========== Team Members ==========
  static async getUserTeamMemberships(): Promise<Array<{ team_id: string; team_name: string; role: string }>> {
    if (!supabase) return [];
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from(TEAM_MEMBERS_TABLE)
      .select("team_id, role")
      .eq("user_id", user.id);
    if (error || !data) return [];

    // Get team names
    const teamIds = data.map(m => m.team_id);
    if (teamIds.length === 0) return [];

    const { data: teams } = await supabase
      .from(TEAMS_TABLE)
      .select("id, name")
      .in("id", teamIds);

    const teamMap = new Map((teams || []).map(t => [t.id, t.name]));
    return data.map(m => ({
      team_id: m.team_id,
      team_name: teamMap.get(m.team_id) || "Unknown",
      role: m.role
    }));
  }

  // ========== Team Invite ==========
  static async getTeamInviteCode(teamId: string): Promise<string | null> {
    if (!supabase) return null;
    const { data, error } = await supabase.rpc('get_team_invite_code', { _team_id: teamId });
    if (error) {
      console.error('getTeamInviteCode error:', error.message);
      return null;
    }
    return data;
  }

  static async regenerateTeamInviteCode(teamId: string): Promise<string | null> {
    if (!supabase) return null;
    const { data, error } = await supabase.rpc('regenerate_team_invite_code', { _team_id: teamId });
    if (error) {
      console.error('regenerateTeamInviteCode error:', error.message);
      return null;
    }
    return data;
  }

  /**
   * Resolve a code without consuming it — tells whether it belongs to a team
   * or an evening, so callers can route to the correct flow.
   */
  static async resolveInviteCode(code: string): Promise<
    | { kind: 'team'; team_id: string; team_name: string | null }
    | { kind: 'evening'; evening_id: string; team_id: string | null }
    | null
  > {
    if (!supabase) return null;
    const cleaned = code.trim().toUpperCase();
    if (!cleaned || cleaned.length > 20 || !/^[A-Z0-9-]+$/.test(cleaned)) return null;
    try {
      const { data, error } = await supabase.rpc('resolve_invite_code', { _code: cleaned });
      if (error || !data || data.length === 0) return null;
      const row: any = data[0];
      if (row.kind === 'team') {
        return { kind: 'team', team_id: row.team_id, team_name: row.team_name };
      }
      if (row.kind === 'evening') {
        return { kind: 'evening', evening_id: row.evening_id, team_id: row.team_id };
      }
      return null;
    } catch (e) {
      console.error('resolveInviteCode error:', e);
      return null;
    }
  }

  static async joinTeamByCode(code: string): Promise<{ team_id: string; team_name: string } | null> {
    if (!supabase) return null;
    const cleaned = code.trim().toUpperCase();
    if (cleaned.length === 0 || cleaned.length > 20 || !/^[A-Z0-9]+$/.test(cleaned)) {
      console.error('Invalid team code format');
      return null;
    }
    try {
      const { data, error } = await supabase.rpc('join_team_by_code', { _code: cleaned });
      if (error) throw error;
      if (data && data.length > 0) {
        return { team_id: data[0].team_id, team_name: data[0].team_name };
      }
      return null;
    } catch (error: any) {
      console.error('joinTeamByCode error:', error?.message);
      throw error;
    }
  }

  // ========== All Players (for claiming) ==========
  static async listAllPlayers(): Promise<Array<{ id: string; name: string }>> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from(PLAYERS_TABLE)
      .select("id, display_name")
      .order("display_name", { ascending: true });
    if (error) {
      console.error("listAllPlayers error:", error.message);
      return [];
    }
    return (data || []).map(p => ({ id: p.id, name: p.display_name }));
  }

  // ========== Player Stats (from normalized tables) ==========
  static async getPlayerStatsGlobal(playerId: string): Promise<{
    games_played: number;
    games_won: number;
    games_lost: number;
    games_drawn: number;
    goals_for: number;
    goals_against: number;
    alpha_count: number;
    beta_count: number;
    gamma_count: number;
    delta_count: number;
  } | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from("player_stats_global")
      .select("*")
      .eq("player_id", playerId)
      .maybeSingle();
    if (error) {
      console.error("getPlayerStatsGlobal error:", error.message);
      return null;
    }
    return data;
  }

  static async getPlayerStatsByTeam(playerId: string): Promise<Array<{
    team_id: string;
    team_name: string;
    games_played: number;
    games_won: number;
    games_lost: number;
    games_drawn: number;
    goals_for: number;
    goals_against: number;
    alpha_count: number;
    beta_count: number;
    gamma_count: number;
    delta_count: number;
  }>> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("player_stats_by_team")
      .select("*")
      .eq("player_id", playerId);
    if (error) {
      console.error("getPlayerStatsByTeam error:", error.message);
      return [];
    }
    if (!data || data.length === 0) return [];

    // Get team names
    const teamIds = data.map(s => s.team_id);
    const { data: teams } = await supabase
      .from(TEAMS_TABLE)
      .select("id, name")
      .in("id", teamIds);

    const teamMap = new Map((teams || []).map(t => [t.id, t.name]));
    return data.map(s => ({
      ...s,
      team_name: teamMap.get(s.team_id) || "Unknown"
    }));
  }

  static async getTeamLeaderboard(teamId: string): Promise<Array<{
    player_id: string;
    player_name: string;
    games_played: number;
    games_won: number;
    games_lost: number;
    games_drawn: number;
    goals_for: number;
    goals_against: number;
    alpha_count: number;
    beta_count: number;
    gamma_count: number;
    delta_count: number;
  }>> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("player_stats_by_team")
      .select("*")
      .eq("team_id", teamId);
    if (error) {
      console.error("getTeamLeaderboard error:", error.message);
      return [];
    }
    if (!data || data.length === 0) return [];

    // Get player names
    const playerIds = data.map(s => s.player_id);
    const { data: players } = await supabase
      .from(PLAYERS_TABLE)
      .select("id, display_name")
      .in("id", playerIds);

    const playerMap = new Map((players || []).map(p => [p.id, p.display_name]));
    return data
      .map(s => ({
        ...s,
        player_name: playerMap.get(s.player_id) || s.player_id
      }))
      .sort((a, b) => {
        // Sort by wins, then goal diff
        if (b.games_won !== a.games_won) return b.games_won - a.games_won;
        return (b.goals_for - b.goals_against) - (a.goals_for - a.goals_against);
      });
  }

  static async syncStats(eveningId?: string, backfillAll?: boolean): Promise<boolean> {
    if (!supabase) return false;
    try {
      const { error } = await supabase.functions.invoke('sync-stats', {
        body: eveningId ? { evening_id: eveningId } : { backfill_all: backfillAll }
      });
      if (error) {
        console.error("syncStats error:", error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.error("syncStats exception:", e);
      return false;
    }
  }

  // ========== Discoverable Teams & Join Requests ==========

  static async searchDiscoverableTeams(query: string): Promise<Array<{
    id: string;
    name: string;
    description: string | null;
    visibility: string;
    owner_id: string;
  }>> {
    if (!supabase) return [];
    const cleanQuery = (query || "").trim();
    if (!cleanQuery) return [];
    const { data, error } = await supabase
      .from(TEAMS_TABLE)
      .select("id, name, description, visibility, owner_id")
      .in("visibility", ["searchable", "public"])
      .ilike("name", `%${cleanQuery}%`)
      .limit(10);
    if (error) {
      console.error("searchDiscoverableTeams error:", error.message);
      return [];
    }
    return (data || []) as any;
  }

  static async requestToJoinTeam(teamId: string, message?: string): Promise<boolean> {
    if (!supabase) return false;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { error } = await supabase
      .from(TEAM_JOIN_REQUESTS_TABLE)
      .insert({
        team_id: teamId,
        user_id: user.id,
        requester_email: user.email || null,
        status: "pending",
        message: message?.trim() || null,
      });
    if (error) {
      // duplicate pending request — treat as success
      if (error.code === "23505") return true;
      console.error("requestToJoinTeam error:", error.message);
      return false;
    }
    return true;
  }

  static async listMyJoinRequests(): Promise<Array<{
    id: string;
    team_id: string;
    team_name: string;
    status: string;
    message: string | null;
    created_at: string;
  }>> {
    if (!supabase) return [];
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from(TEAM_JOIN_REQUESTS_TABLE)
      .select("id, team_id, status, message, created_at, teams:team_id(name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("listMyJoinRequests error:", error.message);
      return [];
    }
    return (data || []).map((r: any) => ({
      id: r.id,
      team_id: r.team_id,
      team_name: (r.teams as any)?.name || "",
      status: r.status,
      message: r.message,
      created_at: r.created_at,
    }));
  }

  static async listTeamJoinRequests(teamId: string): Promise<Array<{
    id: string;
    team_id: string;
    user_id: string;
    status: string;
    message: string | null;
    created_at: string;
    user_display_name?: string | null;
    user_email?: string | null;
  }>> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from(TEAM_JOIN_REQUESTS_TABLE)
      .select("id, team_id, user_id, requester_email, status, message, created_at")
      .eq("team_id", teamId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("listTeamJoinRequests error:", error.message);
      return [];
    }
    const rows = data || [];
    if (rows.length === 0) return [];
    // Fetch display names
    const userIds = rows.map((r: any) => r.user_id);
    const { data: profiles } = await supabase
      .from(PROFILES_TABLE)
      .select("id, display_name")
      .in("id", userIds);
    const nameMap = new Map((profiles || []).map((p: any) => [p.id, p.display_name]));
    return rows.map((r: any) => ({
      id: r.id,
      team_id: r.team_id,
      user_id: r.user_id,
      status: r.status,
      message: r.message,
      created_at: r.created_at,
      user_display_name: nameMap.get(r.user_id) || null,
      user_email: r.requester_email || null,
    }));
  }

  static async approveJoinRequest(requestId: string): Promise<boolean> {
    if (!supabase) return false;
  
    const {
      data: { user },
    } = await supabase.auth.getUser();
  
    if (!user) return false;
  
    const { data: req, error: fetchErr } = await supabase
      .from(TEAM_JOIN_REQUESTS_TABLE)
      .select("id, team_id, user_id, status")
      .eq("id", requestId)
      .maybeSingle();
  
    if (fetchErr || !req) {
      console.error("approveJoinRequest fetch error:", fetchErr?.message);
      return false;
    }
  
    if ((req as any).status !== "pending") return false;
  
    const { error: membershipError } = await supabase
      .from(TEAM_MEMBERS_TABLE)
      .insert({
        team_id: (req as any).team_id,
        user_id: (req as any).user_id,
        role: "member",
        member_mode: "unset",
      });
  
    if (membershipError && membershipError.code !== "23505") {
      console.error("approveJoinRequest membership error:", membershipError.message);
      return false;
    }
  
    const { error: updateError } = await supabase
      .from(TEAM_JOIN_REQUESTS_TABLE)
      .update({
        status: "approved",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", requestId);
  
    if (updateError) {
      console.error("approveJoinRequest update error:", updateError.message);
      return false;
    }
  
    return true;
  }

  static async rejectJoinRequest(requestId: string): Promise<boolean> {
    if (!supabase) return false;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { error } = await supabase
      .from(TEAM_JOIN_REQUESTS_TABLE)
      .update({
        status: "rejected",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .eq("status", "pending");
    if (error) {
      console.error("rejectJoinRequest error:", error.message);
      return false;
    }
    return true;
  }
}

