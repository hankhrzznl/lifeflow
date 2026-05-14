"use client";

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";

interface BottomSheetProps {
  children: ReactNode;
  snapPoints: number[];
  defaultSnap: number;
  headerContent?: ReactNode;
  className?: string;
  onSnapChange?: (index: number) => void;
}

export function BottomSheet({
  children,
  snapPoints,
  defaultSnap,
  headerContent,
  className = "",
  onSnapChange,
}: BottomSheetProps) {
  const [currentSnap, setCurrentSnap] = useState(defaultSnap);
  const containerRef = useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);
  const snapStartY = useRef(0);

  const getSnapOffset = useCallback(
    (index: number) => {
      if (!containerRef.current) return 0;
      const containerHeight = containerRef.current.clientHeight;
      const snapPercent = snapPoints[index] / 100;
      return containerHeight * (1 - snapPercent);
    },
    [snapPoints]
  );

  const findClosestSnap = useCallback(
    (currentY: number, velocity: number) => {
      if (!containerRef.current) return defaultSnap;
      const containerHeight = containerRef.current.clientHeight;

      const snapOffsets = snapPoints.map((p) => containerHeight * (1 - p / 100));

      if (Math.abs(velocity) > 300) {
        if (velocity > 0) {
          for (let i = snapOffsets.length - 1; i >= 0; i--) {
            if (currentY < snapOffsets[i]) return i;
          }
          return snapOffsets.length - 1;
        }
        for (let i = 0; i < snapOffsets.length; i++) {
          if (currentY > snapOffsets[i]) return i;
        }
        return 0;
      }

      let closest = 0;
      let minDist = Infinity;
      for (let i = 0; i < snapOffsets.length; i++) {
        const dist = Math.abs(currentY - snapOffsets[i]);
        if (dist < minDist) {
          minDist = dist;
          closest = i;
        }
      }
      return closest;
    },
    [snapPoints, defaultSnap]
  );

  const handleDragStart = useCallback(() => {
    snapStartY.current = y.get();
  }, [y]);

  const handleDrag = useCallback(
    (_: unknown, info: { delta: { y: number } }) => {
      const newY = snapStartY.current + info.delta.y;
      if (!containerRef.current) return;

      const containerHeight = containerRef.current.clientHeight;
      const maxOpen = containerHeight * (1 - snapPoints[snapPoints.length - 1] / 100);
      const minOpen = containerHeight * (1 - snapPoints[0] / 100);

      const clampedY = Math.max(maxOpen, Math.min(minOpen, newY));
      y.set(clampedY);
    },
    [snapPoints, y]
  );

  const handleDragEnd = useCallback(
    (_: unknown, info: { velocity: { y: number } }) => {
      const currentY = y.get();
      const snapIndex = findClosestSnap(currentY, info.velocity.y);
      const targetOffset = getSnapOffset(snapIndex);

      animate(y, targetOffset, {
        type: "spring",
        stiffness: 300,
        damping: 30,
      });
      setCurrentSnap(snapIndex);
      onSnapChange?.(snapIndex);
    },
    [findClosestSnap, getSnapOffset, onSnapChange, y]
  );

  const handleSnapToggle = useCallback(() => {
    if (currentSnap === 0) {
      const index = snapPoints.length - 1;
      const offset = getSnapOffset(index);
      animate(y, offset, {
        type: "spring",
        stiffness: 300,
        damping: 30,
      });
      setCurrentSnap(index);
      onSnapChange?.(index);
    } else {
      const offset = getSnapOffset(0);
      animate(y, offset, {
        type: "spring",
        stiffness: 300,
        damping: 30,
      });
      setCurrentSnap(0);
      onSnapChange?.(0);
    }
  }, [currentSnap, getSnapOffset, onSnapChange, snapPoints.length, y]);

  const sheetTop = useTransform(y, (v) => `${Math.max(0, v)}px`);

  useEffect(() => {
    const offset = getSnapOffset(defaultSnap);
    y.set(offset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={containerRef} className={`fixed inset-x-0 bottom-0 z-40 ${className}`}>
      <div className="relative h-full w-full pointer-events-none">
        <motion.div
          drag="y"
          dragConstraints={containerRef}
          dragElastic={0}
          dragMomentum={false}
          className="absolute inset-x-0 pointer-events-auto"
          style={{
            top: sheetTop,
            bottom: 0,
          }}
          onDragStart={handleDragStart}
          onDrag={handleDrag}
          onDragEnd={handleDragEnd}
        >
          <div className="flex flex-col h-full bg-[var(--card-bg)] rounded-t-2xl shadow-2xl border-t border-[var(--card-border)]">
            <div
              className="flex-shrink-0 pt-3 pb-1 cursor-grab active:cursor-grabbing touch-none"
              onClick={handleSnapToggle}
            >
              <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mx-auto" />
            </div>

            {headerContent && (
              <div className="flex-shrink-0 px-4 py-2 border-b border-[var(--card-border)]">
                {headerContent}
              </div>
            )}

            <div className="flex-1 overflow-hidden">
              <div className="h-full overflow-y-auto overscroll-contain">
                {children}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
