import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Player {
  id: string;
  name: string;
}

interface Pair {
  id: string;
  players: [Player, Player];
}

interface Match {
  pairs: [Pair, Pair];
  score?: [number, number];
  winner?: string;
  completed: boolean;
}

interface Round {
  matches: Match[];
  completed: boolean;
}

interface SinglesGame {
  players: [Player, Player];
  score?: [number, number];
  winner?: string;
  completed: boolean;
}

// Five-player doubles match structure
interface FPMatch {
  pairA: { players: [Player, Player] };
  pairB: { players: [Player, Player] };
  scoreA?: number;
  scoreB?: number;
  completed: boolean;
}

interface Evening {
  id: string;
  mode?: string;
  players: Player[];
  rounds?: Round[];
  schedule?: FPMatch[];
  completed: boolean;
  rankings?: {
    alpha: Player[];
    beta: Player[];
    gamma: Player[];
    delta?: Player[];
  };
  type?: "pairs" | "singles";
  gameSequence?: SinglesGame[];
}

interface PlayerStats {
  player: Player;
  wins: number;
  losses: number;
  draws: number;
  goalsFor: number;
  goalsAgainst: number;
  alphaCount: number;
  betaCount: number;
  gammaCount: number;
  deltaCount: number;
}

function calculatePlayerStats(evening: Evening): PlayerStats[] {
  const statsMap = new Map<string, PlayerStats>();

  // Initialize stats for all players
  evening.players.forEach((player) => {
    statsMap.set(player.id, {
      player,
      wins: 0,
      losses: 0,
      draws: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      alphaCount: 0,
      betaCount: 0,
      gammaCount: 0,
      deltaCount: 0,
    });
  });

  if (evening.mode === "five-player-doubles" && evening.schedule) {
    // Process five-player doubles matches
    for (const match of evening.schedule) {
      if (!match.completed || match.scoreA === undefined || match.scoreB === undefined) continue;

      const scoreA = match.scoreA;
      const scoreB = match.scoreB;

      // Update goals for pairA players
      for (const p of match.pairA.players) {
        const s = statsMap.get(p.id);
        if (s) {
          s.goalsFor += scoreA;
          s.goalsAgainst += scoreB;
          if (scoreA > scoreB) s.wins++;
          else if (scoreB > scoreA) s.losses++;
          else s.draws++;
        }
      }

      // Update goals for pairB players
      for (const p of match.pairB.players) {
        const s = statsMap.get(p.id);
        if (s) {
          s.goalsFor += scoreB;
          s.goalsAgainst += scoreA;
          if (scoreB > scoreA) s.wins++;
          else if (scoreA > scoreB) s.losses++;
          else s.draws++;
        }
      }
    }
  } else if (evening.type === "singles" && evening.gameSequence) {
    // Process singles games
    evening.gameSequence.forEach((game) => {
      if (game.completed && game.score) {
        const [score1, score2] = game.score;
        const [player1, player2] = game.players;

        const stats1 = statsMap.get(player1.id);
        const stats2 = statsMap.get(player2.id);

        if (stats1 && stats2) {
          stats1.goalsFor += score1;
          stats1.goalsAgainst += score2;
          stats2.goalsFor += score2;
          stats2.goalsAgainst += score1;

          if (score1 > score2) {
            stats1.wins++;
            stats2.losses++;
          } else if (score2 > score1) {
            stats2.wins++;
            stats1.losses++;
          } else {
            stats1.draws++;
            stats2.draws++;
          }
        }
      }
    });
  } else if (evening.rounds) {
    // Process pairs matches
    evening.rounds.forEach((round) => {
      round.matches.forEach((match) => {
        if (match.completed && match.score) {
          const [score1, score2] = match.score;
          const [pair1, pair2] = match.pairs;

          pair1.players.forEach((player) => {
            const stats = statsMap.get(player.id);
            if (stats) {
              stats.goalsFor += score1;
              stats.goalsAgainst += score2;
            }
          });

          pair2.players.forEach((player) => {
            const stats = statsMap.get(player.id);
            if (stats) {
              stats.goalsFor += score2;
              stats.goalsAgainst += score1;
            }
          });

          if (score1 > score2) {
            pair1.players.forEach((player) => {
              const stats = statsMap.get(player.id);
              if (stats) stats.wins++;
            });
            pair2.players.forEach((player) => {
              const stats = statsMap.get(player.id);
              if (stats) stats.losses++;
            });
          } else if (score2 > score1) {
            pair2.players.forEach((player) => {
              const stats = statsMap.get(player.id);
              if (stats) stats.wins++;
            });
            pair1.players.forEach((player) => {
              const stats = statsMap.get(player.id);
              if (stats) stats.losses++;
            });
          } else {
            [...pair1.players, ...pair2.players].forEach((player) => {
              const stats = statsMap.get(player.id);
              if (stats) stats.draws++;
            });
          }
        }
      });
    });
  }

  // Add ranking counts if evening is completed
  if (evening.completed && evening.rankings) {
    evening.rankings.alpha?.forEach((player) => {
      const stats = statsMap.get(player.id);
      if (stats) stats.alphaCount++;
    });
    evening.rankings.beta?.forEach((player) => {
      const stats = statsMap.get(player.id);
      if (stats) stats.betaCount++;
    });
    evening.rankings.gamma?.forEach((player) => {
      const stats = statsMap.get(player.id);
      if (stats) stats.gammaCount++;
    });
    evening.rankings.delta?.forEach((player) => {
      const stats = statsMap.get(player.id);
      if (stats) stats.deltaCount++;
    });
  }

  return Array.from(statsMap.values());
}

