type Block = { kind: 'h' | 'p'; text: string } | { kind: 'ul'; items: string[] }

// Only the three forms the content uses: '# ' headings, '- ' lists, and blank-line-separated paragraphs.
function parse(source: string): Block[] {
  const blocks: Block[] = []
  let last: Block | undefined
  for (const line of source.split('\n').map((l) => l.trim())) {
    if (line === '') {
      last = undefined
    } else if (line.startsWith('# ')) {
      last = { kind: 'h', text: line.slice(2) }
      blocks.push(last)
    } else if (line.startsWith('- ')) {
      if (last?.kind === 'ul') last.items.push(line.slice(2))
      else {
        last = { kind: 'ul', items: [line.slice(2)] }
        blocks.push(last)
      }
    } else if (last?.kind === 'p') {
      last.text += ` ${line}`
    } else {
      last = { kind: 'p', text: line }
      blocks.push(last)
    }
  }
  return blocks
}

// Text is rendered as React children only, never as HTML.
export function LightMarkdown({ source }: { source: string }) {
  return (
    <div className="space-y-3 text-[13px] leading-relaxed text-text-1">
      {parse(source).map((block, i) => {
        if (block.kind === 'h') return <h2 key={i} className="text-base font-semibold">{block.text}</h2>
        if (block.kind === 'ul')
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {block.items.map((text, j) => (
                <li key={j}>{text}</li>
              ))}
            </ul>
          )
        return <p key={i}>{block.text}</p>
      })}
    </div>
  )
}
