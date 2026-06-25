import { useState } from "react";
import { ArrowLeft, Play, Users, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Player } from "@/types/tournament";
import { FPTeamSelectionMode, FPWorldCupComposition } from "@/types/fivePlayerTypes";
import { useToast } from "@/hooks/use-toast";

const WORLD_CUP_BUCKETS = [
  { key: '5', label: '5 כוכבים לכל זוג' },
  { key: '4.5', label: '4.5 כוכבים לכל זוג' },
  { key: '4', label: '4 כוכבים לכל זוג' },
  { key: '3.5', label: '3.5 כוכבים לכל זוג' },
  { key: '3', label: '3 כוכבים לכל זוג' },
] as const;

const defaultWorldCupComposition = (matchCount: 15 | 30): FPWorldCupComposition =>
  matchCount === 30
    ? { '5': 2, '4.5': 2, '4': 2, '3.5': 0, '3': 0 }
    : { '5': 1, '4.5': 1, '4': 1, '3.5': 0, '3': 0 };

interface FPSetupProps {
  onBack: () => void;
  onStart: (
    players: Player[],
    matchCount: 15 | 30,
    setupOptions?: {
      firstSittingOutPlayerId?: string;
      teamName?: string;
      createNewTeam?: boolean;
      teamSelectionMode?: FPTeamSelectionMode;
      worldCupComposition?: FPWorldCupComposition;
    }
  ) => void;
  savedPlayers?: Player[];
  /** Team players to pre-fill when starting within a team context */
  teamPlayers?: Player[];
  teamId?: string | null;
  teamName?: string | null;
  isStarting?: boolean;
  hasActiveTournament?: boolean;
  activeTournamentLabel?: string | null;
  activeTournamentIsSameMode?: boolean;
  onOpenActiveTournament?: () => void;
}

