/**
 * Team-scoped canonical player identity.
 *
 * Why this exists:
 * Per-evening data uses raw `player.id` which is not stable across legacy
 * evenings, 5-player synthesized IDs, and manually-entered tournaments.
 * Aggregating team history by raw id therefore produces duplicate rows for
 * the same logical person inside the same team (e.g. "זיו" appearing twice
 * with 1 tournament each instead of once with 2).
 *
 * Resolution layers (in order, strictly TEAM-SCOPED — never global):
 *   1. Confirmed manual aliases (per-team, persisted in localStorage).
 *      The team owner can confirm "these two are the same person" or
 *      "not the same"; both decisions are reversible.
 *   2. Direct membership in `team_players` — if the per-evening player.id
 *      matches a player_id linked to this team, that's the canonical id.
 *   3. Hebrew/English-aware name normalization — if the normalized name
 *      matches a canonical team player's normalized name, use the canonical
 *      team player as identity.
 *   4. Fallback — group by normalized name slug within this team.
 *
 * Raw historical data is never modified. This layer only affects display
 * aggregation and can be cleared at any time.
 */

import { Player } from "@/types/tournament";

export type TeamPlayer = { id: string; name: string };

export interface CanonicalIdentity {
  /** Stable canonical key used for aggregation (team-scoped). */
  key: string;
  /** Human-readable canonical name to render. */
  name: string;
  /** True if the identity is anchored on a team_players row. */
  linked: boolean;
}

const ALIAS_KEY_PREFIX = "ea-fc-team-aliases:";
const REJECT_KEY_PREFIX = "ea-fc-team-rejects:";

// ---------- Normalization ----------

/**
 * Normalize for comparison: lowercase, strip diacritics, collapse whitespace,
 * remove punctuation. Keeps both Latin and Hebrew letters.
 */
