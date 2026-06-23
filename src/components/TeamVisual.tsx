import { Shield } from "lucide-react";
import { Club } from "@/types/tournament";
import { cn } from "@/lib/utils";
import { getTeamVisualLabel } from "@/lib/teamVisuals";
import { StarRating } from "@/components/StarRating";

type VisualClub = Club & {
  crestUrl?: string | null;
  crest_url?: string | null;
  badgeUrl?: string | null;
  badge_url?: string | null;
  flagUrl?: string | null;
  flag_url?: string | null;
};

interface TeamBadgeOrFlagProps {
  club?: VisualClub | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "h-10 w-10 text-base",
  md: "h-16 w-16 text-2xl",
  lg: "h-20 w-20 text-4xl",
};

export const TeamBadgeOrFlag = ({ club, size = "md", className }: TeamBadgeOrFlagProps) => {
  const imageUrl = club?.flagUrl ?? club?.flag_url ?? club?.crestUrl ?? club?.crest_url ?? club?.badgeUrl ?? club?.badge_url ?? null;
  const label = club?.name ? `סמל ${club.name}` : "קבוצה";

  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#39FF88]/50 bg-[#151C26] text-center font-black text-[#F4F7F5] shadow-[0_0_18px_rgba(57,255,136,0.18)]",
        sizeClasses[size],
        className
      )}
      aria-label={label}
    >
      {imageUrl ? (
        <img src={imageUrl} alt={label} className="h-full w-full object-cover" loading="lazy" />
      ) : club ? (
        <span aria-hidden="true">{getTeamVisualLabel(club)}</span>
      ) : (
        <Shield className="h-1/2 w-1/2 text-[#6F7A86]" aria-hidden="true" />
      )}
    </div>
  );
};

interface TeamVisualProps {
  club?: VisualClub | null;
  size?: "sm" | "md" | "lg";
  selected?: boolean;
  used?: boolean;
  className?: string;
}

export const TeamVisual = ({ club, size = "md", selected, used, className }: TeamVisualProps) => (
  <div className={cn("flex min-w-0 flex-col items-center gap-1 text-center", used && "opacity-45", className)}>
    <TeamBadgeOrFlag club={club} size={size} className={selected ? "border-[#39FF88] shadow-[0_0_24px_rgba(57,255,136,0.35)]" : undefined} />
    <div className="max-w-full truncate text-[11px] font-medium text-[#A4ADB8]">
      {club?.name ?? "בחר קבוצה"}
    </div>
    {club?.stars !== undefined && (
      <StarRating stars={club.stars} size="xs" className="justify-center" />
    )}
  </div>
);

