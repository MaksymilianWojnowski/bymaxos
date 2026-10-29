import { useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { getContent } from '../../content'
import { copyText } from '../../lib/clipboard'
import { buildMailto } from '../../lib/mailto'
import { useWindowCommands } from '../../system/commands'
import { useSystem } from '../../system/store'
import { Sheet } from '../../ui/Sheet'
import type { AppProps } from '../types'

const FIELD =
  'w-full rounded-[6px] border border-black/15 bg-white px-2 py-1 text-[13px] text-black focus-visible:ring-2 focus-visible:ring-accent-link dark:border-white/15 dark:bg-[#1e1e1e] dark:text-white'
const ERROR = 'text-[12px] text-red-700 dark:text-red-400'

// Compose only: the draft goes to the visitor's email app. Nothing is sent from this page.
export default function MailApp({ windowId }: AppProps) {
  const email = getContent().profile.email
  const notify = useSystem((s) => s.notify)
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState({ subject: false, message: false })
  const [sheetOpen, setSheetOpen] = useState(false)
  const subjectRef = useRef<HTMLInputElement>(null)
  const messageRef = useRef<HTMLTextAreaElement>(null)

  const send = () => {
    const nextErrors = { subject: !subject.trim(), message: !message.trim() }
    setErrors(nextErrors)
    if (nextErrors.subject || nextErrors.message) {
      // Subject comes first in the form, so it takes focus when both are blank.
      const first = nextErrors.subject ? subjectRef : messageRef
      first.current?.focus()
      return
    }
    const signed = name.trim() ? `\n\n— ${name.trim()}` : ''
    window.open(
      buildMailto({ to: email, subject: subject.trim(), body: message.trim() + signed }),
      '_self',
    )
    notify('Mail', 'Handed your draft to your email app — nothing has been sent yet.')
    setSheetOpen(true)
  }

  useWindowCommands(windowId, { 'mail.send': send })

  const copyAddress = async () => {
    const ok = await copyText(email)
    notify(
      'Mail',
      ok ? 'Email address copied.' : "Couldn't copy the address — select it and copy it manually.",
    )
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        send()
      }}
      className="flex h-full min-h-0 flex-col gap-3 bg-window p-4 font-sans text-[13px] text-text-1"
    >
      <div className="flex justify-end">
        <button
          type="submit"
          aria-label="Send"
          title="Send"
          className="grid h-7 w-8 place-items-center rounded-[6px] bg-accent-strong text-white"
        >
          <Send className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="grid grid-cols-[72px_1fr] items-center gap-x-3 gap-y-2">
        <label htmlFor="mail-to">To</label>
        <input id="mail-to" className={FIELD} value={email} readOnly />

        <label htmlFor="mail-name">Your name</label>
        <input
          id="mail-name"
          className={FIELD}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label htmlFor="mail-subject">Subject</label>
        <div>
          <input
            id="mail-subject"
            className={FIELD}
            ref={subjectRef}
            value={subject}
            aria-invalid={errors.subject}
            aria-describedby={errors.subject ? 'mail-subject-error' : undefined}
            onChange={(e) => {
              setSubject(e.target.value)
              setErrors((prev) => ({ ...prev, subject: false }))
            }}
          />
          {errors.subject && (
            <p id="mail-subject-error" role="alert" className={ERROR}>
              Add a subject.
            </p>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1">
        <label htmlFor="mail-message">Message</label>
        <textarea
          id="mail-message"
          className={`${FIELD} min-h-0 flex-1 resize-none`}
          ref={messageRef}
          value={message}
          aria-invalid={errors.message}
          aria-describedby={errors.message ? 'mail-message-error' : undefined}
          onChange={(e) => {
            setMessage(e.target.value)
            setErrors((prev) => ({ ...prev, message: false }))
          }}
        />
        {errors.message && (
          <p id="mail-message-error" role="alert" className={ERROR}>
            Write a message.
          </p>
        )}
      </div>

      {sheetOpen && (
        <Sheet title="Finish in your email app" onClose={() => setSheetOpen(false)}>
          <p>
            bymaxOS doesn't send email. Your draft was handed to your default email app — nothing
            has been sent yet. Review it there and press Send. If no app opened, write to {email}.
          </p>
          <div className="flex justify-start">
            <button
              type="button"
              onClick={copyAddress}
              className="rounded-[6px] border border-black/15 px-3 py-1 dark:border-white/15"
            >
              Copy address
            </button>
          </div>
        </Sheet>
      )}
    </form>
  )
}
