// Xodimlar: past-poligonal, "chibi" figura (2b: katta, farqli koʻrinish), holat mashinasi (idle/working/sleep/walk/error), pufakchalar.
// MUHIM: "working" holatiga faqat feed.js orqali kelgan haqiqiy hodisa oʻtkazadi.
// idle/sleep/walk — boʻsh holat animatsiyalari; ular hech qachon monitor yoqmaydi va tool pufakchasi chiqarmaydi.
import * as THREE from "three";
import { CSS2DObject } from "/web/vendor/three/CSS2DRenderer.js";
import { mat } from "/web/3d/props.js";

export const TOOL_COLORS = {
  Bash: "#30D158", Edit: "#0A84FF", MultiEdit: "#0A84FF", Write: "#5E5CE6", Read: "#98989D",
  Glob: "#64D2FF", Grep: "#FF9F0A", Task: "#BF5AF2", WebFetch: "#66D4CF", WebSearch: "#66D4CF", TodoWrite: "#FFD60A",
};
const SLEEP_AFTER = 60;     // s: hodisa yoʻq → uxlaydi
const WALK_SPEED = 2.6;
const FIG_SCALE = 1.12;    // figura stolga nisbatan biroz katta (chibi uslub)
const SKINS = [0xf0c8a8, 0xe6b394, 0xd6a37f, 0xc98f66, 0xa86f4a, 0x8d5a3c];
const HAIRS = [0x1b1512, 0x3b2314, 0x6b4a2b, 0x8a5a2b, 0x2b2b30, 0xc9a26b];
// Har rol uchun oʻziga xos koʻrinish (original dizayn). Boshqa (vaqtinchalik) xodimlar — indeks boʻyicha.
const LOOKS = {
  rejissyor: { skin: 1, hair: 0, style: "cap", cap: 0x1f2a44 },
  ovozchi: { skin: 2, hair: 1, style: "long", headphones: true },
  montajchi: { skin: 0, hair: 4, style: "short", glasses: 0.1 },
  motion: { skin: 3, hair: 2, style: "beanie" },
  rangchi: { skin: 4, hair: 3, style: "bun", glasses: 0.085 },
};
const STYLES = ["short", "cap", "long", "beanie", "bun", "curly"];
// umumiy geometriyalar
const G = {
  head: new THREE.SphereGeometry(0.38, 18, 14), eye: new THREE.SphereGeometry(0.075, 10, 8), pupil: new THREE.SphereGeometry(0.036, 8, 6),
  brow: new THREE.BoxGeometry(0.13, 0.03, 0.02), mouth: new THREE.BoxGeometry(0.11, 0.025, 0.02), hand: new THREE.BoxGeometry(0.19, 0.15, 0.19),
  shoe: new THREE.BoxGeometry(0.22, 0.1, 0.3), cap: new THREE.SphereGeometry(0.395, 18, 9, 0, Math.PI * 2, 0, Math.PI * 0.52),
  brim: new THREE.BoxGeometry(0.42, 0.04, 0.3), bun: new THREE.SphereGeometry(0.15, 10, 8), curl: new THREE.SphereGeometry(0.13, 8, 6),
  cuff: new THREE.TorusGeometry(0.4, 0.06, 8, 22), band: new THREE.TorusGeometry(0.44, 0.035, 8, 24, Math.PI), cup: new THREE.CylinderGeometry(0.12, 0.12, 0.09, 14),
  ring: new THREE.CylinderGeometry(0.125, 0.125, 0.03, 14), neck: new THREE.CylinderGeometry(0.1, 0.11, 0.14, 10), longHair: new THREE.BoxGeometry(0.62, 0.55, 0.22),
};

function pivot(w, h, d, m, y, x = 0) { // yuqori uchi pivotda osilgan quti (son, boldir, qoʻl)
  const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.y = -h / 2; b.castShadow = true; g.add(b); g.position.set(x, y, 0); return g;
}
function part(geo, m, x, y, z, parent) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; }
function div(cls) { const d = document.createElement("div"); d.className = cls; return d; }

