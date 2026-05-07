import { useState } from "react";
import { ArrowLeft, Search, Send, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { RemoteStorageService } from "@/services/remoteStorageService";

interface FindTeamProps {
  onBack: () => void;
}

interface DiscoverableTeam {
  id: string;
  name: string;
  description: string | null;
  visibility: string;
  owner_id: string;
}

export const FindTeam = ({ onBack }: FindTeamProps) => {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DiscoverableTeam[]>([]);
  const [loading, setLoading] = useState(false);
  const [requestingTeamId, setRequestingTeamId] = useState<string | null>(null);
  const [joiningByCode, setJoiningByCode] = useState(false);

  const cleanQuery = query.trim();
  const looksLikeInviteCode =
    cleanQuery.length >= 6 &&
    cleanQuery.length <= 20 &&
    /^[A-Za-z0-9-]+$/.test(cleanQuery);

  const searchTeams = async () => {
    if (!cleanQuery) {
      setResults([]);
      return;
    }

    setLoading(true);

    try {
      const teams = await RemoteStorageService.searchDiscoverableTeams(cleanQuery);
      setResults(teams);
    } finally {
      setLoading(false);
    }
  };

  const requestToJoin = async (teamId: string, teamName: string) => {
    setRequestingTeamId(teamId);

    try {
      const ok = await RemoteStorageService.requestToJoinTeam(teamId);

      if (ok) {
        toast({
          title: "בקשת הצטרפות נשלחה",
          description: `שלחנו בקשה להצטרף לקבוצה ${teamName}`,
        });
      } else {
        toast({
          title: "שגיאה בשליחת בקשה",
          description: "נסה שוב בעוד רגע",
          variant: "destructive",
        });
      }
    } finally {
      setRequestingTeamId(null);
    }
  };

  const joinWithCode = async () => {
    if (!cleanQuery) return;

    setJoiningByCode(true);

    try {
      const joined = await RemoteStorageService.joinTeamByCode(cleanQuery);

      if (joined) {
        toast({
          title: "הצטרפת לקבוצה",
          description: `הצטרפת לקבוצה ${joined.team_name}`,
        });

        onBack();
      } else {
        toast({
          title: "לא נמצאה קבוצה עם הקוד הזה",
          description: "בדוק שהקוד נכון ונסה שוב",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "שגיאה בהצטרפות עם קוד",
        description: error?.message || "בדוק שהקוד נכון ונסה שוב",
        variant: "destructive",
      });
    } finally {
      setJoiningByCode(false);
    }
  };

  return (
    <div className="min-h-screen bg-gaming-bg p-4 mobile-optimized" dir="rtl">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="חזרה">
            <ArrowLeft className="h-5 w-5 rotate-180" />
          </Button>

          <div>
            <h1 className="text-2xl font-bold text-foreground">מצא קבוצה קיימת</h1>
            <p className="text-muted-foreground text-sm">
              חפש לפי שם קבוצה או הזן קוד הזמנה שקיבלת מחבר
            </p>
          </div>
        </div>

        <Card className="bg-gradient-card border-neon-green/20 p-4 shadow-card mb-4">
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">
              שם קבוצה או קוד הזמנה
            </label>

            <div className="flex gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") searchTeams();
                }}
                placeholder="לדוגמה: Alphot B או C7E3AAC1"
                className="bg-gaming-surface border-border"
              />

              <Button variant="gaming" onClick={searchTeams} disabled={loading}>
                <Search className="h-4 w-4" />
              </Button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              חיפוש לפי שם יציג קבוצות שהמנהלים שלהן הגדירו כניתנות לחיפוש.
              אם קיבלת קוד הזמנה, אפשר להצטרף ישירות גם לקבוצה פרטית.
            </p>

            {looksLikeInviteCode && (
              <Button
                variant="outline"
                onClick={joinWithCode}
                disabled={joiningByCode}
                className="w-full gap-2"
              >
                <KeyRound className="h-4 w-4" />
                {joiningByCode ? "מצטרף עם קוד..." : "הצטרף עם קוד הזמנה"}
              </Button>
            )}
          </div>
        </Card>

        {loading && (
          <Card className="bg-gaming-surface/50 border-border/50 p-4 mb-4">
            <p className="text-sm text-muted-foreground">מחפש קבוצות...</p>
          </Card>
        )}

        {!loading && cleanQuery && results.length === 0 && (
          <Card className="bg-gaming-surface/50 border-border/50 p-4 mb-4">
            <p className="text-sm text-muted-foreground">
              לא נמצאו קבוצות מתאימות לפי שם. אם זה קוד הזמנה, נסה ללחוץ על “הצטרף עם קוד הזמנה”.
            </p>
          </Card>
        )}

        <div className="space-y-3">
          {results.map((team) => (
            <Card key={team.id} className="bg-gaming-surface/50 border-border/50 p-4">
              <div className="space-y-3">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {team.name}
                  </h3>

                  {team.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {team.description}
                    </p>
                  )}

                  <p className="text-xs text-muted-foreground mt-2">
                    {team.visibility === "public"
                      ? "קבוצה ציבורית"
                      : "ניתנת לחיפוש"}
                  </p>
                </div>

                <Button
                  variant="outline"
                  className="w-full gap-2"
                  disabled={requestingTeamId === team.id}
                  onClick={() => requestToJoin(team.id, team.name)}
                >
                  <Send className="h-4 w-4" />
                  {requestingTeamId === team.id ? "שולח בקשה..." : "בקש להצטרף"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};