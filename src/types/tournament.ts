export interface Player {
  id: string;
  name: string;
  avatarUrl?: string | null;
  avatar_url?: string | null;
  imageUrl?: string | null;
}

export interface Club {
  id: string;
  name: string;
  stars: number;
  isNational?: boolean;
  isPrime?: boolean;
  countryCode?: string;
  country_code?: string;
  league: string;
  defaultAdded?: boolean;
  worldCup26?: boolean;
}

export interface Pair {
  id: string;
  players: [Player, Player];
}

export interface Match {
  id: string;
  pairs: [Pair, Pair];
  clubs: [Club, Club];
  score?: [number, number];
  winner?: string; // pair id
  completed: boolean;
}

export interface Round {
  id: string;
  number: number;
  matches: Match[];
  completed: boolean;
  currentMatchIndex: number;
  pairScores: { [pairId: string]: number }; // Track wins for each pair in this round
  isDeciderMatch?: boolean; // Flag for tiebreaker match
  teamPools?: [Club[], Club[]];
  recycledClubIds?: string[]; // IDs of clubs that were recycled (reused because star rating ran out)
}

export interface TierQuestionRoundState {
  currentTierIndex: number;
  tiersCompleted: number[];
  pairTeamChoices: { [pairId: string]: string[] }; // Club IDs chosen by each pair
  usedQuestionIds: number[];
  assignedPools?: [Club[], Club[]]; // Final assigned pools after all tiers complete
}

export interface Evening {
  id: string;
  date: string;
  players: Player[];
  rounds: Round[];
  winsToComplete: number; // First to X wins per round
  completed: boolean;
  rankings?: {
    alpha: Player[];
    beta: Player[];
    gamma: Player[];
    delta?: Player[];
  };
  pairSchedule?: Pair[][];
  // Singles tournament fields
  type?: 'pairs' | 'singles';
  clubsPerPlayer?: number;
  playerClubs?: { [playerId: string]: Club[] }; // Clubs assigned to each player
  gameSequence?: SinglesGame[]; // Pre-generated sequence of games
  currentGameIndex?: number;
  // Tier Question Mode fields (for pairs tournaments)
  teamSelectionMode?: 'random' | 'tier-question' | 'world-cup-26';
  tierQuestionState?: TierQuestionRoundState;
}

export interface SinglesGame {
  id: string;
  players: [Player, Player]; // Two players competing
  clubs: [Club, Club]; // Clubs they're using
  score?: [number, number];
  winner?: string; // player id
  completed: boolean;
}

export interface PlayerStats {
  player: Player;
  wins: number;
  goalsFor: number;
  goalsAgainst: number;
  longestWinStreak: number;
  points: number;
}
