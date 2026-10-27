import { createPortal } from 'react-dom'
import { getContent } from '../../content'
import { dispatch, useWindowCommands } from '../../system/commands'
import type { AppProps } from '../types'
import ResumeDocument from './ResumeDocument'

const BUTTON =
  'rounded-[6px] border border-black/15 bg-white px-3 py-1 text-[13px] text-black dark:border-white/15 dark:bg-[#2a2a2a] dark:text-white'

const openExternal = (url: string) => window.open(url, '_blank', 'noopener,noreferrer')
const print = () => window.print()
// Relative PDF paths resolve against the deployed base path.
const pdfHref = (url: string) =>
  /^https?:\/\//.test(url) ? url : `${import.meta.env.BASE_URL}${url}`

export default function ResumeApp({ windowId }: AppProps) {
  const { links, site } = getContent()
  const linkedin = links.find((l) => l.id === 'linkedin')
  const github = links.find((l) => l.id === 'github')
  const pdfUrl = site.resume.pdfUrl

  useWindowCommands(windowId, { 'resume.print': print })

  return (
    <div className="flex h-full min-h-0 flex-col bg-window font-sans text-[13px] text-text-1">
      <div
        role="toolbar"
        aria-label="Resume"
        className="flex flex-wrap items-center justify-center gap-2 border-b border-black/10 px-3 py-2 dark:border-white/15"
      >
        {pdfUrl && (
          <a href={pdfHref(pdfUrl)} download className={BUTTON}>
            Download PDF
          </a>
        )}
        {linkedin && (
          <button type="button" className={BUTTON} onClick={() => openExternal(linkedin.url)}>
            LinkedIn
          </button>
        )}
        {github && (
          <button type="button" className={BUTTON} onClick={() => openExternal(github.url)}>
            GitHub
          </button>
        )}
        <button
          type="button"
          className={BUTTON}
          onClick={() => dispatch({ type: 'app.open', appId: 'mail' })}
        >
          Email
        </button>
        <button
          type="button"
          className={BUTTON}
          onClick={() => dispatch({ type: 'app.open', appId: 'calendar' })}
        >
          Book a call
        </button>
        <button type="button" className={BUTTON} onClick={print}>
          Print
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-[#d9d9d9] p-6 dark:bg-[#1e1e1e]">
        <article className="mx-auto max-w-[760px] bg-white p-10 text-[#111] shadow-md">
          <ResumeDocument />
        </article>
      </div>

      {createPortal(
        <div className="print-only">
          <ResumeDocument />
        </div>,
        document.body,
      )}
    </div>
  )
}
