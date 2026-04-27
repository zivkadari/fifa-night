/**
 * Unified, team-aware history data layer.
 *
 * Single source of truth for the new Profile experience and for the
 * team-scoped TournamentHistory page. Identity is grounded strictly in
 * `player_accounts` — i.e. the explicit user→player link per team.
 *
 * Why an extra "name match within linked team" step?
 * 5-player evenings synthesize per-evening player IDs (e.g.
 * "player-1776180810020-2") that don't equal the canonical claimed
 * `player_id` (e.g. "player-זיו"). To still recognize the user's own 5P
 * tournaments, we accept a player whose NAME matches the linked
 * `player_name` *within the same linked team*. This stays link-grounded:
 * we never match purely by name across the whole DB.
 */

import { Evening, Player } from "@/types/tournament";
import { RemoteStorageService } from "./remoteStorageService";

export type TournamentMode = "pairs" | "singles" | "five-player-doubles" | "unknown";

export interface UnifiedEvening extends Evening {
  teamId?: string;
  teamName?: string;
  /** Resolved, normalized mode used for display + filtering */
  resolvedMode: TournamentMode;
  /** Source row updated_at (for fallback sorting) */
  _updatedAt?: string;
  /** Source row created_at (for fallback sorting) */
  _createdAt?: string;
}

export interface MyParticipation {
  /** The (per-evening) player object that represents the current user */
  selfPlayer: Player;
  /** Tier the user landed in for this evening, if any */
  tier?: "alpha" | "beta" | "gamma" | "delta" | "epsilon";
  /** Aggregate per-evening result for the user */
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
}

export interface MyEvening extends UnifiedEvening {
  participation: MyParticipation;
}

export interface OverviewStats {
  tournamentsPlayed: number;
  gamesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  winRate: number; // 0..1
  alpha: number;
  beta: number;
  gamma: number;
  delta: number;
  epsilon: number;
  /** Per-team breakdown for the cross-team summary */
  perTeam: Array<{
    teamId: string;
    teamName: string;
    playerName: string;
    tournaments: number;
    wins: number;
    games: number;
    winRate: number;
    alpha: number;
  }>;
  /** Cross-team insights (sorted by impact, derived from perTeam + mode) */
  insights: Insight[];
}

export interface TeamStats {
  teamId: string;
  teamName: string;
  /** How many tournaments the user played in this team */
  tournamentsPlayed: number;
  /** How many tournaments exist in this team total (visible) */
  teamTournamentsTotal: number;
  gamesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  winRate: number;
  alpha: number;
  beta: number;
  gamma: number;
  delta: number;
  epsilon: number;
  insights: Insight[];
}

export interface Insight {
  id: string;
  icon: "trophy" | "flame" | "target" | "users" | "trending" | "medal" | "star";
  title: string;
  detail?: string;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u0590-\u05ff]+/g, "-")
    .replace(/^-+|-+$/g, "");

function resolveMode(e: Evening): TournamentMode {
  const anyE = e as any;
  if (anyE.mode === "five-player-doubles") return "five-player-doubles";
  if (anyE.type === "singles") return "singles";
  if (anyE.type === "pairs") return "pairs";
  if (typeof anyE.id === "string" && anyE.id.startsWith("fp-")) return "five-player-doubles";
  return "unknown";
}

