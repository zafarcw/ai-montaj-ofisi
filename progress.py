#!/usr/bin/env python3
"""AI Montaj Ofisi — progress protokoli.

Montaj sessiyasi har qadamda shu skriptni chaqiradi; hodisa `jobs/<id>/events.jsonl` ga
yoziladi va server uni SSE orqali sahifaga uzatadi.

    python3 07_AI_Ofis_Sayt/progress.py --job <id> --agent <rol> --state <idle|working|done|error> \
        --text "..." [--pct N] [--metric kalit=qiymat ...] [--handoff <rol>] [--image <yo'l>] \
        [--file <yo'l>] [--edl <edl.json>] [--type step|edl|render|final|decision|tool]

Rollar: rejissyor, ovozchi, montajchi, motion, rangchi (o'zbekcha nomlar ham qabul qilinadi).

ffmpeg render progressi (haqiqiy kadr hisoblagich):
    ffmpeg ... -progress pipe:1 -nostats ... | \
        python3 07_AI_Ofis_Sayt/progress.py --job <id> --agent rangchi --ffmpeg-progress --total-frames 3237 --text "Yakuniy render"
"""
import argparse
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
JOBS = os.path.join(HERE, "jobs")

AGENT_ALIASES = {
    "rejissyor": "rejissyor", "rejissor": "rejissyor", "director": "rejissyor",
    "ovozchi": "ovozchi", "audio": "ovozchi", "ovoz": "ovozchi",
    "montajchi": "montajchi", "montaj": "montajchi", "editor": "montajchi",
    "motion": "motion", "motion dizayner": "motion", "motion-dizayner": "motion", "grafika": "motion",
    "rangchi": "rangchi", "rang": "rangchi", "colorist": "rangchi", "grade": "rangchi",
}
STATES = ("idle", "working", "done", "error")
TYPES = ("step", "edl", "render", "final", "decision", "tool", "status")


def norm_agent(a):
    if not a:
        return None
    k = a.strip().lower()
    return AGENT_ALIASES.get(k, k)


def parse_metric(s):
    if "=" not in s:
        raise argparse.ArgumentTypeError(f"metric 'kalit=qiymat' shaklida bo'lsin: {s}")
    k, v = s.split("=", 1)
    v = v.strip()
    try:
        if v.lower() in ("true", "false"):
            v = v.lower() == "true"
        elif "." in v or "e" in v.lower():
            v = float(v)
        else:
            v = int(v)
    except ValueError:
        pass
    return k.strip(), v


def write_event(job, ev):
    d = os.path.join(JOBS, job)
    if not os.path.isdir(d):
        sys.stderr.write(f"progress.py: ish papkasi yo'q: {d}\n")
        sys.exit(2)
    ev.setdefault("ts", round(time.time(), 3))
    line = json.dumps(ev, ensure_ascii=False)
    with open(os.path.join(d, "events.jsonl"), "a", encoding="utf-8") as f:
        f.write(line + "\n")
        f.flush()
        os.fsync(f.fileno())
    return line


def load_edl(path):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    segs = data["segments"] if isinstance(data, dict) and "segments" in data else data
    out = []
    for i, s in enumerate(segs):
        if isinstance(s, dict):
            t0 = float(s.get("t0", s.get("start", 0)))
            t1 = float(s.get("t1", s.get("end", t0)))
            out.append({
                "i": i, "t0": round(t0, 3), "t1": round(t1, 3),
                "src": s.get("src") or s.get("source") or "",
                "label": s.get("label") or s.get("text") or "",
                "kind": s.get("kind") or s.get("type") or "clip",
            })
        elif isinstance(s, (list, tuple)) and len(s) >= 2:
            out.append({"i": i, "t0": round(float(s[0]), 3), "t1": round(float(s[1]), 3),
                        "src": s[2] if len(s) > 2 else "", "label": "", "kind": "clip"})
    return out


