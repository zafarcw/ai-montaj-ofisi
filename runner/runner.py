"""Headless Claude Code sessiyasini boshqaruvchi runner.

- Navbat: bir vaqtda bitta ish (`current`), qolganlari FIFO navbatda.
- Yangi ish: `claude -p <prompt> --output-format stream-json --verbose --session-id <uuid> ...`
- Tuzatish: o'sha sessiya `--resume <session_id>` bilan davom ettiriladi → keyingi versiya.
- Bekor qilish: butun jarayon guruhiga SIGTERM (keyin SIGKILL).
- Sessiyaning xom stream-json chiqishi `jobs/<id>/claude.jsonl` ga, stderr `jobs/<id>/claude.stderr.log` ga yoziladi.
- tool_use / text / result hodisalari `events.jsonl` ga `type: tool|status` sifatida qo'shiladi (Jurnal paneli).
"""
import json
import os
import shutil
import signal
import subprocess
import sys
import threading
import time
import uuid
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SITE))
from server import store  # noqa: E402
from runner.prompt import build_job_prompt, build_fix_prompt, rules_text  # noqa: E402

ROOT = store.ROOT

# --- ruxsatlar -------------------------------------------------------------
# Deny ustun turadi. ROOT/00,01,02,03,06 ga Edit/Write yo'q; 04 ga faqat ffmpeg yozadi (Bash orqali).
ALLOWED_TOOLS = [
    "Read", "Glob", "Grep", "Edit", "Write", "MultiEdit", "TodoWrite", "Task",
    "Bash(ffmpeg *)", "Bash(ffprobe *)", "Bash(python3 *)", "Bash(python *)",
    f"Bash({SITE}/.venv/bin/python *)", f"Bash({SITE}/bin/ffmpeg *)", f"Bash({SITE}/bin/ffprobe *)",
    "Bash(mkdir *)", "Bash(ls *)", "Bash(cp *)", "Bash(mv *)", "Bash(tar *)", "Bash(cat *)",
    "Bash(head *)", "Bash(tail *)", "Bash(wc *)", "Bash(du *)", "Bash(find *)", "Bash(md5 *)",
    "Bash(md5sum *)", "Bash(shasum *)", "Bash(stat *)", "Bash(echo *)", "Bash(cd *)", "Bash(sleep *)",
    "Bash(file *)", "Bash(which *)", "Bash(printf *)", "Bash(test *)", "Bash(true)", "Bash(date *)",
    "Bash(gzip *)", "Bash(gunzip *)", "Bash(unzip *)", "Bash(zip *)", "Bash(sort *)", "Bash(uniq *)",
    "Bash(grep *)", "Bash(awk *)", "Bash(sed *)", "Bash(tr *)", "Bash(cut *)", "Bash(nproc *)",
    "Bash(sysctl *)", "Bash(xargs *)", "Bash(touch *)", "Bash(basename *)", "Bash(dirname *)",
    "Bash(realpath *)", "Bash(pwd)", "Bash(seq *)", "Bash(bc *)", "Bash(jq *)", "Bash(timeout *)",
    "Bash(nohup *)", "Bash(kill *)", "Bash(wait *)", "Bash(export *)", "Bash(env *)", "Bash(tee *)",
    "Bash(diff *)", "Bash(cmp *)", "Bash(tree *)", "Bash(ps *)", "Bash(pgrep *)", "Bash(sips *)",
    "Bash(afinfo *)", "Bash(mdls *)", "Bash(ditto *)", "Bash(uname *)", "Bash(sw_vers *)",
]
DISALLOWED_TOOLS = [
    "Bash(rm *)", "Bash(rm -rf *)", "Bash(rmdir *)", "Bash(sudo *)", "Bash(su *)", "Bash(brew *)",
    "Bash(pip *)", "Bash(pip3 *)", "Bash(uv *)", "Bash(npm *)", "Bash(npx *)", "Bash(curl *)",
    "Bash(wget *)", "Bash(git *)", "Bash(open *)", "Bash(osascript *)", "Bash(chmod *)",
    "Bash(chown *)", "Bash(ln *)", "Bash(dd *)", "Bash(diskutil *)", "Bash(killall *)",
    "Bash(launchctl *)", "Bash(defaults *)", "Bash(ssh *)", "Bash(scp *)", "Bash(rsync *)",
    "Bash(claude *)",
    "WebFetch", "WebSearch", "NotebookEdit",
    "Edit(00_Qoidalar/**)", "Write(00_Qoidalar/**)",
    "Edit(01_Kiruvchi/**)", "Write(01_Kiruvchi/**)",
    "Edit(02_Assets/**)", "Write(02_Assets/**)",
    "Edit(03_Loyihalar/**)", "Write(03_Loyihalar/**)",
    "Edit(06_Referenslar/**)", "Write(06_Referenslar/**)",
    "Edit(04_Tayyor_videolar/**)", "Write(04_Tayyor_videolar/**)",
    "Edit(07_AI_Ofis_Sayt/server/**)", "Write(07_AI_Ofis_Sayt/server/**)",
    "Edit(07_AI_Ofis_Sayt/web/**)", "Write(07_AI_Ofis_Sayt/web/**)",
    "Edit(07_AI_Ofis_Sayt/runner/**)", "Write(07_AI_Ofis_Sayt/runner/**)",
    "Edit(07_AI_Ofis_Sayt/engine/**)", "Write(07_AI_Ofis_Sayt/engine/**)",
    "Edit(07_AI_Ofis_Sayt/engines/**)", "Write(07_AI_Ofis_Sayt/engines/**)",
    "Edit(07_AI_Ofis_Sayt/progress.py)", "Write(07_AI_Ofis_Sayt/progress.py)",
    "Edit(07_AI_Ofis_Sayt/config.json)", "Write(07_AI_Ofis_Sayt/config.json)",
]
PERMISSION_MODE = "acceptEdits"   # Edit/Write avto; Bash faqat allow ro'yxatidan; so'rov bo'lsa → rad (prompts none)


