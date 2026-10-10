#!/usr/bin/env python3
"""Runner sinovi uchun soxta `claude` (FAQAT _tekshiruv/ da, saytda ishlatilmaydi).
stream-json shaklida chiqish beradi va haqiqiy progress.py ni chaqiradi.
Bayroqlar: -p <prompt> --session-id <id> | --resume <id> ... """
import json
import os
import shutil
import subprocess
import sys
import time

args = sys.argv[1:]
if args[:1] == ["--version"]:
    print("9.9.9 (mock)"); sys.exit(0)
if args[:2] == ["auth", "status"]:
    print(json.dumps({"loggedIn": True, "authMethod": "mock"})); sys.exit(0)


def get(flag, default=None):
    return args[args.index(flag) + 1] if flag in args else default


prompt = get("-p", "")
sid = get("--session-id") or get("--resume") or "mock-session"
resume = "--resume" in args
site = os.environ.get("OFIS_SITE")
root = os.environ.get("CLAUDE_ROOT")
jid = None
for line in prompt.splitlines():
    if line.startswith("Ish ID:"):
        jid = line.split("`")[1]
if not jid:
    # tuzatish prompti: jobs/<id>/ yo'lidan topamiz
    import re
    m = re.search(r"jobs/([^/\s`]+)/", prompt)
    jid = m.group(1) if m else None


def emit(o):
    sys.stdout.write(json.dumps(o, ensure_ascii=False) + "\n"); sys.stdout.flush()


def tool(name, inp):
    emit({"type": "assistant", "message": {"content": [{"type": "tool_use", "id": "t%d" % time.time_ns(), "name": name, "input": inp}]}, "session_id": sid})


def prog(*a):
    cmd = [sys.executable, os.path.join(site, "progress.py"), "--job", jid] + list(a)
    tool("Bash", {"command": " ".join(cmd)})
    subprocess.run(cmd, check=True)
    time.sleep(0.4)


emit({"type": "system", "subtype": "init", "session_id": sid, "model": get("--model", "mock"), "tools": ["Bash", "Read"]})
emit({"type": "assistant", "message": {"content": [{"type": "text", "text": "Ishni boshlayapman (mock)."}]}, "session_id": sid})
tool("Read", {"file_path": os.path.join(root, "00_Qoidalar/CLAUDE_XOTIRA.md")})
time.sleep(0.5)
if not resume:
    prog("--agent", "rejissyor", "--state", "working", "--text", "Talab va mijoz kartasi", "--pct", "20")
    prog("--agent", "rejissyor", "--state", "done", "--text", "Reja: 3 sahna", "--metric", "sahnalar=3", "--handoff", "ovozchi")
    prog("--agent", "ovozchi", "--state", "working", "--text", "ffprobe + ASR", "--pct", "40")
    for i in range(6):
        time.sleep(1.0)
        prog("--agent", "ovozchi", "--state", "working", "--text", f"ASR bo'lak {i+1}/6", "--pct", str(40 + i * 10))
    prog("--agent", "ovozchi", "--state", "done", "--text", "So'zlar tayyor", "--metric", "sozlar=57", "--handoff", "montajchi")
    prog("--agent", "montajchi", "--state", "done", "--text", "EDL 2 kesim", "--metric", "kesimlar=2", "--handoff", "rangchi")
else:
    prog("--agent", "rejissyor", "--state", "working", "--text", "Tuzatish o'qildi", "--type", "decision")
# yakuniy fayl (sinov: manbani nusxalash)
job = json.load(open(os.path.join(site, "jobs", jid, "job.json")))
v = len(job.get("versions", [])) + 1
out = os.path.join(root, "04_Tayyor_videolar", f"2026-10-10_Mock_Sinov_v{v}.mp4")
shutil.copy(job["sources"][0], out)
tool("Bash", {"command": f"ffmpeg -i ... {out}"})
prog("--agent", "rangchi", "--state", "done", "--text", "Render tugadi", "--type", "render", "--pct", "100")
prog("--agent", "rejissyor", "--state", "done", "--type", "final", "--file", out, "--metric", "davomiylik=6", "--metric", "lufs=-15.1", "--text", f"v{v} tayyor")
emit({"type": "result", "subtype": "success", "is_error": False, "duration_ms": 9000, "num_turns": 12, "result": "Tayyor (mock)", "session_id": sid})
