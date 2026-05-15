 "use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Clock, Plus, X, GripVertical, AlertTriangle, ArrowRight, ChevronRight, List, Layers } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { showToast } from "@/components/ui/Toast";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragMoveEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  getTasksByTimeRange,
  createTask,
  updateTask,
  deleteTask,
  restoreTask,
  getAllProjects,
  db,
} from "@/lib/db";
import type { Task, Project } from "@/lib/types";
import {
  HOUR_HEIGHT,
  HOUR_COUNT,
  TOTAL_HEIGHT,
  pixelToMinutes,
  minutesToPixel,
  getEventPosition,
  formatTime,
  getCurrentTimePosition,
  getStartMinutes,
  detectConflicts,
  getTagColor,
  getTodayRange,
} from "@/lib/planner-utils";

const POLL_INTERVAL = 30000;
const MIN_DURATION_MINUTES = 15;

type ModalMode = "add" | "edit";

function DraggableEventCard({
  event,
  dayStart,
  isDragging,
  onClick,
  onDoubleClick,
  projectColor,
  projectName,
}: {
  event: Task;
  dayStart: number;
  isDragging: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  projectColor?: string;
  projectName?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging: isActive } =
    useDraggable({ id: event.id!, data: { event } });

  const { top, height } = getEventPosition(event.startTime!, event.endTime!, dayStart);
  // eslint-disable-next-line react-hooks/purity
  const isPast = event.endTime! < Date.now();
  const dragging = isDragging || isActive;

  const style = transform
    ? {
        top: top + transform.y,
        height: Math.max(height, 28),
        zIndex: dragging ? 40 : 1,
        opacity: dragging ? 0.5 : 1,
      }
    : {
        top,
        height: Math.max(height, 28),
        zIndex: 1,
        opacity: 1,
      };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick();
      }}
      className={`absolute left-1 right-1 rounded-lg border cursor-grab active:cursor-grabbing shadow-sm transition-shadow hover:shadow-md group ${
        isPast
          ? "bg-gray-100 border-gray-200 opacity-60"
          : "bg-primary-50 border-primary-200 hover:border-primary-300"
      } ${dragging ? "shadow-xl ring-2 ring-primary-400/50" : ""}`}
    >
      <div
        {...attributes}
        {...listeners}
        className="absolute top-0 left-0 right-0 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-grab"
      >
        <GripVertical className="w-3.5 h-3.5 text-gray-400" />
      </div>
      <div className="px-2 py-1 h-full flex flex-col overflow-hidden">
        <div className="flex items-center gap-1.5 flex-shrink-0 mt-1">
          <Clock className="w-3 h-3 text-[var(--muted-foreground)] flex-shrink-0" />
          <span className="text-xs text-[var(--muted-foreground)]">
            {formatTime(event.startTime!)} - {formatTime(event.endTime!)}
          </span>
        </div>
        <p className="text-sm font-medium text-[var(--foreground)] leading-tight mt-0.5 truncate">
          {event.title}
        </p>
        {projectName && (
          <div className="flex items-center gap-1 mt-0.5">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: projectColor }}
            />
            <span className="text-[10px] text-[var(--muted-foreground)] truncate">
              {projectName}
            </span>
          </div>
        )}
        {event.tags && event.tags.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap overflow-hidden">
            {event.tags.map((tag) => (
              <span
                key={tag}
                className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium flex-shrink-0 ${getTagColor(tag)}`}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-gray-300/30 to-transparent rounded-b-lg" />
    </div>
  );
}

function DraggableOverlay({ event, dayStart }: { event: Task; dayStart: number }) {
  const { height } = getEventPosition(event.startTime!, event.endTime!, dayStart);
  return (
    <div
      className="absolute left-1 right-1 rounded-lg border border-primary-300 bg-primary-50 shadow-xl ring-2 ring-primary-400/30 opacity-95 scale-[1.03]"
      style={{ height: Math.max(height, 28), width: "calc(100% - 8px)" }}
    >
      <div className="px-2 py-1 h-full flex flex-col overflow-hidden">
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Clock className="w-3 h-3 text-primary-500" />
          <span className="text-xs text-primary-600 font-medium">
            {formatTime(event.startTime!)} - {formatTime(event.endTime!)}
          </span>
        </div>
        <p className="text-sm font-semibold text-[var(--foreground)] leading-tight mt-0.5 truncate">
          {event.title}
        </p>
      </div>
    </div>
  );
}

function EventCard({
  event,
  dayStart,
  onClick,
  onDoubleClick,
  projectColor,
  projectName,
}: {
  event: Task;
  dayStart: number;
  onClick: () => void;
  onDoubleClick: () => void;
  projectColor?: string;
  projectName?: string;
}) {
  const { top, height } = getEventPosition(event.startTime!, event.endTime!, dayStart);
  // eslint-disable-next-line react-hooks/purity
  const isPast = event.endTime! < Date.now();

  return (
    <div
      style={{ top, height: Math.max(height, 28) }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick();
      }}
      className={`absolute left-1 right-1 rounded-lg border shadow-sm transition-shadow hover:shadow-md ${
        isPast
          ? "bg-gray-100 border-gray-200 opacity-60"
          : "bg-primary-50 border-primary-200 hover:border-primary-300"
      }`}
    >
      <div className="px-2 py-1 h-full flex flex-col overflow-hidden">
        <div className="flex items-center gap-1.5 flex-shrink-0 mt-1">
          <Clock className="w-3 h-3 text-[var(--muted-foreground)] flex-shrink-0" />
          <span className="text-xs text-[var(--muted-foreground)]">
            {formatTime(event.startTime!)} - {formatTime(event.endTime!)}
          </span>
        </div>
        <p className="text-sm font-medium text-[var(--foreground)] leading-tight mt-0.5 truncate">
          {event.title}
        </p>
        {projectName && (
          <div className="flex items-center gap-1 mt-0.5">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: projectColor }}
            />
            <span className="text-[10px] text-[var(--muted-foreground)] truncate">
              {projectName}
            </span>
          </div>
        )}
        {event.tags && event.tags.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap overflow-hidden">
            {event.tags.map((tag) => (
              <span
                key={tag}
                className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium flex-shrink-0 ${getTagColor(tag)}`}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineDroppable({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "timeline-droppable" });

  return (
    <div
      ref={setNodeRef}
      className={`relative flex-1 transition-colors ${
        isOver ? "bg-primary-50/30 ring-2 ring-primary-400/20 rounded-lg" : ""
      }`}
    >
      {children}
    </div>
  );
}

function DropIndicator({
  minutes,
  durationMinutes,
}: {
  minutes: number;
  durationMinutes: number;
}) {
  const top = minutesToPixel(minutes);
  const height = Math.max(minutesToPixel(durationMinutes), 28);

  return (
    <motion.div
      initial={{ opacity: 0, scaleY: 0.8 }}
      animate={{ opacity: 1, scaleY: 1 }}
      exit={{ opacity: 0, scaleY: 0.8 }}
      transition={{ duration: 0.15 }}
      className="absolute left-1 right-1 z-30 pointer-events-none"
      style={{ top, height }}
    >
      <div className="h-full rounded-lg border-2 border-dashed border-primary-400 bg-primary-100/50 flex items-center justify-center">
        <span className="text-xs font-medium text-primary-600">
          {String(Math.floor(minutes / 60)).padStart(2, "0")}:
          {String(minutes % 60).padStart(2, "0")}
        </span>
      </div>
    </motion.div>
  );
}

function ConflictResolver({
  conflicts,
  onResolve,
  onCancel,
}: {
  conflicts: Task[];
  pendingDrop: { eventId: number; newStart: number; newEnd: number; durationMinutes: number } | null;
  onResolve: (option: "before" | "after" | "override" | "cancel") => void;
  onCancel: () => void;
}) {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
      >
        <motion.div
          className="bg-[var(--card-bg)] rounded-t-2xl md:rounded-2xl shadow-xl w-full md:max-w-md md:-translate-y-1/2"
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--card-border)]">
            <AlertTriangle className="w-5 h-5 text-warning-500" />
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              时间冲突
            </h2>
          </div>

          <div className="px-5 py-4">
            <p className="text-sm text-[var(--muted-foreground)] mb-4">
              该时间段与以下 {conflicts.length} 个事件有重叠：
            </p>
            <div className="flex flex-col gap-2 mb-6">
              {conflicts.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/50"
                >
                  <div className="w-1 h-6 rounded-full bg-warning-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate">
                      {c.title}
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {formatTime(c.startTime!)} - {formatTime(c.endTime!)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-sm font-medium text-[var(--foreground)] mb-3">
              选择处理方式：
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => onResolve("before")}
                className="flex items-center justify-between px-4 py-3 rounded-xl border border-[var(--card-border)] hover:bg-primary-50 hover:border-primary-300 transition-colors text-left"
              >
                <div>
                  <span className="text-sm font-medium text-[var(--foreground)]">前置</span>
                  <span className="text-xs text-[var(--muted-foreground)] ml-2">
                    放在冲突事件之前
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--muted-foreground)]" />
              </button>
              <button
                onClick={() => onResolve("after")}
                className="flex items-center justify-between px-4 py-3 rounded-xl border border-[var(--card-border)] hover:bg-primary-50 hover:border-primary-300 transition-colors text-left"
              >
                <div>
                  <span className="text-sm font-medium text-[var(--foreground)]">后置</span>
                  <span className="text-xs text-[var(--muted-foreground)] ml-2">
                    放在冲突事件之后
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--muted-foreground)]" />
              </button>
              <button
                onClick={() => onResolve("override")}
                className="flex items-center justify-between px-4 py-3 rounded-xl border border-danger-300 hover:bg-danger-50 transition-colors text-left"
              >
                <div>
                  <span className="text-sm font-medium text-danger-600">覆盖</span>
                  <span className="text-xs text-[var(--muted-foreground)] ml-2">
                    删除冲突事件，使用新时间
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-danger-400" />
              </button>
            </div>
          </div>

          <div className="flex gap-3 px-5 py-4 border-t border-[var(--card-border)]">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-[var(--foreground)] border border-[var(--card-border)] hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              取消移动
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function MobileHeader({
  eventsCount,
  onAdd,
}: {
  eventsCount: number;
  onAdd: () => void;
}) {
  const now = new Date();
  const dateStr = `${now.getMonth() + 1}月${now.getDate()}日`;
  const weekDays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const weekDay = weekDays[now.getDay()];

  return (
    <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-[var(--card-bg)] border-b border-[var(--card-border)]">
      <div>
        <h1 className="text-lg font-semibold text-[var(--foreground)] leading-tight">
          {dateStr} {weekDay}
        </h1>
        <p className="text-xs text-[var(--muted-foreground)]">
          {eventsCount > 0
            ? `${eventsCount} 个事件`
            : "今天还没有安排"}
        </p>
      </div>
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={onAdd}
        aria-label="添加事件"
        className="flex items-center gap-1.5 bg-primary-500 text-white w-10 h-10 rounded-2xl shadow-sm hover:bg-primary-600 transition-colors"
      >
        <Plus className="w-5 h-5 mx-auto" />
      </motion.button>
    </header>
  );
}

