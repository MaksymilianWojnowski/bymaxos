import { parseDeepLink } from '../../system/shell'

// Module scope: a shell remount must not reopen the deep-linked app.
let handled = false

// The page's deep link, once per page load; later calls get null.
export function takeDeepLink(): ReturnType<typeof parseDeepLink> {
  if (handled) return null
  handled = true
  return parseDeepLink(window.location.search)
}

// Test-only: each test loads a fresh page.
export function resetDeepLinkForTests(): void {
  handled = false
}
