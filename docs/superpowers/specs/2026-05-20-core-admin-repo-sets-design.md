# Core / Admin Repo Sets — Design Spec

**Date:** 2026-05-20  
**Status:** Approved

---

## Background

biocommons maintains two categories of repos: five core bioinformatics libraries (anyvar, biocommons.seqrepo, bioutils, hgvs, uta) and several administrative/infrastructure repos (infra, biocommons.github.org, github-stats, .github, eutils). The dashboard currently only covers core repos. This spec adds admin repos without letting them crowd out the core use case.

---

## Repo Classification

Two named sets, declared in `config.ts`:

```ts
export const ADMIN_REPOS = new Set([
  'infra',
  'biocommons.github.org',
  'github-stats',
  '.github',
  'eutils',
])
```

Core repos are everything in `repos.json` not in `ADMIN_REPOS`. No explicit `CORE_REPOS` constant — derived at runtime.

`infra` is private; `eutils` is archived. Both are still collected and displayed; the distinction is visual only.

---

## Data Layer

### collect.py

Add admin repos to `REPOS_TO_COLLECT`:

```python
REPOS_TO_COLLECT = [
    "anyvar", "biocommons.seqrepo", "bioutils", "hgvs", "uta",  # core
    "infra", "biocommons.github.org", "github-stats", ".github", "eutils",  # admin
]
```

Pass two new fields per repo into `repos.json`:

- `private: bool` — from `repo_data["private"]`
- `archived: bool` — from `repo_data["archived"]`

No schema changes to commits, PRs, issues, or contributors JSON — they reference repos by name only.

### RepoCardData interface

Add `private: boolean` and `archived: boolean` to the `RepoCardData` TypeScript interface in `useOverviewData.ts`.

---

## Overview Page

Two visual sections in a single page, no toggle:

1. **Core libraries** — existing RepoCard grid, sorted by stars (no change to current behavior)
2. **Infrastructure & Meta** — separate section below with a subdued heading, same `RepoCard` component with visual badges:
   - Private repos: `fa-lock` icon beside the repo name
   - Archived repos: muted "archived" badge in place of the release tag

The four org summary cards (stars, contributors, issues, PRs) count **core repos only**.

`useOverviewData` gains a second computed property `adminRepoCards` alongside the existing `repoCards`.

---

## Issues & PRs Pages

A **Core | Admin** pill toggle is added to both pages.

- Default: **Core**
- URL-synced: `?set=admin` (same pattern as the existing timespan `?timespan=` param)
- Switching the toggle passes a different repo list into the flow composable; the composable itself is unchanged
- The timespan selector is independent of the set toggle

---

## Contributors Page

A **Core | Admin** pill toggle, default **Core**.

### Core view (default)
- Individual column per core repo (as today)
- One pooled **"Admin"** meta-column: sum of commits + PRs + reviews across all admin repos for each contributor
- Only contributors with any activity in core repos or admin repos are shown (natural row filtering)

### Admin view
- Individual column per admin repo
- One pooled **"Core"** meta-column: sum across all core repos
- Naturally fewer rows — most contributors only touch core repos

### Total column
Always the grand sum across **all** repos (core + admin) and **all time**, regardless of which view is active or what timespan is selected. This is unchanged from current behavior for core contributors.

### Expert ring (Pareto)
The expert-repo logic applies to individual repo columns in the active view. The meta-column (Admin or Core) is treated as a single unit for Pareto purposes.

---

## URL State

| Page | Param | Values | Default |
|------|-------|--------|---------|
| Issues | `?set=` | `core`, `admin` | `core` |
| PRs | `?set=` | `core`, `admin` | `core` |
| Contributors | `?set=` | `core`, `admin` | `core` |

The `?set=` param is independent of `?timespan=`.

---

## Out of Scope

- Repos from outside the biocommons org
- Per-admin-repo expert rings (only the pooled meta-column)
- Admin repos contributing to org summary counts
