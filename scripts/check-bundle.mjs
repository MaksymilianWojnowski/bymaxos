// Fails when the shell's JS (entry chunk and its modulepreloads, gzipped) exceeds the 150 KB budget (spec §7.2).
// Lazy app chunks are not part of the shell and are not counted. Run after `npm run build`.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const BUDGET_BYTES = 150 * 1024
const distDir = fileURLToPath(new URL('../dist/', import.meta.url))
const html = readFileSync(join(distDir, 'index.html'), 'utf8')

const files = [
  ...html.matchAll(/<script type="module"[^>]*\ssrc="([^"]+)"|<link rel="modulepreload"[^>]*\shref="([^"]+)"/g),
].map((m) => m[1] ?? m[2])
if (files.length === 0) throw new Error('no entry script or modulepreload found in dist/index.html')

let total = 0
for (const file of files) {
  const size = gzipSync(readFileSync(join(distDir, file))).length
  total += size
  console.log(`${(size / 1024).toFixed(2).padStart(7)} KB  ${file}`)
}

console.log(`${(total / 1024).toFixed(2).padStart(7)} KB  total gzip (budget ${BUDGET_BYTES / 1024} KB)`)
if (total > BUDGET_BYTES) {
  console.error(`shell bundle is over the budget by ${((total - BUDGET_BYTES) / 1024).toFixed(2)} KB`)
  process.exit(1)
}
