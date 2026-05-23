import { Player, Club } from './tournament';

/** A pair of 2 players in the 5-player doubles mode */
export interface FPPair {
  id: string;
  players: [Player, Player];
}

/** A single match in the 5-player doubles mode */
export interface FPMatch {
  id: string;
  roundIndex: number;
  matchIndex: number; // 0-4 within the round
  globalIndex: number; // 0-29 overall
  pairA: FPPair;
  pairB: FPPair;
  sittingOut: Player;
  clubA?: Club;
  clubB?: Club;
  scoreA?: number;
  scoreB?: number;
  completed: boolean;
}

/** Stats for a pair across the tournament */
export interface FPPairStats {
  pair: FPPair;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number; // capped at ±3 per match
  points: number;
}

/** Stats for an individual player */
export interface FPPlayerStats {
  player: Player;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
}

/** Block timing: when each block of 5 matches was completed */
export interface FPBlockTiming {
  blockIndex: number;       // 0-based (0–2 for 15-match, 0–5 for 30-match)
  completedAt: string;      // ISO timestamp
}

/** The team bank for one pair (6 clubs: 2×5★, 2×4.5★, 2×4★) */
export interface FPTeamBank {
  pairId: string;
  clubs: Club[];       // all 6 assigned clubs
  usedClubIds: string[]; // IDs of clubs already used in matches
}

/** Full state of a 5-player doubles evening */
export interface FPEvening {
  id: string;
  date: string;
  mode: 'five-player-doubles';
  players: Player[];   // exactly 5
  pairs: FPPair[];     // all 10 pairs
  schedule: FPMatch[]; // 15 or 30 matches
  teamBanks: FPTeamBank[]; // 10 banks, one per pair
  currentMatchIndex: number; // index into schedule
  completed: boolean;
  matchCount?: 15 | 30; // tournament length, defaults to 30 for legacy
  startedAt?: string;      // ISO timestamp when tournament actually started
  completedAt?: string;    // ISO timestamp when tournament finished
  durationMinutes?: number; // calculated from completedAt - startedAt
  blockTimings?: FPBlockTiming[]; // per-block completion timestamps
  setupOptions?: {
    firstSittingOutPlayerId?: string;
  };
  }
