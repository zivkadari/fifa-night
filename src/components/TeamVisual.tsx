import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { Club } from "@/types/tournament";
import { cn } from "@/lib/utils";
import { getTeamVisualSource } from "@/lib/teamVisuals";
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
  sm: {
    flag: "h-8 w-12",
    crest: "h-10 w-10 text-sm",
  },
  md: {
    flag: "h-12 w-[4.5rem]",
    crest: "h-16 w-16 text-xl",
  },
  lg: {
    flag: "h-14 w-[5.25rem]",
    crest: "h-16 w-16 text-xl",
  },
};

export const TeamBadgeOrFlag = ({ club, size = "md", className }: TeamBadgeOrFlagProps) => {
  const visual = getTeamVisualSource(club);
  const isFlag = visual.kind === "flag";
  const dimensions = isFlag ? sizeClasses[size].flag : sizeClasses[size].crest;
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [visual.src]);

  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden border border-[#39FF88]/35 bg-[#151C26] text-center font-black text-[#F4F7F5] shadow-[0_0_14px_rgba(57,255,136,0.14)]",
        isFlag ? "rounded-md" : "rounded-xl",
        dimensions,
        className
      )}
      aria-label={visual.label}
    >
      {visual.src && !imageFailed ? (
        <img
          src={visual.src}
          alt={visual.label}
          className={cn("h-full w-full", isFlag ? "object-cover" : "object-contain p-1")}
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      ) : club ? (
        <div className="flex h-full w-full flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_32%,rgba(57,255,136,0.22),transparent_34%),linear-gradient(145deg,#151C26,#0E2A1A)]">
          <Shield className="h-1/2 w-1/2 text-[#39FF88]" aria-hidden="true" />
          <span className="mt-0.5 text-[0.55em] leading-none" aria-hidden="true">{visual.initials}</span>
        </div>
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center bg-[linear-gradient(145deg,#151C26,#0E2A1A)]">
          <Shield className="h-1/2 w-1/2 text-[#39FF88]" aria-hidden="true" />
        </div>
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
    <div className="max-w-full truncate text-[11px] font-medium text-[#A4ADB8]" dir="auto">
      {club?.name ?? "בחר קבוצה"}
    </div>
    {club?.stars !== undefined && (
      <StarRating stars={club.stars} size="xs" className="justify-center" />
    )}
  </div>
);
