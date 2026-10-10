#!/bin/bash
# Native macOS muhit tekshiruvi — natija shu papkadagi probe_natija.txt ga yoziladi
D="$(cd "$(dirname "$0")" && pwd)"
O="$D/probe_natija.txt"
{
echo "=== DATE ==="; date
echo "=== UNAME ==="; uname -a; sw_vers 2>/dev/null
echo "=== SHELL PATH ==="; echo "$PATH"
echo "=== LOGIN SHELL PATH ==="; /bin/zsh -lc 'echo $PATH' 2>/dev/null
for t in python3 ffmpeg ffprobe git claude node npm brew gh; do
  printf "%s: " "$t"; /bin/zsh -lc "which $t" 2>/dev/null || echo "YO'Q"
done
echo "=== python3 ==="; /bin/zsh -lc 'python3 --version' 2>&1
echo "=== python3 pkgs ==="; /bin/zsh -lc 'python3 -c "
import importlib
for m in [\"numpy\",\"cv2\",\"PIL\",\"onnxruntime\",\"fastapi\",\"uvicorn\",\"skia\",\"uharfbuzz\",\"venv\",\"pip\"]:
    try:
        mod=importlib.import_module(m); print(m, \"OK\", getattr(mod,\"__version__\",\"\"))
    except Exception as e: print(m, \"YOQ\", type(e).__name__)
"' 2>&1
echo "=== ffmpeg ==="; /bin/zsh -lc 'ffmpeg -version 2>&1 | head -1'
echo "=== claude ==="; /bin/zsh -lc 'claude --version 2>&1 | head -2'
/bin/zsh -lc 'claude auth status 2>&1 | head -5'
echo "=== claude candidates ==="; ls -la ~/.claude/local/claude ~/.local/bin/claude /usr/local/bin/claude /opt/homebrew/bin/claude 2>/dev/null
ls -la /Applications/Claude.app/Contents/Resources 2>/dev/null | head -30
find /Applications/Claude.app -maxdepth 6 -iname "*claude-code*" -o -maxdepth 6 -name "claude" -type f 2>/dev/null | head
echo "=== node ==="; /bin/zsh -lc 'node --version' 2>&1
echo "=== brew ==="; /bin/zsh -lc 'brew --version 2>&1 | head -1'
echo "=== xcode CLT ==="; xcode-select -p 2>&1
echo "=== arch ==="; arch; sysctl -n machdep.cpu.brand_string 2>/dev/null; sysctl -n hw.memsize 2>/dev/null
echo "=== exec bit test ==="; ls -la "$D"
echo "=== DONE ==="
} > "$O" 2>&1
echo "Natija: $O"
