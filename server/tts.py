"""Ovozli javob (TTS). Provayderlar: ElevenLabs (config.json → tts.elevenlabs_key, internet) yoki macOS `say` (offline).

- `say`: ovoz tiliga qarab oʻzbekcha matn transliteratsiya qilinadi (kirill ovozlar — ўзбек кирилл; turkcha — turk harflari),
  shunda ovoz «aksent bilan» boʻlsa ham oʻqiy oladi. aiff → bin/ffmpeg → m4a (AAC).
- Kesh: _cache/tts/<sha1>.m4a|mp3 (gitda yoʻq).
- ElevenLabs xatosida `say` ga qaytadi. Kalit hech qachon javobga chiqmaydi.
"""
import hashlib
import json
import re
import shutil
import subprocess
import threading
import urllib.request
from pathlib import Path

from server import store

SITE = store.SITE
CACHE = SITE / "_cache" / "tts"
_voices_cache = {"t": 0, "v": None}
_lock = threading.Lock()


def ffmpeg_path():
    p = SITE / "bin" / "ffmpeg"
    return str(p) if p.is_file() else shutil.which("ffmpeg")


# ---------- ovozlar roʻyxati ----------
def list_voices():
    with _lock:
        if _voices_cache["v"] is not None:
            return _voices_cache["v"]
        out, seen = [], set()
        try:
            r = subprocess.run(["say", "-v", "?"], capture_output=True, text=True, timeout=15)
            for line in r.stdout.splitlines():
                m = re.match(r"^(.+?)\s+([a-z]{2,3}_[A-Z0-9]{2,3})\s+#", line)
                if m:
                    name = re.sub(r"\s*\(\(null\)\)$", "", m.group(1).strip())   # TTY'siz chiqishda "Aru ((null))"
                    if name and name not in seen:
                        seen.add(name)
                        out.append({"name": name, "lang": m.group(2)})
        except Exception:
            pass
        _voices_cache["v"] = out
        return out


def find_voice(name):
    """Config'dagi nom (masalan "Yelda" yoki "Eddy (English (US))") → roʻyxatdagi yozuv yoki None."""
    if not name:
        return None
    for v in list_voices():
        if v["name"] == name:
            return v
    base = name.split(" (")[0]
    for v in list_voices():
        if v["name"].split(" (")[0] == base:
            return v
    return None


def _voice_lang(name):
    v = find_voice(name)
    return v["lang"] if v else "en_US"


# ---------- matn tayyorlash ----------
_EMOJI = re.compile("[\U0001F000-\U0001FAFF\U00002600-\U000027BF\U0001F900-\U0001F9FF‍️]")


def clean_text(s, limit=600):
    s = _EMOJI.sub("", s or "")
    s = re.sub(r"[*_`#>\[\]{}|~]", "", s)
    s = s.replace("«", "").replace("»", "").replace('"', "")
    s = re.sub(r"\s+", " ", s).strip()
    return s[:limit]


# oʻzbek lotin → oʻzbek kirill (TTS uchun; faqat kichik harflar bilan ishlaydi)
_DIGRAPHS = [("oʻ", "ў"), ("gʻ", "ғ"), ("sh", "ш"), ("ch", "ч"), ("yo", "ё"), ("yu", "ю"), ("ya", "я"), ("ts", "ц")]
_LETTERS = {"a": "а", "b": "б", "d": "д", "e": "е", "f": "ф", "g": "г", "h": "ҳ", "i": "и", "j": "ж", "k": "к", "l": "л",
            "m": "м", "n": "н", "o": "о", "p": "п", "q": "қ", "r": "р", "s": "с", "t": "т", "u": "у", "v": "в", "x": "х",
            "y": "й", "z": "з", "ʼ": "ъ", "c": "к", "w": "в"}


def to_cyrillic(s, voice_lang="ru"):
    s = s.lower().replace("'", "ʼ")
    s = re.sub(r"\be", "э", s)                       # soʻz boshidagi e → э
    for a, b in _DIGRAPHS:
        s = s.replace(a, b)
    s = "".join(_LETTERS.get(ch, ch) for ch in s)
    if voice_lang.startswith("kk"):                 # qozoq ovozi: қ ғ bor, ҳ→һ, ў→ұ
        s = s.replace("ҳ", "һ").replace("ў", "ұ")
    else:                                            # rus/ukrain/bolgar: faqat rus alifbosi
        s = s.replace("қ", "к").replace("ғ", "г").replace("ҳ", "х").replace("ў", "у")
    return s


