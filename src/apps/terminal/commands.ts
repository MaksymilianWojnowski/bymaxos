import { getContent } from '../../content'
import { formatRange } from '../../lib/format'
import type { Command } from '../../system/commands'
import { buildIndex } from '../../system/search'
import { pathTo, type VNode } from '../../system/vfs'
import { openTarget } from '../finder/finderState'
import { nodeById, vfs } from '../finder/vfsInstance'
import { APPS } from '../registry'

// Pure parser: it reads the virtual filesystem and content, and returns lines plus UI effects. It never runs anything on a host.
export interface TerminalContext {
  cwd: string // VFS folder id, 'root' = ~
  history: string[]
}

export interface TerminalResult {
  lines: string[]
  cwd?: string
  clear?: true
  open?: Command
}

const content = getContent()
const APP_ITEMS = buildIndex(content, APPS).filter((item) => item.kind === 'app')

const HELP = [
  'help',
  'whoami',
  'about',
  'experience',
  'projects',
  'skills',
  'contact',
  'resume',
  'open <app>',
  'ls',
  'cd',
  'cat',
  'neofetch',
  'clear',
  'history',
  'sudo',
]
// Completion tries these names in order, so the list order is also the order of ties.
const COMMANDS = HELP.map((line) => line.split(' ')[0])

const folderChildren = (cwd: string): VNode[] => {
  const node = nodeById(cwd)
  if (node?.kind !== 'folder') return []
  return node.children.map((id) => nodeById(id)).filter((n): n is VNode => n !== undefined)
}

const findChild = (cwd: string, name: string): VNode | undefined => {
  const key = name.toLowerCase()
  return folderChildren(cwd).find((n) => n.name.toLowerCase() === key)
}

const parentOf = (cwd: string): string => {
  const path = pathTo(vfs, cwd)
  return path.length > 1 ? path[path.length - 2] : 'root'
}

const unquote = (s: string): string => s.replace(/^(["'])(.*)\1$/, '$2')

const social = (id: string): string | undefined => content.links.find((l) => l.id === id)?.url

const findApp = (name: string) => {
  const key = name.toLowerCase()
  return APP_ITEMS.find((item) => item.appId === key || item.title.toLowerCase() === key)
}

const openApp = (name: string): TerminalResult | undefined => {
  const app = findApp(name)
  if (!app) return undefined
  return { lines: [`Opening ${app.title}…`], open: app.command }
}

export function runCommand(input: string, ctx: TerminalContext): TerminalResult {
  const line = input.trim()
  if (line === '') return { lines: [] }
  const raw = line.split(/\s+/, 1)[0]
  const name = raw.toLowerCase()
  const arg = unquote(line.slice(raw.length).trim())

  switch (name) {
    case 'help':
      return { lines: HELP }
    case 'whoami':
      return { lines: [content.profile.name] }
    case 'about':
      return { lines: [content.profile.headline, content.profile.summary] }
    case 'experience':
      return {
        lines: content.experience.map(
          (e) => `${e.role} — ${e.company} (${formatRange(e.start, e.end)})`,
        ),
      }
    case 'projects':
      return { lines: content.projects.map((p) => p.title) }
    case 'skills':
      return { lines: content.skills.map((g) => `${g.label}: ${g.items.join(', ')}`) }
    case 'contact':
      return {
        lines: [content.profile.email, social('linkedin'), social('github')].filter(
          (l): l is string => l !== undefined,
        ),
      }
    case 'resume':
      return openApp('resume') ?? { lines: ['resume: no app named resume'] }
    case 'open': {
      if (arg === '') return { lines: ['open: missing operand'] }
      const app = openApp(arg)
      if (app) return app
      const node = findChild(ctx.cwd, arg)
      if (!node) return { lines: [`open: no app or file named ${arg}`] }
      if (node.kind === 'folder') {
        return {
          lines: [`Opening ${node.name}…`],
          open: { type: 'app.open', appId: 'finder', props: { folderId: node.id } },
        }
      }
      return { lines: [`Opening ${node.name}…`], open: openTarget(node) }
    }
    case 'ls': {
      const here = nodeById(ctx.cwd)
      const children = folderChildren(ctx.cwd)
      if (children.length === 0 && here?.kind === 'folder' && here.placeholder) {
        return { lines: [here.placeholder] }
      }
      return { lines: children.map((n) => n.name) }
    }
    case 'cd': {
      if (arg === '' || arg === '~') return { lines: [], cwd: 'root' }
      if (arg === '..') return { lines: [], cwd: parentOf(ctx.cwd) }
      const node = findChild(ctx.cwd, arg)
      if (!node) return { lines: [`cd: no such folder: ${arg}`] }
      if (node.kind !== 'folder') return { lines: [`cd: not a folder: ${arg}`] }
      return { lines: [], cwd: node.id }
    }
    case 'cat': {
      if (arg === '') return { lines: ['cat: missing operand'] }
      const node = findChild(ctx.cwd, arg)
      if (!node) return { lines: [`cat: ${arg}: no such file`] }
      if (node.kind === 'folder') return { lines: [`cat: ${node.name}: is a directory`] }
      if (node.fileType === 'pdf') {
        return { lines: [`cat: ${node.name}: binary file — try: open ${node.name}`] }
      }
      return {
        lines: node.preview.kind === 'text' ? node.preview.body.split('\n') : [node.preview.url],
      }
    }
    case 'neofetch':
      return {
        lines: [
          'maks@bymaxos',
          `OS: bymaxOS ${__APP_VERSION__}`,
          'Kernel: React',
          'Shell: bymaxsh',
          `Apps: ${APPS.length}`,
        ],
      }
    case 'clear':
      return { lines: [], clear: true }
    case 'history':
      return { lines: ctx.history.map((h, i) => `${i + 1}  ${h}`) }
    case 'sudo':
      return { lines: ['maks is not in the sudoers file. This incident will be reported.'] }
    default:
      return { lines: [`bymaxsh: command not found: ${raw}`] }
  }
}

// Argument candidates depend on the command: folders for cd, files for cat, and apps plus files for open.
const argCandidates = (name: string, cwd: string): string[] => {
  const children = folderChildren(cwd)
  if (name === 'cd') return children.filter((n) => n.kind === 'folder').map((n) => n.name)
  if (name === 'cat') return children.map((n) => n.name)
  if (name === 'open') return [...APP_ITEMS.map((i) => i.title), ...children.map((n) => n.name)]
  return []
}

// Returns the input unchanged when there is no single match.
export function complete(input: string, ctx: TerminalContext): string {
  const trimmed = input.trimStart()
  const space = trimmed.search(/\s/)
  if (space === -1) {
    const matches = COMMANDS.filter((c) => c.startsWith(trimmed.toLowerCase()))
    return matches.length === 1 ? matches[0] : input
  }
  const head = trimmed.slice(0, space)
  const prefix = trimmed.slice(space).trimStart().toLowerCase()
  const matches = [...new Set(argCandidates(head.toLowerCase(), ctx.cwd))].filter((c) =>
    c.toLowerCase().startsWith(prefix),
  )
  return matches.length === 1 ? `${head} ${matches[0]}` : input
}

export function promptFor(cwd: string): string {
  return cwd === 'root' ? 'maks@bymaxos ~ %' : `maks@bymaxos ${nodeById(cwd)?.name ?? '~'} %`
}
