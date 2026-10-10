#!/usr/bin/env bash
# Weekly portfolio bot: collect Quang's hipages GitHub work for the past 7 days,
# have Claude turn it into public-safe highlights, render into index.html, push to main.
# Runs from launchd (see com.quangle.portfolio-weekly.plist). DRY_RUN=1 skips the push.
set -euo pipefail

GH_USER=quanglequocduy
ORG=hipagesgroup
REMOTE=${REMOTE:-https://github.com/quanglequocduy/portfolio.git}
BOT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORK="${WORK:-$HOME/.local/share/portfolio-bot}"
CLONE="$WORK/repo"
RAW="$WORK/raw.json"     # private: never committed
WEEK="$WORK/week.json"
SINCE=$(date -v-7d +%F)
GIT=(git -C "$CLONE" -c credential.helper= -c 'credential.helper=!gh auth git-credential')

mkdir -p "$WORK"
echo "[$(date)] collecting since $SINCE"

# Work in a dedicated clone so the bot never touches your working copy.
[ -d "$CLONE/.git" ] || git clone -q "$REMOTE" "$CLONE"
"${GIT[@]}" fetch -q origin main
"${GIT[@]}" reset -q --hard origin/main

trim='map({repo: .repository.name, title, body: ((.body // "")[:500])})'
merged=$(gh search prs --author="$GH_USER" --owner="$ORG" --merged-at=">=$SINCE" \
  --limit 100 --json repository,title,body --jq "$trim")
opened=$(gh search prs --author="$GH_USER" --owner="$ORG" --created=">=$SINCE" --state=open \
  --limit 50 --json repository,title,body --jq "$trim")
reviewed=$(gh search prs --reviewed-by="$GH_USER" --owner="$ORG" --updated=">=$SINCE" \
  --limit 100 --json repository,title,author \
  --jq "map(select(.author.login != \"$GH_USER\") | {repo: .repository.name, title})")
total=$(gh api -X GET search/issues -f q="author:$GH_USER is:pr is:merged org:$ORG" --jq .total_count)

jq -n --argjson m "$merged" --argjson o "$opened" --argjson r "$reviewed" \
  '{merged: $m, in_progress: $o, reviewed: $r}' > "$RAW"

n_merged=$(jq '.merged | length' "$RAW")
if [ "$n_merged" -eq 0 ] && [ "$(jq '.in_progress | length' "$RAW")" -eq 0 ]; then
  echo "no activity this week (leave/holiday?), nothing to publish"; exit 0
fi

summary=$(claude -p --model sonnet --tools "" --no-session-persistence < <(cat <<PROMPT
You write the weekly "Now shipping" update on Quang Le's PUBLIC portfolio website.
Below is raw, CONFIDENTIAL data about his GitHub work this week at his employer (hipages,
an Australian trades marketplace). Turn it into public-safe highlights a hiring manager
would find impressive, written in English, past tense, first person implied (no "I").

Hard rules (the page is on the open internet):
- No ticket keys (like ABC-123), PR numbers, repo URLs, or the GitHub org name.
- No customer/tradie names, account states, fraud/abuse/billing internals, prices,
  revenue, or anything that reveals unreleased strategy. Generalise instead
  ("hardened lead-claim rules" not the specific rule).
- Concrete technical substance is good: systems, scale, technologies, outcomes.
- Group related PRs into one bullet. 3 to 6 bullets, each under 160 characters.
- Headline: under 70 characters, the single biggest theme of the week.
- themes: 2 to 5 short tech/domain tags.

Reply with ONLY this JSON, nothing else:
{"headline": "...", "highlights": ["..."], "themes": ["..."]}

DATA:
$(cat "$RAW")
PROMPT
))

# Extract the JSON object even if the model wraps it in prose or fences.
echo "$summary" | python3 -c 'import sys,re,json; print(json.dumps(json.loads(re.search(r"\{.*\}", sys.stdin.read(), re.S).group())))' \
  | jq --arg w "$SINCE" --argjson m "$n_merged" --argjson t "$total" \
       --argjson rv "$(jq '.reviewed | length' "$RAW")" \
       --argjson rp "$(jq '[.merged[].repo] | unique | length' "$RAW")" \
       '. + {week_of: $w, merged: $m, reviewed: $rv, repos: $rp, total_merged: $t}' > "$WEEK"

python3 "$BOT_DIR/render.py" "$CLONE" "$WEEK"   # exits non-zero on suspected leak
cat "$WEEK"

if "${GIT[@]}" diff --quiet; then echo "no change"; exit 0; fi
"${GIT[@]}" add index.html updates.json
"${GIT[@]}" commit -q -m "chore(now): weekly update for week of $SINCE"
if [ "${DRY_RUN:-0}" = 1 ]; then echo "DRY_RUN: not pushing ($CLONE)"; exit 0; fi
"${GIT[@]}" push -q origin HEAD:main
echo "published"