export function normalizeName(raw: string): string {
  return (raw || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip Latin diacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u0590-\u05ff]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function nameSlug(raw: string): string {
  return normalizeName(raw).replace(/\s+/g, "-");
}

// ---------- Hebrew ↔ English transliteration (best-effort) ----------

const HEB_TO_LAT: Record<string, string> = {
  א: "a", ב: "b", ג: "g", ד: "d", ה: "h", ו: "v", ז: "z",
  ח: "h", ט: "t", י: "i", כ: "k", ך: "k", ל: "l", מ: "m",
  ם: "m", נ: "n", ן: "n", ס: "s", ע: "a", פ: "p", ף: "p",
  צ: "ts", ץ: "ts", ק: "k", ר: "r", ש: "sh", ת: "t",
};

/** Rough Hebrew→Latin transliteration for fuzzy matching only. */
function transliterateHeb(s: string): string {
  let out = "";
  for (const ch of s) out += HEB_TO_LAT[ch] ?? ch;
  return out;
}

/**
 * Phonetic key used to *suggest* possible duplicates across alphabets
 * (e.g. "Ziv" ↔ "זיו"). Never used for silent merging.
 */
export function phoneticKey(raw: string): string {
  const n = normalizeName(raw).replace(/\s+/g, "");
  const t = transliterateHeb(n);
  // Collapse consecutive duplicate letters and common vowel noise so that
  // "ziv" and "zeev" / "zev" land close together.
  return t
    .replace(/[aeiou]+/g, "")
    .replace(/(.)\1+/g, "$1");
}

// ---------- Alias storage (per team, reversible) ----------

type AliasMap = Record<string, string>; // aliasKey -> canonicalKey
type RejectSet = Record<string, true>;  // "keyA|keyB" (sorted)

function aliasStorageKey(teamId: string) {
  return `${ALIAS_KEY_PREFIX}${teamId}`;
}
function rejectStorageKey(teamId: string) {
  return `${REJECT_KEY_PREFIX}${teamId}`;
}

export function loadAliases(teamId: string): AliasMap {
  try {
    const raw = localStorage.getItem(aliasStorageKey(teamId));
    return raw ? (JSON.parse(raw) as AliasMap) : {};
  } catch {
    return {};
  }
}

function saveAliases(teamId: string, map: AliasMap) {
  try {
    localStorage.setItem(aliasStorageKey(teamId), JSON.stringify(map));
  } catch {}
}

export function loadRejects(teamId: string): RejectSet {
  try {
    const raw = localStorage.getItem(rejectStorageKey(teamId));
    return raw ? (JSON.parse(raw) as RejectSet) : {};
  } catch {
    return {};
  }
}

function saveRejects(teamId: string, set: RejectSet) {
  try {
    localStorage.setItem(rejectStorageKey(teamId), JSON.stringify(set));
  } catch {}
}

function pairKey(a: string, b: string) {
  return [a, b].sort().join("|");
}

/** Confirm two identities are the same logical player. */
export function confirmAlias(teamId: string, aliasKey: string, canonicalKey: string) {
  if (aliasKey === canonicalKey) return;
  const map = loadAliases(teamId);
  // If canonicalKey itself was previously an alias, follow the chain
  let target = canonicalKey;
  const seen = new Set<string>();
  while (map[target] && !seen.has(target)) {
    seen.add(target);
    target = map[target];
  }
  map[aliasKey] = target;
  // Re-point any chain ending at aliasKey to the new target
  for (const k of Object.keys(map)) {
    if (map[k] === aliasKey) map[k] = target;
  }
  saveAliases(teamId, map);
}

/** Mark a suggested pair as "not the same" so it stops being suggested. */
export function rejectAlias(teamId: string, keyA: string, keyB: string) {
  const set = loadRejects(teamId);
  set[pairKey(keyA, keyB)] = true;
  saveRejects(teamId, set);
}

export function isRejected(teamId: string, keyA: string, keyB: string): boolean {
  const set = loadRejects(teamId);
  return Boolean(set[pairKey(keyA, keyB)]);
}

/** Remove a previously confirmed alias (undo). */
export function clearAlias(teamId: string, aliasKey: string) {
  const map = loadAliases(teamId);
  if (map[aliasKey]) {
    delete map[aliasKey];
    saveAliases(teamId, map);
  }
}

// ---------- Resolver ----------

export interface IdentityResolver {
  resolve: (player: Pick<Player, "id" | "name">) => CanonicalIdentity;
  /** All canonical identities seen so far during a resolve session. */
  list: () => CanonicalIdentity[];
}

/**
 * Build a team-scoped resolver. `teamPlayers` are the canonical roster
 * fetched from `team_players` for this team.
 */
export function buildTeamIdentityResolver(
  teamId: string,
  teamPlayers: TeamPlayer[]
): IdentityResolver {
  const aliases = loadAliases(teamId);
  const cache = new Map<string, CanonicalIdentity>();

  // Pre-seed canonical identities from the team roster.
  const byPlayerId = new Map<string, TeamPlayer>();
  const byNameSlug = new Map<string, TeamPlayer>();
  for (const tp of teamPlayers) {
    byPlayerId.set(tp.id, tp);
    byNameSlug.set(nameSlug(tp.name), tp);
    const canonicalKey = `team:${tp.id}`;
    cache.set(canonicalKey, { key: canonicalKey, name: tp.name, linked: true });
  }

  const followAlias = (key: string): string => {
    const seen = new Set<string>();
    let cur = key;
    while (aliases[cur] && !seen.has(cur)) {
      seen.add(cur);
      cur = aliases[cur];
    }
    return cur;
  };

  const resolve = (player: Pick<Player, "id" | "name">): CanonicalIdentity => {
    const slug = nameSlug(player.name || "");

    // Layer 2: explicit team_players link by id
    const byId = byPlayerId.get(player.id);
    if (byId) {
      const key = followAlias(`team:${byId.id}`);
      const existing = cache.get(key);
      if (existing) return existing;
      const ci = { key, name: byId.name, linked: true };
      cache.set(key, ci);
      return ci;
    }

    // Layer 3: name match against the team roster
    const byName = byNameSlug.get(slug);
    if (byName) {
      const key = followAlias(`team:${byName.id}`);
      const existing = cache.get(key);
      if (existing) return existing;
      const ci = { key, name: byName.name, linked: true };
      cache.set(key, ci);
      return ci;
    }

    // Layer 4: fallback — group by normalized name slug within team scope.
    const fallbackKey = followAlias(`name:${slug || player.id}`);
    const existing = cache.get(fallbackKey);
    if (existing) return existing;
    const ci: CanonicalIdentity = {
      key: fallbackKey,
      name: player.name || player.id,
      linked: false,
    };
    cache.set(fallbackKey, ci);
    return ci;
  };

  return {
    resolve,
    list: () => Array.from(cache.values()),
  };
}

// ---------- Duplicate suggestions ----------

export interface DuplicateSuggestion {
  a: { key: string; name: string; linked: boolean; tournaments: number };
  b: { key: string; name: string; linked: boolean; tournaments: number };
  reason: string;
  /** 0..1, used only for sorting suggestions. */
  confidence: number;
}

/**
 * Suggest possible duplicate identities WITHIN a single team. Never
 * auto-merges. Skips pairs the owner has already rejected.
 */
export function suggestDuplicates(
  teamId: string,
  identities: Array<CanonicalIdentity & { tournaments: number }>
): DuplicateSuggestion[] {
  const out: DuplicateSuggestion[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < identities.length; i++) {
    for (let j = i + 1; j < identities.length; j++) {
      const a = identities[i];
      const b = identities[j];
      if (a.key === b.key) continue;
      if (isRejected(teamId, a.key, b.key)) continue;

      const aN = normalizeName(a.name);
      const bN = normalizeName(b.name);
      if (!aN || !bN) continue;

      let reason = "";
      let confidence = 0;

      if (aN === bN) {
        reason = "אותו שם בדיוק";
        confidence = 0.95;
      } else {
        const aP = phoneticKey(a.name);
        const bP = phoneticKey(b.name);
        if (aP && bP && aP === bP) {
          reason = "צלילי שם זהים (עברית/אנגלית)";
          confidence = 0.7;
        } else if (aP && bP && (aP.includes(bP) || bP.includes(aP)) && Math.min(aP.length, bP.length) >= 2) {
          reason = "שם דומה מאוד";
          confidence = 0.5;
        }
      }

      // Only one linked side strengthens the suggestion (legacy → canonical).
      if (confidence > 0 && a.linked !== b.linked) {
        confidence += 0.05;
      }

      if (confidence >= 0.5) {
        const sig = pairKey(a.key, b.key);
        if (seen.has(sig)) continue;
        seen.add(sig);
        out.push({
          a: { key: a.key, name: a.name, linked: a.linked, tournaments: a.tournaments },
          b: { key: b.key, name: b.name, linked: b.linked, tournaments: b.tournaments },
          reason,
          confidence,
        });
      }
    }
  }

  return out.sort((x, y) => y.confidence - x.confidence);
}
