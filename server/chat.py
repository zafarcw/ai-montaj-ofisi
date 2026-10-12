"""Xodim bilan chat (CHAT-bosqich) — `claude -p` ni alohida kichik jarayonda chaqiradi.

- Montaj navbatidan (runner) toʻliq mustaqil: oʻz lock'i, oʻz jarayoni, tool yoʻq (`--tools ""`), `--system-prompt` persona.
- Bir vaqtda 1 chat soʻrovi; timeout 60 s. Model: config.json → chat.model (standart haiku).
- Tarix: chat/<agent>.jsonl (gitda yoʻq), promptga oxirgi N (chat.history) xabar kiradi.
- Kontekst: eng oxirgi ishning holati (oxirgi 5 hodisa) — hazillar haqiqiy ishga bogʻliq boʻlsin; xodim band boʻlsa qisqa javob.
"""
import json
import re
import subprocess
import threading
import time
from pathlib import Path

from server import store
from runner import runner as runner_mod

SITE = store.SITE
CHAT_DIR = SITE / "chat"
PERSONA_PATH = SITE / "runner" / "personalar.json"
TIMEOUT = 60
BUSY_WINDOW = 180          # s: oxirgi "working" hodisa shundan yangi boʻlsa xodim band

_lock = threading.Lock()   # bir vaqtda bitta chat


class ChatBusy(Exception):
    """Boshqa suhbat hali tugamagan."""


# ---------- matn ----------
_APOS = "['‘’ʼ`´]"


def norm_uz(s):
    """oʻ/gʻ (va bosh harflari) uchun U+02BB; boshqa apostroflar ʼ (U+02BC)."""
    if not s:
        return s
    s = re.sub("([oOgG])" + _APOS, lambda m: m.group(1) + "ʻ", s)
    s = re.sub(_APOS, "ʼ", s)
    return s


def _clean_reply(s):
    s = (s or "").strip()
    s = re.sub(r"^\*+|\*+$", "", s)
    s = re.sub(r"^[A-Za-zʻʼ' ]{2,24}:\s+", "", s)   # "Rangchi: ..." prefiksini olib tashla
    s = re.sub(r"\s+", " ", s).strip().strip('"«»')
    return norm_uz(s)


