#!/usr/bin/env python3
"""Xavfsiz o'chirish: faqat `05_Vaqtincha/_job_<id>/` yoki `07_AI_Ofis_Sayt/jobs/<id>/` ichidagi fayl/papkani o'chiradi.

    python3 07_AI_Ofis_Sayt/runner/tozalash.py <job_id> <yo'l> [<yo'l> ...]
"""
import os
import shutil
import sys
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
ROOT = Path(os.environ.get("CLAUDE_ROOT") or SITE.parent)


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(2)
    jid = sys.argv[1]
    allowed = [(ROOT / "05_Vaqtincha" / f"_job_{jid}").resolve(), (SITE / "jobs" / jid).resolve()]
    rc = 0
    for arg in sys.argv[2:]:
        p = Path(arg).resolve()
        ok = False
        for base in allowed:
            try:
                p.relative_to(base)
                ok = p != base
            except ValueError:
                continue
            if ok:
                break
        if not ok:
            print(f"RAD: {arg} — faqat {allowed[0]} yoki {allowed[1]} ichida o'chirish mumkin")
            rc = 1
            continue
        if p.is_dir() and not p.is_symlink():
            shutil.rmtree(p)
        elif p.exists() or p.is_symlink():
            p.unlink()
        else:
            print(f"yo'q: {arg}")
            continue
        print(f"o'chirildi: {p}")
    sys.exit(rc)


if __name__ == "__main__":
    main()