function buildFigure(look, color) {
  const fig = new THREE.Group();
  const skin = mat(SKINS[look.skin % SKINS.length]), hair = mat(HAIRS[look.hair % HAIRS.length]);
  const cloth = mat(color.getHex()), clothD = mat(color.clone().multiplyScalar(0.7).getHex()), pants = mat(0x23262e), dark = mat(0x1a1c22, { roughness: 0.5 });
  // oyoqlar: son + boldir + poyabzal
  const legs = [-0.17, 0.17].map((x) => {
    const th = pivot(0.25, 0.32, 0.27, pants, 0.62, x); const sh = pivot(0.22, 0.32, 0.24, pants, -0.32); th.add(sh); th.shin = sh;
    part(G.shoe, dark, 0, -0.33, 0.05, sh); fig.add(th); return th;
  });
  // yuqori tana (belidan buriladi)
  const upper = new THREE.Group(); upper.position.y = 0.62; fig.add(upper);
  part(new THREE.BoxGeometry(0.78, 0.72, 0.44), cloth, 0, 0.36, 0, upper);
  part(new THREE.BoxGeometry(0.8, 0.09, 0.46), pants, 0, 0.04, 0, upper);
  part(new THREE.BoxGeometry(0.3, 0.1, 0.46), skin, 0, 0.7, 0.0, upper); // boʻyin oldi (yoqa)
  const arms = [-0.5, 0.5].map((x) => { const a = pivot(0.2, 0.5, 0.2, clothD, 0.66, x); part(G.hand, skin, 0, -0.57, 0, a); upper.add(a); return a; });
  part(G.neck, skin, 0, 0.78, 0, upper);
  const head = new THREE.Group(); head.position.y = 1.16; upper.add(head);
  part(G.head, skin, 0, 0, 0, head).scale.set(1, 1.04, 0.96);
  const eyes = [-0.14, 0.14].map((x) => { const e = part(G.eye, mat(0xf4f4f6, { roughness: 0.35 }), x, 0.03, 0.33, head); e.scale.z = 0.5; part(G.pupil, mat(0x14141a, { roughness: 0.3 }), x, 0.03, 0.365, head); return e; });
  [-0.14, 0.14].forEach((x, i) => { part(G.brow, hair, x, 0.16, 0.355, head).rotation.z = i ? -0.12 : 0.12; });
  const mouth = part(G.mouth, mat(0x6b3f3f), 0, -0.15, 0.37, head);
  // soch / bosh kiyim
  const st = look.style;
  if (st !== "cap" && st !== "beanie") { const c = part(G.cap, hair, 0, 0.03, 0, head); c.rotation.x = -0.22; }
  if (st === "cap") { const capM = mat(look.cap ?? 0x1f2a44, { roughness: 0.9 }); part(G.cap, capM, 0, 0.06, 0, head).rotation.x = -0.1; part(G.brim, capM, 0, 0.06, 0.42, head); }
  if (st === "long") part(G.longHair, hair, 0, -0.1, -0.28, head);
  if (st === "beanie") { const bm = mat(color.clone().multiplyScalar(0.55).getHex(), { roughness: 1 }); part(G.cap, bm, 0, 0.07, 0, head).scale.setScalar(1.04); part(G.cuff, bm, 0, 0.03, 0, head).rotation.x = Math.PI / 2; part(G.bun, bm, 0, 0.5, 0, head).scale.setScalar(0.7); }
  if (st === "bun") part(G.bun, hair, 0, 0.38, -0.14, head);
  if (st === "curly") for (let i = 0; i < 6; i++) part(G.curl, hair, Math.sin(i * 1.05) * 0.26, 0.3 + Math.cos(i * 1.05) * 0.08, Math.cos(i * 1.05) * 0.22, head);
  // aksessuarlar
  if (look.glasses) {
    const r = look.glasses, fr = mat(0x15161a, { roughness: 0.4 }), lens = new THREE.TorusGeometry(r, 0.014, 6, 18);
    for (const x of [-0.14, 0.14]) part(lens, fr, x, 0.03, 0.375, head);
    part(new THREE.BoxGeometry(0.08, 0.014, 0.014), fr, 0, 0.045, 0.375, head);
    for (const x of [-0.27, 0.27]) part(new THREE.BoxGeometry(0.014, 0.014, 0.3), fr, x, 0.03, 0.22, head);
  }
  if (look.headphones) {
    part(G.band, dark, 0, 0.03, 0.02, head);
    for (const x of [-0.42, 0.42]) { part(G.cup, dark, x, 0.0, 0.02, head).rotation.z = Math.PI / 2; part(G.ring, mat(color.getHex(), { roughness: 0.5 }), x * 1.1, 0.0, 0.02, head).rotation.z = Math.PI / 2; }
  }
  return { fig, upper, head, eyes, mouth, armL: arms[0], armR: arms[1], legL: legs[0], legR: legs[1] };
}

