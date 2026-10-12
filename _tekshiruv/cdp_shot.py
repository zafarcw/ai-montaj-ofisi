"""Chrome MCP kengaytmasi ulanmaganda zaxira: headless Chrome + CDP skrinshot (faqat stdlib).

Ishga tushirish (konsol jurnali stderr ga tushadi, [SINOV]/Uncaught bo'yicha grep qiling):
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --no-first-run --user-data-dir=/tmp/prof \
     --enable-logging=stderr --v=0 --autoplay-policy=no-user-gesture-required --use-angle=swiftshader --enable-unsafe-swiftshader \
     --window-size=1400,900 --remote-debugging-port=9333 "http://127.0.0.1:8787/3d" 2> chrome.err &
  sleep 20; python3 -I _tekshiruv/cdp_shot.py 9333 shot.png [url_qismi]
Eslatma: SwiftShader da FPS past (3–7) — tezlikni faqat haqiqiy Chrome da o'lchang.
"""
import base64, json, os, socket, struct, sys, urllib.request
port, out = int(sys.argv[1]), sys.argv[2]
targets = json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/json", timeout=5))
pg = next(t for t in targets if t["type"] == "page" and (sys.argv[3] if len(sys.argv) > 3 else "") in t.get("url", ""))
ws = pg["webSocketDebuggerUrl"]; host, rest = ws[5:].split("/", 1); h, p = host.split(":")
s = socket.create_connection((h, int(p)), timeout=20)
key = base64.b64encode(os.urandom(16)).decode()
s.sendall(f"GET /{rest} HTTP/1.1\r\nHost: {host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n".encode())
buf = b""
while b"\r\n\r\n" not in buf: buf += s.recv(4096)
assert b" 101 " in buf.split(b"\r\n")[0], buf[:200]
def send(obj):
    d = json.dumps(obj).encode(); mask = os.urandom(4)
    hdr = bytes([0x81]) + (bytes([0x80 | len(d)]) if len(d) < 126 else bytes([0x80 | 126]) + struct.pack(">H", len(d)) if len(d) < 65536 else bytes([0x80 | 127]) + struct.pack(">Q", len(d)))
    s.sendall(hdr + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(d)))
def recvn(n):
    b = b""
    while len(b) < n:
        c = s.recv(min(1 << 16, n - len(b)))
        if not c: raise EOFError
        b += c
    return b
def recv():
    while True:
        h1, h2 = recvn(2); op = h1 & 0xF; ln = h2 & 0x7F
        if ln == 126: ln = struct.unpack(">H", recvn(2))[0]
        elif ln == 127: ln = struct.unpack(">Q", recvn(8))[0]
        data = recvn(ln)
        if op == 1: return json.loads(data.decode())
send({"id": 1, "method": "Page.captureScreenshot", "params": {"format": "png"}})
while True:
    m = recv()
    if m.get("id") == 1:
        open(out, "wb").write(base64.b64decode(m["result"]["data"])); print("saved", out, os.path.getsize(out)); break
