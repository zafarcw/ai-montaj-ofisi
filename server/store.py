"""Yo'llar, sozlamalar va ishlar (jobs) ombori — faqat fayl tizimi, tashqi paketsiz."""
import json
import os
import re
import threading
import time
import unicodedata
from datetime import datetime
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent          # 07_AI_Ofis_Sayt
ROOT = Path(os.environ.get("CLAUDE_ROOT") or SITE.parent)  # Zafarcw Packs/Claude
JOBS = SITE / "jobs"
IN_DIR = ROOT / "01_Kiruvchi"
ASSETS = ROOT / "02_Assets"
PROJECTS = ROOT / "03_Loyihalar"
OUT_DIR = ROOT / "04_Tayyor_videolar"
TMP_DIR = ROOT / "05_Vaqtincha"
REFS = ROOT / "06_Referenslar"
CONFIG_PATH = SITE / "config.json"

VIDEO_EXT = {".mp4", ".mov", ".m4v", ".mkv", ".webm", ".avi", ".mts", ".m2ts", ".mxf"}
AUDIO_EXT = {".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg"}
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic"}

DEFAULT_CONFIG = {
    "name": "AI Montaj Ofisi",
    "accent": "#0A84FF",
    "logo": "",
    "model": "opus",
    "effort": "high",
    "models": ["opus", "fable", "sonnet", "haiku"],
    "efforts": ["low", "medium", "high", "xhigh", "max"],
    "claude_bin": "",
    "agents": [
        {"id": "rejissyor", "name": "Rejissyor", "color": "#0A84FF",
         "role": "Talab, mijoz kartasi, reja, yakuniy QC"},
        {"id": "ovozchi", "name": "Ovozchi", "color": "#FF9F0A",
         "role": "ffprobe, ASR, musiqa, duck/miks, limiter"},
        {"id": "montajchi", "name": "Montajchi", "color": "#30D158",
         "role": "Scene-detect, kesimlar, EDL, beat to'ri"},
        {"id": "motion", "name": "Motion dizayner", "color": "#BF5AF2",
         "role": "Kalit so'zlarga grafika, dvigatellar"},
        {"id": "rangchi", "name": "Rangchi", "color": "#FF375F",
         "role": "Grade, punch-in, render, eksport"},
    ],
    # CHAT-bosqich: xodim bilan ovozli chat (faqat /3d). roast_ok — "18 yoshdan kattaman" tasdig'i (bir marta).
    "chat": {"mode": "roast", "roast_ok": False, "voice_reply": True, "model": "haiku", "history": 8},
    # TTS: provider "auto" = ElevenLabs kaliti bo'lsa ElevenLabs, bo'lmasa macOS `say`. Kalit faqat shu faylda (git'da yo'q).
    "tts": {
        "provider": "auto", "elevenlabs_key": "", "elevenlabs_model": "eleven_multilingual_v2",
        "voices": {
            "rejissyor": {"say": "Daniel", "rate": 180, "eleven": "pNInz6obpgDQGcFmaJgB"},
            "ovozchi": {"say": "Rocko (Italian (Italy))", "rate": 185, "eleven": "ErXwobaYiN019PkySvjV"},
            "montajchi": {"say": "Milena", "rate": 215, "eleven": "21m00Tcm4TlvDq8ikWAM"},
            "motion": {"say": "Yelda", "rate": 200, "eleven": "TxGEqnHWrfWFTfGW9XjX"},
            "rangchi": {"say": "Aru", "rate": 185, "eleven": "EXAVITQu4vr4xnSDxMaL"},
        },
    },
}

_lock = threading.RLock()


# ---------- sozlamalar ----------
def load_config():
    with _lock:
        cfg = json.loads(json.dumps(DEFAULT_CONFIG))
        if CONFIG_PATH.exists():
            try:
                user = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
                for k, v in user.items():
                    if isinstance(v, dict) and isinstance(cfg.get(k), dict):
                        cfg[k] = {**cfg[k], **v}  # yangi standart kalitlar yo'qolmasin
                    else:
                        cfg[k] = v
            except Exception:
                pass
        return cfg


def save_config(patch):
    with _lock:
        cfg = load_config()
        for k, v in patch.items():
            if k not in DEFAULT_CONFIG:
                continue
            if isinstance(v, dict) and isinstance(cfg.get(k), dict):
                cfg[k] = {**cfg[k], **v}          # ichki lug'at (chat, tts): qisman yangilash
            else:
                cfg[k] = v
        CONFIG_PATH.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")
        return cfg


# ---------- yordamchilar ----------
def slug(s, maxlen=28):
    s = unicodedata.normalize("NFKD", str(s or ""))
    s = s.replace("ʻ", "").replace("ʼ", "").replace("'", "").replace("’", "")
    s = re.sub(r"[^A-Za-z0-9_-]+", "-", s).strip("-")
    return (s or "ish")[:maxlen]


def safe_under(path, *bases):
    """path berilgan ildizlardan birining ichidami (symlink'siz tekshiruv)."""
    try:
        p = Path(path).resolve()
    except Exception:
        return False
    for b in bases:
        try:
            p.relative_to(Path(b).resolve())
            return True
        except ValueError:
            continue
    return False


