import { Club } from '@/types/tournament';
import { supabase } from '@/integrations/supabase/client';

// Club overrides cache
let clubOverridesCache: Record<string, number> | null = null;
let clubDeletedCache: Set<string> | null = null;
let lastOverridesFetch = 0;
const OVERRIDES_CACHE_TTL = 60000; // 1 minute

export const FIFA_CLUBS: Club[] = [
  // 🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League (England)
  { id: 'manchester-city', name: 'Manchester City', stars: 5, league: 'Premier League' },
  { id: 'liverpool', name: 'Liverpool', stars: 5, league: 'Premier League' },
  { id: 'arsenal', name: 'Arsenal', stars: 5, league: 'Premier League' },
  { id: 'chelsea', name: 'Chelsea', stars: 4.5, league: 'Premier League' },
  { id: 'tottenham', name: 'Tottenham Hotspur', stars: 4.5, league: 'Premier League' },
  { id: 'manchester-united', name: 'Manchester United', stars: 4.5, league: 'Premier League' },
  { id: 'newcastle', name: 'Newcastle United', stars: 4.5, league: 'Premier League' },
  { id: 'aston-villa', name: 'Aston Villa', stars: 4.5, league: 'Premier League' },
  { id: 'brighton', name: 'Brighton', stars: 4.5, league: 'Premier League' },
  { id: 'crystal-palace', name: 'Crystal Palace', stars: 4.5, league: 'Premier League' },
  { id: 'nottingham-forest', name: 'Nottingham Forest', stars: 4.5, league: 'Premier League' },
  { id: 'west-ham', name: 'West Ham United', stars: 4, league: 'Premier League' },
  { id: 'wolves', name: 'Wolverhampton Wanderers', stars: 4, league: 'Premier League' },
  { id: 'bournemouth', name: 'Bournemouth', stars: 4, league: 'Premier League' },
  { id: 'brentford', name: 'Brentford', stars: 4, league: 'Premier League' },
  { id: 'everton', name: 'Everton', stars: 4, league: 'Premier League' },
  { id: 'fulham', name: 'Fulham', stars: 4, league: 'Premier League' },
  { id: 'leeds', name: 'Leeds United', stars: 4, league: 'Premier League' },
  { id: 'burnley', name: 'Burnley', stars: 4, league: 'Premier League' },
  { id: 'sunderland', name: 'Sunderland', stars: 4, league: 'Premier League' },
  // Premier League — newly added defaults
  { id: 'ipswich-town', name: 'Ipswich Town', stars: 3.5, league: 'Premier League', defaultAdded: true },
  { id: 'leicester', name: 'Leicester City', stars: 3.5, league: 'Premier League', defaultAdded: true },
  { id: 'southampton', name: 'Southampton', stars: 3.5, league: 'Premier League', defaultAdded: true },

  // 🇪🇸 La Liga (Spain)
  { id: 'real-madrid', name: 'Real Madrid', stars: 5, league: 'La Liga' },
  { id: 'barcelona', name: 'FC Barcelona', stars: 5, league: 'La Liga' },
  { id: 'atletico-madrid', name: 'Atlético Madrid', stars: 4.5, league: 'La Liga' },
  { id: 'athletic-bilbao', name: 'Athletic Bilbao', stars: 4.5, league: 'La Liga' },
  { id: 'real-betis', name: 'Real Betis', stars: 4.5, league: 'La Liga' },
  { id: 'villarreal', name: 'Villarreal CF', stars: 4.5, league: 'La Liga' },
  { id: 'real-sociedad', name: 'Real Sociedad', stars: 4, league: 'La Liga' },
  { id: 'girona', name: 'Girona', stars: 4, league: 'La Liga' },
  { id: 'valencia', name: 'Valencia', stars: 4, league: 'La Liga' },
  { id: 'sevilla', name: 'Sevilla FC', stars: 4, league: 'La Liga' },
  { id: 'osasuna', name: 'Osasuna', stars: 4, league: 'La Liga' },
  { id: 'celta-vigo', name: 'Celta Vigo', stars: 4, league: 'La Liga' },
  { id: 'getafe', name: 'Getafe', stars: 4, league: 'La Liga' },
  { id: 'rayo-vallecano', name: 'Rayo Vallecano', stars: 4, league: 'La Liga' },
  { id: 'espanyol', name: 'Espanyol', stars: 4, league: 'La Liga' },
  { id: 'mallorca', name: 'RCD Mallorca', stars: 4, league: 'La Liga' },
  // La Liga — newly added defaults
  { id: 'deportivo-alaves', name: 'Deportivo Alavés', stars: 3.5, league: 'La Liga', defaultAdded: true },
  { id: 'elche', name: 'Elche CF', stars: 3.5, league: 'La Liga', defaultAdded: true },
  { id: 'levante', name: 'Levante UD', stars: 3.5, league: 'La Liga', defaultAdded: true },
  { id: 'real-oviedo', name: 'Real Oviedo', stars: 3.5, league: 'La Liga', defaultAdded: true },
  { id: 'real-valladolid', name: 'Real Valladolid', stars: 3.5, league: 'La Liga', defaultAdded: true },
  { id: 'las-palmas', name: 'UD Las Palmas', stars: 3.5, league: 'La Liga', defaultAdded: true },
  { id: 'leganes', name: 'CD Leganés', stars: 3.5, league: 'La Liga', defaultAdded: true },

  // 🇩🇪 Bundesliga (Germany)
  { id: 'bayern-munich', name: 'FC Bayern München', stars: 5, league: 'Bundesliga' },
  { id: 'bayer-leverkusen', name: 'Bayer 04 Leverkusen', stars: 4, league: 'Bundesliga' },
  { id: 'borussia-dortmund', name: 'Borussia Dortmund', stars: 4.5, league: 'Bundesliga' },
  { id: 'rb-leipzig', name: 'RB Leipzig', stars: 4.5, league: 'Bundesliga' },
  { id: 'union-berlin', name: 'Union Berlin', stars: 4, league: 'Bundesliga' },
  { id: 'eintracht', name: 'Eintracht Frankfurt', stars: 4, league: 'Bundesliga' },
  { id: 'stuttgart', name: 'VfB Stuttgart', stars: 4.5, league: 'Bundesliga' },
  { id: 'wolfsburg', name: 'VfL Wolfsburg', stars: 4, league: 'Bundesliga' },
  { id: 'gladbach', name: 'Borussia Mönchengladbach', stars: 4, league: 'Bundesliga' },
  { id: 'freiburg', name: 'SC Freiburg', stars: 4, league: 'Bundesliga' },
  { id: 'werder-bremen', name: 'Werder Bremen', stars: 4, league: 'Bundesliga' },
  { id: 'mainz', name: 'Mainz', stars: 4, league: 'Bundesliga' },
  { id: 'hoffenheim', name: 'TSG Hoffenheim', stars: 4, league: 'Bundesliga' },
  // Bundesliga — newly added defaults
  { id: 'augsburg', name: 'FC Augsburg', stars: 3.5, league: 'Bundesliga', defaultAdded: true },
  { id: 'st-pauli', name: 'FC St. Pauli', stars: 3.5, league: 'Bundesliga', defaultAdded: true },
  { id: 'hamburger-sv', name: 'Hamburger SV', stars: 3.5, league: 'Bundesliga', defaultAdded: true },
  { id: 'heidenheim', name: '1. FC Heidenheim', stars: 3.5, league: 'Bundesliga', defaultAdded: true },
  { id: 'bochum', name: 'VfL Bochum', stars: 3.5, league: 'Bundesliga', defaultAdded: true },
  { id: 'darmstadt', name: 'SV Darmstadt 98', stars: 3.5, league: 'Bundesliga', defaultAdded: true },
  { id: 'koln', name: '1. FC Köln', stars: 3.5, league: 'Bundesliga', defaultAdded: true },
  { id: 'hertha-bsc', name: 'Hertha BSC', stars: 3.5, league: 'Bundesliga', defaultAdded: true },
  { id: 'schalke', name: 'FC Schalke 04', stars: 3.5, league: 'Bundesliga', defaultAdded: true },

  // 🇮🇹 Serie A (Italy)
  { id: 'inter', name: 'Inter', stars: 5, league: 'Serie A' },
  { id: 'juventus', name: 'Juventus', stars: 4.5, league: 'Serie A' },
  { id: 'ac-milan', name: 'AC Milan', stars: 4.5, league: 'Serie A' },
  { id: 'napoli', name: 'Napoli', stars: 4.5, league: 'Serie A' },
  { id: 'roma', name: 'AS Roma', stars: 4.5, league: 'Serie A' },
  { id: 'atalanta', name: 'Atalanta', stars: 4.5, league: 'Serie A' },
  { id: 'lazio', name: 'Lazio', stars: 4, league: 'Serie A' },
  { id: 'fiorentina', name: 'Fiorentina', stars: 4, league: 'Serie A' },
  { id: 'bologna', name: 'Bologna', stars: 4, league: 'Serie A' },
  { id: 'torino', name: 'Torino', stars: 4, league: 'Serie A' },
  { id: 'como', name: 'Como', stars: 4, league: 'Serie A' },
  // Serie A — newly added defaults
  { id: 'cagliari', name: 'Cagliari', stars: 3.5, league: 'Serie A', defaultAdded: true },
  { id: 'genoa', name: 'Genoa', stars: 3.5, league: 'Serie A', defaultAdded: true },
  { id: 'hellas-verona', name: 'Hellas Verona', stars: 3.5, league: 'Serie A', defaultAdded: true },
  { id: 'lecce', name: 'Lecce', stars: 3.5, league: 'Serie A', defaultAdded: true },
  { id: 'parma', name: 'Parma', stars: 3.5, league: 'Serie A', defaultAdded: true },
  { id: 'sassuolo', name: 'Sassuolo', stars: 3.5, league: 'Serie A', defaultAdded: true },
  { id: 'udinese', name: 'Udinese', stars: 3.5, league: 'Serie A', defaultAdded: true },
  { id: 'monza', name: 'Monza', stars: 3.5, league: 'Serie A', defaultAdded: true },
  { id: 'empoli', name: 'Empoli', stars: 3.5, league: 'Serie A', defaultAdded: true },
  { id: 'cremonese', name: 'Cremonese', stars: 3.5, league: 'Serie A', defaultAdded: true },
  { id: 'salernitana', name: 'Salernitana', stars: 3.5, league: 'Serie A', defaultAdded: true },
  { id: 'venezia', name: 'Venezia', stars: 3.5, league: 'Serie A', defaultAdded: true },

  // 🇫🇷 Ligue 1 (France)
  { id: 'psg', name: 'Paris Saint-Germain', stars: 5, league: 'Ligue 1' },
  { id: 'marseille', name: 'Olympique de Marseille', stars: 4.5, league: 'Ligue 1' },
  { id: 'lyon', name: 'Olympique Lyonnais', stars: 4, league: 'Ligue 1' },
  { id: 'monaco', name: 'AS Monaco', stars: 4, league: 'Ligue 1' },
  { id: 'lille', name: 'LOSC Lille', stars: 4, league: 'Ligue 1' },
  { id: 'reims', name: 'Stade de Reims', stars: 4, league: 'Ligue 1' },
  { id: 'lens', name: 'Lens', stars: 4, league: 'Ligue 1' },
  { id: 'nice', name: 'OGC Nice', stars: 4, league: 'Ligue 1' },
  { id: 'strasbourg', name: 'RC Strasbourg', stars: 4, league: 'Ligue 1' },
  // Ligue 1 — newly added defaults
  { id: 'auxerre', name: 'AJ Auxerre', stars: 3.5, league: 'Ligue 1', defaultAdded: true },
  { id: 'angers', name: 'Angers SCO', stars: 3.5, league: 'Ligue 1', defaultAdded: true },
  { id: 'brest', name: 'Stade Brestois 29', stars: 3.5, league: 'Ligue 1', defaultAdded: true },
  { id: 'le-havre', name: 'Le Havre AC', stars: 3.5, league: 'Ligue 1', defaultAdded: true },
  { id: 'montpellier', name: 'Montpellier HSC', stars: 3.5, league: 'Ligue 1', defaultAdded: true },
  { id: 'nantes', name: 'FC Nantes', stars: 3.5, league: 'Ligue 1', defaultAdded: true },
  { id: 'rennes', name: 'Stade Rennais FC', stars: 3.5, league: 'Ligue 1', defaultAdded: true },
  { id: 'toulouse', name: 'Toulouse FC', stars: 3.5, league: 'Ligue 1', defaultAdded: true },
  { id: 'saint-etienne', name: 'AS Saint-Étienne', stars: 3.5, league: 'Ligue 1', defaultAdded: true },
  { id: 'lorient', name: 'FC Lorient', stars: 3.5, league: 'Ligue 1', defaultAdded: true },
  { id: 'metz', name: 'FC Metz', stars: 3.5, league: 'Ligue 1', defaultAdded: true },
  { id: 'paris-fc', name: 'Paris FC', stars: 3.5, league: 'Ligue 1', defaultAdded: true },

  // 🌍 Rest of World
  { id: 'sporting-cp', name: 'Sporting CP', stars: 4.5, league: 'Portugal' },
  { id: 'fenerbahce', name: 'Fenerbahçe', stars: 4.5, league: 'Turkey' },
  { id: 'galatasaray', name: 'Galatasaray', stars: 4.5, league: 'Turkey' },
  { id: 'benfica', name: 'SL Benfica', stars: 4, league: 'Portugal' },
  { id: 'ajax', name: 'Ajax', stars: 4, league: 'Netherlands' },
  { id: 'porto', name: 'FC Porto', stars: 4, league: 'Portugal' },
  { id: 'braga', name: 'SC Braga', stars: 3.5, league: 'Portugal' },
  { id: 'psv-eindhoven', name: 'PSV Eindhoven', stars: 4, league: 'Netherlands' },
  { id: 'feyenoord', name: 'Feyenoord', stars: 4, league: 'Netherlands' },
  { id: 'besiktas', name: 'Beşiktaş', stars: 4, league: 'Turkey' },
  { id: 'al-ittihad', name: 'Al Ittihad', stars: 4, league: 'Saudi Arabia' },
  { id: 'al-ahli', name: 'Al Ahli', stars: 4, league: 'Saudi Arabia' },
  { id: 'al-nassr', name: 'Al Nassr', stars: 4, league: 'Saudi Arabia' },
  { id: 'al-hilal', name: 'Al Hilal', stars: 4, league: 'Saudi Arabia' },
  { id: 'al-qadsiah', name: 'Al Qadsiah', stars: 4, league: 'Saudi Arabia' },
  { id: 'boca-juniors', name: 'Boca Juniors', stars: 4, league: 'Argentina' },
  { id: 'slavia-praha', name: 'Slavia Praha', stars: 4, league: 'Czech Republic' },
  { id: 'olympiacos', name: 'Olympiacos', stars: 4, league: 'Greece' },
  { id: 'aek-athens', name: 'AEK Athens', stars: 4, league: 'Greece' },
  { id: 'celtic', name: 'Celtic', stars: 4, league: 'Scotland' },
  { id: 'club-brugge', name: 'Club Brugge', stars: 4, league: 'Belgium' },

  // Portugal — newly added defaults
  { id: 'vitoria-sc', name: 'Vitória SC', stars: 3.5, league: 'Portugal', defaultAdded: true },
  { id: 'boavista', name: 'Boavista FC', stars: 3.5, league: 'Portugal', defaultAdded: true },
  { id: 'casa-pia', name: 'Casa Pia AC', stars: 3.5, league: 'Portugal', defaultAdded: true },
  { id: 'famalicao', name: 'FC Famalicão', stars: 3.5, league: 'Portugal', defaultAdded: true },
  { id: 'rio-ave', name: 'Rio Ave FC', stars: 3.5, league: 'Portugal', defaultAdded: true },
  { id: 'arouca', name: 'FC Arouca', stars: 3.5, league: 'Portugal', defaultAdded: true },
  { id: 'estoril', name: 'Estoril Praia', stars: 3.5, league: 'Portugal', defaultAdded: true },
  { id: 'estrela-amadora', name: 'Estrela Amadora', stars: 3.5, league: 'Portugal', defaultAdded: true },
  { id: 'moreirense', name: 'Moreirense FC', stars: 3.5, league: 'Portugal', defaultAdded: true },
  { id: 'nacional', name: 'CD Nacional', stars: 3.5, league: 'Portugal', defaultAdded: true },
  { id: 'santa-clara', name: 'Santa Clara', stars: 3.5, league: 'Portugal', defaultAdded: true },
  { id: 'gil-vicente', name: 'Gil Vicente FC', stars: 3.5, league: 'Portugal', defaultAdded: true },

  // Turkey — newly added defaults
  { id: 'trabzonspor', name: 'Trabzonspor', stars: 3.5, league: 'Turkey', defaultAdded: true },
  { id: 'basaksehir', name: 'İstanbul Başakşehir', stars: 3.5, league: 'Turkey', defaultAdded: true },
  { id: 'adana-demirspor', name: 'Adana Demirspor', stars: 3.5, league: 'Turkey', defaultAdded: true },
  { id: 'antalyaspor', name: 'Antalyaspor', stars: 3.5, league: 'Turkey', defaultAdded: true },
  { id: 'kayserispor', name: 'Kayserispor', stars: 3.5, league: 'Turkey', defaultAdded: true },
  { id: 'konyaspor', name: 'Konyaspor', stars: 3.5, league: 'Turkey', defaultAdded: true },
  { id: 'sivasspor', name: 'Sivasspor', stars: 3.5, league: 'Turkey', defaultAdded: true },
  { id: 'kasimpasa', name: 'Kasımpaşa', stars: 3.5, league: 'Turkey', defaultAdded: true },
  { id: 'alanyaspor', name: 'Alanyaspor', stars: 3.5, league: 'Turkey', defaultAdded: true },
  { id: 'rizespor', name: 'Çaykur Rizespor', stars: 3.5, league: 'Turkey', defaultAdded: true },
  { id: 'gaziantep', name: 'Gaziantep FK', stars: 3.5, league: 'Turkey', defaultAdded: true },
  { id: 'hatayspor', name: 'Hatayspor', stars: 3.5, league: 'Turkey', defaultAdded: true },

  // Netherlands — newly added defaults
  { id: 'az-alkmaar', name: 'AZ Alkmaar', stars: 3.5, league: 'Netherlands', defaultAdded: true },
  { id: 'fc-twente', name: 'FC Twente', stars: 3.5, league: 'Netherlands', defaultAdded: true },
  { id: 'fc-utrecht', name: 'FC Utrecht', stars: 3.5, league: 'Netherlands', defaultAdded: true },
  { id: 'vitesse', name: 'Vitesse', stars: 3.5, league: 'Netherlands', defaultAdded: true },
  { id: 'sc-heerenveen', name: 'SC Heerenveen', stars: 3.5, league: 'Netherlands', defaultAdded: true },
  { id: 'fc-groningen', name: 'FC Groningen', stars: 3.5, league: 'Netherlands', defaultAdded: true },
  { id: 'nec-nijmegen', name: 'NEC Nijmegen', stars: 3.5, league: 'Netherlands', defaultAdded: true },
  { id: 'go-ahead-eagles', name: 'Go Ahead Eagles', stars: 3.5, league: 'Netherlands', defaultAdded: true },
  { id: 'sparta-rotterdam', name: 'Sparta Rotterdam', stars: 3.5, league: 'Netherlands', defaultAdded: true },
  { id: 'fortuna-sittard', name: 'Fortuna Sittard', stars: 3.5, league: 'Netherlands', defaultAdded: true },
  { id: 'rkc-waalwijk', name: 'RKC Waalwijk', stars: 3.5, league: 'Netherlands', defaultAdded: true },
  { id: 'heracles', name: 'Heracles Almelo', stars: 3.5, league: 'Netherlands', defaultAdded: true },

  // Saudi Arabia — newly added defaults
  { id: 'al-shabab', name: 'Al Shabab', stars: 3.5, league: 'Saudi Arabia', defaultAdded: true },
  { id: 'al-ettifaq', name: 'Al Ettifaq', stars: 3.5, league: 'Saudi Arabia', defaultAdded: true },
  { id: 'al-fateh', name: 'Al Fateh', stars: 3.5, league: 'Saudi Arabia', defaultAdded: true },
  { id: 'al-taawoun', name: 'Al Taawoun', stars: 3.5, league: 'Saudi Arabia', defaultAdded: true },
  { id: 'al-raed', name: 'Al Raed', stars: 3.5, league: 'Saudi Arabia', defaultAdded: true },
  { id: 'damac', name: 'Damac FC', stars: 3.5, league: 'Saudi Arabia', defaultAdded: true },
  { id: 'al-fayha', name: 'Al Fayha', stars: 3.5, league: 'Saudi Arabia', defaultAdded: true },
  { id: 'al-khaleej', name: 'Al Khaleej', stars: 3.5, league: 'Saudi Arabia', defaultAdded: true },

  // Argentina — newly added defaults
  { id: 'river-plate', name: 'River Plate', stars: 3.5, league: 'Argentina', defaultAdded: true },
  { id: 'racing-club', name: 'Racing Club', stars: 3.5, league: 'Argentina', defaultAdded: true },
  { id: 'san-lorenzo', name: 'San Lorenzo', stars: 3.5, league: 'Argentina', defaultAdded: true },
  { id: 'independiente', name: 'Independiente', stars: 3.5, league: 'Argentina', defaultAdded: true },
  { id: 'estudiantes', name: 'Estudiantes', stars: 3.5, league: 'Argentina', defaultAdded: true },
  { id: 'velez-sarsfield', name: 'Vélez Sársfield', stars: 3.5, league: 'Argentina', defaultAdded: true },
  { id: 'rosario-central', name: 'Rosario Central', stars: 3.5, league: 'Argentina', defaultAdded: true },
  { id: 'newells-old-boys', name: "Newell's Old Boys", stars: 3.5, league: 'Argentina', defaultAdded: true },
  { id: 'talleres', name: 'Talleres', stars: 3.5, league: 'Argentina', defaultAdded: true },
  { id: 'lanus', name: 'Lanús', stars: 3.5, league: 'Argentina', defaultAdded: true },
  { id: 'argentinos-juniors', name: 'Argentinos Juniors', stars: 3.5, league: 'Argentina', defaultAdded: true },

  // Czech Republic — newly added defaults
  { id: 'sparta-praha', name: 'Sparta Praha', stars: 3.5, league: 'Czech Republic', defaultAdded: true },
  { id: 'viktoria-plzen', name: 'Viktoria Plzeň', stars: 3.5, league: 'Czech Republic', defaultAdded: true },
  { id: 'banik-ostrava', name: 'Baník Ostrava', stars: 3.5, league: 'Czech Republic', defaultAdded: true },
  { id: 'bohemians-1905', name: 'Bohemians 1905', stars: 3.5, league: 'Czech Republic', defaultAdded: true },
  { id: 'sigma-olomouc', name: 'Sigma Olomouc', stars: 3.5, league: 'Czech Republic', defaultAdded: true },

  // Greece — newly added defaults
  { id: 'paok', name: 'PAOK', stars: 3.5, league: 'Greece', defaultAdded: true },
  { id: 'panathinaikos', name: 'Panathinaikos', stars: 3.5, league: 'Greece', defaultAdded: true },
  { id: 'aris-thessaloniki', name: 'Aris Thessaloniki', stars: 3.5, league: 'Greece', defaultAdded: true },
  { id: 'atromitos', name: 'Atromitos', stars: 3.5, league: 'Greece', defaultAdded: true },

  // Scotland — newly added defaults
  { id: 'rangers', name: 'Rangers', stars: 3.5, league: 'Scotland', defaultAdded: true },
  { id: 'aberdeen', name: 'Aberdeen', stars: 3.5, league: 'Scotland', defaultAdded: true },
  { id: 'hearts', name: 'Heart of Midlothian', stars: 3.5, league: 'Scotland', defaultAdded: true },
  { id: 'hibernian', name: 'Hibernian', stars: 3.5, league: 'Scotland', defaultAdded: true },
  { id: 'dundee-united', name: 'Dundee United', stars: 3.5, league: 'Scotland', defaultAdded: true },
  { id: 'motherwell', name: 'Motherwell', stars: 3.5, league: 'Scotland', defaultAdded: true },
  { id: 'kilmarnock', name: 'Kilmarnock', stars: 3.5, league: 'Scotland', defaultAdded: true },

  // Belgium — newly added defaults
  { id: 'anderlecht', name: 'RSC Anderlecht', stars: 3.5, league: 'Belgium', defaultAdded: true },
  { id: 'standard-liege', name: 'Standard Liège', stars: 3.5, league: 'Belgium', defaultAdded: true },
  { id: 'krc-genk', name: 'KRC Genk', stars: 3.5, league: 'Belgium', defaultAdded: true },
  { id: 'kaa-gent', name: 'KAA Gent', stars: 3.5, league: 'Belgium', defaultAdded: true },
  { id: 'royal-antwerp', name: 'Royal Antwerp FC', stars: 3.5, league: 'Belgium', defaultAdded: true },
  { id: 'union-sg', name: 'Union Saint-Gilloise', stars: 3.5, league: 'Belgium', defaultAdded: true },
  { id: 'cercle-brugge', name: 'Cercle Brugge', stars: 3.5, league: 'Belgium', defaultAdded: true },
  { id: 'oh-leuven', name: 'OH Leuven', stars: 3.5, league: 'Belgium', defaultAdded: true },
  { id: 'kv-mechelen', name: 'KV Mechelen', stars: 3.5, league: 'Belgium', defaultAdded: true },
  { id: 'charleroi', name: 'Sporting Charleroi', stars: 3.5, league: 'Belgium', defaultAdded: true },

    // 🗺️ International (National Teams)
  // worldCup26: true means the national team is playing in World Cup 2026.
  // 5 stars
  { id: 'france', name: 'France', stars: 5, league: 'International', isNational: true, worldCup26: true },
  { id: 'england', name: 'England', stars: 5, league: 'International', isNational: true, worldCup26: true },
  { id: 'spain', name: 'Spain', stars: 5, league: 'International', isNational: true, worldCup26: true },
  { id: 'argentina', name: 'Argentina', stars: 5, league: 'International', isNational: true, worldCup26: true },
  { id: 'germany', name: 'Germany', stars: 5, league: 'International', isNational: true, worldCup26: true },
  { id: 'portugal', name: 'Portugal', stars: 5, league: 'International', isNational: true, worldCup26: true },
  { id: 'brazil', name: 'Brazil', stars: 5, league: 'International', isNational: true, worldCup26: true },
  // 5-star national teams not in WC26
  { id: 'italy', name: 'Italy', stars: 5, league: 'International', isNational: true },

  // 4.5 stars
  { id: 'netherlands', name: 'Netherlands', stars: 4.5, league: 'International', isNational: true, worldCup26: true },
  { id: 'croatia', name: 'Croatia', stars: 4.5, league: 'International', isNational: true, worldCup26: true },
  { id: 'morocco', name: 'Morocco', stars: 4.5, league: 'International', isNational: true, worldCup26: true },
  { id: 'norway', name: 'Norway', stars: 4.5, league: 'International', isNational: true, worldCup26: true },
  { id: 'belgium', name: 'Belgium', stars: 4.5, league: 'International', isNational: true, worldCup26: true },
  { id: 'senegal', name: 'Senegal', stars: 4.5, league: 'International', isNational: true, worldCup26: true },
  { id: 'turkiye', name: 'Türkiye', stars: 4.5, league: 'International', isNational: true, worldCup26: true },
  { id: 'uruguay', name: 'Uruguay', stars: 4.5, league: 'International', isNational: true, worldCup26: true },

  // 4 stars — WC26
  { id: 'czechia', name: 'Czechia', stars: 4, league: 'International', isNational: true, worldCup26: true },
  { id: 'ghana', name: 'Ghana', stars: 4, league: 'International', isNational: true, worldCup26: true },
  { id: 'mexico', name: 'Mexico', stars: 4, league: 'International', isNational: true, worldCup26: true },
  { id: 'scotland', name: 'Scotland', stars: 4, league: 'International', isNational: true, worldCup26: true },
  { id: 'sweden', name: 'Sweden', stars: 4, league: 'International', isNational: true, worldCup26: true },
  { id: 'united-states', name: 'United States', stars: 4, league: 'International', isNational: true, worldCup26: true },
  { id: 'denmark', name: 'Denmark', stars: 4, league: 'International', isNational: true, worldCup26: true },
  { id: 'algeria', name: 'Algeria', stars: 4, league: 'International', isNational: true, worldCup26: true },
  { id: 'austria', name: 'Austria', stars: 4, league: 'International', isNational: true, worldCup26: true },
  { id: 'canada', name: 'Canada', stars: 4, league: 'International', isNational: true, worldCup26: true },
  { id: 'colombia', name: 'Colombia', stars: 4, league: 'International', isNational: true, worldCup26: true },
  { id: 'cote-divoire', name: "Côte d'Ivoire", stars: 4, league: 'International', isNational: true, worldCup26: true },
  { id: 'ecuador', name: 'Ecuador', stars: 4, league: 'International', isNational: true, worldCup26: true },
  { id: 'japan', name: 'Japan', stars: 4, league: 'International', isNational: true, worldCup26: true },
  { id: 'korea-republic', name: 'Korea Republic', stars: 4, league: 'International', isNational: true, worldCup26: true },
  { id: 'paraguay', name: 'Paraguay', stars: 4, league: 'International', isNational: true, worldCup26: true },
  { id: 'switzerland', name: 'Switzerland', stars: 4, league: 'International', isNational: true, worldCup26: true },
  // 4-star national teams not in WC26
  { id: 'poland', name: 'Poland', stars: 4, league: 'International', isNational: true },
  { id: 'ukraine', name: 'Ukraine', stars: 4, league: 'International', isNational: true },
  { id: 'wales', name: 'Wales', stars: 4, league: 'International', isNational: true },

  // 3.5 stars — WC26
  { id: 'australia', name: 'Australia', stars: 3.5, league: 'International', isNational: true, worldCup26: true },
  { id: 'bosnia-herzegovina', name: 'Bosnia and Herzegovina', stars: 3.5, league: 'International', isNational: true, worldCup26: true },
  { id: 'dr-congo', name: 'DR Congo', stars: 3.5, league: 'International', isNational: true, worldCup26: true },
  { id: 'egypt', name: 'Egypt', stars: 3.5, league: 'International', isNational: true, worldCup26: true },
  { id: 'iran', name: 'Iran', stars: 3.5, league: 'International', isNational: true, worldCup26: true },
  { id: 'saudi-arabia-national', name: 'Saudi Arabia', stars: 3.5, league: 'International', isNational: true, worldCup26: true },
  { id: 'tunisia', name: 'Tunisia', stars: 3.5, league: 'International', isNational: true, worldCup26: true },

  // 🏆 Prime Teams
  { id: 'serie-a-xi', name: 'Serie A XI', stars: 5, league: 'Prime', isPrime: true },
  { id: 'soccer-aid', name: 'Soccer Aid', stars: 5, league: 'Prime', isPrime: true },
  { id: 'classic-xi', name: 'Classic XI', stars: 5, league: 'Prime', isPrime: true },
  { id: 'bundesliga-xi', name: 'Bundesliga XI', stars: 5, league: 'Prime', isPrime: true },
  { id: 'chelsea-xi', name: 'Chelsea XI', stars: 5, league: 'Prime', isPrime: true },
  { id: 'bayern-xi', name: 'Bayern XI', stars: 5, league: 'Prime', isPrime: true },
  { id: 'juventus-xi', name: 'Juventus XI', stars: 5, league: 'Prime', isPrime: true },
  { id: 'la-liga-xi', name: 'La Liga XI', stars: 5, league: 'Prime', isPrime: true },
  { id: 'ligue-1-xi', name: 'Ligue 1 XI', stars: 5, league: 'Prime', isPrime: true },
  { id: 'liverpool-xi', name: 'Liverpool XI', stars: 5, league: 'Prime', isPrime: true },
  { id: 'premier-league-xi', name: 'Premier League XI', stars: 5, league: 'Prime', isPrime: true },
];

