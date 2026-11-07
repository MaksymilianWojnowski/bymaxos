// Window ids restored from minimize; Window plays the reverse genie on mount and clears its entry.
export const genieRestores = new Set<string>()

// Each mounted desktop window's genie minimize, so every minimize path (⌘M, Hide, the button) animates.
export const windowMinimizers = new Map<string, () => void>()
