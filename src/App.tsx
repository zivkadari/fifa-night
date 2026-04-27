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
import { TeamProvider } from "./contexts/TeamContext";
import TeamTournaments from "./pages/TeamTournaments";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <TeamProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/team/:teamId/tournaments" element={<TeamTournaments />} />
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/join/:code" element={<JoinTournament />} />
          <Route path="/join-team/:code" element={<JoinTeam />} />
          <Route path="/admin/clubs" element={<AdminClubs />} />
          <Route path="/admin/pool-config" element={<AdminPoolConfig />} />
          <Route path="/spectate/:code" element={<Spectate />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      </TeamProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
