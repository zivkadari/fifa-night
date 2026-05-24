import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Play, Users, Save, Trash2, Edit2, Check, X, FolderOpen } from "lucide-react";
import { Player } from "@/types/tournament";
import { useToast } from "@/hooks/use-toast";
import { StorageService, FPSavedGroup } from "@/services/storageService";

interface FPSetupProps {
  onBack: () => void;
  onStart: (
    players: Player[],
    matchCount: 15 | 30,
    setupOptions?: {
      firstSittingOutPlayerId?: string;
      teamName?: string;
    }
  ) => void;
  savedPlayers?: Player[];
  /** Team players to pre-fill when starting within a team context */
  teamPlayers?: Player[];
}

type SetupMode = 'choose' | 'new' | 'saved';

export const FPSetup = ({ onBack, onStart, savedPlayers, teamPlayers }: FPSetupProps) => {
  const { toast } = useToast();
  const hasTeamPlayers = teamPlayers && teamPlayers.length === 5;
  const [mode, setMode] = useState<SetupMode>(
    hasTeamPlayers || savedPlayers?.length === 5 ? 'new' : 'choose'
  );
  const [players, setPlayers] = useState<Player[]>(
    hasTeamPlayers
      ? teamPlayers
      : savedPlayers && savedPlayers.length === 5
        ? savedPlayers
        : Array.from({ length: 5 }, (_, i) => ({ id: `player-${Date.now()}-${i}`, name: '' }))
  );
  const [matchCount, setMatchCount] = useState<15 | 30>(30);
  const [firstSittingOutPlayerId, setFirstSittingOutPlayerId] = useState<string>('');
  const [savedGroups, setSavedGroups] = useState<FPSavedGroup[]>([]);
  const [groupName, setGroupName] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showPlayerEditor, setShowPlayerEditor] = useState<boolean>(
    !(hasTeamPlayers || savedPlayers?.length === 5)
  );

  useEffect(() => {
    setSavedGroups(StorageService.loadFPGroups());
  }, []);

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
  
    const setupOptions: { firstSittingOutPlayerId?: string; teamName?: string } = {};

    if (firstSittingOutPlayerId) {
      setupOptions.firstSittingOutPlayerId = firstSittingOutPlayerId;
    }
    
    if (groupName.trim()) {
      setupOptions.teamName = groupName.trim();
    }
    
    onStart(
      [selectedPlayer, ...remainingPlayers],
      matchCount,
      Object.keys(setupOptions).length > 0 ? setupOptions : undefined
    );
  };

  const handleSaveGroup = () => {
    if (!groupName.trim()) {
      toast({ title: "יש להזין שם לקבוצה", variant: "destructive" });
      return;
    }
    if (!allFilled || hasDuplicates) {
      toast({ title: "יש למלא 5 שמות ייחודיים לפני שמירה", variant: "destructive" });
      return;
    }
    const newGroup: FPSavedGroup = {
      id: `fp-group-${Date.now()}`,
      name: groupName.trim(),
      players: players.map(p => p.name.trim()),
    };
    StorageService.addFPGroup(newGroup);
    setSavedGroups(StorageService.loadFPGroups());
    toast({ title: "הקבוצה נשמרה בהצלחה!" });
  };

  const handleSelectGroup = (group: FPSavedGroup) => {
    const loaded = group.players.map((name, i) => ({
      id: `player-${Date.now()}-${i}`,
      name,
    }));
  
    setPlayers(loaded);
  
    // IMPORTANT:
    // A saved local FP group name should NOT automatically create a new Supabase team.
    // Keep this empty unless the user explicitly types a new team name.
    setGroupName('');
  
    setFirstSittingOutPlayerId('');
    setShowPlayerEditor(false);
    setMode('new');
  };

  const handleDeleteGroup = (groupId: string) => {
    StorageService.deleteFPGroup(groupId);
    setSavedGroups(StorageService.loadFPGroups());
    toast({ title: "הקבוצה נמחקה" });
  };

  const handleEditGroupSave = (group: FPSavedGroup) => {
    if (!editName.trim()) return;
    StorageService.updateFPGroup({ ...group, name: editName.trim() });
    setSavedGroups(StorageService.loadFPGroups());
    setEditingGroupId(null);
    setEditName('');
  };

  // Choose mode screen
  if (mode === 'choose') {
    return (
      <div className="min-h-[100svh] bg-gaming-bg flex flex-col p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]" dir="rtl">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5 rotate-180" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">ליגת זוגות (5 שחקנים)</h1>
            <p className="text-xs text-muted-foreground">
              {matchCount === 15 ? '3 סיבובים • 15 משחקים • 3 קבוצות לזוג' : '6 סיבובים • 30 משחקים • 6 קבוצות לזוג'}
            </p>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-full max-w-md space-y-4">
            <Button
              variant="gaming"
              size="lg"
              className="w-full"
              onClick={() => {
                setPlayers(Array.from({ length: 5 }, (_, i) => ({
                  id: `player-${Date.now()}-${i}`,
                  name: '',
                })));
                setFirstSittingOutPlayerId('');
                setShowPlayerEditor(true);
                setMode('new');
              }}
            >
              <Users className="h-5 w-5" />
              הזן שחקנים חדשים
            </Button>

            {savedGroups.length > 0 && (
              <Button
                variant="outline"
                size="lg"
                className="w-full border-neon-green/30 text-foreground"
                onClick={() => setMode('saved')}
              >
                <FolderOpen className="h-5 w-5" />
                בחר קבוצה שמורה ({savedGroups.length})
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Saved groups browser
  if (mode === 'saved') {
    return (
      <div className="min-h-[100svh] bg-gaming-bg flex flex-col p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]" dir="rtl">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={() => setMode('choose')}>
            <ArrowLeft className="h-5 w-5 rotate-180" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">קבוצות שמורות</h1>
        </div>

        <div className="flex-1 space-y-3 max-w-md mx-auto w-full">
          {savedGroups.map(group => (
            <Card key={group.id} className="bg-gradient-card border-neon-green/20 p-4 shadow-card">
              <div className="flex items-center justify-between mb-2">
                {editingGroupId === group.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="bg-gaming-surface border-border text-right text-sm h-8"
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" onClick={() => handleEditGroupSave(group)} className="h-8 w-8">
                      <Check className="h-4 w-4 text-neon-green" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditingGroupId(null)} className="h-8 w-8">
                      <X className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <h3 className="text-sm font-semibold text-foreground">{group.name}</h3>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setEditingGroupId(group.id); setEditName(group.name); }} className="h-7 w-7">
                        <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDeleteGroup(group.id)} className="h-7 w-7">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-3">{group.players.join(' • ')}</p>
              <Button
                variant="gaming"
                size="sm"
                className="w-full"
                onClick={() => handleSelectGroup(group)}
              >
                <Play className="h-4 w-4" />
                בחר קבוצה זו
              </Button>
            </Card>
          ))}

          {savedGroups.length === 0 && (
            <p className="text-center text-muted-foreground text-sm">אין קבוצות שמורות עדיין</p>
          )}
        </div>
      </div>
    );
  }

  // New / manual entry
  return (
    <div className="min-h-[100svh] bg-gaming-bg flex flex-col p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]" dir="rtl">
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="icon" onClick={() => savedGroups.length > 0 ? setMode('choose') : onBack()}>
          <ArrowLeft className="h-5 w-5 rotate-180" />
        </Button>
        <div>
            <h1 className="text-xl font-bold text-foreground">ליגת זוגות (5 שחקנים)</h1>
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

          {/* Save group option */}
          <Card className="bg-gaming-surface/50 border-border/50 p-3">
            <div className="flex items-center gap-2">
              <Input
                placeholder="שם הקבוצה (לשמירה)"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                className="bg-gaming-surface border-border text-right text-sm flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveGroup}
                disabled={!allFilled || hasDuplicates || !groupName.trim()}
                className="border-neon-green/30 whitespace-nowrap"
              >
                <Save className="h-4 w-4" />
                שמור
              </Button>
            </div>
          </Card>

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
