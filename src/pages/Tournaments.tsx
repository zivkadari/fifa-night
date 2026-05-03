import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TournamentHistory, EveningWithTeam } from "@/components/TournamentHistory";
import { RemoteStorageService } from "@/services/remoteStorageService";
import { StorageService } from "@/services/storageService";
import { useToast } from "@/hooks/use-toast";
import FitToScreen from "@/components/FitToScreen";
import { useIsMobile } from "@/hooks/use-mobile";

const Tournaments = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [tournamentHistory, setTournamentHistory] = useState<EveningWithTeam[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const remote = await RemoteStorageService.loadEveningsWithTeams();
        setTournamentHistory(remote);
      } catch {
        setTournamentHistory([]);
      }
    })();
  }, []);

  const handleDeleteEvening = async (eveningId: string) => {
    try {
      await RemoteStorageService.deleteEvening(eveningId);
      setTournamentHistory(prev => prev.filter(e => e.id !== eveningId));
      toast({ title: "הערב נמחק בהצלחה" });
    } catch {
      toast({ title: "שגיאה במחיקת הערב", variant: "destructive" });
    }
  };

  const content = (
    <TournamentHistory
      evenings={tournamentHistory}
      onBack={() => navigate("/")}
      onDeleteEvening={handleDeleteEvening}
      onRefresh={async () => {
        const updated = await RemoteStorageService.loadEveningsWithTeams();
        setTournamentHistory(updated);
        toast({ title: "הטורניר שויך לקבוצה בהצלחה" });
      }}
    />
  );

  return isMobile ? <FitToScreen>{content}</FitToScreen> : content;
};

export default Tournaments;
