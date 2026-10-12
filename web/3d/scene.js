// 3D ofis — sahna, yorugʻlik (lampalar + bloom + soya), zonalar, instanslangan jihozlar, kamera. 2b-bosqich dizayni.
import * as THREE from "three";
import { OrbitControls } from "/web/vendor/three/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "/web/vendor/three/CSS2DRenderer.js";
import { EffectComposer } from "/web/vendor/three/postprocessing/EffectComposer.js";
import { RenderPass } from "/web/vendor/three/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "/web/vendor/three/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "/web/vendor/three/postprocessing/OutputPass.js";
import { Office } from "/web/3d/workers.js";
import { connectFeed } from "/web/3d/feed.js";
import { mat, glow, box, cyl, plant, glassWall, kitchen, roleGear, poolTexture, screenTexture, GLASS } from "/web/3d/props.js";

const FALLBACK = [
  { id: "rejissyor", name: "Rejissyor", color: "#0A84FF" },
  { id: "ovozchi", name: "Ovozchi", color: "#FF9F0A" },
  { id: "montajchi", name: "Montajchi", color: "#30D158" },
  { id: "motion", name: "Motion dizayner", color: "#BF5AF2" },
  { id: "rangchi", name: "Rangchi", color: "#FF375F" },
];
// Zona yorligʻi = vazifa nomi (xodim ismi faqat xodim tepasida)
const ZONE_TITLES = {
  rejissyor: ["🎬", "Rejissyor xonasi"], ovozchi: ["🎙", "Ovoz boʻlimi"], montajchi: ["✂️", "Montaj"],
  motion: ["✨", "Motion"], rangchi: ["🎨", "Rang va render"], oshxona: ["☕", "Oshxona"],
};
const ZONE_W = 11, ZONE_D = 9, GAP = 1.2, COLS = 3, DESK_ROWS = 2, DESK_COLS = 2;

async function loadAgents() {
  try { const c = await (await fetch("/api/config")).json(); if (c.agents?.length) return c.agents; } catch (e) { /* standart */ }
  return FALLBACK;
}

// ---------- renderer, kompozitor, yorliqlar ----------
const stage = document.getElementById("stage");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07080b);
scene.fog = new THREE.Fog(0x07080b, 60, 120);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);
const labels = new CSS2DRenderer();
Object.assign(labels.domElement.style, { position: "absolute", inset: "0", pointerEvents: "none" });
stage.appendChild(labels.domElement);

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 220);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 5; controls.maxDistance = 58;
controls.minPolarAngle = 0.3; controls.maxPolarAngle = Math.PI / 2 - 0.06;
controls.screenSpacePanning = false;

const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.4, 0.82);
composer.addPass(bloom); composer.addPass(new OutputPass());

// ---------- yorugʻlik: past sovuq ambient + yumshoq soya; iliq lampalar stollarda ----------
scene.add(new THREE.HemisphereLight(0x5b6b8f, 0x0a0b10, 0.5));
const sun = new THREE.DirectionalLight(0xbfd0ff, 0.6);
sun.position.set(16, 28, 10); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 22, bottom: -22, near: 4, far: 80 });
scene.add(sun, sun.target);
const rim = new THREE.DirectionalLight(0x8fb0ff, 0.35); rim.position.set(-10, 12, -24); scene.add(rim);

const agents = await loadAgents();
const zones = [...agents.map((a) => ({ id: a.id, name: a.name, color: a.color })), { id: "oshxona", name: "Oshxona", color: "#66D4CF", kitchen: true }];
const rows = Math.ceil(zones.length / COLS);
const totalW = COLS * ZONE_W + (COLS - 1) * GAP, totalD = rows * ZONE_D + (rows - 1) * GAP;

