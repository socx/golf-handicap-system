#!/usr/bin/env python3
"""Sync story markdown files to GitHub issues.

Parses files in product-management/stories and creates/updates one issue per story heading.
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, NoReturn, Optional, Tuple, cast

import requests
from requests import Response

API_BASE = "https://api.github.com"
STORIES_ROOT = Path("product-management/stories")

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


def fail(message: str) -> NoReturn:
    print(f"ERROR: {message}", file=sys.stderr)
    sys.exit(1)


def gh_request(method: str, url: str, token: str, **kwargs: Any) -> Response:
    headers = cast(Dict[str, str], kwargs.pop("headers", {}))
    headers.update(
        {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
    )
    resp = requests.request(method, url, headers=headers, timeout=30, **kwargs)
    if resp.status_code >= 400:
        raise RuntimeError(
            f"GitHub API error {resp.status_code} on {method} {url}: {resp.text}"
        )
    return resp


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


def find_issue_by_sync_key(
    repo: str, token: str, sync_key: str
) -> Optional[Dict[str, Any]]:
    query = f'repo:{repo} is:issue in:body "STORY_SYNC_KEY:{sync_key}"'
    resp = gh_request(
        "GET",
        f"{API_BASE}/search/issues",
        token,
        params={"q": query, "per_page": 1},
    ).json()
    items = resp.get("items", [])
    return items[0] if items else None


def ensure_label(repo: str, token: str, label: str, color: str, description: str = "") -> None:
    try:
        gh_request("GET", f"{API_BASE}/repos/{repo}/labels/{label}", token)
        return
    except RuntimeError as err:
        if "404" not in str(err):
            raise

    gh_request(
        "POST",
        f"{API_BASE}/repos/{repo}/labels",
        token,
        json={"name": label, "color": color, "description": description[:100]},
    )


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

    for path in sorted(STORIES_ROOT.glob("*.md")):
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
        ensure_label(repo, token, "story", LABEL_COLORS["story"], "Story work item")
        epic_label = f"epic:{epic_slug}"
        ensure_label(repo, token, epic_label, "5319E7", f"Stories for epic {epic_slug}")

        for heading, block in blocks:
            story_title = normalize_story_title(heading)
            sync_key = f"{rel_path}::{heading}"
            issue_title = f"[Story] {story_title}"

            body = story_issue_body(rel_path, heading, block, epic_slug, sync_key)

            labels = ["story", epic_label]

            size_match = re.search(r"\*\*Size:\*\*\s*(XS|S|M|L|XL)\b", block, re.I)
            if size_match:
                size_label = f"size:{size_match.group(1).lower()}"
                ensure_label(repo, token, size_label, SIZE_COLORS[size_match.group(1).lower()], "Story size")
                labels.append(size_label)

            priority_match = re.search(r"\*\*Priority:\*\*\s*(High|Medium|Low)\b", block, re.I)
            if priority_match:
                pri = priority_match.group(1).lower()
                pri_label = f"priority:{pri}"
                ensure_label(repo, token, pri_label, PRIORITY_COLORS[pri], "Story priority")
                labels.append(pri_label)

            existing = find_issue_by_sync_key(repo, token, sync_key)
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
                created += 1
                print(f"Created issue #{issue['number']}: {issue_title}")

    print(f"Sync complete. Created: {created}, Updated: {updated}")


if __name__ == "__main__":
    main()
