#!/usr/bin/env python3
"""03_Loyihalar dagi dvigatel skriptlarining NUSXALARINI engines/<nom>/ ga ochadi va eski yo'llarni moslashtiradi.

- 03 dagi asl tgz/fayllarga TEGILMAYDI (faqat o'qiladi).
- Eski bulut yo'llari (`~/mnt/Claude/…`, `/mnt/user-data/uploads/Claude/…`, `/sessions/…/mnt/Claude/…`) → ROOT/…
- Eski konteyner ish papkalari (`/home/claude/<x>/…`) → ROOT/05_Vaqtincha/_ish/<x>/… (montaj sessiyasi o'z _job_<id> papkasiga moslaydi)
- `/mnt/user-data/uploads/<fayl>` → ROOT/01_Kiruvchi/<fayl>; `/mnt/user-data/outputs/` → ROOT/05_Vaqtincha/_ish/out/
- Har bir almashtirish engines/README.md ga yoziladi.

    python3 07_AI_Ofis_Sayt/engines/_tayyorlash.py [--root "/Users/zafarcw/Zafarcw Packs/Claude"]
"""
import argparse
import os
import re
import shutil
import tarfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SITE = HERE.parent

# nom → (manba, turi, izoh)   manba 03_Loyihalar ga nisbatan
ENGINES = {
    "kamilovs_allon4": ("2026-10-09_Kamilovs_All-on-4-6/kamilovs_allon4_skriptlar.tgz", "tgz",
                        "Kamilovs (skia + uharfbuzz) kg/k2..k5 — eng toza Apple-style: glass headline, pill, notification, Find My, segmented control, booking flow, end card, ikonlar, kamera keyframe, zoom-kesim, tracking"),
    "kamilovs_eeg": ("2026-10-09_Kamilovs_EEG-unutuvchanlik/kamilovs_eeg_skriptlar.tgz", "tgz", "Kamilovs EEG/unutuvchanlik varianti"),
    "mycom_monoblok_eng2": ("2026-10-09_MYCOM_MYPRO-monoblok/mycom_monoblok_skriptlar.tgz", "tgz",
                            "MYCOM eng2 (numpy + PIL + cv2, skia'siz): ekran almashtirish (gomografiya), SDF shakllar, glass, so'z blur-in, SVG ikonka rasterizatori, kamera freymlari, stock karta, end card morfi, render final|preview|stills"),
    "mycom_servis_eng": ("2026-10-10_MYCOM_Kompyuter-xizmati/mycom1_skriptlar.tgz", "tgz",
                         "MYCOM servis reels eng (core + s1/fs/r1/m1): yuz kuzatuvi + titrash kompensatsiyasi, yuzga qarab kartalar, to'liq ekran ketma-ketlik, CTA pill, Reels xavfsiz zona maketi"),
    "yec_tizer": ("2026-10-09_YEC_Tizer/yec_tizer_skriptlar.tgz", "tgz",
                  "YEC tizer (PIL + cv2): uzun epizoddan soundbite tizer, ASR + energiya kesim, beat-snap, sariq raqam kartalari, ism plashkasi, YouTube CTA"),
    "mrbeast_uzsub": ("2026-10-10_Zafar_MrBeast-Ozbekiston/mrbeast_uzsub_skriptlar.tgz", "tgz",
                      "Tarjima + subtitr: PIL pill cue PNG → ffmpeg overlay + alfa fade (render.py out.mp4 16 slow)"),
    "guaress10": ("2026-10-06_Guaress_10-xato/guaress10_skriptlar.tgz", "tgz", "Guaress eng/gfx/media/build: rasm/video kartalar, Ken Burns, LUT grade (FACE/STOCK)"),
    "tsp3": ("2026-10-06_TSP_Devor-shift/tsp3_skriptlar_v2.tgz", "tgz", "TSP (numpy eng.py + lib3d/prof3d): 3D profil modellari, glass panel, svg ikonlar"),
    "smm24": ("2026-10-06_SMM24/smm24_skriptlar.tgz", "tgz", "SMM24 (50 fps): Telegram qidiruv UI hook, narx pufakchalari, Archivo VF"),
    "ortolife": ("2026-10-10_OrtoLife_Protez-vaucher/ortolife_skriptlar.tgz", "tgz", "OrtoLife protez-vaucher"),
    "tutti": ("2026-10-10_Tutti_Aiden/tutti_v2fix_skriptlar.tgz", "tgz", "Tutti (mebel) v2fix"),
    "honor_v2": ("2026-10-09_SindorUz_HONOR-X9e-Pro/honor_v2_skriptlar.tgz", "tgz", "SindorUz HONOR X9e Pro v2"),
    "agromash": ("2026-10-01_Agromash/agromash_loyiha_skriptlar.tgz", "tgz", "Agromash (Chromium + three.js) HTML/CSS grafika, 3D, xarita, karusel"),
    "mephone_scripts3": ("2026-10-02_MePhone/scripts3", "dir", "MePhone (Chromium + three.js) mg3.html/mg3.js/comp3.py, 3D, tracking"),
    "theisle": ("2026-09-29_TheIsle", "dir", "The Isle engine.py/build.py: Dynamic_style effektlari (tracking-typewriter, matte, rang-karta, flip)"),
    "furniglass": ("2026-10-01_Furniglass", "dir", "Furniglass motion.py (Card, run_card): brend chizig'idan kartalar, chiplar, telefon CTA"),
    "lulu_savollar": ("2026-10-07_LuluGallery_Savollar", "dir", "Lulu (PIL + cv2) motion.py + lulu3.py: serif kinetik matn, chat pufakchalar, iOS toggle/slayder"),
    "geely_teaser": ("2026-10-07_Geely_3L-teaser", "dir", "Geely teaser.py: beat to'rida avto-montaj"),
    "mbcity_faststory": ("2026-10-06_MBcity_FastStory", "dir", "MB FastStory story_v2.py: yarim-beat kesimlar, whip-pan, push, qora yakuniy ekran"),
    "ezgumakon": ("2026-10-03_EzguMakon", "dir", "EzguMakon edl.py/mac_render.py: S-Log3 grade, BPM to'ri EDL, RIFE slow-mo"),
    "_arxiv_05": ("_arxiv/05_Vaqtincha_skriptlar_2026-10-10.tgz", "tgz", "Tozalangan 05_Vaqtincha dagi barcha skriptlar (Tutti, OrtoLife, HONOR, Livardi 1x1, Lulu3-5, glass va b.)"),
}
TEXT_EXT = {".py", ".js", ".html", ".sh", ".txt", ".json", ".md", ".css", ".command"}
SKIP_DIR_COPY = {".DS_Store"}