// ---------- pol ----------
const floor = new THREE.Mesh(new THREE.PlaneGeometry(totalW + 14, totalD + 14), mat(0x0c0e13, { roughness: 0.92 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const grid = new THREE.GridHelper(Math.max(totalW, totalD) + 14, Math.round(Math.max(totalW, totalD) + 14), 0x1e2330, 0x151923);
grid.position.y = 0.008; grid.material.transparent = true; grid.material.opacity = 0.28; scene.add(grid);
// chap tashqi devor + tungi derazalar (fon chuqurligi uchun)
const wallX = -totalW / 2 - 1.2;
box(0.25, 3.4, totalD + 4, mat(0x1e222c), wallX, 1.7, 0, scene);
for (let i = 0; i < 3; i++) {
  const wz = -totalD / 2 + 3.5 + i * 6.2, w = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.7), glow(0x14264a, 0.7)); w.rotation.y = Math.PI / 2; w.position.set(wallX + 0.13, 2.1, wz); scene.add(w);
  box(0.08, 1.8, 0.06, mat(0x2a2e38), wallX + 0.16, 2.1, wz, scene, false); box(0.08, 0.06, 4.3, mat(0x2a2e38), wallX + 0.16, 2.1, wz, scene, false);
}

// ---------- instanslar: stol, monitor, stul, lampa, mayda jihozlar ----------
const nDesks = (zones.length - 1) * DESK_ROWS * DESK_COLS, nScreens = nDesks + 8;
const tmp = new THREE.Object3D();
function inst(geo, m, n, shadow = true) { const im = new THREE.InstancedMesh(geo, m, n); im.castShadow = shadow; im.receiveShadow = shadow; im.count = 0; scene.add(im); return im; }
function place(im, x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) {
  tmp.position.set(x, y, z); tmp.rotation.set(rx, ry, rz); tmp.scale.set(sx, sy, sz); tmp.updateMatrix();
  const i = im.count++; im.setMatrixAt(i, tmp.matrix); return i;
}
const oak = mat(0x8a6a48, { roughness: 0.6 }), darkM = mat(0x1d2027), bezelM = mat(0x15171c, { roughness: 0.5 }), standM = mat(0x2a2d35, { roughness: 0.5, metalness: 0.2 });
const I = {
  top: inst(new THREE.BoxGeometry(2.8, 0.1, 1.4), oak, nDesks), side: inst(new THREE.BoxGeometry(0.08, 0.9, 1.25), darkM, nDesks * 2),
  bezel: inst(new THREE.BoxGeometry(1.27, 0.76, 0.05), bezelM, nScreens), neck: inst(new THREE.BoxGeometry(0.08, 0.32, 0.06), standM, nScreens), base: inst(new THREE.BoxGeometry(0.5, 0.03, 0.3), standM, nScreens),
  screen: inst(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: screenTexture() }), nScreens, false),
  kbd: inst(new THREE.BoxGeometry(0.75, 0.03, 0.26), mat(0x191b21, { roughness: 0.6 }), nDesks), mouse: inst(new THREE.BoxGeometry(0.1, 0.045, 0.16), mat(0x22242a), nDesks),
  mug: inst(new THREE.CylinderGeometry(0.085, 0.075, 0.2, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }), nDesks),
  seat: inst(new THREE.BoxGeometry(0.78, 0.1, 0.72), mat(0x2b2f3a, { roughness: 0.9 }), nDesks), back: inst(new THREE.BoxGeometry(0.72, 0.72, 0.09), mat(0x2b2f3a, { roughness: 0.9 }), nDesks),
  post: inst(new THREE.CylinderGeometry(0.04, 0.04, 0.46, 8), standM, nDesks), cbase: inst(new THREE.CylinderGeometry(0.33, 0.37, 0.04, 14), standM, nDesks),
  lpost: inst(new THREE.CylinderGeometry(0.022, 0.03, 0.95, 8), mat(0x23252c, { roughness: 0.5, metalness: 0.3 }), nDesks), larm: inst(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 6), mat(0x23252c, { roughness: 0.5, metalness: 0.3 }), nDesks),
  lhead: inst(new THREE.CylinderGeometry(0.07, 0.19, 0.22, 14, 1, true), mat(0x2d3038, { side: THREE.DoubleSide, roughness: 0.6 }), nDesks), lbulb: inst(new THREE.SphereGeometry(0.06, 10, 8), glow(0xffc27a, 3.2), nDesks, false),
  pool: inst(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: poolTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), nDesks * 2 + 6, false),
};
I.lbulb.castShadow = false; I.pool.castShadow = I.pool.receiveShadow = false; I.screen.castShadow = false;
const MON_OFF = new THREE.Color(0.035, 0.04, 0.05), WARM = new THREE.Color(0xffb878);
const MUGS = [0xf2f2f4, 0x0a84ff, 0xff9f0a, 0x30d158, 0xff375f, 0xffd60a];
function addPool(x, y, z, s, k) { const i = place(I.pool, x, y, z, 0, s, s, 1, -Math.PI / 2); I.pool.setColorAt(i, WARM.clone().multiplyScalar(k)); return i; }
function addScreen(x, y, z, w, h, ry = 0, withStand = true) {
  if (withStand) {
    place(I.bezel, x, y, z, ry, w / 1.15, h / 0.65, 1); place(I.neck, x, y - h / 2 - 0.13, z + 0.03, ry); place(I.base, x, y - h / 2 - 0.3, z + 0.08, ry);
  }
  const i = place(I.screen, x + Math.sin(ry) * 0.03, y, z + Math.cos(ry) * 0.03, ry, w, h, 1);
  I.screen.setColorAt(i, MON_OFF); return i;
}
function addDesk(x, z, lead) {
  place(I.top, x, 0.9, z); place(I.side, x - 1.33, 0.45, z); place(I.side, x + 1.33, 0.45, z);
  place(I.kbd, x - 0.1, 0.965, z + 0.22); place(I.mouse, x + 0.48, 0.972, z + 0.25);
  const mi = place(I.mug, x - 1.0, 1.05, z + 0.1); I.mug.setColorAt(mi, new THREE.Color(MUGS[mi % MUGS.length]));
  place(I.seat, x, 0.6, z + 1.05); place(I.back, x, 1.0, z + 1.4); place(I.post, x, 0.33, z + 1.05); place(I.cbase, x, 0.02, z + 1.05);
  const lx = x + 1.18, lz = z - 0.42;                                      // lampa: stol burchagida, boshi stol markaziga qaragan
  place(I.lpost, lx, 1.42, lz); place(I.larm, lx - 0.22, 1.86, lz + 0.1, 0, 1, 1, 1, 0.35, 1.2);
  place(I.lhead, lx - 0.44, 1.76, lz + 0.18, 0, 1, 1, 1, 0.2, -0.25); place(I.lbulb, lx - 0.44, 1.7, lz + 0.18);
  const p1 = place(I.pool, lx - 0.45, 0.957, lz + 0.35, 0, 2.3, 2.3, 1, -Math.PI / 2); I.pool.setColorAt(p1, WARM.clone().multiplyScalar(0.7));
  const p2 = place(I.pool, x + 0.2, 0.016, z + 0.5, 0, 3.6, 3.6, 1, -Math.PI / 2); I.pool.setColorAt(p2, WARM.clone().multiplyScalar(0.18));
  const mons = [addScreen(x - (lead ? 0.15 : 0), 1.45, z - 0.45, 1.15, 0.65)];
  return { x, z, mons, lead };
}

