import { getContent } from '../../content'
import { formatRange } from '../../lib/format'

const SECTION = 'mt-6 border-b border-black/15 pb-1 text-[13px] font-bold uppercase tracking-wide'
const ITEM = 'mt-3'
const META = 'text-[12px] text-[#555]'

export default function ResumeDocument() {
  const { profile, links, experience, education, skills, softSkills, languages, projects } =
    getContent()
  const linkedin = links.find((l) => l.id === 'linkedin')
  const github = links.find((l) => l.id === 'github')

  return (
    <>
      <header>
        <h1 className="text-[26px] font-bold">{profile.name}</h1>
        <p className="text-[14px]">{profile.headline}</p>
        <p className={META}>
          {[profile.location, profile.email, linkedin?.url, github?.url].filter(Boolean).join(' · ')}
        </p>
      </header>

      <h2 className={SECTION}>About</h2>
      <p className="mt-2 leading-relaxed">{profile.summary}</p>
      <p className="mt-2">
        <strong>Looking for:</strong> {profile.lookingFor}
      </p>

      <h2 className={SECTION}>Experience</h2>
      {experience.map((job) => (
        <div key={job.id} className={ITEM}>
          <h3 className="font-semibold">
            {job.role} · {job.company}
          </h3>
          <p className={META}>
            {formatRange(job.start, job.end)} · {job.location}
          </p>
          <ul className="mt-1 list-disc pl-5">
            {job.highlights.map((h) => (
              <li key={h.title}>
                <strong>{h.title}:</strong> {h.text}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <h2 className={SECTION}>Skills</h2>
      <ul className="mt-2 list-disc pl-5">
        {skills.map((group) => (
          <li key={group.id}>
            <strong>{group.label}:</strong> {group.items.join(', ')}
          </li>
        ))}
        {softSkills.length > 0 && (
          <li>
            <strong>Soft skills:</strong> {softSkills.join(', ')}
          </li>
        )}
      </ul>

      <h2 className={SECTION}>Education</h2>
      {education.map((school) => (
        <div key={school.id} className={ITEM}>
          <h3 className="font-semibold">
            {school.degree ? `${school.degree} · ${school.school}` : school.school}
          </h3>
          <p className={META}>
            {formatRange(school.start, school.end)} · {school.location}
            {school.grade ? ` · Grade: ${school.grade}` : ''}
          </p>
          {school.notes.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {school.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}
        </div>
      ))}

      <h2 className={SECTION}>Projects</h2>
      {projects.map((project) => (
        <div key={project.id} className={ITEM}>
          <h3 className="font-semibold">{project.title}</h3>
          <p>{project.summary}</p>
          {project.bullets.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {project.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
          {project.tech.length > 0 && <p className={META}>Tech: {project.tech.join(', ')}</p>}
          <p className={META}>
            {[
              project.links.repo && ['Repository', project.links.repo],
              project.links.demo && ['Demo', project.links.demo],
              project.links.info && ['More info', project.links.info],
            ]
              .filter((l): l is [string, string] => Boolean(l))
              .map(([label, url], i) => (
                <span key={url}>
                  {i > 0 && ' · '}
                  <a href={url} target="_blank" rel="noopener noreferrer" className="underline">
                    {label}
                  </a>
                </span>
              ))}
          </p>
        </div>
      ))}

      <h2 className={SECTION}>Languages</h2>
      <ul className="mt-2 list-disc pl-5">
        {languages.map((lang) => (
          <li key={lang.name}>
            {lang.name} — {lang.level}
          </li>
        ))}
      </ul>
    </>
  )
}