def replacements(root):
    r = root.rstrip("/")
    work = r + "/05_Vaqtincha/_ish"
    return [
        (re.compile(r"/sessions/[A-Za-z0-9_-]+/mnt/Claude/"), r + "/"),
        (re.compile(r"~/mnt/Claude/"), r + "/"),
        (re.compile(r"/mnt/user-data/uploads/Claude/"), r + "/"),
        (re.compile(r"/mnt/user-data/uploads/"), r + "/01_Kiruvchi/"),
        (re.compile(r"/mnt/user-data/outputs/"), work + "/out/"),
        (re.compile(r"/home/claude/"), work + "/"),
    ]


def adapt_file(p, reps, log):
    try:
        s = p.read_text(encoding="utf-8")
    except Exception:
        return
    orig = s
    counts = []
    for rx, rep in reps:
        s, n = rx.subn(rep, s)
        if n:
            counts.append((rx.pattern, n))
    if s != orig:
        p.write_text(s, encoding="utf-8")
        log.append((str(p.relative_to(HERE)), counts))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=os.environ.get("CLAUDE_ROOT") or str(SITE.parent))
    ap.add_argument("--projects", default=None)
    args = ap.parse_args()
    root = args.root
    projects = Path(args.projects or os.path.join(root, "03_Loyihalar"))
    reps = replacements(root)
    log = []
    done = []
    for name, (src, kind, note) in ENGINES.items():
        dst = HERE / name
        srcp = projects / src
        if not srcp.exists():
            done.append((name, "YO'Q: " + str(srcp), note))
            continue
        if dst.exists():
            try:
                shutil.rmtree(dst)
            except Exception:
                pass  # o'chirish taqiqlangan muhit (Cowork VM) — ustidan yozamiz
        dst.mkdir(parents=True, exist_ok=True)
        if kind == "tgz":
            with tarfile.open(srcp) as tf:
                members = [m for m in tf.getmembers() if not os.path.basename(m.name).startswith("._")]
                tf.extractall(dst, members=members)
        else:
            for item in srcp.iterdir():
                if item.name in SKIP_DIR_COPY or item.name.startswith("._"):
                    continue
                if item.is_dir():
                    if item.suffix in (".prproj", ".aep") or item.name.lower() in ("renders", "frames", "stills"):
                        continue
                    shutil.copytree(item, dst / item.name, dirs_exist_ok=True, ignore=shutil.ignore_patterns(".DS_Store", "._*", "*.mp4", "*.mov", "*.wav", "*.npy"))
                elif item.suffix.lower() not in (".mp4", ".mov", ".wav", ".npy", ".prproj", ".aep", ".mp3"):
                    shutil.copy2(item, dst / item.name)
        n_files = 0
        for p in dst.rglob("*"):
            try:
                os.chmod(p, 0o755 if p.is_dir() else 0o644)   # arxivdagi faqat-o'qish ruxsatlarini ochamiz
            except Exception:
                pass
            if p.is_file():
                n_files += 1
                if p.suffix.lower() in TEXT_EXT:
                    adapt_file(p, reps, log)
        done.append((name, f"{n_files} fayl ← 03_Loyihalar/{src}", note))

    # README
    lines = ["# engines/ — 03_Loyihalar dagi dvigatellarning moslashtirilgan NUSXALARI", "",
             f"Tayyorlandi: `_tayyorlash.py` bilan. ROOT = `{root}`. 03 dagi asl fayllar o'zgartirilmagan.", "",
             "Yo'l almashtirishlari: `~/mnt/Claude/`, `/mnt/user-data/uploads/Claude/`, `/sessions/…/mnt/Claude/` → `ROOT/`;",
             "`/mnt/user-data/uploads/<fayl>` → `ROOT/01_Kiruvchi/<fayl>`; `/home/claude/<x>` va `/mnt/user-data/outputs/` → `ROOT/05_Vaqtincha/_ish/…`",
             "(montaj sessiyasi o'z nusxasida `_ish` ni `_job_<id>` ga almashtiradi yoki yo'llarni argument qilib beradi).", "",
             "⚠ Kamilovs dvigateli skia-python + uharfbuzz talab qiladi (venv'da o'rnatilgan bo'lsa ishlaydi); eng2 (MYCOM) — skia'siz, bir xil sifat.",
             "⚠ Chromium/three.js dvigatellari (Agromash, MePhone) Playwright + Chromium kerak — venv'da bo'lmasa, PIL/cv2 dvigatellaridan foydalan.", "",
             "| Dvigatel | Manba | Nima uchun yaxshi |", "|---|---|---|"]
    for name, src, note in done:
        lines.append(f"| `{name}/` | {src} | {note} |")
    lines += ["", "## Almashtirilgan yo'llar (fayl → qancha)", ""]
    if not log:
        lines.append("(hech narsa almashtirilmadi)")
    for f, counts in log:
        lines.append(f"- `{f}`: " + ", ".join(f"{n}× `{pat}`" for pat, n in counts))
    (HERE / "README.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"{len(done)} dvigatel, {len(log)} faylda yo'l almashtirildi → {HERE / 'README.md'}")


if __name__ == "__main__":
    main()
