#!/usr/bin/env python3
"""AI Montaj Ofisi — lokal veb-server (faqat Python stdlib).

    python3 07_AI_Ofis_Sayt/server/app.py [--port 8787] [--lan] [--no-open]

- Sukut bo'yicha faqat 127.0.0.1 da tinglaydi. `--lan` → 0.0.0.0 + tasodifiy token (`?t=...`).
- SSE: GET /api/jobs/<id>/stream  (events.jsonl ni tail qiladi)
- HTTP Range: GET /api/file?path=<abs>  (faqat ROOT va SITE/jobs ichidagi fayllar)
- Bo'lakli yuklash: POST /api/upload/init → PUT /api/upload/<id>?offset=N → POST /api/upload/<id>/done
"""
import argparse
import json
import mimetypes
import os
import secrets
import socket
import subprocess
import sys
import threading
import time
import urllib.parse
import webbrowser
from datetime import datetime
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SITE))
from server import store  # noqa: E402
from runner import runner as runner_mod  # noqa: E402

WEB = SITE / "web"
TOKEN = None          # --lan rejimida
mimetypes.add_type("font/woff2", ".woff2")
mimetypes.add_type("font/ttf", ".ttf")
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("video/mp4", ".mp4")
mimetypes.add_type("video/quicktime", ".mov")
mimetypes.add_type("image/webp", ".webp")

UPLOADS = {}          # upload_id -> {path, size, received, client}
_up_lock = threading.Lock()


_LOGF = None


def log(*a):
    global _LOGF
    line = datetime.now().strftime("%H:%M:%S") + " " + " ".join(str(x) for x in a)
    print(line, flush=True)
    try:
        if _LOGF is None:
            (SITE / "_log").mkdir(exist_ok=True)
            _LOGF = open(SITE / "_log" / "server.log", "a", encoding="utf-8")
        _LOGF.write(line + "\n"); _LOGF.flush()
    except Exception:
        pass


