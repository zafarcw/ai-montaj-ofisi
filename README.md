# AI Montaj Ofisi

Zafarning Mac'ida ishlaydigan lokal veb-ilova: `http://127.0.0.1:8787`. Yangi montaj ishi beriladi (video + talablar), "Boshlash"
bosilganda **haqiqiy** headless Claude Code sessiyasi ishga tushadi va `Zafarcw Packs/Claude` papkasidagi pipeline (ASR, motion
dvigatellari, miks va eksport qoidalari) bilan videoni montaj qiladi. Sahifa "ofis" ko'rinishida: 5 AI xodim (Rejissyor, Ovozchi,
Montajchi, Motion dizayner, Rangchi) — ularning holati, pufakchalari, raqamlari va progressi **faqat haqiqiy hodisalardan**
(`progress.py` + sessiyaning stream-json chiqishi) olinadi. Soxta progress yoki demo rejim yo'q.

```
Zafarcw Packs/Claude/                 ← ROOT (CLAUDE_XOTIRA.md bilim bazasi, assetlar, loyihalar)
└── 07_AI_Ofis_Sayt/                  ← SAYTNING BUTUN KODI (faqat shu papka)
    ├── start.command                 ← Finder'da 2 marta bosiladi: ffmpeg + uv/Python 3.12 + venv + server
    ├── server/app.py, store.py       ← HTTP server (Python stdlib), SSE, HTTP Range, bo'lakli yuklash, navbat
    ├── runner/runner.py              ← headless `claude -p … --output-format stream-json` sessiyasi, bekor qilish, --resume
    ├── runner/prompt.py              ← ish prompti / tuzatish prompti
    ├── runner/montaj_qoidalari.md    ← sessiya qoidalari (CLAUDE_XOTIRA'dan qisqa ko'chirma + sayt qoidalari)
    ├── runner/tozalash.py            ← xavfsiz o'chirish (faqat _job_<id> va jobs/<id> ichida)
    ├── progress.py                   ← progress protokoli (agent, holat, matn, pct, metrik, handoff, edl, render, final, decision)
    ├── web/                          ← sahifa (index.html, app.js, style.css, fonts/InterDisplay-*.ttf, icon.svg)
    ├── engine/                       ← ASR nusxasi (asr_wave.py, topk.py, asr_range.py) — model 02_Assets/ASR dan, CLAUDE_ROOT
    ├── engines/                      ← 03_Loyihalar dvigatellarining moslashtirilgan NUSXALARI (+ README.md, _tayyorlash.py)
    ├── jobs/<id>/                    ← har ish: job.json, events.jsonl, claude.jsonl, session_id, prompt.txt, kod/, README.md
    ├── bin/ffmpeg, bin/ffprobe       ← statik arm64 build (start.command yuklaydi)
    ├── .venv/                        ← Python 3.12 (uv): numpy, opencv, pillow, onnxruntime, scipy, skia-python, uharfbuzz
    ├── config.json                   ← sozlamalar (nom, rang, logo, model, effort, agentlar, claude yo'li)
    └── _tekshiruv/                   ← sinov skriptlari (progress_sinov.command, ui_test.py, mock_claude.py, probe*.command)
```

## Qanday ishga tushiriladi
1. Finder: `07_AI_Ofis_Sayt/start.command` → ikki marta bosing. Birinchi marta ffmpeg (≈130 MB), uv, Python 3.12 va paketlar yuklanadi
   (1–3 daqiqa). Keyingi safar darhol ochiladi. Terminal oynasi ochiq turadi — yopsangiz server to'xtaydi.
2. Brauzer `http://127.0.0.1:8787` ni ochadi. Lokal Wi-Fi'dan telefonda ochish: `start.command --lan` (Terminal'da `?t=<token>` li manzil chiqadi).
3. **Claude Code login** (bir marta): Terminal'da `~/.local/bin/claude` → login. Saytdagi "Claude" ko'rsatkichi yashil bo'lishi kerak.
   ⚠ **Har bir montaj ishi sizning Claude limitingizdan sarflanadi** (model/effort qancha baland bo'lsa, shuncha ko'p).

