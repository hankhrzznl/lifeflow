import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Types ───────────────────────────────────────────────────

export type ActiveStation = 'dashboard' | 'efficiency' | 'accounting' | 'health';
export type Theme = 'light' | 'dark' | 'system';

interface GlobalState {
  activeStation: ActiveStation;
  theme: Theme;
  sidebarCollapsed: boolean;

  setActiveStation: (station: ActiveStation) => void;
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
}

// ─── Store ───────────────────────────────────────────────────

export const useGlobalStore = create<GlobalState>()(
  persist(
    (set) => ({
      activeStation: 'dashboard',
      theme: 'system',
      sidebarCollapsed: false,

      setActiveStation: (station) => set({ activeStation: station }),
      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    }),
    {
      name: 'lifeflow-global',
    }
  )
);
