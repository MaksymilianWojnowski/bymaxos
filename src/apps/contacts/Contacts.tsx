import type { ReactNode } from 'react'
import { Copy } from 'lucide-react'
import { getContent } from '../../content'
import { copyText } from '../../lib/clipboard'
import { buildVCard, downloadText } from '../../lib/vcard'
import { dispatch } from '../../system/commands'
import { useSystem } from '../../system/store'

const BUTTON =
  'rounded-[6px] border border-black/15 bg-white px-3 py-1 text-[13px] text-black dark:border-white/15 dark:bg-[#2a2a2a] dark:text-white'
const LINK = 'truncate text-left text-accent-link underline'

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

export default function ContactsApp() {
  const { profile, links } = getContent()
  const notify = useSystem((s) => s.notify)
  const linkedin = links.find((l) => l.id === 'linkedin')
  const github = links.find((l) => l.id === 'github')
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const copy = async (label: string, value: string) => {
    const ok = await copyText(value)
    notify(
      'Contacts',
      ok
        ? `${label[0].toUpperCase()}${label.slice(1)} copied.`
        : `Couldn't copy ${label} — select it and copy it manually.`,
    )
  }

  const openLink = (url: string) => window.open(url, '_blank', 'noopener,noreferrer')

  const downloadVCard = () =>
    downloadText(
      `${profile.name}.vcf`,
      buildVCard({
        name: profile.name,
        title: profile.headline,
        email: profile.email,
        location: profile.location,
        urls: links,
      }),
      'text/vcard;charset=utf-8',
    )

  const share = async () => {
    try {
      await navigator.share({
        title: profile.name,
        text: `${profile.name} — ${profile.headline}\n${profile.email}`,
      })
    } catch (err) {
      if ((err as { name?: string }).name !== 'AbortError') {
        notify('Contacts', "Couldn't share the contact — try Download vCard instead.")
      }
    }
  }

  const rows: { label: string; value: ReactNode; copyValue: string }[] = [
    { label: 'email', value: profile.email, copyValue: profile.email },
    { label: 'location', value: profile.location, copyValue: profile.location },
    ...(linkedin
      ? [
          {
            label: 'LinkedIn',
            value: (
              <button type="button" className={LINK} onClick={() => openLink(linkedin.url)}>
                {linkedin.url}
              </button>
            ),
            copyValue: linkedin.url,
          },
        ]
      : []),
    ...(github
      ? [
          {
            label: 'GitHub',
            value: (
              <button type="button" className={LINK} onClick={() => openLink(github.url)}>
                {github.url}
              </button>
            ),
            copyValue: github.url,
          },
        ]
      : []),
  ]

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-auto bg-window p-5 font-sans text-[13px] text-text-1">
      <header className="flex flex-col items-center text-center">
        {profile.avatarUrl ? (
          <img src={profile.avatarUrl} alt="" className="h-20 w-20 rounded-full object-cover" />
        ) : (
          <span
            aria-hidden
            className="grid h-20 w-20 place-items-center rounded-full bg-black/10 text-[26px] font-semibold text-text-2 dark:bg-white/15"
          >
            {initials(profile.name)}
          </span>
        )}
        <h2 className="mt-3 text-[18px] font-semibold">{profile.name}</h2>
        <p className="text-text-2">{profile.headline}</p>
      </header>

      <dl className="divide-y divide-black/10 border-y border-black/10 dark:divide-white/15 dark:border-white/15">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-3 py-2">
            <dt className="w-[72px] shrink-0 text-right text-text-2">{row.label}</dt>
            <dd className="min-w-0 flex-1 truncate">{row.value}</dd>
            <button
              type="button"
              aria-label={`Copy ${row.label}`}
              title={`Copy ${row.label}`}
              onClick={() => copy(row.label, row.copyValue)}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-[4px] text-text-2 hover:bg-black/5 dark:hover:bg-white/10"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        ))}
      </dl>

      <div className="mt-auto flex flex-wrap justify-center gap-2">
        <button
          type="button"
          className={BUTTON}
          onClick={() => dispatch({ type: 'app.open', appId: 'mail' })}
        >
          Message
        </button>
        <button type="button" className={BUTTON} onClick={downloadVCard}>
          Download vCard
        </button>
        {canShare && (
          <button type="button" className={BUTTON} onClick={share}>
            Share
          </button>
        )}
      </div>
    </div>
  )
}
