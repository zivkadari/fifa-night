import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Check, X, Users } from "lucide-react";
import {
  CanonicalIdentity,
  DuplicateSuggestion,
  confirmAlias,
  rejectAlias,
  suggestDuplicates,
} from "@/services/teamPlayerIdentity";

interface Props {
  teamId: string;
  /** Canonical identities + tournament counts already aggregated by the parent. */
  identities: Array<CanonicalIdentity & { tournaments: number }>;
  /** Called after a merge/reject so the parent can re-aggregate. */
  onResolved: () => void;
}

/**
 * Admin-only data-quality card. Shows possible duplicate logical players
 * within a single team and lets the team owner manually confirm or dismiss.
 * Never auto-merges. Decisions are reversible (stored locally per team).
 */
export const TeamDuplicatePlayersCard = ({ teamId, identities, onResolved }: Props) => {
  const [bumpKey, setBumpKey] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const suggestions: DuplicateSuggestion[] = useMemo(
    () => suggestDuplicates(teamId, identities),
    // Re-run when teamId, identities, or local decisions change.
    [teamId, identities, bumpKey]
  );

  if (dismissed || suggestions.length === 0) return null;

  const handleMerge = (s: DuplicateSuggestion) => {
    // Prefer the linked side as canonical; otherwise the one with more
    // tournaments; final tie-break: lexicographic on key for stability.
    const canonical =
      s.a.linked && !s.b.linked
        ? s.a
        : s.b.linked && !s.a.linked
        ? s.b
        : s.a.tournaments >= s.b.tournaments
        ? s.a
        : s.b;
    const alias = canonical.key === s.a.key ? s.b : s.a;
    confirmAlias(teamId, alias.key, canonical.key);
    setBumpKey((k) => k + 1);
    onResolved();
  };

  const handleReject = (s: DuplicateSuggestion) => {
    rejectAlias(teamId, s.a.key, s.b.key);
    setBumpKey((k) => k + 1);
  };

  return (
    <Card className="bg-gradient-card border-amber-500/40 p-4 mb-6 shadow-card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-foreground">
            ייתכן שזיהינו שחקנים כפולים
          </h3>
          <Badge variant="outline" className="text-[10px]">
            {suggestions.length}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDismissed(true)}
          className="text-xs text-muted-foreground"
        >
          הסתר
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">
        הצעות אלו זמינות רק לאדמיני קבוצה. אישור ממזג את התצוגה בלבד; היסטוריה גולמית נשמרת.
      </p>

      <div className="space-y-2">
        {suggestions.slice(0, 6).map((s) => (
          <div
            key={`${s.a.key}__${s.b.key}`}
            className="flex flex-col gap-2 p-2 rounded-md border border-border/40 bg-gaming-surface/40"
          >
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-3 w-3 text-muted-foreground" />
              <span className="font-medium text-foreground">{s.a.name}</span>
              {s.a.linked && (
                <Badge variant="outline" className="text-[10px] border-neon-green/40 text-neon-green">
                  מקושר
                </Badge>
              )}
              <span className="text-muted-foreground">↔</span>
              <span className="font-medium text-foreground">{s.b.name}</span>
              {s.b.linked && (
                <Badge variant="outline" className="text-[10px] border-neon-green/40 text-neon-green">
                  מקושר
                </Badge>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {s.reason} · {s.a.tournaments} ↔ {s.b.tournaments} טורנירים
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="neon"
                onClick={() => handleMerge(s)}
                className="h-7 text-xs"
              >
                <Check className="h-3 w-3" /> אותו שחקן
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleReject(s)}
                className="h-7 text-xs"
              >
                <X className="h-3 w-3" /> לא אותו שחקן
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
