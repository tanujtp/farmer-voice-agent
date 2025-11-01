"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

interface PlanContextType {
  showUpgradePlanPrompt: boolean
  upgradePlanPrompt: string | null
  setShowUpgradePlanPrompt: (show: boolean) => void
  setUpgradePlanPrompt: (prompt: string | null) => void
}

const PlanContext = createContext<PlanContextType | undefined>(undefined)

export function PlanProvider({ children }: { children: ReactNode }) {
  const [showUpgradePlanPrompt, setShowUpgradePlanPrompt] = useState(false)
  const [upgradePlanPrompt, setUpgradePlanPrompt] = useState<string | null>(null)

  return (
    <PlanContext.Provider
      value={{
        showUpgradePlanPrompt,
        upgradePlanPrompt,
        setShowUpgradePlanPrompt,
        setUpgradePlanPrompt,
      }}
    >
      {children}
    </PlanContext.Provider>
  )
}

export function usePlan() {
  const context = useContext(PlanContext)
  if (!context) {
    throw new Error("usePlan must be used within PlanProvider")
  }
  return context
}
