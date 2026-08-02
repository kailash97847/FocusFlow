#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# FocusFlow — one-command GitHub release.
#
#   GITHUB_TOKEN=<your-token> ./scripts/push-to-github.sh
#
# Creates the repository via the GitHub API (if missing), commits under your
# GitHub identity, pushes `main`, then verifies EVERY local file exists on the
# remote by comparing git blob SHAs (cryptographic per-file verification).
#
# The token is used only in-memory for API/push calls — it is never written
# into the repository or the git remote URL. Recommended: a classic PAT with
# the "repo" scope (github.com/settings/tokens/new).
#
# Env overrides: REPO=FocusFlow  VISIBILITY=public|private  BRANCH=main
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

: "${GITHUB_TOKEN:?Set GITHUB_TOKEN to a personal access token with repo scope.}"
REPO="${REPO:-FocusFlow}"
VISIBILITY="${VISIBILITY:-public}"
BRANCH="${BRANCH:-main}"
API="https://api.github.com"
AUTH=(-H "Authorization: Bearer ${GITHUB_TOKEN}" -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28")
DESC="Deep work, distilled. Free, private, offline Pomodoro PWA with task-linked timers, streak analytics and ambient sound. Zero dependencies."

cd "$(dirname "$0")/.."
echo "▶ FocusFlow → GitHub release"

# 1. Who am I?
USER_JSON=$(curl -fsS "${AUTH[@]}" "$API/user")
LOGIN=$(USER_JSON="$USER_JSON" node -e 'const u=JSON.parse(process.env.USER_JSON);console.log(u.login)')
GH_NAME=$(USER_JSON="$USER_JSON" node -e 'const u=JSON.parse(process.env.USER_JSON);console.log(u.name||u.login)')
GH_ID=$(USER_JSON="$USER_JSON" node -e 'const u=JSON.parse(process.env.USER_JSON);console.log(u.id)')
echo "✓ authenticated as ${LOGIN}"

# 2. Create the repository (422 = already exists → reuse).
PRIVATE_FLAG=false; [ "$VISIBILITY" = "private" ] && PRIVATE_FLAG=true
STATUS=$(curl -s -o /tmp/focusflow_repo.json -w "%{http_code}" -X POST "${AUTH[@]}" \
  "$API/user/repos" \
  -d "{\"name\":\"${REPO}\",\"description\":\"${DESC}\",\"private\":${PRIVATE_FLAG},\"auto_init\":false,\"has_wiki\":false,\"has_projects\":false,\"homepage\":\"\"}")
case "$STATUS" in
  201) echo "✓ created repository ${LOGIN}/${REPO} (${VISIBILITY})" ;;
  422) echo "✓ repository ${LOGIN}/${REPO} already exists — pushing to it" ;;
  *)   echo "✗ repo creation failed (HTTP ${STATUS}):"; cat /tmp/focusflow_repo.json; exit 1 ;;
esac

# 3. Commit under your GitHub identity (amend the prepared initial commit).
git config user.name "${GH_NAME}"
git config user.email "${GH_ID}+${LOGIN}@users.noreply.github.com"
if git rev-parse -q --verify HEAD >/dev/null; then
  git commit --amend --reset-author --no-edit -q
else
  git add -A
  git commit -q -m "FocusFlow v1.0.0 — production-ready local-first Pomodoro PWA

- Zero-dependency ES modules; clean core/services/ui architecture
- Throttle-proof timestamp-based timer engine (45/45 unit tests)
- Tasks, streak analytics, WebAudio chime + brown noise
- PWA: service worker, maskable icons, installable & offline
- Landing page, Docker/nginx release, CI, full docs + project report"
fi

# 4. Push (token used only on the command line, never persisted in config).
git remote remove origin 2>/dev/null || true
echo "▶ pushing ${BRANCH}…"
git push --quiet "https://x-access-token:${GITHUB_TOKEN}@github.com/${LOGIN}/${REPO}.git" "${BRANCH}"
git remote add origin "https://github.com/${LOGIN}/${REPO}.git"
echo "✓ pushed"

# 5. Verify EVERY file: compare local blob SHAs against the remote tree.
echo "▶ verifying every file on GitHub…"
TREE_JSON=$(curl -fsS "${AUTH[@]}" "$API/repos/${LOGIN}/${REPO}/git/trees/${BRANCH}?recursive=1")
MISSING=$(LOCAL_TREE="$(git ls-tree -r HEAD)" REMOTE_TREE="$TREE_JSON" node -e '
const want = new Map();
for (const line of process.env.LOCAL_TREE.split("\n").filter(Boolean)) {
  const m = line.match(/^\d+ blob ([0-9a-f]{40})\t(.+)$/);
  if (m) want.set(m[2], m[1]);
}
const got = new Map(JSON.parse(process.env.REMOTE_TREE).tree
  .filter((e) => e.type === "blob").map((e) => [e.path, e.sha]));
const missing = []; const mismatch = [];
for (const [path, sha] of want) {
  if (!got.has(path)) missing.push(path);
  else if (got.get(path) !== sha) mismatch.push(path);
}
console.log(JSON.stringify({ total: want.size, remote: got.size, missing, mismatch }));
')
VERIFY=$(MISSING="$MISSING" node -e '
const r = JSON.parse(process.env.MISSING);
if (r.missing.length || r.mismatch.length) {
  console.error(`✗ missing: ${r.missing.join(", ") || "none"}\n✗ content mismatch: ${r.mismatch.join(", ") || "none"}`);
  process.exit(1);
}
console.log(`✓ verified ${r.total}/${r.total} files on GitHub (SHA-identical)`);
')
echo "$VERIFY"

echo ""
echo "🎉 Done: https://github.com/${LOGIN}/${REPO}"