function MobileOverview({
  events,
  loading,
  currentTimePos,
  onEventClick,
}: {
  events: Task[];
  loading: boolean;
  currentTimePos: number;
  onEventClick: (event: Task) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-[var(--muted-foreground)]">加载中...</span>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 6 ? "夜深了" : hour < 12 ? "早上好" : hour < 14 ? "中午好" : hour < 18 ? "下午好" : "晚上好";

    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/20 flex items-center justify-center mb-5">
          <List className="w-10 h-10 text-primary-400" />
        </div>
        <h2 className="text-xl font-bold text-[var(--foreground)] mb-2">
          {greeting}
        </h2>
        <p className="text-sm text-[var(--muted-foreground)] max-w-xs">
          向上滑动查看时间轴，或点击右下角「+」添加今天的事件
        </p>
      </div>
    );
  }

  const upcoming = events
    // eslint-disable-next-line react-hooks/purity
    .filter((e) => e.endTime! > Date.now())
    .sort((a, b) => a.startTime! - b.startTime!)
    .slice(0, 3);

  const nowMinutes = (currentTimePos / (HOUR_HEIGHT * HOUR_COUNT)) * 24 * 60;
  const currentHour = Math.floor(nowMinutes / 60);
  const currentMin = Math.floor(nowMinutes % 60);

  return (
    <div className="flex flex-col h-full px-4 pt-4 pb-2">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-400 to-red-500 flex items-center justify-center shadow-lg shadow-red-500/20">
          <Clock className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="text-xs text-[var(--muted-foreground)]">当前时间</p>
          <p className="text-2xl font-bold text-[var(--foreground)] tracking-tight">
            {String(currentHour).padStart(2, "0")}:{String(currentMin).padStart(2, "0")}
          </p>
        </div>
      </div>

      {upcoming.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-4 h-4 text-primary-500" />
            <span className="text-sm font-medium text-[var(--foreground)]">
              接下来
            </span>
          </div>

          <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
            {upcoming.map((event) => {
              // eslint-disable-next-line react-hooks/purity
              const isPast = event.endTime! < Date.now();

              return (
                <motion.button
                  key={event.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onEventClick(event)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-colors ${
                    isPast
                      ? "bg-gray-100 dark:bg-gray-800/40 opacity-50"
                      : "bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800/30"
                  }`}
                >
                  <div className="flex flex-col items-center flex-shrink-0 w-12">
                    <span className="text-sm font-semibold text-[var(--foreground)]">
                      {formatTime(event.startTime!)}
                    </span>
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {formatTime(event.endTime!)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate">
                      {event.title}
                    </p>
                    {event.tags && event.tags.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {event.tags.map((tag) => (
                          <span
                            key={tag}
                            className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${getTagColor(tag)}`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--muted-foreground)] flex-shrink-0" />
                </motion.button>
              );
            })}
          </div>

          {events.length > 3 && (
            <p className="text-center text-xs text-[var(--muted-foreground)] mt-3 pb-2">
              +{events.length - 3} 个更多事件 · 向上滑动查看完整时间轴
            </p>
          )}
        </>
      )}
      </div>
  );
}

