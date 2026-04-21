/**
 * Unified, team-aware history data layer.
 *
 * Single source of truth for the new Profile experience and (later) the
 * existing TournamentHistory page. Identity is grounded strictly in
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
}

export interface MyEvening extends UnifiedEvening {
  participation: MyParticipation;
}

export interface OverviewStats {
  tournamentsPlayed: number;
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
  }>;
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
  // Heuristic fallback
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

/**
 * Detect tier of a given player in an evening's rankings.
 */
function detectTier(
  e: Evening,
  playerId: string,
  playerNameSlug: string
): MyParticipation["tier"] | undefined {
  const r = e.rankings as any;
  if (!r) return undefined;
  const inGroup = (group?: Array<{ id: string; name: string }>) =>
    Array.isArray(group) &&
    group.some((p) => p.id === playerId || slugify(p.name) === playerNameSlug);
  if (inGroup(r.alpha)) return "alpha";
  if (inGroup(r.beta)) return "beta";
  if (inGroup(r.gamma)) return "gamma";
  if (inGroup(r.delta)) return "delta";
  if (inGroup(r.epsilon)) return "epsilon";
  return undefined;
}

export class UserHistoryService {
  /**
   * Load every evening visible to the current user, augmented with team info
   * and resolved mode. Sorted newest first.
   */
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

  /**
   * Return the evenings the current user actually participated in, across
   * every team where they have a linked player. Sorted newest first.
   *
   * Participation rule: evening's team_id must be one of the user's
   * claimed teams AND the evening's player list must contain a player whose
   * id matches the claimed player_id OR whose name matches the claimed
   * player_name (case/slug-insensitive). Name matching is restricted to the
   * linked team — never cross-team — so it stays grounded in the explicit
   * link.
   */
  static async loadMyEvenings(
    allEvenings?: UnifiedEvening[]
  ): Promise<MyEvening[]> {
    const claims = await RemoteStorageService.getClaimedPlayersByTeam();
    if (claims.length === 0) return [];

    const all = allEvenings ?? (await this.loadAllVisibleEvenings());

    // Index claims by team for O(1) lookup
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

      const tier = detectTier(e, selfPlayer.id, slugify(selfPlayer.name));
      mine.push({
        ...e,
        participation: { selfPlayer, tier },
      });
    }
    return sortNewestFirst(mine);
  }

  /**
   * Cross-team aggregate stats for the current user, computed from
   * MyEvenings (so it inherits the strict link-based participation rule).
   */
  static async loadOverview(myEvenings?: MyEvening[]): Promise<OverviewStats> {
    const mine = myEvenings ?? (await this.loadMyEvenings());
    const claims = await RemoteStorageService.getClaimedPlayersByTeam();
    const memberships = await RemoteStorageService.getUserTeamMemberships();
    const teamNameById = new Map(memberships.map((m) => [m.team_id, m.team_name]));

    const stats: OverviewStats = {
      tournamentsPlayed: mine.length,
      alpha: 0,
      beta: 0,
      gamma: 0,
      delta: 0,
      epsilon: 0,
      perTeam: [],
    };

    const perTeamCount = new Map<string, number>();
    for (const e of mine) {
      const t = e.participation.tier;
      if (t) stats[t]++;
      if (e.teamId) perTeamCount.set(e.teamId, (perTeamCount.get(e.teamId) || 0) + 1);
    }

    for (const c of claims) {
      if (!c.team_id) continue;
      stats.perTeam.push({
        teamId: c.team_id,
        teamName: teamNameById.get(c.team_id) || "—",
        playerName: c.player_name,
        tournaments: perTeamCount.get(c.team_id) || 0,
      });
    }
    stats.perTeam.sort((a, b) => b.tournaments - a.tournaments);
    return stats;
  }

  /**
   * Team-scoped history. Strictly filters by team_id — no cross-team noise,
   * no duplicated players from name collisions across teams.
   *
   * Optional `onlyMine`: if true, restrict to evenings the current user
   * participated in within that team.
   */
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
