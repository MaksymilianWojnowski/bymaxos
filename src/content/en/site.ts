import type { Site } from '../types'

export const site: Site = {
  // TODO(content): repository URL
  wallpapers: [
    {
      id: 'default',
      name: 'Sonoma Dusk',
      // TODO(content): personal wallpaper
      gradient: 'linear-gradient(160deg,#1b2a4a 0%,#3b3f8f 35%,#c0587e 70%,#f2a65a 100%)',
    },
    {
      id: 'graphite',
      name: 'Graphite',
      // TODO(content): personal wallpaper
      gradient: 'linear-gradient(160deg,#2b2b2e,#4a4a52 60%,#6b6b75)',
    },
  ],
  // TODO(content): phone-free PDF
  resume: {},
  // TODO(content): scheduling link
  // TODO(content): meeting types (Cal.com event slugs)
  scheduling: { meetingTypes: [] },
}