// Load overrides from database
export async function loadClubOverrides(): Promise<Record<string, number>> {
  const now = Date.now();
  if (clubOverridesCache && now - lastOverridesFetch < OVERRIDES_CACHE_TTL) {
    return clubOverridesCache;
  }

  if (!supabase) return {};

  try {
    const { data, error } = await supabase
      .from('club_overrides')
      .select('club_id, stars, deleted');
    
    if (error) {
      console.error('Error loading club overrides:', error);
      return clubOverridesCache || {};
    }
    
    const map: Record<string, number> = {};
    const deletedSet = new Set<string>();
    (data || []).forEach((row: { club_id: string; stars: number; deleted?: boolean }) => {
      map[row.club_id] = row.stars;
      if (row.deleted) deletedSet.add(row.club_id);
    });
    
    clubOverridesCache = map;
    clubDeletedCache = deletedSet;
    lastOverridesFetch = now;
    return map;
  } catch (e) {
    console.error('Failed to load club overrides:', e);
    return clubOverridesCache || {};
  }
}

// Load deleted club IDs
export async function loadDeletedClubIds(): Promise<Set<string>> {
  await loadClubOverrides(); // ensures cache is populated
  return clubDeletedCache || new Set();
}

// Get clubs with database overrides applied (excludes deleted)
export async function getClubsWithOverrides(): Promise<Club[]> {
  const overrides = await loadClubOverrides();
  const deleted = clubDeletedCache || new Set();
  return FIFA_CLUBS
    .filter(club => !deleted.has(club.id))
    .map(club => ({
      ...club,
      stars: overrides[club.id] ?? club.stars
    }));
}

