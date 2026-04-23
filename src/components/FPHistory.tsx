import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Calendar, Trophy, Trash2, Share2, Loader2, Clock, Edit2, RotateCcw, Cloud, AlertTriangle, Eye } from "lucide-react";
import { FPEvening, FPBlockTiming } from "@/types/fivePlayerTypes";
import { calculatePairStats, calculatePlayerStats } from "@/services/fivePlayerEngine";
import { StorageService } from "@/services/storageService";
import { RemoteStorageService } from "@/services/remoteStorageService";
import { useToast } from "@/hooks/use-toast";
import { formatDuration } from "@/components/FPTimingCard";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";

function toLocalDatetimeString(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface FPHistoryProps {
  onBack: () => void;
  fpTeamId?: string | null;
}

export const FPHistory = ({ onBack, fpTeamId }: FPHistoryProps) => {
  const { toast } = useToast();
  const [evenings, setEvenings] = useState<FPEvening[]>([]);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [editTimingEvening, setEditTimingEvening] = useState<FPEvening | null>(null);
  const [editStartedAt, setEditStartedAt] = useState("");
  const [editCompletedAt, setEditCompletedAt] = useState("");
  const [editBlockTimings, setEditBlockTimings] = useState<string[]>([]);
  const [showTrash, setShowTrash] = useState(false);
  const [trashItems, setTrashItems] = useState<(FPEvening & { deletedAt?: string })[]>([]);
  const [restoringFromCloud, setRestoringFromCloud] = useState(false);

  const refreshData = useCallback(() => {
    setEvenings(StorageService.loadFPEvenings());
    setTrashItems(StorageService.loadFPTrash() as any);
  }, []);

  useEffect(() => {
    refreshData();
    
    const local = StorageService.loadFPEvenings();
    const syncToRemote = async () => {
      const completed = local.filter(e => e.completed);
      for (const ev of completed) {
        try {
          await RemoteStorageService.upsertEveningLiveWithTeam(ev as any, fpTeamId ?? null);
        } catch {}
      }
    };
    syncToRemote();
  }, [refreshData]);

  const sorted = [...evenings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleDelete = (id: string) => {
    StorageService.deleteFPEvening(id);
    // Also delete from remote so spectator link is cleaned up
    RemoteStorageService.deleteEvening(id).catch(() => {});
    refreshData();
    toast({ title: "הליגה הועברה לפח" });
  };

  const handleRestore = (id: string) => {
    const restored = StorageService.restoreFPEvening(id);
    if (restored) {
      refreshData();
      toast({ title: "הליגה שוחזרה בהצלחה!" });
    }
  };

  const handlePermanentDelete = (id: string) => {
    StorageService.permanentlyDeleteFPEvening(id);
    // Also permanently delete from remote
    RemoteStorageService.deleteEvening(id).catch(() => {});
    refreshData();
    toast({ title: "הליגה נמחקה לצמיתות" });
  };

  const handleRestoreFromCloud = useCallback(async () => {
    setRestoringFromCloud(true);
    try {
      const remoteEvenings = await RemoteStorageService.loadAllFPEvenings?.();
      if (!remoteEvenings || remoteEvenings.length === 0) {
        toast({ title: "לא נמצאו ליגות בענן", variant: "destructive" });
        return;
      }
      const localIds = new Set(StorageService.loadFPEvenings().map(e => e.id));
      let restored = 0;
      for (const ev of remoteEvenings) {
        if (!localIds.has(ev.id) && ev.completed) {
          StorageService.saveFPEvening(ev);
          restored++;
        }
      }
      refreshData();
      if (restored > 0) {
        toast({ title: `שוחזרו ${restored} ליגות מהענן!` });
      } else {
        toast({ title: "כל הליגות מהענן כבר קיימות מקומית" });
      }
    } catch {
      toast({ title: "שגיאה בשחזור מהענן", variant: "destructive" });
    } finally {
      setRestoringFromCloud(false);
    }
  }, [toast, refreshData]);

  const handleShare = useCallback(async (ev: FPEvening) => {
    setSharingId(ev.id);
    try {
      await RemoteStorageService.upsertEveningLiveWithTeam(ev as any, fpTeamId ?? null).catch(() => {});
      const code = await RemoteStorageService.getShareCode(ev.id);
      if (!code) {
        toast({ title: "לא ניתן ליצור קישור", description: "ודא שאתה מחובר", variant: "destructive" });
        return;
      }
      const url = `${window.location.origin}/spectate/${code}`;
      if (navigator.share) {
        try {
          await navigator.share({ title: "תוצאות ליגת 5 שחקנים", url });
          return;
        } catch {}
      }
      await navigator.clipboard.writeText(url);
      toast({ title: "קישור צפייה הועתק!" });
    } catch {
      toast({ title: "שגיאה ביצירת קישור", variant: "destructive" });
    } finally {
      setSharingId(null);
    }
  }, [toast]);

  return (
    <div className="min-h-[100svh] bg-gaming-bg p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]" dir="rtl">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5 rotate-180" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">היסטוריית ליגות 5 שחקנים</h1>
            <p className="text-xs text-muted-foreground">{sorted.length} ליגות</p>
          </div>
        </div>

        {/* Action buttons row */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {/* Public hub route was removed; per-tournament spectate links remain available below. */}
          <Button
            variant={showTrash ? "default" : "outline"}
            size="sm"
            className={showTrash ? "" : "border-border/50"}
            onClick={() => setShowTrash(!showTrash)}
          >
            <Trash2 className="h-3 w-3" />
            פח ({trashItems.length})
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-border/50"
            onClick={handleRestoreFromCloud}
            disabled={restoringFromCloud}
          >
            {restoringFromCloud ? <Loader2 className="h-3 w-3 animate-spin" /> : <Cloud className="h-3 w-3" />}
            שחזור מהענן
          </Button>
        </div>

        {/* Trash section */}
        {showTrash && (
          <div className="mb-4 space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
              <span className="text-sm text-muted-foreground">ליגות שנמחקו</span>
            </div>
            {trashItems.length === 0 ? (
              <Card className="bg-gaming-surface/30 border-border/30 p-4">
                <p className="text-center text-sm text-muted-foreground">הפח ריק</p>
              </Card>
            ) : (
              <>
                {trashItems.map(ev => (
                  <Card key={ev.id} className="bg-gaming-surface/30 border-destructive/20 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {new Date(ev.date).toLocaleDateString('he-IL')}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{ev.players.map(p => p.name).join(', ')}</p>
                        {ev.deletedAt && (
                          <p className="text-[10px] text-destructive/70 mt-0.5">
                            נמחק: {new Date(ev.deletedAt).toLocaleDateString('he-IL')}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" className="h-7 px-2 text-neon-green border-neon-green/30" onClick={() => handleRestore(ev.id)}>
                          <RotateCcw className="h-3 w-3" />
                          שחזר
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>מחיקה לצמיתות?</AlertDialogTitle>
                              <AlertDialogDescription>פעולה זו לא ניתנת לביטול.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>ביטול</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handlePermanentDelete(ev.id)} className="bg-destructive">מחק לצמיתות</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </Card>
                ))}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-destructive w-full text-xs">
                      רוקן פח
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>רוקן את כל הפח?</AlertDialogTitle>
                      <AlertDialogDescription>כל הליגות בפח יימחקו לצמיתות.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>ביטול</AlertDialogCancel>
                      <AlertDialogAction onClick={() => { StorageService.clearFPTrash(); refreshData(); toast({ title: "הפח רוקן" }); }} className="bg-destructive">רוקן</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        )}

        {sorted.length === 0 && !showTrash && (
          <Card className="bg-gaming-surface/50 border-border/50 p-6">
            <p className="text-center text-muted-foreground">אין היסטוריה עדיין</p>
          </Card>
        )}

        <div className="space-y-3">
          {sorted.map(ev => {
            const pairStats = calculatePairStats(ev);
            const playerStats = calculatePlayerStats(ev);
            const topPair = pairStats[0];
            const completedCount = ev.schedule.filter(m => m.completed).length;
            const isSharing = sharingId === ev.id;
            const effectiveDuration = ev.durationMinutes || (
              ev.startedAt && ev.completedAt
                ? Math.round((new Date(ev.completedAt).getTime() - new Date(ev.startedAt).getTime()) / 60000)
                : undefined
            );
            const validDuration = effectiveDuration && effectiveDuration > 0 ? effectiveDuration : undefined;

            return (
              <Collapsible key={ev.id}>
                <Card className="bg-gradient-card border-neon-green/20 shadow-card">
                  <CollapsibleTrigger className="w-full p-4 text-right">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {new Date(ev.date).toLocaleDateString('he-IL')}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {completedCount}/{ev.matchCount || 30} משחקים
                          </Badge>
                          {(ev.matchCount === 15) && (
                            <Badge variant="secondary" className="text-[10px]">קצרה</Badge>
                          )}
                        </div>
                        {validDuration ? (
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            {formatDuration(validDuration)}
                          </p>
                        ) : null}
                        <p className="text-sm text-muted-foreground">
                          {ev.players.map(p => p.name).join(', ')}
                        </p>
                      </div>
                      {topPair && (
                        <div className="text-left">
                          <Trophy className="h-4 w-4 text-yellow-400 inline ml-1" />
                          <span className="text-xs text-foreground">
                            {topPair.pair.players[0].name} & {topPair.pair.players[1].name}
                          </span>
                        </div>
                      )}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4 space-y-3">
                      <Tabs defaultValue="pairs">
                        <TabsList className="w-full grid grid-cols-2">
                          <TabsTrigger value="pairs">זוגות</TabsTrigger>
                          <TabsTrigger value="players">שחקנים</TabsTrigger>
                        </TabsList>
                        <TabsContent value="pairs">
                          <div className="overflow-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-right text-xs">#</TableHead>
                                  <TableHead className="text-right text-xs">זוג</TableHead>
                                  <TableHead className="text-center text-xs">נ</TableHead>
                                  <TableHead className="text-center text-xs">ת</TableHead>
                                  <TableHead className="text-center text-xs">ה</TableHead>
                                  <TableHead className="text-center text-xs font-bold">נק׳</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {pairStats.map((s, idx) => (
                                  <TableRow key={s.pair.id}>
                                    <TableCell className="text-xs">{idx + 1}</TableCell>
                                    <TableCell className="text-xs whitespace-nowrap">
                                      {s.pair.players[0].name} & {s.pair.players[1].name}
                                    </TableCell>
                                    <TableCell className="text-center text-xs">{s.wins}</TableCell>
                                    <TableCell className="text-center text-xs">{s.draws}</TableCell>
                                    <TableCell className="text-center text-xs">{s.losses}</TableCell>
                                    <TableCell className="text-center text-xs font-bold text-neon-green">{s.points}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </TabsContent>
                        <TabsContent value="players">
                          <div className="overflow-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-right text-xs">#</TableHead>
                                  <TableHead className="text-right text-xs">שחקן</TableHead>
                                  <TableHead className="text-center text-xs">מש׳</TableHead>
                                  <TableHead className="text-center text-xs">נ</TableHead>
                                  <TableHead className="text-center text-xs font-bold">נק׳</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {playerStats.map((s, idx) => (
                                  <TableRow key={s.player.id}>
                                    <TableCell className="text-xs">{idx + 1}</TableCell>
                                    <TableCell className="text-xs">{s.player.name}</TableCell>
                                    <TableCell className="text-center text-xs">{s.played}</TableCell>
                                    <TableCell className="text-center text-xs">{s.wins}</TableCell>
                                    <TableCell className="text-center text-xs font-bold text-neon-green">{s.points}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </TabsContent>
                      </Tabs>

                      {/* Timing info & edit */}
                      {ev.completed && (() => {
                        // Compute block durations for display
                        const blockDurations = ev.startedAt && ev.blockTimings && ev.blockTimings.length > 0
                          ? [...ev.blockTimings].sort((a, b) => a.blockIndex - b.blockIndex).map((bt, i, arr) => {
                              const prevEnd = i === 0 ? ev.startedAt! : arr[i - 1].completedAt;
                              const dur = Math.round((new Date(bt.completedAt).getTime() - new Date(prevEnd).getTime()) / 60000);
                              return { blockIndex: bt.blockIndex, completedAt: bt.completedAt, durationMinutes: Math.max(0, dur) };
                            })
                          : null;

                        return (
                          <div className="bg-gaming-surface/40 rounded-lg px-3 py-2 border border-border/30 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="text-xs space-y-0.5">
                                {ev.startedAt && (
                                  <p className="text-muted-foreground">התחלה: <span className="text-foreground">{new Date(ev.startedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span></p>
                                )}
                                {ev.completedAt && (
                                  <p className="text-muted-foreground">סיום: <span className="text-foreground">{new Date(ev.completedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span></p>
                                )}
                                {validDuration ? (
                                  <p className="text-muted-foreground">משך: <span className="text-neon-green font-medium">{formatDuration(validDuration)}</span></p>
                                ) : !ev.startedAt && !ev.completedAt ? (
                                  <p className="text-muted-foreground text-[10px]">לא הוגדרו זמנים</p>
                                ) : null}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground h-7 px-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const totalBlocks = (ev.matchCount || 30) / 5;
                                  const existingBT = ev.blockTimings || [];
                                  const blockValues: string[] = [];
                                  for (let i = 0; i < totalBlocks; i++) {
                                    const existing = existingBT.find(bt => bt.blockIndex === i);
                                    blockValues.push(existing ? toLocalDatetimeString(existing.completedAt) : "");
                                  }
                                  setEditTimingEvening(ev);
                                  setEditStartedAt(ev.startedAt ? toLocalDatetimeString(ev.startedAt) : toLocalDatetimeString(ev.date));
                                  setEditCompletedAt(ev.completedAt ? toLocalDatetimeString(ev.completedAt) : "");
                                  setEditBlockTimings(blockValues);
                                }}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                            </div>
                            {blockDurations && blockDurations.length > 0 && (
                              <div className="border-t border-border/30 pt-1.5 space-y-0.5">
                                <p className="text-[10px] text-muted-foreground font-medium">פירוט בלוקים</p>
                                {blockDurations.map(b => (
                                  <div key={b.blockIndex} className="flex justify-between text-[11px]">
                                    <span className="text-muted-foreground">בלוק {b.blockIndex + 1}</span>
                                    <span className="text-foreground">
                                      {new Date(b.completedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                      <span className="text-muted-foreground mr-1">({formatDuration(b.durationMinutes)})</span>
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full border-neon-green/30 text-neon-green hover:bg-neon-green/10"
                        onClick={(e) => { e.stopPropagation(); handleShare(ev); }}
                        disabled={isSharing}
                      >
                        {isSharing ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Share2 className="h-3 w-3" />
                        )}
                        {isSharing ? "יוצר קישור..." : "שתף תצוגת צפייה"}
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive w-full">
                            <Trash2 className="h-3 w-3" /> מחק
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>העבר לפח?</AlertDialogTitle>
                            <AlertDialogDescription>הליגה תועבר לפח ותוכל לשחזר אותה משם.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>ביטול</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(ev.id)} className="bg-destructive">העבר לפח</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>

        {/* Timing Edit Dialog */}
        <Dialog open={!!editTimingEvening} onOpenChange={(open) => { if (!open) setEditTimingEvening(null); }}>
          <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>עריכת זמני ליגה</DialogTitle>
              <DialogDescription>הגדר את שעת ההתחלה, הסיום וזמני סיום הבלוקים</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-foreground mb-1 block">שעת התחלה</label>
                <Input
                  type="datetime-local"
                  value={editStartedAt}
                  onChange={(e) => setEditStartedAt(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm text-foreground mb-1 block">שעת סיום</label>
                <Input
                  type="datetime-local"
                  value={editCompletedAt}
                  onChange={(e) => setEditCompletedAt(e.target.value)}
                />
              </div>

              {/* Block end times */}
              <div className="space-y-2">
                <label className="text-sm text-foreground font-medium block">זמני סיום בלוקים</label>
                <p className="text-[10px] text-muted-foreground">כל בלוק = 5 משחקים. הזן את שעת הסיום של כל בלוק.</p>
                {editBlockTimings.map((val, i) => {
                  // Compute block duration if possible
                  let blockDurLabel = "";
                  if (val) {
                    const prevEnd = i === 0
                      ? (editStartedAt ? new Date(editStartedAt).getTime() : null)
                      : (editBlockTimings[i - 1] ? new Date(editBlockTimings[i - 1]).getTime() : null);
                    if (prevEnd) {
                      const dur = Math.round((new Date(val).getTime() - prevEnd) / 60000);
                      if (dur > 0) blockDurLabel = `(${formatDuration(dur)})`;
                    }
                  }
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-16 shrink-0">בלוק {i + 1}</span>
                      <Input
                        type="datetime-local"
                        value={val}
                        onChange={(e) => {
                          const updated = [...editBlockTimings];
                          updated[i] = e.target.value;
                          setEditBlockTimings(updated);
                        }}
                        className="flex-1"
                      />
                      {blockDurLabel && (
                        <span className="text-[10px] text-neon-green whitespace-nowrap">{blockDurLabel}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setEditTimingEvening(null)}>ביטול</Button>
              <Button onClick={() => {
                if (!editTimingEvening) return;
                const startedAt = editStartedAt ? new Date(editStartedAt).toISOString() : undefined;
                const completedAt = editCompletedAt ? new Date(editCompletedAt).toISOString() : undefined;
                const durationMinutes = startedAt && completedAt
                  ? Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 60000)
                  : undefined;

                // Build blockTimings from inputs
                const blockTimings: FPBlockTiming[] = [];
                editBlockTimings.forEach((val, i) => {
                  if (val) {
                    blockTimings.push({ blockIndex: i, completedAt: new Date(val).toISOString() });
                  }
                });

                const updated: FPEvening = {
                  ...editTimingEvening,
                  startedAt,
                  completedAt,
                  durationMinutes: durationMinutes && durationMinutes > 0 ? durationMinutes : undefined,
                  blockTimings: blockTimings.length > 0 ? blockTimings : undefined,
                };

                StorageService.saveFPEvening(updated);
                RemoteStorageService.upsertEveningLiveWithTeam(updated as any, fpTeamId ?? null).catch(() => {});
                refreshData();
                setEditTimingEvening(null);
                toast({ title: "זמני הליגה עודכנו" });
              }}>
                שמור
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};