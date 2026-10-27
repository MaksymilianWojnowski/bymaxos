import type { ReactNode } from 'react'
import { getContent } from '../../content'
import { SystemMark } from '../../ui/SystemMark'

const BUILD_DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(
  new Date(__BUILD_DATE__),
)

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-black/10 py-1.5 dark:border-white/15">
      <dt className="text-text-2">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  )
}

export default function AboutThisMacApp() {
  const { profile, links, site } = getContent()
  const github = links.find((l) => l.id === 'github')

  return (
    <div className="flex h-full flex-col px-6 pt-6 pb-5 font-sans text-[13px] text-text-1">
      <div className="flex flex-col items-center">
        <span aria-hidden="true">
          <SystemMark className="h-16 w-16" />
        </span>
        <h2 className="mt-3 text-[22px] font-semibold">bymaxOS</h2>
        <p className="text-text-2">Version {__APP_VERSION__}</p>
      </div>

      <dl className="mt-5">
        <Row label="Built by">{profile.name}</Row>
        <Row label="Stack">React · TypeScript · Vite · Tailwind CSS</Row>
        <Row label="Build">{BUILD_DATE}</Row>
        {site.repoUrl && (
          <Row label="Source">
            <a href={site.repoUrl} target="_blank" rel="noopener noreferrer" className="text-accent-strong underline">
              Repository
            </a>
          </Row>
        )}
      </dl>

      {github && (
        <button
          type="button"
          onClick={() => window.open(github.url, '_blank', 'noopener,noreferrer')}
          className="mt-auto self-center rounded-[6px] bg-black/5 px-4 py-1 dark:bg-white/10"
        >
          More Info…
        </button>
      )}
    </div>
  )
}
