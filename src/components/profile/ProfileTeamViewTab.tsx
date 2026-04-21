import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Trophy, Users } from "lucide-react";
import type { MyEvening, UnifiedEvening } from "@/services/userHistoryService";
import { modeLabelHe, tierLabelHe } from "@/services/userHistoryService";

interface Props {
  teams: Array<{ team_id: string; team_name: string }>;
  selectedTeamId: string | null;
  onSelectTeam: (id: string) => void;
  evenings: UnifiedEvening[];
  myEveningIds: Set<string>;
  /** Map of evening.id -> participation (for highlighting) */
  myParticipationById: Map<string, MyEvening["participation"]>;
  loading: boolean;
}

const formatDate = (e: UnifiedEvening) => {
  const value = e.date || e._updatedAt || e._createdAt;
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
};

export const ProfileTeamViewTab = ({
  teams,
  selectedTeamId,
  onSelectTeam,
  evenings,
  myEveningIds,
  myParticipationById,
  loading,
}: Props) => {
  const [filter, setFilter] = useState<"all" | "mine">("all");

  const filtered = useMemo(() => {
    if (filter === "mine") return evenings.filter((e) => myEveningIds.has(e.id));
    return evenings;
  }, [evenings, filter, myEveningIds]);

  if (teams.length === 0) {
    return (
      <Card className="bg-gradient-card border-primary/20 p-6 shadow-card text-center">
        <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">אינך חבר בקבוצה כלשהי עדיין.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-card border-primary/20 p-3 shadow-card space-y-3">
        <Select value={selectedTeamId ?? ""} onValueChange={onSelectTeam}>
          <SelectTrigger className="w-full bg-gaming-surface border-border">
            <SelectValue placeholder="בחר קבוצה" />
          </SelectTrigger>
          <SelectContent>
            {teams.map((t) => (
              <SelectItem key={t.team_id} value={t.team_id}>
                {t.team_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant={filter === "all" ? "gaming" : "outline"}
            onClick={() => setFilter("all")}
            className="flex-1"
          >
            כל הטורנירים
          </Button>
          <Button
            size="sm"
            variant={filter === "mine" ? "gaming" : "outline"}
            onClick={() => setFilter("mine")}
            className="flex-1"
          >
            רק שלי ({myEveningIds.size})
          </Button>
        </div>
      </Card>

      {loading ? (
        <Card className="bg-gradient-card border-primary/20 p-6 shadow-card">
          <p className="text-sm text-muted-foreground">טוען...</p>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="bg-gradient-card border-primary/20 p-6 shadow-card text-center">
          <p className="text-sm text-muted-foreground">
            {filter === "mine" ? "לא השתתפת בטורנירים בקבוצה זו." : "אין טורנירים לקבוצה זו."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((e) => {
            const isMine = myEveningIds.has(e.id);
            const participation = myParticipationById.get(e.id);
            return (
              <Card
                key={e.id}
                className={`bg-gradient-card p-4 shadow-card transition-shadow hover:shadow-glow ${
                  isMine ? "border-neon-green/60" : "border-border"
                }`}
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
                  {isMine && (
                    <Badge variant="secondary" className="text-xs bg-neon-green/15 text-neon-green border-neon-green/40">
                      <Trophy className="h-3 w-3 ml-1" />
                      השתתפת
                    </Badge>
                  )}
                  {participation?.tier && (
                    <Badge variant="outline" className="text-xs">
                      {tierLabelHe[participation.tier]}
                    </Badge>
                  )}
                </div>

                <p className="text-xs text-muted-foreground break-words">
                  {e.players.length} שחקנים: {e.players.map((p) => p.name).join(", ")}
                </p>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
