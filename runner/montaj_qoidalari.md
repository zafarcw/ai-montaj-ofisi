# MONTAJ SESSIYASI QOIDALARI (AI Montaj Ofisi)

Sen Zafarning (video montajchi, Toshkent) Mac'ida headless Claude Code sessiyasisan. Ish `AI Montaj Ofisi` sayti orqali
berildi; cwd = `/Users/zafarcw/Zafarcw Packs/Claude` (ROOT). Sayt kodi: `ROOT/07_AI_Ofis_Sayt/` (SITE). Tilim: o'zbekcha (lotin).

## 0. Avval o'qi
- `00_Qoidalar/CLAUDE_XOTIRA.md` — butun bilim bazasi (papka tuzilmasi, oltin qoidalar, pipeline, dvigatellar, mijozlar, referenslar).
  Undagi "Mac VM 180 s", "konteynerda internet yo'q", `~/mnt/Claude/...` kabi gaplar eski bulut sessiyalariga tegishli — sen native macOS'dasan,
  cheklovlar yo'q, lekin yo'llar `ROOT/...` (yoki `$CLAUDE_ROOT`).
- Mijoz avval ishlangan bo'lsa — uning kartasi (5-bo'lim) va loyiha papkasidagi `*-uslubi.md` / `README` (faqat o'qish).

## 1. Kod va fayllar qayerda
- Shu ish uchun yoziladigan/moslashtiriladigan BARCHA skriptlar faqat `SITE/jobs/<id>/kod/` ichida.
- Dvigatel kerak bo'lsa — `SITE/engines/<nom>/` dagi nusxadan foydalan yoki nusxani o'z `kod/` papkangga ol (`SITE/engines/README.md`).
- ASR: `SITE/engine/asr_wave.py in.wav cut1,cut2 out.json` (model `02_Assets/ASR/` dan, `CLAUDE_ROOT` orqali). 16 kHz mono wav, 15–20 s bo'laklar.
- Og'ir oraliq media (wav, kadrlar, render bo'laklari — kod emas): `05_Vaqtincha/_job_<id>/`. Tugagach shu yerda qoladi (o'chirish Zafar qarori).
- `rm` taqiqlangan. Vaqtinchalik faylni o'chirish kerak bo'lsa: `python3 SITE/runner/tozalash.py <id> <yo'l>` (faqat `_job_<id>` va `jobs/<id>` ichida ishlaydi).
- **`03_Loyihalar` ga HECH NARSA yozilmaydi.** CLAUDE_XOTIRA'da "skriptlar tgz + README loyiha papkasiga (03)" deyilgan — sayt orqali ishlarda
  bu o'rniga: `SITE/jobs/<id>/skriptlar.tgz` (kod/ papkasi) va `SITE/jobs/<id>/README.md` (+ uslub bo'limi).
- `00_Qoidalar`, `01_Kiruvchi`, `02_Assets`, `03_Loyihalar`, `06_Referenslar` — faqat o'qish. `01_Kiruvchi` dagi asl fayllarga tegma.
- `SITE/server`, `SITE/web`, `SITE/runner`, `SITE/engine(s)`, `SITE/progress.py`, `SITE/config.json` — tegma.

## 2. Yakuniy video
- `04_Tayyor_videolar/YYYY-MM-DD_Mijoz_Mavzu_vN.mp4`. Mavjud faylni HECH QACHON ustidan yozma — versiyani oshir (ls bilan tekshir).
- 04 ga faqat video (mp3/srt/zip/png yo'q). Variantlar: `_v1-hookA`, `_UZ`/`_EN`, `_16x9`/`_9x16`, `_4K`.

## 3. Eksport va miks (CLAUDE_XOTIRA 2-bo'lim)
- Standart 1080×1920, 59.94 fps (manba 29.97 → har kadr 2 marta; grafika haqiqiy 60 fps); mijoz istisnolari kartada.
- x264 `slow` CRF 11, High, bt709 (tv range) teglari, AAC 320k, `+faststart`. Oraliq fayllar lossless.
- Musiqa gapda ovozdan median 18–20 dB past (min ~11), pauzada −15…−10, end card −11…−9.5; duck attack 0.12 / release 0.8 / hold 0.4 s;
  EQ: HPF 60–70 Hz, 1.2–3.4 kHz −2…−4 dB. SFX mahalliy ovozdan ≥13–15 dB past. Limiter −1 dBTP; yakuniy ≈ −14…−18 LUFS.
- Asl ovozga tegilmaydi (faqat butun miks birga). Musiqa darajasini o'rnatgach ALBATTA o'lchash (`ebur128`).
- **Mux saboqi:** raw `.h264` orqali o'ramaslik (pts=dts, kadr yo'qoladi). Encoder'ga `-r 60000/1001` (kasr) berib, mp4 ga to'g'ridan-to'g'ri
  `-c:v copy` bilan mux. Tekshiruv: `ffprobe -show_entries packet=pts_time,dts_time` (pts≠dts) + `-count_frames` = kutilgan kadr soni.
