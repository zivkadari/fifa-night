import { Club, Pair } from '@/types/tournament';
import { getClubsByStars, getNationalTeams, getRandomClub, FIFA_CLUBS, getPrimeTeams, getClubsOnly, getNationalTeamsByStars, getWorldCup26TeamsByStars } from '@/data/clubs';
import { PoolConfig, PoolDistributionEntry } from '@/data/poolConfig';

/**
 * Result from team pool generation including recycled club info
 */
export interface TeamPoolResult {
  pools: Club[][];
  recycledClubIds: Set<string>;
}

/**
 * TeamSelector manages club assignments for tournament matches.
 * Pass a clubs array (e.g., from getClubsWithOverrides()) to use database star overrides.
 */

/**
 * Smart club picker that ensures each club appears only once per evening.
 * Falls back to allowing reuse ONLY when all clubs of the required star rating are exhausted.
 * 
 * @param sourceClubs - Array of clubs to pick from (already filtered by star/type)
 * @param banned - Set of club IDs that have been used this evening
 * @param usedClubsMap - Map of club ID to Club for potential reuse fallback
 * @param preferredStars - The star rating we prefer (for fallback matching)
 * @returns Object with the club and whether it was recycled
 */
function pickClubWithFallback(
  sourceClubs: Club[],
  banned: Set<string>,
  usedClubsMap: Map<string, Club>,
  preferredStars?: number,
  currentPool?: Club[]
): { club: Club | null; isRecycled: boolean } {
  // Helper to check if club is already in the current pool
  const isInCurrentPool = (club: Club) => currentPool?.some(c => c.id === club.id) ?? false;
  
  // First: try to find an unused club not in current pool
  const available = sourceClubs.filter(c => !banned.has(c.id) && !isInCurrentPool(c));
  if (available.length > 0) {
    const idx = Math.floor(Math.random() * available.length);
    return { club: available[idx], isRecycled: false };
  }
  
  // Second fallback: allow reuse of clubs with the SAME star rating that were already used
  // IMPORTANT: When looking for regular 5-star clubs, exclude Prime teams (they have their own category)
  if (preferredStars !== undefined) {
    const usedWithSameStars = Array.from(usedClubsMap.values())
      .filter(c => c.stars === preferredStars && !banned.has(c.id) && !isInCurrentPool(c) && !c.isPrime);
    if (usedWithSameStars.length > 0) {
      const idx = Math.floor(Math.random() * usedWithSameStars.length);
      return { club: usedWithSameStars[idx], isRecycled: true };
    }
  }
  
  // Third fallback (CRITICAL FIX): recycle from sourceClubs even if banned, but not in current pool
  // This handles the case where all clubs of this category are exhausted across the entire evening
  const recycleFromSource = sourceClubs.filter(c => !isInCurrentPool(c));
  if (recycleFromSource.length > 0) {
    const idx = Math.floor(Math.random() * recycleFromSource.length);
    return { club: recycleFromSource[idx], isRecycled: true };
  }
  
  return { club: null, isRecycled: false };
}

export class TeamSelector {
  private clubs: Club[];

  constructor(clubs: Club[] = FIFA_CLUBS) {
    this.clubs = clubs;
  }

