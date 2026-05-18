# github-stats

Nuxt + Tailwind scaffold for the biocommons GitHub activity dashboard.

## Stack

- Nuxt (SPA mode)
- Vite bundling (Nuxt default)
- Tailwind CSS
- pnpm package manager

## Local setup (under 5 minutes)

0. Ensure pnpm version matches project:

```bash
corepack use pnpm@11.1.2
```

1. Install dependencies:

```bash
pnpm install
```

2. Run dev server:

```bash
pnpm dev
```

3. Build for production:

```bash
pnpm build
```

4. Preview production build locally:

```bash
pnpm preview
```

## Deployment (Vercel)

1. Import `biocommons/github-stats` in Vercel.
2. Use framework preset: `Nuxt`.
3. Keep defaults:
	- Install command: `pnpm install`
	- Build command: `pnpm build`
	- Output: managed by Nuxt/Vercel integration
4. Confirm deploy behavior:
	- Push to `main` creates/updates production deploy.
	- Push to any feature branch creates a preview deployment URL.

## Data collection

The collector fetches activity from all watched biocommons repos and writes JSON to `data/`.

### Prerequisites

- Python 3.11+
- [uv](https://docs.astral.sh/uv/)
- `GITHUB_TOKEN` environment variable (a personal access token with `repo` read scope, or the default Actions token in CI)

### Run locally

```bash
export GITHUB_TOKEN=ghp_...
uv run scripts/collect.py
```

API responses are cached in `/tmp/github-stats-cache.sqlite` for 15 minutes by default, so re-runs during development are fast.

```bash
uv run scripts/collect.py -v          # INFO logging
uv run scripts/collect.py -vv         # DEBUG logging
uv run scripts/collect.py --cache-ttl 0   # bypass cache, force fresh fetch
```

### Output

Seven JSON files written to `data/`:

| File | Contents |
| - | - |
| `meta.json` | Collection timestamp, schema version, run trigger |
| `repos.json` | Per-repo metadata: stars, forks, open issues/PRs, latest release |
| `issues.json` | All issues (open + closed) across all repos |
| `prs.json` | All pull requests across all repos |
| `commits.json` | All commits with author and date |
| `reviews.json` | All PR reviews with reviewer and date |
| `contributors.json` | Contributor identity registry with first contribution date |

### CI

The GitHub Action (`.github/workflows/collect-stats.yml`) runs on:

- Hourly schedule
- Manual trigger (`workflow_dispatch`)
- `repository_dispatch` event type `github-activity` from watched repos

It publishes the `data/` directory to the `gh-pages` branch on every run.

## Current status

- Placeholder page is live in app shell to verify deploy pipeline.
- Data-driven tabs (Overview, Issues, PRs, Resolution time, Contributors) are tracked in follow-up issues.

## Troubleshooting

If you see `ERR_PNPM_IGNORED_BUILDS`:

- Confirm [pnpm-workspace.yaml](pnpm-workspace.yaml) has `allowBuilds` booleans for `@parcel/watcher` and `esbuild`.
- Reinstall cleanly:

```bash
rm -rf node_modules
pnpm install
```