class Worker {
  constructor(zone, idx, desk) {
    this.zone = zone; this.id = zone.id; this.desk = desk; this.color = new THREE.Color(zone.color);
    const look = LOOKS[zone.id] || { skin: idx, hair: idx * 2 + 1, style: STYLES[idx % STYLES.length], glasses: idx % 3 === 1 ? 0.1 : 0 };
    this.root = new THREE.Group();
    Object.assign(this, buildFigure(look, this.color)); this.fig.scale.setScalar(FIG_SCALE); this.root.add(this.fig);
    // yorliqlar: ism (faqat xodim tepasida), pufakcha, bayroq (! / zZ)
    this.nameEl = div("worker-name"); this.nameEl.textContent = zone.name; this.nameEl.style.setProperty("--c", zone.color);
    const nameWrap = div("lod"); nameWrap.appendChild(this.nameEl);
    this.nameObj = new CSS2DObject(nameWrap); this.nameObj.position.set(0, 2.8, 0); this.root.add(this.nameObj);
    this.bubbleEl = div("worker-bubble"); this.bubbleEl.innerHTML = "<b></b><span></span>";
    this.bubbleObj = new CSS2DObject(this.bubbleEl); this.bubbleObj.position.set(0, 3.3, 0); this.root.add(this.bubbleObj);
    this.flagEl = div("worker-flag"); this.flagObj = new CSS2DObject(this.flagEl); this.flagObj.position.set(0, 3.75, 0); this.root.add(this.flagObj);
    this.seat = new THREE.Vector3(desk.x, 0, desk.z + 1.05);
    this.root.position.copy(this.seat); this.root.rotation.y = Math.PI; // monitorga qaraydi (-z)
    this.state = "idle"; this.mode = "seat"; this.sit = 1; this.path = []; this.t = Math.random() * 10; this.phase = Math.random() * 7;
    this.lastEvent = null; this.bubbleTimer = 0; this.awayTimer = 0; this.nextWalk = 25 + Math.random() * 30; this.idleFor = 0;
    this.wantWork = false; this.err = false; this.face = null; this.lodScale = -1;
  }
  setBubble(tag, text, color) {
    this.bubbleEl.style.setProperty("--tc", color); this.bubbleEl.firstChild.textContent = tag;
    this.bubbleEl.lastChild.textContent = text || ""; this.bubbleEl.classList.add("on"); this.bubbleTimer = 6;
  }
  hideBubble() { this.bubbleEl.classList.remove("on"); }
}

