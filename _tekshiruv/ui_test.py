"""Konteyner/Mac'da sahifani Chromium bilan sinash: ish yaratish → progress.py hodisalari → sahifa yangilanishi.
   python3 _tekshiruv/ui_test.py [http://127.0.0.1:8787]
"""
import json
import os
import subprocess
import sys
import time
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8787"
SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(SITE, "_tekshiruv", "shots")
os.makedirs(OUT, exist_ok=True)


def api(path, data=None, method=None):
    req = urllib.request.Request(BASE + path, data=json.dumps(data).encode() if data is not None else None,
                                 headers={"Content-Type": "application/json"}, method=method or ("POST" if data is not None else "GET"))
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read().decode())


def prog(job, *args):
    cmd = [sys.executable, os.path.join(SITE, "progress.py"), "--job", job] + list(args)
    out = subprocess.run(cmd, capture_output=True, text=True)
    if out.returncode != 0:
        print("progress.py xato:", out.stderr)
    return out.stdout.strip()


def main():
    from playwright.sync_api import sync_playwright
    src = api("/api/sources")
    files = []
    for n in src["items"]:
        for c in n.get("children", []):
            if not c["dir"]:
                files.append(c["path"])
    if not files:
        print("01_Kiruvchi da fayl yo'q"); sys.exit(1)
    job = api("/api/jobs", {"client": "Test Mijoz", "topic": "UI sinovi", "sources": files[:1], "requirements": "sinov", "format": "9:16", "fps": "59.94", "start": False})["job"]
    jid = job["id"]
    print("job:", jid)
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1440, "height": 900})
        errors = []
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.on("console", lambda m: errors.append(m.text) if (m.type == "error" and "/web/fonts/" not in (m.location or {}).get("url", "") and "404" not in m.text) else None)
        pg.goto(BASE + "/", wait_until="load")  # SSE ochiq turadi — networkidle hech qachon kelmaydi
        pg.wait_for_selector(".agent")
        pg.click(f'.job-item[data-id="{jid}"]')
        time.sleep(1.0)
        pg.screenshot(path=os.path.join(OUT, "01_bosh.png"))
        # hodisalar
        api(f"/api/jobs/{jid}/event", {"type": "status", "status": "running", "text": "Sinov sessiyasi"})
        prog(jid, "--agent", "rejissyor", "--state", "working", "--text", "Talabni o'qiyapman, mijoz kartasini qidiryapman", "--pct", "10")
        time.sleep(0.8)
        prog(jid, "--agent", "rejissyor", "--state", "done", "--text", "Reja tayyor: 6 sahna", "--metric", "sahnalar=6", "--handoff", "ovozchi", "--type", "decision")
        time.sleep(0.6)
        prog(jid, "--agent", "ovozchi", "--state", "working", "--text", "ASR: 2/4 bo'lak", "--pct", "50", "--metric", "sozlar=132", "--metric", "davomiylik=38.4")
        time.sleep(0.9)
        pg.screenshot(path=os.path.join(OUT, "02_ishlayapti.png"))
        edl = os.path.join(SITE, "jobs", jid, "edl.json")
        json.dump({"segments": [{"t0": 0, "t1": 3.2, "src": "manba.mp4", "label": "hook"}, {"t0": 3.2, "t1": 7.9, "src": "manba.mp4", "kind": "gfx", "label": "karta"},
                               {"t0": 7.9, "t1": 12.0, "src": "stock1.mp4", "kind": "stock", "label": "stock"}, {"t0": 12.0, "t1": 15.5, "src": "manba.mp4", "label": "CTA"}]}, open(edl, "w"))
        prog(jid, "--agent", "montajchi", "--state", "working", "--text", "EDL yozildi", "--type", "edl", "--edl", edl, "--handoff", "motion")
        time.sleep(0.6)
        # ffmpeg progress oqimi
        fake = "frame=10\nfps=12.5\nout_time_us=166666\nprogress=continue\nframe=20\nfps=13.1\nout_time_us=333333\nprogress=continue\nframe=40\nfps=13.0\nout_time_us=666666\nprogress=end\n"
        subprocess.run([sys.executable, os.path.join(SITE, "progress.py"), "--job", jid, "--agent", "rangchi", "--ffmpeg-progress", "--total-frames", "40", "--interval", "0", "--text", "Render"], input=fake, text=True)
        time.sleep(0.8)
        pg.screenshot(path=os.path.join(OUT, "03_render.png"))
        # final
        out_dir = os.path.join(os.environ.get("CLAUDE_ROOT", os.path.dirname(SITE)), "04_Tayyor_videolar")
        final = os.path.join(out_dir, "2026-10-10_TestMijoz_UI-sinovi_v1.mp4")
        import shutil
        shutil.copy(files[0], final)
        prog(jid, "--agent", "rejissyor", "--state", "done", "--type", "final", "--file", final, "--metric", "davomiylik=6.0", "--metric", "lufs=-14.2", "--text", "v1 tayyor")
        api(f"/api/jobs/{jid}/event", {"type": "status", "status": "done", "version": 1, "text": "v1 tayyor (sinov)"})
        time.sleep(1.2)
        pg.screenshot(path=os.path.join(OUT, "04_final.png"))
        # tekshiruvlar
        bubbles = pg.eval_on_selector_all(".agent .bubble", "els => els.map(e => e.textContent)")
        states = pg.eval_on_selector_all(".agent", "els => els.map(e => e.className)")
        segs = pg.eval_on_selector_all(".seg", "els => els.length")
        logn = pg.text_content("#log-count")
        decn = pg.text_content("#dec-count")
        label = pg.text_content("#monitor-label")
        print("bubbles:", bubbles)
        print("states:", states)
        print("segments:", segs, "| log:", logn, "| decisions:", decn, "| monitor:", label)
        print("JS errors:", errors)
        # telefon kengligi
        pg.set_viewport_size({"width": 390, "height": 844})
        time.sleep(0.6)
        pg.screenshot(path=os.path.join(OUT, "05_telefon.png"), full_page=True)
        hs = pg.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth")
        print("gorizontal scroll (telefon):", hs)
        b.close()
    ok = segs == 4 and "working" in states[1] and not errors and not hs
    print("NATIJA:", "OK" if ok else "XATO")


if __name__ == "__main__":
    main()
