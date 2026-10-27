import { useEffect } from 'react'
import { nodeById } from '../finder/vfsInstance'
import { useSystem } from '../../system/store'
import { LightMarkdown } from '../../ui/LightMarkdown'
import type { AppProps } from '../types'

// Read-only for now: the document shows as a paper sheet, text selectable, no editing.
export default function TextEditApp({ windowId, props }: AppProps) {
  const node = nodeById(props?.fileId)
  const file = node?.kind === 'file' && node.preview.kind === 'text' ? node : undefined
  const name = file?.name
  const setTitle = useSystem((s) => s.setTitle)

  useEffect(() => {
    if (name !== undefined) setTitle(windowId, name)
  }, [windowId, name, setTitle])

  if (file?.preview.kind !== 'text') {
    return <p className="p-6 text-[13px] text-text-2">Not configured yet</p>
  }

  return (
    <div className="min-h-full bg-[#f5f5f5] px-4 py-6 dark:bg-[#2b2b2b]">
      <article className="mx-auto max-w-[680px] select-text bg-white px-10 py-10 text-black dark:bg-[#1e1e1e] dark:text-white">
        <LightMarkdown source={file.preview.body} />
      </article>
    </div>
  )
}
