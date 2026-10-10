"""sherpa-onnx omnilingual CTC (1B int8) — direct onnxruntime, wave I/O (no scipy). usage: asr_wave.py in.wav cut1,cut2,... out.json
(07_AI_Ofis_Sayt nusxasi: model yo'li 02_Assets/ASR dan, CLAUDE_ROOT orqali; asl fayl 02_Assets/ASR/asr_wave.py o'zgartirilmagan)"""
import numpy as np, wave, onnxruntime as ort, json, sys, os
import os as _os
# Model yo'li: CLAUDE_ROOT (sayt runner'i beradi) yoki shu fayl joylashuvidan ROOT = ../../ (07_AI_Ofis_Sayt/engine → Claude/)
_ROOT = _os.environ.get("CLAUDE_ROOT") or _os.path.dirname(_os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))))
M = os.path.join(_ROOT, '02_Assets/ASR/sherpa-onnx-omnilingual-asr-1600-languages-1B-ctc-int8-2025-11-12') + '/'
toks = {}
for line in open(M + 'tokens.txt', encoding='utf-8'):
    line = line.rstrip('\n')
    if not line: continue
    p = line.rsplit(' ', 1); toks[int(p[1])] = p[0] if p[0] != '' else ' '
so = ort.SessionOptions(); so.intra_op_num_threads = 4
s = ort.InferenceSession(M + 'model.int8.onnx', so)
def run(x):
    x = (x - x.mean()) / (x.std() + 1e-7)
    return s.run(None, {'x': x[None].astype(np.float32)})[0][0]
def decode(lg, off, pad):
    ids = lg.argmax(-1); out = []; prev = -1
    pr = np.exp(lg - lg.max(-1, keepdims=True)); pr /= pr.sum(-1, keepdims=True)
    for t, i in enumerate(ids):
        if i != prev and i not in (0, 1, 2):
            out.append((t * 0.02 - pad + off, int(i), float(pr[t, i])))
        prev = i
    words = []; cur = None
    for tm, i, c in out:
        tk = toks.get(i, '?')
        if i == 4 or tk == ' ':
            if cur: words.append(cur); cur = None
            continue
        if tk.startswith('▁'):
            if cur: words.append(cur)
            cur = {'w': tk[1:], 't0': round(tm, 3), 't1': round(tm + 0.02, 3), 'c': [c]}
        else:
            if cur is None: cur = {'w': tk, 't0': round(tm, 3), 't1': round(tm + 0.02, 3), 'c': [c]}
            else: cur['w'] += tk; cur['t1'] = round(tm + 0.02, 3); cur['c'].append(c)
    if cur: words.append(cur)
    for w_ in words: w_['conf'] = round(float(np.mean(w_.pop('c'))), 3)
    return words
inp, cuts, outp = sys.argv[1], [float(c) for c in sys.argv[2].split(',') if c], sys.argv[3]
wf = wave.open(inp); sr = wf.getframerate()
x = np.frombuffer(wf.readframes(wf.getnframes()), np.int16).astype(np.float32) / 32768
cuts = [0] + cuts + [len(x) / sr]
allw = []; pad = 0.5
for a, b in zip(cuts[:-1], cuts[1:]):
    seg = x[int(a * sr):int(b * sr)]
    seg = np.concatenate([np.zeros(int(pad * sr), np.float32), seg, np.zeros(int(0.3 * sr), np.float32)])
    ws = decode(run(seg), a, pad); allw += ws
    print(f'[{a:.2f}-{b:.2f}]', ' '.join(w_['w'] for w_ in ws), flush=True)
json.dump(allw, open(outp, 'w'), ensure_ascii=False, indent=0)
