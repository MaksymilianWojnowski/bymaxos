// Resolves false (never throws) when the Clipboard API is missing or the write is refused.
export async function copyText(text: string): Promise<boolean> {
  try {
    const clipboard = navigator.clipboard
    if (!clipboard) return false
    await clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
