#!/bin/bash
D="$(cd "$(dirname "$0")" && pwd)"
O="$D/probe2_natija.txt"
export PATH="$HOME/.local/bin:$PATH"
{
echo "=== claude version ==="; claude --version 2>&1
echo "=== claude auth ==="; claude auth status 2>&1 | head -20
echo "=== claude help ==="; claude --help 2>&1
echo "=== claude dir ==="; ls -la ~/.claude 2>/dev/null | head -20
echo "=== settings keys ==="; python3 -c "import json;d=json.load(open('$HOME/.claude/settings.json'));print(list(d.keys()))" 2>&1
echo "=== net ==="; curl -sI -m 10 https://pypi.org/simple/ 2>&1 | head -1; curl -sI -m 10 https://ffmpeg.martin-riedl.de/ 2>&1 | head -1; curl -sI -m 10 https://github.com 2>&1 | head -1
echo "=== pip index ==="; python3 -m pip index versions fastapi 2>&1 | head -2
echo "=== venv test ==="; python3 -m venv "$D/_venvtest" 2>&1 && echo venv-ok && "$D/_venvtest/bin/python" -c "import sys;print(sys.version)"
echo "=== rosetta ==="; /usr/bin/pgrep -q oahd && echo "rosetta bor" || echo "rosetta yo'q"
echo "=== Claude app binaries ==="; find /Applications/Claude.app/Contents -maxdepth 4 \( -name "ffmpeg" -o -name "claude" -o -name "node" \) 2>/dev/null | head
echo "=== DONE ==="
} > "$O" 2>&1
