import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DateRange = "7d" | "14d" | "30d" | "custom";

interface AppState {
  isAuthenticated: boolean;
  setAuthenticated: (v: boolean) => void;

  isAdmin: boolean;
  setAdmin: (v: boolean) => void;

  adminSessionPassword: string | null;
  setAdminSessionPassword: (pw: string | null) => void;

  apiToken: string | null;
  setApiToken: (token: string | null) => void;

  serverTokenAvailable: boolean;
  setServerTokenAvailable: (v: boolean) => void;

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
      isAuthenticated: false,
      setAuthenticated: (v) => set({ isAuthenticated: v, ...(!v ? { isAdmin: false, adminSessionPassword: null } : {}) }),

      isAdmin: false,
      setAdmin: (v) => set({ isAdmin: v }),

      adminSessionPassword: null,
      setAdminSessionPassword: (pw) => set({ adminSessionPassword: pw }),

      apiToken: null,
      setApiToken: (token) => set({ apiToken: token }),

      serverTokenAvailable: false,
      setServerTokenAvailable: (v) => set({ serverTokenAvailable: v }),

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
        isAuthenticated: state.isAuthenticated,
        isAdmin: state.isAdmin,
        apiToken: state.apiToken,
        openaiApiKey: state.openaiApiKey,
        dateRange: state.dateRange,
      }),
    }
  )
);
