import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, X, ArrowRight, Loader2, Inbox, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RemoteStorageService } from "@/services/remoteStorageService";
import { useToast } from "@/hooks/use-toast";

type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  data: any;
  read_at: string | null;
  dismissed_at: string | null;
  created_at: string;
};

const formatTime = (iso: string) => {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diffMin < 1) return "עכשיו";
    if (diffMin < 60) return `לפני ${diffMin} דק׳`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `לפני ${diffH} שעות`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `לפני ${diffD} ימים`;
    return d.toLocaleDateString("he-IL");
  } catch {
    return "";
  }
};

const isHandledJoinRequestNotification = (n: Notification) => {
  return n.type === "team_join_request_created" && !!n.data?.handled;
};

const getHandledJoinRequestText = (n: Notification) => {
  const requester = n.data?.requester_label || "המשתמש";
  const team = n.data?.team_name || "הקבוצה";

  if (n.data?.decision === "approved") {
    return `הוספת את ${requester} לקבוצת ${team}`;
  }

  if (n.data?.decision === "rejected") {
    return `דחית את בקשת ההצטרפות של ${requester} לקבוצת ${team}`;
  }

  return null;
};

const NotificationsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const list = await RemoteStorageService.listMyNotifications(100);
    setItems(list as Notification[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!session?.user) {
        setAuthed(false);
        setLoading(false);
        return;
      }
      setAuthed(true);
      await load();
      if (!mounted) return;
      channel = supabase
        .channel(`notifications:${session.user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${session.user.id}`,
          },
          () => {
            load();
          }
        )
        .subscribe();
    })();
    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [load]);

  const markRead = async (id: string) => {
    await RemoteStorageService.markNotificationAsRead(id);
    setItems(prev => prev.map(n => n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n));
  };

  const handleApprove = async (n: Notification) => {
    const requestId = n.data?.request_id;
    if (!requestId) return;
    setBusyId(n.id);
    const ok = await RemoteStorageService.approveJoinRequest(requestId);
    setBusyId(null);
    if (ok) {
      toast({ title: "הבקשה אושרה" });
    
      setItems((prev) =>
        prev.map((item) =>
          item.id === n.id
            ? {
                ...item,
                read_at: item.read_at ?? new Date().toISOString(),
                data: {
                  ...(item.data || {}),
                  handled: true,
                  decision: "approved",
                  handled_at: new Date().toISOString(),
                },
              }
            : item
        )
      );
    
      await RemoteStorageService.markNotificationAsHandled(n.id, "approved");
      await load();
    } else {
      toast({ title: "שגיאה באישור", variant: "destructive" });
    }
  };

  const handleReject = async (n: Notification) => {
    const requestId = n.data?.request_id;
    if (!requestId) return;
    setBusyId(n.id);
    const ok = await RemoteStorageService.rejectJoinRequest(requestId);
    setBusyId(null);
    if (ok) {
      toast({ title: "הבקשה נדחתה" });
    
      setItems((prev) =>
        prev.map((item) =>
          item.id === n.id
            ? {
                ...item,
                read_at: item.read_at ?? new Date().toISOString(),
                data: {
                  ...(item.data || {}),
                  handled: true,
                  decision: "rejected",
                  handled_at: new Date().toISOString(),
                },
              }
            : item
        )
      );
    
      await RemoteStorageService.markNotificationAsHandled(n.id, "rejected");
      await load();
    } else {
      toast({ title: "שגיאה בדחיה", variant: "destructive" });
    }
  };

  const handleOpenTeam = async (n: Notification) => {
    await markRead(n.id);
  
    const teamId = n.data?.team_id;
    if (teamId) {
      navigate(`/?screen=teams&teamId=${encodeURIComponent(teamId)}`);
      return;
    }
  
    navigate("/");
  };

  const handleMarkAll = async () => {
    await RemoteStorageService.markAllNotificationsAsRead();
    setItems(prev => prev.map(n => n.read_at ? n : { ...n, read_at: new Date().toISOString() }));
  };

  const handleDismiss = async (n: Notification) => {
    const ok = await RemoteStorageService.dismissNotification(n.id);
    if (ok) {
      setItems(prev => prev.filter(item => item.id !== n.id));
    }
  };

  const handleDismissRead = async () => {
    const ok = await RemoteStorageService.dismissReadNotifications();
    if (ok) {
      setItems(prev => prev.filter(n => !n.read_at));
    }
  };

  const unread = items.filter(n => !n.read_at);
  const read = items.filter(n => n.read_at);

  const renderActions = (n: Notification) => {
    if (n.type === "team_join_request_created") {
      if (n.data?.handled) {
        return null;
      }
    
      return (
        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            variant="gaming"
            disabled={busyId === n.id}
            onClick={(e) => {
              e.stopPropagation();
              handleApprove(n);
            }}
          >
            {busyId === n.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            אשר
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busyId === n.id}
            onClick={(e) => {
              e.stopPropagation();
              handleReject(n);
            }}
          >
            <X className="h-3 w-3" />
            דחה
          </Button>
        </div>
      );
    }
    if (n.type === "team_join_request_approved") {
      return (
        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenTeam(n);
            }}
          >
            פתח קבוצה
          </Button>
        </div>
      );
    }

    if (n.type === "team_identity_required") {
      return (
        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            variant="gaming"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenTeam(n);
            }}
          >
            בחר זהות
          </Button>
        </div>
      );
    }

    if (n.type === "team_evening_started") {
      return (
        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenTeam(n);
            }}
          >
            פתח טורניר
          </Button>
        </div>
      );
    }
    return null;
  };

  const renderCard = (n: Notification) => {
    const isUnread = !n.read_at;
    return (
      <Card
        key={n.id}
        className={`border ${isUnread ? "bg-card border-neon-green/40" : "bg-card/60 border-border opacity-80"}`}
        onClick={() => isUnread && markRead(n.id)}
      >
        <CardContent className="p-4 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              {isUnread && <span className="h-2 w-2 rounded-full bg-neon-green inline-block" />}
              <p className="text-sm font-semibold text-foreground break-words">{n.title}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] text-muted-foreground">{formatTime(n.created_at)}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                aria-label="נקה התראה"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDismiss(n);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          {n.body && <p className="text-xs text-muted-foreground break-words">{n.body}</p>}
          {isHandledJoinRequestNotification(n) && getHandledJoinRequestText(n) && (
            <p className="text-xs text-neon-green pt-1">
              {getHandledJoinRequestText(n)}
            </p>
          )}
          
          {renderActions(n)}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gaming-bg p-4" dir="rtl">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/">
              <ArrowRight className="h-5 w-5 rotate-180" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-neon-green" />
            <h1 className="text-xl font-bold text-foreground">התרעות</h1>
            {unread.length > 0 && (
              <Badge variant="default" className="text-[10px]">{unread.length}</Badge>
            )}
          </div>
          <div className="w-10" />
        </div>

        {!authed && !loading && (
          <Card className="bg-card border-border">
            <CardContent className="p-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">יש להתחבר כדי לראות התרעות</p>
              <Button asChild variant="gaming"><Link to="/auth">התחברות</Link></Button>
            </CardContent>
          </Card>
        )}

        {authed && (
          <>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={unread.length === 0}
                onClick={handleMarkAll}
              >
                סמן הכל כנקרא
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={read.length === 0}
                onClick={handleDismissRead}
              >
                נקה נקראו
              </Button>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : items.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="p-8 text-center space-y-3">
                  <Inbox className="h-10 w-10 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">אין התרעות כרגע</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {unread.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">חדשות</p>
                    {unread.map(renderCard)}
                  </div>
                )}
                {read.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <p className="text-xs text-muted-foreground font-medium">נקראו</p>
                    {read.map(renderCard)}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
