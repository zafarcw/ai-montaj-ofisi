// Xodimlar: past-poligonal figura, holat mashinasi (idle/working/sleep/walk/error), pufakchalar.
// MUHIM: "working" holatiga faqat feed.js orqali kelgan haqiqiy hodisa o'tkazadi.
// idle/sleep/walk — bo'sh holat animatsiyalari, ular hech qachon "ishlayapti" ko'rinmaydi.
import * as THREE from "three";
import { CSS2DObject } from "/web/vendor/three/CSS2DRenderer.js";

export const TOOL_COLORS = {
  Bash: "#30D158", Edit: "#0A84FF", MultiEdit: "#0A84FF", Write: "#5E5CE6", Read: "#98989D",
  Glob: "#64D2FF", Grep: "#FF9F0A", Task: "#BF5AF2", WebFetch: "#66D4CF", WebSearch: "#66D4CF", TodoWrite: "#FFD60A",
};
const SLEEP_AFTER = 60;     // s: hodisa yo'q → uxlaydi
const SEAT_Y = 0.6;         // o'tirgan holatda son balandligi
const SKINS = [0xe8b896, 0xc68b62, 0x8d5a3c, 0xf1c9a5, 0xa86f4a];
const HAIRS = [0x1b1512, 0x3b2616, 0x6b4a2b, 0x222831, 0x8a5a2b];

const boxMat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, flatShading: true });
function pivotBox(w, h, d, color, y) { // yuqori uchi pivotda osilgan quti
  const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), boxMat(color)); m.position.y = -h / 2; g.add(m); g.position.y = y; return g;
}
function div(cls, parent) { const d = document.createElement("div"); d.className = cls; return d; }

