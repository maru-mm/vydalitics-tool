import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DateRange = "7d" | "14d" | "30d" | "custom";

interface AppState {
  apiToken: string | null;
  setApiToken: (token: string | null) => void;

  openaiApiKey: string | null;
  setOpenaiApiKey: (key: string | null) => void;

  sidebarOpen: boolean;
  toggleSidebar: () => void;

  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  customStartDate: string | null;
  customEndDate: string | null;
  setCustomDates: (start: string, end: string) => void;

  selectedFolderId: string | null;
  setSelectedFolderId: (id: string | null) => void;

  selectedVideoId: string | null;
  setSelectedVideoId: (id: string | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      apiToken: null,
      setApiToken: (token) => set({ apiToken: token }),

      openaiApiKey: null,
      setOpenaiApiKey: (key) => set({ openaiApiKey: key }),

      sidebarOpen: true,
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

      dateRange: "7d",
      setDateRange: (range) => set({ dateRange: range }),
      customStartDate: null,
      customEndDate: null,
      setCustomDates: (start, end) =>
        set({ customStartDate: start, customEndDate: end, dateRange: "custom" }),

      selectedFolderId: null,
      setSelectedFolderId: (id) => set({ selectedFolderId: id }),

      selectedVideoId: null,
      setSelectedVideoId: (id) => set({ selectedVideoId: id }),
    }),
    {
      name: "vydalitics-ai-storage",
      partialize: (state) => ({
        apiToken: state.apiToken,
        openaiApiKey: state.openaiApiKey,
        dateRange: state.dateRange,
      }),
    }
  )
);
