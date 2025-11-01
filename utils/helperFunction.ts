export function checkPlanValidation(
  error: any,
  store: any,
  session: any,
  setShowUpgradePlanPrompt: any,
  setUpgradePlanPrompt: any,
): boolean {
  // Mock implementation - customize based on your needs
  return true
}

export function checkValidStringifiedJSON(str: string): boolean {
  try {
    JSON.parse(str)
    return true
  } catch {
    return false
  }
}

export function getCleanMarkdownString(content: string): string {
  // Remove markdown formatting for clean text
  return content
    .replace(/[*_~`#]/g, "")
    .replace(/\[([^\]]+)\]$$[^)]+$$/g, "$1")
    .trim()
}

export function getErrorFromApi(error: any): string {
  if (typeof error === "string") return error
  if (error?.message) return error.message
  if (error?.data?.message) return error.data.message
  if (error?.error) return error.error
  return "An unexpected error occurred"
}
