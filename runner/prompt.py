"""Ish (job) uchun prompt matnlari."""
import os
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
ROOT = Path(os.environ.get("CLAUDE_ROOT") or SITE.parent)
RULES = SITE / "runner" / "montaj_qoidalari.md"

FORMAT_HINT = {
    "9:16": "1080×1920 (9:16, vertikal)",
    "16:9": "1920×1080 (16:9, gorizontal)",
    "1:1": "1080×1080 (1:1, kvadrat)",
    "4:5": "1080×1350 (4:5)",
}


def rules_text():
    return RULES.read_text(encoding="utf-8")


def _sources_block(job):
    lines = []
    for s in job.get("sources", []):
        p = Path(s)
        size = ""
        try:
            if p.is_file():
                size = f" ({p.stat().st_size / 1e6:.1f} MB)"
            elif p.is_dir():
                n = sum(1 for _ in p.iterdir())
                size = f" (papka, {n} ta element)"
        except Exception:
            pass
        lines.append(f"- {s}{size}")
    return "\n".join(lines) or "- (manba tanlanmagan)"


def build_job_prompt(job):
    jid = job["id"]
    jobdir = SITE / "jobs" / jid
    tmp = job.get("tmp_dir") or str(ROOT / "05_Vaqtincha" / f"_job_{jid}")
    fmt = FORMAT_HINT.get(job.get("format", "9:16"), job.get("format", "9:16"))
    music = job.get("music") or "avto"
    if music == "avto":
        music_txt = "avto — `02_Assets/Musiqa/` dan mavzuga mos, litsenziyasi aniq trek tanla (internet yo'q)"
    elif music in ("yoq", "yo'q", "none"):
        music_txt = "musiqa KERAK EMAS"
    else:
        music_txt = f"shu fayl: {music}"
    dur = job.get("duration")
    dur_txt = f"{dur} s atrofida" if dur else "manbaga va talabga qarab (reels uchun odatda 30–60 s)"
    ref = job.get("style_ref") or ""
    ref_txt = (f"`06_Referenslar/{ref}/` kategoriyasi (faqat uslub/texnika olinadi, footage/musiqa/logo emas)"
               if ref else "CLAUDE_XOTIRA'dagi asosiy uslub (Apple style, SMOOTH)")
    req = job.get("requirements") or "(qo'shimcha talab yo'q — oltin qoidalar bo'yicha)"

    return f"""# MONTAJ ISHI: {job.get('client')} — {job.get('topic')}

Ish ID: `{jid}`
Ish papkasi (kod, README, skriptlar): `{jobdir}`
Oraliq media (wav, kadrlar, render bo'laklari): `{tmp}`
Yakuniy video: `{ROOT}/04_Tayyor_videolar/` (nom: `YYYY-MM-DD_{job.get('client')}_{job.get('topic')}_vN.mp4`, mavjud faylni ustidan yozma)

## Manba fayllar (faqat o'qish)
{_sources_block(job)}

## Talablar
- Mijoz: **{job.get('client')}** — avval ishlangan bo'lsa `00_Qoidalar/CLAUDE_XOTIRA.md` dagi kartasi va loyiha papkasidagi uslub fayli bo'yicha.
- Mavzu: {job.get('topic')}
- Format: {fmt}, {job.get('fps')} fps
- Davomiylik: {dur_txt}
- Uslub referensi: {ref_txt}
- Musiqa: {music_txt}
- Mijoz talablari (so'zma-so'z):
{req}

## Ishni qanday bajarasan
1. Avval `00_Qoidalar/CLAUDE_XOTIRA.md` ni o'qi (Ish tartibi, oltin qoidalar, dvigatellar). Keyin manbani ffprobe bilan tahlil qil.
2. Har qadamda progress yoz (bu majburiy — sahifa faqat shu hodisalardan yangilanadi):
   `python3 "{SITE}/progress.py" --job {jid} --agent <rejissyor|ovozchi|montajchi|motion|rangchi> --state <working|done|error> --text "..." [--pct N] [--metric kalit=qiymat ...] [--handoff <rol>] [--image <yo'l>] [--type step|edl|render|final|decision]`
   - Reja tayyor bo'lganda: `--agent rejissyor --type step --metric sahnalar=N`
   - ASR tugagach: `--agent ovozchi --metric sozlar=N davomiylik=S`
   - EDL yozilganda: `--agent montajchi --type edl --edl <edl.json>` (segmentlar: `[{{"t0":..,"t1":..,"src":..,"label":..}}]`)
   - Musiqa/miks: `--agent ovozchi --metric bpm=.. nisbat_db=.. lufs=..`
   - Grafika: `--agent motion --metric elementlar=N`
   - Render: `ffmpeg ... -progress pipe:1 -nostats ... | python3 "{SITE}/progress.py" --job {jid} --agent rangchi --ffmpeg-progress --total-frames <N> --text "Yakuniy render"`
   - Agentdan agentga o'tishda `--handoff <keyingi rol>`; o'zing qabul qilgan qarorlarni `--type decision` bilan yoz.
   - Still/preview rasm bo'lsa `--image <png yo'li>` bilan yubor (sahifada ko'rinadi).
3. Dvigatellar: `{SITE}/engines/` dagi nusxalar (README'siga qarang) va `{SITE}/engine/asr_wave.py` (ASR). Shu ish uchun yoziladigan/moslashtiriladigan skriptlar faqat `{jobdir}/kod/` ichida. Python: `python3` (venv, numpy/cv2/PIL/onnxruntime bor).
4. Yakuniy tekshiruv (Rejissyor): stills, `ffprobe` (pts≠dts, kadr soni, davomiylik), LUFS (`ffmpeg -af ebur128`). Keyin:
   `python3 "{SITE}/progress.py" --job {jid} --agent rejissyor --state done --type final --file "<04 dagi yakuniy mp4>" --metric davomiylik=S lufs=-14.x kadrlar=N --text "v1 tayyor"`
5. Oxirida `{jobdir}/README.md` (nima qilindi, uslub, musiqa, qarorlar) va `{jobdir}/skriptlar.tgz` (kod/ papkasi) yoz.

Sen savol berib kuta olmaysan: noaniq joyda eng o'rinli qarorni qabul qil va `--type decision` bilan yoz. Tugagach qisqa hisobot yoz.
"""


def build_fix_prompt(job, text, version=None):
    jid = job["id"]
    jobdir = SITE / "jobs" / jid
    last = (job.get("versions") or [{}])[-1]
    nxt = (last.get("v") or 0) + 1
    return f"""# TUZATISH (v{nxt}) — {job.get('client')} — {job.get('topic')}

Zafarning tuzatish talabi (so'zma-so'z):
{text.strip() or '(bo\'sh)'}

Oldingi versiya: {last.get('path') or '(yo\'q)'}
Shu sessiyadagi kod va reja `{jobdir}/kod/` da — qayta ishlatib, faqat kerakli joyni o'zgartir. Mavjud 04 dagi faylni ustidan yozma —
yangi nom `_v{nxt}.mp4`. Har qadamda `python3 "{SITE}/progress.py" --job {jid} ...` chaqir (avvalgidek), oxirida
`--type final --file "<yangi mp4>"` hodisasi majburiy. Savol bermasdan eng o'rinli qarorni qabul qil (`--type decision`).
"""
