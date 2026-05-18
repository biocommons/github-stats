#!/usr/bin/env python3
"""
Data collection script for biocommons GitHub stats dashboard.

Fetches activity data from all biocommons repos via GitHub REST API,
aggregates into JSON, and publishes to data/ directory.
"""

import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Optional
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from loguru import logger

# Configure loguru
logger.remove()  # Remove default handler
logger.add(sys.stderr, format="<level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan> - <level>{message}</level>")

# Configuration
REPOS_TO_COLLECT = ['anyvar', 'bioutils', 'eutils', 'hgvs', 'seqrepo', 'seqrepo-rest-service', 'uta']
ORG = 'biocommons'
DATA_DIR = Path(__file__).parent.parent / 'data'
GITHUB_TOKEN = os.getenv('GITHUB_TOKEN')


class GitHubClient:
    """GitHub API client."""

    def __init__(self, token: str):
        self.token = token
        self.base_url = 'https://api.github.com'
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'token {token}',
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'biocommons/github-stats',
        })

    def request(self, endpoint: str) -> dict | list:
        """Make a single GET request to GitHub API."""
        url = f'{self.base_url}{endpoint}'
        try:
            response = self.session.get(url)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"API request failed for {endpoint}: {e}")
            raise

    def request_paginated(self, endpoint: str) -> list:
        """Fetch all paginated results from GitHub API."""
        results = []
        page = 1
        per_page = 100

        while True:
            url = f'{self.base_url}{endpoint}'
            params = {'page': page, 'per_page': per_page}
            response = self.session.get(url, params=params)
            response.raise_for_status()
            items = response.json()

            if not items:
                break

            results.extend(items)

            if len(items) < per_page:
                break

            page += 1

        return results

    def get_repo(self, owner: str, repo: str) -> dict:
        """Get repository metadata."""
        return self.request(f'/repos/{owner}/{repo}')

    def get_open_issue_count(self, owner: str, repo: str) -> int:
        """Get count of open issues."""
        result = self.request(f'/search/issues?q=repo:{owner}/{repo}+type:issue+state:open')
        return result['total_count']

    def get_open_pr_count(self, owner: str, repo: str) -> int:
        """Get count of open pull requests."""
        result = self.request(f'/search/issues?q=repo:{owner}/{repo}+type:pr+state:open')
        return result['total_count']

    def get_contributor_count(self, owner: str, repo: str) -> int:
        """Get count of contributors."""
        contributors = self.request_paginated(f'/repos/{owner}/{repo}/contributors')
        return len(contributors)

    def get_all_issues(self, owner: str, repo: str) -> list:
        """Get all issues (open and closed)."""
        return self.request_paginated(f'/repos/{owner}/{repo}/issues?state=all&sort=created&direction=asc')

    def get_all_prs(self, owner: str, repo: str) -> list:
        """Get all pull requests."""
        return self.request_paginated(f'/repos/{owner}/{repo}/pulls?state=all&sort=created&direction=asc')

    def get_latest_release(self, owner: str, repo: str) -> Optional[dict]:
        """Get latest release."""
        try:
            return self.request(f'/repos/{owner}/{repo}/releases/latest')
        except requests.exceptions.HTTPError:
            return None

    def get_all_commits(self, owner: str, repo: str) -> list:
        """Get all commits."""
        return self.request_paginated(f'/repos/{owner}/{repo}/commits?sort=created&direction=asc')

    def get_pr_reviews(self, owner: str, repo: str, pr_number: int) -> list:
        """Get reviews for a pull request."""
        return self.request_paginated(f'/repos/{owner}/{repo}/pulls/{pr_number}/reviews')


