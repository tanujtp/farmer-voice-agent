import { create } from "zustand"

interface AppState {
  // Add your app state here
  user: any
  setUser: (user: any) => void
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}))
