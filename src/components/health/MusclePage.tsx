"use client";

import { useEffect, useState } from "react";
import { useHealthStore } from "@/lib/store/healthStore";
import { Dumbbell } from "lucide-react";

export default function MusclePage() {
  const { muscleGroupsV2, exercisesV2, loadFitnessDataV2 } = useHealthStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFitnessDataV2().finally(() => setLoading(false));
  }, [loadFitnessDataV2]);

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-2 border-[#FF9500] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const getExercisesForGroup = (groupId: string) =>
    exercisesV2.filter((e) => e.muscleGroupId === groupId);

  return (
    <div className="flex flex-col gap-3">
      {muscleGroupsV2.map((g) => {
        const exs = getExercisesForGroup(g.id);
        return (
          <div key={g.id} className="rounded-xl bg-white/10 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#FF9500]20 flex items-center justify-center">
                <Dumbbell className="w-5 h-5" style={{ color: "#FF9500" }} />
              </div>
              <div>
                <div className="text-white text-[17px] font-semibold">{g.name}</div>
                <div className="text-gray-400 text-[13px]">{g.subMuscles.slice(0, 3).join("、")}</div>
              </div>
              <div className="ml-auto text-gray-500 text-[12px]">{exs.length} 个动作</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {exs.map((ex) => (
                <span key={ex.id} className="text-[13px] px-3 py-1 rounded-full bg-white/10 text-gray-300">
                  {ex.name}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
