import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { dispatch } from '../../system/commands'
import { useShell } from '../../system/shell'
import { complete, promptFor, QUICK_COMMANDS, runCommand } from './commands'

interface Row {
  id: number
  prompt?: string
  text: string
}

const stamp = () =>
  new Date().toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

export default function TerminalApp() {
  const [rows, setRows] = useState<Row[]>(() => [
    { id: 0, text: `Session started ${stamp()} — type help` },
  ])
  const [input, setInput] = useState('')
  const [cwd, setCwd] = useState('root')
  const [history, setHistory] = useState<string[]>([])
  // Position while walking the history with the arrow keys; null is the live line.
  const [pos, setPos] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const nextId = useRef(1)
  const outputRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const shell = useShell()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const el = outputRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [rows])

  // Runs a line without touching the typed input, so a chip tap leaves the draft alone.
  const run = (line: string) => {
    const result = runCommand(line, { cwd, history })
    const echo: Row[] = [
      { id: nextId.current++, prompt: promptFor(cwd), text: line },
      ...result.lines.map((text) => ({ id: nextId.current++, text })),
    ]
    if (result.clear) setRows([])
    else setRows((prev) => [...prev, ...echo])
    if (line.trim() !== '') setHistory((h) => [...h, line.trim()])
    if (result.cwd !== undefined) setCwd(result.cwd)
    if (result.open) dispatch(result.open)
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    run(input)
    setInput('')
    setPos(null)
    setDraft('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (history.length === 0) return
      const next = pos === null ? history.length - 1 : Math.max(0, pos - 1)
      if (pos === null) setDraft(input)
      setPos(next)
      setInput(history[next])
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (pos === null) return
      if (pos < history.length - 1) {
        setPos(pos + 1)
        setInput(history[pos + 1])
      } else {
        setPos(null)
        setInput(draft)
      }
    } else if (e.key === 'Tab') {
      // Tab moves focus only when there is nothing to complete, so the input never traps the keyboard.
      const completed = complete(input, { cwd, history })
      if (completed !== input) {
        e.preventDefault()
        setInput(completed)
      }
    } else if (e.ctrlKey && e.key.toLowerCase() === 'l') {
      e.preventDefault()
      setRows([])
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#1e1e1e] font-mono text-[13px] leading-5 text-[#e5e5e5]">
      <div
        ref={outputRef}
        role="log"
        aria-label="Terminal output"
        tabIndex={0}
        className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words px-3 pt-3 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white focus-visible:outline-none"
      >
        {rows.map((row) => (
          <div key={row.id}>
            {row.prompt !== undefined && <span className="text-[#7ee787]">{row.prompt} </span>}
            {row.text || ' '}
          </div>
        ))}
      </div>
      {shell === 'mobile' && (
        <div
          role="toolbar"
          aria-label="Quick commands"
          className="flex shrink-0 gap-2 overflow-x-auto px-3 pb-2"
        >
          {QUICK_COMMANDS.map((name) => (
            // Chips never move focus to the input: focusing it would open the phone keyboard.
            <button
              key={name}
              type="button"
              onClick={() => run(name)}
              className="min-h-11 min-w-11 shrink-0 rounded-sm bg-[#333333] px-3 text-[#e5e5e5] hover:bg-[#3c3c3c] focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
            >
              {name}
            </button>
          ))}
        </div>
      )}
      <form onSubmit={onSubmit} className="flex shrink-0 items-center gap-2 px-3 pb-3">
        <span className="shrink-0 whitespace-pre text-[#7ee787]">{promptFor(cwd)}</span>
        <input
          ref={inputRef}
          aria-label="Terminal input"
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setPos(null)
          }}
          onKeyDown={onKeyDown}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="min-w-0 flex-1 rounded-sm bg-transparent text-[#e5e5e5] caret-white focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none phone:min-h-11"
        />
      </form>
    </div>
  )
}
