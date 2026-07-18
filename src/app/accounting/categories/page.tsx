"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, Plus } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { getAllCategories, addCategory, updateCategory, deleteCategory } from "@/lib/db/accounting.db";
import type { Category } from "@/lib/db/accounting.db";
import { showToast } from "@/components/ui/Toast";
import Dialog from "@/components/ui/Dialog";

// ============================================================
// 设计令牌
// ============================================================
const ACCENT = "#5865F2";
const INK = "#1D1D1F";
const MUTED = "#86868B";
const DANGER = "#FF3B30";
const BORDER_CARD = "#EBEBEB";
const BORDER_HEADER = "#E6E6E6";

const COLORS = ["#FF3B30", "#FF9500", "#FFCC00", "#34C759", "#007AFF", "#5856D6", "#AF52DE", "#FF6B8A", "#5AC8FA", "#8E8E93"];
const ICONS = [
  "utensils-crossed", "shopping-bag", "package", "car", "leaf", "apple", "candy",
  "dumbbell", "gamepad-2", "smartphone", "shirt", "sparkles", "banknote", "gift",
  "trending-up", "trophy", "home", "help-circle",
];

const ICON_LABELS: Record<string, string> = {
  "utensils-crossed": "餐饮", "shopping-bag": "购物", "package": "日用", "car": "交通",
  "leaf": "蔬菜", "apple": "水果", "candy": "零食", "dumbbell": "运动",
  "gamepad-2": "娱乐", "smartphone": "通讯", "shirt": "服饰", "sparkles": "美容",
  "banknote": "工资", "gift": "红包", "trending-up": "理财", "trophy": "奖金",
  "home": "租金", "help-circle": "其他",
};

// ============================================================
// 底部Sheet
// ============================================================
function BottomSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ type: "spring", damping: 30, stiffness: 400 }}
        className="relative w-full max-w-[430px] bg-white rounded-t-[20px] pb-[max(16px,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}>{children}</motion.div>
    </div>
  );
}

