#!/usr/bin/env python3
"""
Data collection script for biocommons GitHub stats dashboard.

Fetches activity data from all biocommons repos via GitHub REST API,
aggregates into JSON, and publishes to data/ directory.
"""

import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import click
import diskcache
import requests
from loguru import logger

# Configuration
REPOS_TO_COLLECT = [
    "anyvar",
    "biocommons.seqrepo",
    "bioutils",
    "hgvs",
    "uta",
    # administrative / infrastructure
    "infra",
    "biocommons.github.org",
    "github-stats",
    ".github",
    "eutils",
]
ORG = "biocommons"
DATA_SCHEMA_VERSION = "2.0"
DATA_DIR = Path(__file__).parent.parent / "data"


def configure_logging(verbosity: int) -> None:
    """Configure loguru logging level from Unix-style -v flags.

    Default: WARNING, -v: INFO, -vv+: DEBUG.
    """
    if verbosity <= 0:
        level = "WARNING"
    elif verbosity == 1:
        level = "INFO"
    else:
        level = "DEBUG"

    logger.remove()
    logger.add(
        sys.stderr,
        level=level,
        format=(
            "<level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>"
            " - <level>{message}</level>"
        ),
    )


class GitHubClient:
    """GitHub API client."""

    def __init__(self, token: str, cache_ttl: int = 900):
        self.base_url = "https://api.github.com"
        self._cache_ttl = cache_ttl
        self._cache: diskcache.Cache | None = None
        if cache_ttl > 0:
            cache_dir = Path("/tmp/github-stats-cache")
            logger.info(
                f"API cache enabled: ttl={cache_ttl}s, "
                f"dir={cache_dir} ({'exists' if cache_dir.exists() else 'will be created'})"
            )
            self._cache = diskcache.Cache(str(cache_dir))
        self.session = requests.Session()
        self.session.headers.update(
            {
                "Authorization": f"token {token}",
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": "biocommons/github-stats",
            }
        )

    def _get(self, url: str, params: dict | None = None) -> dict | list:
        """GET with optional disk cache."""
        key = (url, tuple(sorted((params or {}).items())))
        if self._cache is not None:
            cached = self._cache.get(key)
            if cached is not None:
                return cached
        response = self.session.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        if self._cache is not None:
            self._cache.set(key, data, expire=self._cache_ttl)
        return data

    def request(
        self,
        endpoint: str,
        *,
        allow_statuses: tuple[int, ...] = (),
    ) -> dict | list | None:
        """Make a single GET request to GitHub API."""
        url = f"{self.base_url}{endpoint}"
        try:
            return self._get(url)
        except requests.exceptions.HTTPError as e:
            status = e.response.status_code if e.response is not None else None
            if status in allow_statuses:
                return None
            logger.error(f"API request failed for {endpoint}: {e}")
            raise
        except requests.exceptions.RequestException as e:
            logger.error(f"API request failed for {endpoint}: {e}")
            raise

    def request_paginated(self, endpoint: str) -> list:
        """Fetch all paginated results from GitHub API."""
        results = []
        page = 1
        per_page = 100

        while True:
            url = f"{self.base_url}{endpoint}"
            params = {"page": page, "per_page": per_page}
            items = self._get(url, params=params)

            if not items:
                break

            results.extend(items)

            if len(items) < per_page:
                break

            page += 1

        return results

    def get_repo(self, owner: str, repo: str) -> dict:
        """Get repository metadata."""
        return self.request(f"/repos/{owner}/{repo}")

    def get_open_issue_count(self, owner: str, repo: str, *, has_issues: bool) -> int:
        """Get count of open issues."""
        if not has_issues:
            return 0

        try:
            result = self.request(f"/search/issues?q=repo:{owner}/{repo}+type:issue+state:open")
            if not isinstance(result, dict):
                return 0
            return result["total_count"]
        except requests.exceptions.HTTPError as e:
            status = e.response.status_code if e.response is not None else None
            if status == 422:
                # Some repos can reject search queries (for example, issues disabled).
                logger.warning(
                    f"Unable to search open issues for {owner}/{repo} (422); defaulting to 0.",
                )
                return 0
            raise

    def get_open_pr_count(self, owner: str, repo: str) -> int:
        """Get count of open pull requests."""
        # Use pulls endpoint to avoid search API edge-case failures.
        open_prs = self.request_paginated(f"/repos/{owner}/{repo}/pulls?state=open")
        return len(open_prs)

    def get_contributor_count(self, owner: str, repo: str) -> int:
        """Get count of contributors."""
        contributors = self.request_paginated(f"/repos/{owner}/{repo}/contributors")
        return len(contributors)

    def get_all_issues(self, owner: str, repo: str) -> list:
        """Get all issues (open and closed)."""
        return self.request_paginated(
            f"/repos/{owner}/{repo}/issues?state=all&sort=created&direction=asc"
        )

    def get_all_prs(self, owner: str, repo: str) -> list:
        """Get all pull requests."""
        return self.request_paginated(
            f"/repos/{owner}/{repo}/pulls?state=all&sort=created&direction=asc"
        )

    def get_latest_release(self, owner: str, repo: str) -> dict | None:
        """Get latest release."""
        result = self.request(
            f"/repos/{owner}/{repo}/releases/latest",
            allow_statuses=(404,),
        )
        if result is None:
            return None
        if not isinstance(result, dict):
            return None
        return result

    def get_all_commits(self, owner: str, repo: str) -> list:
        """Get all commits."""
        return self.request_paginated(f"/repos/{owner}/{repo}/commits?sort=created&direction=asc")

    def get_pr_reviews(self, owner: str, repo: str, pr_number: int) -> list:
        """Get reviews for a pull request."""
        return self.request_paginated(f"/repos/{owner}/{repo}/pulls/{pr_number}/reviews")


