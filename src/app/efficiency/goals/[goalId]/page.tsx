"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Check, Plus, CheckCircle2, TrendingUp, ChevronDown,
  X, Trash2, Pencil, Zap, Layers,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { useEfficiencyStore } from "@/lib/store/efficiencyStore";
import {
  efficiencyDB, type Goal, type ScheduleTask, type Project, type Phase,
  getAllProjects, addScheduleTask, addPhase, deletePhase, getPhasesForGoal,
} from "@/lib/db/efficiency.db";
import { daylogDB, type Item, addItem, timeToSort } from "@/lib/db/daylog.db";
import { showToast } from "@/components/ui/Toast";
import { parseBulkTasks, flattenTasks } from "@/lib/bulkTaskParser";
import { CreateTaskSheet } from "@/components/efficiency/CreateTaskSheet";

const ACCENT = "#6366F1";
const GREEN = "#34C759";

const TIME_SLOTS_MULTI = [
  { key: "morning", label: "早上", time: "08:00" },
  { key: "forenoon", label: "上午", time: "10:00" },
  { key: "noon", label: "中午", time: "12:00" },
  { key: "afternoon", label: "下午", time: "15:00" },
  { key: "evening", label: "晚上", time: "18:00" },
  { key: "night", label: "睡前", time: "22:00" },
] as const;

const REPEAT_OPTIONS = [
  { value: "none", label: "无" },
  { value: "daily", label: "每天" },
  { value: "weekdays", label: "工作日" },
  { value: "weekly", label: "每周" },
] as const;