export default function PlannerPage() {
  const [events, setEvents] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTimePos, setCurrentTimePos] = useState(getCurrentTimePosition());
  const [modalMode, setModalMode] = useState<ModalMode>("add");
  const [showModal, setShowModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Task | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeDragEvent, setActiveDragEvent] = useState<Task | null>(null);
  const [dropIndicatorMinutes, setDropIndicatorMinutes] = useState<number | null>(null);
  const [dayStart] = useState(() => getTodayRange().start);
  const [showConflictPanel, setShowConflictPanel] = useState(false);
  const [conflictingEvents, setConflictingEvents] = useState<Task[]>([]);
  const [pendingConflictDrop, setPendingConflictDrop] = useState<{
    eventId: number;
    newStart: number;
    newEnd: number;
    durationMinutes: number;
    mode?: "add" | "edit";
    formData?: ReturnType<typeof buildEventData>;
  } | null>(null);

  const [formTitle, setFormTitle] = useState("");
  const [formStartHour, setFormStartHour] = useState("09");
  const [formStartMin, setFormStartMin] = useState("00");
  const [formEndHour, setFormEndHour] = useState("10");
  const [formEndMin, setFormEndMin] = useState("00");
  const [formTags, setFormTags] = useState("");
  const [formProjectId, setFormProjectId] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);

  const projectMap = useMemo(() => {
    const map = new Map<string, Project>();
    projects.forEach((p) => map.set(p.id, p));
    return map;
  }, [projects]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const dayRange = useRef(getTodayRange());
  const scrolledRef = useRef(false);
  const dragStartMinutesRef = useRef(0);
  const dragEventDurationRef = useRef(0);
  const [dragDuration, setDragDuration] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor)
  );

  const fetchEvents = useCallback(async () => {
    const { start, end } = dayRange.current;
    const data = await getTasksByTimeRange(start, end);
    setEvents(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  useEffect(() => {
    getAllProjects().then(setProjects);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTimePos(getCurrentTimePosition());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (scrollRef.current && !scrolledRef.current) {
      const pos = getCurrentTimePosition();
      const viewportHeight = window.innerHeight;
      scrollRef.current.scrollTo({
        top: Math.max(0, pos - viewportHeight / 3),
        behavior: "smooth",
      });
      scrolledRef.current = true;
    }
  }, []);

  function handleDragStart(event: DragStartEvent) {
    const draggedEvent = events.find((e) => e.id === event.active.id);
    if (!draggedEvent) return;

    setActiveDragEvent(draggedEvent);
    setDropIndicatorMinutes(null);
    dragStartMinutesRef.current = getStartMinutes(draggedEvent.startTime!, dayRange.current.start);
    dragEventDurationRef.current = Math.round(
      (draggedEvent.endTime! - draggedEvent.startTime!) / 60000
    );
    setDragDuration(dragEventDurationRef.current);
  }

  function handleDragMove(event: DragMoveEvent) {
    const deltaY = event.delta.y;
    const newTotalPX = minutesToPixel(dragStartMinutesRef.current) + deltaY;
    const newMinutes = pixelToMinutes(newTotalPX);
    setDropIndicatorMinutes(newMinutes);
  }

  async function handleDragEnd() {
    const activeEvent = activeDragEvent;
    if (!activeEvent) {
      setActiveDragEvent(null);
      setDropIndicatorMinutes(null);
      return;
    }

    if (dropIndicatorMinutes === null) {
      setActiveDragEvent(null);
      return;
    }

    const durationMinutes = dragEventDurationRef.current;
    const dayStart = dayRange.current.start;
    const newStart = dayStart + dropIndicatorMinutes * 60000;
    const newEnd = newStart + durationMinutes * 60000;

    if (newEnd > dayStart + 24 * 60 * 60000) {
      setActiveDragEvent(null);
      setDropIndicatorMinutes(null);
      return;
    }

    const conflicts = await detectConflicts(newStart, newEnd, activeEvent.id);

    if (conflicts.length > 0) {
      setConflictingEvents(conflicts);
      setPendingConflictDrop({
        eventId: activeEvent.id!,
        newStart,
        newEnd,
        durationMinutes,
      });
      setShowConflictPanel(true);
    } else {
      try {
        await updateTask(activeEvent.id!, {
          startTime: newStart,
          endTime: newEnd,
        });
        await fetchEvents();
      } catch {
        // silently fail, toast would be added later
      }
    }

    setActiveDragEvent(null);
    setDropIndicatorMinutes(null);
  }

  async function handleConflictResolve(
    option: "before" | "after" | "override" | "cancel"
  ) {
    if (!pendingConflictDrop) return;

    setShowConflictPanel(false);

    if (option === "cancel") {
      setPendingConflictDrop(null);
      setConflictingEvents([]);
      return;
    }

    const isFormSave = pendingConflictDrop.mode != null;

    let resolvedStart = pendingConflictDrop.newStart;
    let resolvedEnd = pendingConflictDrop.newEnd;

    if (option === "before") {
      const earliestConflict = conflictingEvents.reduce((min, e) =>
        e.startTime! < min.startTime! ? e : min
      );
      resolvedEnd = earliestConflict.startTime!;
      resolvedStart = resolvedEnd - pendingConflictDrop.durationMinutes * 60000;
    } else if (option === "after") {
      const latestConflict = conflictingEvents.reduce((max, e) =>
        e.endTime! > max.endTime! ? e : max
      );
      resolvedStart = latestConflict.endTime!;
      resolvedEnd = resolvedStart + pendingConflictDrop.durationMinutes * 60000;
    }

    const dayEnd = dayRange.current.start + 24 * 60 * 60000;
    if (resolvedStart < dayRange.current.start)
      resolvedStart = dayRange.current.start;
    if (resolvedEnd > dayEnd) resolvedEnd = dayEnd;
    if (resolvedEnd - resolvedStart < MIN_DURATION_MINUTES * 60000) {
      resolvedEnd = resolvedStart + MIN_DURATION_MINUTES * 60000;
    }

    if (option === "override") {
      try {
        await db.transaction("rw", [db.tasks], async () => {
          for (const conflict of conflictingEvents) {
            await db.tasks.update(conflict.id!, { status: "archived" });
            if (conflict.captureSourceId != null) {
              await db.tasks.update(conflict.captureSourceId, {
                status: "active",
              });
            }
          }
          if (isFormSave) {
            const fd = pendingConflictDrop.formData!;
            if (pendingConflictDrop.mode === "add") {
              await createTask({
                title: fd.title,
                startTime: fd.startTime,
                endTime: fd.endTime,
                tags: fd.tags,
                status: "active",
                planned: true,
                focusSessions: [],
                type: "shortterm",
              });
            } else {
              await updateTask(pendingConflictDrop.eventId, {
                title: fd.title,
                startTime: fd.startTime,
                endTime: fd.endTime,
                tags: fd.tags,
              });
            }
          } else {
            await db.tasks.update(pendingConflictDrop.eventId, {
              startTime: pendingConflictDrop.newStart,
              endTime: pendingConflictDrop.newEnd,
              updatedAt: Date.now(),
            });
          }
        });
        await fetchEvents();
        if (isFormSave) closeModal();
      } catch {
        // silently fail
      }
    } else {
      try {
        if (isFormSave) {
          const fd = pendingConflictDrop.formData!;
          if (pendingConflictDrop.mode === "add") {
            await createTask({
              title: fd.title,
              startTime: resolvedStart,
              endTime: resolvedEnd,
              tags: fd.tags,
              status: "active",
              planned: true,
              focusSessions: [],
              type: "shortterm",
            });
          } else {
            await updateTask(pendingConflictDrop.eventId, {
              title: fd.title,
              startTime: resolvedStart,
              endTime: resolvedEnd,
              tags: fd.tags,
            });
          }
        } else {
          await updateTask(pendingConflictDrop.eventId, {
            startTime: resolvedStart,
            endTime: resolvedEnd,
          });
        }
        await fetchEvents();
        if (isFormSave) closeModal();
      } catch {
        // silently fail
      }
    }

    setPendingConflictDrop(null);
    setConflictingEvents([]);
  }

  function openAddModal() {
    setModalMode("add");
    setSelectedEvent(null);
    const now = new Date();
    const currentHour = now.getHours();
    const nextHour = (currentHour + 1) % 24;
    setFormTitle("");
    setFormStartHour(String(currentHour).padStart(2, "0"));
    setFormStartMin("00");
    setFormEndHour(String(nextHour).padStart(2, "0"));
    setFormEndMin("00");
    setFormTags("");
    setFormProjectId("");
    setShowModal(true);
  }

  function openEditModal(event: Task) {
    setModalMode("edit");
    setSelectedEvent(event);
    const start = new Date(event.startTime!);
    const end = new Date(event.endTime!);
    setFormTitle(event.title);
    setFormStartHour(String(start.getHours()).padStart(2, "0"));
    setFormStartMin(String(start.getMinutes()).padStart(2, "0"));
    setFormEndHour(String(end.getHours()).padStart(2, "0"));
    setFormEndMin(String(end.getMinutes()).padStart(2, "0"));
    setFormTags((event.tags ?? []).join(", "));
    setFormProjectId(event.projectId || "");
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setSelectedEvent(null);
  }

  function buildEventData() {
    const today = new Date();
    const sHour = parseInt(formStartHour, 10);
    const sMin = parseInt(formStartMin, 10);
    const eHour = parseInt(formEndHour, 10);
    const eMin = parseInt(formEndMin, 10);

    const startTime = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      sHour,
      sMin,
      0,
      0
    ).getTime();
    const endTime = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      eHour,
      eMin,
      0,
      0
    ).getTime();

    const tags = formTags
      .split(/[,，]\s*/)
      .map((t) => t.trim())
      .filter(Boolean);

    return {
      title: formTitle.trim(),
      startTime,
      endTime,
      tags,
      planned: true,
      focusSessions: [] as number[],
      projectId: formProjectId || undefined,
    };
  }

  async function handleSave() {
    if (!formTitle.trim()) return;
    const data = buildEventData();
    const excludeId = modalMode === "edit" ? selectedEvent?.id : undefined;
    const conflicts = await detectConflicts(data.startTime, data.endTime, excludeId);

    if (conflicts.length > 0) {
      setConflictingEvents(conflicts);
      setPendingConflictDrop({
        eventId: selectedEvent?.id ?? 0,
        newStart: data.startTime,
        newEnd: data.endTime,
        durationMinutes: Math.round((data.endTime - data.startTime) / 60000),
        mode: modalMode,
        formData: data,
      });
      setShowConflictPanel(true);
      return;
    }

    setSaving(true);
    try {
      if (modalMode === "add") {
        await createTask({ ...data, type: "shortterm", status: "active" } as Omit<Task, "id" | "createdAt" | "updatedAt">);
      } else if (modalMode === "edit" && selectedEvent?.id != null) {
        await updateTask(selectedEvent.id, {
          title: data.title,
          startTime: data.startTime,
          endTime: data.endTime,
          tags: data.tags,
        });
      }
      await fetchEvents();
      closeModal();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedEvent?.id) return;
    setSaving(true);
    try {
      const eventId = selectedEvent.id;
      await deleteTask(eventId);
      showToast({
        message: "已移入回收站",
        type: "info",
        duration: 5000,
        undoAction: async () => {
          await restoreTask(eventId);
          await fetchEvents();
        },
      });
      await fetchEvents();
      closeModal();
    } finally {
      setSaving(false);
    }
  }

  const timelineGrid = (
    <div className="relative flex" style={{ height: TOTAL_HEIGHT }}>
      <div className="sticky left-0 z-10 w-14 flex-shrink-0 bg-[var(--card-bg)] border-r border-[var(--card-border)]">
        {Array.from({ length: HOUR_COUNT }, (_, i) => (
          <div
            key={i}
            className="relative flex items-start justify-end pr-2"
            style={{ height: HOUR_HEIGHT }}
          >
            <span className="text-xs text-[var(--muted-foreground)] leading-none mt-[-0.5em]">
              {String(i).padStart(2, "0")}:00
            </span>
          </div>
        ))}
      </div>

      <TimelineDroppable>
        {Array.from({ length: HOUR_COUNT * 4 }, (_, i) => (
          <div
            key={i}
            className={`border-b ${
              i % 4 === 0
                ? "border-[var(--card-border)]"
                : "border-gray-100 dark:border-gray-800/30"
            }`}
            style={{ height: HOUR_HEIGHT / 4 }}
          />
        ))}

        {currentTimePos >= 0 && currentTimePos <= TOTAL_HEIGHT && (
          <motion.div
            className="absolute left-0 right-0 z-20 pointer-events-none"
            style={{ top: currentTimePos }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center">
              <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
              <div className="flex-1 h-px bg-red-500" />
            </div>
          </motion.div>
        )}

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--background)]/50 z-30">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-[var(--muted-foreground)]">
                加载中...
              </span>
            </div>
          </div>
        )}

        {!loading && events.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <Calendar className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-1">
              今天还没有安排
            </h3>
            <p className="text-sm text-[var(--muted-foreground)] max-w-xs mb-6">
              点击上方「添加事件」或从收件箱拖入来规划你的一天
            </p>
            <button
              onClick={openAddModal}
              className="bg-primary-500 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-primary-600 transition-colors text-sm"
            >
              创建第一个事件
            </button>
          </div>
        )}

        <AnimatePresence>
          {dropIndicatorMinutes !== null && activeDragEvent && (
            <DropIndicator
              minutes={dropIndicatorMinutes}
              durationMinutes={dragDuration}
            />
          )}
        </AnimatePresence>

        {!loading &&
          events.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{
                opacity: activeDragEvent?.id === event.id ? 0.3 : 1,
                x: 0,
              }}
              transition={{
                delay: index * 0.04,
                type: "spring",
                stiffness: 400,
                damping: 25,
              }}
            >
              <DraggableEventCard
                event={event}
                dayStart={dayStart}
                isDragging={activeDragEvent?.id === event.id}
                onClick={() => openEditModal(event)}
                onDoubleClick={() => openEditModal(event)}
                projectColor={event.projectId ? projectMap.get(event.projectId)?.color : undefined}
                projectName={event.projectId ? projectMap.get(event.projectId)?.name : undefined}
              />
            </motion.div>
          ))}
      </TimelineDroppable>
    </div>
  );

  const mobileTimelineGrid = (
    <div className="relative flex" style={{ height: TOTAL_HEIGHT }}>
      <div className="sticky left-0 z-10 w-14 flex-shrink-0 bg-[var(--card-bg)] border-r border-[var(--card-border)]">
        {Array.from({ length: HOUR_COUNT }, (_, i) => (
          <div
            key={i}
            className="relative flex items-start justify-end pr-2"
            style={{ height: HOUR_HEIGHT }}
          >
            <span className="text-xs text-[var(--muted-foreground)] leading-none mt-[-0.5em]">
              {String(i).padStart(2, "0")}:00
            </span>
          </div>
        ))}
      </div>

      <div className="relative flex-1">
        {Array.from({ length: HOUR_COUNT * 4 }, (_, i) => (
          <div
            key={i}
            className={`border-b ${
              i % 4 === 0
                ? "border-[var(--card-border)]"
                : "border-gray-100 dark:border-gray-800/30"
            }`}
            style={{ height: HOUR_HEIGHT / 4 }}
          />
        ))}

        {currentTimePos >= 0 && currentTimePos <= TOTAL_HEIGHT && (
          <motion.div
            className="absolute left-0 right-0 z-20 pointer-events-none"
            style={{ top: currentTimePos }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center">
              <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
              <div className="flex-1 h-px bg-red-500" />
            </div>
          </motion.div>
        )}

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--background)]/50 z-30">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-[var(--muted-foreground)]">
                加载中...
              </span>
            </div>
          </div>
        )}

        {!loading && events.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <Calendar className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-1">
              今天还没有安排
            </h3>
            <p className="text-sm text-[var(--muted-foreground)] max-w-xs mb-6">
              点击上方「添加事件」或从收件箱拖入来规划你的一天
            </p>
            <button
              onClick={openAddModal}
              className="bg-primary-500 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-primary-600 transition-colors text-sm"
            >
              创建第一个事件
            </button>
          </div>
        )}

        {!loading &&
          events.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                delay: index * 0.04,
                type: "spring",
                stiffness: 400,
                damping: 25,
              }}
            >
              <EventCard
                event={event}
                dayStart={dayStart}
                onClick={() => openEditModal(event)}
                onDoubleClick={() => openEditModal(event)}
                projectColor={event.projectId ? projectMap.get(event.projectId)?.color : undefined}
                projectName={event.projectId ? projectMap.get(event.projectId)?.name : undefined}
              />
            </motion.div>
          ))}
      </div>
    </div>
  );

  return (
    <>
      <div className="hidden md:flex flex-col h-full max-h-screen">
        <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--card-border)] bg-[var(--card-bg)]">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary-500" />
            <h1 className="text-lg font-semibold text-[var(--foreground)]">
              每日规划
            </h1>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={openAddModal}
            className="flex items-center gap-1.5 bg-primary-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary-600 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            添加事件
          </motion.button>
        </header>

        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis]}
        >
          <div className="flex-1 overflow-y-auto overscroll-contain" ref={scrollRef}>
            {timelineGrid}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeDragEvent ? (
              <DraggableOverlay event={activeDragEvent} dayStart={dayStart} />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <div className="md:hidden flex flex-col h-full max-h-screen">
        <MobileHeader
          eventsCount={events.length}
          onAdd={openAddModal}
        />
        <div className="flex-1 relative bg-[var(--background)] overflow-hidden">
          <MobileOverview
            events={events}
            loading={loading}
            currentTimePos={currentTimePos}
            onEventClick={openEditModal}
          />
        </div>
        <BottomSheet snapPoints={[25, 50, 85]} defaultSnap={1} open={true}>
          <div className="h-full overflow-y-auto overscroll-contain">
            {mobileTimelineGrid}
          </div>
        </BottomSheet>
      </div>

    <AnimatePresence>
        {showModal && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/40 z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
            />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--card-bg)] rounded-t-2xl shadow-xl max-h-[90vh] overflow-y-auto md:inset-auto md:top-1/2 md:left-1/2 md:bottom-auto md:right-auto md:w-full md:max-w-md md:rounded-2xl md:-translate-x-1/2 md:-translate-y-1/2"
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--card-border)]">
                <h2 className="text-lg font-semibold text-[var(--foreground)]">
                  {modalMode === "add" ? "添加事件" : "编辑事件"}
                </h2>
                <button
                  onClick={closeModal}
                  aria-label="关闭"
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <X className="w-5 h-5 text-[var(--muted-foreground)]" />
                </button>
              </div>

              <div className="px-5 py-4 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[var(--foreground)]">
                    标题
                  </label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="例如：团队站会"
                    autoFocus
                    className="w-full px-3 py-2.5 rounded-xl border border-[var(--card-border)] bg-[var(--background)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-colors"
                  />
                </div>

                <div className="flex gap-3">
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-[var(--foreground)]">
                      开始时间
                    </label>
                    <div className="flex gap-1.5 items-center">
                      <select
                        value={formStartHour}
                        onChange={(e) => setFormStartHour(e.target.value)}
                        className="flex-1 px-2 py-2.5 rounded-xl border border-[var(--card-border)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-colors appearance-none text-center"
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <option key={i} value={String(i).padStart(2, "0")}>
                            {String(i).padStart(2, "0")}
                          </option>
                        ))}
                      </select>
                      <span className="text-sm text-[var(--muted-foreground)]">:</span>
                      <select
                        value={formStartMin}
                        onChange={(e) => setFormStartMin(e.target.value)}
                        className="flex-1 px-2 py-2.5 rounded-xl border border-[var(--card-border)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-colors appearance-none text-center"
                      >
                        {Array.from({ length: 60 }, (_, i) => (
                          <option key={i} value={String(i).padStart(2, "0")}>
                            {String(i).padStart(2, "0")}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-[var(--foreground)]">
                      结束时间
                    </label>
                    <div className="flex gap-1.5 items-center">
                      <select
                        value={formEndHour}
                        onChange={(e) => setFormEndHour(e.target.value)}
                        className="flex-1 px-2 py-2.5 rounded-xl border border-[var(--card-border)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-colors appearance-none text-center"
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <option key={i} value={String(i).padStart(2, "0")}>
                            {String(i).padStart(2, "0")}
                          </option>
                        ))}
                      </select>
                      <span className="text-sm text-[var(--muted-foreground)]">:</span>
                      <select
                        value={formEndMin}
                        onChange={(e) => setFormEndMin(e.target.value)}
                        className="flex-1 px-2 py-2.5 rounded-xl border border-[var(--card-border)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-colors appearance-none text-center"
                      >
                        {Array.from({ length: 60 }, (_, i) => (
                          <option key={i} value={String(i).padStart(2, "0")}>
                            {String(i).padStart(2, "0")}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[var(--foreground)]">
                    标签（逗号分隔）
                  </label>
                  <input
                    type="text"
                    value={formTags}
                    onChange={(e) => setFormTags(e.target.value)}
                    placeholder="例如：工作, 重要, 会议"
                    className="w-full px-3 py-2.5 rounded-xl border border-[var(--card-border)] bg-[var(--background)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[var(--foreground)]">
                    所属项目
                  </label>
                  <select
                    value={formProjectId}
                    onChange={(e) => setFormProjectId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[var(--card-border)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-colors appearance-none"
                  >
                    <option value="">无项目</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 px-5 py-4 border-t border-[var(--card-border)]">
                {modalMode === "edit" && (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleDelete}
                    disabled={saving}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium text-danger-500 border border-danger-500/30 hover:bg-danger-50 transition-colors disabled:opacity-50"
                  >
                    删除
                  </motion.button>
                )}
                <button
                  onClick={closeModal}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-[var(--foreground)] border border-[var(--card-border)] hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  取消
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSave}
                  disabled={saving || !formTitle.trim()}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-primary-500 text-white hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "保存中..." : "保存"}
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {showConflictPanel && (
        <ConflictResolver
          conflicts={conflictingEvents}
          pendingDrop={pendingConflictDrop}
          onResolve={handleConflictResolve}
          onCancel={() => {
            setShowConflictPanel(false);
            setPendingConflictDrop(null);
            setConflictingEvents([]);
          }}
        />
      )}

    </>
  );
}
