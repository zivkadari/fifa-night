import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, RotateCcw, ListOrdered, GripVertical, UserRound } from "lucide-react";
import { FPEvening, FPMatch } from "@/types/fivePlayerTypes";
import { useToast } from "@/hooks/use-toast";
import {
  DndContext,
  closestCenter,
  TouchSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";


interface FPScheduleReorderProps {
  evening: FPEvening;
  onUpdateEvening: (evening: FPEvening) => void;
  canEditSchedule?: boolean;
}

const pairName = (pair: { players: [{ name: string }, { name: string }] }) =>
  `${pair.players[0].name} & ${pair.players[1].name}`;

/* ─── Sortable match item ─── */
function SortableMatchItem({
  match,
  schedIdx,
  isCurrent,
  isCompleted,
  editMode,
}: {
  match: FPMatch;
  schedIdx: number;
  isCurrent: boolean;
  isCompleted: boolean;
  editMode: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: match.id,
    disabled: isCompleted || !editMode,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-lg px-2.5 py-2 border transition-all ${
        isDragging
          ? "bg-neon-green/10 border-neon-green/50 shadow-lg scale-[1.02]"
          : isCompleted
            ? "bg-gaming-surface/20 border-border/20 opacity-50"
            : isCurrent
              ? "bg-neon-green/10 border-neon-green/40 shadow-sm"
              : "bg-gaming-surface/40 border-border/30"
      }`}
    >
      {/* Drag handle or lock */}
      {editMode && !isCompleted ? (
        <button
          className="touch-none p-1 rounded text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing shrink-0"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      ) : (
        <span className="text-[10px] text-muted-foreground w-5 text-center shrink-0">
          {isCompleted ? (
            <Lock className="h-3 w-3 text-muted-foreground/50 mx-auto" />
          ) : (
            schedIdx + 1
          )}
        </span>
      )}

      {/* Match number */}
      <span className="text-[10px] text-muted-foreground w-5 text-center shrink-0">
        {schedIdx + 1}
      </span>

      {/* Current indicator */}
      {isCurrent && !isCompleted && (
        <div className="w-1.5 h-1.5 rounded-full bg-neon-green shrink-0 animate-pulse" />
      )}

      <div className="flex-1 min-w-0">
        <p className="text-xs text-foreground leading-tight">
          {pairName(match.pairA)} <span className="text-muted-foreground">vs</span>{" "}
          {pairName(match.pairB)}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <UserRound className="h-3 w-3" aria-hidden="true" />
            בחוץ: {match.sittingOut.name}
          </span>
          {isCompleted && match.scoreA !== undefined ? (
            <span className="font-mono tabular-nums text-foreground" dir="ltr">
              {match.scoreA} : {match.scoreB}
            </span>
          ) : (
            <span className="rounded-full border border-border/40 px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
              טרם שוחק
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ─── */
export const FPScheduleReorder = ({ evening, onUpdateEvening, canEditSchedule = false }: FPScheduleReorderProps) => {
  const { toast } = useToast();
  const [editMode, setEditMode] = useState(false);

  const currentIdx = evening.currentMatchIndex;
  const schedule = evening.schedule;

  // Only future (unplayed) match IDs are sortable
  const futureIds = useMemo(
    () => schedule.filter((_, i) => i >= currentIdx && !schedule[i].completed).map((m) => m.id),
    [schedule, currentIdx]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = schedule.findIndex((m) => m.id === active.id);
      const newIndex = schedule.findIndex((m) => m.id === over.id);

      // Safety: don't allow dropping into completed zone
      if (newIndex < currentIdx || oldIndex < currentIdx) return;

      const newSchedule = [...schedule];
      const [moved] = newSchedule.splice(oldIndex, 1);
      newSchedule.splice(newIndex, 0, moved);

      // Re-assign globalIndex
      const reindexed = newSchedule.map((m, i) => ({ ...m, globalIndex: i }));
      onUpdateEvening({ ...evening, schedule: reindexed });
    },
    [evening, schedule, currentIdx, onUpdateEvening]
  );

  const resetFutureOrder = useCallback(() => {
    const completed = schedule.slice(0, currentIdx);
    const future = [...schedule.slice(currentIdx)].sort((a, b) => {
      if (a.roundIndex !== b.roundIndex) return a.roundIndex - b.roundIndex;
      return a.matchIndex - b.matchIndex;
    });
    const newSchedule = [...completed, ...future].map((m, i) => ({
      ...m,
      globalIndex: i,
    }));
    onUpdateEvening({ ...evening, schedule: newSchedule });
    toast({ title: "סדר המשחקים אופס לסדר המקורי" });
  }, [evening, schedule, currentIdx, onUpdateEvening, toast]);

  // Block separators
  const getBlockLabel = (match: FPMatch) => `בלוק ${match.roundIndex + 1}`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <ListOrdered className="h-4 w-4 text-neon-green" />
          סדר משחקים
        </h3>
        <div className="flex gap-1.5">
          {canEditSchedule && editMode && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={resetFutureOrder}
            >
              <RotateCcw className="h-3 w-3 ml-1" />
              איפוס
            </Button>
          )}
          
          {canEditSchedule ? (
            <Button
              variant={editMode ? "neon" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setEditMode(!editMode)}
            >
              {editMode ? "סיום עריכה" : "ערוך סדר"}
            </Button>
          ) : (
            <Badge variant="outline" className="text-[10px] border-border/40 text-muted-foreground">
              אין הרשאה לשינוי סדר
            </Badge>
          )}
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={futureIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {schedule.map((match, schedIdx) => {
              const isCompleted = match.completed;
              const isCurrent = schedIdx === currentIdx;
              const prevMatch = schedIdx > 0 ? schedule[schedIdx - 1] : null;
              const showBlockSep = !prevMatch || prevMatch.roundIndex !== match.roundIndex;

              return (
                <div key={match.id}>
                  {showBlockSep && (
                    <div className="flex items-center gap-2 pt-2 pb-1">
                      <div className="h-px flex-1 bg-border/40" />
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {getBlockLabel(match)}
                      </span>
                      <div className="h-px flex-1 bg-border/40" />
                    </div>
                  )}
                  <SortableMatchItem
                    match={match}
                    schedIdx={schedIdx}
                    isCurrent={isCurrent}
                    isCompleted={isCompleted}
                    editMode={editMode}
                  />
                </div>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};
