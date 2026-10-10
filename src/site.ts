import type { IconName } from './components/Icon'

/** Top-level navigation / route tabs. */
export const navTabs = [
  { to: '/solutions', label: 'Services' },
  { to: '/industries', label: 'Applications' },
  { to: '/about', label: 'About' },
] as const

export const brand = {
  name: 'Label AI',
  legal: 'Label AI (PVT) LTD',
  promise: 'We build AI capability that lasts.',
  /**
   * Canonical brand lockup — the single source for the emblem assets and the
   * display tagline. Every route consumes these; no page may restate them.
   * Display headings carry no terminal full stop.
   */
  lockup: {
    /** Hero emblem (mark only, decorative — the tagline carries the name). */
    mark: '/brand/mark-blue.svg',
    /** Footer lockup (full logo, labelled). */
    logo: '/brand/logo-dark.svg',
    tagline: {
      prefix: 'Where precision',
      /** Rotating slot word; index 0 is the static form. */
      words: ['meets', 'unlocks', 'shapes', 'propels', 'drives'],
      suffix: 'possibility',
    },
  },
  email: 'info@lai-labs.org',
  linkedin: 'https://www.linkedin.com/company/105919423/',
  locations: 'Europe and Africa',
}

/** Headline impact metrics — animated on the Impact page. */
export const impactStats: { value: number; suffix?: string; label: string; featured?: boolean }[] = [
  { value: 100, suffix: '+', label: 'Professionals trained', featured: true },
  { value: 50, suffix: '+', label: 'Specialised application-level models deployed', featured: true },
  { value: 100, suffix: '%', label: 'Ownership transferred to institutions' },
  { value: 3, label: 'Capability layers per engagement' },
  { value: 2, label: 'Continents of delivery experience' },
]

/** Services — each can be scoped independently or combined as required. */
export const solutions: { title: string; desc: string; points: string[] }[] = [
  {
    title: 'Frame & Design',
    desc: 'Define the application, success criteria, constraints and architecture.',
    points: ['Target application, users, and operating context', 'Success criteria, baselines, and acceptance evidence', 'Data, ML, software, runtime, and interface architecture', 'Constraints, dependencies, risks, and delivery scope'],
  },
  {
    title: 'Build & Evaluate',
    desc: 'Build the system and evaluate performance, limits and failure modes.',
    points: ['Representative data and annotation workflow where required', 'Baselines, model, and evaluation implementation', 'Software interfaces and representative runtime', 'Error analysis, operating envelope, and failure modes'],
  },
  {
    title: 'Integrate & Deploy',
    desc: 'Integrate the system into production with monitoring and rollback controls.',
    points: ['Production architecture and system integration', 'Data and update mechanisms plus runtime constraints', 'Acceptance, observability, security, and rollback controls', 'Deployment sequence, owners, dependencies, and release plan'],
  },
  {
    title: 'Transfer & Sustain',
    desc: 'Transfer the system, knowledge and practices for independent operation.',
    points: ['System artefacts and documentation', 'Maintainer and operator capability tied to the system', 'Roles, competencies, and operating practices', 'A clear ownership model for what comes next'],
  },
]

/** Industries (PDF §5.2). `caption` is the single website description of what the
 *  accompanying image shows; `focus` sets the crop anchor where the meaningful
 *  subject is not centred. */
export const industries: { icon: IconName; title: string; caption: string; img?: string; focus?: string }[] = [
  { icon: 'leaf', title: 'Agriculture', caption: 'Ripe tomatoes identified in greenhouse imagery.', img: '/img/ripe-tomato.jpeg' },
  { icon: 'shield', title: 'Government', caption: 'Key fields extracted from identity documents.', img: '/img/ocr1.png' },
  { icon: 'spark', title: 'Health', caption: 'Hand regions segmented in medical imagery.', img: '/img/hand-segmentation-task.jpeg' },
  { icon: 'globe', title: 'Climate', caption: 'Temperature anomalies mapped from climate data.', img: '/img/heat-map.png' },
  { icon: 'cpu', title: 'Energy', caption: 'Solar farms identified in satellite imagery.', img: '/img/solar.png' },
  { icon: 'compass', title: 'Traffic', caption: 'Traffic lights identified in street imagery.', img: '/img/traffic-lights.jpeg' },
  { icon: 'layers', title: 'Manufacturing', caption: 'Surface defects identified on manufactured parts.', img: '/img/industrial.jpg' },
]

/** Partnership models (PDF §5.4). */
export const partnershipModels: { icon: IconName; title: string; desc: string }[] = [
  { icon: 'compass', title: 'Strategic Advisory Partnerships', desc: 'Long-horizon guidance on AI strategy, governance, and institutional readiness.' },
  { icon: 'cpu', title: 'Implementation Partnerships', desc: 'Co-delivery of deployed AI systems embedded in your operations.' },
  { icon: 'graduation', title: 'Capacity Development Partnerships', desc: 'Structured programmes to build durable internal AI capability.' },
  { icon: 'database', title: 'Data Partnerships', desc: 'Scalable, quality-assured dataset production and annotation operations.' },
]

/** UN Sustainable Development Goals our work supports (nominative reference — not an
 *  endorsement, and not using the official UN logos). Rendered in our own brand style. */
export const sdgs: { n: number; name: string }[] = [
  { n: 1, name: 'No Poverty' },
  { n: 4, name: 'Quality Education' },
  { n: 5, name: 'Gender Equality' },
  { n: 8, name: 'Decent Work & Economic Growth' },
  { n: 9, name: 'Industry, Innovation & Infrastructure' },
  { n: 10, name: 'Reduced Inequalities' },
]

/** Partner-segment placeholders (no logos — approval pending). */
export const partnerSegments: { icon: IconName; name: string; desc: string; status: string }[] = [
  { icon: 'globe', name: 'Development organisations', desc: 'UN agencies, DFIs, and international NGOs — AI readiness and capacity building.', status: 'UNDP Zimbabwe — logo pending approval' },
  { icon: 'shield', name: 'Government institutions', desc: 'Ministries, municipalities, regulators, and state-owned enterprises.', status: 'Collaboration concept' },
  { icon: 'graduation', name: 'Academic & research', desc: 'Universities and research institutions bridging research and deployment.', status: 'Collaboration concept' },
]
