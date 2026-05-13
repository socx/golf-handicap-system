#!/usr/bin/env python3
"""Sync an edited GitHub issue back into its source story file."""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Match, NoReturn, Optional


def fail(message: str) -> NoReturn:
    print(f"ERROR: {message}", file=sys.stderr)
    sys.exit(1)


def read_event_payload() -> Dict[str, Any]:
    event_path = os.environ.get("GITHUB_EVENT_PATH")
    if not event_path:
        fail("GITHUB_EVENT_PATH is not set")
    return json.loads(Path(event_path).read_text(encoding="utf-8"))


def extract_marker(body: str, marker: str) -> Optional[str]:
    m = re.search(rf"<!--\s*{re.escape(marker)}:(.*?)\s*-->", body)
    return m.group(1).strip() if m else None


def extract_section(block: str, section_name: str) -> Optional[str]:
    m = re.search(
        rf"^### {re.escape(section_name)}\s*$\n(.*?)(?=^### |^## |\Z)",
        block,
        re.M | re.S,
    )
    return m.group(1).rstrip() if m else None


def replace_section(block: str, section_name: str, new_content: str) -> str:
    pattern = re.compile(
        rf"(^### {re.escape(section_name)}\s*$\n)(.*?)(?=^### |^## |\Z)",
        re.M | re.S,
    )

    def _repl(match: Match[str]) -> str:
        return f"{match.group(1)}{new_content.strip()}\n\n"

    if pattern.search(block):
        return pattern.sub(_repl, block, count=1)

    # If section does not exist, append it.
    return block.rstrip() + f"\n\n### {section_name}\n{new_content.strip()}\n"


def replace_simple_field(block: str, field_name: str, value: str) -> str:
    pattern = re.compile(rf"\*\*{re.escape(field_name)}:\*\*\s*.*$")
    if pattern.search(block):
        return pattern.sub(f"**{field_name}:** {value}", block, count=1)
    return block


def sync_issue_to_file(
    story_file: Path, story_heading: str, issue_body: str, labels: List[str]
) -> bool:
    content = story_file.read_text(encoding="utf-8")

    # Locate the exact story heading block.
    heading_re = re.compile(rf"^##\s+{re.escape(story_heading)}\s*$", re.M)
    heading_match = heading_re.search(content)
    if not heading_match:
        print(f"Heading not found in {story_file}: {story_heading}")
        return False

    next_heading = re.search(r"^##\s+.+$", content[heading_match.end() :], re.M)
    block_start = heading_match.start()
    block_end = (
        heading_match.end() + next_heading.start() if next_heading else len(content)
    )

    block = content[block_start:block_end].rstrip()

    ac = extract_section(issue_body, "Acceptance Criteria")
    deps = extract_section(issue_body, "Dependencies")

    if ac:
        block = replace_section(block, "Acceptance Criteria", ac)
    if deps:
        block = replace_section(block, "Dependencies", deps)

    size_label = next((l for l in labels if l.startswith("size:")), None)
    if size_label:
        block = replace_simple_field(block, "Size", size_label.split(":", 1)[1].upper())

    priority_label = next((l for l in labels if l.startswith("priority:")), None)
    if priority_label:
        block = replace_simple_field(
            block,
            "Priority",
            priority_label.split(":", 1)[1].capitalize(),
        )

    new_content = content[:block_start] + block + "\n\n" + content[block_end:].lstrip("\n")

    if new_content == content:
        return False

    story_file.write_text(new_content, encoding="utf-8")
    print(f"Updated {story_file}")
    return True


def main() -> None:
    payload = read_event_payload()
    issue = payload.get("issue")
    if not issue:
        print("No issue payload. Nothing to do.")
        return

    # Ignore pull requests represented as issues.
    if issue.get("pull_request") is not None:
        print("Issue is a pull request. Skipping.")
        return

    body = issue.get("body", "") or ""
    labels = [item.get("name", "") for item in issue.get("labels", [])]

    story_path = extract_marker(body, "STORY_FILE")
    story_heading = extract_marker(body, "STORY_HEADING")

    if not story_path or not story_heading:
        print("No story markers found in issue body. Skipping.")
        return

    file_path = Path(story_path)
    if not file_path.exists():
        fail(f"Referenced story file does not exist: {story_path}")

    changed = sync_issue_to_file(file_path, story_heading, body, labels)

    output_path = os.environ.get("GITHUB_OUTPUT")
    if output_path:
        with open(output_path, "a", encoding="utf-8") as out:
            out.write(f"changed={'true' if changed else 'false'}\n")
            out.write(f"story_file={story_path}\n")


if __name__ == "__main__":
    main()
