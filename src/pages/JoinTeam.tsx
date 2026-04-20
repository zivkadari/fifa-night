import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, Users, AlertCircle, UserCheck, UserPlus, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { RemoteStorageService } from "@/services/remoteStorageService";
import { useToast } from "@/hooks/use-toast";

type Status = 'checking' | 'joining' | 'joined' | 'link-player' | 'error' | 'redirect-auth';

const JoinTeam = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<Status>('checking');
  const [errorMessage, setErrorMessage] = useState("");
  const [teamInfo, setTeamInfo] = useState<{ team_id: string; team_name: string } | null>(null);

  // Player linking state
  const [teamPlayers, setTeamPlayers] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [linking, setLinking] = useState(false);
  const [createMode, setCreateMode] = useState(false);

  useEffect(() => {
    if (!code) {
      setStatus('error');
      setErrorMessage('קוד הזמנה חסר');
      return;
    }

    const checkAuthAndJoin = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        setStatus('redirect-auth');
        setTimeout(() => {
          navigate(`/auth?redirect=/join-team/${code}`);
        }, 1500);
        return;
      }

      setStatus('joining');
      try {
        // Smart resolver: if this code is actually an evening code (not team),
        // redirect to the evening-join flow instead of failing.
        const resolved = await RemoteStorageService.resolveInviteCode(code);
        if (resolved?.kind === 'evening') {
          navigate(`/join/${code}`, { replace: true });
          return;
        }

        const result = await RemoteStorageService.joinTeamByCode(code);
        if (result) {
          setTeamInfo(result);
          setStatus('joined');
          toast({ title: "הצטרפת לקבוצה!", description: result.team_name });

          // Load team players for linking
          const players = await RemoteStorageService.listTeamPlayers(result.team_id);
          setTeamPlayers(players);
          setStatus('link-player');
        } else {
          setStatus('error');
          setErrorMessage('קוד לא תקין או שהקבוצה לא נמצאה');
        }
      } catch (error: any) {
        if (error?.message?.includes('rate limit')) {
          setErrorMessage('יותר מדי ניסיונות. נסה שוב מאוחר יותר.');
        } else if (error?.message?.includes('invalid code')) {
          setErrorMessage('קוד הזמנה לא תקין');
        } else {
          setErrorMessage('שגיאה בהצטרפות לקבוצה');
        }
        setStatus('error');
      }
    };

    checkAuthAndJoin();
  }, [code, navigate, toast]);

  const handleLinkExistingPlayer = async () => {
    if (!selectedPlayerId || !teamInfo) return;
    setLinking(true);
    try {
      const result = await RemoteStorageService.claimPlayerForTeam(selectedPlayerId, teamInfo.team_id);
      if (result.ok) {
        toast({ title: "שחקן קושר בהצלחה!", description: "החשבון שלך מקושר לשחקן בקבוצה" });
        navigate('/');
      } else {
        toast({ title: "שגיאה בקישור", description: result.error || "ייתכן שהשחקן כבר מקושר למשתמש אחר", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "שגיאה בקישור", description: e?.message, variant: "destructive" });
    } finally {
      setLinking(false);
    }
  };

  const handleCreateNewPlayer = async () => {
    if (!newPlayerName.trim() || !teamInfo) return;
    setLinking(true);
    try {
      const ok = await RemoteStorageService.addPlayerToTeamByName(teamInfo.team_id, newPlayerName.trim());
      if (ok) {
        const players = await RemoteStorageService.listTeamPlayers(teamInfo.team_id);
        const created = players.find(p => p.name.toLowerCase() === newPlayerName.trim().toLowerCase());
        if (created) {
          await RemoteStorageService.claimPlayerForTeam(created.id, teamInfo.team_id);
        }
        toast({ title: "שחקן נוצר וקושר!", description: newPlayerName.trim() });
        navigate('/');
      } else {
        toast({ title: "שגיאה ביצירת שחקן", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "שגיאה", description: error?.message || "שגיאה לא ידועה", variant: "destructive" });
    } finally {
      setLinking(false);
    }
  };

  const handleSkip = () => {
    toast({ title: "הצטרפת לקבוצה!", description: "תוכל לקשר שחקן מאוחר יותר מדף הפרופיל" });
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gaming-bg flex items-center justify-center p-4" dir="rtl">
      <Card className="bg-gradient-card border-neon-green/20 p-8 max-w-md w-full">
        {status === 'checking' && (
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-neon-green mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">בודק פרטי הזמנה...</h2>
          </div>
        )}

        {status === 'joining' && (
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-neon-green mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">מצטרף לקבוצה...</h2>
            <p className="text-muted-foreground">קוד: {code}</p>
          </div>
        )}

        {status === 'redirect-auth' && (
          <div className="text-center">
            <Users className="h-12 w-12 text-neon-green mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">נדרשת התחברות</h2>
            <p className="text-muted-foreground mb-4">מעביר אותך לדף ההתחברות...</p>
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
          </div>
        )}

        {status === 'link-player' && teamInfo && (
          <div>
            <div className="text-center mb-6">
              <Check className="h-12 w-12 text-neon-green mx-auto mb-3" />
              <h2 className="text-xl font-semibold text-foreground mb-1">הצטרפת ל{teamInfo.team_name}!</h2>
              <p className="text-muted-foreground text-sm">עכשיו קשר את עצמך לשחקן בקבוצה</p>
            </div>

            {!createMode ? (
              <>
                {teamPlayers.length > 0 && (
                  <div className="space-y-2 mb-4">
                    <p className="text-sm font-medium text-foreground mb-2">
                      <UserCheck className="h-4 w-4 inline ml-1" />
                      זה אני — בחר שחקן קיים:
                    </p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {teamPlayers.map((p) => (
                        <Button
                          key={p.id}
                          variant={selectedPlayerId === p.id ? "secondary" : "outline"}
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => setSelectedPlayerId(p.id)}
                        >
                          {p.name}
                          {selectedPlayerId === p.id && <Check className="h-4 w-4 mr-auto" />}
                        </Button>
                      ))}
                    </div>
                    <Button
                      variant="gaming"
                      className="w-full mt-3"
                      disabled={!selectedPlayerId || linking}
                      onClick={handleLinkExistingPlayer}
                    >
                      {linking ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                      קשר אותי לשחקן הזה
                    </Button>
                  </div>
                )}

                <div className="border-t border-border/50 pt-4 mt-4">
                  <Button
                    variant="outline"
                    className="w-full mb-2"
                    onClick={() => setCreateMode(true)}
                  >
                    <UserPlus className="h-4 w-4 ml-2" />
                    אני שחקן חדש — צור שחקן
                  </Button>
                  <Button variant="ghost" className="w-full text-muted-foreground" onClick={handleSkip}>
                    דלג בינתיים
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <p className="text-sm font-medium text-foreground">
                  <UserPlus className="h-4 w-4 inline ml-1" />
                  יצירת שחקן חדש:
                </p>
                <Input
                  placeholder="השם שלך בקבוצה"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  className="bg-gaming-surface border-border"
                  autoFocus
                />
                <Button
                  variant="gaming"
                  className="w-full"
                  disabled={!newPlayerName.trim() || linking}
                  onClick={handleCreateNewPlayer}
                >
                  {linking ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                  צור וקשר
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => setCreateMode(false)}>
                  חזרה לבחירת שחקן קיים
                </Button>
              </div>
            )}
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">שגיאה</h2>
            <p className="text-muted-foreground mb-6">{errorMessage}</p>
            <div className="space-y-2">
              <Button variant="gaming" onClick={() => navigate('/')} className="w-full">
                חזור לדף הבית
              </Button>
              {code && (
                <Button variant="secondary" onClick={() => window.location.reload()} className="w-full">
                  נסה שוב
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default JoinTeam;
