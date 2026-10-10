#!/bin/bash
# AI Montaj Ofisi — ishga tushirish (Finder'da ikki marta bosiladi)
# 1) ffmpeg/ffprobe (statik arm64 build) → bin/      2) uv + Python 3.12 → .venv      3) server → http://127.0.0.1:8787
# Bayroqlar: --lan (Wi-Fi'dan ham), --no-open, --port N, --reinstall (venv'ni qayta qurish)
set -u
SITE="$(cd "$(dirname "$0")" && pwd)"
cd "$SITE"
export PATH="$SITE/bin:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
LOG="$SITE/_log"; mkdir -p "$LOG"
PY_VER="3.12"
FF_BASE="https://ffmpeg.martin-riedl.de/redirect/latest/macos/arm64/release"

say() { printf "\033[1;34m▶\033[0m %s\n" "$*"; }
ok()  { printf "\033[1;32m✓\033[0m %s\n" "$*"; }
warn(){ printf "\033[1;33m!\033[0m %s\n" "$*"; }
die() { printf "\033[1;31m✕\033[0m %s\n" "$*"; echo; read -r -p "Enter bosing…" _; exit 1; }

REINSTALL=0; ARGS=()
for a in "$@"; do case "$a" in --reinstall) REINSTALL=1;; *) ARGS+=("$a");; esac; done

echo "AI Montaj Ofisi — $SITE"
echo "macOS $(sw_vers -productVersion 2>/dev/null) · $(uname -m)"

# ---------- 1. ffmpeg ----------
mkdir -p bin
if ! bin/ffmpeg -version >/dev/null 2>&1 || ! bin/ffprobe -version >/dev/null 2>&1; then
  if command -v ffmpeg >/dev/null 2>&1 && command -v ffprobe >/dev/null 2>&1 && [ "$(command -v ffmpeg)" != "$SITE/bin/ffmpeg" ]; then
    ok "ffmpeg tizimda bor: $(command -v ffmpeg)"
  else
    say "ffmpeg/ffprobe yuklanmoqda (statik arm64 build, ffmpeg.martin-riedl.de)…"
    for t in ffmpeg ffprobe; do
      curl -L --fail --progress-bar -o "bin/$t.zip" "$FF_BASE/$t.zip" || die "$t yuklanmadi (internet?)"
      (cd bin && unzip -oq "$t.zip" && rm -f "$t.zip") || die "$t ochilmadi"
      chmod +x "bin/$t"; xattr -d com.apple.quarantine "bin/$t" 2>/dev/null || true
    done
    bin/ffmpeg -version >/dev/null 2>&1 || die "bin/ffmpeg ishlamadi"
    ok "ffmpeg: $(bin/ffmpeg -version | head -1 | cut -d' ' -f1-3)"
  fi
else
  ok "ffmpeg: $(bin/ffmpeg -version | head -1 | cut -d' ' -f1-3)"
fi

# ---------- 2. uv + Python ----------
if ! command -v uv >/dev/null 2>&1; then
  say "uv o'rnatilmoqda (~/.local/bin, sudo'siz)…"
  curl -LsSf https://astral.sh/uv/install.sh | sh >"$LOG/uv_install.log" 2>&1 || warn "uv o'rnatilmadi — tizim python3 bilan davom etamiz"
fi
if [ "$REINSTALL" = 1 ] && [ -d .venv ]; then say "venv qayta qurilmoqda…"; rm -rf .venv; fi
if command -v uv >/dev/null 2>&1; then
  if [ ! -x .venv/bin/python ]; then
    say "Python $PY_VER (uv) → .venv…"
    uv python install "$PY_VER" >"$LOG/uv_python.log" 2>&1 || warn "uv python install: $LOG/uv_python.log"
    uv venv .venv --python "$PY_VER" >"$LOG/uv_venv.log" 2>&1 || die "venv yaratilmadi ($LOG/uv_venv.log)"
  fi
  if [ ! -f .venv/.paketlar_ok ] || [ requirements.txt -nt .venv/.paketlar_ok ]; then
    say "Paketlar o'rnatilmoqda (numpy, opencv, pillow, onnxruntime, skia, uharfbuzz…) — 1–3 daqiqa…"
    if uv pip install --python .venv/bin/python -r requirements.txt >"$LOG/pip.log" 2>&1; then
      touch .venv/.paketlar_ok; ok "paketlar tayyor"
    else
      warn "ba'zi paketlar o'rnatilmadi — $LOG/pip.log (server baribir ishlaydi; montajda kerak bo'lsa o'rnating)"
      uv pip install --python .venv/bin/python numpy pillow opencv-python-headless onnxruntime >>"$LOG/pip.log" 2>&1 && touch .venv/.paketlar_ok
    fi
  fi
else
  if [ ! -x .venv/bin/python ]; then
    say "Tizim python3 ($(python3 --version 2>&1)) bilan venv…"
    python3 -m venv .venv || die "venv yaratilmadi"
    .venv/bin/python -m pip install -q --upgrade pip >"$LOG/pip.log" 2>&1
    .venv/bin/python -m pip install -r requirements.txt >>"$LOG/pip.log" 2>&1 && touch .venv/.paketlar_ok || warn "paketlar: $LOG/pip.log"
  fi
fi
PY=".venv/bin/python"; [ -x "$PY" ] || PY="python3"
ok "python: $($PY --version 2>&1) ($PY)"

# ---------- 3. Claude Code ----------
CLAUDE_BIN="$(command -v claude 2>/dev/null || true)"
[ -z "$CLAUDE_BIN" ] && [ -x "$HOME/.local/bin/claude" ] && CLAUDE_BIN="$HOME/.local/bin/claude"
if [ -z "$CLAUDE_BIN" ]; then
  warn "Claude Code CLI topilmadi. O'rnatish: curl -fsSL https://claude.ai/install.sh | bash  (keyin: claude → login)"
else
  if "$CLAUDE_BIN" auth status 2>/dev/null | grep -q '"loggedIn": true'; then
    ok "claude: $("$CLAUDE_BIN" --version 2>/dev/null | head -1) · login ✓"
  else
    warn "claude login qilinmagan — yangi Terminal oynasida \`claude\` ni ishga tushirib login qiling (sayt ishlayveradi)."
  fi
fi

# ---------- 4. Server ----------
echo
say "Server: http://127.0.0.1:8787  (to'xtatish: Ctrl+C yoki shu oynani yoping)"
exec "$PY" server/app.py ${ARGS[@]+"${ARGS[@]}"}