// ---------- zonalar ----------
const signs = []; let kitchenInfo = null;
const addLight = (l, x, y, z) => { l.position.set(x, y, z); scene.add(l); return l; };
zones.forEach((z, i) => {
  const col = i % COLS, row = Math.floor(i / COLS);
  const cx = -totalW / 2 + ZONE_W / 2 + col * (ZONE_W + GAP), cz = -totalD / 2 + ZONE_D / 2 + row * (ZONE_D + GAP);
  z.center = new THREE.Vector3(cx, 0, cz); z.row = row;
  const c = new THREE.Color(z.color), wallZ = cz - ZONE_D / 2 + 0.1;
  // gilam + chegara
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(ZONE_W - 0.8, ZONE_D - 0.8), mat(new THREE.Color(0x14171e).lerp(c, 0.13).getHex(), { roughness: 1 }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(cx, 0.012, cz); rug.receiveShadow = true; scene.add(rug);
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(ZONE_W - 0.8, ZONE_D - 0.8)), new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.35 }));
  edge.rotation.x = -Math.PI / 2; edge.position.set(cx, 0.02, cz); scene.add(edge);
  // shisha toʻsiq (oʻngda, agar qoʻshni zona bor boʻlsa)
  if (col < COLS - 1 && i + 1 < zones.length) glassWall(scene, cx + ZONE_W / 2 + GAP / 2, cz - 3.9, cz + 2.9);
  let signPos;
  if (z.kitchen) {
    kitchenInfo = kitchen(scene, z, ZONE_W, ZONE_D, addLight, addPool); z.slots = kitchenInfo.slots; signPos = kitchenInfo.signPos;
  } else {
    // orqa devor: orqa qator — baland; oʻrta qator — past + shisha (orqadagi zona koʻrinsin)
    const tall = row === 0, wh = tall ? 3.2 : 1.1, ww = tall ? ZONE_W + GAP : ZONE_W - 0.8;
    box(ww, wh, 0.16, mat(tall ? 0x272c37 : 0x262b35, { roughness: 0.9 }), cx, wh / 2, wallZ, scene);
    box(ww, 0.08, 0.2, mat(0x3a4150), cx, wh + 0.04, wallZ, scene, false);
    if (!tall) { const gl = new THREE.Mesh(new THREE.PlaneGeometry(ww, 1.2), GLASS); gl.position.set(cx, wh + 0.68, wallZ); scene.add(gl); box(ww, 0.06, 0.08, mat(0x2a2e38), cx, wh + 1.3, wallZ, scene, false); }
    // neon chiziq (zona rangi): baland devorda yozuv ostida, past devorda shisha tepasida
    box(ZONE_W - 1.6, 0.05, 0.05, glow(z.color, 2.4), cx, tall ? 2.55 : wh + 1.22, wallZ + 0.12, scene, false);
    signPos = new THREE.Vector3(cx, tall ? 2.88 : 2.7, wallZ + 0.25);
    // axlat qutisi (old oʻng burchak)
    cyl(0.2, 0.17, 0.5, mat(0x2a2e38, { roughness: 0.6, metalness: 0.2 }), cx + 4.9, 0.25, cz + 4.15, scene, 12);
    // stollar: oldingi qator oʻng = yetakchi (konfigdagi xodim), qolgani vaqtinchalik xodimlar uchun
    z.desks = [];
    const order = [[1, 1], [1, 0], [0, 0], [0, 1]];
    for (const [r, k] of order) { const x = cx - 2.3 + k * 4.6, zz = cz - 2.1 + r * 3.9; z.desks.push(addDesk(x, zz, r === 1 && k === 1)); }
    const lead = z.desks[0];
    roleGear(scene, z, lead, wallZ, addScreen);
    // haqiqiy yorugʻlik faqat band stolda: iliq lampa (doim) + monitor nuri (faqat ishlayotganda)
    addLight(new THREE.PointLight(0xffb878, 3.2, 5.5, 2), lead.x + 0.74, 1.75, lead.z - 0.25);
    lead.light = addLight(new THREE.PointLight(c, 0, 4.5, 2), lead.x, 1.6, lead.z + 0.4);
    plant(scene, cx - 4.7, cz - 3.6, 1.0, i % 2); plant(scene, cx + 4.7, cz - 3.6, 0.85, (i + 1) % 2);
  }
  // zona yorligʻi — neon yozuv devorda (DOM: aniq matn)
  const [icon, title] = ZONE_TITLES[z.id] || ["•", z.name];
  const el = document.createElement("div"); el.className = "lod"; const inner = document.createElement("div"); inner.className = "zone-sign"; inner.style.setProperty("--c", z.color);
  inner.innerHTML = `<i>${icon}</i> ${title}`; el.appendChild(inner);
  const lab = new CSS2DObject(el); lab.position.copy(signPos); scene.add(lab); signs.push({ obj: lab, el: inner, s: -1 });
});
for (const im of Object.values(I)) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }

