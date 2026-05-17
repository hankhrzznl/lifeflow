"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Edit3, Save, Clock, Target, FileText, Layers,
  Check,
} from "lucide-react";
import { getSection, updateSection, getBoard } from "@/lib/db";
import { showToast } from "@/components/ui/Toast";
import type { Section, Board } from "@/lib/types";

function formatDate(ts: number | undefined): string {
  if (!ts) return "";
  return new Date(ts).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

interface SectionDetailProps {
  sectionId: number;
  onClose: () => void;
  onUpdate?: () => void;
}

export default function SectionDetail({ sectionId, onClose, onUpdate }: SectionDetailProps) {
  const [section, setSection] = useState<Section | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const [draftName, setDraftName] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [draftSuccessCriteria, setDraftSuccessCriteria] = useState("");
  const [draftStartTime, setDraftStartTime] = useState("");

  const loadSection = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getSection(sectionId);
      setSection(s || null);
      const b = s?.boardId ? await getBoard(s.boardId) : null;
      setBoard(b || null);
    } catch { setLoadError(true); }
    finally { setLoading(false); }
  }, [sectionId]);

  useEffect(() => { const f = async () => { await loadSection(); }; f(); }, [loadSection]);

  const handleStartEdit = () => {
    if (!section) return;
    setDraftName(section.name);
    setDraftNote(section.note || "");
    setDraftSuccessCriteria(section.successCriteria || "");
    setDraftStartTime(section.startTime ? new Date(section.startTime).toISOString().slice(0, 16) : "");
    setEditing(true);
  };

  const handleSave = async () => {
    if (!section || saving) return;
    setSaving(true);
    try {
      await updateSection(section.id!, {
        name: draftName,
        note: draftNote || undefined,
        successCriteria: draftSuccessCriteria || undefined,
        startTime: draftStartTime ? new Date(draftStartTime).getTime() : undefined,
      });
      showToast({ message: "已保存", type: "success" });
      setEditing(false);
      await loadSection();
      onUpdate?.();
    } catch { showToast({ message: "保存失败", type: "error" }); }
    finally { setSaving(false); }
  };

  if (loading) return <LoadingSheet onClose={onClose} />;
  if (loadError || !section) return <ErrorSheet onClose={onClose} isError={loadError} />;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end justify-center" onClick={onClose}>
        <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 400, damping: 40 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mt-3 mb-1" />
          <div className="px-6 pt-4 pb-6">

            <div className="flex items-start justify-between mb-3">
              <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-600">长期目标</span>
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            {editing ? (
              <input value={draftName} onChange={(e) => setDraftName(e.target.value)}
                className="w-full text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            ) : (
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 break-words">{section.name}</h2>
            )}

            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1" />
              {!editing && (
                <button onClick={handleStartEdit} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs font-medium">
                  <Edit3 className="w-3.5 h-3.5" />编辑
                </button>
              )}
            </div>

            <div className="border-t border-gray-100 dark:border-gray-800 my-3" />

            <div className="space-y-3">
              <InfoRow icon={<Clock className="w-4 h-4 text-gray-400" />} label="开始时间">
                {editing ? (
                  <input type="datetime-local" value={draftStartTime} onChange={(e) => setDraftStartTime(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                ) : (
                  <span className="text-sm text-gray-700 dark:text-gray-300">{formatDate(section.startTime) || "未设置"}</span>
                )}
              </InfoRow>

              <InfoRow icon={<Target className="w-4 h-4 text-gray-400" />} label="成功标准">
                {editing ? (
                  <textarea value={draftSuccessCriteria} onChange={(e) => setDraftSuccessCriteria(e.target.value)} rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="如何判断已完成？" />
                ) : (
                  <span className="text-sm text-gray-700 dark:text-gray-300">{section.successCriteria || "未设置"}</span>
                )}
              </InfoRow>

              <InfoRow icon={<Layers className="w-4 h-4 text-gray-400" />} label="阶段">
                {section.stageIndex !== undefined && board && board.stages?.[section.stageIndex] ? (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">{board.stages[section.stageIndex].name}</p>
                    {board.stages[section.stageIndex].achievements.map((a, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Check className="w-3 h-3 text-indigo-400" />{a}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">未归属阶段</span>
                )}
              </InfoRow>

              <InfoRow icon={<FileText className="w-4 h-4 text-gray-400" />} label="备注">
                {editing ? (
                  <textarea value={draftNote} onChange={(e) => setDraftNote(e.target.value)} rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="添加备注..." />
                ) : (
                  <span className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{section.note || "无备注"}</span>
                )}
              </InfoRow>
            </div>

            {editing && (
              <div className="flex gap-3 mt-6 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button onClick={() => setEditing(false)}
                  className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400">取消</button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-1.5">
                  {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}保存
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function LoadingSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center" onClick={onClose}>
      <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl p-6 h-64 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
      </div>
    </div>
  );
}

function ErrorSheet({ onClose, isError }: { onClose: () => void; isError: boolean }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center" onClick={onClose}>
      <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl p-6">
        <p className="text-center text-gray-500 py-8">{isError ? "加载失败" : "子模块不存在"}</p>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex items-center gap-2 w-24 flex-shrink-0 pt-0.5">
        {icon}
        <span className="text-xs text-gray-400 dark:text-gray-500">{label}</span>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
