// 3D ofis — 1-bosqich: sahna, zonalar, stollar, monitorlar, kamera.
import * as THREE from "three";
import { OrbitControls } from "/web/vendor/three/OrbitControls.js";
import { Office } from "/web/3d/workers.js";
import { connectFeed } from "/web/3d/feed.js";
import { CSS2DRenderer, CSS2DObject } from "/web/vendor/three/CSS2DRenderer.js";

const FALLBACK = [
  { id: "rejissyor", name: "Rejissyor", color: "#0A84FF" },
  { id: "ovozchi", name: "Ovozchi", color: "#FF9F0A" },
  { id: "montajchi", name: "Montajchi", color: "#30D158" },
  { id: "motion", name: "Motion dizayner", color: "#BF5AF2" },
  { id: "rangchi", name: "Rangchi", color: "#FF375F" },
];
const ZONE_W = 11, ZONE_D = 9, GAP = 1.2, COLS = 3, ROWS_DESK = 2, COLS_DESK = 3;

async function loadAgents() {
  try { const c = await (await fetch("/api/config")).json(); if (c.agents?.length) return c.agents; } catch (e) { /* standart */ }
  return FALLBACK;
}

const stage = document.getElementById("stage");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07080b);
scene.fog = new THREE.Fog(0x07080b, 45, 95);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
stage.appendChild(renderer.domElement);
const labels = new CSS2DRenderer();
Object.assign(labels.domElement.style, { position: "absolute", inset: "0", pointerEvents: "none" });
stage.appendChild(labels.domElement);

const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 8; controls.maxDistance = 60;
controls.minPolarAngle = 0.35; controls.maxPolarAngle = Math.PI / 2 - 0.05;
controls.screenSpacePanning = false;

scene.add(new THREE.HemisphereLight(0x8fa4c8, 0x14161c, 0.9));
const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(12, 24, 10);
scene.add(sun);

const agents = await loadAgents();
const zones = [...agents.map((a) => ({ id: a.id, name: a.name, color: a.color })), { id: "oshxona", name: "Oshxona / Dam olish", color: "#66D4CF", kitchen: true }];
const rows = Math.ceil(zones.length / COLS);
const totalW = COLS * ZONE_W + (COLS - 1) * GAP, totalD = rows * ZONE_D + (rows - 1) * GAP;

// pol va to'r
const floor = new THREE.Mesh(new THREE.PlaneGeometry(totalW + 8, totalD + 8), new THREE.MeshStandardMaterial({ color: 0x0d0f14, roughness: 0.95 }));
floor.rotation.x = -Math.PI / 2; scene.add(floor);
const grid = new THREE.GridHelper(Math.max(totalW, totalD) + 8, Math.round(Math.max(totalW, totalD) + 8), 0x2a3140, 0x1a1e27);
grid.position.y = 0.01; grid.material.transparent = true; grid.material.opacity = 0.5; scene.add(grid);

// instanslar: stol va monitorlar
const nDesks = (zones.length - 1) * ROWS_DESK * COLS_DESK;
const deskMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 0.12, 1.2), new THREE.MeshStandardMaterial({ color: 0x2b303b, roughness: 0.7 }), nDesks);
const legGeo = new THREE.BoxGeometry(0.1, 0.75, 0.1);
const legMesh = new THREE.InstancedMesh(legGeo, new THREE.MeshStandardMaterial({ color: 0x1a1d24 }), nDesks * 4);
const monMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.0, 0.62, 0.06), new THREE.MeshBasicMaterial({ color: 0xffffff }), nDesks);
const chairMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.1, 0.7), new THREE.MeshStandardMaterial({ color: 0x3a4050, roughness: 0.8 }), nDesks);
const MON_OFF = new THREE.Color(0x0a0b0e);
const tmp = new THREE.Object3D();
let di = 0, li = 0;