- ffmpeg'da bitta kirishni filter_complex'da 8+ marta trim qilish → OOM; Python pipe (rawvideo RGBA → `overlay=format=yuv420`).
- 4K manba → punch-in (1.5x) ikkinchi kadr; 4K 16:9 → 9:16: 1216×2160 crop.

## 4. Matn, motion, taqiqlar
- Grafika **aytilgan gapga** qarab (ASR); noaniq raqam/so'z ekranga chiqmaydi (top-k bilan tiklash, bo'lmasa umumiy ifoda).
- oʻ / gʻ → U+02BB (Inter'da bor); tutuq belgisi ’. Shrift: Inter Display (`SITE/web/fonts/`).
- Motion faqat kalit so'zlarga; blur-in 0.6–0.8 s; glass kartalar; easeOutExpo/Quint; so'z ASR vaqtidan ~0.06 s oldin.
- Yuzni HECH QACHON yopmaslik (yuz qutisi har kadrda); Reels xavfsiz zona y 285–1245, yon 6 %, o'ng ikonka ustuniga tegmaslik.
- Spiker telefondan o'qiyotgan kadr ko'rinmasin; mijoz outrosiga tegilmaydi; watermark yo'q; referenslardan faqat uslub; real brend logosi ko'chirilmaydi;
  sharh faqat haqiqiy bo'lsa.
- Musiqa: internet yo'q — `02_Assets/Musiqa/` dan, tijoriy mijozga faqat litsenziyasi aniq treklar (Mixkit, Kevin MacLeod CC BY — kredit README'ga, FreePD, Artlist).

## 5. Progress protokoli (majburiy)
- Har qadamda: `python3 SITE/progress.py --job <id> --agent <rol> --state <working|done|error> --text "..." [--pct] [--metric k=v] [--handoff rol] [--image yo'l] [--type ...]`.
- Rollar: rejissyor (talab, reja, QC), ovozchi (ffprobe, ASR, musiqa, miks), montajchi (scene-detect, kesimlar, EDL), motion (grafika), rangchi (grade, render).
- EDL tayyor → `--type edl --edl edl.json`; render → `ffmpeg -progress pipe:1 -nostats | progress.py --ffmpeg-progress --total-frames N`;
  qarorlar → `--type decision`; tugagach → `--type final --file <04 dagi mp4> --metric davomiylik=.. lufs=.. kadrlar=.. hajm_mb=..`.
- Sessiya savol berib kuta olmaydi: noaniq joyda eng o'rinli qarorni qabul qil va `--type decision` bilan yoz.
- Final hodisasiz tugagan ish "xato" deb belgilanadi.

## 6. Ish tartibi (qisqa)
1. Rejissyor: talab + mijoz kartasi → reja (vaqt | kadr | motion jadvali) → `--metric sahnalar=N`.
2. Ovozchi: ffprobe, audio ajratish (16 kHz mono), ASR bo'laklab → so'z vaqtlari; musiqa tanlash (BPM/drop); `--metric sozlar davomiylik bpm`.
3. Montajchi: scene-detect (0.08–0.3), kesimlar, beat to'ri → `edl.json` → `--type edl`.
4. Motion: kalit so'zlarga grafika (dvigatel nusxasi), stills bilan tekshirish (`--image`).
5. Rangchi: grade (LUT/S-curve), render (`--ffmpeg-progress`), miks, mux.
6. Rejissyor QC: stills, pts≠dts, kadr soni, LUFS → `--type final`. README + skriptlar.tgz.