class Handler(BaseHTTPRequestHandler):
    server_version = "AIMontajOfisi/1.0"
    protocol_version = "HTTP/1.1"

    # ---------- umumiy ----------
    def handle(self):
        try:
            super().handle()
        except (ConnectionResetError, BrokenPipeError, TimeoutError):
            pass  # brauzer ulanishni uzdi (media loader, sahifa yangilandi) — normal holat

    def log_message(self, fmt, *args):  # jim: faqat xatolar
        if args and str(args[1:2]).startswith(("('4", "('5")):
            log(self.address_string(), fmt % args)

    def _parse(self):
        u = urllib.parse.urlsplit(self.path)
        self.route = u.path
        self.query = {k: v[0] for k, v in urllib.parse.parse_qs(u.query).items()}

    def _auth_ok(self):
        if TOKEN is None:
            return True
        if self.query.get("t") == TOKEN:
            self._set_cookie = True
            return True
        cookie = self.headers.get("Cookie", "")
        return f"ofis_token={TOKEN}" in cookie

    def _send(self, code, body=b"", ctype="application/json; charset=utf-8", extra=None):
        if isinstance(body, (dict, list)):
            body = json.dumps(body, ensure_ascii=False).encode("utf-8")
        elif isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        if getattr(self, "_set_cookie", False) and TOKEN:
            self.send_header("Set-Cookie", f"ofis_token={TOKEN}; Path=/; SameSite=Lax")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _json_body(self):
        n = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(n) if n else b""
        if not raw:
            return {}
        try:
            return json.loads(raw.decode("utf-8"))
        except Exception:
            raise ValueError("JSON noto'g'ri")

    def _err(self, code, msg):
        self._send(code, {"error": msg})

    # ---------- marshrutlar ----------
    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        try:
            self._parse()
            if not self._auth_ok():
                return self._send(HTTPStatus.FORBIDDEN, "<h2>Token kerak</h2>", "text/html; charset=utf-8")
            r = self.route
            if r == "/" or r == "/index.html":
                return self._static(WEB / "index.html")
            if r == "/3d" or r == "/3d/":
                return self._static(WEB / "3d.html")
            if r.startswith("/web/"):
                return self._static(WEB / r[5:])
            if r == "/api/config":
                return self._send(200, store.load_config())
            if r == "/api/status":
                return self._status()
            if r == "/api/jobs":
                return self._send(200, store.list_jobs())
            if r == "/api/sources":
                return self._send(200, {"root": str(store.IN_DIR), "items": store.list_dir(store.IN_DIR, depth=2)})
            if r == "/api/assets/music":
                return self._send(200, store.list_dir(store.ASSETS / "Musiqa", depth=1, exts=store.AUDIO_EXT | {".mp4"}))
            if r == "/api/assets/refs":
                items = [d["name"] for d in store.list_dir(store.REFS, depth=0) if d["dir"]]
                return self._send(200, items)
            if r == "/api/assets/ready":
                return self._send(200, store.list_dir(store.OUT_DIR, depth=1, exts=store.VIDEO_EXT))
            if r == "/api/file":
                return self._file_range(self.query.get("path", ""))
            parts = r.strip("/").split("/")
            if len(parts) >= 3 and parts[0] == "api" and parts[1] == "jobs":
                jid = urllib.parse.unquote(parts[2])
                job = store.load_job(jid)
                if not job:
                    return self._err(404, "ish topilmadi")
                sub = parts[3] if len(parts) > 3 else ""
                if sub == "":
                    q = runner_mod.get_runner().queue_info()
                    job["queue_pos"] = (q["queue"].index(jid) + 1) if jid in q["queue"] else 0
                    return self._send(200, job)
                if sub == "events":
                    after = int(self.query.get("after", 0) or 0)
                    evs, total = store.read_events(jid, after)
                    return self._send(200, {"events": evs, "total": total})
                if sub == "stream":
                    return self._sse(jid)
                if sub == "log":
                    p = store.job_dir(jid) / "claude.jsonl"
                    txt = p.read_text(encoding="utf-8", errors="replace")[-200000:] if p.exists() else ""
                    return self._send(200, txt, "text/plain; charset=utf-8")
                if sub == "stderr":
                    p = store.job_dir(jid) / "claude.stderr.log"
                    txt = p.read_text(encoding="utf-8", errors="replace")[-50000:] if p.exists() else ""
                    return self._send(200, txt, "text/plain; charset=utf-8")
            return self._err(404, "yo'l topilmadi")
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as e:  # noqa: BLE001
            log("GET xato", self.path, repr(e))
            try:
                self._err(500, str(e))
            except Exception:
                pass

    def do_POST(self):
        try:
            self._parse()
            if not self._auth_ok():
                return self._err(403, "token kerak")
            r = self.route
            rn = runner_mod.get_runner()
            if r == "/api/jobs":
                data = self._json_body()
                job = store.create_job(data)
                store.append_event(job["id"], {"type": "status", "status": "new", "text": "Ish yaratildi"})
                if data.get("start"):
                    try:
                        rn.enqueue(job["id"])
                    except ValueError as e:
                        return self._send(200, {"job": store.load_job(job["id"]), "warning": str(e)})
                return self._send(200, {"job": store.load_job(job["id"])})
            if r == "/api/upload/init":
                return self._upload_init(self._json_body())
            parts = r.strip("/").split("/")
            if len(parts) == 4 and parts[0] == "api" and parts[1] == "upload" and parts[3] == "done":
                return self._upload_done(parts[2])
            if len(parts) >= 4 and parts[0] == "api" and parts[1] == "jobs":
                jid = urllib.parse.unquote(parts[2])
                job = store.load_job(jid)
                if not job:
                    return self._err(404, "ish topilmadi")
                sub = parts[3]
                if sub == "start":
                    if job.get("status") in ("running", "queued"):
                        return self._err(409, "ish allaqachon ishlayapti / navbatda")
                    pos = rn.enqueue(jid)
                    return self._send(200, {"ok": True, "queue_pos": pos})
                if sub == "cancel":
                    ok = rn.cancel(jid)
                    return self._send(200, {"ok": ok})
                if sub == "fix":
                    data = self._json_body()
                    text = (data.get("text") or "").strip()
                    if not text:
                        return self._err(400, "tuzatish matni bo'sh")
                    if not job.get("session_id"):
                        return self._err(409, "sessiya yo'q — avval ishni to'liq ishga tushiring")
                    if job.get("status") in ("running", "queued"):
                        return self._err(409, "ish hali tugamagan")
                    job.setdefault("fixes", []).append({"ts": time.time(), "text": text})
                    store.save_job(job)
                    store.append_event(jid, {"type": "decision", "agent": "rejissyor", "state": "working",
                                             "text": "Tuzatish talabi: " + text, "kind": "fix"})
                    pos = rn.enqueue(jid, mode="fix", payload={"text": text})
                    return self._send(200, {"ok": True, "queue_pos": pos})
                if sub == "reveal":
                    data = self._json_body()
                    path = data.get("path") or ((job.get("versions") or [{}])[-1].get("path")) or str(store.job_dir(jid))
                    if not store.safe_under(path, store.ROOT):
                        return self._err(403, "ROOT dan tashqari")
                    if sys.platform == "darwin":
                        subprocess.Popen(["open", "-R", path] if os.path.isfile(path) else ["open", path])
                        return self._send(200, {"ok": True})
                    return self._send(200, {"ok": False, "path": path, "note": "faqat macOS'da"})
                if sub == "event":
                    ev = self._json_body()
                    if not isinstance(ev, dict) or not ev.get("type"):
                        return self._err(400, "hodisa noto'g'ri")
                    ev["via"] = "http"
                    if ev["type"] == "status" and ev.get("status") in ("running", "done", "error", "cancelled", "queued"):
                        store.update_job(jid, status=ev["status"])
                    return self._send(200, store.append_event(jid, ev))
                if sub == "delete":
                    if job.get("status") in ("running", "queued"):
                        return self._err(409, "avval bekor qiling")
                    import shutil
                    shutil.rmtree(store.job_dir(jid), ignore_errors=True)
                    return self._send(200, {"ok": True})
            return self._err(404, "yo'l topilmadi")
        except ValueError as e:
            self._err(400, str(e))
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as e:  # noqa: BLE001
            log("POST xato", self.path, repr(e))
            try:
                self._err(500, str(e))
            except Exception:
                pass

    def do_PUT(self):
        try:
            self._parse()
            if not self._auth_ok():
                return self._err(403, "token kerak")
            if self.route == "/api/config":
                data = self._json_body()
                return self._send(200, store.save_config(data))
            parts = self.route.strip("/").split("/")
            if len(parts) == 3 and parts[0] == "api" and parts[1] == "upload":
                return self._upload_chunk(parts[2])
            return self._err(404, "yo'l topilmadi")
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as e:  # noqa: BLE001
            log("PUT xato", self.path, repr(e))
            try:
                self._err(500, str(e))
            except Exception:
                pass

    # ---------- holat ----------
    def _status(self):
        rn = runner_mod.get_runner()
        q = rn.queue_info()
        st = runner_mod.claude_status()
        self._send(200, {
            "live": True, "time": time.time(), "today": store.today_count(),
            "running": q["running"], "queue": q["queue"], "claude": st,
            "root": str(store.ROOT), "site": str(SITE), "lan": TOKEN is not None,
            "ffmpeg": bool(_which("ffmpeg")), "platform": sys.platform,
        })

    # ---------- statik ----------
    def _static(self, p):
        p = Path(p)
        if not store.safe_under(p, WEB) or not p.is_file():
            return self._err(404, "fayl yo'q")
        ctype = mimetypes.guess_type(str(p))[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype.endswith("javascript"):
            ctype += "; charset=utf-8"
        data = p.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache" if p.suffix in (".html", ".js", ".css") else "max-age=86400")
        if getattr(self, "_set_cookie", False) and TOKEN:
            self.send_header("Set-Cookie", f"ofis_token={TOKEN}; Path=/; SameSite=Lax")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)

    # ---------- Range fayl ----------
    def _file_range(self, path):
        path = urllib.parse.unquote(path)
        if not path or not store.safe_under(path, store.ROOT, store.JOBS):
            return self._err(403, "faqat Claude papkasi ichidagi fayl")
        p = Path(path)
        if not p.is_file():
            return self._err(404, "fayl yo'q")
        size = p.stat().st_size
        ctype = mimetypes.guess_type(str(p))[0] or "application/octet-stream"
        rng = self.headers.get("Range")
        start, end = 0, size - 1
        code = 200
        if os.environ.get("OFIS_DEBUG"):
            log("file", p.name, "Range:", rng, "| UA:", (self.headers.get("User-Agent") or "")[:40], "| hdrs:", {k: v for k, v in self.headers.items() if k.lower() in ("accept", "accept-encoding", "connection", "sec-fetch-dest", "if-range", "cache-control")})
        if rng and rng.startswith("bytes="):
            try:
                a, b = rng[6:].split("-", 1)
                start = int(a) if a else max(0, size - int(b))
                end = int(b) if (b and a) else size - 1
                end = min(end, size - 1)
                if start > end or start >= size:
                    self.send_response(416)
                    self.send_header("Content-Range", f"bytes */{size}")
                    self.send_header("Content-Length", "0")
                    self.end_headers()
                    return
                code = 206
            except ValueError:
                start, end, code = 0, size - 1, 200
        length = end - start + 1
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(length))
        self.send_header("Cache-Control", "no-cache")
        if code == 206:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.end_headers()
        if self.command == "HEAD":
            return
        with open(p, "rb") as f:
            f.seek(start)
            left = length
            while left > 0:
                chunk = f.read(min(1 << 20, left))
                if not chunk:
                    break
                self.wfile.write(chunk)
                left -= len(chunk)

    # ---------- SSE ----------
    def _sse(self, jid):
        after = int(self.query.get("after", 0) or 0)
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()
        p = store.job_dir(jid) / "events.jsonl"
        sent = 0
        pos = 0
        buf = b""
        last_beat = time.time()
        try:
            self.wfile.write(b"retry: 1500\n\n")
            self.wfile.flush()
            while True:
                if p.exists():
                    with open(p, "rb") as f:
                        f.seek(pos)
                        data = f.read()
                        pos = f.tell()
                    if data:
                        buf += data
                        while b"\n" in buf:
                            line, buf = buf.split(b"\n", 1)
                            if not line.strip():
                                continue
                            sent += 1
                            if sent <= after:
                                continue
                            self.wfile.write(b"id: " + str(sent).encode() + b"\nevent: ev\ndata: " + line + b"\n\n")
                        self.wfile.flush()
                        last_beat = time.time()
                if time.time() - last_beat > 15:
                    self.wfile.write(b": ping\n\n")
                    self.wfile.flush()
                    last_beat = time.time()
                time.sleep(0.25)
        except (BrokenPipeError, ConnectionResetError, OSError):
            return

    # ---------- yuklash ----------
    def _upload_init(self, data):
        name = os.path.basename((data.get("name") or "fayl").replace("\\", "/"))
        if not name or name.startswith("."):
            return self._err(400, "fayl nomi noto'g'ri")
        size = int(data.get("size") or 0)
        client = store.slug(data.get("client") or "Mijoz", 24)
        folder = store.IN_DIR / f"{client}_{datetime.now().strftime('%Y-%m-%d')}"
        folder.mkdir(parents=True, exist_ok=True)
        dest = folder / name
        i = 1
        while dest.exists():
            dest = folder / f"{Path(name).stem}_{i}{Path(name).suffix}"
            i += 1
        uid = secrets.token_hex(8)
        tmp = dest.with_name(dest.name + ".part")
        with open(tmp, "wb") as f:
            if size:
                f.truncate(size)
        with _up_lock:
            UPLOADS[uid] = {"path": str(dest), "tmp": str(tmp), "size": size, "received": 0, "ts": time.time()}
        self._send(200, {"upload_id": uid, "path": str(dest), "folder": str(folder)})

    def _upload_chunk(self, uid):
        with _up_lock:
            up = UPLOADS.get(uid)
        if not up:
            return self._err(404, "yuklash sessiyasi yo'q")
        offset = int(self.query.get("offset", 0) or 0)
        n = int(self.headers.get("Content-Length") or 0)
        with open(up["tmp"], "r+b") as f:
            f.seek(offset)
            left = n
            while left > 0:
                chunk = self.rfile.read(min(1 << 20, left))
                if not chunk:
                    break
                f.write(chunk)
                left -= len(chunk)
        with _up_lock:
            up["received"] = max(up["received"], offset + n)
        self._send(200, {"ok": True, "received": up["received"]})

    def _upload_done(self, uid):
        with _up_lock:
            up = UPLOADS.pop(uid, None)
        if not up:
            return self._err(404, "yuklash sessiyasi yo'q")
        os.replace(up["tmp"], up["path"])
        self._send(200, {"ok": True, "path": up["path"], "size": os.path.getsize(up["path"])})


