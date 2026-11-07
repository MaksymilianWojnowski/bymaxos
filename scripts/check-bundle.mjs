// Fails when the shell's JS (entry chunk and its modulepreloads, gzipped) exceeds the 150 KB budget (spec §7.2).
// Lazy app chunks are not part of the shell and are not counted. Run after `npm run build`.
// BASE_PATH must match the build (e.g. /bymaxos/ for the Pages deploy); hrefs are resolved against it.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const BUDGET_BYTES = 150 * 1024
const distDir = fileURLToPath(new URL('../dist/', import.meta.url))
const indexPath = join(distDir, 'index.html')
if (!existsSync(indexPath)) {
  console.error('dist/index.html not found — run npm run build first')
  process.exit(1)
}
const html = readFileSync(indexPath, 'utf8')
const base = (process.env.BASE_PATH ?? '/').replace(/\/?$/, '/')

const attr = (tag, name) => tag.match(new RegExp(`\\s${name}=["']([^"']*)["']`, 'i'))?.[1]
const refs = [...html.matchAll(/<(?:script|link)\b[^>]*>/gi)].flatMap(([tag]) => {
  const ref = /^<script/i.test(tag)
    ? attr(tag, 'type') === 'module' ? attr(tag, 'src') : undefined
    : attr(tag, 'rel') === 'modulepreload' ? attr(tag, 'href') : undefined
  return ref ? [ref] : []
})
if (refs.length === 0) throw new Error('no entry script or modulepreload found in dist/index.html')

// Strip the build base (or any leading slash) and any query or hash, so the path is relative to dist/.
const toFile = (ref) => {
  const path = ref.split(/[?#]/)[0]
  return join(distDir, path.startsWith(base) ? path.slice(base.length) : path.replace(/^\/+/, ''))
}

let total = 0
for (const ref of refs) {
  const size = gzipSync(readFileSync(toFile(ref))).length
  total += size
  console.log(`${(size / 1024).toFixed(2).padStart(7)} KB  ${ref}`)
}

console.log(`${(total / 1024).toFixed(2).padStart(7)} KB  total gzip (budget ${BUDGET_BYTES / 1024} KB)`)
if (total > BUDGET_BYTES) {
  console.error(`shell bundle is over the budget by ${((total - BUDGET_BYTES) / 1024).toFixed(2)} KB`)
  process.exit(1)
}
