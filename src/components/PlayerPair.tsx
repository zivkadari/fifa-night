import { cn } from "@/lib/utils";
import { Player } from "@/types/tournament";
import { PlayerAvatar } from "@/components/PlayerAvatar";

interface PlayerPairProps {
  players: [Player, Player] | Player[];
  size?: "sm" | "md" | "lg" | "xl";
  showNames?: boolean;
  className?: string;
}

export const PlayerPair = ({ players, size = "md", showNames = true, className }: PlayerPairProps) => {
  const [first, second] = players;

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div className="flex flex-row-reverse items-center justify-center -space-x-2 space-x-reverse">
        {first && <PlayerAvatar player={first} size={size} />}
        {second && <PlayerAvatar player={second} size={size} />}
      </div>
      {showNames && (
        <div className="max-w-[9rem] rounded-lg border border-[#26313D] bg-[#05070A]/80 px-3 py-1 text-center text-xs font-bold text-[#F4F7F5]">
          {players.map((player) => player.name).join(" + ")}
        </div>
      )}
    </div>
  );
};

