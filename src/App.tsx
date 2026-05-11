import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import JoinTournament from "./pages/JoinTournament";
import JoinTeam from "./pages/JoinTeam";
import AdminClubs from "./pages/AdminClubs";
import AdminPoolConfig from "./pages/AdminPoolConfig";
import Spectate from "./pages/Spectate";
import Tournaments from "./pages/Tournaments";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import SettingsPage from "./pages/Settings";
import NotificationsPage from "./pages/Notifications";
import { TeamProvider } from "./contexts/TeamContext";
const VIBRATION_SETTING_KEY = "settings-vibration-enabled";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    const handleGlobalClick = (event: MouseEvent) => {
      const vibrationEnabled =
        localStorage.getItem(VIBRATION_SETTING_KEY) === "true";

      if (!vibrationEnabled) return;
      if (!("vibrate" in navigator)) return;

      const target = event.target as HTMLElement | null;
      const clickable = target?.closest(
        "button, a, [role='button'], input[type='submit']"
      );

      if (!clickable) return;

      navigator.vibrate(10);
    };

    document.addEventListener("click", handleGlobalClick);

    return () => {
      document.removeEventListener("click", handleGlobalClick);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <TeamProvider>
          <div dir="rtl">
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/join/:code" element={<JoinTournament />} />
                <Route path="/join-team/:code" element={<JoinTeam />} />
                <Route path="/admin/clubs" element={<AdminClubs />} />
                <Route path="/admin/pool-config" element={<AdminPoolConfig />} />
                <Route path="/tournaments" element={<Tournaments />} />
                <Route path="/spectate/:code" element={<Spectate />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/settings" element={<SettingsPage />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </div>
        </TeamProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
