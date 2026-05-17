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