export class Office {
  constructor(scene, layout, hooks) {
    this.scene = scene; this.layout = layout; this.hooks = hooks; this.workers = {};
    this.tmp = new THREE.Vector3();
    layout.zones.filter((z) => !z.kitchen).forEach((z, i) => {
      const w = new Worker(z, i, z.desks[0]); this.workers[z.id] = w; scene.add(w.root);
    });
    this.slots = layout.kitchen.slots;
  }
  // ---------- tashqi API (faqat feed.js chaqiradi) ----------
  event(agentId, patch, now) {
    const w = this.workers[agentId]; if (!w) return;
    w.lastEvent = now; w.idleFor = 0;
    if (patch.state === "error") { w.err = true; w.flagEl.textContent = "!"; w.flagEl.style.color = "#FF453A"; w.flagEl.classList.add("on"); this._work(w, false); }
    if (patch.state === "working") { w.err = false; w.flagEl.classList.remove("on"); this._work(w, true); if (patch.text) w.setBubble("", patch.text, w.zone.color); }
    if (patch.state === "done" || patch.state === "idle") { this._work(w, false); if (patch.state === "done" && patch.text) w.setBubble("✓", patch.text, "#30D158"); }
  }
  tool(agentId, name, text) {
    const w = this.workers[agentId]; if (!w) return;
    w.lastEvent = performance.now() / 1000; w.idleFor = 0; this._work(w, true);
    w.setBubble(name, text, TOOL_COLORS[name] || "#98989D");
  }
  reset() { for (const w of Object.values(this.workers)) { w.err = false; w.flagEl.classList.remove("on"); this._work(w, false); w.hideBubble(); w.lastEvent = null; } }
  // ---------- ichki ----------
  _work(w, on) {
    w.wantWork = on;
    if (on) { if (w.mode !== "seat") this._goBack(w); else this._setState(w, "working"); }
    else if (w.state === "working") this._setState(w, "idle");
  }
  _setState(w, s) {
    w.state = s; w.idleFor = 0;
    this.hooks.setMonitor(w.desk, s === "working", w.color);
  }
  _route(w, toKitchen) {
    const z = w.zone.center, slot = this.slots[Object.keys(this.workers).indexOf(w.id) % this.slots.length];
    const aisleZ = z.z + this.layout.ZONE_D / 2 - 0.9;                       // zona oldidagi yoʻlak (stullar orqasida)
    const pts = [new THREE.Vector3(w.seat.x, 0, w.seat.z + 0.7)];
    if (w.seat.z < z.z) pts.push(new THREE.Vector3(z.x, 0, w.seat.z + 0.7));  // orqa qator: stollar orasidan
    pts.push(new THREE.Vector3(pts[pts.length - 1].x, 0, aisleZ));
    const via = slot.via || [], entryX = via.length ? via[0].x : slot.pos.x;
    pts.push(new THREE.Vector3(entryX, 0, aisleZ));
    for (const v of via) pts.push(v.clone());
    pts.push(slot.pos.clone());
    w.face = slot.face;
    return toKitchen ? pts : pts.reverse().concat([w.seat.clone()]);
  }
  _goOut(w) { w.path = this._route(w, true); w.mode = "out"; w.state = "walk"; this.hooks.setMonitor(w.desk, false); }
  _goBack(w) { if (w.mode === "back" || w.mode === "seat") return; w.path = this._route(w, false); if (w.mode === "out" || w.mode === "away") { w.path.unshift(w.root.position.clone()); } w.mode = "back"; w.state = "walk"; }
  update(dt, t, camPos) {
    for (const w of Object.values(this.workers)) this._tick(w, dt, t, camPos);
  }
  _tick(w, dt, t, camPos) {
    w.t += dt; w.idleFor += dt;
    if (w.bubbleTimer > 0) { w.bubbleTimer -= dt; if (w.bubbleTimer <= 0) w.hideBubble(); }
    const seated = w.mode === "seat";
    // uxlash: 60 s hodisa yoʻq (ishlayotgan stol ham — "ishlayapti" deb koʻrinmaydi)
    if (seated && (w.state === "working" || w.state === "idle") && w.lastEvent !== null && t - w.lastEvent > SLEEP_AFTER) { this._setState(w, "sleep"); w.wantWork = false; }
    if (seated && w.state === "idle" && w.lastEvent === null && w.idleFor > SLEEP_AFTER) this._setState(w, "sleep");
    // tasodifiy oshxonaga borish (faqat boʻsh va uxlamayotgan)
    if (seated && w.state === "idle" && !w.err && w.idleFor > w.nextWalk) { w.nextWalk = 30 + Math.random() * 40; this._goOut(w); }
    if (w.mode === "away") { w.awayTimer -= dt; if (w.awayTimer <= 0) this._goBack(w); }
    // harakat
    let moving = false;
    if ((w.mode === "out" || w.mode === "back") && w.path.length) {
      const tgt = w.path[0], pos = w.root.position, d = this.tmp.subVectors(tgt, pos); d.y = 0; const len = d.length();
      const step = WALK_SPEED * dt;
      if (len <= step) { pos.copy(tgt); w.path.shift(); } else { d.multiplyScalar(step / len); pos.add(d); w.root.rotation.y = Math.atan2(d.x, d.z); }
      moving = true;
      if (!w.path.length) {
        if (w.mode === "out") { w.mode = "away"; w.awayTimer = 6 + Math.random() * 6; w.state = "idle"; if (w.face) w.root.rotation.y = Math.atan2(w.face.x - pos.x, w.face.z - pos.z); }
        else { w.mode = "seat"; w.root.position.copy(w.seat); w.root.rotation.y = Math.PI; this._setState(w, w.wantWork ? "working" : "idle"); }
      }
    }
    // poza
    const targetSit = w.mode === "seat" ? 1 : 0; w.sit += (targetSit - w.sit) * Math.min(1, dt * 8);
    const s = w.sit, swing = moving ? Math.sin(w.t * 9) * 0.7 : 0;
    w.fig.position.y = 0.03 * s + (moving ? Math.abs(Math.sin(w.t * 9)) * 0.05 : 0);
    w.legL.rotation.x = -Math.PI / 2 * s + swing; w.legR.rotation.x = -Math.PI / 2 * s - swing;
    w.legL.shin.rotation.x = Math.PI / 2 * s + Math.max(0, swing) * 0.8; w.legR.shin.rotation.x = Math.PI / 2 * s + Math.max(0, -swing) * 0.8;
    let armX = -0.45, armZ = 0, headX = 0, headY = 0, lean = 0, breath = Math.sin(w.t * 1.8) * 0.012, typing = false;
    if (moving) { w.armL.rotation.x = -swing * 0.9; w.armR.rotation.x = swing * 0.9; }
    else if (w.err) { armX = -2.6; armZ = 0.55; headX = 0.3; breath = Math.sin(w.t * 6) * 0.01; }
    else if (seated && w.state === "working") { // yozish: qoʻllar klaviaturada, navbat bilan
      typing = true; lean = 0.1; headX = 0.15; const k = Math.sin(w.t * 13);
      w.armL.rotation.x = -1.3 + k * 0.14; w.armR.rotation.x = -1.3 - k * 0.14; breath = Math.sin(w.t * 2) * 0.008;
    } else if (w.state === "sleep") { armX = -1.1; headX = 0.7; lean = 0.25; breath = Math.sin(w.t * 1.1) * 0.02; }
    else { headY = Math.sin(w.t * 0.6 + w.phase) * 0.35; armX = -0.5 - s * 0.6; }
    if (!moving && !typing) { w.armL.rotation.x = armX; w.armR.rotation.x = armX; }
    w.armL.rotation.z = armZ; w.armR.rotation.z = -armZ;
    w.head.rotation.x = headX; w.head.rotation.y = headY; w.upper.rotation.x = lean; w.fig.scale.y = FIG_SCALE * (1 + breath);
    const blink = ((w.t + w.phase) % 3.7) < 0.12 ? 0.12 : 1; w.eyes[0].scale.y = blink; w.eyes[1].scale.y = blink;
    // zZ / yorliq
    if (w.state === "sleep" && !w.err) { w.flagEl.textContent = ["z", "zZ", "zZz"][Math.floor(w.t * 1.5) % 3]; w.flagEl.style.color = "#8E8E93"; w.flagEl.classList.add("on"); }
    else if (!w.err) w.flagEl.classList.remove("on");
    // LOD: uzoqda ism kichrayadi, juda uzoqda yashirinadi
    if (camPos) {
      const d = camPos.distanceTo(w.root.position), sc = d > 46 ? 0 : Math.min(1.15, Math.max(0.55, 24 / d));
      if (Math.abs(sc - w.lodScale) > 0.03) { w.lodScale = sc; w.nameEl.style.transform = `scale(${sc})`; w.nameEl.style.opacity = sc ? 1 : 0; }
    }
  }
}
