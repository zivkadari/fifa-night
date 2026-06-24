import { Club } from "@/types/tournament";

type TeamVisualClub = Pick<Club, "id" | "name" | "isNational" | "isPrime"> & {
  countryCode?: string | null;
  country_code?: string | null;
  code?: string | null;
  crestUrl?: string | null;
  crest_url?: string | null;
  badgeUrl?: string | null;
  badge_url?: string | null;
  flagUrl?: string | null;
  flag_url?: string | null;
};

export type TeamVisualSource = {
  kind: "flag" | "crest" | "fallback";
  src?: string;
  label: string;
  initials: string;
};

const svgDataUri = (svg: string) =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg.replace(/\s+/g, " ").trim())}`;

const flagSvg = (body: string, viewBox = "0 0 64 48") =>
  svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">
      <rect width="64" height="48" fill="#f4f7f5"/>
      ${body}
    </svg>
  `);

const NATIONAL_FLAG_BY_ID: Record<string, string> = {
  argentina: flagSvg(`
    <rect y="0" width="64" height="16" fill="#75AADB"/>
    <rect y="16" width="64" height="16" fill="#FFFFFF"/>
    <rect y="32" width="64" height="16" fill="#75AADB"/>
    <circle cx="32" cy="24" r="4" fill="#F6B40E"/>
  `),
  belgium: flagSvg(`
    <rect x="0" width="21.34" height="48" fill="#000000"/>
    <rect x="21.34" width="21.32" height="48" fill="#FAE042"/>
    <rect x="42.66" width="21.34" height="48" fill="#ED2939"/>
  `),
  brazil: flagSvg(`
    <rect width="64" height="48" fill="#009B3A"/>
    <path d="M32 6 58 24 32 42 6 24Z" fill="#FFDF00"/>
    <circle cx="32" cy="24" r="11" fill="#002776"/>
    <path d="M21 22c7-2 16-1 23 4" fill="none" stroke="#fff" stroke-width="3"/>
  `),
  croatia: flagSvg(`
    <rect width="64" height="16" y="0" fill="#F4F7F5"/>
    <rect width="64" height="16" y="16" fill="#DA291C"/>
    <rect width="64" height="16" y="32" fill="#171796"/>
    <path d="M24 12h16v24H24z" fill="#fff"/>
    <path d="M24 12h8v8h-8zm16 0v8h-8v-8zm-8 8h8v8h-8zm-8 8h8v8h-8z" fill="#DA291C"/>
  `),
  england: flagSvg(`
    <rect width="64" height="48" fill="#FFFFFF"/>
    <rect x="27" width="10" height="48" fill="#C8102E"/>
    <rect y="19" width="64" height="10" fill="#C8102E"/>
  `),
  france: flagSvg(`
    <rect x="0" width="21.34" height="48" fill="#002654"/>
    <rect x="21.34" width="21.32" height="48" fill="#FFFFFF"/>
    <rect x="42.66" width="21.34" height="48" fill="#CE1126"/>
  `),
  germany: flagSvg(`
    <rect y="0" width="64" height="16" fill="#000"/>
    <rect y="16" width="64" height="16" fill="#DD0000"/>
    <rect y="32" width="64" height="16" fill="#FFCE00"/>
  `),
  italy: flagSvg(`
    <rect x="0" width="21.34" height="48" fill="#009246"/>
    <rect x="21.34" width="21.32" height="48" fill="#FFFFFF"/>
    <rect x="42.66" width="21.34" height="48" fill="#CE2B37"/>
  `),
  japan: flagSvg(`
    <rect width="64" height="48" fill="#FFFFFF"/>
    <circle cx="32" cy="24" r="12" fill="#BC002D"/>
  `),
  "korea-republic": flagSvg(`
    <rect width="64" height="48" fill="#FFFFFF"/>
    <path d="M32 13a11 11 0 1 1 0 22 11 11 0 0 1 0-22z" fill="#CD2E3A"/>
    <path d="M21 24a11 11 0 0 0 22 0c-3 4-8 5-11 0s-8-4-11 0z" fill="#0047A0"/>
    <path d="M13 10l10 6M16 6l10 6M39 36l10 6M42 32l10 6" stroke="#111827" stroke-width="2"/>
  `),
  netherlands: flagSvg(`
    <rect y="0" width="64" height="16" fill="#AE1C28"/>
    <rect y="16" width="64" height="16" fill="#FFFFFF"/>
    <rect y="32" width="64" height="16" fill="#21468B"/>
  `),
  portugal: flagSvg(`
    <rect width="26" height="48" fill="#006600"/>
    <rect x="26" width="38" height="48" fill="#FF0000"/>
    <circle cx="26" cy="24" r="7" fill="#FFCC00"/>
  `),
  spain: flagSvg(`
    <rect y="0" width="64" height="12" fill="#AA151B"/>
    <rect y="12" width="64" height="24" fill="#F1BF00"/>
    <rect y="36" width="64" height="12" fill="#AA151B"/>
    <rect x="17" y="18" width="6" height="10" fill="#AA151B"/>
  `),
  uruguay: flagSvg(`
    <rect width="64" height="48" fill="#FFFFFF"/>
    <path d="M0 5.33h64v5.33H0zm0 10.67h64v5.33H0zm0 10.67h64V32H0zm0 10.67h64v5.33H0z" fill="#0038A8"/>
    <rect width="27" height="27" fill="#FFFFFF"/>
    <circle cx="13.5" cy="13.5" r="5.2" fill="#FCD116"/>
    <g stroke="#FCD116" stroke-width="1.4" stroke-linecap="round">
      <path d="M13.5 2.5v5M13.5 19.5v5M2.5 13.5h5M19.5 13.5h5M5.7 5.7l3.5 3.5M17.8 17.8l3.5 3.5M21.3 5.7l-3.5 3.5M9.2 17.8l-3.5 3.5"/>
    </g>
  `),
  "united-states": flagSvg(`
    <rect width="64" height="48" fill="#B22234"/>
    <path d="M0 4h64v4H0zm0 8h64v4H0zm0 8h64v4H0zm0 8h64v4H0zm0 8h64v4H0zm0 8h64v4H0z" fill="#fff"/>
    <rect width="28" height="26" fill="#3C3B6E"/>
    <g fill="#fff"><circle cx="5" cy="5" r="1.1"/><circle cx="12" cy="5" r="1.1"/><circle cx="19" cy="5" r="1.1"/><circle cx="5" cy="12" r="1.1"/><circle cx="12" cy="12" r="1.1"/><circle cx="19" cy="12" r="1.1"/><circle cx="5" cy="19" r="1.1"/><circle cx="12" cy="19" r="1.1"/><circle cx="19" cy="19" r="1.1"/></g>
  `),
};

