import { Player, Club } from '@/types/tournament';
import {
  FPPair,
  FPMatch,
  FPEvening,
  FPTeamBank,
  FPPairStats,
  FPPlayerStats,
  FPTeamSelectionMode,
  FPWorldCupComposition,
} from '@/types/fivePlayerTypes';
import { FIFA_CLUBS } from '@/data/clubs';

const WORLD_CUP_RATINGS = [5, 4.5, 4, 3.5, 3] as const;
type WorldCupRating = typeof WORLD_CUP_RATINGS[number];
type WorldCupRatingKey = keyof FPWorldCupComposition;

type CreateFPOptions = {
  teamSelectionMode?: FPTeamSelectionMode;
  worldCupComposition?: FPWorldCupComposition;
};

function ratingKey(rating: WorldCupRating): WorldCupRatingKey {
  return String(rating) as WorldCupRatingKey;
}

/**
 * Generate all 10 unique pairs from 5 players.
 */
export function generateAllPairs(players: Player[]): FPPair[] {
  const pairs: FPPair[] = [];
  for (let i = 0; i < 5; i++) {
    for (let j = i + 1; j < 5; j++) {
      pairs.push({
        id: `${players[i].id}-${players[j].id}`,
        players: [players[i], players[j]],
      });
    }
  }
  return pairs;
}

/**
 * For 4 active players, return the 3 possible pair-vs-pair groupings.
 * Each grouping is [[a,b],[c,d]] indices into the active array.
 */
function getThreePairings(active: Player[]): [Player, Player, Player, Player][] {
  const [a, b, c, d] = active;
  return [
    [a, b, c, d], // (0,1) vs (2,3)
    [a, c, b, d], // (0,2) vs (1,3)
    [a, d, b, c], // (0,3) vs (1,2)
  ];
}

/**
 * Generate the match schedule.
 * cycles=1 → 15 matches (1 cycle), cycles=2 → 30 matches (2 cycles).
 */
export function generateSchedule(players: Player[], pairs: FPPair[], cycles: number = 2): FPMatch[] {
  const pairLookup = new Map<string, FPPair>();
  for (const p of pairs) {
    const key1 = `${p.players[0].id}-${p.players[1].id}`;
    const key2 = `${p.players[1].id}-${p.players[0].id}`;
    pairLookup.set(key1, p);
    pairLookup.set(key2, p);
  }

  const findPair = (p1: Player, p2: Player): FPPair => {
    return pairLookup.get(`${p1.id}-${p2.id}`) || pairLookup.get(`${p2.id}-${p1.id}`)!;
  };

  // Pre-compute: for each sit-out slot, the 3 valid pairings of the 4 active players
  const slotPairings: [Player, Player, Player, Player][][] = [];
  for (let slot = 0; slot < 5; slot++) {
    const active = players.filter((_, i) => i !== slot);
    slotPairings.push(getThreePairings(active));
  }

  const allPairIds = new Set(pairs.map(p => p.id));

  function getPairIdsForBlock(pairingIndices: number[]): Set<string> {
    const ids = new Set<string>();
    for (let slot = 0; slot < 5; slot++) {
      const [pA1, pA2, pB1, pB2] = slotPairings[slot][pairingIndices[slot]];
      ids.add(findPair(pA1, pA2).id);
      ids.add(findPair(pB1, pB2).id);
    }
    return ids;
  }

  function setsEqual(a: Set<string>, b: Set<string>): boolean {
    if (a.size !== b.size) return false;
    for (const v of a) if (!b.has(v)) return false;
    return true;
  }

  let offsets: number[] = [0, 0, 0, 0, 0];
  let found = false;

  for (let o0 = 0; o0 < 3 && !found; o0++) {
    for (let o1 = 0; o1 < 3 && !found; o1++) {
      for (let o2 = 0; o2 < 3 && !found; o2++) {
        for (let o3 = 0; o3 < 3 && !found; o3++) {
          for (let o4 = 0; o4 < 3 && !found; o4++) {
            const offs = [o0, o1, o2, o3, o4];
            let valid = true;
            for (let block = 0; block < 3; block++) {
              const indices = offs.map(o => (o + block) % 3);
              const pairIds = getPairIdsForBlock(indices);
              if (!setsEqual(pairIds, allPairIds)) {
                valid = false;
                break;
              }
            }
            if (valid) {
              offsets = offs;
              found = true;
            }
          }
        }
      }
    }
  }

  // Build cycle 1 (15 matches: 3 blocks × 5 matches)
  const cycle1: FPMatch[] = [];
  let globalIdx = 0;

  for (let block = 0; block < 3; block++) {
    for (let slot = 0; slot < 5; slot++) {
      const pairingIdx = (offsets[slot] + block) % 3;
      const sittingOut = players[slot];
      const [pA1, pA2, pB1, pB2] = slotPairings[slot][pairingIdx];
      const pairA = findPair(pA1, pA2);
      const pairB = findPair(pB1, pB2);

      cycle1.push({
        id: `fp-match-${block}-${slot}`,
        roundIndex: block,
        matchIndex: slot,
        globalIndex: globalIdx++,
        pairA,
        pairB,
        sittingOut,
        completed: false,
      });
    }
  }

  if (cycles === 1) {
    return cycle1;
  }

  // Cycle 2 is an exact repeat of cycle 1
  const cycle2: FPMatch[] = cycle1.map(m => ({
    ...m,
    id: `fp-match-${m.roundIndex + 3}-${m.matchIndex}`,
    roundIndex: m.roundIndex + 3,
    globalIndex: globalIdx++,
  }));

  return [...cycle1, ...cycle2];
}