// ---------- xodimlar: holat faqat feed.js (SSE) dan ----------
const layout = { ZONE_W, ZONE_D, zones, kitchen: zones.find((z) => z.kitchen) };
const office = new Office(scene, layout, {
  setMonitor(desk, on, color) {
    const col = on ? color.clone().multiplyScalar(2.1) : MON_OFF;
    for (const i of desk.mons) I.screen.setColorAt(i, col);
    I.screen.instanceColor.needsUpdate = true;
    if (desk.light) desk.light.intensity = on ? 2.2 : 0;
  },
});
connectFeed(office);

// ---------- kamera: izometrik boshlangʻich holat (yaqinroq — xodimlar aniq koʻrinsin) ----------
const span = Math.max(totalW, totalD);
controls.target.set(0.5, 0.6, 1.0); camera.position.set(0.5 + 6.5, 18, 1.0 + 21.5);
const panLimit = new THREE.Box3(new THREE.Vector3(-totalW / 2, 0, -totalD / 2), new THREE.Vector3(totalW / 2, 2, totalD / 2));
controls.addEventListener("change", () => {
  const t = controls.target, cl = t.clone().clamp(panLimit.min, panLimit.max);
  camera.position.add(cl.clone().sub(t)); t.copy(cl);
});

// ---------- sifat (adaptiv): fps < 48 boʻlsa piksel nisbati pasayadi, keyin bloom oʻchadi ----------
let quality = 0;
function setQuality(q) {
  quality = q; const pr = Math.min(devicePixelRatio, [2, 1.5, 1.25, 1][q]);
  renderer.setPixelRatio(pr); composer.setPixelRatio(pr); bloom.enabled = q < 3;
  if (q >= 2) { sun.shadow.mapSize.set(1024, 1024); sun.shadow.map?.dispose(); sun.shadow.map = null; }
  resize();
}
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h); composer.setSize(w, h); labels.setSize(w, h);
  camera.aspect = w / h; camera.fov = w / h < 1 ? 58 : 38; camera.updateProjectionMatrix();
}
addEventListener("resize", resize); setQuality(0);

let prev = performance.now(), frames = 0, last = performance.now(), slow = 0;
const fpsEl = document.querySelector("#fps b");
function tick(now) {
  requestAnimationFrame(tick);
  controls.update();
  office.update(Math.min(0.1, (now - prev) / 1000), now / 1000, camera.position); prev = now;
  for (const s of signs) { const d = camera.position.distanceTo(s.obj.position), sc = d > 75 ? 0 : Math.min(1.2, Math.max(0.6, 28 / d)); if (Math.abs(sc - s.s) > 0.03) { s.s = sc; s.el.style.transform = `scale(${sc})`; s.el.style.opacity = sc ? 1 : 0; } }
  composer.render(); labels.render(scene, camera);
  frames++;
  if (now - last >= 1000) {
    const fps = Math.round(frames * 1000 / (now - last)); fpsEl.textContent = fps; frames = 0; last = now;
    if (fps < 48 && now > 4000) { if (++slow >= 3 && quality < 3) { setQuality(quality + 1); slow = 0; } } else slow = 0;
  }
}
requestAnimationFrame(tick);
window.__ofis3d = { scene, camera, controls, zones, renderer, office, composer, bloom, I };
