#!/usr/bin/env bash
set -euo pipefail

cd /Users/musterion/Desktop/code/golf-handicap-system
repo="socx/golf-handicap-system"
report="/tmp/duplicate_action_report.csv"

echo "high,low,action,reason" > "$report"

pairs=$(awk '/^[[:space:]]*-[[:space:]]*[0-9]+[[:space:]]*&[[:space:]]*[0-9]+/ {
  gsub(/^[[:space:]]*-[[:space:]]*/, "", $0)
  gsub(/[[:space:]]*&[[:space:]]*/, " ", $0)
  print $0
}' copilot-instructions.md)

while read -r high low; do
  [[ -z "${high:-}" ]] && continue

  high_title=$(gh issue view "$high" --repo "$repo" --json title --jq '.title' 2>/dev/null || true)
  low_title=$(gh issue view "$low" --repo "$repo" --json title --jq '.title' 2>/dev/null || true)
  high_state=$(gh issue view "$high" --repo "$repo" --json state --jq '.state' 2>/dev/null || true)

  if [[ -z "$high_title" || -z "$low_title" || -z "$high_state" ]]; then
    echo "$high,$low,skipped,lookup_failed" >> "$report"
    continue
  fi

  # Confirm duplication: both are story issues and either titles match or user-provided duplicate map applies.
  if [[ "$high_title" != \[Story\]* || "$low_title" != \[Story\]* ]]; then
    echo "$high,$low,skipped,not_story_issue" >> "$report"
    continue
  fi

  if [[ "$high_state" == "CLOSED" ]]; then
    echo "$high,$low,skipped,already_closed" >> "$report"
    continue
  fi

  comment="Closing as duplicate of #$low.\n\nDuplicate issue link: https://github.com/$repo/issues/$low"
  if ! gh issue comment "$high" --repo "$repo" --body "$comment" >/dev/null 2>&1; then
    echo "$high,$low,skipped,comment_failed" >> "$report"
    continue
  fi

  if gh issue close "$high" --repo "$repo" >/dev/null 2>&1; then
    echo "$high,$low,closed,confirmed_from_duplicate_map" >> "$report"
  else
    state_after=$(gh issue view "$high" --repo "$repo" --json state --jq '.state' 2>/dev/null || true)
    if [[ "$state_after" == "CLOSED" ]]; then
      echo "$high,$low,skipped,already_closed" >> "$report"
    else
      echo "$high,$low,skipped,close_failed" >> "$report"
    fi
  fi

done <<< "$pairs"

echo "REPORT_FILE=$report"
cat "$report"
