import sys, json, subprocess, os
# usage: asr_range.py i0 i1 [total_s]  (cuts.json + audio16k.wav joriy papkada; 07_AI_Ofis_Sayt nusxasi)
_HERE=os.path.dirname(os.path.abspath(__file__))
sys.argv_backup=sys.argv[:]
i0,i1=int(sys.argv[1]),int(sys.argv[2])
TOTAL=float(sys.argv[3]) if len(sys.argv)>3 else None
_c=json.load(open('cuts.json'))
if TOTAL is None:
    import wave as _w; _wf=_w.open('audio16k.wav'); TOTAL=_wf.getnframes()/_wf.getframerate()
cuts=[0.0]+_c+[TOTAL]
seg=cuts[i0:i1+1]
a,b=seg[0],seg[-1]
subprocess.run(['ffmpeg','-v','error','-y','-ss',str(a),'-t',str(b-a),'-i','audio16k.wav',f'part_{i0}.wav'],check=True)
rel=','.join(f'{c-a:.2f}' for c in seg[1:-1])
r=subprocess.run([sys.executable,os.path.join(_HERE,'asr_wave.py'),f'part_{i0}.wav',rel,f'w_{i0}.json'],capture_output=True,text=True)
ws=json.load(open(f'w_{i0}.json'))
for w in ws: w['t0']=round(w['t0']+a,3); w['t1']=round(w['t1']+a,3)
json.dump(ws,open(f'w_{i0}.json','w'),ensure_ascii=False)
# print lines with absolute times
for line in r.stdout.splitlines():
    if line.startswith('['):
        rng,txt=line[1:].split(']',1); p,q=rng.split('-')
        print(f'[{float(p)+a:.1f}-{float(q)+a:.1f}]{txt}')
os.remove(f'part_{i0}.wav')
