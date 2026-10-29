export type ParsedAddress = { ok: true; url: string } | { ok: false; error: string }

const ERROR = 'Enter a web address starting with https://'

// Only web URLs are accepted; a bare word like "linkedin" is rejected rather than guessed into a site.
export function parseAddress(input: string): ParsedAddress {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return { ok: false, error: ERROR }
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { ok: false, error: ERROR }
  return { ok: true, url: url.href }
}