def find_claude(cfg=None):
    cfg = cfg or store.load_config()
    cands = []
    if cfg.get("claude_bin"):
        cands.append(cfg["claude_bin"])
    cands += [os.path.expanduser("~/.local/bin/claude"), os.path.expanduser("~/.claude/local/claude"),
              "/opt/homebrew/bin/claude", "/usr/local/bin/claude"]
    w = shutil.which("claude")
    if w:
        cands.append(w)
    for c in cands:
        if c and os.path.isfile(c) and os.access(c, os.X_OK):
            return c
    return None


_auth_cache = {"t": 0, "v": None}


def claude_status(force=False):
    """`claude auth status` natijasi (60 s kesh)."""
    now = time.time()
    if not force and _auth_cache["v"] and now - _auth_cache["t"] < 60:
        return _auth_cache["v"]
    binp = find_claude()
    info = {"found": bool(binp), "path": binp, "logged_in": None, "version": None, "error": None}
    if binp:
        try:
            v = subprocess.run([binp, "--version"], capture_output=True, text=True, timeout=20)
            info["version"] = (v.stdout or v.stderr).strip()[:60]
            a = subprocess.run([binp, "auth", "status"], capture_output=True, text=True, timeout=30)
            txt = a.stdout.strip() or a.stderr.strip()
            try:
                j = json.loads(txt)
                info["logged_in"] = bool(j.get("loggedIn"))
                info["auth"] = j.get("authMethod")
            except Exception:
                info["logged_in"] = ("loggedIn\": true" in txt) or ("Logged in" in txt)
                info["raw"] = txt[:200]
        except Exception as e:  # noqa: BLE001
            info["error"] = str(e)[:200]
    _auth_cache.update(t=now, v=info)
    return info


def session_env():
    env = dict(os.environ)
    paths = [str(SITE / ".venv" / "bin"), str(SITE / "bin"), os.path.expanduser("~/.local/bin"),
             "/opt/homebrew/bin", "/usr/local/bin"]
    env["PATH"] = ":".join(paths + [env.get("PATH", "/usr/bin:/bin")])
    env["CLAUDE_ROOT"] = str(ROOT)
    env["OFIS_SITE"] = str(SITE)
    env["PYTHONUNBUFFERED"] = "1"
    env.pop("CLAUDECODE", None)       # ichki sessiya belgisi bo'lsa — olib tashlaymiz
    env.pop("CLAUDE_CODE_ENTRYPOINT", None)
    return env


