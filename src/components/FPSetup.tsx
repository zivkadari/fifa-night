import { useState } from "react";
import { ArrowLeft, Play, Users, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Player } from "@/types/tournament";
import { useToast } from "@/hooks/use-toast";

interface FPSetupProps {
  onBack: () => void;
  onStart: (
    players: Player[],
    matchCount: 15 | 30,
    setupOptions?: {
      firstSittingOutPlayerId?: string;
      teamName?: string;
      createNewTeam?: boolean;
    }
  ) => void;
  savedPlayers?: Player[];
  /** Team players to pre-fill when starting within a team context */
  teamPlayers?: Player[];
  teamId?: string | null;
  teamName?: string | null;
}

export const FPSetup = ({ onBack, onStart, savedPlayers, teamPlayers, teamId, teamName }: FPSetupProps) => {
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

  const handleStart = () => {
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
                  onClick={() => setMatchCount(15)}
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
                  onClick={() => setMatchCount(30)}
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
                {matchCount === 15
                  ? 'כל זוג מקבל בנק של 3 קבוצות/נבחרות: 1×5★ / 1×4.5★ / 1×4★'
                  : 'כל זוג מקבל בנק של 6 קבוצות/נבחרות: 2×5★ / 2×4.5★ / 2×4★'}
              </p>
            </div>
          </Card>

          <Button
            variant="gaming"
            size="lg"
            className="w-full"
            onClick={handleStart}
            disabled={!allFilled || hasDuplicates}
          >
            <Play className="h-5 w-5" />
            התחל ליגה
          </Button>
        </div>
      </div>
    </div>
  );
};
