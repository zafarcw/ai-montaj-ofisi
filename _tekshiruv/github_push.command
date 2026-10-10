#!/bin/bash
# GitHub'ga yuklash (native git). Repo: https://github.com/zafarcw/ai-montaj-ofisi
# Birinchi marta HTTPS parol so'ralsa — GitHub Personal Access Token kiriting (parol o'rniga).
set -u
SITE="$(cd "$(dirname "$0")/.." && pwd)"; cd "$SITE"
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
REMOTE="https://github.com/zafarcw/ai-montaj-ofisi.git"
echo "AI Montaj Ofisi → GitHub ($REMOTE)"
if [ ! -d .git ]; then
  git init -q -b main
fi
[ -z "$(git config user.name)" ] && git config --local user.name "zafarcw"
[ -z "$(git config user.email)" ] && git config --local user.email "abbamontaj@gmail.com"
git remote get-url origin >/dev/null 2>&1 || git remote add origin "$REMOTE"
git remote set-url origin "$REMOTE"
git add -A
if git diff --cached --quiet; then
  echo "O'zgarish yo'q — commit qilinmadi."
else
  MSG="${1:-AI Montaj Ofisi: lokal AI ofis sayti (server, runner, progress protokoli, web, engine nusxalari)}"
  git commit -q -m "$MSG" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_0149ByLB6aUqVvKAsWBzKX5y"
  echo "Commit: $(git log -1 --format='%h %s')"
fi
echo "Push…"
if git push -u origin main; then
  echo "✓ Yuklandi: https://github.com/zafarcw/ai-montaj-ofisi"
else
  echo "✕ Push bo'lmadi. GitHub token kerak bo'lsa: github.com → Settings → Developer settings → Personal access tokens (repo huquqi)."
fi
echo "$(date '+%F %T') push rc=$? $(git log -1 --format='%h' 2>/dev/null)" >> "$SITE/_log/github.log"
echo; read -r -p "Enter bosing…" _
