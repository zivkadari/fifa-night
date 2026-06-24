import { cn } from "@/lib/utils";
import { Player } from "@/types/tournament";
import { PlayerAvatar } from "@/components/PlayerAvatar";

interface PlayerPairProps {
  players: [Player, Player] | Player[];
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showNames?: boolean;
  layout?: "stacked" | "inline";
  className?: string;
}

export const PlayerPair = ({ players, size = "md", showNames = true, layout = "stacked", className }: PlayerPairProps) => {
  const [first, second] = players;
  const name = players.map((player) => player.name).join(" + ");

  if (layout === "inline") {
    return (
      <div className={cn("flex min-w-0 items-center gap-2", className)}>
        <div className="flex shrink-0 flex-row-reverse items-center -space-x-2 space-x-reverse">
          {first && <PlayerAvatar player={first} size={size} />}
          {second && <PlayerAvatar player={second} size={size} />}
        </div>
        {showNames && (
          <span className="min-w-0 break-words text-sm font-bold leading-tight text-[#F4F7F5]">
            {name}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex min-w-0 flex-col items-center gap-1", className)}>
      <div className="flex flex-row-reverse items-center justify-center -space-x-2 space-x-reverse">
        {first && <PlayerAvatar player={first} size={size} />}
        {second && <PlayerAvatar player={second} size={size} />}
      </div>
      {showNames && (
        <div className="max-w-full rounded-lg border border-[#26313D] bg-[#05070A]/80 px-2 py-1 text-center text-xs font-bold leading-tight text-[#F4F7F5]">
          <span className="block break-words text-pretty">{name}</span>
        </div>
      )}
    </div>
  );
};
