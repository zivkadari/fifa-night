import { cn } from "@/lib/utils";
import { Player } from "@/types/tournament";

type AvatarPlayer = Player & {
  avatarUrl?: string | null;
  avatar_url?: string | null;
  imageUrl?: string | null;
};

interface PlayerAvatarProps {
  player?: AvatarPlayer | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  sm: "h-7 w-7 text-[10px]",
  md: "h-9 w-9 text-xs",
  lg: "h-12 w-12 text-sm",
  xl: "h-16 w-16 text-base",
};

const initials = (name?: string) =>
  (name || "?")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

export const PlayerAvatar = ({ player, size = "md", className }: PlayerAvatarProps) => {
  const src = player?.avatarUrl ?? player?.avatar_url ?? player?.imageUrl ?? null;
  const label = player?.name ? `תמונת פרופיל של ${player.name}` : "שחקן";

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#39FF88]/70 bg-[#151C26] font-bold text-[#F4F7F5] shadow-[0_0_16px_rgba(57,255,136,0.22)]",
        sizeClasses[size],
        className
      )}
      aria-label={label}
    >
      {src ? (
        <img
          src={src}
          alt={label}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <span aria-hidden="true">{initials(player?.name)}</span>
      )}
    </span>
  );
};

