import { describe, expect, it } from 'vitest'
import { getContent } from '../../content'
import { formatRange } from '../../lib/format'
import { complete, promptFor, runCommand, type TerminalContext } from './commands'

const ctx = (cwd = 'root', history: string[] = []): TerminalContext => ({ cwd, history })

const { profile, experience, projects, skills, links, documents } = getContent()
const linkedinUrl = links.find((l) => l.id === 'linkedin')!.url
const githubUrl = links.find((l) => l.id === 'github')!.url
const hello = documents.find((d) => d.id === 'hello')!

describe('runCommand', () => {
  it('help lists every command', () => {
    const { lines } = runCommand('help', ctx())
    for (const name of [
      'help', 'whoami', 'about', 'experience', 'projects', 'skills', 'contact', 'resume', 'open <app>',
      'ls', 'cd', 'cat', 'neofetch', 'clear', 'history', 'sudo',
    ]) {
      expect(lines).toContain(name)
    }
  })

  it('whoami prints the profile name', () => {
    expect(runCommand('whoami', ctx()).lines).toEqual([profile.name])
  })

  it('about prints the headline and summary', () => {
    expect(runCommand('about', ctx()).lines).toEqual([profile.headline, profile.summary])
  })

  it('experience prints one line per role', () => {
    expect(runCommand('experience', ctx()).lines).toEqual(
      experience.map((e) => `${e.role} — ${e.company} (${formatRange(e.start, e.end)})`),
    )
  })

  it('projects prints one line per project title', () => {
    expect(runCommand('projects', ctx()).lines).toEqual(projects.map((p) => p.title))
  })

  it('skills prints one line per group', () => {
    expect(runCommand('skills', ctx()).lines).toEqual(skills.map((g) => `${g.label}: ${g.items.join(', ')}`))
  })

  it('contact prints the email and profile URLs without a phone number', () => {
    expect(runCommand('contact', ctx()).lines).toEqual([profile.email, linkedinUrl, githubUrl])
  })

  it('resume activates the Resume app through the dock', () => {
    expect(runCommand('resume', ctx())).toEqual({
      open: { type: 'dock.activate', appId: 'resume' },
      lines: ['Opening Resume…'],
    })
  })

  it('open <app> activates the app by id or name, ignoring case', () => {
    expect(runCommand('open mail', ctx()).open).toEqual({ type: 'dock.activate', appId: 'mail' })
    expect(runCommand('open Mail', ctx()).open).toEqual({ type: 'dock.activate', appId: 'mail' })
  })

  it('open of an unknown name explains why nothing opened', () => {
    expect(runCommand('open nope', ctx())).toEqual({ lines: ['open: no app or file named nope'] })
  })

  it('open of a file in the current folder runs the file open command', () => {
    expect(runCommand('open Hello.md', ctx('about')).open).toEqual({
      type: 'app.open',
      appId: 'textedit',
      props: { fileId: 'doc-hello' },
    })
  })

  it('ls at the root lists the root folder names', () => {
    expect(runCommand('ls', ctx()).lines).toEqual([
      'Desktop', 'Documents', 'About Me', 'Work', 'Projects', 'Photos', 'Interests', 'Trash',
    ])
  })

  it('cd into a folder changes the working folder and ls lists its files', () => {
    const moved = runCommand('cd work', ctx())
    expect(moved.cwd).toBe('work')
    expect(runCommand('ls', ctx('work')).lines).toEqual(experience.map((e) => `${e.company} — ${e.role}.md`))
  })

  it('ls with a folder name lists that folder, like cd finds it', () => {
    expect(runCommand('ls work', ctx()).lines).toEqual(experience.map((e) => `${e.company} — ${e.role}.md`))
  })

  it('ls with a file name prints the file name', () => {
    expect(runCommand('ls Hello.md', ctx('about'))).toEqual({ lines: ['Hello.md'] })
  })

  it('ls with a missing folder says so', () => {
    expect(runCommand('ls nope', ctx())).toEqual({ lines: ['ls: no such folder: nope'] })
  })

  it('cd .. returns to the root, and cd .. at the root stays there', () => {
    expect(runCommand('cd ..', ctx('work')).cwd).toBe('root')
    expect(runCommand('cd ..', ctx()).cwd).toBe('root')
  })

  it('cd ~ goes to the root', () => {
    expect(runCommand('cd ~', ctx('work')).cwd).toBe('root')
  })

  it('cd to a missing folder says so', () => {
    expect(runCommand('cd nope', ctx())).toEqual({ lines: ['cd: no such folder: nope'] })
  })

  it('cd to a file says it is not a folder', () => {
    expect(runCommand('cd Hello.md', ctx('about'))).toEqual({ lines: ['cd: not a folder: Hello.md'] })
  })

  it('cat prints the preview body of a text file', () => {
    expect(runCommand('cat Hello.md', ctx('about')).lines).toEqual(hello.body.split('\n'))
  })

  it('cat of a PDF refuses and suggests open', () => {
    expect(runCommand('cat Resume.pdf', ctx('documents')).lines).toEqual([
      'cat: Resume.pdf: binary file — try: open Resume.pdf',
    ])
  })

  it('neofetch prints system lines and no hardware lines', () => {
    const { lines } = runCommand('neofetch', ctx())
    expect(lines.some((l) => l.startsWith('OS: bymaxOS'))).toBe(true)
    expect(lines.some((l) => l.startsWith('Kernel: React'))).toBe(true)
    expect(lines.some((l) => l.startsWith('Shell: bymaxsh'))).toBe(true)
    expect(lines.some((l) => l.startsWith('Apps: '))).toBe(true)
    expect(lines.join('\n')).not.toMatch(/CPU|GPU|Memory/)
  })

  it('clear asks the screen to empty', () => {
    expect(runCommand('clear', ctx())).toEqual({ lines: [], clear: true })
  })

  it('history numbers the previous commands', () => {
    expect(runCommand('history', ctx('root', ['ls', 'cd work'])).lines).toEqual(['1  ls', '2  cd work'])
  })

  it('sudo refuses whatever follows it', () => {
    expect(runCommand('sudo rm -rf /', ctx()).lines).toEqual([
      'maks is not in the sudoers file. This incident will be reported.',
    ])
  })

  it('an unknown command is reported as not found', () => {
    expect(runCommand('foo', ctx()).lines).toEqual(['bymaxsh: command not found: foo'])
  })

  it('empty or whitespace-only input prints nothing', () => {
    expect(runCommand('', ctx())).toEqual({ lines: [] })
    expect(runCommand('   ', ctx())).toEqual({ lines: [] })
  })

  it('ignores case and surrounding spaces', () => {
    expect(runCommand('  LS  ', ctx()).lines).toHaveLength(8)
  })

  it('a very long line does not throw', () => {
    expect(() => runCommand('x'.repeat(500), ctx())).not.toThrow()
  })
})

describe('complete', () => {
  it('completes a unique command name', () => {
    expect(complete('ne', ctx())).toBe('neofetch')
  })

  it('completes a folder name in the current folder', () => {
    expect(complete('cd wo', ctx())).toBe('cd Work')
  })

  it('leaves an ambiguous prefix unchanged', () => {
    expect(complete('c', ctx())).toBe('c')
  })
})

describe('promptFor', () => {
  it('shows the home prompt at the root and the folder name elsewhere', () => {
    expect(promptFor('root')).toBe('maks@bymaxos ~ %')
    expect(promptFor('work')).toBe('maks@bymaxos Work %')
  })
})
