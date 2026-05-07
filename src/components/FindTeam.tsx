import { useState } from "react";
import { ArrowLeft, Search, Send } from "lucide-react";
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

  const searchTeams = async () => {
    const cleanQuery = query.trim();

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
              חפש קבוצה לפי שם ושלח בקשת הצטרפות
            </p>
          </div>
        </div>

        <Card className="bg-gradient-card border-neon-green/20 p-4 shadow-card mb-4">
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">
              שם קבוצה
            </label>

            <div className="flex gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") searchTeams();
                }}
                placeholder="לדוגמה: Hard level"
                className="bg-gaming-surface border-border"
              />

              <Button variant="gaming" onClick={searchTeams} disabled={loading}>
                <Search className="h-4 w-4" />
              </Button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              יוצגו רק קבוצות שהמנהלים שלהן הגדירו כניתנות לחיפוש.
              אם קיבלת קישור הזמנה ישיר, עדיף לפתוח את הקישור שקיבלת.
            </p>
          </div>
        </Card>

        {loading && (
          <Card className="bg-gaming-surface/50 border-border/50 p-4 mb-4">
            <p className="text-sm text-muted-foreground">מחפש קבוצות...</p>
          </Card>
        )}

        {!loading && query.trim() && results.length === 0 && (
          <Card className="bg-gaming-surface/50 border-border/50 p-4 mb-4">
            <p className="text-sm text-muted-foreground">
              לא נמצאו קבוצות מתאימות. נסה לחפש בשם קצר יותר או בדוק שקיבלת את השם הנכון.
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