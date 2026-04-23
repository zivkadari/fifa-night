import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Calendar, Trophy, Medal, Award, Trash2, Target, Users, Link2, Plus } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Evening, Player } from "@/types/tournament";
import { RemoteStorageService } from "@/services/remoteStorageService";
import { supabase } from "@/integrations/supabase/client";
import { EveningMatchDetails } from "@/components/EveningMatchDetails";
import { LinkToTeamDialog } from "@/components/LinkToTeamDialog";
import { ManualTournamentEntry } from "@/components/ManualTournamentEntry";
import { UserHistoryService, type UnifiedEvening } from "@/services/userHistoryService";
import {
  buildTeamIdentityResolver,
  type CanonicalIdentity,
  type TeamPlayer,
} from "@/services/teamPlayerIdentity";
import { TeamDuplicatePlayersCard } from "@/components/TeamDuplicatePlayersCard";

export type EveningWithTeam = Evening & {
  teamId?: string;
  teamName?: string;
  _updatedAt?: string;
  _createdAt?: string;
};

// Deterministic newest-first sort: prefers tournament date, then updated_at, then created_at.
const tsOf = (e: EveningWithTeam) => {
  for (const c of [e.date, (e as any)._updatedAt, (e as any)._createdAt]) {
    if (!c) continue;
    const t = new Date(c).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return 0;
};

// Deduplicate players by CANONICAL identity within a single evening so the
// per-evening leaderboard never double-counts the same logical player.
const dedupeByIdentity = (
  players: Player[],
  resolve: (p: Pick<Player, "id" | "name">) => CanonicalIdentity
): Player[] => {
  const seen = new Set<string>();
  const out: Player[] = [];
  for (const p of players) {
    const id = resolve(p).key;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(p);
  }
  return out;
};

interface TournamentHistoryProps {
  evenings: EveningWithTeam[];
  onBack: () => void;
  onDeleteEvening?: (eveningId: string) => void;
  onRefresh?: () => void;
}

export const TournamentHistory = ({ evenings, onBack, onDeleteEvening, onRefresh }: TournamentHistoryProps) => {
  // Use the unified history service as a fallback so this screen shares the
  // same deduplicated, team-aware data model as the Profile pages.
  const [unified, setUnified] = useState<UnifiedEvening[] | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const all = await UserHistoryService.loadAllVisibleEvenings();
        if (mounted) setUnified(all);
      } catch {
        if (mounted) setUnified([]);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Prefer unified data when available (it carries _updatedAt/_createdAt and
  // canonical team info); otherwise fall back to the props-provided list.
  const baseEvenings: EveningWithTeam[] = (unified && unified.length > 0)
    ? (unified as unknown as EveningWithTeam[])
    : evenings;

  const sortedEvenings = [...baseEvenings].sort((a, b) => tsOf(b) - tsOf(a));

  // Teams filter and per-team evenings.
  // Strict team scoping: history MUST be viewed within a single team to
  // prevent cross-team player duplication. The "all teams" view was the
  // primary source of duplicate-player rows in the leaderboard, so it has
  // been removed in favor of the unified Profile → My History feed for
  // cross-team views.
  const [teams, setTeams] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  // Canonical team roster (drives identity resolution).
  const [teamPlayers, setTeamPlayers] = useState<TeamPlayer[]>([]);
  // Whether the current user is the owner of the selected team — gates the
  // admin-only "possible duplicates" card.
  const [isTeamOwner, setIsTeamOwner] = useState(false);
  // Bumped after a manual merge/reject to force re-aggregation.
  const [identityRev, setIdentityRev] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await RemoteStorageService.listTeams();
        if (mounted) {
          setTeams(list);
          setSelectedTeamId((prev) => prev ?? (list[0]?.id ?? null));
        }
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  // Load team roster + ownership when the selected team changes.
  useEffect(() => {
    let mounted = true;
    if (!selectedTeamId) {
      setTeamPlayers([]);
      setIsTeamOwner(false);
      return;
    }
    (async () => {
      try {
        const players = await RemoteStorageService.listTeamPlayers(selectedTeamId);
        if (mounted) setTeamPlayers(players);
      } catch {
        if (mounted) setTeamPlayers([]);
      }
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { if (mounted) setIsTeamOwner(false); return; }
        const { data } = await supabase
          .from("teams")
          .select("owner_id")
          .eq("id", selectedTeamId)
          .maybeSingle();
        if (mounted) setIsTeamOwner(Boolean(data && (data as any).owner_id === user.id));
      } catch {
        if (mounted) setIsTeamOwner(false);
      }
    })();
    return () => { mounted = false; };
  }, [selectedTeamId]);

  // Strict team scoping by team_id only — never aggregate across teams here.
  const activeEvenings = selectedTeamId
    ? sortedEvenings.filter(e => e.teamId === selectedTeamId)
    : [];

  // Build a team-scoped canonical identity resolver. Aggregation below uses
  // the canonical key so the same logical player appears once per team —
  // even when legacy evenings used different raw player.ids.
  const resolver = useMemo(
    () => buildTeamIdentityResolver(selectedTeamId ?? "__none__", teamPlayers),
    // identityRev bumps after manual merges so cached aliases are reapplied.
    [selectedTeamId, teamPlayers, identityRev]
  );

  // Build overall leaderboard with counts per rank and tournaments played
  type Counts = { key: string; name: string; linked: boolean; alpha: number; beta: number; gamma: number; delta: number; tournaments: number };
  const countsMap = new Map<string, Counts>();
  const ensure = (ci: CanonicalIdentity) => {
    if (!countsMap.has(ci.key)) {
      countsMap.set(ci.key, { key: ci.key, name: ci.name, linked: ci.linked, alpha: 0, beta: 0, gamma: 0, delta: 0, tournaments: 0 });
    }
  };

  activeEvenings.forEach((evening) => {
    const uniquePlayers = dedupeByIdentity(evening.players || [], resolver.resolve);
    uniquePlayers.forEach((p) => {
      const ci = resolver.resolve(p);
      ensure(ci);
      countsMap.get(ci.key)!.tournaments += 1;
    });

    if (!evening.rankings) return;

    const alpha = dedupeByIdentity(evening.rankings.alpha || [], resolver.resolve);
    const beta = dedupeByIdentity(evening.rankings.beta || [], resolver.resolve);
    const gamma = dedupeByIdentity(evening.rankings.gamma || [], resolver.resolve);
    const knownKeys = new Set<string>(
      [...alpha, ...beta, ...gamma].map((p) => resolver.resolve(p).key)
    );
    const delta = dedupeByIdentity(
      (evening.rankings.delta && evening.rankings.delta.length > 0)
        ? evening.rankings.delta
        : uniquePlayers.filter((p) => !knownKeys.has(resolver.resolve(p).key)),
      resolver.resolve
    );

    const inc = (players: Player[], key: keyof Omit<Counts, 'key' | 'name' | 'linked' | 'tournaments'>) => {
      players.forEach((p) => {
        const ci = resolver.resolve(p);
        ensure(ci);
        countsMap.get(ci.key)![key] += 1;
      });
    };

    inc(alpha, 'alpha');
    inc(beta, 'beta');
    inc(gamma, 'gamma');
    inc(delta, 'delta');
  });

  const overallCounts = Array.from(countsMap.values())
    .sort((a, b) => b.alpha - a.alpha || b.beta - a.beta || b.gamma - a.gamma || b.delta - a.delta || a.name.localeCompare(b.name));

  const getRankIcon = (rank: 'alpha' | 'beta' | 'gamma' | 'delta') => {
    switch (rank) {
      case 'alpha': return <Trophy className="h-4 w-4 text-yellow-400" />;
      case 'beta': return <Medal className="h-4 w-4 text-gray-400" />;
      case 'gamma': return <Award className="h-4 w-4 text-amber-600" />;
      case 'delta': return <Target className="h-4 w-4 text-sky-400" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (sortedEvenings.length === 0) {
    return (
      <div className="min-h-screen bg-gaming-bg p-4">
        <div className="max-w-md mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-5 w-5 rotate-180" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Tournament History</h1>
              <p className="text-muted-foreground text-sm">Past evening results</p>
            </div>
          </div>

          {/* Empty State */}
          <Card className="bg-gradient-card border-neon-green/20 p-8 text-center shadow-card">
            <div className="flex justify-center mb-4">
              <Trophy className="h-16 w-16 text-muted-foreground/50" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">No Tournaments Yet</h2>
            <p className="text-muted-foreground mb-6">
              Start your first tournament to see results here
            </p>
            <Button variant="gaming" onClick={onBack}>
              Start New Tournament
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gaming-bg p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
           <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-5 w-5 rotate-180" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">Tournament History</h1>
            <p className="text-muted-foreground text-sm">
              {activeEvenings.length} טורנירים מוצגים
            </p>
          </div>
          <Button variant="neon" size="sm" onClick={() => setManualEntryOpen(true)}>
            <Plus className="h-4 w-4" /> הוסף
          </Button>
          </div>
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-neon-green" />
              <span className="text-sm text-muted-foreground">צפה לפי קבוצה</span>
            </div>
            <Select value={selectedTeamId ?? ''} onValueChange={(v) => setSelectedTeamId(v)}>
              <SelectTrigger className="w-full bg-gaming-surface border-border">
                <SelectValue placeholder="בחר קבוצה" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground mt-2">
              להיסטוריה כוללת בין קבוצות, עבור לפרופיל → ההיסטוריה שלי.
            </p>
          </div>

          {/* Overall Leaderboard */}
        {overallCounts.length > 0 && (
          <>
            <Card className="bg-gradient-card border-neon-green/30 p-4 mb-6 shadow-card">
              <h2 className="text-lg font-semibold text-foreground mb-3">טבלת על</h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-left">שחקן</TableHead>
                    <TableHead className="text-left">אלפא</TableHead>
                    <TableHead className="text-left">בטא</TableHead>
                    <TableHead className="text-left">גמא</TableHead>
                    <TableHead className="text-left">גרוע מאוד</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overallCounts.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-left font-medium">
                        <span>{row.name}</span>
                      </TableCell>
                      <TableCell className="text-left font-bold">{row.alpha}</TableCell>
                      <TableCell className="text-left font-bold">{row.beta}</TableCell>
                      <TableCell className="text-left font-bold">{row.gamma}</TableCell>
                      <TableCell className="text-left font-bold">{row.delta}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            {/* Collapsible: tournaments per player */}
            <Collapsible defaultOpen={false}>
              <Card className="bg-gradient-card border-neon-green/30 p-4 mb-6 shadow-card">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-foreground">מספר טורנירים לשחקן</h3>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm">פתח/סגור</Button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-left">שחקן</TableHead>
                        <TableHead className="text-left">טורנירים</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...overallCounts]
                        .sort((a, b) => b.tournaments - a.tournaments || a.name.localeCompare(b.name))
                        .map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="text-left font-medium">{row.name}</TableCell>
                            <TableCell className="text-left font-bold">{row.tournaments}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </>
        )}


        {/* Tournament List */}
        <div className="space-y-4">
          {activeEvenings.map((evening) => (
            <Card 
              key={evening.id} 
              className="bg-gradient-card border-neon-green/20 p-4 shadow-card hover:shadow-glow transition-all duration-200"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-neon-green" />
                  <span className="font-semibold text-foreground">
                    {formatDate(evening.date)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {evening.rounds?.length || 0} rounds
                  </Badge>
                  {/* Link to team button */}
                  <LinkToTeamDialog
                    eveningId={evening.id}
                    currentTeamId={evening.teamId}
                    currentTeamName={evening.teamName}
                    onLinked={() => onRefresh?.()}
                  />
                  {onDeleteEvening && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDeleteEvening(evening.id)}
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Rankings */}
              {evening.rankings && (
                <div className="space-y-2">
                  {/* Alpha */}
                  {evening.rankings.alpha.length > 0 && (
                    <div className="flex items-center gap-2">
                      {getRankIcon('alpha')}
                      <span className="text-sm font-medium text-foreground">Alpha:</span>
                      <div className="flex flex-wrap gap-1">
                        {evening.rankings.alpha.map((player) => (
                          <Badge 
                            key={player.id} 
                            variant="secondary" 
                            className="text-xs bg-yellow-400/20 text-yellow-300 border-yellow-400/30"
                          >
                            {player.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Beta */}
                  {evening.rankings.beta.length > 0 && (
                    <div className="flex items-center gap-2">
                      {getRankIcon('beta')}
                      <span className="text-sm font-medium text-foreground">Beta:</span>
                      <div className="flex flex-wrap gap-1">
                        {evening.rankings.beta.map((player) => (
                          <Badge 
                            key={player.id} 
                            variant="secondary" 
                            className="text-xs bg-gray-400/20 text-gray-300 border-gray-400/30"
                          >
                            {player.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Gamma */}
                  {evening.rankings.gamma.length > 0 && (
                    <div className="flex items-center gap-2">
                      {getRankIcon('gamma')}
                      <span className="text-sm font-medium text-foreground">Gamma:</span>
                      <div className="flex flex-wrap gap-1">
                        {evening.rankings.gamma.map((player) => (
                          <Badge 
                            key={player.id} 
                            variant="secondary" 
                            className="text-xs bg-amber-600/20 text-amber-300 border-amber-600/30"
                          >
                            {player.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Match Details - Expandable */}
              {evening.rounds && evening.rounds.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border/30">
                  <EveningMatchDetails evening={evening} />
                </div>
              )}

              {/* Team badge */}
              {evening.teamName && (
                <div className="mt-3 pt-3 border-t border-border/30">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-3 w-3 text-neon-green" />
                    <span className="text-xs text-neon-green font-medium">
                      קבוצה: {evening.teamName}
                    </span>
                  </div>
                </div>
              )}

              {/* Players */}
              <div className="mt-3 pt-3 border-t border-border/30">
                <p className="text-xs text-muted-foreground">
                  Players: {evening.players.map(p => p.name).join(', ')}
                </p>
              </div>
            </Card>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-muted-foreground text-sm">
            Keep playing to build your tournament legacy! 🏆
          </p>
        </div>

        <ManualTournamentEntry
          open={manualEntryOpen}
          onOpenChange={setManualEntryOpen}
          onSaved={() => onRefresh?.()}
        />
      </div>
    </div>
  );
};