## Yangi ish qanday beriladi
Chap paneldagi **"+ Yangi ish"**: mijoz, mavzu, manba (`01_Kiruvchi` dan tanlash / `04_Tayyor_videolar` dagi tayyor video / drag&drop —
4K fayllar 32 MB bo'laklab `01_Kiruvchi/<mijoz>_<sana>/` ga yuklanadi), talablar (so'zma-so'z), format (9:16 / 16:9 / 1:1 / 4:5), fps,
uslub referensi (`06_Referenslar` kategoriyalari), musiqa (avto / `02_Assets/Musiqa` dan / yo'q), davomiylik, model/effort.
"Darhol boshlash" belgilansa ish navbatga tushadi; bir vaqtda bitta ish ishlaydi, qolganlari navbatda turadi. "Bekor qilish" sessiyani to'xtatadi.

## Natija qayerga tushadi
- Yakuniy video: `04_Tayyor_videolar/YYYY-MM-DD_Mijoz_Mavzu_vN.mp4` (mavjud fayl ustidan yozilmaydi, versiya oshadi). Sahifada pleyer,
  "Finder'da ochish", versiyalar ro'yxati.
- **Tuzatish:** matn yozib "Tuzatish yuborish" → o'sha sessiya `--resume` bilan davom etadi → v2, v3…
- Skriptlar va README: `07_AI_Ofis_Sayt/jobs/<id>/` (`kod/`, `skriptlar.tgz`, `README.md`). `03_Loyihalar` ga hech narsa yozilmaydi.
- Og'ir oraliq media (wav, kadrlar, render bo'laklari): `05_Vaqtincha/_job_<id>/` — tugagach shu yerda qoladi (o'chirish sizning qaroringiz).
- Sessiya jurnali: `jobs/<id>/claude.jsonl` (xom stream-json), `events.jsonl` (barcha progress hodisalari), `claude.stderr.log`.

## Model va effort
Sozlamalar (⚙) → standart model/effort (`opus` / `high`). Har ishda alohida tanlash mumkin (`fable` / `xhigh` ham). Agent nomlari, ranglari,
sayt nomi, aksent rangi va logo (`web/logo.png` yoki URL) ham sozlamalarda.

## Sessiya qanday ishga tushadi (runner)
```
claude -p "<ish prompti>" --output-format stream-json --verbose --session-id <uuid> --name montaj-<id> \
  --append-system-prompt "<runner/montaj_qoidalari.md>" --model <model> --effort <effort> \
  --permission-mode acceptEdits --permission-prompts none --allowedTools … --disallowedTools …
```
cwd = ROOT. `--permission-prompts none` — ruxsat so'rab osilib qolmaydi: ruxsat ro'yxatida bo'lmagan buyruq avtomatik rad etiladi.
Allow: Read/Glob/Grep/Edit/Write + `Bash(ffmpeg|ffprobe|python3|mkdir|ls|cp|mv|tar|cat|…)`. Deny: `rm`, `sudo`, `brew`, `pip`, `curl`, `wget`, `git`,
`open`, `osascript`, `chmod`, WebFetch/WebSearch, `Edit/Write(00_Qoidalar|01_Kiruvchi|02_Assets|03_Loyihalar|04_Tayyor_videolar|06_Referenslar/**)`,
sayt kodi papkalari. `bypassPermissions` ishlatilmaydi. Tuzatish: `claude -p "<tuzatish>" --resume <session_id> …`.
Sessiya muhiti: `PATH` boshida `.venv/bin` va `bin/` (ffmpeg), `CLAUDE_ROOT=<ROOT>`, `OFIS_SITE=<07_AI_Ofis_Sayt>`.

## Progress protokoli
```
python3 07_AI_Ofis_Sayt/progress.py --job <id> --agent <rejissyor|ovozchi|montajchi|motion|rangchi> --state <idle|working|done|error> \
  --text "..." [--pct N] [--metric kalit=qiymat ...] [--handoff <rol>] [--image <yo'l>] [--file <yo'l>] [--edl <edl.json>] \
  [--type step|edl|render|final|decision]
ffmpeg … -progress pipe:1 -nostats … | python3 07_AI_Ofis_Sayt/progress.py --job <id> --agent rangchi --ffmpeg-progress --total-frames N
```
→ `jobs/<id>/events.jsonl` → SSE `/api/jobs/<id>/stream` → sahifa. `--type edl` timeline'ni haqiqiy segmentlar bilan chizadi,
`--ffmpeg-progress` haqiqiy kadr/jami/fps ko'rsatadi, `--type final --file …` versiyani ro'yxatga qo'shadi (busiz ish "xato" deb belgilanadi).
Sessiyaning tool_use/text hodisalari (hozir qaysi buyruq ishlayapti) "Jurnal" paneliga, `--type decision` "Qarorlar"ga tushadi.

## Qayta ko'rish
Tugagan ishni tanlasangiz ekranda **"QAYTA KO'RISH"** yozuvi turadi; "▶ Qayta o'ynatish" yozib olingan haqiqiy hodisalarni tezlashtirib
qayta o'ynaydi (soxta ma'lumot emas).

## API (qisqa)
`GET /api/config` · `PUT /api/config` · `GET /api/status` · `GET /api/jobs` · `POST /api/jobs` · `GET /api/jobs/<id>` ·
`POST /api/jobs/<id>/start|cancel|fix|reveal` · `GET /api/jobs/<id>/events?after=N` · `GET /api/jobs/<id>/stream` (SSE) ·
`GET /api/file?path=<abs>` (HTTP Range, faqat ROOT ichida) · `GET /api/sources` · `GET /api/assets/music|refs|ready` ·
`POST /api/upload/init` → `PUT /api/upload/<id>?offset=N` → `POST /api/upload/<id>/done`.

## Nega FastAPI emas
Server Python stdlib'da (`http.server` + threads): tashqi paket yo'q — venv tayyor bo'lmasa ham ishlaydi, offline ishlaydi, va kodni
PyPI yopiq bo'lgan konteynerda to'liq sinab ko'rish mumkin bo'ldi. Yuk kichik (bitta foydalanuvchi, lokal). Kerak bo'lsa FastAPI'ga
ko'chirish oson — marshrutlar `server/app.py` da bir joyda.

## Nima qilinmaydi
- Internetga chiqarish, to'lov, ko'p foydalanuvchi — yo'q. Faqat `127.0.0.1` (yoki `--lan` + token).
- Soxta progress / demo rejim — yo'q. Agent faqat unga hodisa kelganda "ishlaydi".
- `00_Qoidalar`, `01_Kiruvchi`, `02_Assets`, `03_Loyihalar`, `06_Referenslar` ga yozish — yo'q (deny qoidalari + sessiya qoidalari).
  `02_Assets/ASR/asr_wave.py` va `topk.py` o'zgartirilmagan — `engine/` dagi nusxa ishlatiladi.
- `07_AI_Ofis_Sayt` va job papkalaridan tashqaridagi mavjud fayllarni o'chirish/o'zgartirish — yo'q.

## Sinov
- `_tekshiruv/progress_sinov.command` — progress.py ni qo'lda chaqirib sahifa jonli yangilanishini ko'rish (eng oxirgi ishga).
- `_tekshiruv/ui_test.py` — Playwright bilan avtomatik UI sinovi (ish → hodisalar → timeline → render → final → telefon kengligi).
- `_tekshiruv/mock_claude.py` — runner sinovi uchun soxta `claude` (faqat sinov; `config.json` → `claude_bin`).
- `_tekshiruv/debug_start.command` — fayl so'rovlari jurnali bilan ishga tushirish (`_log/server.log`).

## Muammolar
- "Claude — login yo'q": Terminal'da `~/.local/bin/claude` → login. "topilmadi": `curl -fsSL https://claude.ai/install.sh | bash`.
- Video sahifada yuklanmasa — tab fonda bo'lsa Chrome media yuklashni kechiktiradi; tabni oldinga chiqaring.
- Paketlar o'rnatilmasa: `_log/pip.log`; `start.command --reinstall` venv'ni qayta quradi.
- Chromium/three.js dvigatellari (Agromash, MePhone) uchun Playwright kerak: `requirements-optional.txt` (sizning ruxsatingiz bilan).
