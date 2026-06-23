import { Club } from "@/types/tournament";

const NATIONAL_FLAG_BY_ID: Record<string, string> = {
  algeria: "🇩🇿",
  argentina: "🇦🇷",
  australia: "🇦🇺",
  austria: "🇦🇹",
  belgium: "🇧🇪",
  "bosnia-herzegovina": "🇧🇦",
  brazil: "🇧🇷",
  canada: "🇨🇦",
  colombia: "🇨🇴",
  "cote-divoire": "🇨🇮",
  croatia: "🇭🇷",
  czechia: "🇨🇿",
  denmark: "🇩🇰",
  "dr-congo": "🇨🇩",
  ecuador: "🇪🇨",
  egypt: "🇪🇬",
  england: "🏴",
  france: "🇫🇷",
  germany: "🇩🇪",
  ghana: "🇬🇭",
  iran: "🇮🇷",
  italy: "🇮🇹",
  japan: "🇯🇵",
  "korea-republic": "🇰🇷",
  mexico: "🇲🇽",
  morocco: "🇲🇦",
  netherlands: "🇳🇱",
  norway: "🇳🇴",
  paraguay: "🇵🇾",
  poland: "🇵🇱",
  portugal: "🇵🇹",
  "saudi-arabia-national": "🇸🇦",
  scotland: "🏴",
  senegal: "🇸🇳",
  spain: "🇪🇸",
  sweden: "🇸🇪",
  switzerland: "🇨🇭",
  tunisia: "🇹🇳",
  turkiye: "🇹🇷",
  ukraine: "🇺🇦",
  "united-states": "🇺🇸",
  uruguay: "🇺🇾",
  wales: "🏴",
};

export const getTeamInitials = (club?: Pick<Club, "name"> | null) => {
  if (!club?.name) return "SN";
  return club.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
};

export const getNationalFlag = (club?: Pick<Club, "id" | "isNational"> | null) => {
  if (!club?.isNational) return null;
  return NATIONAL_FLAG_BY_ID[club.id] ?? null;
};

export const getTeamVisualLabel = (club?: Club | null) => {
  if (!club) return "בחר קבוצה";
  if (club.isNational) return getNationalFlag(club) ?? "⚑";
  if (club.isPrime) return "XI";
  return getTeamInitials(club);
};