// Invalidate cache (call after saving overrides)
export function invalidateClubOverridesCache() {
  clubOverridesCache = null;
  clubDeletedCache = null;
  lastOverridesFetch = 0;
}

export const getClubsByStars = (stars: number, clubs: Club[] = FIFA_CLUBS): Club[] => {
  return clubs.filter(club => club.stars === stars);
};

export const getNationalTeams = (clubs: Club[] = FIFA_CLUBS): Club[] => {
  return clubs.filter(club => club.isNational);
};

export const getPrimeTeams = (clubs: Club[] = FIFA_CLUBS): Club[] => {
  return clubs.filter(club => club.league === 'Prime');
};

export const getClubsOnly = (stars?: number, clubs: Club[] = FIFA_CLUBS): Club[] => {
  return clubs.filter(club => !club.isNational && club.league !== 'Prime' && (stars === undefined || club.stars === stars));
};

export const getNationalTeamsByStars = (stars: number, clubs: Club[] = FIFA_CLUBS): Club[] => {
  return clubs.filter(club => club.isNational && club.stars === stars);
};

export const getRandomClub = (excludeIds: string[] = [], minStars?: number, maxStars?: number, clubs: Club[] = FIFA_CLUBS): Club => {
  const baseClubs = clubs.filter(club => !excludeIds.includes(club.id) && !club.isNational);

  const applyRange = (clubList: Club[]) =>
    clubList.filter(club => {
      if (minStars !== undefined && club.stars < minStars) return false;
      if (maxStars !== undefined && club.stars > maxStars) return false;
      return true;
    });

  // Start with range-constrained pool if provided, otherwise base
  let pool = (minStars !== undefined || maxStars !== undefined) ? applyRange(baseClubs) : baseClubs;

  // Strong preference: 4.5+ stars when possible, otherwise 4+, otherwise any
  const top = pool.filter(c => c.stars >= 4.5);
  const high = pool.filter(c => c.stars >= 4);
  if (top.length > 0) {
    pool = top;
  } else if (high.length > 0) {
    pool = high;
  }

  // If constraints emptied the pool, fall back with the same preference
  if (pool.length === 0) {
    const baseTop = baseClubs.filter(c => c.stars >= 4.5);
    const baseHigh = baseClubs.filter(c => c.stars >= 4);
    pool = baseTop.length ? baseTop : (baseHigh.length ? baseHigh : baseClubs);
  }

  return pool[Math.floor(Math.random() * pool.length)];
};