/**
 * Generate team banks for all 10 pairs.
 * teamsPerTier controls how many clubs per star tier each pair gets:
 *   - 15-match: 1 per tier (3 total)
 *   - 30-match: 2 per tier (6 total)
 * Constraints:
 *  - 5★ teams may appear at most `maxAppearances` times (default 2)
 *  - 4.5★ and 4★ teams may appear at most once
 *  - Interleaved allocation (fair)
 */
export function generateTeamBanks(
  pairs: FPPair[],
  players: Player[],
  clubsOverride?: Club[],
  maxAppearances: number = 2,
  teamsPerTier: number = 2
): FPTeamBank[] | string {
  const allClubs = clubsOverride || FIFA_CLUBS;
  
  // Include both clubs and national teams, exclude only Prime
  const clubs5 = shuffleArray(allClubs.filter(c => c.stars === 5 && !c.isPrime));
  const clubs45 = shuffleArray(allClubs.filter(c => c.stars === 4.5 && !c.isPrime));
  const clubs4 = shuffleArray(allClubs.filter(c => c.stars === 4 && !c.isPrime));

  // Per-tier max appearances: 5★ uses the parameter, 4.5★ and 4★ always 1
  const max5 = maxAppearances;
  const max45 = 1;
  const max4 = 1;

  // We need 10 pairs × teamsPerTier teams per tier
  const slotsPerTier = 10 * teamsPerTier;
  const minNeeded5 = Math.ceil(slotsPerTier / max5);
  const minNeeded45 = Math.ceil(slotsPerTier / max45);
  const minNeeded4 = Math.ceil(slotsPerTier / max4);
  if (clubs5.length < minNeeded5) return `לא מספיק קבוצות/נבחרות 5 כוכבים (צריך לפחות ${minNeeded5}, יש ${clubs5.length})`;
  if (clubs45.length < minNeeded45) return `לא מספיק קבוצות/נבחרות 4.5 כוכבים (צריך לפחות ${minNeeded45}, יש ${clubs45.length})`;
  if (clubs4.length < minNeeded4) return `לא מספיק קבוצות/נבחרות 4 כוכבים (צריך לפחות ${minNeeded4}, יש ${clubs4.length})`;

  const banks: FPTeamBank[] = pairs.map(p => ({
    pairId: p.id,
    clubs: [],
    usedClubIds: [],
  }));

  // Track global team usage count
  const globalClubCount = new Map<string, number>();
  // Track per-player club assignments
  const playerClubs = new Map<string, Set<string>>(); // playerId -> set of clubIds
  for (const p of players) {
    playerClubs.set(p.id, new Set());
  }

  const tiers: { pool: Club[]; countPerPair: number; maxForTier: number }[] = [
    { pool: clubs5, countPerPair: teamsPerTier, maxForTier: max5 },
    { pool: clubs45, countPerPair: teamsPerTier, maxForTier: max45 },
    { pool: clubs4, countPerPair: teamsPerTier, maxForTier: max4 },
  ];

  for (const tier of tiers) {
    for (let pass = 0; pass < tier.countPerPair; pass++) {
      const pairOrder = shuffleArray([...Array(10).keys()]);
      for (const pairIdx of pairOrder) {
        const pair = pairs[pairIdx];
        const bank = banks[pairIdx];
        const p1Id = pair.players[0].id;
        const p2Id = pair.players[1].id;
        const p1Clubs = playerClubs.get(p1Id)!;
        const p2Clubs = playerClubs.get(p2Id)!;

        // Filter valid candidates, then sort by usage count (prefer unused teams first)
        const candidates = tier.pool.filter(club => {
          const count = globalClubCount.get(club.id) || 0;
          if (count >= tier.maxForTier) return false;
          if (p1Clubs.has(club.id)) return false;
          if (p2Clubs.has(club.id)) return false;
          if (bank.clubs.some(c => c.id === club.id)) return false;
          return true;
        });
        candidates.sort((a, b) => (globalClubCount.get(a.id) || 0) - (globalClubCount.get(b.id) || 0));

        let assigned = false;
        if (candidates.length > 0) {
          const club = candidates[0];
          const count = globalClubCount.get(club.id) || 0;
          bank.clubs.push(club);
          globalClubCount.set(club.id, count + 1);
          p1Clubs.add(club.id);
          p2Clubs.add(club.id);
          assigned = true;
        }

        if (!assigned) {
          return 'לא מספיק קבוצות זמינות תחת האילוצים הנוכחיים. נסה שוב.';
        }
      }
    }
  }

  return banks;
}

