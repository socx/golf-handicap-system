#!/usr/bin/env python3
"""Sync story markdown files to GitHub issues.

Parses files in product-management/stories and creates/updates one issue per story heading.
"""

from __future__ import annotations

import os
import re
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, NoReturn, Optional, Tuple, cast

import requests
from requests import Response

API_BASE = "https://api.github.com"
STORIES_ROOT = Path("product-management/stories")
MUTATING_METHODS = {"POST", "PATCH", "PUT", "DELETE"}
MUTATION_DELAY_SECONDS = 2.0
MAX_RETRIES = 6

STORY_FILE_PATTERN = re.compile(r"^stories[-.].+\.md$")
SKIP_FILES = {"stories-index.md", "epics.md", "README.md"}

LABEL_COLORS = {
    "story": "1D76DB",
    "in-progress": "FBCA04",
    "needs-review": "D4C5F9",
    "needs-testing": "BFDADC",
    "ready": "0E8A16",
}

PRIORITY_COLORS = {
    "high": "B60205",
    "medium": "FBCA04",
    "low": "0E8A16",
}

SIZE_COLORS = {
    "xs": "C2E0C6",
    "s": "BFD4F2",
    "m": "D4C5F9",
    "l": "F9D0C4",
    "xl": "F4B2B2",
}

last_mutation_at = 0.0


def fail(message: str) -> NoReturn:
    print(f"ERROR: {message}", file=sys.stderr)
    sys.exit(1)


def is_secondary_rate_limit(resp: Response) -> bool:
    if resp.status_code not in {403, 429}:
        return False
    payload = resp.text.lower()
    return (
        "secondary rate limit" in payload
        or "temporarily blocked from content creation" in payload
        or "retry your request again later" in payload
    )


def throttle_mutation(method: str) -> None:
    global last_mutation_at

    if method.upper() not in MUTATING_METHODS:
        return

    now = time.monotonic()
    elapsed = now - last_mutation_at
    if elapsed < MUTATION_DELAY_SECONDS:
        time.sleep(MUTATION_DELAY_SECONDS - elapsed)


def retry_delay_seconds(resp: Response, attempt: int) -> float:
    retry_after = resp.headers.get("Retry-After")
    if retry_after:
        try:
            return max(float(retry_after), MUTATION_DELAY_SECONDS)
        except ValueError:
            pass

    # Exponential backoff capped at 60 seconds keeps the workflow moving
    # while respecting GitHub's secondary rate limits.
    return min(60.0, max(MUTATION_DELAY_SECONDS, 5.0 * (2 ** attempt)))