class DataCollector:
    """Collects GitHub data and aggregates it."""

    def __init__(self, token: str):
        self.client = GitHubClient(token)
        self.issues = []
        self.prs = []
        self.commits = []
        self.reviews = []
        self.repos = []
        self.start_time: Optional[datetime] = None
        self.end_time: Optional[datetime] = None

    def collect(self) -> None:
        """Collect data from all repositories in parallel."""
        self.start_time = datetime.now()
        logger.info('Starting data collection...')

        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = {
                executor.submit(self.collect_repo, ORG, repo_name): repo_name
                for repo_name in REPOS_TO_COLLECT
            }

            for future in as_completed(futures):
                repo_name = futures[future]
                try:
                    future.result()
                    logger.info(f'Completed: {ORG}/{repo_name}')
                except Exception as e:
                    logger.error(f'Error collecting from {ORG}/{repo_name}: {e}')

        self.end_time = datetime.now()
        logger.info('Data collection complete.')

    def collect_repo(self, owner: str, repo: str) -> None:
        """Collect data from a single repository."""
        logger.debug(f'Fetching metadata for {owner}/{repo}...')
        # Collect repo metadata
        repo_data = self.client.get_repo(owner, repo)
        open_issue_count = self.client.get_open_issue_count(owner, repo)
        open_pr_count = self.client.get_open_pr_count(owner, repo)
        contributor_count = self.client.get_contributor_count(owner, repo)
        latest_release = self.client.get_latest_release(owner, repo)

        self.repos.append({
            'name': repo_data['name'],
            'full_name': repo_data['full_name'],
            'html_url': repo_data['html_url'],
            'description': repo_data['description'],
            'stargazers_count': repo_data['stargazers_count'],
            'forks_count': repo_data['forks_count'],
            'open_issues_count': open_issue_count,
            'contributors': contributor_count,
            'latest_release': {
                'tag_name': latest_release['tag_name'],
                'published_at': latest_release['published_at'],
            } if latest_release else None,
            'default_branch': repo_data['default_branch'],
        })
        logger.debug(f'Fetching issues for {owner}/{repo}...')

        # Collect issues
        issues = self.client.get_all_issues(owner, repo)
        for issue in issues:
            # Skip pull requests returned by issues endpoint
            if 'pull_request' in issue:
                continue

            self.issues.append({
                'id': issue['id'],
                'number': issue['number'],
                'repo': repo,
                'created_at': issue['created_at'],
                'closed_at': issue['closed_at'],
                'state': issue['state'],
                'author_login': issue['user']['login'] if issue['user'] else None,
                'labels': [label['name'] for label in issue['labels']],
                'closed_by': issue['closed_by']['login'] if issue['closed_by'] else None,
            })

        logger.debug(f'Fetching PRs for {owner}/{repo}...')
        # Collect PRs
        prs = self.client.get_all_prs(owner, repo)
        for pr in prs:
            self.prs.append({
                'id': pr['id'],
                'number': pr['number'],
                'repo': repo,
                'created_at': pr['created_at'],
                'closed_at': pr['closed_at'],
                'merged_at': pr['merged_at'],
                'state': pr['state'],
                'author_login': pr['user']['login'] if pr['user'] else None,
                'draft': pr['draft'],
            })

        logger.debug(f'Fetching commits for {owner}/{repo}...')
        # Collect commits
        commits = self.client.get_all_commits(owner, repo)
        for commit in commits:
            self.commits.append({
                'author_login': commit.get('author', {}).get('login') if commit.get('author') else None,
                'author_date': commit['commit']['author']['date'],
                'repo': repo,
            })

        logger.debug(f'Fetching PR reviews for {owner}/{repo}...')
        # Collect PR reviews
        for pr in prs:
            reviews = self.client.get_pr_reviews(owner, repo, pr['number'])
            for review in reviews:
                # Only count submitted reviews, skip pending
                if review['state'] != 'PENDING':
                    self.reviews.append({
                        'reviewer_login': review['user']['login'] if review['user'] else None,
                        'submitted_at': review['submitted_at'],
                        'repo': repo,
                    })

    def write(self) -> None:
        """Write collected data to JSON files."""
        # Ensure data directory exists
        DATA_DIR.mkdir(exist_ok=True)

        # Calculate actual collection duration
        if self.start_time and self.end_time:
            collection_duration_ms = int((self.end_time - self.start_time).total_seconds() * 1000)
        else:
            collection_duration_ms = 0

        # Write meta.json
        meta = {
            'collected_at': datetime.now().isoformat(),
            'schema_version': '1.0',
            'repos': sorted(REPOS_TO_COLLECT),
            'run_trigger': self.get_trigger(),
            'collection_duration_ms': collection_duration_ms,
        }
        self.write_json('meta.json', meta)

        # Write repos.json - sorted by name
        sorted_repos = sorted(self.repos, key=lambda r: r['name'])
        self.write_json('repos.json', sorted_repos)

        # Write issues.json - sorted by repo then id
        sorted_issues = sorted(self.issues, key=lambda i: (i['repo'], i['id']))
        self.write_json('issues.json', sorted_issues)

        # Write prs.json - sorted by repo then id
        sorted_prs = sorted(self.prs, key=lambda p: (p['repo'], p['id']))
        self.write_json('prs.json', sorted_prs)

        # Write contributors.json
        contributors = self.aggregate_contributors()
        self.write_json('contributors.json', contributors)

        logger.info(f'Data written to {DATA_DIR}')
        logger.info(f'Collection took {collection_duration_ms}ms')
        logger.info(f'Repos: {len(self.repos)}')
        logger.info(f'Issues: {len(self.issues)}')
        logger.info(f'PRs: {len(self.prs)}')
        logger.info(f'Commits: {len(self.commits)}')
        logger.info(f'Reviews: {len(self.reviews)}')
        logger.info(f'Contributors: {len(contributors)}')

    def aggregate_contributors(self) -> list:
        """Aggregate contributor data."""
        contributor_map: dict[str, Any] = {}

        # Merge all events keyed by login
        all_events: list[dict] = []

        # Issues opened
        for issue in self.issues:
            if issue['author_login']:
                all_events.append({
                    'login': issue['author_login'],
                    'type': 'issues_opened',
                    'date': issue['created_at'],
                    'repo': issue['repo'],
                })

        # PRs opened
        for pr in self.prs:
            if pr['author_login']:
                all_events.append({
                    'login': pr['author_login'],
                    'type': 'prs_opened',
                    'date': pr['created_at'],
                    'repo': pr['repo'],
                })

        # Commits
        for commit in self.commits:
            if commit['author_login']:
                all_events.append({
                    'login': commit['author_login'],
                    'type': 'commits',
                    'date': commit['author_date'],
                    'repo': commit['repo'],
                })

        # Reviews
        for review in self.reviews:
            if review['reviewer_login']:
                all_events.append({
                    'login': review['reviewer_login'],
                    'type': 'reviews_submitted',
                    'date': review['submitted_at'],
                    'repo': review['repo'],
                })

        # Aggregate by login
        for event in all_events:
            login = event['login']

            if login not in contributor_map:
                contributor_map[login] = {
                    'login': login,
                    'avatar_url': f"https://avatars.githubusercontent.com/{login}",
                    'first_contribution_at': event['date'],
                    'all_time': {
                        'commits': 0,
                        'issues_opened': 0,
                        'prs_opened': 0,
                        'reviews_submitted': 0,
                    },
                    'by_repo': {},
                    'monthly_series': [],
                }

            contrib = contributor_map[login]

            # Update first contribution
            if event['date'] < contrib['first_contribution_at']:
                contrib['first_contribution_at'] = event['date']

            # Update all_time counts
            contrib['all_time'][event['type']] += 1

            # Update by_repo counts
            if event['repo'] not in contrib['by_repo']:
                contrib['by_repo'][event['repo']] = {
                    'commits': 0,
                    'issues_opened': 0,
                    'prs_opened': 0,
                    'reviews_submitted': 0,
                }
            contrib['by_repo'][event['repo']][event['type']] += 1

        # Build monthly series
        for contrib in contributor_map.values():
            contrib_events = [e for e in all_events if e['login'] == contrib['login']]
            contrib['monthly_series'] = self.build_monthly_series(contrib_events)

        # Convert to array and sort by login
        result = sorted(contributor_map.values(), key=lambda c: c['login'])
        return result

    def build_monthly_series(self, events: list[dict]) -> list:
        """Build monthly time series for contributor events."""
        now = datetime.now()
        month_map: dict[str, dict] = {}

        # Initialize 12 months
        for i in range(11, -1, -1):
            d = datetime(now.year, now.month, 1) - timedelta(days=i * 30)
            d = datetime(d.year, d.month, 1)
            key = d.strftime('%Y-%m')
            month_map[key] = {
                'commits': 0,
                'issues_opened': 0,
                'prs_opened': 0,
                'reviews_submitted': 0,
            }

        # Aggregate events
        for event in events:
            d = datetime.fromisoformat(event['date'].replace('Z', '+00:00'))
            key = d.strftime('%Y-%m')

            if key in month_map:
                month_map[key][event['type']] += 1

        # Convert to array
        series = []
        for key in sorted(month_map.keys()):
            year, month = key.split('-')
            series.append({
                'year': int(year),
                'month': int(month),
                **month_map[key],
            })

        return series

    def get_trigger(self) -> str:
        """Determine the trigger type for this run."""
        event_name = os.getenv('GITHUB_EVENT_NAME', 'manual')
        if event_name == 'schedule':
            return 'schedule'
        elif event_name == 'repository_dispatch':
            return 'repository_dispatch'
        else:
            return event_name

    def write_json(self, filename: str, data: Any) -> None:
        """Write data to JSON file."""
        filepath = DATA_DIR / filename
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)
            f.write('\n')
        logger.info(f'✓ {filename}')


def main():
    """Main entry point."""
    if not GITHUB_TOKEN:
        logger.error('GITHUB_TOKEN environment variable is required')
        sys.exit(1)

    try:
        collector = DataCollector(GITHUB_TOKEN)
        collector.collect()
        collector.write()
        logger.info('Done!')
    except Exception as e:
        logger.exception(f'Fatal error: {e}')
        sys.exit(1)


if __name__ == '__main__':
    main()