class RatingClubBag {
  private bag: Club[] = [];

  constructor(private readonly pool: Club[], private readonly label: string) {
    if (pool.length === 0) {
      throw new Error(`אין קבוצות מונדיאל 26 בדירוג ${label} כוכבים`);
    }
  }

  draw(avoidClubId?: string): Club {
    if (this.bag.length === 0) {
      this.bag = shuffleArray(this.pool);
    }

    let index = 0;
    if (avoidClubId) {
      index = this.bag.findIndex(club => club.id !== avoidClubId);
      if (index < 0) {
        if (this.pool.length <= 1) {
          throw new Error(`אי אפשר להימנע מכפילות באותו משחק בדירוג ${this.label} כוכבים`);
        }
        this.bag = shuffleArray(this.pool);
        index = this.bag.findIndex(club => club.id !== avoidClubId);
      }
    }

    if (index < 0) {
      throw new Error(`אי אפשר לבחור קבוצה מתאימה בדירוג ${this.label} כוכבים`);
    }

    return this.bag.splice(index, 1)[0];
  }
}

function buildWorldCupRatingQueue(composition: FPWorldCupComposition): WorldCupRating[] {
  const queue: WorldCupRating[] = [];
  for (const rating of WORLD_CUP_RATINGS) {
    const count = composition[ratingKey(rating)];
    for (let i = 0; i < count; i += 1) {
      queue.push(rating);
    }
  }
  return shuffleArray(queue);
}

function buildWorldCupRatingQueuesForSchedule(
  pairs: FPPair[],
  schedule: FPMatch[],
  composition: FPWorldCupComposition,
  poolSizes: Map<WorldCupRating, number>
): Map<string, WorldCupRating[]> | string {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const queues = new Map<string, WorldCupRating[]>();
    for (const pair of pairs) {
      queues.set(pair.id, buildWorldCupRatingQueue(composition));
    }

    const cursors = new Map<string, number>(pairs.map(pair => [pair.id, 0]));
    let valid = true;

    for (const match of schedule) {
      const queueA = queues.get(match.pairA.id);
      const queueB = queues.get(match.pairB.id);
      const cursorA = cursors.get(match.pairA.id) ?? 0;
      const cursorB = cursors.get(match.pairB.id) ?? 0;
      const ratingA = queueA?.[cursorA];
      const ratingB = queueB?.[cursorB];

      if (!queueA || !queueB || ratingA === undefined || ratingB === undefined) {
        return 'סידור המשחקים אינו תואם למספר הקבוצות שהוגדר לכל זוג.';
      }

      if (ratingA === ratingB && (poolSizes.get(ratingA) ?? 0) < 2) {
        valid = false;
        break;
      }

      cursors.set(match.pairA.id, cursorA + 1);
      cursors.set(match.pairB.id, cursorB + 1);
    }

    if (valid) return queues;
  }

  return 'לא ניתן לשבץ את הרכב מונדיאל 26 שנבחר בלי כפילות קבוצה באותו משחק.';
}

function validateWorldCupBanks(
  banks: FPTeamBank[],
  composition: FPWorldCupComposition
): string | null {
  for (const bank of banks) {
    const counts: FPWorldCupComposition = { '5': 0, '4.5': 0, '4': 0, '3.5': 0, '3': 0 };
    for (const club of bank.clubs) {
      const key = ratingKey(club.stars as WorldCupRating);
      if (key in counts) counts[key] += 1;
    }

    for (const rating of WORLD_CUP_RATINGS) {
      const key = ratingKey(rating);
      if (counts[key] !== composition[key]) {
        return 'הרכב הקבוצות שנוצר אינו תואם להגדרות המונדיאל לכל זוג.';
      }
    }
  }
  return null;
}

