import { getContent } from '../../content'
import { buildVfs, type VNode } from '../../system/vfs'

// Built once: Finder and Quick Look read the same tree.
export const vfs = buildVfs(getContent())

// Ids arrive from window props and command payloads, so only own keys count ('constructor' is not a node).
export function nodeById(id: unknown): VNode | undefined {
  return typeof id === 'string' && Object.hasOwn(vfs.nodes, id) ? vfs.nodes[id] : undefined
}
