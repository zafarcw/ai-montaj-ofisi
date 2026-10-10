# engines/ — 03_Loyihalar dagi dvigatellarning moslashtirilgan NUSXALARI

Tayyorlandi: `_tayyorlash.py` bilan. ROOT = `/Users/zafarcw/Zafarcw Packs/Claude`. 03 dagi asl fayllar o'zgartirilmagan.

Yo'l almashtirishlari: `~/mnt/Claude/`, `/mnt/user-data/uploads/Claude/`, `/sessions/…/mnt/Claude/` → `ROOT/`;
`/mnt/user-data/uploads/<fayl>` → `ROOT/01_Kiruvchi/<fayl>`; `/home/claude/<x>` va `/mnt/user-data/outputs/` → `ROOT/05_Vaqtincha/_ish/…`
(montaj sessiyasi o'z nusxasida `_ish` ni `_job_<id>` ga almashtiradi yoki yo'llarni argument qilib beradi).

⚠ Kamilovs dvigateli skia-python + uharfbuzz talab qiladi (venv'da o'rnatilgan bo'lsa ishlaydi); eng2 (MYCOM) — skia'siz, bir xil sifat.
⚠ Chromium/three.js dvigatellari (Agromash, MePhone) Playwright + Chromium kerak — venv'da bo'lmasa, PIL/cv2 dvigatellaridan foydalan.

| Dvigatel | Manba | Nima uchun yaxshi |
|---|---|---|
| `kamilovs_allon4/` | 18 fayl ← 03_Loyihalar/2026-10-09_Kamilovs_All-on-4-6/kamilovs_allon4_skriptlar.tgz | Kamilovs (skia + uharfbuzz) kg/k2..k5 — eng toza Apple-style: glass headline, pill, notification, Find My, segmented control, booking flow, end card, ikonlar, kamera keyframe, zoom-kesim, tracking |
| `kamilovs_eeg/` | 16 fayl ← 03_Loyihalar/2026-10-09_Kamilovs_EEG-unutuvchanlik/kamilovs_eeg_skriptlar.tgz | Kamilovs EEG/unutuvchanlik varianti |
| `mycom_monoblok_eng2/` | 8 fayl ← 03_Loyihalar/2026-10-09_MYCOM_MYPRO-monoblok/mycom_monoblok_skriptlar.tgz | MYCOM eng2 (numpy + PIL + cv2, skia'siz): ekran almashtirish (gomografiya), SDF shakllar, glass, so'z blur-in, SVG ikonka rasterizatori, kamera freymlari, stock karta, end card morfi, render final|preview|stills |
| `mycom_servis_eng/` | 8 fayl ← 03_Loyihalar/2026-10-10_MYCOM_Kompyuter-xizmati/mycom1_skriptlar.tgz | MYCOM servis reels eng (core + s1/fs/r1/m1): yuz kuzatuvi + titrash kompensatsiyasi, yuzga qarab kartalar, to'liq ekran ketma-ketlik, CTA pill, Reels xavfsiz zona maketi |
| `yec_tizer/` | 21 fayl ← 03_Loyihalar/2026-10-09_YEC_Tizer/yec_tizer_skriptlar.tgz | YEC tizer (PIL + cv2): uzun epizoddan soundbite tizer, ASR + energiya kesim, beat-snap, sariq raqam kartalari, ism plashkasi, YouTube CTA |
| `mrbeast_uzsub/` | 22 fayl ← 03_Loyihalar/2026-10-10_Zafar_MrBeast-Ozbekiston/mrbeast_uzsub_skriptlar.tgz | Tarjima + subtitr: PIL pill cue PNG → ffmpeg overlay + alfa fade (render.py out.mp4 16 slow) |
| `guaress10/` | 12 fayl ← 03_Loyihalar/2026-10-06_Guaress_10-xato/guaress10_skriptlar.tgz | Guaress eng/gfx/media/build: rasm/video kartalar, Ken Burns, LUT grade (FACE/STOCK) |
| `tsp3/` | 15 fayl ← 03_Loyihalar/2026-10-06_TSP_Devor-shift/tsp3_skriptlar_v2.tgz | TSP (numpy eng.py + lib3d/prof3d): 3D profil modellari, glass panel, svg ikonlar |
| `smm24/` | 9 fayl ← 03_Loyihalar/2026-10-06_SMM24/smm24_skriptlar.tgz | SMM24 (50 fps): Telegram qidiruv UI hook, narx pufakchalari, Archivo VF |
| `ortolife/` | 18 fayl ← 03_Loyihalar/2026-10-10_OrtoLife_Protez-vaucher/ortolife_skriptlar.tgz | OrtoLife protez-vaucher |
| `tutti/` | 13 fayl ← 03_Loyihalar/2026-10-10_Tutti_Aiden/tutti_v2fix_skriptlar.tgz | Tutti (mebel) v2fix |
| `honor_v2/` | 10 fayl ← 03_Loyihalar/2026-10-09_SindorUz_HONOR-X9e-Pro/honor_v2_skriptlar.tgz | SindorUz HONOR X9e Pro v2 |
| `agromash/` | 23 fayl ← 03_Loyihalar/2026-10-01_Agromash/agromash_loyiha_skriptlar.tgz | Agromash (Chromium + three.js) HTML/CSS grafika, 3D, xarita, karusel |
| `mephone_scripts3/` | 9 fayl ← 03_Loyihalar/2026-10-02_MePhone/scripts3 | MePhone (Chromium + three.js) mg3.html/mg3.js/comp3.py, 3D, tracking |
| `theisle/` | 4 fayl ← 03_Loyihalar/2026-09-29_TheIsle | The Isle engine.py/build.py: Dynamic_style effektlari (tracking-typewriter, matte, rang-karta, flip) |
| `furniglass/` | 12 fayl ← 03_Loyihalar/2026-10-01_Furniglass | Furniglass motion.py (Card, run_card): brend chizig'idan kartalar, chiplar, telefon CTA |
| `lulu_savollar/` | 17 fayl ← 03_Loyihalar/2026-10-07_LuluGallery_Savollar | Lulu (PIL + cv2) motion.py + lulu3.py: serif kinetik matn, chat pufakchalar, iOS toggle/slayder |
| `geely_teaser/` | 12 fayl ← 03_Loyihalar/2026-10-07_Geely_3L-teaser | Geely teaser.py: beat to'rida avto-montaj |
| `mbcity_faststory/` | 84 fayl ← 03_Loyihalar/2026-10-06_MBcity_FastStory | MB FastStory story_v2.py: yarim-beat kesimlar, whip-pan, push, qora yakuniy ekran |
| `ezgumakon/` | 1106 fayl ← 03_Loyihalar/2026-10-03_EzguMakon | EzguMakon edl.py/mac_render.py: S-Log3 grade, BPM to'ri EDL, RIFE slow-mo |
| `_arxiv_05/` | 73 fayl ← 03_Loyihalar/_arxiv/05_Vaqtincha_skriptlar_2026-10-10.tgz | Tozalangan 05_Vaqtincha dagi barcha skriptlar (Tutti, OrtoLife, HONOR, Livardi 1x1, Lulu3-5, glass va b.) |

## Almashtirilgan yo'llar (fayl → qancha)

- `kamilovs_allon4/kg/engine/mix2.py`: 2× `/mnt/user-data/uploads/Claude/`
- `kamilovs_allon4/kg/engine/k2.py`: 4× `/home/claude/`
- `kamilovs_allon4/kg/engine/comp.py`: 2× `/home/claude/`
- `kamilovs_allon4/kg/engine/k3.py`: 3× `/home/claude/`
- `kamilovs_allon4/kg/engine/mix_k3.py`: 3× `/home/claude/`
- `kamilovs_allon4/kg/engine/mix_k2.py`: 3× `/home/claude/`
- `kamilovs_allon4/kg/engine/mix_k5.py`: 3× `/home/claude/`
- `kamilovs_allon4/kg/engine/mix_k4.py`: 3× `/home/claude/`
- `kamilovs_allon4/kg/engine/mix_kg.py`: 2× `/mnt/user-data/uploads/Claude/`, 2× `/home/claude/`
- `kamilovs_allon4/kg/engine/k4.py`: 3× `/home/claude/`
- `kamilovs_allon4/kg/engine/kg.py`: 4× `/home/claude/`
- `kamilovs_allon4/kg/engine/k5.py`: 3× `/home/claude/`
- `kamilovs_eeg/kg/engine/mix2.py`: 2× `/mnt/user-data/uploads/Claude/`
- `kamilovs_eeg/kg/engine/k2.py`: 4× `/home/claude/`
- `kamilovs_eeg/kg/engine/comp.py`: 2× `/home/claude/`
- `kamilovs_eeg/kg/engine/k3.py`: 3× `/home/claude/`
- `kamilovs_eeg/kg/engine/mix_k3.py`: 3× `/home/claude/`
- `kamilovs_eeg/kg/engine/mix_k2.py`: 3× `/home/claude/`
- `kamilovs_eeg/kg/engine/mix_k4.py`: 3× `/home/claude/`
- `kamilovs_eeg/kg/engine/mix_kg.py`: 2× `/mnt/user-data/uploads/Claude/`, 2× `/home/claude/`
- `kamilovs_eeg/kg/engine/k4.py`: 3× `/home/claude/`
- `kamilovs_eeg/kg/engine/kg.py`: 4× `/home/claude/`
- `mycom_monoblok_eng2/eng2/core.py`: 1× `/home/claude/`
- `mycom_monoblok_eng2/eng2/mix.py`: 1× `/home/claude/`
- `mycom_servis_eng/eng/s1.py`: 1× `/home/claude/`
- `mycom_servis_eng/eng/core.py`: 1× `/home/claude/`
- `mycom_servis_eng/eng/m1.py`: 2× `/home/claude/`
- `yec_tizer/scripts/final_edl.py`: 1× `/mnt/user-data/outputs/`, 1× `/home/claude/`
- `yec_tizer/scripts/render.py`: 1× `/mnt/user-data/uploads/Claude/`, 1× `/mnt/user-data/outputs/`, 3× `/home/claude/`
- `yec_tizer/scripts/bpm.py`: 1× `/mnt/user-data/uploads/Claude/`
- `yec_tizer/scripts/tl.py`: 1× `/home/claude/`
- `yec_tizer/scripts/gfx.py`: 1× `/home/claude/`
- `yec_tizer/scripts/overlays.py`: 1× `/mnt/user-data/outputs/`
- `yec_tizer/scripts/asr_all.txt`: 4× `/sessions/[A-Za-z0-9_-]+/mnt/Claude/`
- `yec_tizer/scripts/spine.py`: 1× `/mnt/user-data/uploads/Claude/`, 1× `/home/claude/`
- `yec_tizer/scripts/pw.py`: 1× `/home/claude/`
- `yec_tizer/scripts/env10.py`: 1× `/mnt/user-data/uploads/Claude/`
- `yec_tizer/scripts/mix.py`: 3× `/mnt/user-data/uploads/Claude/`, 1× `/mnt/user-data/outputs/`, 4× `/home/claude/`
- `mrbeast_uzsub/scripts/render.py`: 1× `/mnt/user-data/uploads/`, 3× `/home/claude/`
- `mrbeast_uzsub/scripts/cues.py`: 3× `/home/claude/`
- `mrbeast_uzsub/cues/meta.json`: 17× `/home/claude/`
- `guaress10/build.py`: 1× `/home/claude/`
- `guaress10/assemble.sh`: 1× `/home/claude/`
- `guaress10/render.py`: 1× `/home/claude/`
- `guaress10/gfx.py`: 1× `/home/claude/`
- `guaress10/eng.py`: 1× `/home/claude/`
- `guaress10/svgicon.py`: 1× `/home/claude/`
- `guaress10/mix.py`: 1× `/home/claude/`
- `tsp3/tsp3/build.py`: 3× `/home/claude/`
- `tsp3/tsp3/render.py`: 1× `/mnt/user-data/uploads/`, 2× `/home/claude/`
- `tsp3/tsp3/testf.py`: 1× `/mnt/user-data/uploads/`, 2× `/home/claude/`
- `tsp3/tsp3/render2.py`: 1× `/mnt/user-data/uploads/`, 3× `/home/claude/`
- `tsp3/tsp3/mix.py`: 1× `/mnt/user-data/uploads/`, 1× `/home/claude/`
- `tsp3/tsp3/lib/prof3d.py`: 1× `/home/claude/`
- `tsp3/tsp3/lib/svgicon.py`: 1× `/home/claude/`
- `smm24/eng/smm.py`: 1× `/mnt/user-data/uploads/`, 3× `/home/claude/`
- `smm24/eng/mix.py`: 1× `/mnt/user-data/uploads/Claude/`, 1× `/mnt/user-data/uploads/`, 6× `/home/claude/`
- `smm24/eng/mg.py`: 1× `/home/claude/`
- `ortolife/render.py`: 1× `/home/claude/`
- `ortolife/ui.py`: 2× `/home/claude/`
- `ortolife/tl.py`: 2× `/home/claude/`
- `ortolife/gfx.py`: 1× `/home/claude/`
- `ortolife/eng.py`: 1× `/home/claude/`
- `ortolife/mix.py`: 1× `/home/claude/`
- `tutti/render.py`: 1× `/home/claude/`
- `tutti/ui.py`: 1× `/home/claude/`
- `tutti/tl.py`: 1× `/mnt/user-data/uploads/`, 2× `/home/claude/`
- `tutti/gfx.py`: 1× `/home/claude/`
- `tutti/icons2.py`: 1× `/home/claude/`
- `tutti/mix.py`: 1× `/mnt/user-data/uploads/Claude/`, 1× `/home/claude/`
- `tutti/prep_stock.py`: 1× `/mnt/user-data/uploads/`
- `honor_v2/mix2.py`: 3× `/mnt/user-data/uploads/Claude/`, 1× `/home/claude/`
- `honor_v2/gfx2.py`: 2× `/home/claude/`
- `honor_v2/ui.py`: 2× `/home/claude/`
- `honor_v2/run_all.sh`: 1× `/home/claude/`
- `honor_v2/eng.py`: 1× `/home/claude/`
- `honor_v2/tl2.py`: 2× `/mnt/user-data/uploads/`
- `honor_v2/render2.py`: 2× `/home/claude/`
- `agromash/mg/compose.py`: 1× `/home/claude/`
- `agromash/audio/mix.py`: 1× `/home/claude/`
- `mephone_scripts3/mix3.py`: 1× `/mnt/user-data/uploads/`, 1× `/home/claude/`
- `mephone_scripts3/comp3.py`: 2× `/mnt/user-data/uploads/`
- `theisle/build.py`: 6× `/home/claude/`
- `theisle/engine.py`: 1× `/home/claude/`
- `theisle/mix.py`: 4× `/home/claude/`
- `furniglass/motion.py`: 5× `/home/claude/`
- `furniglass/render.sh`: 1× `/home/claude/`
- `furniglass/build_base.py`: 1× `/mnt/user-data/uploads/`, 1× `/home/claude/`
- `furniglass/mix.py`: 2× `/mnt/user-data/uploads/`, 1× `/home/claude/`
- `furniglass/v3_logolar/motion_logos.py`: 4× `/home/claude/`
- `furniglass/v3_logolar/mix_logos.py`: 2× `/mnt/user-data/uploads/`, 1× `/home/claude/`
- `lulu_savollar/mix3.py`: 1× `/home/claude/`
- `lulu_savollar/lulu3.py`: 4× `/home/claude/`
- `lulu_savollar/motion.py`: 5× `/home/claude/`
- `lulu_savollar/render.sh`: 1× `/home/claude/`
- `ezgumakon/mac_render.py`: 4× `~/mnt/Claude/`
- `_arxiv_05/_mrbeast/topk.py`: 1× `~/mnt/Claude/`
- `_arxiv_05/_livardi_1x1/shots.py`: 2× `~/mnt/Claude/`
- `_arxiv_05/_livardi_1x1/shots2.py`: 2× `~/mnt/Claude/`
- `_arxiv_05/_livardi_1x1/proxy.py`: 2× `~/mnt/Claude/`
- `_arxiv_05/_livardi_1x1/proxy2.py`: 2× `~/mnt/Claude/`
- `_arxiv_05/_glass_parts/x/project/gmix.py`: 1× `/mnt/user-data/uploads/Claude/`, 2× `/home/claude/`
- `_arxiv_05/_glass_parts/x/project/glib.py`: 1× `/home/claude/`
- `_arxiv_05/_glass_parts/x/project/gx.py`: 1× `/home/claude/`
- `_arxiv_05/_yec/asr_all.txt`: 4× `/sessions/[A-Za-z0-9_-]+/mnt/Claude/`
- `_arxiv_05/_yec/asr_3.txt`: 1× `/sessions/[A-Za-z0-9_-]+/mnt/Claude/`
- `_arxiv_05/_yec/asr_2.txt`: 1× `/sessions/[A-Za-z0-9_-]+/mnt/Claude/`
- `_arxiv_05/_yec/asr_0.txt`: 1× `/sessions/[A-Za-z0-9_-]+/mnt/Claude/`
- `_arxiv_05/_yec/asr_1.txt`: 1× `/sessions/[A-Za-z0-9_-]+/mnt/Claude/`
- `_arxiv_05/gr_v3/comp.py`: 2× `~/mnt/Claude/`
