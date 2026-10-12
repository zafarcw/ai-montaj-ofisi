"""Doimiy ASR ishchi jarayoni (CHAT-bosqich, ovozli kirish). `.venv/bin/python server/asr_worker.py`

Model bir marta yuklanadi (02_Assets/ASR — faqat oʻqish), keyin stdin'dan har qator JSON soʻrov:
  {"id": 1, "wav": "/abs/16k_mono.wav"}  →  stdout: {"id": 1, "text": "...", "words": [...], "ms": 123}
Dekoder mantiqi engine/asr_wave.py bilan bir xil (u CLI skript, import qilib boʻlmaydi — shu yerda takrorlangan).
20 s dan uzun yozuv eng jim joylaridan boʻlaklarga boʻlinadi.
"""
import json
import os
import sys
import time
import wave

import numpy as np
import onnxruntime as ort

_ROOT = os.environ.get("CLAUDE_ROOT") or os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
M = os.path.join(_ROOT, "02_Assets/ASR/sherpa-onnx-omnilingual-asr-1600-languages-1B-ctc-int8-2025-11-12") + "/"
CHUNK = 20.0   # s


def out(obj):
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


t0 = time.time()
try:
    toks = {}
    for line in open(M + "tokens.txt", encoding="utf-8"):
        line = line.rstrip("\n")
        if not line:
            continue
        p = line.rsplit(" ", 1)
        toks[int(p[1])] = p[0] if p[0] != "" else " "
    so = ort.SessionOptions()
    so.intra_op_num_threads = 4
    sess = ort.InferenceSession(M + "model.int8.onnx", so)
except Exception as e:  # noqa: BLE001
    out({"ready": False, "error": f"model yuklanmadi: {e}"})
    sys.exit(1)
out({"ready": True, "load_s": round(time.time() - t0, 2)})


def run(x):
    x = (x - x.mean()) / (x.std() + 1e-7)
    return sess.run(None, {"x": x[None].astype(np.float32)})[0][0]


def decode(lg, off, pad):
    ids = lg.argmax(-1)
    pr = np.exp(lg - lg.max(-1, keepdims=True))
    pr /= pr.sum(-1, keepdims=True)
    outl, prev = [], -1
    for t, i in enumerate(ids):
        if i != prev and i not in (0, 1, 2):
            outl.append((t * 0.02 - pad + off, int(i), float(pr[t, i])))
        prev = i
    words, cur = [], None
    for tm, i, c in outl:
        tk = toks.get(i, "?")
        if i == 4 or tk == " ":
            if cur:
                words.append(cur)
                cur = None
            continue
        if tk.startswith("▁"):
            if cur:
                words.append(cur)
            cur = {"w": tk[1:], "t0": round(tm, 3), "t1": round(tm + 0.02, 3), "c": [c]}
        elif cur is None:
            cur = {"w": tk, "t0": round(tm, 3), "t1": round(tm + 0.02, 3), "c": [c]}
        else:
            cur["w"] += tk
            cur["t1"] = round(tm + 0.02, 3)
            cur["c"].append(c)
    if cur:
        words.append(cur)
    for w_ in words:
        w_["conf"] = round(float(np.mean(w_.pop("c"))), 3)
    return words


def silence_cuts(x, sr):
    """20 s dan uzun boʻlsa: har CHUNK atrofida (±3 s) eng jim 0.3 s oynani topib kesish nuqtalari."""
    dur = len(x) / sr
    cuts, pos = [], CHUNK
    win = int(0.3 * sr)
    while pos < dur - 3:
        a, b = int((pos - 3) * sr), int((pos + 3) * sr)
        seg = x[a:b]
        if len(seg) <= win:
            cuts.append(pos)
        else:
            e = np.convolve(seg ** 2, np.ones(win) / win, mode="valid")
            cuts.append(round((a + int(np.argmin(e)) + win // 2) / sr, 2))
        pos = cuts[-1] + CHUNK
    return cuts


def transcribe(path):
    wf = wave.open(path)
    sr = wf.getframerate()
    x = np.frombuffer(wf.readframes(wf.getnframes()), np.int16).astype(np.float32) / 32768
    wf.close()
    if sr != 16000:
        raise ValueError(f"16 kHz kutilgan, {sr} keldi")
    cuts = [0.0] + silence_cuts(x, sr) + [len(x) / sr]
    allw, pad = [], 0.5
    for a, b in zip(cuts[:-1], cuts[1:]):
        seg = x[int(a * sr):int(b * sr)]
        if len(seg) < sr * 0.2:
            continue
        seg = np.concatenate([np.zeros(int(pad * sr), np.float32), seg, np.zeros(int(0.3 * sr), np.float32)])
        allw += decode(run(seg), a, pad)
    return allw


for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        req = json.loads(line)
        t = time.time()
        words = transcribe(req["wav"])
        out({"id": req.get("id"), "words": words, "text": " ".join(w["w"] for w in words), "ms": int((time.time() - t) * 1000)})
    except Exception as e:  # noqa: BLE001
        out({"id": (req or {}).get("id") if isinstance(req := locals().get("req"), dict) else None, "error": str(e)[:300]})