/**
 * Build a mapping from tournament player IDs to canonical team player IDs
 * by matching on player name (normalized).
 */
function buildPlayerIdMapping(
  eveningPlayers: Player[],
  teamPlayers: { player_id: string; display_name: string }[]
): Map<string, string> {
  const mapping = new Map<string, string>();
  const teamByName = new Map<string, string>();
  for (const tp of teamPlayers) {
    teamByName.set(tp.display_name.trim().toLowerCase(), tp.player_id);
  }
  for (const p of eveningPlayers) {
    const canonical = teamByName.get(p.name.trim().toLowerCase());
    if (canonical && canonical !== p.id) {
      mapping.set(p.id, canonical);
    }
  }
  return mapping;
}

function remapPlayerId(id: string, mapping: Map<string, string>): string {
  return mapping.get(id) || id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;

    // Use service role for data operations
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { evening_id, backfill_all, team_id } = body;
    const teamId = typeof team_id === "string" && team_id.trim() ? team_id.trim() : null;

    console.log("sync-stats called with:", { evening_id, backfill_all, team_id: teamId, userId });

    // Restrict backfill_all to admin users only
    if (backfill_all) {
      const { data: isAdmin } = await supabase.rpc("is_clubs_admin", { user_id: userId });
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: "Admin access required for backfill" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    let evenings: { id: string; data: Evening; team_id: string | null }[] = [];

    if (backfill_all) {
      const { data, error } = await supabase
        .from("evenings")
        .select("id, data, team_id");

      if (error) throw error;
      evenings = data || [];
      console.log(`Backfilling ${evenings.length} evenings`);
    } else if (teamId) {
      const { data: team, error: teamError } = await supabase
        .from("teams")
        .select("id, owner_id")
        .eq("id", teamId)
        .maybeSingle();

      if (teamError) throw teamError;
      if (!team) {
        return new Response(
          JSON.stringify({ error: "Team not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: membership, error: membershipError } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("team_id", teamId)
        .eq("user_id", userId)
        .maybeSingle();

      if (membershipError) throw membershipError;
      if (team.owner_id !== userId && !membership) {
        return new Response(
          JSON.stringify({ error: "Team membership required for stats sync" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("evenings")
        .select("id, data, team_id")
        .eq("team_id", teamId);

      if (error) throw error;
      evenings = data || [];
      console.log(`Syncing stats for team ${teamId}: ${evenings.length} evenings`);
    } else if (evening_id) {
      const { data, error } = await supabase
        .from("evenings")
        .select("id, data, team_id")
        .eq("id", evening_id)
        .single();

      if (error) throw error;
      if (data) evenings = [data];
    } else {
      return new Response(
        JSON.stringify({ error: "evening_id or backfill_all required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Pre-fetch team players for name-to-canonical-ID mapping
    const teamIds = [...new Set(evenings.filter(e => e.team_id).map(e => e.team_id!))];
    const teamPlayersMap = new Map<string, { player_id: string; display_name: string }[]>();

    if (teamIds.length > 0) {
      const { data: tpData } = await supabase
        .from("team_players")
        .select("team_id, player_id")
        .in("team_id", teamIds);

      if (tpData && tpData.length > 0) {
        const allPlayerIds = [...new Set(tpData.map(tp => tp.player_id))];
        const { data: playersData } = await supabase
          .from("players")
          .select("id, display_name")
          .in("id", allPlayerIds);

        const playerNameMap = new Map((playersData || []).map(p => [p.id, p.display_name]));

        for (const tp of tpData) {
          if (!teamPlayersMap.has(tp.team_id)) {
            teamPlayersMap.set(tp.team_id, []);
          }
          teamPlayersMap.get(tp.team_id)!.push({
            player_id: tp.player_id,
            display_name: playerNameMap.get(tp.player_id) || tp.player_id,
          });
        }
      }
    }

    // Aggregate stats across all evenings per player per team
    const byTeamStats = new Map<string, Map<string, PlayerStats>>();
    const globalStats = new Map<string, PlayerStats>();

    for (const row of evenings) {
      const evening = row.data as Evening;
      const teamId = row.team_id;

      if (!evening || !evening.players) {
        console.log(`Skipping evening ${row.id}: no valid data`);
        continue;
      }

      // Build name-to-canonical-ID mapping for this evening's team
      const idMapping = new Map<string, string>();
      if (teamId && teamPlayersMap.has(teamId)) {
        const mapping = buildPlayerIdMapping(evening.players, teamPlayersMap.get(teamId)!);
        for (const [from, to] of mapping) {
          idMapping.set(from, to);
        }
      }

      const stats = calculatePlayerStats(evening);

      for (const stat of stats) {
        // Remap to canonical player ID
        const canonicalId = remapPlayerId(stat.player.id, idMapping);
        const canonicalPlayer = { ...stat.player, id: canonicalId };

        // Update team-specific stats
        if (teamId) {
          if (!byTeamStats.has(teamId)) {
            byTeamStats.set(teamId, new Map());
          }
          const teamMap = byTeamStats.get(teamId)!;

          if (!teamMap.has(canonicalId)) {
            teamMap.set(canonicalId, {
              player: canonicalPlayer,
              wins: 0,
              losses: 0,
              draws: 0,
              goalsFor: 0,
              goalsAgainst: 0,
              alphaCount: 0,
              betaCount: 0,
              gammaCount: 0,
              deltaCount: 0,
            });
          }

          const existing = teamMap.get(canonicalId)!;
          existing.wins += stat.wins;
          existing.losses += stat.losses;
          existing.draws += stat.draws;
          existing.goalsFor += stat.goalsFor;
          existing.goalsAgainst += stat.goalsAgainst;
          existing.alphaCount += stat.alphaCount;
          existing.betaCount += stat.betaCount;
          existing.gammaCount += stat.gammaCount;
          existing.deltaCount += stat.deltaCount;
        }

        // Update global stats
        if (!globalStats.has(canonicalId)) {
          globalStats.set(canonicalId, {
            player: canonicalPlayer,
            wins: 0,
            losses: 0,
            draws: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            alphaCount: 0,
            betaCount: 0,
            gammaCount: 0,
            deltaCount: 0,
          });
        }

        const existing = globalStats.get(canonicalId)!;
        existing.wins += stat.wins;
        existing.losses += stat.losses;
        existing.draws += stat.draws;
        existing.goalsFor += stat.goalsFor;
        existing.goalsAgainst += stat.goalsAgainst;
        existing.alphaCount += stat.alphaCount;
        existing.betaCount += stat.betaCount;
        existing.gammaCount += stat.gammaCount;
        existing.deltaCount += stat.deltaCount;
      }
    }

    // For backfill, clear existing stats first
    if (backfill_all) {
      console.log("Clearing existing stats for full backfill");
      await supabase.from("player_stats_by_team").delete().neq("player_id", "");
      await supabase.from("player_stats_global").delete().neq("player_id", "");
    } else if (teamId) {
      console.log(`Clearing existing team stats for ${teamId}`);
      const { error } = await supabase
        .from("player_stats_by_team")
        .delete()
        .eq("team_id", teamId);

      if (error) throw error;
    }

    // Upsert team stats
    const teamUpserts: {
      team_id: string;
      player_id: string;
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
    }[] = [];

    for (const [teamId, playerMap] of byTeamStats) {
      for (const [playerId, stats] of playerMap) {
        teamUpserts.push({
          team_id: teamId,
          player_id: playerId,
          games_played: stats.wins + stats.losses + stats.draws,
          games_won: stats.wins,
          games_lost: stats.losses,
          games_drawn: stats.draws,
          goals_for: stats.goalsFor,
          goals_against: stats.goalsAgainst,
          alpha_count: stats.alphaCount,
          beta_count: stats.betaCount,
          gamma_count: stats.gammaCount,
          delta_count: stats.deltaCount,
        });
      }
    }

    if (teamUpserts.length > 0) {
      const { error } = await supabase
        .from("player_stats_by_team")
        .upsert(teamUpserts, { onConflict: "team_id,player_id" });

      if (error) {
        console.error("Error upserting team stats:", error);
        throw error;
      }
      console.log(`Upserted ${teamUpserts.length} team stats records`);
    }

    // Upsert global stats. Team-scoped sync intentionally leaves global stats alone
    // because it only recalculates a slice of the full data set.
    const globalUpserts: {
      player_id: string;
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
    }[] = [];

    if (!teamId) {
      for (const [playerId, stats] of globalStats) {
        globalUpserts.push({
          player_id: playerId,
          games_played: stats.wins + stats.losses + stats.draws,
          games_won: stats.wins,
          games_lost: stats.losses,
          games_drawn: stats.draws,
          goals_for: stats.goalsFor,
          goals_against: stats.goalsAgainst,
          alpha_count: stats.alphaCount,
          beta_count: stats.betaCount,
          gamma_count: stats.gammaCount,
          delta_count: stats.deltaCount,
        });
      }
    }

    if (globalUpserts.length > 0) {
      const { error } = await supabase
        .from("player_stats_global")
        .upsert(globalUpserts, { onConflict: "player_id" });

      if (error) {
        console.error("Error upserting global stats:", error);
        throw error;
      }
      console.log(`Upserted ${globalUpserts.length} global stats records`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        scope: teamId ? "team" : backfill_all ? "all" : "evening",
        team_id: teamId,
        team_stats_count: teamUpserts.length,
        global_stats_count: globalUpserts.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("sync-stats error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