function timestampOf(e: UnifiedEvening): number {
  const candidates = [e.date, e._updatedAt, e._createdAt];
  for (const c of candidates) {
    if (!c) continue;
    const t = new Date(c).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

function sortNewestFirst<T extends UnifiedEvening>(arr: T[]): T[] {
  return [...arr].sort((a, b) => timestampOf(b) - timestampOf(a));
}

function detectTier(
  e: Evening,
  playerId: string,
  playerNameSlug: string
): MyParticipation["tier"] | undefined {
  const anyE = e as any;

  const inGroup = (group?: Array<{ id: string; name: string }>) =>
    Array.isArray(group) &&
    group.some((p) => p.id === playerId || slugify(p.name) === playerNameSlug);

  const r = anyE.rankings;

  if (r) {
    if (inGroup(r.alpha)) return "alpha";
    if (inGroup(r.beta)) return "beta";
    if (inGroup(r.gamma)) return "gamma";
    if (inGroup(r.delta)) return "delta";
    if (inGroup(r.epsilon)) return "epsilon";
  }

  // 5-player doubles tournaments store results in schedule[] instead of rankings.
  // Compute the final player tier from completed matches.
  if (!Array.isArray(anyE.schedule) || !Array.isArray(anyE.players)) {
    return undefined;
  }

  type Row = {
    player: Player;
    points: number;
    gd: number;
    gf: number;
  };

  const stats = new Map<string, Row>();

  for (const p of anyE.players as Player[]) {
    stats.set(p.id, {
      player: p,
      points: 0,
      gd: 0,
      gf: 0,
    });
  }

  let anyCompleted = false;

  for (const m of anyE.schedule) {
    if (!m?.completed || m.scoreA == null || m.scoreB == null) continue;

    anyCompleted = true;

    const a = m.scoreA as number;
    const b = m.scoreB as number;
    const diff = Math.min(3, Math.max(-3, a - b));
    const aWin = a > b;
    const bWin = b > a;
    const draw = a === b;

    for (const p of m.pairA?.players || []) {
      const s = stats.get(p.id);
      if (!s) continue;

      s.points += aWin ? 3 : draw ? 1 : 0;
      s.gd += diff;
      s.gf += a;
    }

    for (const p of m.pairB?.players || []) {
      const s = stats.get(p.id);
      if (!s) continue;

      s.points += bWin ? 3 : draw ? 1 : 0;
      s.gd -= diff;
      s.gf += b;
    }
  }

  if (!anyCompleted) return undefined;

  const sorted = Array.from(stats.values()).sort(
    (x, y) => y.points - x.points || y.gd - x.gd || y.gf - x.gf
  );

  const index = sorted.findIndex(
    (row) =>
      row.player.id === playerId ||
      slugify(row.player.name) === playerNameSlug
  );

  if (index === 0) return "alpha";
  if (index === 1) return "beta";
  if (index === 2) return "gamma";
  if (index === 3) return "delta";
  if (index >= 4) return "epsilon";

  return undefined;
}

/**
 * Aggregate per-evening counters for the user (games, W/L/D, goals).
 * Handles three shapes:
 *   - Pairs evening: rounds[].matches[] (pair vs pair, score [a,b])
 *   - Singles evening: gameSequence[] (player vs player)
 *   - 5-player doubles: schedule[] (pairA vs pairB)
 */
function aggregateUserCounters(
  e: Evening,
  selfPlayerId: string,
  selfNameSlug: string
): Pick<MyParticipation, "played" | "wins" | "draws" | "losses" | "goalsFor" | "goalsAgainst"> {
  let played = 0,
    wins = 0,
    draws = 0,
    losses = 0,
    goalsFor = 0,
    goalsAgainst = 0;

  const isMe = (p?: { id?: string; name?: string }) =>
    !!p && (p.id === selfPlayerId || slugify(p.name || "") === selfNameSlug);

  const anyE = e as any;

  // Pairs (rounds)
  if (Array.isArray(e.rounds) && e.rounds.length > 0) {
    for (const r of e.rounds) {
      for (const m of r.matches || []) {
        if (!m.completed || !m.score) continue;
        const [a, b] = m.score;
        const inA = m.pairs?.[0]?.players?.some(isMe);
        const inB = m.pairs?.[1]?.players?.some(isMe);
        if (!inA && !inB) continue;
        played++;
        if (inA) {
          goalsFor += a;
          goalsAgainst += b;
          if (a > b) wins++;
          else if (a < b) losses++;
          else draws++;
        } else {
          goalsFor += b;
          goalsAgainst += a;
          if (b > a) wins++;
          else if (b < a) losses++;
          else draws++;
        }
      }
    }
  }

  // Singles (gameSequence)
  if (Array.isArray(anyE.gameSequence)) {
    for (const g of anyE.gameSequence) {
      if (!g.completed || !g.score) continue;
      const [a, b] = g.score;
      const inA = isMe(g.players?.[0]);
      const inB = isMe(g.players?.[1]);
      if (!inA && !inB) continue;
      played++;
      if (inA) {
        goalsFor += a;
        goalsAgainst += b;
        if (a > b) wins++;
        else if (a < b) losses++;
        else draws++;
      } else {
        goalsFor += b;
        goalsAgainst += a;
        if (b > a) wins++;
        else if (b < a) losses++;
        else draws++;
      }
    }
  }

  // 5-player doubles (schedule)
  if (Array.isArray(anyE.schedule)) {
    for (const m of anyE.schedule) {
      if (!m.completed || m.scoreA == null || m.scoreB == null) continue;
      const inA = m.pairA?.players?.some(isMe);
      const inB = m.pairB?.players?.some(isMe);
      if (!inA && !inB) continue;
      played++;
      const a = m.scoreA as number;
      const b = m.scoreB as number;
      if (inA) {
        goalsFor += a;
        goalsAgainst += b;
        if (a > b) wins++;
        else if (a < b) losses++;
        else draws++;
      } else {
        goalsFor += b;
        goalsAgainst += a;
        if (b > a) wins++;
        else if (b < a) losses++;
        else draws++;
      }
    }
  }

  return { played, wins, draws, losses, goalsFor, goalsAgainst };
}

function pct(num: number, den: number): number {
  return den > 0 ? num / den : 0;
}

function buildGlobalInsights(stats: OverviewStats): Insight[] {
  const out: Insight[] = [];
  const teamsWithGames = stats.perTeam.filter((t) => t.games > 0);
  if (teamsWithGames.length === 0) return out;

  const mostActive = [...stats.perTeam].sort((a, b) => b.tournaments - a.tournaments)[0];
  if (mostActive && mostActive.tournaments > 0) {
    out.push({
      id: "most-active",
      icon: "flame",
      title: `הקבוצה הפעילה ביותר שלך: ${mostActive.teamName}`,
      detail: `${mostActive.tournaments} טורנירים`,
    });
  }

  const bestWinRate = [...teamsWithGames].sort((a, b) => b.winRate - a.winRate)[0];
  if (bestWinRate && bestWinRate.games >= 3) {
    out.push({
      id: "best-winrate",
      icon: "trending",
      title: `אחוז ניצחון הכי גבוה: ${bestWinRate.teamName}`,
      detail: `${Math.round(bestWinRate.winRate * 100)}% (${bestWinRate.wins}/${bestWinRate.games})`,
    });
  }

  const mostAlpha = [...stats.perTeam].sort((a, b) => b.alpha - a.alpha)[0];
  if (mostAlpha && mostAlpha.alpha > 0) {
    out.push({
      id: "alpha-king",
      icon: "trophy",
      title: `הכי הרבה אלפא ב${mostAlpha.teamName}`,
      detail: `${mostAlpha.alpha} פעמים`,
    });
  }

  return out;
}

function buildTeamInsights(
  teamStats: TeamStats,
  myTeamEvenings: MyEvening[]
): Insight[] {
  const out: Insight[] = [];
  const totalGames = teamStats.gamesPlayed;

  if (totalGames >= 3) {
    out.push({
      id: "team-winrate",
      icon: "trending",
      title: `אחוז ניצחון בקבוצה: ${Math.round(teamStats.winRate * 100)}%`,
      detail: `${teamStats.wins}-${teamStats.draws}-${teamStats.losses} (W-D-L)`,
    });
  }

  // Best mode within this team
  const byMode = new Map<TournamentMode, { wins: number; games: number }>();
  for (const e of myTeamEvenings) {
    const cur = byMode.get(e.resolvedMode) || { wins: 0, games: 0 };
    cur.wins += e.participation.wins;
    cur.games += e.participation.played;
    byMode.set(e.resolvedMode, cur);
  }
  let bestMode: { mode: TournamentMode; rate: number; wins: number; games: number } | null = null;
  for (const [mode, v] of byMode) {
    if (v.games < 3) continue;
    const rate = v.wins / v.games;
    if (!bestMode || rate > bestMode.rate) bestMode = { mode, rate, wins: v.wins, games: v.games };
  }
  if (bestMode) {
    out.push({
      id: "team-best-mode",
      icon: "star",
      title: `המצב החזק שלך כאן: ${modeLabelHe[bestMode.mode]}`,
      detail: `${Math.round(bestMode.rate * 100)}% (${bestMode.wins}/${bestMode.games})`,
    });
  }

  // Best teammate (5P + pairs)
  const teammateScore = new Map<string, { name: string; wins: number; games: number }>();
  for (const e of myTeamEvenings) {
    const selfId = e.participation.selfPlayer.id;
    const selfSlug = slugify(e.participation.selfPlayer.name);
    const isMe = (p?: { id?: string; name?: string }) =>
      !!p && (p.id === selfId || slugify(p.name || "") === selfSlug);

    const consume = (
      teammates: Player[],
      didWin: boolean
    ) => {
      for (const t of teammates) {
        if (isMe(t)) continue;
        const key = slugify(t.name);
        const cur = teammateScore.get(key) || { name: t.name, wins: 0, games: 0 };
        cur.games++;
        if (didWin) cur.wins++;
        teammateScore.set(key, cur);
      }
    };

    // pairs rounds
    for (const r of e.rounds || []) {
      for (const m of r.matches || []) {
        if (!m.completed || !m.score) continue;
        const inA = m.pairs?.[0]?.players?.some(isMe);
        const inB = m.pairs?.[1]?.players?.some(isMe);
        if (!inA && !inB) continue;
        const [a, b] = m.score;
        const myPair = inA ? m.pairs[0] : m.pairs[1];
        const myScore = inA ? a : b;
        const oppScore = inA ? b : a;
        consume(myPair.players as Player[], myScore > oppScore);
      }
    }
    // 5P schedule
    const sched = (e as any).schedule as any[] | undefined;
    if (Array.isArray(sched)) {
      for (const m of sched) {
        if (!m.completed || m.scoreA == null || m.scoreB == null) continue;
        const inA = m.pairA?.players?.some(isMe);
        const inB = m.pairB?.players?.some(isMe);
        if (!inA && !inB) continue;
        const myPair = inA ? m.pairA : m.pairB;
        const myScore = inA ? m.scoreA : m.scoreB;
        const oppScore = inA ? m.scoreB : m.scoreA;
        consume(myPair.players as Player[], myScore > oppScore);
      }
    }
  }
  let bestTeammate: { name: string; rate: number; wins: number; games: number } | null = null;
  for (const v of teammateScore.values()) {
    if (v.games < 3) continue;
    const rate = v.wins / v.games;
    if (!bestTeammate || rate > bestTeammate.rate) {
      bestTeammate = { name: v.name, rate, wins: v.wins, games: v.games };
    }
  }
  if (bestTeammate) {
    out.push({
      id: "team-best-teammate",
      icon: "users",
      title: `הפרטנר החזק שלך: ${bestTeammate.name}`,
      detail: `${Math.round(bestTeammate.rate * 100)}% ניצחון יחד (${bestTeammate.wins}/${bestTeammate.games})`,
    });
  }

  // Tier highlights
  if (teamStats.alpha > 0) {
    out.push({
      id: "team-alpha",
      icon: "trophy",
      title: `סיימת אלפא ${teamStats.alpha} פעמים בקבוצה זו`,
    });
  }

  return out;
}

export class UserHistoryService {
  static async loadAllVisibleEvenings(): Promise<UnifiedEvening[]> {
    const rows = await RemoteStorageService.loadEveningsWithTeams();
    const enriched: UnifiedEvening[] = rows.map((r) => {
      const anyR = r as any;
      return {
        ...(r as Evening),
        teamId: anyR.teamId,
        teamName: anyR.teamName,
        resolvedMode: resolveMode(r as Evening),
        _updatedAt: anyR._updatedAt,
        _createdAt: anyR._createdAt,
      };
    });
    return sortNewestFirst(enriched);
  }

  static async loadMyEvenings(allEvenings?: UnifiedEvening[]): Promise<MyEvening[]> {
    const claims = await RemoteStorageService.getClaimedPlayersByTeam();
    if (claims.length === 0) return [];

    const all = allEvenings ?? (await this.loadAllVisibleEvenings());

    const claimByTeam = new Map<string, { player_id: string; player_name: string }>();
    for (const c of claims) {
      if (c.team_id) {
        claimByTeam.set(c.team_id, { player_id: c.player_id, player_name: c.player_name });
      }
    }

    const mine: MyEvening[] = [];
    for (const e of all) {
      if (!e.teamId) continue;
      const claim = claimByTeam.get(e.teamId);
      if (!claim) continue;
      const claimSlug = slugify(claim.player_name);
      const claimNorm = norm(claim.player_name);

      const players = Array.isArray(e.players) ? e.players : [];
      const selfPlayer = players.find(
        (p) =>
          p.id === claim.player_id ||
          slugify(p.name) === claimSlug ||
          norm(p.name) === claimNorm
      );
      if (!selfPlayer) continue;

      const selfSlug = slugify(selfPlayer.name);
      const tier = detectTier(e, selfPlayer.id, selfSlug);
      const counters = aggregateUserCounters(e, selfPlayer.id, selfSlug);
      mine.push({
        ...e,
        participation: { selfPlayer, tier, ...counters },
      });
    }
    return sortNewestFirst(mine);
  }

  static async loadOverview(myEvenings?: MyEvening[]): Promise<OverviewStats> {
    const mine = myEvenings ?? (await this.loadMyEvenings());
    const claims = await RemoteStorageService.getClaimedPlayersByTeam();
    const memberships = await RemoteStorageService.getUserTeamMemberships();
    const teamNameById = new Map(memberships.map((m) => [m.team_id, m.team_name]));

    const stats: OverviewStats = {
      tournamentsPlayed: mine.length,
      gamesPlayed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      winRate: 0,
      alpha: 0,
      beta: 0,
      gamma: 0,
      delta: 0,
      epsilon: 0,
      perTeam: [],
      insights: [],
    };

    type TeamAgg = {
      tournaments: number;
      games: number;
      wins: number;
      alpha: number;
    };
    const perTeamAgg = new Map<string, TeamAgg>();

    for (const e of mine) {
      const p = e.participation;
      stats.gamesPlayed += p.played;
      stats.wins += p.wins;
      stats.draws += p.draws;
      stats.losses += p.losses;
      stats.goalsFor += p.goalsFor;
      stats.goalsAgainst += p.goalsAgainst;
      if (p.tier) stats[p.tier]++;
      if (e.teamId) {
        const a = perTeamAgg.get(e.teamId) || { tournaments: 0, games: 0, wins: 0, alpha: 0 };
        a.tournaments++;
        a.games += p.played;
        a.wins += p.wins;
        if (p.tier === "alpha") a.alpha++;
        perTeamAgg.set(e.teamId, a);
      }
    }
    stats.winRate = pct(stats.wins, stats.gamesPlayed);

    for (const c of claims) {
      if (!c.team_id) continue;
      const a = perTeamAgg.get(c.team_id) || { tournaments: 0, games: 0, wins: 0, alpha: 0 };
      stats.perTeam.push({
        teamId: c.team_id,
        teamName: teamNameById.get(c.team_id) || "—",
        playerName: c.player_name,
        tournaments: a.tournaments,
        wins: a.wins,
        games: a.games,
        winRate: pct(a.wins, a.games),
        alpha: a.alpha,
      });
    }
    stats.perTeam.sort((a, b) => b.tournaments - a.tournaments);
    stats.insights = buildGlobalInsights(stats);
    return stats;
  }

  /**
   * Compute a team-scoped stat block + insights for the current user.
   */
  static async loadTeamStats(
    teamId: string,
    teamName: string,
    allEvenings?: UnifiedEvening[],
    myEvenings?: MyEvening[]
  ): Promise<TeamStats> {
    const all = allEvenings ?? (await this.loadAllVisibleEvenings());
    const mine = myEvenings ?? (await this.loadMyEvenings(all));
    const myTeam = mine.filter((e) => e.teamId === teamId);
    const teamTotal = all.filter((e) => e.teamId === teamId).length;

    const ts: TeamStats = {
      teamId,
      teamName,
      tournamentsPlayed: myTeam.length,
      teamTournamentsTotal: teamTotal,
      gamesPlayed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      winRate: 0,
      alpha: 0,
      beta: 0,
      gamma: 0,
      delta: 0,
      epsilon: 0,
      insights: [],
    };
    for (const e of myTeam) {
      const p = e.participation;
      ts.gamesPlayed += p.played;
      ts.wins += p.wins;
      ts.draws += p.draws;
      ts.losses += p.losses;
      ts.goalsFor += p.goalsFor;
      ts.goalsAgainst += p.goalsAgainst;
      if (p.tier) ts[p.tier]++;
    }
    ts.winRate = pct(ts.wins, ts.gamesPlayed);
    ts.insights = buildTeamInsights(ts, myTeam);
    return ts;
  }

  static async loadTeamHistory(
    teamId: string,
    options: { onlyMine?: boolean } = {},
    allEvenings?: UnifiedEvening[]
  ): Promise<UnifiedEvening[] | MyEvening[]> {
    const all = allEvenings ?? (await this.loadAllVisibleEvenings());
    const teamScoped = all.filter((e) => e.teamId === teamId);
    if (!options.onlyMine) return sortNewestFirst(teamScoped);

    const mine = await this.loadMyEvenings(all);
    return sortNewestFirst(mine.filter((e) => e.teamId === teamId));
  }
}

export const tierLabelHe: Record<NonNullable<MyParticipation["tier"]>, string> = {
  alpha: "אלפא",
  beta: "בטא",
  gamma: "גמא",
  delta: "דלתא",
  epsilon: "אפסילון",
};

export const modeLabelHe: Record<TournamentMode, string> = {
  pairs: "זוגות",
  singles: "יחידים",
  "five-player-doubles": "5 שחקנים",
  unknown: "טורניר",
};