class Runner:
    def __init__(self):
        self.lock = threading.RLock()
        self.queue = []          # [(job_id, mode, payload)]
        self.current = None      # job_id
        self.proc = None
        self.worker = threading.Thread(target=self._loop, daemon=True, name="runner")
        self.worker.start()

    # ---- ommaviy API ----
    def enqueue(self, job_id, mode="new", payload=None):
        with self.lock:
            job = store.load_job(job_id)
            if not job:
                raise ValueError("ish topilmadi")
            if any(q[0] == job_id for q in self.queue) or self.current == job_id:
                raise ValueError("bu ish allaqachon navbatda yoki ishlayapti")
            if mode == "new" and not job.get("sources"):
                raise ValueError("manba fayl tanlanmagan")
            self.queue.append((job_id, mode, payload or {}))
            store.update_job(job_id, status="queued")
            store.append_event(job_id, {"type": "status", "status": "queued",
                                        "text": f"Navbatga qo'yildi ({len(self.queue)}-o'rin)" if len(self.queue) > 1 else "Navbatga qo'yildi"})
            return len(self.queue)

    def cancel(self, job_id):
        with self.lock:
            for i, q in enumerate(self.queue):
                if q[0] == job_id:
                    self.queue.pop(i)
                    store.update_job(job_id, status="cancelled")
                    store.append_event(job_id, {"type": "status", "status": "cancelled", "text": "Navbatdan olib tashlandi"})
                    return True
            if self.current == job_id and self.proc and self.proc.poll() is None:
                store.update_job(job_id, status="cancelled")
                store.append_event(job_id, {"type": "status", "status": "cancelling", "text": "Bekor qilinmoqda…"})
                threading.Thread(target=self._kill, args=(self.proc,), daemon=True).start()
                return True
        return False

    def queue_info(self):
        with self.lock:
            return {"running": self.current, "queue": [q[0] for q in self.queue]}

    # ---- ichki ----
    def _kill(self, proc):
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
        except Exception:
            pass
        for _ in range(30):
            if proc.poll() is not None:
                return
            time.sleep(0.2)
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
        except Exception:
            pass

    def _loop(self):
        while True:
            item = None
            with self.lock:
                if self.current is None and self.queue:
                    item = self.queue.pop(0)
                    self.current = item[0]
            if not item:
                time.sleep(0.5)
                continue
            job_id, mode, payload = item
            try:
                self._run(job_id, mode, payload)
            except Exception as e:  # noqa: BLE001
                store.update_job(job_id, status="error")
                store.append_event(job_id, {"type": "status", "status": "error", "text": f"Runner xatosi: {e}"})
            finally:
                with self.lock:
                    self.current = None
                    self.proc = None

    def _build_cmd(self, binp, job, mode, payload):
        cfg = store.load_config()
        model = job.get("model") or cfg["model"]
        effort = job.get("effort") or cfg["effort"]
        common = ["--output-format", "stream-json", "--verbose",
                  "--model", model, "--effort", effort,
                  "--permission-mode", PERMISSION_MODE, "--permission-prompts", "none",
                  "--name", f"montaj-{job['id'][:40]}",
                  "--allowedTools", *ALLOWED_TOOLS,
                  "--disallowedTools", *DISALLOWED_TOOLS]
        if mode == "fix":
            prompt = build_fix_prompt(job, payload.get("text", ""), payload.get("version"))
            cmd = [binp, "-p", prompt, "--resume", job["session_id"]] + common
        else:
            sid = job.get("session_id") or str(uuid.uuid4())
            store.update_job(job["id"], session_id=sid)
            prompt = build_job_prompt(job)
            cmd = [binp, "-p", prompt, "--session-id", sid, "--append-system-prompt", rules_text()] + common
        return cmd, prompt

    def _run(self, job_id, mode, payload):
        job = store.load_job(job_id)
        d = store.job_dir(job_id)
        binp = find_claude()
        if not binp:
            store.update_job(job_id, status="error")
            store.append_event(job_id, {"type": "status", "status": "error",
                                        "text": "Claude Code CLI topilmadi (~/.local/bin/claude). README'ga qarang."})
            return
        st = claude_status()
        if st.get("logged_in") is False:
            store.update_job(job_id, status="error")
            store.append_event(job_id, {"type": "status", "status": "error",
                                        "text": "Claude Code login qilinmagan: Terminal'da `claude` ni ochib login qiling, keyin qayta boshlang."})
            return
        Path(job.get("tmp_dir") or store.TMP_DIR / f"_job_{job_id}").mkdir(parents=True, exist_ok=True)
        (d / "kod").mkdir(exist_ok=True)
        cmd, prompt = self._build_cmd(binp, job, mode, payload)
        (d / ("prompt_fix.txt" if mode == "fix" else "prompt.txt")).write_text(prompt, encoding="utf-8")
        (d / "cmd.json").write_text(json.dumps(cmd, ensure_ascii=False, indent=1), encoding="utf-8")
        job = store.load_job(job_id)
        (d / "session_id").write_text(job.get("session_id", ""), encoding="utf-8")
        run = {"mode": mode, "started": time.time(), "ended": None, "rc": None, "result": None,
               "model": job.get("model"), "effort": job.get("effort")}
        job.setdefault("runs", []).append(run)
        job["status"] = "running"
        store.save_job(job)
        store.append_event(job_id, {"type": "status", "status": "running",
                                    "text": ("Tuzatish sessiyasi davom etmoqda" if mode == "fix" else "Montaj sessiyasi boshlandi"),
                                    "model": job.get("model"), "effort": job.get("effort"), "mode": mode})

        log = open(d / "claude.jsonl", "a", encoding="utf-8")
        err = open(d / "claude.stderr.log", "a", encoding="utf-8")
        try:
            proc = subprocess.Popen(cmd, cwd=str(ROOT), stdout=subprocess.PIPE, stderr=err,
                                    stdin=subprocess.DEVNULL, env=session_env(),
                                    start_new_session=True, text=True, encoding="utf-8", errors="replace",
                                    bufsize=1)
        except Exception as e:  # noqa: BLE001
            log.close(); err.close()
            store.update_job(job_id, status="error")
            store.append_event(job_id, {"type": "status", "status": "error", "text": f"claude ishga tushmadi: {e}"})
            return
        with self.lock:
            self.proc = proc
        result = None
        n_tools = 0
        try:
            for line in proc.stdout:
                log.write(line)
                log.flush()
                line = line.strip()
                if not line:
                    continue
                try:
                    msg = json.loads(line)
                except Exception:
                    continue
                r = self._on_message(job_id, msg)
                if r is not None:
                    result = r
                if msg.get("type") == "assistant":
                    n_tools += 1
        finally:
            rc = proc.wait()
            log.close(); err.close()

        job = store.load_job(job_id)
        run = job["runs"][-1]
        run.update(ended=time.time(), rc=rc, result=(result or {}).get("subtype"))
        evs, _ = store.read_events(job_id)
        finals = [e for e in evs if e.get("type") == "final" and e.get("ts", 0) >= run["started"]]
        cancelled = job.get("status") == "cancelled" or (rc in (-15, -9, 143, 137) and not finals)
        if cancelled:
            job["status"] = "cancelled"
            store.save_job(job)
            store.append_event(job_id, {"type": "status", "status": "cancelled", "text": "Ish bekor qilindi"})
            return
        if finals:
            fin = finals[-1]
            v = store.next_version(job)
            job["versions"].append({"v": v, "path": fin.get("file"), "ts": fin.get("ts"),
                                    "metrics": fin.get("metrics", {}), "text": fin.get("text", "")})
            job["status"] = "done"
            store.save_job(job)
            store.append_event(job_id, {"type": "status", "status": "done", "version": v,
                                        "text": f"v{v} tayyor" + (f" — {os.path.basename(fin.get('file') or '')}" if fin.get("file") else ""),
                                        "result": (result or {}).get("result", "")[:2000]})
        else:
            job["status"] = "error" if rc != 0 or (result or {}).get("is_error") else "error"
            store.save_job(job)
            txt = (result or {}).get("result") or f"Sessiya tugadi (rc={rc}), lekin --type final hodisasi kelmadi"
            store.append_event(job_id, {"type": "status", "status": "error",
                                        "text": "Final hodisa kelmadi: " + str(txt)[:1500], "rc": rc})

    def _on_message(self, job_id, msg):
        t = msg.get("type")
        if t == "system" and msg.get("subtype") == "init":
            store.append_event(job_id, {"type": "tool", "name": "init",
                                        "text": f"Sessiya ochildi · model {msg.get('model', '?')} · {len(msg.get('tools', []))} ta tool",
                                        "session_id": msg.get("session_id")})
            if msg.get("session_id"):
                job = store.load_job(job_id)
                if job and job.get("session_id") != msg["session_id"]:
                    store.update_job(job_id, session_id=msg["session_id"])
            return None
        if t == "assistant":
            content = (msg.get("message") or {}).get("content") or []
            for blk in content:
                bt = blk.get("type")
                if bt == "tool_use":
                    name = blk.get("name", "?")
                    inp = blk.get("input") or {}
                    if name == "Bash":
                        summ = str(inp.get("command", ""))[:400]
                    elif name in ("Read", "Edit", "Write", "MultiEdit"):
                        summ = str(inp.get("file_path", ""))
                    elif name in ("Glob", "Grep"):
                        summ = str(inp.get("pattern", "")) + (" · " + str(inp.get("path")) if inp.get("path") else "")
                    else:
                        summ = json.dumps(inp, ensure_ascii=False)[:300]
                    store.append_event(job_id, {"type": "tool", "name": name, "text": summ, "id": blk.get("id")})
                elif bt == "text" and blk.get("text", "").strip():
                    store.append_event(job_id, {"type": "tool", "name": "matn", "text": blk["text"].strip()[:1500]})
            return None
        if t == "result":
            info = {"subtype": msg.get("subtype"), "result": msg.get("result"), "is_error": msg.get("is_error"),
                    "duration_ms": msg.get("duration_ms"), "num_turns": msg.get("num_turns"),
                    "total_cost_usd": msg.get("total_cost_usd")}
            store.append_event(job_id, {"type": "tool", "name": "result",
                                        "text": f"{info['subtype']} · {info.get('num_turns')} qadam · "
                                                f"{round((info.get('duration_ms') or 0) / 60000, 1)} daq"})
            return info
        return None


RUNNER = None


def get_runner():
    global RUNNER
    if RUNNER is None:
        RUNNER = Runner()
    return RUNNER