function todayStr(): string { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function addDays(ds: string, n: number): string { const d = new Date(ds+"T00:00:00"); d.setDate(d.getDate()+n); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function endTimeFrom(start: string): string { const [h,m] = start.split(":").map(Number); const t = h*60+m+30; return `${String(Math.floor(t/60)%24).padStart(2,"0")}:${String(t%60).padStart(2,"0")}`; }
function fmtDate(ds: string): string { if(!ds) return ""; const [_,m,d] = ds.split("-"); return `${parseInt(m)}/${parseInt(d)}`; }

interface ItemGroup { key: string; title: string; items: Item[]; completedCount: number; totalCount: number; }

function groupItems(items: Item[]): ItemGroup[] {
  const map = new Map<string, Item[]>();
  for (const i of items) { const k = i.repeatGroupId || i.title; if(!map.has(k)) map.set(k,[]); map.get(k)!.push(i); }
  return Array.from(map.entries()).map(([key,g]) => ({ key, title: g[0]?.title||key, items: g, completedCount: g.filter(x=>x.isCompleted).length, totalCount: g.length }));
}

export default function GoalDetailPage() {
  const router = useRouter();
  const params = useParams();
  const goalId = params.goalId as string;
  const { loadGoals, updateGoalStatus, toggleScheduleTask, removeScheduleTask } = useEfficiencyStore();

  const goal = useLiveQuery(() => efficiencyDB.goals.get(goalId), [goalId]);
  const allTasks = useLiveQuery(() => efficiencyDB.scheduleTasks.toArray(), []);
  const projects = useLiveQuery(() => getAllProjects(), [], [] as Project[]);
  const phases = useLiveQuery(() => getPhasesForGoal(goalId), [goalId], [] as Phase[]);
  const allItems = useLiveQuery(() => daylogDB.items.where("goalId").equals(goalId).toArray(), [goalId], [] as Item[]);

  const goalColor = useMemo(() => { if(!goal) return ACCENT; const p = projects.find(pp=>pp.id===goal.projectId); return p?.color||ACCENT; }, [goal,projects]);
  const tasks = useMemo(() => (allTasks??[]).filter(t=>t.goalId===goalId), [allTasks,goalId]);
  const goalProgress = useMemo(() => allItems.length===0?0:Math.round(allItems.filter(i=>i.isCompleted).length/allItems.length*100), [allItems]);
  const allCompleted = useMemo(() => allItems.length>0&&allItems.every(i=>i.isCompleted), [allItems]);

  const unassignedItems = useMemo(() => allItems.filter(i=>!i.phaseId&&!i.taskId), [allItems]);
  const unassignedGroups = useMemo(() => groupItems(unassignedItems), [unassignedItems]);

  const taskItemsMap = useMemo(() => { const m=new Map<string,Item[]>(); for(const i of allItems){ if(!i.taskId) continue; if(!m.has(i.taskId)) m.set(i.taskId,[]); m.get(i.taskId)!.push(i); } return m; }, [allItems]);
  const phaseDirectItemsMap = useMemo(() => { const m=new Map<string,Item[]>(); for(const i of allItems){ if(!i.phaseId||i.taskId) continue; if(!m.has(i.phaseId)) m.set(i.phaseId,[]); m.get(i.phaseId)!.push(i); } return m; }, [allItems]);
  const phaseTasksMap = useMemo(() => { const m=new Map<string,ScheduleTask[]>(); for(const t of tasks){ if(!t.phaseId) continue; if(!m.has(t.phaseId)) m.set(t.phaseId,[]); m.get(t.phaseId)!.push(t); } return m; }, [tasks]);

  const unphasedTasks = useMemo(() => tasks.filter(t=>!t.phaseId), [tasks]);

  useEffect(() => { let c=false; (async()=>{ const dup=new Map<string,string[]>(); for(const i of allItems){ const k=`${i.title}|${i.date}`; const l=dup.get(k)||[]; l.push(i.id); dup.set(k,l); } const td:string[]=[]; for(const[,ids] of dup){ if(ids.length>5) td.push(...ids.slice(1)); } if(td.length>0&&!c){ await daylogDB.transaction("rw",daylogDB.items,async()=>{ for(const id of td) await daylogDB.items.delete(id); }); } })(); return ()=>{c=true}; }, [allItems]);

  const [expandedPhaseId, setExpandedPhaseId] = useState<string|null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string|null>(null);

  /* Phase form */ const [showPhaseSheet, setShowPhaseSheet] = useState(false); const [phaseName, setPhaseName] = useState(""); const [phaseStart, setPhaseStart] = useState(todayStr()); const [phaseEnd, setPhaseEnd] = useState(addDays(todayStr(),7)); const [phaseSaving, setPhaseSaving] = useState(false);
  const openPhaseSheet = useCallback(()=>{ const td=todayStr(); setPhaseName(""); setPhaseStart(td); setPhaseEnd(addDays(td,7)); setShowPhaseSheet(true); },[]);
  const handleCreatePhase = useCallback(async()=>{ if(!phaseName.trim()){ showToast({type:"warning",message:"请输入阶段名称"}); return; } setPhaseSaving(true); try{ await addPhase({goalId,name:phaseName.trim(),startDate:phaseStart,endDate:phaseEnd,sortOrder:phases.length}); showToast({type:"success",message:"阶段已添加"}); setShowPhaseSheet(false); }catch{ showToast({type:"error",message:"添加失败"}); } finally{ setPhaseSaving(false); } },[phaseName,phaseStart,phaseEnd,goalId,phases.length]);

  /* Item form */ const [showItemSheet, setShowItemSheet] = useState(false); const [itemTitle, setItemTitle] = useState(""); const [itemStart, setItemStart] = useState("09:00"); const [itemEnd, setItemEnd] = useState("09:30"); const [itemNote, setItemNote] = useState(""); const [itemRepeat, setItemRepeat] = useState<"none"|"daily"|"weekdays"|"weekly">("none"); const [itemDateFrom, setItemDateFrom] = useState(todayStr()); const [itemDateTo, setItemDateTo] = useState(todayStr()); const [itemTimeSlots, setItemTimeSlots] = useState<string[]>(["morning"]); const [itemTaskId, setItemTaskId] = useState<string|null>(null); const [itemPhaseId, setItemPhaseId] = useState<string|null>(null); const [itemSubmitting, setItemSubmitting] = useState(false);
  const openItemSheet = useCallback((taskId?:string|null, phaseId?:string|null)=>{ const td=todayStr(); setItemTitle(""); setItemStart("09:00"); setItemEnd("09:30"); setItemNote(""); setItemRepeat("none"); setItemDateFrom(td); setItemDateTo(td); setItemTimeSlots(["morning"]); if(taskId){ const t=tasks.find(x=>x.id===taskId); setItemTaskId(taskId); setItemPhaseId(t?.phaseId||phaseId||null); } else { setItemTaskId(null); setItemPhaseId(phaseId||null); } setShowItemSheet(true); },[tasks]);
  const handleCreateItem = useCallback(async()=>{ if(!itemTitle.trim()){ showToast({type:"warning",message:"标题还没填"}); return; } if(itemTimeSlots.length===0){ showToast({type:"warning",message:"至少选一个时段"}); return; } const fromMs=new Date(itemDateFrom+"T00:00:00").getTime(); const toMs=new Date(itemDateTo+"T00:00:00").getTime(); const dayCount=Math.floor((toMs-fromMs)/86400000)+1; if(dayCount<0){ showToast({type:"warning",message:"结束日期不能早于开始日期"}); return; } if(dayCount>90){ showToast({type:"warning",message:"日期范围过大，最多90天"}); return; } setItemSubmitting(true); try{ const rgid=crypto.randomUUID(); const dates:string[]=[]; let cur=itemDateFrom; while(cur<=itemDateTo){ dates.push(cur); cur=addDays(cur,1); if(dates.length>=dayCount+1) break; } for(const date of dates){ for(const sk of itemTimeSlots){ const slot=TIME_SLOTS_MULTI.find(s=>s.key===sk); const st=slot?.time||itemStart; await addItem({ date,plannedStart:st,plannedEnd:itemEnd||endTimeFrom(st),actualStart:st,actualEnd:itemEnd||endTimeFrom(st),isCorrected:false,sourceType:"manual",sourceId:crypto.randomUUID(),title:itemTitle.trim(),color:goalColor,icon:"CheckSquare",note:itemNote||undefined,projectId:goal?.projectId||undefined,goalId,taskId:itemTaskId||undefined,phaseId:itemPhaseId||undefined,isCompleted:false,repeat:itemRepeat==="none"?undefined:itemRepeat,repeatGroupId:rgid,sortOrder:timeToSort(st) }); } } showToast({type:"success",message:`已添加 ${dates.length*itemTimeSlots.length} 条`}); setShowItemSheet(false); }catch{ showToast({type:"error",message:"没有添加成功，再试一次？"}); } finally{ setItemSubmitting(false); } },[itemTitle,itemStart,itemEnd,itemNote,itemRepeat,itemDateFrom,itemDateTo,itemTimeSlots,itemTaskId,itemPhaseId,goalColor,goal,goalId]);

  const handleToggleItem = useCallback(async(id:string)=>{ const item=await daylogDB.items.get(id); if(item) await daylogDB.items.update(id,{isCompleted:!item.isCompleted}); },[]);
  const handleToggleTask = useCallback(async(tid:string)=>{ await toggleScheduleTask(tid); },[toggleScheduleTask]);
  const handleDeleteTask = useCallback(async(tid:string)=>{ await removeScheduleTask(tid); showToast({type:"success",message:"已删除"}); },[removeScheduleTask]);

  /* Task edit */ const [editingTask, setEditingTask] = useState<ScheduleTask|null>(null); const [editTitle, setEditTitle] = useState(""); const [editNote, setEditNote] = useState(""); const [editReminderStr, setEditReminderStr] = useState("");
  const openEdit = useCallback((t:ScheduleTask)=>{ setEditingTask(t); setEditTitle(t.title); setEditNote(t.note||""); setEditReminderStr((t.reminderTimes||[]).join(", ")); },[]);
  const handleSaveEdit = useCallback(async()=>{ if(!editingTask) return; const r=editReminderStr.split(",").map(s=>s.trim()).filter(Boolean); await useEfficiencyStore.getState().updateScheduleTask(editingTask.id,{title:editTitle,note:editNote,reminderTimes:r.length>0?r:undefined}); showToast({type:"success",message:"任务已更新"}); setEditingTask(null); },[editingTask,editTitle,editNote,editReminderStr]);

  /* Bulk import */ const [showBulkImport, setShowBulkImport] = useState(false); const [bulkText, setBulkText] = useState(""); const [bulkLoading, setBulkLoading] = useState(false);
  const handleBulkImport = useCallback(async()=>{ if(!bulkText.trim()) return; setBulkLoading(true); try{ const p=parseBulkTasks(bulkText); const f=flattenTasks(p,goalId); for(const t of f) await addScheduleTask(t as any); showToast({type:"success",message:`已导入 ${f.length} 条`}); setShowBulkImport(false); setBulkText(""); }catch{ showToast({type:"error",message:"格式有问题，检查一下？"}); } finally{ setBulkLoading(false); } },[bulkText,goalId]);

  const handleCompleteGoal = useCallback(async()=>{ if(!goal||!allCompleted) return; await updateGoalStatus(goalId,"completed"); showToast({type:"success",message:"目标已完成"}); router.push("/efficiency"); },[goal,goalId,allCompleted,updateGoalStatus,router]);
  const handleDeletePhase = useCallback(async(pid:string)=>{ if(!window.confirm("确定删除该阶段？阶段内的任务只会取消关联，不会被删除。")) return; await deletePhase(pid); showToast({type:"success",message:"阶段已删除"}); },[]);

  /* Task create with phaseId */ const [showTaskSheet, setShowTaskSheet] = useState(false); const [taskPhaseId, setTaskPhaseId] = useState<string|null>(null);
  const openTaskSheet = useCallback((pid?:string)=>{ setTaskPhaseId(pid||null); setShowTaskSheet(true); },[]);
  const handleTaskSubmit = useCallback(async(task:Omit<ScheduleTask,"id"|"createdAt">)=>{ await addScheduleTask({...task,goalId,phaseId:taskPhaseId||undefined} as any); showToast({type:"success",message:"任务已添加"}); setShowTaskSheet(false); },[goalId,taskPhaseId]);

  useEffect(()=>{ loadGoals(); },[loadGoals]);

  if(!goal) return (
    <div className="min-h-screen" style={{maxWidth:430,margin:"0 auto",background:"var(--lifeflow-background)"}}>
      <div className="flex items-center h-14 px-4" style={{paddingTop:"var(--safe-area-top)"}}>
        <button onClick={()=>router.push("/efficiency")} className="w-8 h-8 -ml-1 flex items-center justify-center"><ChevronLeft className="w-6 h-6" style={{color:"var(--color-text-primary)"}}/></button>
      </div>
      <div className="flex flex-col items-center pt-20"><p className="text-[15px]" style={{color:"var(--color-text-disabled)"}}>目标不存在</p></div>
    </div>
  );

  const cs = { background: "var(--lifeflow-background)", border: "1px solid var(--lifeflow-border)", color: "var(--color-text-primary)" };
  const btnBase = { border: "1px solid var(--lifeflow-border)", color: "var(--color-text-secondary)", background: "var(--color-surface-card)" };

  return (
    <div className="min-h-screen pb-[100px]" style={{maxWidth:430,margin:"0 auto",background:"var(--lifeflow-background)"}}>
      {/* Header */}
      <div className="px-5 pt-[var(--safe-area-top)] pb-2 flex items-center justify-between">
        <button onClick={()=>router.push("/efficiency")} className="w-8 h-8 -ml-1 flex items-center justify-center"><ChevronLeft className="w-6 h-6" style={{color:"var(--color-text-primary)"}}/></button>
        <h1 className="text-[17px] font-semibold" style={{color:"var(--color-text-primary)"}}>目标详情</h1>
        <div className="w-8"/>
      </div>

      {/* Goal Card */}
      <div className="mx-4 p-5 rounded-[20px]" style={{background:"var(--color-surface-card)",boxShadow:"var(--shadow-card)"}}>
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{backgroundColor:goalColor}}/>
          <h1 className="text-[20px] font-bold truncate flex-1" style={{color:"var(--color-text-primary)"}}>{goal.title}</h1>
        </div>
        <div className="mt-4 flex items-end justify-between">
          <div><p className="text-[13px]" style={{color:"var(--color-text-secondary)"}}>{allItems.length>0?`${allItems.filter(i=>i.isCompleted).length}/${allItems.length} 事项`:"暂无事项"}</p></div>
          <span className="text-[28px] font-bold tabular-nums" style={{color:"var(--color-text-primary)"}}>{goalProgress}%</span>
        </div>
        <div className="mt-2 h-2 rounded-full overflow-hidden" style={{background:"var(--lifeflow-muted)"}}>
          <motion.div className="h-full rounded-full" style={{backgroundColor:goalColor}} initial={{width:0}} animate={{width:`${goalProgress}%`}} transition={{duration:0.6,ease:"easeOut"}}/>
        </div>
        {allItems.length>0&&!allCompleted&&<p className="mt-2 text-[13px]" style={{color:"var(--color-text-secondary)"}}>还剩 {allItems.length-allItems.filter(i=>i.isCompleted).length} 项未完成</p>}
        {allCompleted&&allItems.length>0&&<p className="mt-2 text-[13px]" style={{color:GREEN}}>所有事项已完成</p>}
        {goal.note&&<p className="mt-2 text-[13px]" style={{color:"var(--color-text-secondary)"}}>{goal.note}</p>}
      </div>

      {/* Quick Actions */}
      <div className="mx-4 mt-3 flex gap-2">
        <button onClick={openPhaseSheet} className="flex-1 h-11 rounded-xl text-[15px] font-medium flex items-center justify-center gap-1.5" style={btnBase}><Layers className="w-4 h-4"/>添加阶段</button>
        <button onClick={()=>openItemSheet(null,null)} className="flex-[2] h-11 rounded-xl text-white text-[15px] font-semibold flex items-center justify-center gap-1.5 active:opacity-90" style={{background:goalColor}}><Zap className="w-4 h-4"/>添加事项</button>
      </div>

      {/* Phase List */}
      {phases.length>0&&(
        <div className="mx-4 mt-5">
          <h2 className="text-[13px] font-semibold mb-2 px-1" style={{color:"var(--color-text-disabled)"}}>阶段</h2>
          <div className="flex flex-col gap-2">
            {phases.map(p=>{
              const pt=phaseTasksMap.get(p.id)||[]; const pd=phaseDirectItemsMap.get(p.id)||[];
              const isExp=expandedPhaseId===p.id;
              return <PhaseCard key={p.id} phase={p} tasks={pt} directItems={pd} taskItemsMap={taskItemsMap} isExpanded={isExp} expandedTaskId={expandedTaskId} goalColor={goalColor}
                onToggleExpand={()=>setExpandedPhaseId(isExp?null:p.id)} onToggleTaskExpand={tid=>setExpandedTaskId(expandedTaskId===tid?null:tid)}
                onAddTask={()=>openTaskSheet(p.id)} onAddItem={tid=>openItemSheet(tid)} onToggleTask={handleToggleTask}
                onDeleteTask={handleDeleteTask} onEditTask={openEdit} onToggleItem={handleToggleItem} onDeletePhase={()=>handleDeletePhase(p.id)}/>;
            })}
          </div>
        </div>
      )}

      {/* Unphased Tasks */}
      {unphasedTasks.length>0&&(
        <div className="mx-4 mt-5">
          <h2 className="text-[13px] font-semibold mb-2 px-1" style={{color:"var(--color-text-disabled)"}}>未归阶段的任务</h2>
          <div className="flex flex-col gap-2">
            {unphasedTasks.map(task=>{
              const ti=taskItemsMap.get(task.id)||[]; const ig=groupItems(ti); const isExp=expandedTaskId===task.id; const idone=ti.filter(i=>i.isCompleted).length;
              return <div key={task.id}>
                <TaskCard task={task} itemCount={ti.length} itemDone={idone} isExpanded={isExp} onToggle={()=>handleToggleTask(task.id)} onDelete={()=>handleDeleteTask(task.id)} onEdit={()=>openEdit(task)} onExpand={()=>setExpandedTaskId(isExp?null:task.id)} onCreateItem={()=>openItemSheet(task.id)} color={goalColor}/>
                <AnimatePresence>{isExp&&<motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} transition={{duration:0.2}} className="overflow-hidden">
                  <div className="ml-3 mt-1 pl-3 border-l-2" style={{borderColor:goalColor}}>
                    {ig.length>0?<div className="flex flex-col gap-1.5 py-1">{ig.map(g=><ItemGroupCard key={g.key} group={g} color={goalColor} onToggle={handleToggleItem} compact/>)}</div>:<p className="text-[13px] py-2 px-2" style={{color:"var(--color-text-disabled)"}}>暂无事项</p>}
                  </div>
                </motion.div>}</AnimatePresence>
              </div>;
            })}
          </div>
        </div>
      )}

      {/* Unassigned Items */}
      {unassignedGroups.length>0&&(
        <div className="mx-4 mt-5">
          <h2 className="text-[13px] font-semibold mb-2 px-1" style={{color:"var(--color-text-disabled)"}}>未归阶段的事项</h2>
          <div className="flex flex-col gap-2">{unassignedGroups.map(g=><ItemGroupCard key={g.key} group={g} color={goalColor} onToggle={handleToggleItem}/>)}</div>
        </div>
      )}

      {/* Empty */}
      {phases.length===0&&tasks.length===0&&unassignedGroups.length===0&&(
        <div className="flex flex-col items-center pt-10 px-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{background:"var(--lifeflow-brand-50)"}}><TrendingUp className="w-8 h-8" style={{color:"var(--lifeflow-primary)"}}/></div>
          <p className="text-[16px] font-semibold" style={{color:"var(--color-text-primary)"}}>拆解目标</p>
          <p className="text-[13px] text-center mt-1 mb-6" style={{color:"var(--color-text-secondary)"}}>先添加阶段划分大方向，再往里添加任务和具体事项。</p>
          <div className="flex gap-2 w-full max-w-xs">
            <button onClick={openPhaseSheet} className="flex-1 h-11 rounded-xl text-[15px] font-medium flex items-center justify-center gap-1.5" style={btnBase}><Layers className="w-4 h-4"/>添加阶段</button>
            <button onClick={()=>openItemSheet(null,null)} className="flex-1 h-11 rounded-xl text-white text-[15px] font-semibold flex items-center justify-center gap-1.5" style={{background:goalColor}}><Zap className="w-4 h-4"/>添加事项</button>
          </div>
        </div>
      )}

      {/* Complete Goal */}
      {(tasks.length>0||allItems.length>0)&&(
        <div className="mx-4 mt-4">
          <button onClick={handleCompleteGoal} disabled={!allCompleted} className="w-full h-12 rounded-xl text-[15px] font-semibold flex items-center justify-center gap-1.5 transition-all"
            style={{border:allCompleted?`1.5px solid ${GREEN}`:"1px solid var(--lifeflow-border)",color:allCompleted?GREEN:"var(--color-text-disabled)",background:allCompleted?`${GREEN}10`:"transparent"}}>
            <CheckCircle2 className="w-4 h-4"/>完成目标
          </button>
        </div>
      )}

      {/* Phase Create Sheet */}
      <AnimatePresence>{showPhaseSheet&&(<>
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 bg-black/40" onClick={()=>setShowPhaseSheet(false)}/>
        <motion.div initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}} transition={{type:"spring",damping:30,stiffness:300}} className="fixed left-0 right-0 bottom-0 z-[60] rounded-t-[24px] max-w-[430px] mx-auto px-4 pt-4 overflow-y-auto"
          style={{background:"var(--color-surface-card)",paddingBottom:"calc(24px + env(safe-area-inset-bottom))",maxHeight:"90vh"}} onClick={e=>e.stopPropagation()}>
          <div className="w-8 h-1 rounded-full mx-auto mb-4" style={{background:"var(--lifeflow-border)"}}/>
          <h3 className="text-[17px] font-bold mb-4" style={{color:"var(--color-text-primary)"}}>添加阶段</h3>
          <label className="text-[13px] mb-1 block" style={{color:"var(--color-text-secondary)"}}>阶段名称</label>
          <input value={phaseName} onChange={e=>setPhaseName(e.target.value)} className="w-full h-11 rounded-xl px-3 text-[15px] outline-none mb-3" style={cs} placeholder="如：设计阶段、开发阶段" autoFocus/>
          <label className="text-[13px] mb-1 block" style={{color:"var(--color-text-secondary)"}}>开始 / 结束日期</label>
          <div className="flex gap-3 mb-4">
            <input type="date" value={phaseStart} onChange={e=>setPhaseStart(e.target.value)} className="flex-1 h-11 rounded-xl px-3 text-[15px] outline-none" style={cs}/>
            <span className="flex items-center text-[13px]" style={{color:"var(--color-text-disabled)"}}>至</span>
            <input type="date" value={phaseEnd} onChange={e=>setPhaseEnd(e.target.value)} className="flex-1 h-11 rounded-xl px-3 text-[15px] outline-none" style={cs}/>
          </div>
          <button onClick={handleCreatePhase} disabled={phaseSaving} className="w-full py-3.5 rounded-full text-[16px] font-semibold text-white disabled:opacity-50 active:opacity-90" style={{background:goalColor}}>{phaseSaving?"保存中...":"添加阶段"}</button>
        </motion.div>
      </>)}</AnimatePresence>

      {/* Item Create Sheet */}
      <AnimatePresence>{showItemSheet&&(<>
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 bg-black/40" onClick={()=>setShowItemSheet(false)}/>
        <motion.div initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}} transition={{type:"spring",damping:30,stiffness:300}} className="fixed left-0 right-0 bottom-0 z-[60] rounded-t-[24px] max-w-[430px] mx-auto px-4 pt-4 overflow-y-auto"
          style={{background:"var(--color-surface-card)",paddingBottom:"calc(24px + env(safe-area-inset-bottom))",maxHeight:"90vh"}} onClick={e=>e.stopPropagation()}>
          <div className="w-8 h-1 rounded-full mx-auto mb-4" style={{background:"var(--lifeflow-border)"}}/>
          <h3 className="text-[17px] font-bold mb-4" style={{color:"var(--color-text-primary)"}}>添加事项 {itemTaskId?`· ${tasks.find(t=>t.id===itemTaskId)?.title||""}`:""}</h3>
          <label className="text-[13px] mb-1 block" style={{color:"var(--color-text-secondary)"}}>标题</label>
          <input value={itemTitle} onChange={e=>setItemTitle(e.target.value)} className="w-full h-11 rounded-xl px-3 text-[15px] outline-none mb-3" style={cs} placeholder="事项名称" autoFocus/>
          <label className="text-[13px] mb-1 block" style={{color:"var(--color-text-secondary)"}}>日期范围</label>
          <div className="flex gap-3 mb-3"><input type="date" value={itemDateFrom} onChange={e=>setItemDateFrom(e.target.value)} className="flex-1 h-11 rounded-xl px-3 text-[15px] outline-none" style={cs}/><span className="flex items-center text-[13px]" style={{color:"var(--color-text-disabled)"}}>至</span><input type="date" value={itemDateTo} onChange={e=>setItemDateTo(e.target.value)} className="flex-1 h-11 rounded-xl px-3 text-[15px] outline-none" style={cs}/></div>
          <label className="text-[13px] mb-1 block" style={{color:"var(--color-text-secondary)"}}>时段（可多选）</label>
          <div className="flex flex-wrap gap-2 mb-3">{TIME_SLOTS_MULTI.map(s=>{ const a=itemTimeSlots.includes(s.key); return <button key={s.key} onClick={()=>setItemTimeSlots(p=>p.includes(s.key)?p.filter(k=>k!==s.key):[...p,s.key])} className="h-9 px-3 rounded-full text-[13px] font-medium transition-all" style={{background:a?goalColor:"var(--lifeflow-background)",color:a?"#fff":"var(--color-text-secondary)",border:a?"none":"1px solid var(--lifeflow-border)"}}>{s.label} {s.time}</button>; })}</div>
          <label className="text-[13px] mb-1 block" style={{color:"var(--color-text-secondary)"}}>开始 / 结束时间</label>
          <div className="flex gap-3 mb-3"><input type="time" value={itemStart} onChange={e=>setItemStart(e.target.value)} className="flex-1 h-11 rounded-xl px-3 text-[15px] outline-none" style={cs}/><input type="time" value={itemEnd} onChange={e=>setItemEnd(e.target.value)} className="flex-1 h-11 rounded-xl px-3 text-[15px] outline-none" style={cs}/></div>
          <label className="text-[13px] mb-1 block" style={{color:"var(--color-text-secondary)"}}>重复</label>
          <div className="flex gap-2 mb-3">{REPEAT_OPTIONS.map(o=>{ const a=itemRepeat===o.value; return <button key={o.value} onClick={()=>setItemRepeat(o.value)} className="flex-1 h-9 rounded-full text-[13px] font-medium transition-all" style={{background:a?goalColor:"var(--lifeflow-background)",color:a?"#fff":"var(--color-text-secondary)",border:a?"none":"1px solid var(--lifeflow-border)"}}>{o.label}</button>; })}</div>
          {/* Phase selector */}
          <label className="text-[13px] mb-1 block" style={{color:"var(--color-text-secondary)"}}>归属阶段（可选）</label>
          <div className="flex flex-wrap gap-2 mb-3">
            <button onClick={()=>setItemPhaseId(null)} className="h-9 px-3 rounded-full text-[13px] font-medium transition-all" style={{background:!itemPhaseId?goalColor:"var(--lifeflow-background)",color:!itemPhaseId?"#fff":"var(--color-text-secondary)",border:!itemPhaseId?"none":"1px solid var(--lifeflow-border)"}}>无阶段</button>
            {phases.map(p=>{ const a=itemPhaseId===p.id; return <button key={p.id} onClick={()=>setItemPhaseId(p.id)} className="h-9 px-3 rounded-full text-[13px] font-medium transition-all truncate max-w-[160px]" style={{background:a?goalColor:"var(--lifeflow-background)",color:a?"#fff":"var(--color-text-secondary)",border:a?"none":"1px solid var(--lifeflow-border)"}}>{p.name}</button>; })}
          </div>
          {/* Task selector */}
          <label className="text-[13px] mb-1 block" style={{color:"var(--color-text-secondary)"}}>归属任务（可选）</label>
          <div className="flex flex-wrap gap-2 mb-3">
            <button onClick={()=>setItemTaskId(null)} className="h-9 px-3 rounded-full text-[13px] font-medium transition-all" style={{background:!itemTaskId?goalColor:"var(--lifeflow-background)",color:!itemTaskId?"#fff":"var(--color-text-secondary)",border:!itemTaskId?"none":"1px solid var(--lifeflow-border)"}}>无归属</button>
            {tasks.map(t=>{ const a=itemTaskId===t.id; return <button key={t.id} onClick={()=>{setItemTaskId(t.id); if(t.phaseId) setItemPhaseId(t.phaseId);}} className="h-9 px-3 rounded-full text-[13px] font-medium transition-all truncate max-w-[160px]" style={{background:a?goalColor:"var(--lifeflow-background)",color:a?"#fff":"var(--color-text-secondary)",border:a?"none":"1px solid var(--lifeflow-border)"}}>{t.title}</button>; })}
          </div>
          <label className="text-[13px] mb-1 block" style={{color:"var(--color-text-secondary)"}}>备注（可选）</label>
          <input value={itemNote} onChange={e=>setItemNote(e.target.value)} className="w-full h-11 rounded-xl px-3 text-[15px] outline-none mb-4" style={cs} placeholder="备注"/>
          <button onClick={handleCreateItem} disabled={itemSubmitting} className="w-full py-3.5 rounded-full text-[16px] font-semibold text-white disabled:opacity-50 active:opacity-90" style={{background:goalColor}}>{itemSubmitting?"处理中...":"添加事项"}</button>
        </motion.div>
      </>)}</AnimatePresence>

      {/* Task Create Sheet */}
      <CreateTaskSheet open={showTaskSheet} goalId={goalId} onClose={()=>setShowTaskSheet(false)} onSubmit={handleTaskSubmit} lite/>

      {/* Edit Task Sheet */}
      <AnimatePresence>{editingTask&&(<>
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 bg-black/40" onClick={()=>setEditingTask(null)}/>
        <motion.div initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}} transition={{type:"spring",damping:30,stiffness:300}} className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-8 pt-4 rounded-t-[24px]" style={{background:"var(--color-surface-card)",boxShadow:"0 -4px 20px rgba(0,0,0,0.1)"}}>
          <div className="w-8 h-1 rounded-full mx-auto mb-4" style={{background:"var(--lifeflow-border)"}}/>
          <h3 className="text-[17px] font-bold mb-4" style={{color:"var(--color-text-primary)"}}>编辑任务</h3>
          <input value={editTitle} onChange={e=>setEditTitle(e.target.value)} className="w-full h-11 rounded-xl px-3 text-[15px] outline-none mb-3" style={cs} placeholder="任务名称"/>
          <input value={editNote} onChange={e=>setEditNote(e.target.value)} className="w-full h-11 rounded-xl px-3 text-[15px] outline-none mb-3" style={cs} placeholder="备注（可选）"/>
          <input value={editReminderStr} onChange={e=>setEditReminderStr(e.target.value)} className="w-full h-11 rounded-xl px-3 text-[15px] outline-none mb-3" style={cs} placeholder="提醒时间，逗号分隔"/>
          <div className="flex gap-2">
            <button onClick={()=>setEditingTask(null)} className="flex-1 h-11 rounded-xl text-[15px] font-medium" style={{background:"var(--lifeflow-background)",color:"var(--color-text-secondary)"}}>取消</button>
            <button onClick={handleSaveEdit} className="flex-1 h-11 rounded-xl text-[15px] font-semibold text-white" style={{background:"var(--lifeflow-primary)"}}>保存</button>
          </div>
        </motion.div>
      </>)}</AnimatePresence>

      {/* Bulk Import Sheet */}
      <AnimatePresence>{showBulkImport&&(<>
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 bg-black/40" onClick={()=>setShowBulkImport(false)}/>
        <motion.div initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}} transition={{type:"spring",damping:30,stiffness:300}} className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-8 pt-4 rounded-t-[24px]" style={{background:"var(--color-surface-card)",boxShadow:"0 -4px 20px rgba(0,0,0,0.1)"}}>
          <div className="w-8 h-1 rounded-full mx-auto mb-4" style={{background:"var(--lifeflow-border)"}}/>
          <h3 className="text-[17px] font-bold mb-4" style={{color:"var(--color-text-primary)"}}>批量导入任务</h3>
          <p className="text-[12px] mb-3" style={{color:"var(--color-text-disabled)"}}>每行一个任务，| 分隔字段，缩进表示子任务，# 开头为注释</p>
          <textarea value={bulkText} onChange={e=>setBulkText(e.target.value)} className="w-full h-40 rounded-xl p-3 text-[14px] outline-none resize-none mb-3 font-mono" style={cs} placeholder={`设计阶段 | 日期:7/24~7/30\n  原型设计 | 备注:使用Figma\n  交互评审`}/>
          <div className="flex gap-2">
            <button onClick={()=>setShowBulkImport(false)} className="flex-1 h-11 rounded-xl text-[15px] font-medium" style={{background:"var(--lifeflow-background)",color:"var(--color-text-secondary)"}}>取消</button>
            <button onClick={handleBulkImport} disabled={bulkLoading} className="flex-1 h-11 rounded-xl text-[15px] font-semibold text-white" style={{background:"var(--lifeflow-primary)"}}>{bulkLoading?"导入中...":"导入"}</button>
          </div>
        </motion.div>
      </>)}</AnimatePresence>
    </div>
  );
}