  /**
   * Generate 7 clubs per pair for 4-win evening:
   * - 2 clubs/national teams with 5 stars
   * - 3 clubs/national teams with 4.5 stars
   * - 2 clubs/national teams with 4 stars
   * Total: 7 teams per pair, no repeats between pairs
   * 
   * Each club appears ONLY ONCE per evening, unless all clubs of that star rating are exhausted.
   */
  generateTeamPoolsFor4Rounds(pairs: Pair[], excludeClubIds: string[] = []): TeamPoolResult {
    const pools: Club[][] = pairs.map(() => []);
    const banned = new Set<string>(excludeClubIds);
    const usedClubsMap = new Map<string, Club>();
    const recycledClubIds = new Set<string>();
    const allocatedThisRound = new Set<string>();
    
    excludeClubIds.forEach(id => {
      const club = this.clubs.find(c => c.id === id);
      if (club) usedClubsMap.set(id, club);
    });

    const pickAndBan = (pool: Club[], sourceClubs: Club[], stars?: number): Club | null => {
      const roundSafeSource = sourceClubs.filter(c => !allocatedThisRound.has(c.id));
      const result = pickClubWithFallback(roundSafeSource, banned, usedClubsMap, stars, pool);
      if (result.club) {
        banned.add(result.club.id);
        allocatedThisRound.add(result.club.id);
        usedClubsMap.set(result.club.id, result.club);
        if (result.isRecycled) recycledClubIds.add(result.club.id);
      }
      return result.club;
    };

    // Interleaved: 2x 5-star
    const fiveStarPool = [...getClubsOnly(5, this.clubs), ...getNationalTeamsByStars(5, this.clubs)];
    for (let i = 0; i < 2; i++) {
      for (let p = 0; p < pairs.length; p++) {
        const team = pickAndBan(pools[p], fiveStarPool, 5);
        if (team) pools[p].push(team);
      }
    }

    // Interleaved: 3x 4.5-star
    const available45 = [...getClubsOnly(4.5, this.clubs), ...getNationalTeamsByStars(4.5, this.clubs)];
    for (let i = 0; i < 3; i++) {
      for (let p = 0; p < pairs.length; p++) {
        const team = pickAndBan(pools[p], available45, 4.5);
        if (team) pools[p].push(team);
      }
    }

    // Interleaved: 2x 4-star
    const fourStarPool = [...getClubsOnly(4, this.clubs), ...getNationalTeamsByStars(4, this.clubs)];
    for (let i = 0; i < 2; i++) {
      for (let p = 0; p < pairs.length; p++) {
        const team = pickAndBan(pools[p], fourStarPool, 4);
        if (team) pools[p].push(team);
      }
    }

    return { pools, recycledClubIds };
  }

  /**
   * Generate 9 clubs per pair for 5-win evening:
   * - 1 Prime team (5 stars)
   * - 3 clubs/national teams with 5 stars
   * - 3 clubs/national teams with 4.5 stars
   * - 2 clubs with 4 stars
   * Total: 9 teams per pair, no repeats within the same round
   * 
   * Each club appears ONLY ONCE per evening, unless all clubs of that star rating are exhausted.
   * In round 3, recycling is allowed if needed (but never duplicate within same round).
   */
  generateTeamPoolsFor5Rounds(pairs: Pair[], excludeClubIds: string[] = []): TeamPoolResult {
    const pools: Club[][] = pairs.map(() => []);
    const banned = new Set<string>(excludeClubIds);
    const usedClubsMap = new Map<string, Club>();
    const recycledClubIds = new Set<string>();
    const allocatedThisRound = new Set<string>();
    
    excludeClubIds.forEach(id => {
      const club = this.clubs.find(c => c.id === id);
      if (club) usedClubsMap.set(id, club);
    });

    const pickAndBan = (pool: Club[], sourceClubs: Club[], stars?: number): Club | null => {
      const roundSafeSource = sourceClubs.filter(c => !allocatedThisRound.has(c.id));
      const result = pickClubWithFallback(roundSafeSource, banned, usedClubsMap, stars, pool);
      if (result.club) {
        banned.add(result.club.id);
        allocatedThisRound.add(result.club.id);
        usedClubsMap.set(result.club.id, result.club);
        if (result.isRecycled) recycledClubIds.add(result.club.id);
      }
      return result.club;
    };

    // Interleaved: 1x Prime
    for (let p = 0; p < pairs.length; p++) {
      const prime = pickAndBan(pools[p], getPrimeTeams(this.clubs), 5);
      if (prime) pools[p].push(prime);
    }

    // Interleaved: 3x 5-star
    const fiveStarPool = [...getClubsOnly(5, this.clubs), ...getNationalTeamsByStars(5, this.clubs)];
    for (let i = 0; i < 3; i++) {
      for (let p = 0; p < pairs.length; p++) {
        const team = pickAndBan(pools[p], fiveStarPool, 5);
        if (team) pools[p].push(team);
      }
    }

    // Interleaved: 3x 4.5-star
    const available45 = [...getClubsOnly(4.5, this.clubs), ...getNationalTeamsByStars(4.5, this.clubs)];
    for (let i = 0; i < 3; i++) {
      for (let p = 0; p < pairs.length; p++) {
        const team = pickAndBan(pools[p], available45, 4.5);
        if (team) pools[p].push(team);
      }
    }

    // Interleaved: 2x 4-star
    for (let i = 0; i < 2; i++) {
      for (let p = 0; p < pairs.length; p++) {
        const team = pickAndBan(pools[p], getClubsOnly(4, this.clubs), 4);
        if (team) pools[p].push(team);
      }
    }

    return { pools, recycledClubIds };
  }

