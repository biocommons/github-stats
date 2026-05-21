# github-stats

Nuxt + Tailwind scaffold for the biocommons GitHub activity dashboard.

## Stack

- Nuxt (SPA mode)
- Vite bundling (Nuxt default)
- Tailwind CSS
- pnpm package manager

## Local setup (under 5 minutes)

1. Ensure pnpm version matches project:

```bash
corepack use pnpm@11.1.2
```

1. Install dependencies:

```bash
pnpm install
```

1. Run dev server:

```bash
pnpm dev
```

1. Build for production:

```bash
pnpm build
```

1. Preview production build locally:

```bash
pnpm preview
```

## Deployment (Vercel)

1. Import `biocommons/github-stats` in Vercel.
1. Use framework preset: `Nuxt`.
1. Keep defaults:
   - Install command: `pnpm install`
   - Build command: `pnpm build`
   - Output: managed by Nuxt/Vercel integration
1. Confirm deploy behavior:
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

API responses are cached in `/tmp/github-stats-cache/` for 15 minutes by default, so re-runs during development are fast.

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

### Schema versioning

`meta.json` carries a `schema_version` field (e.g. `"1.1"`). The frontend checks this on every page load and shows a warning banner when the data and frontend are incompatible.

Compatibility rules:

| Condition | Result |
| - | - |
| Different major version | Incompatible — breaking change assumed |
| Same major, data version < frontend minimum | Data too old — required fields may be missing |
| Same major, data version ≥ frontend minimum | Compatible — newer data is a superset the frontend safely ignores |

When bumping the schema:

- **Additive change** (new optional field): increment the minor version (`1.1` → `1.2`). Old frontends ignore the new field; new frontends tolerating older data may show degraded UI.
- **Breaking change** (removed/renamed field, changed shape): increment the major version (`1.x` → `2.0`). The frontend will show an incompatibility warning against any 1.x data.

The expected version is declared as `EXPECTED_SCHEMA_VERSION` in `app/composables/useDataMeta.ts`. The data version is set by `DATA_SCHEMA_VERSION` in `scripts/collect.py`. Both must be updated together when the schema changes.

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