def human_size(n):
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if n < 1024 or unit == "TB":
            return f"{n:.0f} {unit}" if unit == "B" else f"{n:.1f} {unit}"
        n /= 1024.0


def list_dir(base, depth=1, exts=None):
    """Papka ro'yxati (faqat o'qish). exts berilsa faqat shu kengaytmali fayllar."""
    base = Path(base)
    out = []
    if not base.exists():
        return out
    for p in sorted(base.iterdir(), key=lambda x: x.name.lower()):
        if p.name.startswith(".") or p.name.startswith("_"):
            continue
        if p.is_dir():
            node = {"name": p.name, "path": str(p), "dir": True}
            if depth > 0:
                node["children"] = list_dir(p, depth - 1, exts)
                node["count"] = len(node["children"])
            out.append(node)
        else:
            if exts and p.suffix.lower() not in exts:
                continue
            st = p.stat()
            out.append({"name": p.name, "path": str(p), "dir": False,
                        "size": st.st_size, "size_h": human_size(st.st_size),
                        "mtime": int(st.st_mtime)})
    return out


# ---------- ishlar ----------
def new_job_id(client, topic):
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    return f"{ts}_{slug(client, 16)}_{slug(topic, 20)}"


def job_dir(job_id):
    return JOBS / job_id


def load_job(job_id):
    p = job_dir(job_id) / "job.json"
    if not p.exists():
        return None
    with _lock:
        return json.loads(p.read_text(encoding="utf-8"))


def save_job(job):
    d = job_dir(job["id"])
    d.mkdir(parents=True, exist_ok=True)
    tmp = d / "job.json.tmp"
    with _lock:
        tmp.write_text(json.dumps(job, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp, d / "job.json")
    return job


def update_job(job_id, **fields):
    with _lock:
        job = load_job(job_id)
        if not job:
            return None
        job.update(fields)
        job["updated"] = time.time()
        save_job(job)
        return job


def create_job(data):
    client = (data.get("client") or "Mijoz").strip()
    topic = (data.get("topic") or "Montaj").strip()
    jid = new_job_id(client, topic)
    sources = [s for s in (data.get("sources") or []) if s]
    job = {
        "id": jid,
        "created": time.time(),
        "updated": time.time(),
        "client": client,
        "topic": topic,
        "sources": sources,
        "requirements": (data.get("requirements") or "").strip(),
        "format": data.get("format") or "9:16",
        "fps": data.get("fps") or "59.94",
        "style_ref": data.get("style_ref") or "",
        "music": data.get("music") or "avto",
        "duration": data.get("duration") or "",
        "model": data.get("model") or load_config()["model"],
        "effort": data.get("effort") or load_config()["effort"],
        "status": "new",          # new | queued | running | done | error | cancelled
        "session_id": "",
        "versions": [],           # [{v, path, ts, metrics}]
        "fixes": [],              # [{ts, text, status}]
        "runs": [],               # [{mode, started, ended, rc, result}]
        "tmp_dir": str(TMP_DIR / f"_job_{jid}"),
    }
    save_job(job)
    (job_dir(jid) / "kod").mkdir(exist_ok=True)
    (job_dir(jid) / "events.jsonl").touch()
    return job


def list_jobs():
    out = []
    if not JOBS.exists():
        return out
    for d in JOBS.iterdir():
        if d.is_dir() and (d / "job.json").exists():
            try:
                j = json.loads((d / "job.json").read_text(encoding="utf-8"))
            except Exception:
                continue
            out.append({k: j.get(k) for k in ("id", "created", "updated", "client", "topic", "status",
                                                "format", "fps", "model", "effort", "versions", "duration")})
    out.sort(key=lambda j: j.get("created") or 0, reverse=True)
    return out


def read_events(job_id, after=0, limit=None):
    """events.jsonl dagi hodisalar (after = necha qator o'tkazib yuborish)."""
    p = job_dir(job_id) / "events.jsonl"
    evs = []
    if not p.exists():
        return evs, 0
    with open(p, "rb") as f:
        lines = f.read().split(b"\n")
    total = 0
    for raw in lines:
        if not raw.strip():
            continue
        total += 1
        if total <= after:
            continue
        try:
            evs.append(json.loads(raw.decode("utf-8")))
        except Exception:
            evs.append({"type": "raw", "text": raw.decode("utf-8", "replace")})
    if limit:
        evs = evs[-limit:]
    return evs, total


def append_event(job_id, ev):
    ev = dict(ev)
    ev.setdefault("ts", round(time.time(), 3))
    p = job_dir(job_id) / "events.jsonl"
    with _lock:
        with open(p, "a", encoding="utf-8") as f:
            f.write(json.dumps(ev, ensure_ascii=False) + "\n")
            f.flush()
    return ev


def next_version(job):
    return (max([v.get("v", 0) for v in job.get("versions", [])] or [0])) + 1


def today_count():
    today = datetime.now().date()
    n = 0
    for j in list_jobs():
        if j.get("created") and datetime.fromtimestamp(j["created"]).date() == today:
            n += 1
    return n
