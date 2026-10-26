import { getContent } from '../../content'

export function MobilePlaceholder() {
  const { profile, links } = getContent()

  return (
    <main className="flex h-full w-full flex-col items-center justify-center gap-4 p-4 text-center text-text-1">
      <h1 className="text-2xl font-semibold">bymaxOS for iPhone is on its way</h1>
      <p className="text-text-2">Meanwhile, here&apos;s how to reach me:</p>
      <ul className="flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.id}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline"
            >
              {link.label}
            </a>
          </li>
        ))}
        <li>
          <a href={`mailto:${profile.email}`} className="text-accent underline">
            {profile.email}
          </a>
        </li>
      </ul>
    </main>
  )
}
