"""Ovozli kirish (ASR) — brauzer yozuvi (webm/opus, mp4) → bin/ffmpeg → 16 kHz mono wav → doimiy asr_worker (venv python).

Ishchi jarayon birinchi soʻrovda ishga tushadi (model ~3 s yuklanadi), keyin yashab turadi; oʻlsa keyingi soʻrovda qayta.
Fayllar _cache/asr/ da, tanishdan keyin oʻchiriladi. Internetsiz.
"""
import json
import os
import shutil
import subprocess
import sys
import threading
import time
import uuid
from pathlib import Path

from server import store
from server.chat import norm_uz
from runner import runner as runner_mod

SITE = store.SITE
CACHE = SITE / "_cache" / "asr"
WORKER = SITE / "server" / "asr_worker.py"
START_TIMEOUT = 180
REQ_TIMEOUT = 90

_lock = threading.Lock()
_proc = None
_ready_info = None


def _venv_python():
    p = SITE / ".venv" / "bin" / "python"
    return str(p) if p.is_file() else sys.executable


def _start():
    global _proc, _ready_info
    (SITE / "_log").mkdir(exist_ok=True)
    err = open(SITE / "_log" / "asr_worker.log", "a", encoding="utf-8")
    _proc = subprocess.Popen([_venv_python(), str(WORKER)], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=err,
                             text=True, encoding="utf-8", bufsize=1, env=runner_mod.session_env(), cwd=str(SITE))
    line = _read_line(START_TIMEOUT)
    info = json.loads(line) if line else {}
    if not info.get("ready"):
        _kill()
        raise RuntimeError(info.get("error") or "ASR ishchi jarayoni ishga tushmadi (_log/asr_worker.log)")
    _ready_info = info


def _read_line(timeout):
    """stdout dan bir qator (timeout bilan) — alohida ipda oʻqiymiz."""
    box = {}

    def rd():
        try:
            box["l"] = _proc.stdout.readline()
        except Exception as e:  # noqa: BLE001
            box["e"] = e
    t = threading.Thread(target=rd, daemon=True)
    t.start()
    t.join(timeout)
    if t.is_alive() or not box.get("l"):
        _kill()
        raise TimeoutError("ASR ishchi javob bermadi")
    return box["l"]


def _kill():
    global _proc
    if _proc:
        try:
            _proc.kill()
        except Exception:
            pass
    _proc = None


def _ask_worker(wav):
    global _proc
    if _proc is None or _proc.poll() is not None:
        _start()
    rid = uuid.uuid4().hex[:8]
    _proc.stdin.write(json.dumps({"id": rid, "wav": str(wav)}) + "\n")
    _proc.stdin.flush()
    while True:
        line = _read_line(REQ_TIMEOUT)
        d = json.loads(line)
        if d.get("id") == rid:
            return d


def status():
    return {"running": bool(_proc and _proc.poll() is None), "model": _ready_info, "worker": str(WORKER)}


def transcribe(raw, mime=""):
    """→ {"text", "words", "ms", "dur"}"""
    if not raw or len(raw) < 200:
        raise ValueError("audio boʻsh")
    ff = (SITE / "bin" / "ffmpeg")
    ff = str(ff) if ff.is_file() else shutil.which("ffmpeg")
    if not ff:
        raise RuntimeError("ffmpeg topilmadi")
    CACHE.mkdir(parents=True, exist_ok=True)
    ext = ".mp4" if "mp4" in mime or "m4a" in mime else ".ogg" if "ogg" in mime else ".wav" if "wav" in mime else ".webm"
    uid = uuid.uuid4().hex
    src, wav = CACHE / f"{uid}{ext}", CACHE / f"{uid}.wav"
    src.write_bytes(raw)
    try:
        r = subprocess.run([ff, "-y", "-loglevel", "error", "-i", str(src), "-vn", "-ac", "1", "-ar", "16000", "-f", "wav", str(wav)],
                           capture_output=True, text=True, timeout=60)
        if r.returncode != 0 or not wav.exists():
            raise RuntimeError("audio oʻqilmadi: " + (r.stderr or "").strip()[-200:])
        t0 = time.time()
        with _lock:
            d = _ask_worker(wav)
        if d.get("error"):
            raise RuntimeError(d["error"])
        text = norm_uz(" ".join(w["w"] for w in d.get("words", [])).strip())
        if text:
            text = text[0].upper() + text[1:]
        return {"text": text, "words": d.get("words", []), "ms": int((time.time() - t0) * 1000), "dur": round(os.path.getsize(wav) / 32000, 2)}
    finally:
        for p in (src, wav):
            try:
                p.unlink()
            except Exception:
                pass