def _which(name):
    for d in [SITE / "bin", Path.home() / ".local" / "bin", Path("/opt/homebrew/bin"), Path("/usr/local/bin")] + \
             [Path(x) for x in os.environ.get("PATH", "").split(":") if x]:
        if (d / name).is_file():
            return str(d / name)
    return None


def lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def main():
    global TOKEN
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8787)
    ap.add_argument("--lan", action="store_true", help="lokal Wi-Fi'dan ham ochish (token bilan)")
    ap.add_argument("--no-open", action="store_true")
    args = ap.parse_args()
    host = "0.0.0.0" if args.lan else "127.0.0.1"
    if args.lan:
        TOKEN = secrets.token_urlsafe(12)
    store.JOBS.mkdir(exist_ok=True)
    runner_mod.get_runner()
    srv = ThreadingHTTPServer((host, args.port), Handler)
    srv.daemon_threads = True
    _orig_handle_error = srv.handle_error

    def _quiet_handle_error(request, client_address):
        et = sys.exc_info()[0]
        if et in (ConnectionResetError, BrokenPipeError, TimeoutError):
            return
        _orig_handle_error(request, client_address)
    srv.handle_error = _quiet_handle_error
    url = f"http://127.0.0.1:{args.port}/"
    log(f"AI Montaj Ofisi → {url}")
    log(f"ROOT = {store.ROOT}")
    if args.lan:
        log(f"LAN:  http://{lan_ip()}:{args.port}/?t={TOKEN}")
    st = runner_mod.claude_status()
    log(f"claude: {st.get('path') or 'TOPILMADI'} · login={st.get('logged_in')} · {st.get('version') or ''}")
    log(f"ffmpeg: {_which('ffmpeg') or 'TOPILMADI'}")
    if not args.no_open:
        threading.Timer(0.8, lambda: webbrowser.open(url + (f"?t={TOKEN}" if TOKEN else ""))).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