  /**
   * Generate 11 clubs per pair for 6-win evening:
   * - 1 Prime team (5 stars)
   * - 3 clubs/national teams with 5 stars
   * - 4 clubs/national teams with 4.5 stars
   * - 3 clubs with 4 stars
   * Total: 11 teams per pair, no repeats within the same round
   * 
   * Each club appears ONLY ONCE per evening, unless all clubs of that star rating are exhausted.
   */
  generateTeamPoolsFor6Rounds(pairs: Pair[], excludeClubIds: string[] = []): TeamPoolResult {
    const pools: Club[][] = pairs.map(() => []);
    const banned = new Set<string>(excludeClubIds);
    const usedClubsMap = new Map<string, Club>();
    const recycledClubIds = new Set<string>();
    const allocatedThisRound = new Set<string>();
    
    excludeClubIds.forEach(id => {
      const club = this.clubs.find(c => c.id === id);
      if (club) usedClubsMap.set(id, club);
    });

    const pickAndBan = (pool: Club[], sourceClubs: Club[], stars?: number): Club | null => {
      const roundSafeSource = sourceClubs.filter(c => !allocatedThisRound.has(c.id));
      const result = pickClubWithFallback(roundSafeSource, banned, usedClubsMap, stars, pool);
      if (result.club) {
        banned.add(result.club.id);
        allocatedThisRound.add(result.club.id);
        usedClubsMap.set(result.club.id, result.club);
        if (result.isRecycled) recycledClubIds.add(result.club.id);
      }
      return result.club;
    };

    // Interleaved: 3x 5-star
    const fiveStarPool = [...getClubsOnly(5, this.clubs), ...getNationalTeamsByStars(5, this.clubs)];
    for (let i = 0; i < 3; i++) {
      for (let p = 0; p < pairs.length; p++) {
        const team = pickAndBan(pools[p], fiveStarPool, 5);
        if (team) pools[p].push(team);
      }
    }

    // Interleaved: 4x 4.5-star
    const available45 = [...getClubsOnly(4.5, this.clubs), ...getNationalTeamsByStars(4.5, this.clubs)];
    for (let i = 0; i < 4; i++) {
      for (let p = 0; p < pairs.length; p++) {
        const team = pickAndBan(pools[p], available45, 4.5);
        if (team) pools[p].push(team);
      }
    }

    // Interleaved: 4x 4-star
    for (let i = 0; i < 4; i++) {
      for (let p = 0; p < pairs.length; p++) {
        const team = pickAndBan(pools[p], getClubsOnly(4, this.clubs), 4);
        if (team) pools[p].push(team);
      }
    }

    return { pools, recycledClubIds };
  }