/* ============================================================
   Phase Card
   ============================================================ */
function PhaseCard({phase,tasks,directItems,taskItemsMap,isExpanded,expandedTaskId,goalColor,onToggleExpand,onToggleTaskExpand,onAddTask,onAddItem,onToggleTask,onDeleteTask,onEditTask,onToggleItem,onDeletePhase}:{
  phase:Phase; tasks:ScheduleTask[]; directItems:Item[]; taskItemsMap:Map<string,Item[]>; isExpanded:boolean; expandedTaskId:string|null; goalColor:string;
  onToggleExpand:()=>void; onToggleTaskExpand:(tid:string)=>void; onAddTask:()=>void; onAddItem:(tid?:string|null)=>void;
  onToggleTask:(tid:string)=>void; onDeleteTask:(tid:string)=>void; onEditTask:(t:ScheduleTask)=>void; onToggleItem:(id:string)=>void; onDeletePhase:()=>void;
}) {
  const dg = useMemo(()=>groupItems(directItems),[directItems]);
  return (
    <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="rounded-[20px] overflow-hidden" style={{background:"var(--color-surface-card)",boxShadow:"var(--shadow-card)"}}>
      <div className="flex items-center gap-3 px-4 py-3 min-h-[52px]">
        <button type="button" onClick={onToggleExpand} className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor:goalColor}}/><p className="text-[17px] font-semibold truncate" style={{color:"var(--color-text-primary)"}}>{phase.name}</p></div>
          <p className="text-[13px] mt-0.5 ml-4" style={{color:"var(--color-text-secondary)"}}>{fmtDate(phase.startDate)} - {fmtDate(phase.endDate)}</p>
        </button>
        <button type="button" onClick={e=>{e.stopPropagation();onAddTask();}} className="h-8 px-3 rounded-full text-[13px] font-medium flex items-center gap-1" style={{border:`1px solid ${goalColor}`,color:goalColor}}><Plus className="w-3.5 h-3.5"/>添加任务</button>
        <button type="button" onClick={onToggleExpand} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{background:"var(--lifeflow-muted)"}}><ChevronDown className="w-4 h-4 transition-transform" style={{color:"var(--color-text-secondary)",transform:isExpanded?"rotate(180deg)":"rotate(0deg)"}}/></button>
      </div>
      <AnimatePresence>{isExpanded&&<motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} transition={{duration:0.2}} className="overflow-hidden">
        <div className="px-4 pb-3"><div style={{borderTop:"0.5px solid var(--lifeflow-border)"}} className="pt-2">
          {dg.map(g=><div key={g.key} className="mb-1.5"><ItemGroupCard group={g} color={goalColor} onToggle={onToggleItem} compact/></div>)}
          {tasks.map(task=>{
            const ti=taskItemsMap.get(task.id)||[]; const ig=groupItems(ti); const isTaskExp=expandedTaskId===task.id; const idone=ti.filter(i=>i.isCompleted).length;
            return <div key={task.id} className="mb-1.5">
              <TaskCard task={task} itemCount={ti.length} itemDone={idone} isExpanded={isTaskExp} onToggle={()=>onToggleTask(task.id)} onDelete={()=>onDeleteTask(task.id)} onEdit={()=>onEditTask(task)} onExpand={()=>onToggleTaskExpand(task.id)} onCreateItem={()=>onAddItem(task.id)} color={goalColor}/>
              <AnimatePresence>{isTaskExp&&<motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} transition={{duration:0.2}} className="overflow-hidden">
                <div className="ml-3 mt-1 pl-3 border-l-2" style={{borderColor:goalColor}}>
                  {ig.length>0?<div className="flex flex-col gap-1.5 py-1">{ig.map(g=><ItemGroupCard key={g.key} group={g} color={goalColor} onToggle={onToggleItem} compact/>)}</div>:<p className="text-[13px] py-2 px-2" style={{color:"var(--color-text-disabled)"}}>暂无事项</p>}
                </div>
              </motion.div>}</AnimatePresence>
            </div>;
          })}
          {tasks.length===0&&directItems.length===0&&<div className="flex flex-col items-center py-4">
            <p className="text-[13px] mb-3" style={{color:"var(--color-text-disabled)"}}>暂无任务或事项</p>
            <button onClick={e=>{e.stopPropagation();onAddTask();}} className="h-9 px-4 rounded-full text-[13px] font-medium mb-2" style={{border:`1px dashed ${goalColor}`,color:goalColor}}><Plus className="w-3.5 h-3.5 inline mr-1"/>添加任务</button>
            <button onClick={e=>{e.stopPropagation();onDeletePhase();}} className="h-8 px-3 rounded-full text-[13px] font-medium" style={{color:"#FF3B30"}}><Trash2 className="w-3 h-3 inline mr-1"/>删除阶段</button>
          </div>}
        </div></div>
      </motion.div>}</AnimatePresence>
    </motion.div>
  );
}