function generateWorldCup26Teams(
  pairs: FPPair[],
  schedule: FPMatch[],
  clubs: Club[],
  composition: FPWorldCupComposition,
  matchCount: 15 | 30
): { schedule: FPMatch[]; banks: FPTeamBank[] } | string {
  const requiredPerPair = matchCount / 5;
  const compositionSum = WORLD_CUP_RATINGS.reduce(
    (sum, rating) => sum + composition[ratingKey(rating)],
    0
  );

  if (matchCount % 5 !== 0) {
    return 'במצב מונדיאל 26 מספר המשחקים חייב להתחלק ב־5.';
  }

  if (compositionSum !== requiredPerPair) {
    return `הרכב הקבוצות חייב להסתכם ל־${requiredPerPair} קבוצות לכל זוג לפי מספר המשחקים שנבחר.`;
  }

  const worldCupClubs = clubs.filter(club => club.worldCup26 === true && !club.isPrime);
  const bags = new Map<WorldCupRating, RatingClubBag>();
  const poolSizes = new Map<WorldCupRating, number>();
  for (const rating of WORLD_CUP_RATINGS) {
    const pool = worldCupClubs.filter(club => club.stars === rating);
    poolSizes.set(rating, pool.length);
    if (composition[ratingKey(rating)] > 0 && pool.length === 0) {
      return `אין קבוצות מונדיאל 26 בדירוג ${rating} כוכבים.`;
    }
    if (pool.length > 0) {
      bags.set(rating, new RatingClubBag(pool, String(rating)));
    }
  }

  const banks: FPTeamBank[] = pairs.map(pair => ({
    pairId: pair.id,
    clubs: [],
    usedClubIds: [],
  }));
  const bankByPairId = new Map(banks.map(bank => [bank.pairId, bank]));
  const ratingQueues = buildWorldCupRatingQueuesForSchedule(
    pairs,
    schedule,
    composition,
    poolSizes
  );
  if (typeof ratingQueues === 'string') return ratingQueues;

  const updatedSchedule: FPMatch[] = [];

  try {
    for (const match of schedule) {
      const queueA = ratingQueues.get(match.pairA.id);
      const queueB = ratingQueues.get(match.pairB.id);
      const ratingA = queueA?.shift();
      const ratingB = queueB?.shift();

      if (!queueA || !queueB || ratingA === undefined || ratingB === undefined) {
        return 'סידור המשחקים אינו תואם למספר הקבוצות שהוגדר לכל זוג.';
      }

      const bagA = bags.get(ratingA);
      const bagB = bags.get(ratingB);
      if (!bagA || !bagB) {
        return 'לא נמצאו מספיק קבוצות מונדיאל 26 להרכב שנבחר.';
      }

      const clubA = bagA.draw();
      const clubB = ratingA === ratingB
        ? bagA.draw(clubA.id)
        : bagB.draw(clubA.id);

      if (clubA.id === clubB.id) {
        return 'אי אפשר לשבץ את אותה קבוצה לשני הזוגות באותו משחק.';
      }

      bankByPairId.get(match.pairA.id)?.clubs.push(clubA);
      bankByPairId.get(match.pairB.id)?.clubs.push(clubB);
      updatedSchedule.push({ ...match, clubA, clubB });
    }
  } catch (error: any) {
    return error?.message || 'שגיאה ביצירת מאגר קבוצות מונדיאל 26.';
  }

  if ([...ratingQueues.values()].some(queue => queue.length > 0)) {
    return 'לא כל הקבוצות שהוגדרו שובצו לזוגות.';
  }

  const validationError = validateWorldCupBanks(banks, composition);
  if (validationError) return validationError;

  return { schedule: updatedSchedule, banks };
}

/**
 * Calculate pair standings from completed matches.
 */
export function calculatePairStats(evening: FPEvening): FPPairStats[] {
  const statsMap = new Map<string, FPPairStats>();
  
  for (const pair of evening.pairs) {
    statsMap.set(pair.id, {
      pair,
      played: 0, wins: 0, draws: 0, losses: 0,
      goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0,
    });
  }

  for (const match of evening.schedule) {
    if (!match.completed || match.scoreA === undefined || match.scoreB === undefined) continue;

    const cappedDiff = Math.min(3, Math.max(-3, match.scoreA - match.scoreB));
    
    const sA = statsMap.get(match.pairA.id)!;
    const sB = statsMap.get(match.pairB.id)!;

    sA.played++;
    sB.played++;
    sA.goalsFor += match.scoreA;
    sA.goalsAgainst += match.scoreB;
    sB.goalsFor += match.scoreB;
    sB.goalsAgainst += match.scoreA;
    sA.goalDiff += cappedDiff;
    sB.goalDiff -= cappedDiff;

    if (match.scoreA > match.scoreB) {
      sA.wins++; sA.points += 3;
      sB.losses++;
    } else if (match.scoreA < match.scoreB) {
      sB.wins++; sB.points += 3;
      sA.losses++;
    } else {
      sA.draws++; sA.points += 1;
      sB.draws++; sB.points += 1;
    }
  }

  return Array.from(statsMap.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
    return b.goalsFor - a.goalsFor;
  });
}