  /**
   * Generate team pools for pairs tournament.
   * Each club appears ONLY ONCE per evening, unless all clubs of that star rating are exhausted.
   */
  generateTeamPools(pairs: Pair[], excludeClubIds: string[] = [], clubsPerPair: number = 5): TeamPoolResult {
    const pools: Club[][] = [];
    const banned = new Set<string>(excludeClubIds);
    const usedClubsMap = new Map<string, Club>();
    const recycledClubIds = new Set<string>();
    
    // Track used clubs from excludeClubIds for fallback
    excludeClubIds.forEach(id => {
      const club = this.clubs.find(c => c.id === id);
      if (club) usedClubsMap.set(id, club);
    });

    console.log('Generating team pools (max usage=1), excluding clubs:', excludeClubIds);

    const poolsSums = [0, 0];

    // Helper to pick and ban
    const pickFromPool = (sourceClubs: Club[], stars: number): Club | null => {
      const result = pickClubWithFallback(sourceClubs, banned, usedClubsMap, stars);
      if (result.club) {
        banned.add(result.club.id);
        usedClubsMap.set(result.club.id, result.club);
        if (result.isRecycled) {
          recycledClubIds.add(result.club.id);
        }
      }
      return result.club;
    };

    // Get initial 5-star clubs pool
    const fiveStarClubs = getClubsByStars(5, this.clubs);

    pairs.forEach((pair, pairIndex) => {
      const pool: Club[] = [];

      // Try to get 2 five-star clubs for each pair
      for (let i = 0; i < 2; i++) {
        const club = pickFromPool(fiveStarClubs, 5);
        if (club) {
          pool.push(club);
          poolsSums[pairIndex] += club.stars;
        } else {
          // No more 5-star available, try 4.5
          const backup = pickFromPool(getClubsByStars(4.5, this.clubs), 4.5);
          if (backup) {
            pool.push(backup);
            poolsSums[pairIndex] += backup.stars;
          }
        }
      }

      pools.push(pool);
    });

    // Fill remaining slots
    while (pools[0].length < clubsPerPair || pools[1].length < clubsPerPair) {
      if (pools[0].length >= clubsPerPair && pools[1].length >= clubsPerPair) break;
      
      // Try to find unused clubs with 4+ stars
      let available = this.clubs.filter(c => !banned.has(c.id) && c.stars >= 4);
      let isRecycledBatch = false;
      
      // If no unused 4+ star clubs, allow reuse of 4+ star clubs
      // CRITICAL: Also check !banned.has(c.id) to prevent duplicates within the same round
      if (available.length === 0) {
        const usedFourPlus = Array.from(usedClubsMap.values())
          .filter(c => c.stars >= 4 && !banned.has(c.id));
        if (usedFourPlus.length > 0) {
          available = usedFourPlus;
          isRecycledBatch = true;
        } else {
          // Last resort: any unused club
          available = this.clubs.filter(c => !banned.has(c.id));
        }
      }
      
      if (available.length === 0) break;

      const idx1 = Math.floor(Math.random() * available.length);
      const first = available[idx1];
      banned.add(first.id);
      usedClubsMap.set(first.id, first);
      if (isRecycledBatch) {
        recycledClubIds.add(first.id);
      }

      if (pools[0].length >= clubsPerPair) {
        pools[1].push(first);
        poolsSums[1] += first.stars;
        continue;
      }
      if (pools[1].length >= clubsPerPair) {
        pools[0].push(first);
        poolsSums[0] += first.stars;
        continue;
      }

      // Get second club for balanced assignment
      const remainingAvailable = available.filter(c => c.id !== first.id && !banned.has(c.id));
      let second: Club | null = null;
      if (remainingAvailable.length > 0) {
        const idx2 = Math.floor(Math.random() * remainingAvailable.length);
        second = remainingAvailable[idx2];
        banned.add(second.id);
        usedClubsMap.set(second.id, second);
        if (isRecycledBatch) {
          recycledClubIds.add(second.id);
        }
      }

      const lowerIdx = poolsSums[0] <= poolsSums[1] ? 0 : 1;
      const higherIdx = lowerIdx === 0 ? 1 : 0;

      if (second) {
        const higherClub = first.stars >= second.stars ? first : second;
        const lowerClub = first.stars >= second.stars ? second : first;

        pools[lowerIdx].push(higherClub);
        poolsSums[lowerIdx] += higherClub.stars;

        pools[higherIdx].push(lowerClub);
        poolsSums[higherIdx] += lowerClub.stars;
      } else {
        pools[lowerIdx].push(first);
        poolsSums[lowerIdx] += first.stars;
      }
    }

    return { pools, recycledClubIds };
  }
  
  generateClubsForMatch(pair1: Pair, pair2: Pair, excludeClubIds: string[] = [], clubsPerPair: number = 5): [Club[], Club[]] {
    const result = this.generateTeamPools([pair1, pair2], excludeClubIds, clubsPerPair);
    return [result.pools[0], result.pools[1]];
  }