const NATIONAL_ID_ALIASES: Record<string, string> = {
  ar: "argentina",
  arg: "argentina",
  argentina: "argentina",
  be: "belgium",
  bel: "belgium",
  belgium: "belgium",
  br: "brazil",
  bra: "brazil",
  brasil: "brazil",
  brazil: "brazil",
  cro: "croatia",
  croatia: "croatia",
  de: "germany",
  deu: "germany",
  deutschland: "germany",
  england: "england",
  eng: "england",
  es: "spain",
  esp: "spain",
  france: "france",
  fr: "france",
  fra: "france",
  ger: "germany",
  germany: "germany",
  hr: "croatia",
  hrvatska: "croatia",
  it: "italy",
  ita: "italy",
  italy: "italy",
  jp: "japan",
  jpn: "japan",
  japan: "japan",
  korea: "korea-republic",
  "korea-republic": "korea-republic",
  korearepublic: "korea-republic",
  republicofkorea: "korea-republic",
  "republic-of-korea": "korea-republic",
  south_korea: "korea-republic",
  southkorea: "korea-republic",
  kr: "korea-republic",
  kor: "korea-republic",
  netherlands: "netherlands",
  holland: "netherlands",
  nl: "netherlands",
  nld: "netherlands",
  portugal: "portugal",
  pt: "portugal",
  por: "portugal",
  spain: "spain",
  uk: "england",
  gbeng: "england",
  unitedkingdom: "england",
  uruguay: "uruguay",
  uy: "uruguay",
  uru: "uruguay",
  usa: "united-states",
  us: "united-states",
  america: "united-states",
  united_states: "united-states",
  unitedstates: "united-states",
  "united-states": "united-states",
  "united-states-of-america": "united-states",
};

const normalizeId = (id: string) =>
  id
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const getTeamInitials = (club?: Pick<Club, "name"> | null) => {
  if (!club?.name) return "SN";
  return club.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
};

const compactKey = (value: string) => normalizeId(value).replace(/-/g, "");

const resolveNationalKey = (club?: TeamVisualClub | null) => {
  if (!club?.isNational) return null;

  const candidates = [
    club.countryCode,
    club.country_code,
    club.code,
    club.id,
    club.name,
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    const normalized = normalizeId(candidate);
    const compact = compactKey(candidate);
    const aliased =
      NATIONAL_ID_ALIASES[normalized] ??
      NATIONAL_ID_ALIASES[compact] ??
      normalized;

    if (NATIONAL_FLAG_BY_ID[aliased]) return aliased;
  }

  return null;
};

export const getNationalFlag = (club?: TeamVisualClub | null) => {
  const nationalKey = resolveNationalKey(club);
  return nationalKey ? NATIONAL_FLAG_BY_ID[nationalKey] : null;
};

export const getTeamVisualSource = (club?: TeamVisualClub | null): TeamVisualSource => {
  const initials = getTeamInitials(club);
  const label = club?.name ? `סמל ${club.name}` : "בחר קבוצה";
  const directImage =
    club?.flagUrl ??
    club?.flag_url ??
    club?.crestUrl ??
    club?.crest_url ??
    club?.badgeUrl ??
    club?.badge_url ??
    null;

  if (directImage) {
    return { kind: club?.isNational ? "flag" : "crest", src: directImage, label, initials };
  }

  const nationalFlag = getNationalFlag(club);
  if (nationalFlag) {
    return { kind: "flag", src: nationalFlag, label, initials };
  }

  return { kind: "fallback", label, initials: club?.isPrime ? "XI" : initials };
};

export const getTeamVisualLabel = (club?: Club | null) => {
  if (!club) return "בחר קבוצה";
  if (club.isPrime) return "XI";
  return getTeamInitials(club);
};