// ============================================================
// 页面
// ============================================================
export default function CategoriesPage() {
  const router = useRouter();
  const categories = useLiveQuery(() => getAllCategories(), [], [] as Category[]);

  const [showSheet, setShowSheet] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<"expense" | "income">("expense");
  const [formColor, setFormColor] = useState(COLORS[0]);
  const [formIcon, setFormIcon] = useState(ICONS[0]);

  const expenseCats = useMemo(() => categories.filter((c) => c.type === "expense"), [categories]);
  const incomeCats = useMemo(() => categories.filter((c) => c.type === "income"), [categories]);

  const openAdd = (type: "expense" | "income") => {
    setEditingCat(null);
    setFormName("");
    setFormType(type);
    setFormColor(COLORS[0]);
    setFormIcon(ICONS[0]);
    setShowSheet(true);
  };

  const openEdit = (cat: Category) => {
    setEditingCat(cat);
    setFormName(cat.name);
    setFormType(cat.type as "expense" | "income");
    setFormColor(cat.color || COLORS[0]);
    setFormIcon(cat.icon || ICONS[0]);
    setShowSheet(true);
  };

  const handleSave = async () => {
    const name = formName.trim();
    if (!name) { showToast({ type: "warning", message: "请输入分类名称" }); return; }
    try {
      if (editingCat) {
        await updateCategory(editingCat.id, { name, type: formType, color: formColor, icon: formIcon });
        showToast({ type: "success", message: "已更新" });
      } else {
        await addCategory({ name, type: formType, color: formColor, icon: formIcon, ledgerId: "default" });
        showToast({ type: "success", message: "已添加" });
      }
      setShowSheet(false);
    } catch {
      showToast({ type: "error", message: "保存失败" });
    }
  };

  const handleDelete = async () => {
    if (!editingCat) return;
    try {
      await deleteCategory(editingCat.id);
      showToast({ type: "success", message: "已删除" });
      setShowDeleteDialog(false); setShowSheet(false);
    } catch {
      showToast({ type: "error", message: "删除失败" });
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <div className="h-[56px] flex items-center relative px-4" style={{ background: "#FFFFFF", borderBottom: `1px solid ${BORDER_HEADER}` }}>
        <button type="button" onClick={() => router.back()} className="w-11 h-11 -ml-1 flex items-center justify-center active:opacity-50">
          <ChevronLeft className="w-6 h-6" style={{ color: INK }} />
        </button>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-[17px] font-semibold" style={{ color: INK }}>分类管理</span>
        </div>
        <div className="w-11 h-11" />
      </div>

      {/* 支出分类 */}
      <div className="mx-4 mt-4">
        <div className="rounded-[20px] border overflow-hidden" style={{ background: "#FFFFFF", borderColor: BORDER_CARD }}>
          <div className="px-4 pt-4 pb-1 flex items-center justify-between">
            <span className="text-[13px]" style={{ color: MUTED }}>支出</span>
            <button type="button" onClick={() => openAdd("expense")} className="text-[13px] font-medium" style={{ color: ACCENT }}>
              <Plus className="w-4 h-4 inline" /> 新增
            </button>
          </div>
          {expenseCats.map((cat, i) => (
            <button key={cat.id} type="button" onClick={() => openEdit(cat)}
              className={`h-[52px] flex items-center gap-3 px-4 w-full active:bg-black/5 ${i > 0 ? "" : ""}`}
              style={{ borderTop: i > 0 ? `0.5px solid ${BORDER_CARD}` : "none" }}>
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: cat.color }} />
              <span className="text-[15px] flex-1 text-left" style={{ color: INK }}>{cat.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 收入分类 */}
      <div className="mx-4 mt-4 pb-8">
        <div className="rounded-[20px] border overflow-hidden" style={{ background: "#FFFFFF", borderColor: BORDER_CARD }}>
          <div className="px-4 pt-4 pb-1 flex items-center justify-between">
            <span className="text-[13px]" style={{ color: MUTED }}>收入</span>
            <button type="button" onClick={() => openAdd("income")} className="text-[13px] font-medium" style={{ color: ACCENT }}>
              <Plus className="w-4 h-4 inline" /> 新增
            </button>
          </div>
          {incomeCats.map((cat, i) => (
            <button key={cat.id} type="button" onClick={() => openEdit(cat)}
              className="h-[52px] flex items-center gap-3 px-4 w-full active:bg-black/5"
              style={{ borderTop: i > 0 ? `0.5px solid ${BORDER_CARD}` : "none" }}>
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: cat.color }} />
              <span className="text-[15px] flex-1 text-left" style={{ color: INK }}>{cat.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 新增/编辑 Sheet */}
      <BottomSheet open={showSheet} onClose={() => setShowSheet(false)}>
        <div className="px-5 pt-5 pb-2 flex items-center justify-between">
          <button onClick={() => setShowSheet(false)} className="text-[15px] text-[#86868B]">取消</button>
          <span className="text-[17px] font-semibold text-[#1D1D1F]">{editingCat ? "编辑分类" : "新增分类"}</span>
          <button onClick={handleSave} className="text-[15px] font-semibold text-[#5865F2]">保存</button>
        </div>
        <div className="px-5 mt-4 space-y-4">
          <div>
            <label className="text-[13px] text-[#86868B] block mb-1">名称</label>
            <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)}
              placeholder="分类名称" maxLength={10}
              className="w-full h-11 px-4 rounded-[12px] bg-[#F5F5F5] text-[15px] text-[#1D1D1F] placeholder-[#AEAEB2] outline-none" />
          </div>
          <div>
            <label className="text-[13px] text-[#86868B] block mb-1">类型</label>
            <div className="flex gap-3">
              {(["expense", "income"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setFormType(t)}
                  className={`flex-1 h-11 rounded-[12px] text-[15px] font-medium ${formType === t ? "bg-[#5865F2] text-white" : "bg-[#F5F5F5] text-[#86868B]"}`}>
                  {t === "expense" ? "支出" : "收入"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[13px] text-[#86868B] block mb-1">颜色</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setFormColor(c)}
                  className="w-8 h-8 rounded-full transition-transform"
                  style={{ background: c, transform: formColor === c ? "scale(1.3)" : "scale(1)", boxShadow: formColor === c ? "0 0 0 2px #FFFFFF, 0 0 0 4px #5865F2" : undefined }} />
              ))}
            </div>
          </div>
          <div>
            <label className="text-[13px] text-[#86868B] block mb-1">图标</label>
            <div className="grid grid-cols-6 gap-2 max-h-[160px] overflow-y-auto">
              {ICONS.map((icon) => (
                <button key={icon} type="button" onClick={() => setFormIcon(icon)}
                  className={`h-11 rounded-[10px] text-[12px] truncate px-1 ${formIcon === icon ? "bg-[#EEF2FF] text-[#5865F2] font-medium ring-2 ring-[#5865F2]" : "bg-[#F5F5F5] text-[#86868B]"}`}>
                  {ICON_LABELS[icon] || icon}
                </button>
              ))}
            </div>
          </div>
          {editingCat && (
            <button type="button" onClick={() => setShowDeleteDialog(true)}
              className="w-full h-11 rounded-[12px] text-[15px] font-medium text-[#FF3B30] bg-[#FFF0F0] mt-4">删除分类</button>
          )}
        </div>
        <div className="h-4" />
      </BottomSheet>

      <Dialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)} type="confirm" variant="danger"
        title="删除分类" description={`确定要删除「${editingCat?.name}」吗？`} confirmLabel="删除" onConfirm={handleDelete} />
    </div>
  );
}
