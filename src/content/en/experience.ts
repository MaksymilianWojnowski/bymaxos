import type { Experience } from '../types'

export const experience: Experience[] = [
  {
    id: 'nokia',
    company: 'Nokia',
    role: 'Lead Frontend Developer',
    start: '2025-10',
    location: 'Wrocław, Poland',
    highlights: [
      {
        title: 'Ceremonies & facilitation',
        text: 'sole facilitator for a 7-person cross-functional squad — running syncs, front-end design reviews (with UI/UX, Product Owner, Tech Lead, and Line Manager), and retrospectives; consistently capture decisions, align priorities, and unblock delivery.',
      },
      {
        title: 'Technical ownership',
        text: 'sole frontend engineer on a production web app; delivered 100+ tickets across 10+ major features since joining, driving the full UI lifecycle from requirements to release.',
      },
      {
        title: 'Stakeholder collaboration',
        text: 'host and often final decision-maker in weekly front-end review sessions; translate business requirements from the Product Owner and design intent from UI/UX into precise, implementable increments.',
      },
      {
        title: 'External code review',
        text: 'act as gatekeeper for third-party UI contributions — validate external modules against quality, security, and consistency standards before production deployment.',
      },
      {
        title: 'Documentation & quality',
        text: 'maintain component guidelines, contribution rules, and release notes; enforce CI checks (lint/tests) to keep codebase healthy and onboarding smooth.',
      },
    ],
  },
  {
    id: 'code-technica',
    company: 'Code Technica',
    role: 'Frontend Developer',
    start: '2024-07',
    end: '2025-09',
    location: 'Miami, USA (Hybrid)',
    highlights: [
      {
        title: 'Feature development',
        text: 'built ~10 data-management modules in React/Next.js (PrimeReact, PrimeFlex) for an enterprise-grade platform targeting organisations of 50,000+ employees.',
      },
      {
        title: 'UX & workflow improvements',
        text: 'redesigned forms and UI interactions to reduce friction in complex data-entry flows, directly improving task completion and reducing user errors.',
      },
      {
        title: 'Performance & maintainability',
        text: 'refactored components to cut load-time bottlenecks and improve long-term maintainability across a three-person team.',
      },
    ],
  },
]