class Worker {
  constructor(zone, idx, desk) {
    this.zone = zone; this.id = zone.id; this.desk = desk;
    this.color = new THREE.Color(zone.color);
    const skin = SKINS[idx % SKINS.length], hair = HAIRS[(idx * 2) % HAIRS.length];
    this.root = new THREE.Group(); this.fig = new THREE.Group(); this.root.add(this.fig);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.28), boxMat(this.color.clone().multiplyScalar(0.9))); torso.position.y = 0.78; this.fig.add(torso);
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.19, 1), boxMat(skin)); head.position.y = 1.2; this.fig.add(head); this.head = head;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), boxMat(hair)); cap.position.y = 1.22; cap.rotation.x = -0.15; this.fig.add(cap);
    this.armL = pivotBox(0.14, 0.5, 0.14, this.color, 1.02); this.armL.position.x = -0.33;
    this.armR = pivotBox(0.14, 0.5, 0.14, this.color, 1.02); this.armR.position.x = 0.33;
    this.legL = pivotBox(0.18, 0.55, 0.2, 0x2a2f3a, 0.52); this.legL.position.x = -0.13;
    this.legR = pivotBox(0.18, 0.55, 0.2, 0x2a2f3a, 0.52); this.legR.position.x = 0.13;
    this.fig.add(this.armL, this.armR, this.legL, this.legR);
    // yorliqlar
    this.nameEl = div("worker-name"); this.nameEl.textContent = zone.name; this.nameEl.style.setProperty("--c", zone.color);
    this.nameObj = new CSS2DObject(this.nameEl); this.nameObj.position.set(0, 1.55, 0); this.root.add(this.nameObj);
    this.bubbleEl = div("worker-bubble"); this.bubbleEl.innerHTML = "<b></b><span></span>";
    this.bubbleObj = new CSS2DObject(this.bubbleEl); this.bubbleObj.position.set(0, 2.0, 0); this.root.add(this.bubbleObj);
    this.flagEl = div("worker-flag"); this.flagObj = new CSS2DObject(this.flagEl); this.flagObj.position.set(0, 2.45, 0); this.root.add(this.flagObj);
    this.seat = new THREE.Vector3(desk.x, 0, desk.z + 0.95);
    this.root.position.copy(this.seat); this.root.rotation.y = Math.PI; // monitorga qaraydi (-z)
    this.state = "idle"; this.mode = "seat"; this.sit = 1; this.path = []; this.t = Math.random() * 10;
    this.lastEvent = null; this.bubbleTimer = 0; this.awayTimer = 0; this.nextWalk = 25 + Math.random() * 30; this.idleFor = 0;
    this.wantWork = false; this.err = false;
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
      const w = new Worker(z, i, z.desks[1]); this.workers[z.id] = w; scene.add(w.root);
    });
    this.kitchenSlots = Object.keys(this.workers).map((_, i) => new THREE.Vector3(layout.kitchen.center.x - 3.2 + (i % 3) * 1.1, 0, layout.kitchen.center.z - 0.5 + Math.floor(i / 3) * 1.3));
  }
  // ---------- tashqi API (faqat feed.js chaqiradi) ----------
  event(agentId, patch, now) {
    const w = this.workers[agentId]; if (!w) return;
    w.lastEvent = now; w.idleFor = 0;
    if (patch.state === "error") { w.err = true; w.flagEl.textContent = "!"; w.flagEl.style.color = "#FF453A"; w.flagEl.classList.add("on"); }
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
    const lit = s === "working";
    this.hooks.setMonitor(w.desk.mon, lit, w.color);
  }
  _route(w, toKitchen) {
    const z = w.zone.center, k = this.layout.kitchen.center, slot = this.kitchenSlots[Object.keys(this.workers).indexOf(w.id)];
    const aisleZ = z.z + this.layout.ZONE_D / 2 - 0.6;                       // stollar oldidagi yo'lak
    const row1 = z.z > 0 === k.z > 0 || Math.abs(z.z - k.z) < 1;
    const pts = [new THREE.Vector3(w.seat.x, 0, w.seat.z + 0.8), new THREE.Vector3(w.seat.x, 0, aisleZ), new THREE.Vector3(slot.x, 0, aisleZ)];
    if (!row1 || Math.abs(aisleZ - slot.z) > 0.01) pts.push(slot.clone());
    return toKitchen ? pts : pts.reverse().concat([w.seat.clone()]);
  }
  _goOut(w) { w.path = this._route(w, true); w.mode = "out"; w.state = "walk"; this.hooks.setMonitor(w.desk.mon, false); }
  _goBack(w) { if (w.mode === "back" || w.mode === "seat") return; w.path = this._route(w, false); if (w.mode === "out" || w.mode === "away") { w.path.unshift(w.root.position.clone()); } w.mode = "back"; w.state = "walk"; }
  update(dt, t) {
    for (const w of Object.values(this.workers)) this._tick(w, dt, t);
  }
  _tick(w, dt, t) {
    w.t += dt; w.idleFor += dt;
    if (w.bubbleTimer > 0) { w.bubbleTimer -= dt; if (w.bubbleTimer <= 0) w.hideBubble(); }
    const seated = w.mode === "seat";
    // uxlash: 60 s hodisa yo'q (ishlayotgan stol ham — "ishlayapti" deb ko'rinmaydi)
    if (seated && (w.state === "working" || w.state === "idle") && w.lastEvent !== null && t - w.lastEvent > SLEEP_AFTER) { this._setState(w, "sleep"); w.wantWork = false; }
    if (seated && w.state === "idle" && w.lastEvent === null && w.idleFor > SLEEP_AFTER) this._setState(w, "sleep");
    // tasodifiy oshxonaga borish (faqat bo'sh va uxlamayotgan)
    if (seated && w.state === "idle" && !w.err && w.idleFor > w.nextWalk) { w.nextWalk = 30 + Math.random() * 40; this._goOut(w); }
    if (w.mode === "away") { w.awayTimer -= dt; if (w.awayTimer <= 0) this._goBack(w); }
    // harakat
    let moving = false;
    if ((w.mode === "out" || w.mode === "back") && w.path.length) {
      const tgt = w.path[0], pos = w.root.position, d = this.tmp.subVectors(tgt, pos); d.y = 0; const len = d.length();
      const step = 2.0 * dt;
      if (len <= step) { pos.copy(tgt); w.path.shift(); } else { d.multiplyScalar(step / len); pos.add(d); w.root.rotation.y = Math.atan2(d.x, d.z); }
      moving = true;
      if (!w.path.length) {
        if (w.mode === "out") { w.mode = "away"; w.awayTimer = 6 + Math.random() * 6; w.state = "idle"; }
        else { w.mode = "seat"; w.root.position.copy(w.seat); w.root.rotation.y = Math.PI; this._setState(w, w.wantWork ? "working" : "idle"); }
      }
    }
    // poza
    const targetSit = w.mode === "seat" ? 1 : 0; w.sit += (targetSit - w.sit) * Math.min(1, dt * 8);
    w.fig.position.y = SEAT_Y * 0.0 + (w.sit * 0.1);
    const legRot = -Math.PI / 2 * w.sit, swing = moving ? Math.sin(w.t * 9) * 0.6 : 0;
    w.legL.rotation.x = legRot + swing; w.legR.rotation.x = legRot - swing;
    let armX = 0, armZ = 0, headX = 0, body = 0;
    if (moving) { armX = -swing * 0.8; }
    else if (w.mode === "seat" && w.state === "working") {
      armX = -1.25 + Math.sin(w.t * 14) * 0.12; // yozish
      body = Math.sin(w.t * 2) * 0.01;
    } else if (w.state === "sleep") { headX = 0.55; armX = -0.7; body = Math.sin(w.t * 1.2) * 0.012; }
    else { armX = -0.35; body = Math.sin(w.t * 1.8) * 0.015; }      // nafas
    w.armL.rotation.x = moving ? armX : armX + (w.state === "working" ? Math.sin(w.t * 11 + 1) * 0.12 : 0);
    w.armR.rotation.x = moving ? -armX : armX;
    w.armL.rotation.z = armZ; w.head.rotation.x = headX; w.fig.scale.y = 1 + body;
    // zZ / yorliq
    if (w.state === "sleep" && !w.err) { w.flagEl.textContent = ["z", "zZ", "zZz"][Math.floor(w.t * 1.5) % 3]; w.flagEl.style.color = "#8E8E93"; w.flagEl.classList.add("on"); }
    else if (!w.err) w.flagEl.classList.remove("on");
    w.bubbleObj.position.y = w.state === "sleep" ? 2.0 : 2.0;
  }
}
