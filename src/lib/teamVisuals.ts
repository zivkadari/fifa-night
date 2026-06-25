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

const hStripes = (...colors: string[]) =>
  flagSvg(colors.map((color, index) => `<rect y="${(48 / colors.length) * index}" width="64" height="${48 / colors.length}" fill="${color}"/>`).join(""));

const vStripes = (...colors: string[]) =>
  flagSvg(colors.map((color, index) => `<rect x="${(64 / colors.length) * index}" width="${64 / colors.length}" height="48" fill="${color}"/>`).join(""));

const nordicCross = (base: string, outer: string, inner: string) =>
  flagSvg(`
    <rect width="64" height="48" fill="${base}"/>
    <rect x="18" width="12" height="48" fill="${outer}"/>
    <rect y="18" width="64" height="12" fill="${outer}"/>
    <rect x="21" width="6" height="48" fill="${inner}"/>
    <rect y="21" width="64" height="6" fill="${inner}"/>
  `);

const simpleStar = (cx = 32, cy = 24, r = 6, fill = "#FCD116") =>
  `<path d="M${cx} ${cy - r}l${r * 0.62} ${r * 1.92}h${r * 2.02}l-${r * 1.63} ${r * 1.18} ${r * 0.62} ${r * 1.92}-${r * 1.63}-${r * 1.18}-${r * 1.63} ${r * 1.18} ${r * 0.62}-${r * 1.92}-${r * 1.63}-${r * 1.18}h${r * 2.02}z" fill="${fill}"/>`;