/* ============================================================
   Task Card
   ============================================================ */
function TaskCard({task,itemCount,itemDone,isExpanded,onToggle,onDelete,onEdit,onExpand,onCreateItem,color}:{
  task:ScheduleTask; itemCount:number; itemDone:number; isExpanded:boolean; onToggle:()=>void; onDelete:()=>void; onEdit:()=>void; onExpand:()=>void; onCreateItem:()=>void; color:string;
}) {
  const pp=task.progressType==="progress"&&task.targetValue?Math.min(100,Math.max(0,Math.round((itemDone/task.targetValue)*100))):0;
  return (
    <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="rounded-[20px] overflow-hidden" style={{background:"var(--color-surface-card)",boxShadow:"var(--shadow-card)"}}>
      <div className="flex items-center gap-3 px-4 py-3 min-h-[52px]">
        <button type="button" onClick={e=>{e.stopPropagation();onToggle();}} className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center" style={{border:task.isCompleted?"none":"2px solid var(--color-text-disabled)",background:task.isCompleted?ACCENT:"transparent"}}>{task.isCompleted&&<Check className="w-[14px] h-[14px] text-white" strokeWidth={3}/>}</button>
        <div className="flex-1 min-w-0" onClick={onExpand}>
          <div className="flex items-center gap-1.5"><p className="text-[17px] truncate" style={{color:task.isCompleted?"var(--color-text-disabled)":"var(--color-text-primary)",textDecoration:task.isCompleted?"line-through":"none"}}>{task.title}</p>{task.isImportant&&!task.isCompleted&&<span className="w-[6px] h-[6px] rounded-full flex-shrink-0" style={{background:ACCENT}}/>}</div>
          <div className="flex items-center gap-2 mt-0.5">
            {task.progressType==="progress"&&task.targetValue&&<span className="text-[13px]" style={{color:"var(--color-text-secondary)"}}>{itemDone}/{task.targetValue}{task.targetUnit||""} ({pp}%)</span>}
            {itemCount>0&&<span className="text-[13px]" style={{color:"var(--color-text-disabled)"}}>{itemDone}/{itemCount} 事项</span>}
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <button type="button" onClick={e=>{e.stopPropagation();onEdit();}} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{background:"var(--lifeflow-brand-50)"}}><Pencil className="w-3.5 h-3.5" style={{color:ACCENT}}/></button>
          <button type="button" onClick={e=>{e.stopPropagation();if(window.confirm("确定删除任务？")) onDelete();}} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{background:"#FF3B3015"}}><X className="w-3.5 h-3.5" style={{color:"#FF3B30"}}/></button>
          <button type="button" onClick={e=>{e.stopPropagation();onExpand();}} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{background:"var(--lifeflow-muted)"}}><ChevronDown className="w-4 h-4 transition-transform" style={{color:"var(--color-text-secondary)",transform:isExpanded?"rotate(180deg)":"rotate(0deg)"}}/></button>
        </div>
      </div>
      {task.progressType==="progress"&&task.targetValue&&<div className="px-4 pb-3"><div className="h-1.5 rounded-full overflow-hidden" style={{background:"var(--lifeflow-muted)"}}><motion.div className="h-full rounded-full" style={{backgroundColor:color}} initial={{width:0}} animate={{width:`${pp}%`}} transition={{duration:0.6,ease:"easeOut"}}/></div></div>}
    </motion.div>
  );
}