def ffmpeg_progress_loop(args, base):
    """`ffmpeg -progress pipe:1` chiqishini stdin'dan o'qib, ~1 s da bir hodisa yozadi."""
    total = args.total_frames or 0
    cur = {}
    last_emit = 0.0
    t_start = time.time()
    emitted_any = False
    for raw in sys.stdin:
        line = raw.strip()
        if not line or "=" not in line:
            continue
        k, v = line.split("=", 1)
        cur[k] = v
        if k != "progress":
            continue
        end = v == "end"
        now = time.time()
        if not end and now - last_emit < args.interval:
            continue
        last_emit = now
        try:
            frame = int(cur.get("frame", "0"))
        except ValueError:
            frame = 0
        try:
            fps = float(cur.get("fps", "0"))
        except ValueError:
            fps = 0.0
        try:
            out_ms = int(cur.get("out_time_us", cur.get("out_time_ms", "0"))) / 1_000_000
        except ValueError:
            out_ms = 0.0
        pct = None
        if total:
            pct = max(0, min(100, round(frame * 100.0 / total, 1)))
        eta = None
        if total and fps > 0 and frame < total:
            eta = round((total - frame) / fps)
        ev = dict(base)
        ev.update({
            "type": "render", "state": "done" if end else "working",
            "pct": 100.0 if end else pct,
            "metrics": {"kadr": frame, "jami": total or None, "fps": round(fps, 1), "sekund": round(out_ms, 1),
                        "eta_s": eta, "speed": cur.get("speed", "").strip() or None},
        })
        base_text = args.text or "Render"
        ev["text"] = (f"{base_text} — {frame}/{total} kadr, {fps:.1f} fps" if total
                      else f"{base_text} — {frame} kadr, {fps:.1f} fps")
        if end:
            ev["text"] = f"{base_text} tugadi — {frame} kadr, {round(now - t_start)} s"
        write_event(args.job, ev)
        emitted_any = True
    if not emitted_any:
        ev = dict(base)
        ev.update({"type": "render", "state": "error", "text": "ffmpeg progress oqimi bo'sh keldi"})
        write_event(args.job, ev)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--job", required=True)
    p.add_argument("--agent", default=None, help="rejissyor|ovozchi|montajchi|motion|rangchi")
    p.add_argument("--state", default=None, choices=STATES)
    p.add_argument("--text", default="")
    p.add_argument("--pct", type=float, default=None)
    p.add_argument("--metric", type=parse_metric, action="append", default=[])
    p.add_argument("--handoff", default=None)
    p.add_argument("--image", default=None, help="still/preview rasm yo'li (sahifada ko'rsatiladi)")
    p.add_argument("--file", default=None, help="natija fayl yo'li (final video, preview, edl)")
    p.add_argument("--edl", default=None, help="edl.json yo'li — timeline segmentlari")
    p.add_argument("--type", dest="etype", default="step", choices=TYPES)
    p.add_argument("--ffmpeg-progress", action="store_true", help="stdin'dan ffmpeg -progress o'qish")
    p.add_argument("--total-frames", type=int, default=None)
    p.add_argument("--interval", type=float, default=1.0)
    args = p.parse_args()

    agent = norm_agent(args.agent)
    base = {"type": args.etype, "agent": agent, "state": args.state, "text": args.text}
    if args.handoff:
        base["handoff"] = norm_agent(args.handoff)
    if args.image:
        base["image"] = os.path.abspath(args.image)
    if args.file:
        base["file"] = os.path.abspath(args.file)

    if args.ffmpeg_progress:
        if not agent:
            base["agent"] = "rangchi"
        ffmpeg_progress_loop(args, base)
        return

    ev = dict(base)
    if args.pct is not None:
        ev["pct"] = args.pct
    if args.metric:
        ev["metrics"] = dict(args.metric)
    if args.edl:
        ev["type"] = "edl"
        ev["edl"] = load_edl(args.edl)
        ev["metrics"] = dict(ev.get("metrics", {}), kesimlar=len(ev["edl"]))
    if args.etype == "final" and not args.file:
        sys.stderr.write("progress.py: --type final uchun --file <yakuniy video yo'li> kerak\n")
        sys.exit(2)
    if args.etype == "final":
        if not os.path.isfile(ev["file"]):
            sys.stderr.write(f"progress.py: final fayl topilmadi: {ev['file']}\n")
            sys.exit(2)
        ev.setdefault("metrics", {})
        ev["metrics"].setdefault("hajm_mb", round(os.path.getsize(ev["file"]) / 1e6, 1))
        ev["state"] = ev["state"] or "done"
    if ev.get("state") is None and ev["type"] in ("step", "render"):
        ev["state"] = "working"
    print(write_event(args.job, ev))


if __name__ == "__main__":
    main()
