import { useEffect } from 'react'
import { nodeById } from '../finder/vfsInstance'
import { useSystem } from '../../system/store'
import { LightMarkdown } from '../../ui/LightMarkdown'
import { getApp } from '../registry'
import type { AppProps } from '../types'

export default function QuickLookApp({ windowId, props }: AppProps) {
  const node = nodeById(props?.nodeId)
  const file = node?.kind === 'file' ? node : undefined
  const name = file?.name
  const setTitle = useSystem((s) => s.setTitle)

  useEffect(() => {
    if (name !== undefined) setTitle(windowId, name)
  }, [windowId, name, setTitle])

  if (!file) return <p className="p-6 text-[13px] text-text-2">Not configured yet</p>

  const { preview } = file
  const ownAppReady = Boolean(getApp(file.open.appId)?.load)

  return (
    <div className="flex min-h-full flex-col">
      <article className="flex-1 space-y-3 p-6">
        {preview.kind === 'text' ? (
          <LightMarkdown source={preview.body} />
        ) : (
          <>
            <h2 className="text-base font-semibold text-text-1">{preview.title}</h2>
            <p className="text-[13px] text-text-2">{preview.description}</p>
            <p className="font-mono text-[12px] break-all text-text-2">{preview.url}</p>
            <button
              type="button"
              onClick={() => window.open(preview.url, '_blank', 'noopener,noreferrer')}
              className="rounded-md bg-accent-strong px-3 py-1.5 text-[13px] text-white outline-none focus-visible:ring-2 focus-visible:ring-accent-link"
            >
              Open in new tab ↗
            </button>
          </>
        )}
      </article>
      {!ownAppReady && (
        <footer className="border-t border-black/10 px-6 py-2 text-[12px] text-text-2">
          Preview — the full app is coming soon.
        </footer>
      )}
    </div>
  )
}