def gh_request(method: str, url: str, token: str, **kwargs: Any) -> Response:
    headers = cast(Dict[str, str], kwargs.pop("headers", {}))
    headers.update(
        {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
    )

    for attempt in range(MAX_RETRIES + 1):
        throttle_mutation(method)
        resp = requests.request(method, url, headers=headers, timeout=30, **kwargs)

        if resp.status_code < 400:
            if method.upper() in MUTATING_METHODS:
                global last_mutation_at
                last_mutation_at = time.monotonic()
            return resp

        if is_secondary_rate_limit(resp) and attempt < MAX_RETRIES:
            delay = retry_delay_seconds(resp, attempt)
            print(
                f"Secondary rate limit hit for {method} {url}. Retrying in {delay:.1f}s...",
                file=sys.stderr,
            )
            time.sleep(delay)
            continue

        raise RuntimeError(
            f"GitHub API error {resp.status_code} on {method} {url}: {resp.text}"
        )

    raise RuntimeError(f"Exceeded retry budget for {method} {url}")


def slug_from_filename(name: str) -> str:
    value = name.replace("stories-", "").replace("stories.", "").replace(".md", "")
    return value.replace(".", "-").strip().lower()


def extract_section(block: str, section_name: str) -> str:
    pattern = re.compile(rf"^### {re.escape(section_name)}\s*$\n(.*?)(?=^### |^## |\Z)", re.M | re.S)
    m = pattern.search(block)
    return m.group(1).strip() if m else ""


def parse_story_blocks(content: str) -> List[Tuple[str, str]]:
    """Return list of (heading, full_block_without_next_heading)."""
    heading_re = re.compile(r"^##\s+(.+?)\s*$", re.M)
    matches = list(heading_re.finditer(content))
    blocks: List[Tuple[str, str]] = []

    for idx, match in enumerate(matches):
        heading = match.group(1).strip()
        # Skip top-level title headings if they are not numbered/user stories.
        if "user stories" in heading.lower():
            continue
        start = match.start()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(content)
        block = content[start:end].strip()
        if "As a" not in block:
            continue
        blocks.append((heading, block))

    return blocks


def extract_sync_key(body: str) -> Optional[str]:
    match = re.search(r"<!--\s*STORY_SYNC_KEY:(.*?)\s*-->", body or "")
    return match.group(1).strip() if match else None


def load_existing_story_issues(repo: str, token: str) -> Dict[str, Dict[str, Any]]:
    existing: Dict[str, Dict[str, Any]] = {}
    page = 1

    while True:
        response = gh_request(
            "GET",
            f"{API_BASE}/repos/{repo}/issues",
            token,
            params={
                "state": "all",
                "labels": "story",
                "per_page": 100,
                "page": page,
            },
        ).json()

        if not response:
            break

        for issue in response:
            if issue.get("pull_request"):
                continue
            sync_key = extract_sync_key(issue.get("body", ""))
            if sync_key:
                existing[sync_key] = issue

        if len(response) < 100:
            break

        page += 1

    return existing


def load_existing_labels(repo: str, token: str) -> set[str]:
    labels: set[str] = set()
    page = 1

    while True:
        response = gh_request(
            "GET",
            f"{API_BASE}/repos/{repo}/labels",
            token,
            params={"per_page": 100, "page": page},
        ).json()

        if not response:
            break

        labels.update(label["name"] for label in response)

        if len(response) < 100:
            break

        page += 1

    return labels


def ensure_label(
    repo: str,
    token: str,
    existing_labels: set[str],
    label: str,
    color: str,
    description: str = "",
) -> None:
    if label in existing_labels:
        return

    gh_request(
        "POST",
        f"{API_BASE}/repos/{repo}/labels",
        token,
        json={"name": label, "color": color, "description": description[:100]},
    )
    existing_labels.add(label)


def story_issue_body(
    rel_path: str,
    heading: str,
    block: str,
    epic_slug: str,
    sync_key: str,
) -> str:
    ac = extract_section(block, "Acceptance Criteria")
    deps = extract_section(block, "Dependencies")

    size_match = re.search(r"\*\*Size:\*\*\s*(.+)", block)
    estimate_match = re.search(r"\*\*Estimate:\*\*\s*(.+)", block)
    priority_match = re.search(r"\*\*Priority:\*\*\s*(.+)", block)
    target_match = re.search(r"\*\*Target Date:\*\*\s*(.+)", block)

    # Keep the original story narrative exactly as captured from the file block.
    narrative = block.split("### Acceptance Criteria")[0].strip()

    return (
        f"<!-- STORY_SYNC_KEY:{sync_key} -->\n"
        f"<!-- STORY_FILE:{rel_path} -->\n"
        f"<!-- STORY_HEADING:{heading} -->\n\n"
        f"### Story Source\n"
        f"- File: `{rel_path}`\n"
        f"- Epic: `{epic_slug}`\n\n"
        f"### Story\n"
        f"{narrative}\n\n"
        f"### Acceptance Criteria\n"
        f"{ac or '- [ ] Define acceptance criteria'}\n\n"
        f"### Dependencies\n"
        f"{deps or '- None'}\n\n"
        f"### Metadata\n"
        f"- Size: {size_match.group(1).strip() if size_match else 'Unspecified'}\n"
        f"- Estimate: {estimate_match.group(1).strip() if estimate_match else 'Unspecified'}\n"
        f"- Priority: {priority_match.group(1).strip() if priority_match else 'Unspecified'}\n"
        f"- Target Date: {target_match.group(1).strip() if target_match else 'Unspecified'}\n\n"
        "---\n"
        "This issue is synchronized from story files. Update the story file for source-of-truth edits."
    )


def normalize_story_title(heading: str) -> str:
    cleaned = re.sub(r"^\d+\.\s*", "", heading).strip()
    return cleaned


def selected_story_paths() -> List[Path]:
    changed_files_env = os.environ.get("CHANGED_STORY_FILES", "").strip()

    if not changed_files_env:
        return sorted(STORIES_ROOT.glob("*.md"))

    selected: List[Path] = []
    for raw_path in changed_files_env.splitlines():
        normalized = raw_path.strip()
        if not normalized:
            continue

        path = Path(normalized)
        if path.name in SKIP_FILES:
            continue
        if not STORY_FILE_PATTERN.match(path.name):
            continue
        if not path.exists():
            print(f"Skipping missing changed story file: {normalized}")
            continue

        selected.append(path)

    return sorted(selected)


def main() -> None:
    repo_env = os.environ.get("GITHUB_REPOSITORY")
    token_env = os.environ.get("GITHUB_TOKEN")

    if not repo_env:
        fail("GITHUB_REPOSITORY is not set")
    if not token_env:
        fail("GITHUB_TOKEN is not set")

    repo: str = repo_env
    token: str = token_env

    if not STORIES_ROOT.exists():
        fail(f"Stories directory not found: {STORIES_ROOT}")

    created = 0
    updated = 0
    existing_issues = load_existing_story_issues(repo, token)
    existing_labels = load_existing_labels(repo, token)
    story_paths = selected_story_paths()

    if not story_paths:
        print("No changed story files to process.")
        return

    for path in story_paths:
        if path.name in SKIP_FILES:
            continue
        if not STORY_FILE_PATTERN.match(path.name):
            continue

        rel_path = path.as_posix()
        epic_slug = slug_from_filename(path.name)
        content = path.read_text(encoding="utf-8")
        blocks = parse_story_blocks(content)

        if not blocks:
            print(f"No parsable stories found in {rel_path}")
            continue

        # Ensure baseline labels are present before creating/updating issues.
        ensure_label(
            repo,
            token,
            existing_labels,
            "story",
            LABEL_COLORS["story"],
            "Story work item",
        )
        epic_label = f"epic:{epic_slug}"
        ensure_label(
            repo,
            token,
            existing_labels,
            epic_label,
            "5319E7",
            f"Stories for epic {epic_slug}",
        )

        for heading, block in blocks:
            story_title = normalize_story_title(heading)
            sync_key = f"{rel_path}::{heading}"
            issue_title = f"[Story] {story_title}"

            body = story_issue_body(rel_path, heading, block, epic_slug, sync_key)

            labels = ["story", epic_label]

            size_match = re.search(r"\*\*Size:\*\*\s*(XS|S|M|L|XL)\b", block, re.I)
            if size_match:
                size_label = f"size:{size_match.group(1).lower()}"
                ensure_label(
                    repo,
                    token,
                    existing_labels,
                    size_label,
                    SIZE_COLORS[size_match.group(1).lower()],
                    "Story size",
                )
                labels.append(size_label)

            priority_match = re.search(r"\*\*Priority:\*\*\s*(High|Medium|Low)\b", block, re.I)
            if priority_match:
                pri = priority_match.group(1).lower()
                pri_label = f"priority:{pri}"
                ensure_label(
                    repo,
                    token,
                    existing_labels,
                    pri_label,
                    PRIORITY_COLORS[pri],
                    "Story priority",
                )
                labels.append(pri_label)

            existing = existing_issues.get(sync_key)
            if existing:
                issue_number = existing["number"]
                gh_request(
                    "PATCH",
                    f"{API_BASE}/repos/{repo}/issues/{issue_number}",
                    token,
                    json={"title": issue_title, "body": body, "labels": labels},
                )
                updated += 1
                print(f"Updated issue #{issue_number}: {issue_title}")
            else:
                issue = gh_request(
                    "POST",
                    f"{API_BASE}/repos/{repo}/issues",
                    token,
                    json={"title": issue_title, "body": body, "labels": labels},
                ).json()
                existing_issues[sync_key] = issue
                created += 1
                print(f"Created issue #{issue['number']}: {issue_title}")

    print(f"Sync complete. Created: {created}, Updated: {updated}")


if __name__ == "__main__":
    main()
