import type { NotificationItem } from '../types'
import { profile } from './profile'

// TODO(content): review notification copy
export const notifications: NotificationItem[] = [
  {
    id: 'welcome',
    title: 'Welcome to bymaxOS',
    body: 'This Mac is my portfolio. Open Resume for the short version, or explore Finder.',
    appId: 'resume',
  },
  {
    id: 'open-to-work',
    title: 'Open to new roles',
    body: profile.lookingFor,
    appId: 'mail',
  },
  {
    id: 'github',
    title: 'Code on GitHub',
    body: 'Developer lists my public repositories, straight from GitHub.',
    appId: 'developer',
  },
]