export const FPSetup = ({
  onBack,
  onStart,
  savedPlayers,
  teamPlayers,
  teamId,
  teamName,
  isStarting = false,
  hasActiveTournament = false,
  activeTournamentLabel,
  activeTournamentIsSameMode = false,
  onOpenActiveTournament,
}: FPSetupProps) => {
  const { toast } = useToast();
  const hasTeamPlayers = teamPlayers && teamPlayers.length === 5;
  const [players, setPlayers] = useState<Player[]>(
    hasTeamPlayers
      ? teamPlayers
      : savedPlayers && savedPlayers.length === 5
        ? savedPlayers
        : Array.from({ length: 5 }, (_, i) => ({ id: `player-${Date.now()}-${i}`, name: '' }))
  );
  
  const [matchCount, setMatchCount] = useState<15 | 30>(30);
  const [firstSittingOutPlayerId, setFirstSittingOutPlayerId] = useState<string>('');
  const [groupName, setGroupName] = useState('');
  const [teamSelectionMode, setTeamSelectionMode] = useState<FPTeamSelectionMode>('default');
  const [showWorldCupConfig, setShowWorldCupConfig] = useState(false);
  const [worldCupComposition, setWorldCupComposition] = useState<FPWorldCupComposition>(
    defaultWorldCupComposition(30)
  );
  const [showPlayerEditor, setShowPlayerEditor] = useState<boolean>(
    !(hasTeamPlayers || savedPlayers?.length === 5)
  );

  const updateName = (index: number, name: string) => {
    const updated = [...players];
    updated[index] = { ...updated[index], name };
    setPlayers(updated);
  };

  const allFilled = players.every(p => p.name.trim().length > 0);
  const hasDuplicates = new Set(players.map(p => p.name.trim().toLowerCase())).size < 5;
  const requiredWorldCupTeamsPerPair = matchCount / 5;
  const worldCupCompositionSum = WORLD_CUP_BUCKETS.reduce(
    (sum, bucket) => sum + worldCupComposition[bucket.key],
    0
  );

  const adjustWorldCupBucket = (key: keyof FPWorldCupComposition, delta: number) => {
    setWorldCupComposition(prev => ({
      ...prev,
      [key]: Math.max(0, prev[key] + delta),
    }));
  };

  const updateMatchCount = (next: 15 | 30) => {
    setMatchCount(next);
    setWorldCupComposition(defaultWorldCupComposition(next));
  };

  const handleStart = () => {
    if (isStarting) return;

    if (!allFilled) {
      toast({ title: "יש למלא את כל השמות", variant: "destructive" });
      return;
    }
  
    if (hasDuplicates) {
      toast({ title: "שמות השחקנים חייבים להיות ייחודיים", variant: "destructive" });
      return;
    }
  
    const cleaned = players.map(p => ({ ...p, name: p.name.trim() }));
  
    const selectedPlayer = firstSittingOutPlayerId
      ? cleaned.find(p => p.id === firstSittingOutPlayerId)
      : cleaned[Math.floor(Math.random() * cleaned.length)];
  
    const remainingPlayers = cleaned.filter(p => p.id !== selectedPlayer?.id);
  
    if (!selectedPlayer || remainingPlayers.length !== 4) {
      toast({ title: "בחירת השחקן שיושב בחוץ אינה תקינה", variant: "destructive" });
      return;
    }
  
    const setupOptions: {
      firstSittingOutPlayerId?: string;
      teamName?: string;
      createNewTeam?: boolean;
      teamSelectionMode?: FPTeamSelectionMode;
      worldCupComposition?: FPWorldCupComposition;
    } = {};

    if (firstSittingOutPlayerId) {
      setupOptions.firstSittingOutPlayerId = firstSittingOutPlayerId;
    }
    
    if (!teamId) {
      if (!groupName.trim()) {
        toast({
          title: "יש להזין שם לקבוצה החדשה",
          variant: "destructive",
        });
        return;
      }
    
      setupOptions.teamName = groupName.trim();
      setupOptions.createNewTeam = true;
    }

    if (teamSelectionMode === 'world-cup-26') {
      if (matchCount % 5 !== 0) {
        toast({
          title: "מספר המשחקים במונדיאל 26 חייב להתחלק ב־5",
          variant: "destructive",
        });
        return;
      }

      if (worldCupCompositionSum !== requiredWorldCupTeamsPerPair) {
        toast({
          title: `הרכב הקבוצות חייב להסתכם ל־${requiredWorldCupTeamsPerPair} קבוצות לכל זוג לפי מספר המשחקים שנבחר.`,
          variant: "destructive",
        });
        return;
      }

      setupOptions.teamSelectionMode = 'world-cup-26';
      setupOptions.worldCupComposition = worldCupComposition;
    }
    
    onStart(
      [selectedPlayer, ...remainingPlayers],
      matchCount,
      Object.keys(setupOptions).length > 0 ? setupOptions : undefined
    );
  };

  // New / manual entry
  return (
    <div className="min-h-[100svh] bg-gaming-bg flex flex-col p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]" dir="rtl">
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5 rotate-180" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-foreground">ליגת זוגות (5 שחקנים)</h1>
        
          {teamId && teamName && (
            <p className="text-xs text-neon-green">
              קבוצה קיימת: {teamName}
            </p>
          )}
        
          {!teamId && (
            <p className="text-xs text-neon-green">
              יצירת קבוצה חדשה
            </p>
          )}
        
          <p className="text-xs text-muted-foreground">
            {matchCount === 15 ? '3 סיבובים • 15 משחקים • 3 קבוצות לזוג' : '6 סיבובים • 30 משחקים • 6 קבוצות לזוג'}
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-full max-w-md space-y-4">
          <Card className="bg-gradient-card border-neon-green/20 p-4 shadow-card">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-neon-green" />
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    שחקני הליגה
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {players.filter(p => p.name.trim()).length}/5 שחקנים
                  </p>
                </div>
              </div>
          
              <Button
                variant="outline"
                size="sm"
                className="border-neon-green/30 text-xs"
                onClick={() => setShowPlayerEditor(prev => !prev)}
              >
                <Edit2 className="h-3.5 w-3.5" />
                {showPlayerEditor ? 'סגור' : 'ערוך'}
              </Button>
            </div>
          
            {!showPlayerEditor && (
              <div className="flex flex-wrap gap-2">
                {players.map((player, idx) => (
                  <span
                    key={player.id}
                    className="rounded-full border border-border bg-gaming-surface px-3 py-1 text-xs text-foreground"
                  >
                    {player.name.trim() || `שחקן ${idx + 1}`}
                  </span>
                ))}
              </div>
            )}
          
            {showPlayerEditor && (
              <div className="space-y-2">
                {players.map((player, idx) => (
                  <Input
                    key={player.id}
                    placeholder={`שחקן ${idx + 1}`}
                    value={player.name}
                    onChange={e => updateName(idx, e.target.value)}
                    className="bg-gaming-surface border-border text-right h-10"
                  />
                ))}
              </div>
            )}
          </Card>

          <Card className="bg-gaming-surface/50 border-border/50 p-3">
            <div className="space-y-3">
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">
                  כמה משחקים בליגה?
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  ניתן לבחור ליגה קצרה או מלאה
                </p>
              </div>
          
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => updateMatchCount(15)}
                  className={`rounded-lg border p-3 text-center transition-all ${
                    matchCount === 15
                      ? 'border-neon-green bg-neon-green/10 text-neon-green'
                      : 'border-border bg-gaming-surface text-muted-foreground hover:border-muted-foreground/40'
                  }`}
                >
                  <p className="text-sm font-bold">15 משחקים</p>
                  <p className="text-xs mt-1">3 סיבובים</p>
                </button>
          
                <button
                  type="button"
                  onClick={() => updateMatchCount(30)}
                  className={`rounded-lg border p-3 text-center transition-all ${
                    matchCount === 30
                      ? 'border-neon-green bg-neon-green/10 text-neon-green'
                      : 'border-border bg-gaming-surface text-muted-foreground hover:border-muted-foreground/40'
                  }`}
                >
                  <p className="text-sm font-bold">30 משחקים</p>
                  <p className="text-xs mt-1">6 סיבובים</p>
                </button>
              </div>
            </div>
          </Card>

          <Card className="bg-gaming-surface/50 border-border/50 p-3">
            <div className="space-y-3">
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">
                  בחירת מאגר קבוצות
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  ברירת המחדל נשארת כמו היום
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTeamSelectionMode('default')}
                  className={`rounded-lg border p-2 text-center text-sm transition-all ${
                    teamSelectionMode === 'default'
                      ? 'border-neon-green bg-neon-green/10 text-neon-green'
                      : 'border-border bg-gaming-surface text-muted-foreground hover:border-muted-foreground/40'
                  }`}
                >
                  רגיל
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTeamSelectionMode('world-cup-26');
                    setShowWorldCupConfig(true);
                  }}
                  className={`rounded-lg border p-2 text-center text-sm transition-all ${
                    teamSelectionMode === 'world-cup-26'
                      ? 'border-neon-green bg-neon-green/10 text-neon-green'
                      : 'border-border bg-gaming-surface text-muted-foreground hover:border-muted-foreground/40'
                  }`}
                >
                  מונדיאל 26
                </button>
              </div>

              {teamSelectionMode === 'world-cup-26' && (
                <div className="space-y-3 rounded-lg border border-neon-green/20 bg-gaming-bg/40 p-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setShowWorldCupConfig(prev => !prev)}
                  >
                    הרכב קבוצות מונדיאל
                  </Button>

                  {showWorldCupConfig && (
                    <div className="space-y-2">
                      {WORLD_CUP_BUCKETS.map(bucket => (
                        <div key={bucket.key} className="flex items-center justify-between gap-3">
                          <label className="text-xs text-foreground flex-1 text-right">
                            {bucket.label}
                          </label>
                          <div className="flex items-center gap-2" aria-label={bucket.label}>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => adjustWorldCupBucket(bucket.key, -1)}
                              disabled={worldCupComposition[bucket.key] <= 0}
                              aria-label={`הפחת ${bucket.label}`}
                            >
                              -
                            </Button>
                            <span className="min-w-8 text-center text-sm font-semibold text-foreground">
                              {worldCupComposition[bucket.key]}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => adjustWorldCupBucket(bucket.key, 1)}
                              aria-label={`הוסף ${bucket.label}`}
                            >
                              +
                            </Button>
                          </div>
                        </div>
                      ))}

                      <p className={`text-xs text-center ${
                        worldCupCompositionSum === requiredWorldCupTeamsPerPair
                          ? 'text-neon-green'
                          : 'text-destructive'
                      }`}>
                        סה״כ: {worldCupCompositionSum}/{requiredWorldCupTeamsPerPair} קבוצות לכל זוג
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Optional first sitting out selection */}
          <Card className="bg-gaming-surface/50 border-border/50 p-3">
            <div className="space-y-3">
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">
                  מי יישב בחוץ ראשון?
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  ברירת מחדל: בחירה רנדומלית של המערכת
                </p>
              </div>
          
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFirstSittingOutPlayerId('')}
                  className={`rounded-lg border p-2 text-center text-sm transition-all ${
                    !firstSittingOutPlayerId
                      ? 'border-neon-green bg-neon-green/10 text-neon-green'
                      : 'border-border bg-gaming-surface text-muted-foreground hover:border-muted-foreground/40'
                  }`}
                >
                  רנדומלי
                </button>
          
                {players.map((player, idx) => {
                  const name = player.name.trim() || `שחקן ${idx + 1}`;
                  const selected = firstSittingOutPlayerId === player.id;
          
                  return (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() => setFirstSittingOutPlayerId(player.id)}
                      className={`rounded-lg border p-2 text-center text-sm transition-all ${
                        selected
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border bg-gaming-surface text-muted-foreground hover:border-muted-foreground/40'
                      }`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>

          {!teamId && (
            <Card className="bg-gaming-surface/50 border-border/50 p-4">
              <p className="text-sm font-semibold text-foreground mb-2 text-right">
                שם הקבוצה החדשה
              </p>
              <Input
                placeholder="לדוגמה: epsilons"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                className="bg-gaming-surface border-border text-right"
              />
              <p className="text-xs text-muted-foreground mt-2">
                הקבוצה תישמר ב״הקבוצות שלי״ ותהיה ניתנת לחיפוש.
              </p>
            </Card>
          )}

          <Card className="bg-gaming-surface/50 border-border/50 p-4">
            <div className="text-center space-y-1">
              <p className="text-sm text-muted-foreground">
                <strong className="text-neon-green">10 זוגות</strong> • כל שחקן ב-4 משחקים לסיבוב
              </p>
              <p className="text-xs text-muted-foreground">
                {teamSelectionMode === 'world-cup-26'
                  ? `מונדיאל 26: ${requiredWorldCupTeamsPerPair} קבוצות לכל זוג לפי ההרכב שבחרת`
                  : matchCount === 15
                    ? 'כל זוג מקבל בנק של 3 קבוצות/נבחרות: 1×5★ / 1×4.5★ / 1×4★'
                    : 'כל זוג מקבל בנק של 6 קבוצות/נבחרות: 2×5★ / 2×4.5★ / 2×4★'}
              </p>
            </div>
          </Card>

          {hasActiveTournament && !activeTournamentIsSameMode && (
            <Card className="border-neon-green/30 bg-neon-green/10 p-4 text-center">
              <p className="text-sm font-black text-foreground">לקבוצה יש טורניר פעיל</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {activeTournamentLabel
                  ? `כבר פתוח ${activeTournamentLabel} לקבוצה הזו.`
                  : "כבר פתוח טורניר לקבוצה הזו."}
              </p>
            </Card>
          )}

          <Button
            variant="gaming"
            size="lg"
            className="w-full"
            onClick={
              hasActiveTournament && !activeTournamentIsSameMode && onOpenActiveTournament
                ? onOpenActiveTournament
                : handleStart
            }
            disabled={isStarting || (!hasActiveTournament && (!allFilled || hasDuplicates))}
          >
            <Play className="h-5 w-5" />
            {isStarting
              ? "פותח..."
              : hasActiveTournament
                ? "חזרה לטורניר הפעיל"
                : "התחל ליגה"}
          </Button>
        </div>
      </div>
    </div>
  );
};