zones.forEach((z, i) => {
  const col = i % COLS, row = Math.floor(i / COLS);
  const cx = -totalW / 2 + ZONE_W / 2 + col * (ZONE_W + GAP);
  const cz = -totalD / 2 + ZONE_D / 2 + row * (ZONE_D + GAP);
  z.center = new THREE.Vector3(cx, 0, cz);
  const c = new THREE.Color(z.color);

  const pad = new THREE.Mesh(new THREE.PlaneGeometry(ZONE_W, ZONE_D), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.07, depthWrite: false }));
  pad.rotation.x = -Math.PI / 2; pad.position.set(cx, 0.02, cz); scene.add(pad);
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(ZONE_W, ZONE_D)), new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.55 }));
  edge.rotation.x = -Math.PI / 2; edge.position.set(cx, 0.03, cz); scene.add(edge);

  const el = document.createElement("div");
  el.className = "zone-label"; el.style.setProperty("--c", z.color); el.textContent = z.name;
  const lab = new CSS2DObject(el); lab.position.set(cx - ZONE_W / 2 + 1.6, 0.2, cz + ZONE_D / 2 - 0.5); scene.add(lab);

  if (z.kitchen) {
    const table = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.12, 32), new THREE.MeshStandardMaterial({ color: 0x2b303b, roughness: 0.6 }));
    table.position.set(cx - 2, 0.8, cz); scene.add(table);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.8, 12), new THREE.MeshStandardMaterial({ color: 0x1a1d24 }));
    stem.position.set(cx - 2, 0.4, cz); scene.add(stem);
    const counter = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.95, 0.9), new THREE.MeshStandardMaterial({ color: 0x353b48, roughness: 0.7 }));
    counter.position.set(cx + 2.6, 0.475, cz - ZONE_D / 2 + 0.9); scene.add(counter);
    const sofa = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.6, 1.1), new THREE.MeshStandardMaterial({ color: c.clone().multiplyScalar(0.45), roughness: 0.9 }));
    sofa.position.set(cx + 2.4, 0.3, cz + 2.4); scene.add(sofa);
    return;
  }
  z.desks = [];
  for (let r = 0; r < ROWS_DESK; r++) for (let k = 0; k < COLS_DESK; k++) {
    const x = cx - ZONE_W / 2 + 2.1 + k * 3.45, zz = cz - 1.6 + r * 3.4;
    tmp.rotation.set(0, 0, 0); tmp.scale.set(1, 1, 1);
    tmp.position.set(x, 0.8, zz); tmp.updateMatrix(); deskMesh.setMatrixAt(di, tmp.matrix);
    for (const [dx, dz] of [[-1.1, -0.5], [1.1, -0.5], [-1.1, 0.5], [1.1, 0.5]]) {
      tmp.position.set(x + dx, 0.375, zz + dz); tmp.updateMatrix(); legMesh.setMatrixAt(li++, tmp.matrix);
    }
    tmp.position.set(x, 1.4, zz - 0.35); tmp.updateMatrix(); monMesh.setMatrixAt(di, tmp.matrix);
    monMesh.setColorAt(di, MON_OFF);
    z.desks.push({ x, z: zz, mon: di });
    tmp.position.set(x, 0.5, zz + 1.1); tmp.updateMatrix(); chairMesh.setMatrixAt(di, tmp.matrix);
    di++;
  }
});
const layout = { ZONE_W, ZONE_D, zones, kitchen: zones.find((z) => z.kitchen) };
for (const m of [deskMesh, legMesh, monMesh, chairMesh]) { m.instanceMatrix.needsUpdate = true; scene.add(m); }

// xodimlar: har bo'lim boshlig'i o'z stolida; holat faqat feed.js (SSE) dan
const office = new Office(scene, layout, {
  setMonitor(i, on, color) { monMesh.setColorAt(i, on ? color : MON_OFF); monMesh.instanceColor.needsUpdate = true; },
});
connectFeed(office);

// kamera: izometrik boshlang'ich holat
const span = Math.max(totalW, totalD);
const home = new THREE.Vector3(span * 0.62, span * 0.78, span * 0.78);
camera.position.copy(home); controls.target.set(0, 0, 0);
const panLimit = new THREE.Box3(new THREE.Vector3(-totalW / 2, 0, -totalD / 2), new THREE.Vector3(totalW / 2, 0, totalD / 2));
controls.addEventListener("change", () => {
  const t = controls.target, cl = t.clone().clamp(panLimit.min, panLimit.max);
  camera.position.add(cl.clone().sub(t)); t.copy(cl);
});

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h); labels.setSize(w, h);
  camera.aspect = w / h;
  // tor ekranda (telefon) hamma ofis ko'rinsin
  camera.fov = w / h < 1 ? 55 : 35; camera.updateProjectionMatrix();
}
addEventListener("resize", resize); resize();

let prev = performance.now();
let frames = 0, last = performance.now();
const fpsEl = document.querySelector("#fps b");
function tick(now) {
  requestAnimationFrame(tick);
  controls.update();
  office.update(Math.min(0.1, (now - prev) / 1000), now / 1000); prev = now;
  renderer.render(scene, camera); labels.render(scene, camera);
  frames++;
  if (now - last >= 1000) { fpsEl.textContent = Math.round(frames * 1000 / (now - last)); frames = 0; last = now; }
}
requestAnimationFrame(tick);
window.__ofis3d = { scene, camera, controls, zones, renderer, office };