def to_turkish(s):
    s = s.lower().replace("'", "")
    for a, b in [("oʻ", "ö"), ("gʻ", "ğ"), ("sh", "ş"), ("ch", "ç"), ("x", "h"), ("q", "k"), ("j", "c"), ("ʼ", ""), ("ʻ", "")]:
        s = s.replace(a, b)
    return s


def to_latin_plain(s):
    return s.replace("ʻ", "").replace("ʼ", "").replace("'", "")


def prepare_for_voice(text, voice_name):
    lang = _voice_lang(voice_name)
    base = lang.split("_")[0]
    if base in ("ru", "uk", "bg", "kk", "mk", "sr", "be"):
        return to_cyrillic(text, base)
    if base == "tr":
        return to_turkish(text)
    return to_latin_plain(text)


# ---------- provayderlar ----------
def _say(text, voice, rate, out_path):
    aiff = out_path.with_suffix(".aiff")
    cmd = ["say", "-v", voice, "-r", str(int(rate or 180)), "-o", str(aiff), text]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if r.returncode != 0 or not aiff.exists():
        raise RuntimeError("say xatosi: " + (r.stderr or "").strip()[:200])
    ff = ffmpeg_path()
    if ff:
        r2 = subprocess.run([ff, "-y", "-loglevel", "error", "-i", str(aiff), "-c:a", "aac", "-b:a", "64k", str(out_path)],
                            capture_output=True, text=True, timeout=60)
        aiff.unlink(missing_ok=True)
        if r2.returncode != 0 or not out_path.exists():
            raise RuntimeError("ffmpeg xatosi: " + (r2.stderr or "").strip()[:200])
        return out_path.read_bytes(), "audio/mp4"
    return aiff.read_bytes(), "audio/aiff"


def _elevenlabs(text, key, voice_id, model):
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_96"
    body = json.dumps({"text": text, "model_id": model or "eleven_multilingual_v2",
                       "voice_settings": {"stability": 0.45, "similarity_boost": 0.8, "style": 0.35}}).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST",
                                 headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg"})
    with urllib.request.urlopen(req, timeout=25) as resp:
        data = resp.read()
    if not data or len(data) < 200:
        raise RuntimeError("ElevenLabs boʻsh javob")
    return data, "audio/mpeg"


def synth(agent_id, text, cfg=None):
    """→ (bytes, mime, provider). ElevenLabs xatosida `say`."""
    cfg = cfg or store.load_config()
    tts = cfg.get("tts", {})
    voices = tts.get("voices", {})
    v = voices.get(agent_id) or next(iter(voices.values()), {}) or {}
    text = clean_text(text)
    if not text:
        raise ValueError("matn boʻsh")
    CACHE.mkdir(parents=True, exist_ok=True)
    key = (tts.get("elevenlabs_key") or "").strip()
    provider = tts.get("provider", "auto")
    use_eleven = bool(key) and provider in ("auto", "elevenlabs") and v.get("eleven")
    if use_eleven:
        h = hashlib.sha1(f"eleven|{v.get('eleven')}|{tts.get('elevenlabs_model')}|{text}".encode("utf-8")).hexdigest()
        p = CACHE / f"{h}.mp3"
        if p.exists():
            return p.read_bytes(), "audio/mpeg", "elevenlabs"
        try:
            data, mime = _elevenlabs(text, key, v["eleven"], tts.get("elevenlabs_model"))
            p.write_bytes(data)
            return data, mime, "elevenlabs"
        except Exception as e:  # noqa: BLE001 — `say` ga qaytamiz
            fallback_note = str(e)[:120]
    else:
        fallback_note = None
    voice = v.get("say") or "Milena"
    if not find_voice(voice):
        voice = next((x["name"] for x in list_voices() if x["lang"].startswith("ru")), (list_voices() or [{"name": "Samantha"}])[0]["name"])
    spoken = prepare_for_voice(text, voice)
    h = hashlib.sha1(f"say|{voice}|{v.get('rate')}|{spoken}".encode("utf-8")).hexdigest()
    p = CACHE / f"{h}.m4a"
    if p.exists():
        return p.read_bytes(), "audio/mp4", "say" + (f" (ElevenLabs xato: {fallback_note})" if fallback_note else "")
    data, mime = _say(spoken, voice, v.get("rate", 180), p)
    return data, mime, "say" + (f" (ElevenLabs xato: {fallback_note})" if fallback_note else "")
