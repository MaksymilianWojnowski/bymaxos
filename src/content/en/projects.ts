import type { Project } from '../types'

export const projects: Project[] = [
  {
    id: 'thesis',
    title: 'Engineering Thesis',
    summary: 'Multidimensional analysis in data warehouses using BI tools',
    bullets: [
      'Built a reproducible analytics workflow to identify statistically rare NBA seasons meeting a quality threshold; received a top grade of 5/5.',
      'Prepared and standardised a dataset of 4,238 seasons (1979/80–2016/17); selected 953 peak seasons per player using BPM.',
      'Scored rarity using leave-one-out density percentiles (bottom 5%); validated robustness via bootstrap and bandwidth sensitivity testing.',
    ],
    tech: [],
    links: {},
  },
  {
    id: 'solve-unite',
    title: 'Solve & Unite!',
    summary: 'International Hackathon (Unite! Ideathon)',
    bullets: [
      'Originated, planned, and delivered an international hackathon uniting 25 participants from 5 universities across 5 countries (ULisboa, TU Darmstadt, Politecnico di Torino, Wrocław Tech, UBarcelona).',
      'Managed concept creation, logistics, and cross-institutional partnerships end-to-end; event success prompted Unite! to adopt the format as a recurring programme.',
    ],
    tech: [],
    links: {
      info: 'https://unite.pwr.edu.pl/oferty/unite-seed-fund-ideathon-przeksztalc-pomysly-w-projekty-o-zasiegu-miedzynarodowym/',
    },
  },
  {
    id: 'ligapwr',
    title: 'LigaPWr Web App',
    summary: 'Team of 5',
    bullets: [
      "Developed a Django web application to manage and visualise results of the university's sports league with real-time statistics and a user-friendly interface.",
    ],
    tech: ['Django', 'HTML', 'CSS', 'GitHub Projects'],
    links: {
      repo: 'https://github.com/informatyzacja/LigaPWr',
    },
  },
]
