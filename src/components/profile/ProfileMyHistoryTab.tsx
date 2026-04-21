import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Calendar, History } from "lucide-react";
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

  return (
    <div className="space-y-3">
      {evenings.map((e) => (
        <Card
          key={e.id}
          className="bg-gradient-card border-neon-green/20 p-4 shadow-card hover:shadow-glow transition-shadow"
        >
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
            {e.participation.tier && (
              <Badge variant="outline" className={`text-xs border ${tierColor(e.participation.tier)}`}>
                {tierLabelHe[e.participation.tier]}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              שיחקת בשם: {e.participation.selfPlayer.name}
            </Badge>
          </div>

          <p className="text-xs text-muted-foreground break-words">
            {e.players.length} שחקנים: {e.players.map((p) => p.name).join(", ")}
          </p>
        </Card>
      ))}
    </div>
  );
};