  /**
   * Generate balanced decider teams.
   * Each club appears ONLY ONCE per evening, unless all clubs of minStars are exhausted.
   */
  generateBalancedDeciderTeams(
    excludeClubIds: string[] = [],
    minStars = 4,
    maxStarDiff = 1
  ): [Club, Club] {
    const banned = new Set<string>(excludeClubIds);
    const usedClubsMap = new Map<string, Club>();
    
    // Track used clubs for fallback
    excludeClubIds.forEach(id => {
      const club = this.clubs.find(c => c.id === id);
      if (club) usedClubsMap.set(id, club);
    });
    
    // First try: unused clubs with minStars or higher
    let available = this.clubs.filter(c => !banned.has(c.id) && c.stars >= minStars);

    // Fallback: if less than 2 unused clubs, allow reuse of clubs with same star rating
    if (available.length < 2) {
      const usedWithMinStars = Array.from(usedClubsMap.values()).filter(c => c.stars >= minStars);
      if (usedWithMinStars.length >= 2) {
        available = usedWithMinStars;
      } else if (available.length === 1 && usedWithMinStars.length >= 1) {
        // We have 1 unused + at least 1 reusable
        available = [...available, ...usedWithMinStars.filter(c => c.id !== available[0].id)];
      } else {
        // Ultimate fallback: just get any clubs with minStars
        available = this.clubs.filter(c => c.stars >= minStars);
      }
    }

    if (available.length < 2) {
      const backup = this.clubs.filter(c => c.stars >= minStars);
      const first = backup[0];
      const second = backup.find(c => c.id !== first.id) || backup[0];
      return [first, second];
    }

    const first = available[Math.floor(Math.random() * available.length)];
    const candidatesStrict = available.filter(c => c.id !== first.id && Math.abs(c.stars - first.stars) <= maxStarDiff);

    let second: Club | undefined = candidatesStrict.length > 0 
      ? candidatesStrict[Math.floor(Math.random() * candidatesStrict.length)]
      : undefined;

    if (!second) {
      const sortedByDiff = available
        .filter(c => c.id !== first.id)
        .sort((a, b) => Math.abs(a.stars - first.stars) - Math.abs(b.stars - first.stars));
      second = sortedByDiff[0];
    }

    return [first, second!];
  }

  /**
   * Generate team pools dynamically from a PoolConfig fetched from the database.
   * Replaces the hardcoded generateTeamPoolsFor4/5/6Rounds methods.
   */
  generateTeamPoolsFromConfig(pairs: Pair[], config: PoolConfig, excludeClubIds: string[] = []): TeamPoolResult {
    // Initialize one pool per pair
    const pools: Club[][] = pairs.map(() => []);
    const banned = new Set<string>(excludeClubIds);
    const usedClubsMap = new Map<string, Club>();
    const recycledClubIds = new Set<string>();
    // Round-level allocated set: no club may appear in more than one pair's pool
    const allocatedThisRound = new Set<string>();

    excludeClubIds.forEach(id => {
      const club = this.clubs.find(c => c.id === id);
      if (club) usedClubsMap.set(id, club);
    });

    /**
     * Pick a club for a specific pair's pool, ensuring round-level uniqueness.
     * The club must not already be allocated to ANY pair in this round.
     */
    const pickAndBan = (pool: Club[], sourceClubs: Club[], stars?: number): Club | null => {
      // Filter source to exclude clubs already allocated in this round (cross-pair uniqueness)
      const roundSafeSource = sourceClubs.filter(c => !allocatedThisRound.has(c.id));
      const result = pickClubWithFallback(roundSafeSource, banned, usedClubsMap, stars, pool);
      if (result.club) {
        banned.add(result.club.id);
        allocatedThisRound.add(result.club.id);
        usedClubsMap.set(result.club.id, result.club);
        if (result.isRecycled) {
          recycledClubIds.add(result.club.id);
        }
      }
      return result.club;
    };

    // === INTERLEAVED ALLOCATION: round-robin per tier across pairs ===

    // 1. Prime teams (interleaved)
    if (config.include_prime && config.prime_count > 0) {
      for (let i = 0; i < config.prime_count; i++) {
        for (let p = 0; p < pairs.length; p++) {
          const prime = pickAndBan(pools[p], getPrimeTeams(this.clubs), 5);
          if (prime) pools[p].push(prime);
        }
      }
    }

    // 2. Distribution entries (interleaved per tier)
    for (const entry of config.distribution) {
      const source = entry.include_national
        ? [...getClubsOnly(entry.stars, this.clubs), ...getNationalTeamsByStars(entry.stars, this.clubs)]
        : getClubsOnly(entry.stars, this.clubs);

      for (let i = 0; i < entry.count; i++) {
        for (let p = 0; p < pairs.length; p++) {
          const club = pickAndBan(pools[p], source, entry.stars);
          if (club) pools[p].push(club);
        }
      }
    }

    // DEV diagnostics: check for cross-pool duplicates
    if (process.env.NODE_ENV !== 'production' && pools.length === 2) {
      const ids0 = new Set(pools[0].map(c => c.id));
      const ids1 = new Set(pools[1].map(c => c.id));
      const duplicates = [...ids0].filter(id => ids1.has(id));
      if (duplicates.length > 0) {
        console.error('[DEV] DUPLICATE clubs across pools in same round!', duplicates);
      }
      console.log('[DEV] generateTeamPoolsFromConfig result', {
        pair0: pools[0].map(c => `${c.name}(${c.id})`),
        pair1: pools[1].map(c => `${c.name}(${c.id})`),
        recycled: Array.from(recycledClubIds),
        duplicatesAcrossPools: duplicates,
      });
    }

    return { pools, recycledClubIds };
  }