const NATIONAL_FLAG_BY_ID: Record<string, string> = {
  algeria: flagSvg(`
    <rect width="32" height="48" fill="#006233"/>
    <rect x="32" width="32" height="48" fill="#fff"/>
    <circle cx="34" cy="24" r="11" fill="#D21034"/>
    <circle cx="38" cy="24" r="9" fill="#fff"/>
    ${simpleStar(44, 24, 4.5, "#D21034")}
  `),
  argentina: flagSvg(`
    <rect y="0" width="64" height="16" fill="#75AADB"/>
    <rect y="16" width="64" height="16" fill="#FFFFFF"/>
    <rect y="32" width="64" height="16" fill="#75AADB"/>
    <circle cx="32" cy="24" r="4" fill="#F6B40E"/>
  `),
  australia: flagSvg(`
    <rect width="64" height="48" fill="#012169"/>
    <rect width="30" height="22" fill="#012169"/>
    <path d="M0 0l30 22M30 0 0 22" stroke="#fff" stroke-width="5"/>
    <path d="M0 0l30 22M30 0 0 22" stroke="#C8102E" stroke-width="2.5"/>
    <path d="M15 0v22M0 11h30" stroke="#fff" stroke-width="7"/>
    <path d="M15 0v22M0 11h30" stroke="#C8102E" stroke-width="3.5"/>
    ${simpleStar(46, 12, 3, "#fff")}
    ${simpleStar(52, 28, 3, "#fff")}
    ${simpleStar(39, 34, 3, "#fff")}
    ${simpleStar(49, 40, 2.4, "#fff")}
  `),
  austria: hStripes("#ED2939", "#FFFFFF", "#ED2939"),
  belgium: flagSvg(`
    <rect x="0" width="21.34" height="48" fill="#000000"/>
    <rect x="21.34" width="21.32" height="48" fill="#FAE042"/>
    <rect x="42.66" width="21.34" height="48" fill="#ED2939"/>
  `),
  "bosnia-herzegovina": flagSvg(`
    <rect width="64" height="48" fill="#002395"/>
    <path d="M30 0h22L30 48z" fill="#FECB00"/>
    <g fill="#fff">${Array.from({ length: 8 }, (_, i) => simpleStar(24 + i * 4, 2 + i * 6, 2.1, "#fff")).join("")}</g>
  `),
  brazil: flagSvg(`
    <rect width="64" height="48" fill="#009B3A"/>
    <path d="M32 6 58 24 32 42 6 24Z" fill="#FFDF00"/>
    <circle cx="32" cy="24" r="11" fill="#002776"/>
    <path d="M21 22c7-2 16-1 23 4" fill="none" stroke="#fff" stroke-width="3"/>
  `),
  canada: flagSvg(`
    <rect width="16" height="48" fill="#D52B1E"/>
    <rect x="48" width="16" height="48" fill="#D52B1E"/>
    <path d="M32 10l3 7 7-3-3 8 7 2-7 3 3 8-7-3-3 7-3-7-7 3 3-8-7-3 7-2-3-8 7 3z" fill="#D52B1E"/>
  `),
  colombia: hStripes("#FCD116", "#FCD116", "#003893", "#CE1126"),
  "cote-divoire": vStripes("#F77F00", "#FFFFFF", "#009E60"),
  croatia: flagSvg(`
    <rect width="64" height="16" y="0" fill="#F4F7F5"/>
    <rect width="64" height="16" y="16" fill="#DA291C"/>
    <rect width="64" height="16" y="32" fill="#171796"/>
    <path d="M24 12h16v24H24z" fill="#fff"/>
    <path d="M24 12h8v8h-8zm16 0v8h-8v-8zm-8 8h8v8h-8zm-8 8h8v8h-8z" fill="#DA291C"/>
  `),
  czechia: flagSvg(`
    <rect width="64" height="24" fill="#fff"/>
    <rect y="24" width="64" height="24" fill="#D7141A"/>
    <path d="M0 0l34 24L0 48z" fill="#11457E"/>
  `),
  denmark: flagSvg(`
    <rect width="64" height="48" fill="#C60C30"/>
    <rect x="18" width="7" height="48" fill="#fff"/>
    <rect y="20" width="64" height="7" fill="#fff"/>
  `),
  "dr-congo": flagSvg(`
    <rect width="64" height="48" fill="#007FFF"/>
    <path d="M-8 48 72 0" stroke="#F7D618" stroke-width="14"/>
    <path d="M-8 48 72 0" stroke="#CE1021" stroke-width="7"/>
    ${simpleStar(14, 12, 6, "#F7D618")}
  `),
  ecuador: flagSvg(`
    <rect width="64" height="24" fill="#FFDD00"/>
    <rect y="24" width="64" height="12" fill="#034EA2"/>
    <rect y="36" width="64" height="12" fill="#ED1C24"/>
    <circle cx="32" cy="24" r="5" fill="#8B5A2B"/>
  `),
  egypt: flagSvg(`
    <rect y="0" width="64" height="16" fill="#CE1126"/>
    <rect y="16" width="64" height="16" fill="#fff"/>
    <rect y="32" width="64" height="16" fill="#000"/>
    <path d="M32 19l3 5-3 5-3-5z" fill="#C09300"/>
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
  ghana: flagSvg(`
    <rect y="0" width="64" height="16" fill="#CE1126"/>
    <rect y="16" width="64" height="16" fill="#FCD116"/>
    <rect y="32" width="64" height="16" fill="#006B3F"/>
    ${simpleStar(32, 24, 6, "#000")}
  `),
  iran: flagSvg(`
    <rect y="0" width="64" height="16" fill="#239F40"/>
    <rect y="16" width="64" height="16" fill="#fff"/>
    <rect y="32" width="64" height="16" fill="#DA0000"/>
    <circle cx="32" cy="24" r="5" fill="#DA0000"/>
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
  morocco: flagSvg(`
    <rect width="64" height="48" fill="#C1272D"/>
    <path d="M32 14l3.2 9.4h9.8l-7.9 5.8 3 9.2-8.1-5.6-8.1 5.6 3-9.2-7.9-5.8h9.8z" fill="none" stroke="#006233" stroke-width="2.6"/>
  `),
  mexico: vStripes("#006847", "#FFFFFF", "#CE1126"),
  norway: nordicCross("#BA0C2F", "#FFFFFF", "#00205B"),
  paraguay: hStripes("#D52B1E", "#FFFFFF", "#0038A8"),
  poland: hStripes("#FFFFFF", "#DC143C"),
  portugal: flagSvg(`
    <rect width="26" height="48" fill="#006600"/>
    <rect x="26" width="38" height="48" fill="#FF0000"/>
    <circle cx="26" cy="24" r="7" fill="#FFCC00"/>
  `),
  "saudi-arabia-national": flagSvg(`
    <rect width="64" height="48" fill="#006C35"/>
    <path d="M14 19h36v4H14zM18 30h28v3H18z" fill="#fff"/>
  `),
  scotland: flagSvg(`
    <rect width="64" height="48" fill="#005EB8"/>
    <path d="M0 0l64 48M64 0 0 48" stroke="#fff" stroke-width="8"/>
  `),
  senegal: flagSvg(`
    <rect x="0" width="21.34" height="48" fill="#00853F"/>
    <rect x="21.34" width="21.32" height="48" fill="#FDEF42"/>
    <rect x="42.66" width="21.34" height="48" fill="#E31B23"/>
    ${simpleStar(32, 24, 5, "#00853F")}
  `),
  spain: flagSvg(`
    <rect y="0" width="64" height="12" fill="#AA151B"/>
    <rect y="12" width="64" height="24" fill="#F1BF00"/>
    <rect y="36" width="64" height="12" fill="#AA151B"/>
    <rect x="17" y="18" width="6" height="10" fill="#AA151B"/>
  `),
  sweden: flagSvg(`
    <rect width="64" height="48" fill="#006AA7"/>
    <rect x="18" width="8" height="48" fill="#FECC00"/>
    <rect y="20" width="64" height="8" fill="#FECC00"/>
  `),
  switzerland: flagSvg(`
    <rect width="64" height="48" fill="#D52B1E"/>
    <rect x="27" y="10" width="10" height="28" fill="#fff"/>
    <rect x="18" y="19" width="28" height="10" fill="#fff"/>
  `),
  tunisia: flagSvg(`
    <rect width="64" height="48" fill="#E70013"/>
    <circle cx="32" cy="24" r="13" fill="#fff"/>
    <circle cx="35" cy="24" r="7" fill="#E70013"/>
    <circle cx="38" cy="24" r="5.5" fill="#fff"/>
    ${simpleStar(40, 24, 3.8, "#E70013")}
  `),
  turkiye: flagSvg(`
    <rect width="64" height="48" fill="#E30A17"/>
    <circle cx="28" cy="24" r="12" fill="#fff"/>
    <circle cx="32" cy="24" r="9" fill="#E30A17"/>
    ${simpleStar(43, 24, 5, "#fff")}
  `),
  ukraine: hStripes("#0057B7", "#FFD700"),
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
  wales: flagSvg(`
    <rect width="64" height="24" fill="#fff"/>
    <rect y="24" width="64" height="24" fill="#00A650"/>
    <path d="M20 16c10-8 27-2 25 9 6 0 8 5 5 10-8-4-17-2-23 4 3-7-4-9-10-6 6-5 2-10 3-17z" fill="#D30731"/>
  `),
};

const NATIONAL_ID_ALIASES: Record<string, string> = {
  algeria: "algeria",
  dz: "algeria",
  alg: "algeria",
  ar: "argentina",
  arg: "argentina",
  argentina: "argentina",
  australia: "australia",
  au: "australia",
  aus: "australia",
  austria: "austria",
  at: "austria",
  aut: "austria",
  be: "belgium",
  bel: "belgium",
  belgium: "belgium",
  bih: "bosnia-herzegovina",
  bosnia: "bosnia-herzegovina",
  "bosnia-and-herzegovina": "bosnia-herzegovina",
  bosniaherzegovina: "bosnia-herzegovina",
  "bosnia-herzegovina": "bosnia-herzegovina",
  br: "brazil",
  bra: "brazil",
  brasil: "brazil",
  brazil: "brazil",
  ca: "canada",
  can: "canada",
  canada: "canada",
  civ: "cote-divoire",
  "cote-divoire": "cote-divoire",
  cotedivoire: "cote-divoire",
  "cote-d-ivoire": "cote-divoire",
  "cote-d'ivoire": "cote-divoire",
  "ivory-coast": "cote-divoire",
  ivorycoast: "cote-divoire",
  co: "colombia",
  col: "colombia",
  colombia: "colombia",
  cro: "croatia",
  croatia: "croatia",
  czechia: "czechia",
  cz: "czechia",
  cze: "czechia",
  "czech-republic": "czechia",
  czechrepublic: "czechia",
  de: "germany",
  deu: "germany",
  deutschland: "germany",
  denmark: "denmark",
  dk: "denmark",
  dnk: "denmark",
  "dr-congo": "dr-congo",
  drcongo: "dr-congo",
  congo: "dr-congo",
  "democratic-republic-of-the-congo": "dr-congo",
  cd: "dr-congo",
  cod: "dr-congo",
  ecuador: "ecuador",
  ec: "ecuador",
  ecu: "ecuador",
  egypt: "egypt",
  eg: "egypt",
  egy: "egypt",
  england: "england",
  eng: "england",
  es: "spain",
  esp: "spain",
  france: "france",
  fr: "france",
  fra: "france",
  ger: "germany",
  germany: "germany",
  ghana: "ghana",
  gh: "ghana",
  gha: "ghana",
  hr: "croatia",
  hrvatska: "croatia",
  iran: "iran",
  ir: "iran",
  irn: "iran",
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
  ma: "morocco",
  mar: "morocco",
  morocco: "morocco",
  mexico: "mexico",
  mx: "mexico",
  mex: "mexico",
  netherlands: "netherlands",
  holland: "netherlands",
  nl: "netherlands",
  nld: "netherlands",
  norway: "norway",
  no: "norway",
  nor: "norway",
  paraguay: "paraguay",
  py: "paraguay",
  par: "paraguay",
  poland: "poland",
  pl: "poland",
  pol: "poland",
  portugal: "portugal",
  pt: "portugal",
  por: "portugal",
  sa: "saudi-arabia-national",
  ksa: "saudi-arabia-national",
  saudia: "saudi-arabia-national",
  "saudi-arabia": "saudi-arabia-national",
  saudiarabia: "saudi-arabia-national",
  "saudi-arabia-national": "saudi-arabia-national",
  scotland: "scotland",
  sco: "scotland",
  senegal: "senegal",
  sn: "senegal",
  sen: "senegal",
  spain: "spain",
  sweden: "sweden",
  se: "sweden",
  swe: "sweden",
  switzerland: "switzerland",
  ch: "switzerland",
  sui: "switzerland",
  tunisia: "tunisia",
  tn: "tunisia",
  tun: "tunisia",
  turkiye: "turkiye",
  turkey: "turkiye",
  tr: "turkiye",
  tur: "turkiye",
  ukraine: "ukraine",
  ua: "ukraine",
  ukr: "ukraine",
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
  wales: "wales",
  wal: "wales",
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

export const getUnresolvedNationalFlagClubs = (clubs: TeamVisualClub[]) =>
  clubs
    .filter((club) => club.isNational)
    .filter((club) => !getNationalFlag(club))
    .map((club) => ({ id: club.id, name: club.name }));

export const reportNationalFlagCoverage = (clubs: TeamVisualClub[]) => {
  const nationalTeams = clubs.filter((club) => club.isNational);
  const unresolved = getUnresolvedNationalFlagClubs(clubs);

  if (unresolved.length > 0) {
    console.warn(
      `[Soccer Night] Missing national flag coverage: ${unresolved.length}/${nationalTeams.length}`,
      unresolved
    );
    return;
  }

  console.info(`[Soccer Night] National flag coverage: ${nationalTeams.length}/${nationalTeams.length} resolved`);
};