/* ============================================================
   Item Group Card
   ============================================================ */
function ItemGroupCard({group,color,onToggle,compact}:{group:ItemGroup; color:string; onToggle:(id:string)=>void; compact?:boolean;}) {
  const [expanded,setExpanded]=useState(false); const allDone=group.completedCount===group.totalCount;
  return (
    <div className="rounded-[20px] overflow-hidden" style={{background:"var(--color-surface-card)",boxShadow:"var(--shadow-card)"}}>
      <button onClick={()=>setExpanded(!expanded)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
        <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center" style={{border:allDone?"none":"2px solid var(--color-text-disabled)",background:allDone?color:"transparent"}}>{allDone&&<Check className="w-[14px] h-[14px] text-white" strokeWidth={3}/>}</div>
        <span className="flex-1 text-[15px] font-medium truncate" style={{color:allDone?"var(--color-text-disabled)":"var(--color-text-primary)",textDecoration:allDone?"line-through":"none"}}>{group.title}</span>
        <span className="text-[13px] px-2 py-0.5 rounded-full" style={{background:"var(--lifeflow-muted)",color:"var(--color-text-secondary)"}}>{group.completedCount}/{group.totalCount}</span>
        <ChevronDown className="w-4 h-4 transition-transform" style={{color:"var(--color-text-disabled)",transform:expanded?"rotate(180deg)":"rotate(0deg)"}}/>
      </button>
      <AnimatePresence>{expanded&&<motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} transition={{duration:0.2}} className="overflow-hidden">
        <div className="px-4 pb-3"><div style={{borderTop:"0.5px solid var(--lifeflow-border)"}} className="pt-2">
          {group.items.map(item=><div key={item.id} className="flex items-center gap-3 py-1.5">
            <button onClick={()=>onToggle(item.id)} className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center" style={{border:item.isCompleted?"none":"1.5px solid var(--color-text-disabled)",background:item.isCompleted?color:"transparent"}}>{item.isCompleted&&<Check className="w-[11px] h-[11px] text-white" strokeWidth={3}/>}</button>
            <div className="flex-1 min-w-0 flex items-center gap-2"><span className="text-[12px] tabular-nums" style={{color:"var(--color-text-disabled)"}}>{item.date.slice(5)}</span><span className="text-[12px]" style={{color:"var(--color-text-disabled)"}}>{item.plannedStart}-{item.plannedEnd}</span></div>
          </div>)}
        </div></div>
      </motion.div>}</AnimatePresence>
    </div>
  );
}
