export const REPO_DISPLAY_NAMES: Record<string, string> = {
  'biocommons.seqrepo': 'seqrepo',
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
