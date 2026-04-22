import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Trophy,
  Calendar,
  History,
  ChevronDown,
  ChevronUp,
  BarChart3,
} from "lucide-react";
import type { MyEvening } from "@/services/userHistoryService";
import { modeLabelHe, tierLabelHe } from "@/services/userHistoryService";

interface Props {
  evenings: MyEvening[];
  loading: boolean;
}

const formatDate = (e: MyEvening) => {
  const value = e.date || e._updatedAt || e._createdAt;
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
};

const tierColor = (tier?: MyEvening["participation"]["tier"]) => {
  switch (tier) {
    case "alpha":
      return "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
    case "beta":
      return "bg-slate-400/15 text-slate-300 border-slate-400/30";
    case "gamma":
      return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "delta":
      return "bg-sky-400/15 text-sky-300 border-sky-400/30";
    case "epsilon":
      return "bg-purple-400/15 text-purple-300 border-purple-400/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

const HistoryCard = ({ e }: { e: MyEvening }) => {
  const [open, setOpen] = useState(false);
  const p = e.participation;
  const gd = p.goalsFor - p.goalsAgainst;

  return (
    <Card className="bg-gradient-card border-neon-green/20 p-4 shadow-card hover:shadow-glow transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Calendar className="h-4 w-4 text-neon-green shrink-0" />
          <span className="font-semibold text-foreground">{formatDate(e)}</span>
        </div>
        <Badge variant="outline" className="text-[10px] shrink-0">
          {modeLabelHe[e.resolvedMode]}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-2">
        {e.teamName && (
          <Badge variant="secondary" className="text-xs">
            <Trophy className="h-3 w-3 ml-1" />
            {e.teamName}
          </Badge>
        )}
        {p.tier && (
          <Badge variant="outline" className={`text-xs border ${tierColor(p.tier)}`}>
            {tierLabelHe[p.tier]}
          </Badge>
        )}
        {p.played > 0 && (
          <Badge variant="outline" className="text-xs">
            <span dir="ltr">{p.wins}W-{p.draws}D-{p.losses}L</span>
          </Badge>
        )}
      </div>

      <p className="text-xs text-muted-foreground break-words mb-2">
        שיחקת בשם: {p.selfPlayer.name}
      </p>

      <Button
        size="sm"
        variant="ghost"
        onClick={() => setOpen((v) => !v)}
        className="w-full justify-center gap-1 h-8 text-xs"
      >
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {open ? "הסתר פרטים" : "הצג פרטים"}
      </Button>

      {open && (
        <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
          {p.played > 0 && (
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 bg-gaming-surface rounded">
                <div className="text-sm font-bold text-foreground">{p.played}</div>
                <div className="text-[10px] text-muted-foreground">משחקים</div>
              </div>
              <div className="text-center p-2 bg-gaming-surface rounded">
                <div className="text-sm font-bold text-foreground">
                  <span dir="ltr">{p.goalsFor}-{p.goalsAgainst}</span>
                </div>
                <div className="text-[10px] text-muted-foreground">שערים</div>
              </div>
              <div className="text-center p-2 bg-gaming-surface rounded">
                <div className={`text-sm font-bold ${gd >= 0 ? "text-neon-green" : "text-destructive"}`}>
                  {gd > 0 ? `+${gd}` : gd}
                </div>
                <div className="text-[10px] text-muted-foreground">הפרש</div>
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground break-words">
            {e.players.length} שחקנים: {e.players.map((pl) => pl.name).join(", ")}
          </p>
        </div>
      )}
    </Card>
  );
};

export const ProfileMyHistoryTab = ({ evenings, loading }: Props) => {
  if (loading) {
    return (
      <Card className="bg-gradient-card border-primary/20 p-6 shadow-card">
        <p className="text-sm text-muted-foreground">טוען היסטוריה...</p>
      </Card>
    );
  }
  if (evenings.length === 0) {
    return (
      <Card className="bg-gradient-card border-primary/20 p-6 shadow-card text-center">
        <History className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          לא נמצאו טורנירים בהשתתפותך. ודא שאתה מקושר לשחקן בקבוצות שלך.
        </p>
      </Card>
    );
  }

  // Tiny summary row at top
  const totalGames = evenings.reduce((s, e) => s + e.participation.played, 0);
  const totalWins = evenings.reduce((s, e) => s + e.participation.wins, 0);
  const winRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;

  return (
    <div className="space-y-3">
      <Card className="bg-gradient-card border-primary/20 p-3 shadow-card">
        <div className="flex items-center justify-around gap-2">
          <div className="text-center">
            <div className="text-lg font-bold text-neon-green">{evenings.length}</div>
            <div className="text-[10px] text-muted-foreground">טורנירים</div>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-center">
            <div className="text-lg font-bold text-foreground">{totalGames}</div>
            <div className="text-[10px] text-muted-foreground">משחקים</div>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-center">
            <div className="text-lg font-bold text-foreground">{winRate}%</div>
            <div className="text-[10px] text-muted-foreground">ניצחון</div>
          </div>
        </div>
      </Card>

      {evenings.map((e) => (
        <HistoryCard key={e.id} e={e} />
      ))}
    </div>
  );
};