/**
 * Calculate individual player standings.
 */
export function calculatePlayerStats(evening: FPEvening): FPPlayerStats[] {
  const statsMap = new Map<string, FPPlayerStats>();

  for (const player of evening.players) {
    statsMap.set(player.id, {
      player,
      played: 0, wins: 0, draws: 0, losses: 0,
      goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0,
    });
  }

  for (const match of evening.schedule) {
    if (!match.completed || match.scoreA === undefined || match.scoreB === undefined) continue;

    const cappedDiff = Math.min(3, Math.max(-3, match.scoreA - match.scoreB));

    // Update both players in pairA
    for (const p of match.pairA.players) {
      const s = statsMap.get(p.id)!;
      s.played++;
      s.goalsFor += match.scoreA;
      s.goalsAgainst += match.scoreB;
      s.goalDiff += cappedDiff;
      if (match.scoreA > match.scoreB) { s.wins++; s.points += 3; }
      else if (match.scoreA < match.scoreB) { s.losses++; }
      else { s.draws++; s.points += 1; }
    }

    // Update both players in pairB
    for (const p of match.pairB.players) {
      const s = statsMap.get(p.id)!;
      s.played++;
      s.goalsFor += match.scoreB;
      s.goalsAgainst += match.scoreA;
      s.goalDiff -= cappedDiff;
      if (match.scoreB > match.scoreA) { s.wins++; s.points += 3; }
      else if (match.scoreB < match.scoreA) { s.losses++; }
      else { s.draws++; s.points += 1; }
    }
  }

  return Array.from(statsMap.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
    return b.goalsFor - a.goalsFor;
  });
}

/**
 * Create a new 5-player doubles evening.
 * matchCount: 15 (short) or 30 (full, default).
 */
export function createFPEvening(
  players: Player[],
  clubsOverride?: Club[],
  maxAppearances: number = 2,
  matchCount: 15 | 30 = 30,
  options: CreateFPOptions = {}
): FPEvening | string {
  if (players.length !== 5) return 'נדרשים בדיוק 5 שחקנים';

  const cycles = matchCount === 15 ? 1 : 2;
  const teamsPerTier = matchCount === 15 ? 1 : 2;
  const teamSelectionMode = options.teamSelectionMode ?? 'default';

  // Keep players[0] fixed as the first sitting-out player.
  // Shuffle only the remaining players so setup input order still does not create full schedule bias.
  const shuffledPlayers = [players[0], ...shuffleArray(players.slice(1))];
  
  const pairs = generateAllPairs(shuffledPlayers);
  let schedule = generateSchedule(shuffledPlayers, pairs, cycles);
  let banksResult: FPTeamBank[] | string;

  if (teamSelectionMode === 'world-cup-26') {
    if (!options.worldCupComposition) {
      return 'יש להגדיר הרכב קבוצות למצב מונדיאל 26.';
    }
    const worldCupResult = generateWorldCup26Teams(
      pairs,
      schedule,
      clubsOverride || FIFA_CLUBS,
      options.worldCupComposition,
      matchCount
    );
    if (typeof worldCupResult === 'string') return worldCupResult;
    schedule = worldCupResult.schedule;
    banksResult = worldCupResult.banks;
  } else {
    banksResult = generateTeamBanks(pairs, shuffledPlayers, clubsOverride, maxAppearances, teamsPerTier);
  }

  if (typeof banksResult === 'string') return banksResult;

  const now = new Date().toISOString();
  return {
    id: `fp-evening-${Date.now()}`,
    date: now,
    mode: 'five-player-doubles',
    players: shuffledPlayers,
    pairs,
    schedule,
    teamBanks: banksResult,
    currentMatchIndex: 0,
    completed: false,
    matchCount,
    teamSelectionMode,
    ...(teamSelectionMode === 'world-cup-26' ? { worldCupComposition: options.worldCupComposition } : {}),
    startedAt: now,
  };
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
