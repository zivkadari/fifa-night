import { Player } from "@/types/tournament";
import { Card } from "@/components/ui/card";
import { Eye } from "lucide-react";
import { PlayerAvatar } from "@/components/PlayerAvatar";

interface PlayerPickerProps {
  players: Player[];
  onSelect: (playerId: string) => void;
  title?: string;
}

export default function PlayerPicker({ players, onSelect, title }: PlayerPickerProps) {
  return (
    <div className="min-h-[100dvh] bg-gaming-bg flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-sm space-y-5">
        <div className="text-center space-y-2">
          <Eye className="h-8 w-8 text-neon-green mx-auto" />
          <h1 className="text-xl font-bold text-foreground">{title || "צפייה בטורניר"}</h1>
          <p className="text-sm text-muted-foreground">בחר את השחקן שלך לחוויה מותאמת אישית</p>
        </div>

        <div className="space-y-2.5">
          {players.map((player) => (
            <button
              key={player.id}
              onClick={() => onSelect(player.id)}
              className="w-full bg-gradient-card border border-border/50 hover:border-neon-green/50 rounded-xl px-5 py-4 flex items-center gap-3 transition-all active:scale-[0.98]"
            >
              <PlayerAvatar player={player} size="md" />
              <span className="text-base font-semibold text-foreground">{player.name}</span>
            </button>
          ))}
        </div>

        <p className="text-[11px] text-muted-foreground text-center">
          הבחירה רק משנה את התצוגה — ללא גישה לעריכה
        </p>
      </div>
    </div>
  );
}
