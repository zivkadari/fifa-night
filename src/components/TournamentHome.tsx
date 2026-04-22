import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trophy, History, Gamepad2, User, Users, X, UserPlus, Star, Settings, Users2 } from "lucide-react";
import alphaChampionImage from "@/assets/alpha-champion.png";
import { Link } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TournamentHomeProps {
  onStartNew: () => void;
  onViewHistory: () => void;
  onResume?: () => void;
  onCloseTournament?: () => void;
  onManageTeams?: () => void;
  onJoinEvening?: () => void;
  isAuthed?: boolean;
  userEmail?: string | null;
  onSignOut?: () => void;
}

export const TournamentHome = ({ 
  onStartNew, 
  onViewHistory, 
  onResume, 
  onCloseTournament,
  onManageTeams,
  onJoinEvening,
  isAuthed,
  userEmail,
  onSignOut
}: TournamentHomeProps) => {
  const isAdmin = userEmail === 'zivkad12@gmail.com';

  return (
    <div className="min-h-[100svh] bg-gaming-bg flex flex-col p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      {/* Auth Header - stays at top */}
      {isAuthed && (
        <div className="flex items-center justify-end gap-2">
          {userEmail && <span className="text-muted-foreground text-xs hidden sm:inline">{userEmail}</span>}
          <Button variant="ghost" size="sm" onClick={onSignOut}>Logout</Button>
          <Button asChild variant="secondary" size="sm"><Link to="/profile">Profile</Link></Button>
        </div>
      )}
      {!isAuthed && (
        <div className="flex items-center justify-end">
          <Button asChild variant="secondary" size="sm"><Link to="/auth">Log in / Sign up</Link></Button>
        </div>
      )}

      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center animate-scale-in">
        <div className="w-full max-w-[280px] mb-4">
          <img 
            src={alphaChampionImage} 
            alt="Alpha Champion" 
            className="w-full rounded-xl shadow-lg border border-neon-green/30"
          />
        </div>
        <h1 className="text-3xl font-bold text-foreground">EA FC 26</h1>
        <h2 className="text-xl font-semibold text-neon-green">Tournament Manager</h2>
      </div>

      {/* Action Buttons */}
      <div className="w-full max-w-md mx-auto space-y-3 pb-2">
        {onResume && (
          <div className="flex gap-2">
            <Button variant="gaming" size="lg" onClick={onResume} className="flex-1">
              <Gamepad2 className="h-5 w-5" />
              Resume Evening
            </Button>
            {onCloseTournament && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="lg" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                    <X className="h-5 w-5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>לסגור את הטורניר?</AlertDialogTitle>
                    <AlertDialogDescription>
                      הנתונים של הטורניר הנוכחי לא יישמרו להיסטוריה.
                      פעולה זו לא ניתנת לביטול.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>ביטול</AlertDialogCancel>
                    <AlertDialogAction onClick={onCloseTournament} className="bg-destructive hover:bg-destructive/90">
                      סגור טורניר
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        )}

        <Button variant="hero" size="lg" onClick={onStartNew} className="w-full">
          <Trophy className="h-5 w-5" />
          Start New Evening
        </Button>
        
        {onManageTeams && (
          <Button variant="secondary" size="lg" onClick={onManageTeams} className="w-full">
            <Users className="h-5 w-5" />
            Teams
          </Button>
        )}
        
        {onJoinEvening && isAuthed && (
          <Button variant="outline" size="lg" onClick={onJoinEvening} className="w-full border-neon-green/30 hover:bg-neon-green/10">
            <UserPlus className="h-5 w-5" />
            הצטרף לערב
          </Button>
        )}
        
        <Button variant="secondary" size="lg" onClick={onViewHistory} className="w-full">
          <History className="h-5 w-5" />
          History
        </Button>

        {/* Admin Options - single dropdown */}
        {isAdmin && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="lg" className="w-full border-yellow-400/30 hover:bg-yellow-400/10 text-yellow-400">
                <Star className="h-5 w-5" />
                Admin Options
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-64">
              <DropdownMenuItem asChild>
                <Link to="/admin/clubs" className="w-full cursor-pointer">
                  ניהול קבוצות
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/admin/pool-config" className="w-full cursor-pointer">
                  הגדרת הרכב קבוצות
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Footer */}
      <div className="text-center py-2">
        <p className="text-muted-foreground text-sm">
          EA FC 26 • Ranking Tracking • Bragging Rights
        </p>
      </div>
    </div>
  );
};
