export const GITHUB_ORG = 'biocommons'

export const CONTRIBUTOR_EXCLUDE: RegExp[] = [
  /\[bot\]$/,
  /^pyup-bot$/,
  /^copilot$/i,
]

export const ADMIN_REPOS = new Set([
  'infra',
  'biocommons.github.io',
  'github-stats',
  '.github',
])

export const META_REPO_ADMIN = '__admin__'
export const META_REPO_CORE = '__core__'
export const META_REPO_ARCHIVED = '__archived__'

export type RepoSet = 'core' | 'admin' | 'archived'

export interface RepoSetDef {
  key: RepoSet
  label: string
  metaKey: string
}

export const REPO_SETS: RepoSetDef[] = [
  { key: 'core',     label: 'Core',     metaKey: META_REPO_CORE },
  { key: 'admin',    label: 'Admin',    metaKey: META_REPO_ADMIN },
  { key: 'archived', label: 'Archived', metaKey: META_REPO_ARCHIVED },
]

export const REPO_DISPLAY_NAMES: Record<string, string> = {
  'biocommons.seqrepo': 'seqrepo',
  'biocommons.github.io': 'website',
}

export const REPO_PYPI: Record<string, string> = {
  anyvar: 'anyvar',
  'biocommons.seqrepo': 'biocommons.seqrepo',
  bioutils: 'bioutils',
  eutils: 'eutils',
  hgvs: 'hgvs',
}

export function repoDisplayName(repo: string): string {
  return REPO_DISPLAY_NAMES[repo] ?? repo
}

export const REPO_COLORS = [
  '#4a87e8', // blue
  '#e69138', // orange
  '#6aa84f', // green
  '#c05a8d', // pink
  '#7d65c0', // purple
  '#d94f3d', // red
  '#e8c130', // amber
]

export function repoColor(repo: string, allRepos: string[]): string {
  return REPO_COLORS[allRepos.indexOf(repo) % REPO_COLORS.length] ?? '#94a3b8'
}

// Evaluate contrast against the color as it appears at the given alpha blended over white.
export function contrastColor(hex: string, alpha = 1): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const br = r * alpha + 255 * (1 - alpha)
  const bg = g * alpha + 255 * (1 - alpha)
  const bb = b * alpha + 255 * (1 - alpha)
  return (0.299 * br + 0.587 * bg + 0.114 * bb) / 255 > 0.55 ? '#1e293b' : '#ffffff'
}
