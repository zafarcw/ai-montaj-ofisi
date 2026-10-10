"""top-k token tiklash (07_AI_Ofis_Sayt nusxasi). usage: topk.py [--wav a16.wav] t0-t1 [t0-t1 ...]"""
import numpy as np, wave, onnxruntime as ort, sys, os
import os as _os
# Model yo'li: CLAUDE_ROOT (sayt runner'i beradi) yoki shu fayl joylashuvidan ROOT = ../../ (07_AI_Ofis_Sayt/engine → Claude/)
_ROOT = _os.environ.get("CLAUDE_ROOT") or _os.path.dirname(_os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))))
M=os.path.join(_ROOT,'02_Assets/ASR/sherpa-onnx-omnilingual-asr-1600-languages-1B-ctc-int8-2025-11-12')+'/'
WAV='a16.wav'
if len(sys.argv)>2 and sys.argv[1]=='--wav': WAV=sys.argv[2]; del sys.argv[1:3]
toks={}
for line in open(M+'tokens.txt',encoding='utf-8'):
    line=line.rstrip('\n')
    if not line: continue
    p=line.rsplit(' ',1); toks[int(p[1])]=p[0] if p[0]!='' else ' '
so=ort.SessionOptions(); so.intra_op_num_threads=4
s=ort.InferenceSession(M+'model.int8.onnx',so)
wf=wave.open(WAV); sr=wf.getframerate()
x=np.frombuffer(wf.readframes(wf.getnframes()),np.int16).astype(np.float32)/32768
for rng in sys.argv[1:]:
    a,b=map(float,rng.split('-')); pad=0.5
    seg=np.concatenate([np.zeros(int(pad*sr),np.float32),x[int(a*sr):int(b*sr)],np.zeros(int(.3*sr),np.float32)])
    seg=(seg-seg.mean())/(seg.std()+1e-7)
    lg=s.run(None,{'x':seg[None]})[0][0]
    pr=np.exp(lg-lg.max(-1,keepdims=True)); pr/=pr.sum(-1,keepdims=True)
    print('==',rng)
    line=[]
    prev=-1
    for t in range(len(pr)):
        i=int(pr[t].argmax())
        if i in (0,1,2) and pr[t,i]>0.9: prev=i; continue
        top=np.argsort(-pr[t])[:3]
        alt='/'.join(f"{toks.get(int(j),'?')}{pr[t,j]:.2f}" for j in top if pr[t,j]>0.05)
        line.append(f"{t*0.02-pad+a:.2f}:{alt}")
    print(' '.join(line))