  /**
   * Generate team pools using ONLY World Cup 2026 national teams.
   * Distribution is per-pair; defaults to the 6-win profile.
   */
  generateWorldCup26TeamPools(
    pairs: Pair[],
    excludeClubIds: string[] = [],
    distribution?: Array<{ stars: number; count: number }>
  ): TeamPoolResult {
    const dist = distribution ?? [
      { stars: 5, count: 3 },
      { stars: 4.5, count: 3 },
      { stars: 4, count: 4 },
      { stars: 3.5, count: 1 },
    ];

    const pools: Club[][] = pairs.map(() => []);
    const banned = new Set<string>(excludeClubIds);
    const usedClubsMap = new Map<string, Club>();
    const recycledClubIds = new Set<string>();
    const allocatedThisRound = new Set<string>();

    excludeClubIds.forEach(id => {
      const club = this.clubs.find(c => c.id === id);
      if (club) usedClubsMap.set(id, club);
    });

    const pickAndBan = (pool: Club[], sourceClubs: Club[], stars: number): Club | null => {
      const roundSafeSource = sourceClubs.filter(c => !allocatedThisRound.has(c.id));
      const result = pickClubWithFallback(roundSafeSource, banned, usedClubsMap, stars, pool);
      if (result.club) {
        banned.add(result.club.id);
        allocatedThisRound.add(result.club.id);
        usedClubsMap.set(result.club.id, result.club);
        if (result.isRecycled) recycledClubIds.add(result.club.id);
      }
      return result.club;
    };

    for (const entry of dist) {
      const source = getWorldCup26TeamsByStars(entry.stars, this.clubs);
      for (let i = 0; i < entry.count; i++) {
        for (let p = 0; p < pairs.length; p++) {
          const team = pickAndBan(pools[p], source, entry.stars);
          if (team) pools[p].push(team);
        }
      }
    }

    return { pools, recycledClubIds };
  }
}

/**
 * World Cup 26 distribution per pair, keyed by winsToComplete.
 */
export function getWorldCup26DistributionForWins(wins: number): Array<{ stars: number; count: number }> {
  switch (wins) {
    case 4:
      return [
        { stars: 5, count: 2 },
        { stars: 4.5, count: 2 },
        { stars: 4, count: 2 },
        { stars: 3.5, count: 1 },
      ];
    case 5:
      return [
        { stars: 5, count: 2 },
        { stars: 4.5, count: 3 },
        { stars: 4, count: 3 },
        { stars: 3.5, count: 1 },
      ];
    case 6:
    default:
      return [
        { stars: 5, count: 3 },
        { stars: 4.5, count: 3 },
        { stars: 4, count: 4 },
        { stars: 3.5, count: 1 },
      ];
  }
}
