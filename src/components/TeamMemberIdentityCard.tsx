import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { UserCheck, UserPlus, Eye } from "lucide-react";
import { RemoteStorageService } from "@/services/remoteStorageService";
import { useToast } from "@/hooks/use-toast";
import { useTeam } from "@/contexts/TeamContext";

interface TeamMemberIdentityCardProps {
  teamId: string;
  teamName?: string;
}

interface AvailablePlayer {
  id: string;
  name: string;
  claimed: boolean;
}

export const TeamMemberIdentityCard = ({
  teamId,
  teamName,
}: TeamMemberIdentityCardProps) => {
  const { toast } = useToast();
  const { refresh } = useTeam();

  const [loading, setLoading] = useState(true);
  const [memberMode, setMemberMode] = useState<"unset" | "player" | "spectator" | null>(null);
  const [linkedPlayerName, setLinkedPlayerName] = useState<string | null>(null);
  const [players, setPlayers] = useState<AvailablePlayer[]>([]);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);

    try {
      const [status, availablePlayers] = await Promise.all([
        RemoteStorageService.getMyTeamMemberStatus(teamId),
        RemoteStorageService.getAvailablePlayersForClaim(teamId),
      ]);

      setMemberMode(status?.member_mode || null);
      setLinkedPlayerName(status?.linked_player_name || null);
      setPlayers(availablePlayers);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [teamId]);

  const claimExistingPlayer = async (playerId: string, playerName: string) => {
    setSaving(true);

    try {
      const result = await RemoteStorageService.claimPlayerForTeam(playerId, teamId);

      if (result.ok) {
        toast({
          title: "השחקן קושר בהצלחה",
          description: `קישרנו אותך לשחקן ${playerName}`,
        });

        await refresh();
        await load();
      } else {
        toast({
          title: "לא הצלחנו לקשר את השחקן",
          description: result.error || "נסה שוב בעוד רגע",
          variant: "destructive",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const createAndClaimPlayer = async () => {
    const name = newPlayerName.trim();
    if (!name) return;

    setSaving(true);

    try {
      const result = await RemoteStorageService.createAndClaimPlayerForTeam(teamId, name);

      if (result.ok) {
        toast({
          title: "שחקן חדש נוצר",
          description: `יצרנו וקישרנו אותך לשחקן ${name}`,
        });

        setNewPlayerName("");
        await refresh();
        await load();
      } else {
        toast({
          title: "לא הצלחנו ליצור שחקן",
          description: result.error || "נסה שוב בעוד רגע",
          variant: "destructive",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const setSpectator = async () => {
    setSaving(true);

    try {
      const ok = await RemoteStorageService.setSpectatorModeForTeam(teamId);

      if (ok) {
        toast({
          title: "הוגדרת כצופה",
          description: "תוכל לצפות בקבוצה בלי להיות משויך לשחקן",
        });

        await refresh();
        await load();
      } else {
        toast({
          title: "שגיאה בהגדרת צופה",
          variant: "destructive",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  if (memberMode === "player") {
    return linkedPlayerName ? (
      <Card className="bg-gaming-surface/50 border-border/50 shadow-card mb-4">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            אתה מחובר בקבוצה הזו כשחקן:
          </p>
          <p className="text-lg font-semibold text-foreground mt-1">
            {linkedPlayerName}
          </p>
        </CardContent>
      </Card>
    ) : null;
  }

  if (memberMode === "spectator") {
    return (
      <Card className="bg-gaming-surface/50 border-border/50 shadow-card mb-4">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            אתה מוגדר כצופה בקבוצה הזו.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (memberMode !== "unset") return null;

  return (
    <Card className="bg-gradient-card border-neon-green/30 shadow-card mb-4">
      <CardContent className="p-4 space-y-4">
        <div className="space-y-1">
          <p className="text-xs text-neon-green font-semibold">הגדרת זהות בקבוצה</p>
          <h2 className="text-xl font-bold text-foreground">
            מי אתה בקבוצה{teamName ? ` ${teamName}` : ""}?
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            כדי להשתתף בטורנירים וסטטיסטיקות, בחר אם אתה אחד מהשחקנים הקיימים,
            רוצה ליצור שחקן חדש, או רק לצפות בקבוצה.
          </p>
        </div>

        {players.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">
              אני אחד מהשחקנים הקיימים
            </p>

            <div className="space-y-2">
              {players.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between rounded-lg border border-border/50 bg-gaming-surface/50 p-3 gap-2"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {player.name}
                    </p>
                    {player.claimed && (
                      <p className="text-xs text-muted-foreground">
                        כבר מקושר למשתמש אחר
                      </p>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={saving || player.claimed}
                    onClick={() => claimExistingPlayer(player.id, player.name)}
                    className="gap-1"
                  >
                    <UserCheck className="h-4 w-4" />
                    זה אני
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">
            אני שחקן חדש
          </p>

          <div className="flex gap-2">
            <Input
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              placeholder="השם שלי בקבוצה"
              className="bg-gaming-surface border-border"
            />

            <Button
              variant="gaming"
              disabled={saving || !newPlayerName.trim()}
              onClick={createAndClaimPlayer}
              className="gap-1 shrink-0"
            >
              <UserPlus className="h-4 w-4" />
              צור
            </Button>
          </div>
        </div>

        <Button
          variant="ghost"
          disabled={saving}
          onClick={setSpectator}
          className="w-full gap-2 text-muted-foreground"
        >
          <Eye className="h-4 w-4" />
          אני רק צופה בקבוצה
        </Button>
      </CardContent>
    </Card>
  );
};