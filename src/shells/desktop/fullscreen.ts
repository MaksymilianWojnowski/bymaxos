// Keys the Keyboard Lock API takes over while full screen, so Cmd-based shortcuts reach the desktop.
const LOCKED_KEYS = ['MetaLeft', 'MetaRight', 'KeyW', 'KeyQ', 'KeyM', 'KeyN', 'Digit1', 'Digit2', 'Tab', 'Space']

// The Keyboard Lock API is Chromium-only and missing from the DOM typings.
type KeyboardLockNavigator = Navigator & { keyboard?: { lock?(keys: string[]): Promise<void> } }

export async function enterFullScreen(
  doc: Document = document,
  nav: Navigator = navigator,
): Promise<{ fullscreen: boolean; keyboardLocked: boolean }> {
  try {
    await doc.documentElement.requestFullscreen()
  } catch {
    return { fullscreen: false, keyboardLocked: false }
  }
  try {
    const lock = (nav as KeyboardLockNavigator).keyboard?.lock
    if (lock) {
      await lock.call((nav as KeyboardLockNavigator).keyboard, LOCKED_KEYS)
      return { fullscreen: true, keyboardLocked: true }
    }
  } catch {
    // Full screen still works without the key lock.
  }
  return { fullscreen: true, keyboardLocked: false }
}

export async function exitFullScreen(doc: Document = document): Promise<void> {
  if (!doc.fullscreenElement) return
  try {
    await doc.exitFullscreen()
  } catch {
    // Already leaving full screen; nothing to recover.
  }
}
