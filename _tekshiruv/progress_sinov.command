#!/bin/bash
# progress.py ni QO'LDA chaqirib sahifada jonli yangilanishni tekshirish (prompt 7.2). Eng oxirgi ish (jobs/*) ga hodisalar yuboradi.
SITE="$(cd "$(dirname "$0")/.." && pwd)"; cd "$SITE"
PY=".venv/bin/python"; [ -x "$PY" ] || PY=python3
J="$(ls -t jobs | grep -v '^\.' | head -1)"
[ -z "$J" ] && { echo "jobs/ da ish yo'q — avval saytda 'Yangi ish' yarating"; read -r -p "Enter…" _; exit 1; }
echo "Ish: $J"
P() { "$PY" progress.py --job "$J" "$@"; }
curl -s -X POST "http://127.0.0.1:8787/api/jobs/$J/event" -H 'Content-Type: application/json' -d '{"type":"status","status":"running","text":"progress.py qo'"'"'lda sinov (haqiqiy sessiya emas)"}' >/dev/null
P --agent rejissyor --state working --text "Talabni o'qiyapman, mijoz kartasini qidiryapman" --pct 15; sleep 2
P --agent rejissyor --state done --text "Reja tayyor: 5 sahna" --metric sahnalar=5 --handoff ovozchi --type decision; sleep 2
P --agent ovozchi --state working --text "ffprobe: 1080×1920, 29.97 fps, 38.4 s" --metric davomiylik=38.4 --pct 20; sleep 2
for i in 1 2 3 4; do P --agent ovozchi --state working --text "ASR bo'lak $i/4" --pct $((20+i*15)); sleep 1.5; done
P --agent ovozchi --state done --text "So'zlar tayyor" --metric sozlar=131 --metric bpm=109.8 --handoff montajchi; sleep 1.5
cat > "jobs/$J/edl_sinov.json" <<'J'
{"segments":[{"t0":0,"t1":3.1,"src":"manba.mp4","label":"hook"},{"t0":3.1,"t1":9.4,"src":"manba.mp4","kind":"gfx","label":"karta"},{"t0":9.4,"t1":14.0,"src":"stock.mp4","kind":"stock","label":"stock"},{"t0":14.0,"t1":21.5,"src":"manba.mp4","label":"natija"},{"t0":21.5,"t1":26.0,"src":"manba.mp4","kind":"gfx","label":"end card"}]}
J
P --agent montajchi --state done --text "EDL: 5 kesim, beat to'ri 109.8 BPM" --type edl --edl "jobs/$J/edl_sinov.json" --handoff motion; sleep 2
P --agent motion --state working --text "Glass kartalar: 3 ta kalit so'z" --metric elementlar=3 --pct 60 --handoff rangchi; sleep 2
printf 'frame=100\nfps=14.2\nout_time_us=1668333\nprogress=continue\nframe=400\nfps=14.0\nout_time_us=6673333\nprogress=continue\nframe=800\nfps=14.1\nout_time_us=13346666\nprogress=continue\nframe=1558\nfps=14.0\nout_time_us=26000000\nprogress=end\n' | \
  (while read -r l; do echo "$l"; case "$l" in progress=*) sleep 1.2;; esac; done) | "$PY" progress.py --job "$J" --agent rangchi --ffmpeg-progress --total-frames 1558 --interval 0 --text "Yakuniy render (sinov oqimi)"
P --agent rejissyor --state working --text "QC: pts≠dts ✓, 1558 kadr ✓, −14.6 LUFS ✓" --metric qc=OK; sleep 1.5
curl -s -X POST "http://127.0.0.1:8787/api/jobs/$J/event" -H 'Content-Type: application/json' -d '{"type":"status","status":"new","text":"Sinov tugadi — bu haqiqiy montaj emas edi; ish qayta boshlanishi mumkin"}' >/dev/null
echo "Tugadi."; read -r -p "Enter…" _