class DataCollector:
    """Collects GitHub data and aggregates it."""

    def __init__(
        self, token: str, cache_ttl: int = 900, max_workers: int = 5, repos: list[str] | None = None
    ):
        self.client = GitHubClient(token, cache_ttl=cache_ttl)
        self.max_workers = max_workers
        self.repo_list = repos if repos else REPOS_TO_COLLECT
        self.issues = []
        self.prs = []
        self.commits = []
        self.reviews = []
        self.repos = []
        self.skipped_repos: list[str] = []
        self.start_time: datetime | None = None
        self.end_time: datetime | None = None
        self.prev_collected_at, self.prev_data = self._load_prev_data()

    def _load_prev_data(self) -> tuple[str | None, dict[str, list]]:
        """Load previous run's collected_at and output files for skip logic."""
        meta_path = DATA_DIR / "meta.json"
        if not meta_path.exists():
            return None, {}
        try:
            meta = json.loads(meta_path.read_text())
            prev_collected_at = meta.get("collected_at")
            prev_data: dict[str, list] = {}
            for filename in [
                "repos.json",
                "issues.json",
                "prs.json",
                "commits.json",
                "reviews.json",
            ]:
                path = DATA_DIR / filename
                prev_data[filename] = json.loads(path.read_text()) if path.exists() else []
            logger.info(f"Previous run: collected_at={prev_collected_at}")
            return prev_collected_at, prev_data
        except Exception as e:
            logger.warning(f"Could not load previous data for skip logic: {e}")
            return None, {}

    def _restore_prev_repo(self, repo_key: str) -> None:
        """Copy previous run's data for a skipped repo into the collector's lists."""
        for item in self.prev_data.get("repos.json", []):
            if item["name"] == repo_key:
                self.repos.append(item)
                break
        self.issues.extend(
            i for i in self.prev_data.get("issues.json", []) if i["repo"] == repo_key
        )
        self.prs.extend(p for p in self.prev_data.get("prs.json", []) if p["repo"] == repo_key)
        self.commits.extend(
            c for c in self.prev_data.get("commits.json", []) if c["repo"] == repo_key
        )
        self.reviews.extend(
            r for r in self.prev_data.get("reviews.json", []) if r["repo"] == repo_key
        )

    def collect(self) -> None:
        """Collect data from all repositories in parallel."""
        self.start_time = datetime.now(UTC)
        logger.info("Starting data collection...")

        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = {
                executor.submit(self.collect_repo, ORG, repo_name): repo_name
                for repo_name in self.repo_list
            }

            for future in as_completed(futures):
                repo_name = futures[future]
                try:
                    future.result()
                    logger.info(f"Completed: {ORG}/{repo_name}")
                except Exception as e:
                    logger.error(f"Error collecting from {ORG}/{repo_name}: {e}")

        self.end_time = datetime.now(UTC)
        logger.info("Data collection complete.")

    def collect_repo(self, owner: str, repo: str) -> None:
        """Collect data from a single repository."""
        logger.debug(f"Fetching metadata for {owner}/{repo}...")
        # Collect repo metadata
        repo_data = self.client.get_repo(owner, repo)
        repo_key = repo_data["name"]
        if repo_key != repo:
            logger.info(
                f"Slug '{repo}' resolved to GitHub name '{repo_key}' — using canonical name as key."
            )

        if self.prev_collected_at and repo_data["updated_at"] <= self.prev_collected_at:
            logger.info(
                f"Skipping {owner}/{repo_key}: updated_at={repo_data['updated_at']}"
                f" <= collected_at={self.prev_collected_at}"
            )
            self.skipped_repos.append(repo_key)
            self._restore_prev_repo(repo_key)
            return

        open_issue_count = self.client.get_open_issue_count(
            owner,
            repo,
            has_issues=bool(repo_data.get("has_issues", True)),
        )
        open_pr_count = self.client.get_open_pr_count(owner, repo)
        contributor_count = self.client.get_contributor_count(owner, repo)
        latest_release = self.client.get_latest_release(owner, repo)

        self.repos.append(
            {
                "name": repo_key,
                "full_name": repo_data["full_name"],
                "html_url": repo_data["html_url"],
                "description": repo_data["description"],
                "stargazers_count": repo_data["stargazers_count"],
                "forks_count": repo_data["forks_count"],
                "open_issues_count": open_issue_count,
                "open_pr_count": open_pr_count,
                "contributors": contributor_count,
                "latest_release": {
                    "tag_name": latest_release["tag_name"],
                    "published_at": latest_release["published_at"],
                }
                if latest_release
                else None,
                "default_branch": repo_data["default_branch"],
                "private": repo_data["private"],
                "archived": repo_data.get("archived", False),
            }
        )
        logger.debug(f"Fetching issues for {owner}/{repo}...")

        # Collect issues
        issues = self.client.get_all_issues(owner, repo)
        for issue in issues:
            # Skip pull requests returned by issues endpoint
            if "pull_request" in issue:
                continue

            self.issues.append(
                {
                    "id": issue["id"],
                    "number": issue["number"],
                    "repo": repo_key,
                    "created_at": issue["created_at"],
                    "closed_at": issue["closed_at"],
                    "state": issue["state"],
                    "author_login": issue["user"]["login"] if issue["user"] else None,
                    "labels": [label["name"] for label in issue["labels"]],
                    "closed_by": issue["closed_by"]["login"] if issue["closed_by"] else None,
                }
            )

        logger.debug(f"Fetching PRs for {owner}/{repo}...")
        # Collect PRs
        prs = self.client.get_all_prs(owner, repo)
        for pr in prs:
            self.prs.append(
                {
                    "id": pr["id"],
                    "number": pr["number"],
                    "repo": repo_key,
                    "created_at": pr["created_at"],
                    "closed_at": pr["closed_at"],
                    "merged_at": pr["merged_at"],
                    "state": pr["state"],
                    "author_login": pr["user"]["login"] if pr["user"] else None,
                    "draft": pr["draft"],
                }
            )

        logger.debug(f"Fetching commits for {owner}/{repo}...")
        # Collect commits
        commits = self.client.get_all_commits(owner, repo)
        for commit in commits:
            self.commits.append(
                {
                    "author_login": commit.get("author", {}).get("login")
                    if commit.get("author")
                    else None,
                    "author_date": commit["commit"]["author"]["date"],
                    "repo": repo_key,
                }
            )

        logger.debug(f"Fetching PR reviews for {owner}/{repo}...")
        # Collect PR reviews
        for pr in prs:
            reviews = self.client.get_pr_reviews(owner, repo, pr["number"])
            for review in reviews:
                # Only count submitted reviews, skip pending
                if review["state"] != "PENDING":
                    self.reviews.append(
                        {
                            "reviewer_login": review["user"]["login"] if review["user"] else None,
                            "submitted_at": review["submitted_at"],
                            "repo": repo_key,
                        }
                    )

    def write(self) -> dict[str, Any]:
        """Write collected data to JSON files."""
        # Ensure data directory exists
        DATA_DIR.mkdir(exist_ok=True)

        # Calculate actual collection duration
        if self.start_time and self.end_time:
            collection_duration_ms = int((self.end_time - self.start_time).total_seconds() * 1000)
        else:
            collection_duration_ms = 0

        # Write meta.json
        collected_repos = sorted(r for r in self.repo_list if r not in self.skipped_repos)
        meta = {
            "collected_at": datetime.now(UTC).isoformat(),
            "schema_version": DATA_SCHEMA_VERSION,
            "repos": sorted(self.repo_list),
            "collected_repos": collected_repos,
            "skipped_repos": sorted(self.skipped_repos),
            "run_trigger": self.get_trigger(),
            "collection_duration_ms": collection_duration_ms,
        }
        self.write_json("meta.json", meta)

        # Write repos.json - sorted by name
        sorted_repos = sorted(self.repos, key=lambda r: r["name"])
        self.write_json("repos.json", sorted_repos)

        # Write issues.json - sorted by repo then id
        sorted_issues = sorted(self.issues, key=lambda i: (i["repo"], i["id"]))
        self.write_json("issues.json", sorted_issues)

        # Write prs.json - sorted by repo then id
        sorted_prs = sorted(self.prs, key=lambda p: (p["repo"], p["id"]))
        self.write_json("prs.json", sorted_prs)

        # Write commits.json - sorted by repo then date
        sorted_commits = sorted(self.commits, key=lambda c: (c["repo"], c["author_date"]))
        self.write_json("commits.json", sorted_commits)

        # Write reviews.json - sorted by repo then date
        sorted_reviews = sorted(self.reviews, key=lambda r: (r["repo"], r["submitted_at"]))
        self.write_json("reviews.json", sorted_reviews)

        # Write contributors.json
        contributors = self.aggregate_contributors()
        self.write_json("contributors.json", contributors)

        return {
            "data_dir": str(DATA_DIR),
            "collection_duration_ms": collection_duration_ms,
            "repos": len(self.repos),
            "skipped": len(self.skipped_repos),
            "issues": len(self.issues),
            "prs": len(self.prs),
            "commits": len(self.commits),
            "reviews": len(self.reviews),
            "contributors": len(contributors),
        }

    def aggregate_contributors(self) -> list:
        """Build contributor identity registry: login, avatar_url, first_contribution_at.

        Counts (all_time, by_repo) are left to the UI, which has all raw event files.
        first_contribution_at requires scanning all event types, so it stays here.
        """
        first_seen: dict[str, str] = {}

        def observe(login: str | None, date: str) -> None:
            if login and (login not in first_seen or date < first_seen[login]):
                first_seen[login] = date

        for issue in self.issues:
            observe(issue["author_login"], issue["created_at"])
        for pr in self.prs:
            observe(pr["author_login"], pr["created_at"])
        for commit in self.commits:
            observe(commit["author_login"], commit["author_date"])
        for review in self.reviews:
            observe(review["reviewer_login"], review["submitted_at"])

        return sorted(
            [
                {
                    "login": login,
                    "avatar_url": f"https://avatars.githubusercontent.com/{login}",
                    "first_contribution_at": date,
                }
                for login, date in first_seen.items()
            ],
            key=lambda c: c["login"],
        )

    def get_trigger(self) -> str:
        """Determine the trigger type for this run."""
        event_name = os.getenv("GITHUB_EVENT_NAME", "manual")
        if event_name == "schedule":
            return "schedule"
        elif event_name == "repository_dispatch":
            return "repository_dispatch"
        else:
            return event_name

    def write_json(self, filename: str, data: Any) -> None:
        """Write data to JSON file."""
        filepath = DATA_DIR / filename
        with open(filepath, "w") as f:
            json.dump(data, f, indent=2)
            f.write("\n")
        logger.debug(f"Wrote {filename}")


