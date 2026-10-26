import type { Education } from '../types'

export const education: Education[] = [
  {
    id: 'wust-msc',
    school: 'Wrocław University of Science and Technology',
    degree: 'M.Sc. in Project Management',
    start: '2026-03',
    location: 'Wrocław, Poland',
    notes: [
      'Coursework: Advanced Project Management, Project Team Management, Business Strategy, Simulation Games in Project Management.',
      'Developing competencies in Agile & traditional PM, risk assessment, and change management in technical environments.',
    ],
  },
  {
    id: 'wust-beng',
    school: 'Wrocław University of Science and Technology',
    degree: 'B.Eng. in Technical Computer Science — Graphics & Multimedia Systems',
    start: '2022-10',
    end: '2026-02',
    location: 'Wrocław, Poland',
    grade: '5/5',
    notes: [
      'Coursework: Web Interface Programming, Game Design, Image Recognition & Processing, Image Engineering.',
      'Solid foundation in algorithm design, databases, and software engineering principles.',
    ],
  },
  {
    id: 'shibaura',
    school: 'Shibaura Institute of Technology',
    start: '2025-03',
    end: '2025-08',
    location: 'Tokyo, Japan',
    notes: [
      'Coursework: Operating Systems, Embedded Systems, Data Engineering, Artificial Intelligence, Web Systems.',
    ],
  },
]