# ---------- personalar ----------
def load_personas():
    try:
        return json.loads(PERSONA_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {"umumiy": "Sen {ism} ismli xodimsan ({rol}). Oʻzbekcha, qisqa javob ber.", "roast": "", "yumshoq": "", "band": "", "xodimlar": {}}


def save_personas(data):
    cur = load_personas()
    for k in ("umumiy", "roast", "yumshoq", "band"):
        if isinstance(data.get(k), str):
            cur[k] = data[k]
    if isinstance(data.get("xodimlar"), dict):
        cur.setdefault("xodimlar", {}).update({k: v for k, v in data["xodimlar"].items() if isinstance(v, str)})
    PERSONA_PATH.write_text(json.dumps(cur, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return cur


# ---------- tarix ----------
def _hist_path(agent):
    CHAT_DIR.mkdir(exist_ok=True)
    return CHAT_DIR / (store.slug(agent, 32) + ".jsonl")


def history(agent, n=30):
    p = _hist_path(agent)
    if not p.exists():
        return []
    out = []
    for line in p.read_text(encoding="utf-8", errors="replace").splitlines()[-n:]:
        try:
            out.append(json.loads(line))
        except Exception:
            pass
    return out


def _append(agent, role, text, **extra):
    rec = {"ts": round(time.time(), 3), "role": role, "text": text, **extra}
    with open(_hist_path(agent), "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    return rec


def clear_history(agent):
    p = _hist_path(agent)
    if p.exists():
        p.unlink()


# ---------- ish konteksti ----------
def job_context():
    """Eng oxirgi (yangilangan) ish: holat, oxirgi 5 muhim hodisa, band xodimlar."""
    try:
        jobs = sorted(store.list_jobs(), key=lambda j: j.get("updated") or 0, reverse=True)
    except Exception:
        jobs = []
    if not jobs:
        return {"job": None, "events": [], "busy": {}}
    job = jobs[0]
    evs, _ = store.read_events(job["id"], limit=60)
    now = time.time()
    busy = {}
    for e in evs:
        a = e.get("agent")
        if a and e.get("state"):
            busy[a] = (e.get("state") == "working" and now - (e.get("ts") or 0) < BUSY_WINDOW, e.get("text") or "")
    shown = [e for e in evs if e.get("type") in ("status", "decision", "render", "final", "edl", "metric") or e.get("state") in ("working", "done", "error")]
    return {"job": job, "events": shown[-5:], "busy": busy if job.get("status") == "running" else {}}


def _ctx_text(ctx):
    job = ctx["job"]
    if not job:
        return "Ofisda hozir faol ish yoʻq, hamma boʻsh."
    lines = [f"Joriy ish: «{job.get('client') or 'mijoz'} — {job.get('topic') or job.get('title') or job.get('id')}», holati: {job.get('status')}."]
    for e in ctx["events"]:
        who = e.get("agent") or e.get("type")
        txt = (e.get("text") or "")[:90]
        if txt:
            lines.append(f"- {who}: {txt}")
    return "\n".join(lines)


# ---------- prompt ----------
def _agent_cfg(agent_id, cfg):
    for a in cfg.get("agents", []):
        if a.get("id") == agent_id:
            return a
    return {"id": agent_id, "name": agent_id.capitalize(), "role": ""}


def build_system(agent_id, cfg, personas, mode, busy_text, ctx):
    a = _agent_cfg(agent_id, cfg)
    xar = personas.get("xodimlar", {}).get(agent_id, "Hazilkash ofis xodimi.")
    fill = lambda s: (s or "").replace("{ism}", a.get("name", agent_id)).replace("{rol}", a.get("role", "")).replace("{xarakter}", xar)  # noqa: E731
    parts = [fill(personas.get("umumiy", "")), fill(personas.get("roast" if mode == "roast" else "yumshoq", ""))]
    if busy_text is not None:
        parts.append(fill(personas.get("band", "")).replace("{vazifa}", busy_text or "montaj"))
    parts.append("OFIS HOLATI (hazilda ishlatishing mumkin):\n" + _ctx_text(ctx))
    return "\n\n".join(p for p in parts if p.strip())


def build_prompt(name, hist, text):
    lines = []
    for h in hist:
        lines.append(("Zafar: " if h.get("role") == "user" else f"{name}: ") + (h.get("text") or "").strip())
    lines.append("Zafar: " + text.strip())
    lines.append(f"{name}:")
    return "Suhbat davomi. Faqat oxirgi qatorga {0}ning javobini yoz (1–3 gap).\n\n".format(name) + "\n".join(lines)


# ---------- asosiy ----------
def ask(agent_id, text):
    text = norm_uz((text or "").strip())
    if not text:
        raise ValueError("matn boʻsh")
    if not _lock.acquire(blocking=False):
        raise ChatBusy("boshqa suhbat hali tugamagan")
    try:
        cfg = store.load_config()
        chat_cfg = cfg.get("chat", {})
        personas = load_personas()
        mode = "roast" if chat_cfg.get("mode", "roast") == "roast" and chat_cfg.get("roast_ok") else "soft"
        ctx = job_context()
        is_busy, busy_text = ctx["busy"].get(agent_id, (False, ""))
        a = _agent_cfg(agent_id, cfg)
        system = build_system(agent_id, cfg, personas, mode, busy_text if is_busy else None, ctx)
        hist = history(agent_id, int(chat_cfg.get("history") or 8))
        prompt = build_prompt(a.get("name", agent_id), hist, text)
        binp = runner_mod.find_claude(cfg)
        if not binp:
            raise RuntimeError("Claude Code CLI topilmadi")
        cmd = [binp, "-p", prompt, "--model", chat_cfg.get("model") or "haiku", "--tools", "",
               "--output-format", "json", "--no-session-persistence", "--strict-mcp-config", "--setting-sources", "",
               "--system-prompt", system]
        CHAT_DIR.mkdir(exist_ok=True)
        t0 = time.time()
        try:
            r = subprocess.run(cmd, cwd=str(CHAT_DIR), env=runner_mod.session_env(), capture_output=True, text=True,
                               encoding="utf-8", errors="replace", timeout=TIMEOUT, stdin=subprocess.DEVNULL)
        except subprocess.TimeoutExpired:
            raise TimeoutError(f"javob {TIMEOUT} s ichida kelmadi")
        res = None
        for line in (r.stdout or "").splitlines():
            line = line.strip()
            if line.startswith("{"):
                try:
                    d = json.loads(line)
                    if d.get("type") == "result":
                        res = d
                except Exception:
                    pass
        if res is None:
            raise RuntimeError("claude javob bermadi: " + ((r.stderr or r.stdout or "").strip()[-300:] or f"rc={r.returncode}"))
        if res.get("is_error"):
            raise RuntimeError("claude xatosi: " + str(res.get("result") or res.get("subtype"))[:300])
        reply = _clean_reply(res.get("result") or "")
        u = res.get("usage") or {}
        usage = {"in": int(u.get("input_tokens") or 0) + int(u.get("cache_read_input_tokens") or 0) + int(u.get("cache_creation_input_tokens") or 0),
                 "out": int(u.get("output_tokens") or 0), "cost": res.get("total_cost_usd")}
        _append(agent_id, "user", text)
        rec = _append(agent_id, "assistant", reply, usage=usage, mode=mode, busy=bool(is_busy), ms=int((time.time() - t0) * 1000))
        return {"agent": agent_id, "name": a.get("name"), "text": reply, "usage": usage, "mode": mode, "busy": bool(is_busy), "ms": rec["ms"], "ts": rec["ts"]}
    finally:
        _lock.release()