@click.command()
@click.option(
    "-v",
    "verbosity",
    count=True,
    help="Increase verbosity (-v=INFO, -vv=DEBUG).",
)
@click.option(
    "--cache-ttl",
    default=900,
    show_default=True,
    help="Cache API responses in /tmp for N seconds. Set to 0 to disable.",
)
@click.option(
    "--max-workers",
    default=5,
    show_default=True,
    help="Number of parallel threads for repo collection.",
)
@click.option(
    "--repos",
    multiple=True,
    help=(
        "Repos to collect (default: all). Repeat or comma-separate:"
        " --repos hgvs,seqrepo --repos uta"
    ),
)
def main(verbosity: int, cache_ttl: int, max_workers: int, repos: tuple[str, ...]) -> None:
    """Main entry point."""
    configure_logging(verbosity)
    github_token = os.getenv("GITHUB_TOKEN")

    if not github_token:
        logger.error("GITHUB_TOKEN environment variable is required")
        sys.exit(1)

    try:
        repo_list = [r for entry in repos for r in entry.split(",") if r]
        collector = DataCollector(
            github_token, cache_ttl=cache_ttl, max_workers=max_workers, repos=repo_list or None
        )
        collector.collect()
        summary = collector.write()

        # Summary should always go to stdout, independent of log verbosity.
        click.echo(f"Data written to {summary['data_dir']}")
        click.echo(f"Collection took {summary['collection_duration_ms']}ms")
        click.echo(f"Repos: {summary['repos']} ({summary['skipped']} skipped, unchanged)")
        click.echo(f"Issues: {summary['issues']}")
        click.echo(f"PRs: {summary['prs']}")
        click.echo(f"Commits: {summary['commits']}")
        click.echo(f"Reviews: {summary['reviews']}")
        click.echo(f"Contributors: {summary['contributors']}")
    except Exception as e:
        logger.exception(f"Fatal error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
