#!/usr/bin/env bash
set -u

cd /Users/musterion/Desktop/code/golf-handicap-system
repo="socx/golf-handicap-system"
out="/tmp/duplicate_issue_results.csv"

echo "high,low,action,reason" > "$out"

awk '/^[[:space:]]*-[[:space:]]*[0-9]+[[:space:]]*&[[:space:]]*[0-9]+/ {
  gsub(/^[[:space:]]*-[[:space:]]*/, "", $0)
  gsub(/[[:space:]]*&[[:space:]]*/, " ", $0)
  print $0
}' copilot-instructions.md | while read -r high low; do
  [ -z "${high:-}" ] && continue

  high_json=$(gh issue view "$high" --repo "$repo" --json number,title,body,state,url 2>/dev/null || true)
  low_json=$(gh issue view "$low" --repo "$repo" --json number,title,body,state,url 2>/dev/null || true)

  if [ -z "$high_json" ] || [ -z "$low_json" ]; then
    echo "$high,$low,skipped,lookup_failed" >> "$out"
    continue
  fi

  high_state=$(printf '%s' "$high_json" | jq -r '.state')
  high_title=$(printf '%s' "$high_json" | jq -r '.title')
  low_title=$(printf '%s' "$low_json" | jq -r '.title')
  high_body=$(printf '%s' "$high_json" | jq -r '.body // ""')
  low_body=$(printf '%s' "$low_json" | jq -r '.body // ""')

  high_key=$(printf '%s' "$high_body" | sed -n 's/.*STORY_SYNC_KEY:\([^ ]*\).*/\1/p' | head -n1)
  low_key=$(printf '%s' "$low_body" | sed -n 's/.*STORY_SYNC_KEY:\([^ ]*\).*/\1/p' | head -n1)

  reason=""
  if [ -n "$high_key" ] && [ -n "$low_key" ] && [ "$high_key" = "$low_key" ]; then
    reason="matching_story_sync_key"
  elif [ "$high_title" = "$low_title" ]; then
    reason="matching_title"
  else
    echo "$high,$low,skipped,not_confirmed_duplicate" >> "$out"
    continue
  fi

  if [ "$high_state" = "CLOSED" ]; then
    echo "$high,$low,skipped,already_closed" >> "$out"
    continue
  fi

  comment="Closing as duplicate of #$low.

Duplicate issue link: https://github.com/$repo/issues/$low"
  if ! gh issue comment "$high" --repo "$repo" --body "$comment" >/dev/null 2>&1; then
    echo "$high,$low,skipped,comment_failed" >> "$out"
    continue
  fi

  if gh issue close "$high" --repo "$repo" >/dev/null 2>&1; then
    echo "$high,$low,closed,$reason" >> "$out"
  else
    # Re-check state in case close failed because it was already closed concurrently.
    state_after=$(gh issue view "$high" --repo "$repo" --json state --jq '.state' 2>/dev/null || echo "UNKNOWN")
    if [ "$state_after" = "CLOSED" ]; then
      echo "$high,$low,skipped,already_closed" >> "$out"
    else
      echo "$high,$low,skipped,close_failed" >> "$out"
    fi
  fi
done

echo "RESULT_FILE=$out"
cat "$out"
