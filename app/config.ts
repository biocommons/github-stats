export const REPO_DISPLAY_NAMES: Record<string, string> = {
  'biocommons.seqrepo': 'seqrepo',
}

export function repoDisplayName(repo: string): string {
  return REPO_DISPLAY_NAMES[repo] ?? repo
}
