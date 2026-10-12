// 2b-bosqich: umumiy materiallar (kesh), teksturalar, interyer (oʻsimlik, shisha, devor), oshxona va kasbga mos jihozlar.
// Hamma material MeshStandardMaterial va kesh orqali — bir xil rang bitta material (tezlik).
import * as THREE from "three";

const cache = new Map();
export function mat(hex, o = {}) {
  const key = hex + "|" + JSON.stringify(o);
  let m = cache.get(key);
  if (!m) { m = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.85, metalness: 0, ...o }); cache.set(key, m); }
  return m;
}
export const glow = (hex, i = 2.2) => mat(hex, { emissive: hex, emissiveIntensity: i, roughness: 0.4 });
export const GLASS = new THREE.MeshStandardMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.11, roughness: 0.08, metalness: 0, side: THREE.DoubleSide, depthWrite: false });

export function box(w, h, d, m, x, y, z, parent, shadow = true) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z);
  o.castShadow = shadow; o.receiveShadow = shadow; parent.add(o); return o;
}
export function cyl(rt, rb, h, m, x, y, z, parent, seg = 16, shadow = true) {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); o.position.set(x, y, z);
  o.castShadow = shadow; o.receiveShadow = shadow; parent.add(o); return o;
}
export function sph(r, m, x, y, z, parent, seg = 10) {
  const o = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(6, seg - 2)), m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o;
}

// ---------- teksturalar ----------
export function poolTexture() { // lampaning stol/polga tushgan iliq yorugʻlik doirasi (soxta yorugʻlik)
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
  const r = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.3, "rgba(255,255,255,.5)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
export function screenTexture() { // montaj dasturi: yuqori panel, chap panel, qatlamlar, timeline — oq/kulrang, instans rangi bilan boʻyaladi
  const W = 256, H = 160, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
  let seed = 11; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  g.fillStyle = "#07080b"; g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(255,255,255,.16)"; g.fillRect(0, 0, W, 12);
  g.fillStyle = "rgba(255,255,255,.07)"; g.fillRect(0, 12, 46, H - 12);
  for (let y = 22; y < 94; y += 9) { g.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.55})`; g.fillRect(56 + rnd() * 24, y, 30 + rnd() * 140, 4); }
  g.fillStyle = "rgba(255,255,255,.1)"; g.fillRect(46, 100, W - 46, H - 100);
  for (let i = 0; i < 3; i++) { let x = 50; while (x < W - 8) { const w = 10 + rnd() * 42; g.fillStyle = `rgba(255,255,255,${0.4 + rnd() * 0.5})`; g.fillRect(x, 106 + i * 17, Math.min(w - 2, W - 4 - x), 12); x += w; } }
  g.fillStyle = "#fff"; g.fillRect(150, 98, 2, H - 98);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- oʻsimlik ----------
const LEAF = [0x2e7d4f, 0x3f9d5a, 0x27694a];
export function plant(parent, x, z, s = 1, kind = 0) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s);
  cyl(0.3, 0.24, 0.55, mat(0x3a2f2a), 0, 0.275, 0, g, 12);
  cyl(0.28, 0.28, 0.04, mat(0x1f1a17), 0, 0.56, 0, g, 12, false);
  if (kind === 0) {
    for (const [dx, dy, dz, r, k] of [[0, 1.05, 0, 0.46, 0], [-0.32, 0.9, 0.14, 0.3, 1], [0.3, 0.95, -0.12, 0.33, 2], [0.04, 1.4, 0.08, 0.3, 1], [-0.1, 0.8, -0.3, 0.25, 0]])
      sph(r, mat(LEAF[k]), dx, dy, dz, g, 8);
  } else {
    cyl(0.05, 0.08, 1.3, mat(0x5a4330), 0, 1.2, 0, g, 6);
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2, l = new THREE.Mesh(new THREE.ConeGeometry(0.13, 1.0, 5), mat(LEAF[i % 3]));
      l.position.set(Math.sin(a) * 0.38, 1.95, Math.cos(a) * 0.38); l.rotation.set(1.15, a, 0, "YXZ"); l.castShadow = true; g.add(l);
    }
  }
  parent.add(g); return g;
}

// ---------- shisha toʻsiq (ikki zona orasida) ----------
export function glassWall(parent, x, z0, z1, h = 2.0) {
  const len = z1 - z0, zc = (z0 + z1) / 2, frame = mat(0x2a2e38, { roughness: 0.5, metalness: 0.3 });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(len, h - 0.3), GLASS); p.rotation.y = Math.PI / 2; p.position.set(x, 0.3 + (h - 0.3) / 2, zc); parent.add(p);
  box(0.06, 0.06, len, frame, x, h, zc, parent, false); box(0.06, 0.3, len, frame, x, 0.15, zc, parent, false);
  for (const zz of [z0, zc, z1]) box(0.07, h, 0.07, frame, x, h / 2, zz, parent, false);
}

// ---------- oshxona / dam olish ----------
// Qaytaradi: AFK joylar (slots) — har xodim indeksiga pozitsiya, yoʻl (via) va qaragan nuqta (face).
export function kitchen(parent, zone, ZONE_W, ZONE_D, addLight, addPool) {
  const { x: cx, z: cz } = zone.center, c = new THREE.Color(zone.color), g = new THREE.Group(); parent.add(g);
  const oak = mat(0x8a6a48, { roughness: 0.6 }), dark = mat(0x1d2027), steel = mat(0xb9c0c8, { roughness: 0.35, metalness: 0.15 });
  // gilam
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 6.4), mat(0x16302e, { roughness: 1 })); rug.rotation.x = -Math.PI / 2; rug.position.set(cx - 1.2, 0.012, cz + 0.6); rug.receiveShadow = true; g.add(rug);
  // dumaloq stol + 2 stul
  const tx = cx - 2, tz = cz;
  cyl(0.95, 0.95, 0.08, oak, tx, 0.95, tz, g, 28); cyl(0.07, 0.07, 0.9, dark, tx, 0.47, tz, g, 10); cyl(0.42, 0.46, 0.04, dark, tx, 0.02, tz, g, 20);
  for (const sx of [-1.4, 1.4]) { cyl(0.3, 0.3, 0.07, mat(c.getHex() & 0xffffff, { roughness: 0.9 }), tx + sx, 0.64, tz, g, 14); cyl(0.04, 0.04, 0.6, dark, tx + sx, 0.31, tz, g, 8); cyl(0.26, 0.28, 0.03, dark, tx + sx, 0.015, tz, g, 14); }
  // peshtaxta (oʻng chekka) + qahva mashinasi + suv idishi
  const kx = cx + 4.6;
  box(0.9, 0.95, 4.2, mat(0x2a2f3a, { roughness: 0.7 }), kx, 0.475, cz - 1.3, g); box(0.98, 0.05, 4.3, mat(0x3a4150, { roughness: 0.5 }), kx, 0.975, cz - 1.3, g);
  const mx = kx, mz = cz - 2.5; // qahva mashinasi
  box(0.55, 0.78, 0.6, mat(0x20232a, { roughness: 0.5 }), mx, 1.39, mz, g); box(0.5, 0.06, 0.4, mat(0x3a3f4a), mx, 1.03, mz + 0.1, g, false);
  const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.09), glow(0x66d4cf, 1.4)); disp.rotation.y = -Math.PI / 2; disp.position.set(mx - 0.281, 1.6, mz); g.add(disp);
  sph(0.025, glow(0xff453a, 2.5), mx - 0.28, 1.46, mz + 0.16, g, 6);
  cyl(0.05, 0.045, 0.1, mat(0xf2f2f4, { roughness: 0.4 }), mx - 0.12, 1.11, mz + 0.12, g, 10); // chashka
  box(0.42, 0.12, 0.42, dark, kx, 1.06, cz + 0.4, g); cyl(0.17, 0.17, 0.5, GLASS, kx, 1.37, cz + 0.4, g, 14, false); // suv idishi
  // muzlatgich
  box(0.85, 1.9, 0.82, steel, kx, 0.95, cz + 1.9, g); box(0.03, 0.9, 0.04, dark, kx - 0.44, 1.2, cz + 1.6, g, false);
  // divan + kichik stol
  const sx = cx + 2.2, sz = cz + 2.9, sofa = mat(new THREE.Color(zone.color).multiplyScalar(0.42).getHex(), { roughness: 0.95 }), cush = mat(new THREE.Color(zone.color).multiplyScalar(0.62).getHex(), { roughness: 0.95 });
  box(3.1, 0.42, 1.15, sofa, sx, 0.26, sz, g); box(3.1, 0.62, 0.3, sofa, sx, 0.76, sz + 0.43, g);
  for (const ax of [-1.4, 1.4]) box(0.3, 0.62, 1.15, sofa, sx + ax, 0.5, sz, g);
  for (const px of [-0.66, 0.66]) box(1.2, 0.2, 0.85, cush, sx + px, 0.57, sz - 0.05, g);
  box(1.3, 0.05, 0.65, oak, sx, 0.46, sz - 1.4, g); for (const [lx, lz] of [[-0.55, -0.25], [0.55, -0.25], [-0.55, 0.25], [0.55, 0.25]]) box(0.05, 0.44, 0.05, dark, sx + lx, 0.22, sz - 1.4 + lz, g, false);
  // osma lampa (stol ustida) — haqiqiy nuqtaviy yorugʻlik
  cyl(0.01, 0.01, 1.7, dark, tx, 3.25, tz, g, 4, false);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.5, 0.4, 20, 1, true), mat(0x23262d, { side: THREE.DoubleSide, roughness: 0.6 })); shade.position.set(tx, 2.3, tz); g.add(shade);
  sph(0.08, glow(0xffc27a, 3.2), tx, 2.2, tz, g, 10);
  addLight(new THREE.PointLight(0xffd2a0, 7, 9, 2), tx, 2.1, tz); addPool(tx, 0.017, tz, 5.5, 0.22);
  // ikkinchi yorugʻlik: divan va peshtaxta tomoni
  addLight(new THREE.PointLight(0xffd2a0, 4.5, 9, 2), cx + 3.0, 2.9, cz + 0.8); addPool(cx + 3.0, 0.017, cz + 0.8, 6.5, 0.16);
  // oʻsimliklar
  plant(g, cx - 4.6, cz + 3.6, 1.1, 1); plant(g, cx + 3.4, cz - 3.9, 0.9, 0);
  // qisman orqa devor (oʻng tomon) — belgi uchun; chap tomon ochiq (kirish)
  const wz = cz - ZONE_D / 2 + 0.1;
  box(4.2, 2.8, 0.16, mat(0x272c37, { roughness: 0.9 }), cx + 3.2, 1.4, wz, g); box(4.2, 0.08, 0.2, mat(0x3a4150), cx + 3.2, 2.84, wz, g, false);
  box(3.6, 0.05, 0.05, glow(zone.color, 2.4), cx + 3.2, 2.62, wz + 0.12, g, false);
  box(2.4, 0.04, 0.3, oak, cx + 3.2, 1.7, wz + 0.2, g); // tokcha + idishlar
  for (let i = 0; i < 4; i++) cyl(0.06, 0.05, 0.14, mat([0xf2f2f4, 0x0a84ff, 0xff9f0a, 0x30d158][i], { roughness: 0.5 }), cx + 2.3 + i * 0.6, 1.79, wz + 0.2, g, 10, false);
  // AFK joylar (stol atrofida; yoʻl stol orqali oʻtmaydi)
  const ring = (deg, r = 1.7) => new THREE.Vector3(tx + Math.sin(deg * Math.PI / 180) * r, 0, tz + Math.cos(deg * Math.PI / 180) * r);
  const T = new THREE.Vector3(tx, 0, tz);
  const slots = [
    { pos: ring(200), face: T }, { pos: ring(160), face: T },
    { pos: new THREE.Vector3(kx - 0.9, 0, mz), via: [new THREE.Vector3(cx + 0.2, 0, mz)], face: new THREE.Vector3(kx, 0, mz) },
    { pos: ring(340), face: T }, { pos: ring(20), face: T },
    { pos: new THREE.Vector3(sx - 0.7, 0, sz - 0.9), face: new THREE.Vector3(sx - 0.7, 0, sz) }, { pos: new THREE.Vector3(sx + 0.7, 0, sz - 0.9), face: new THREE.Vector3(sx + 0.7, 0, sz) },
  ];
  return { slots, signPos: new THREE.Vector3(cx + 3.2, 2.2, wz + 0.25) };
}

// ---------- kasbga mos jihozlar (yetakchi stol yonida / zona devorida) ----------
// addScreen(x,y,z,w,h,ry) → instans indeksi; desk.mons ga qoʻshiladi (ishlayotganda yonadi).
export function roleGear(parent, zone, desk, wallZ, addScreen) {
  const { x, z } = desk, cx = zone.center.x, g = new THREE.Group(); parent.add(g);
  const dark = mat(0x1a1c22, { roughness: 0.5 }), metal = mat(0x8b919c, { roughness: 0.4, metalness: 0.3 });
  switch (zone.id) {
    case "ovozchi": { // mikrofon stoyka + audio interfeys + devorda akustik panellar
      const sx = x + 1.95, sz = z + 0.75;
      cyl(0.26, 0.3, 0.04, dark, sx, 0.02, sz, g, 14); cyl(0.025, 0.025, 1.7, metal, sx, 0.87, sz, g, 8);
      const boom = cyl(0.02, 0.02, 0.9, metal, sx - 0.38, 1.78, sz - 0.2, g, 8); boom.rotation.set(0.5, 0, 1.2);
      const mic = cyl(0.07, 0.07, 0.28, dark, sx - 0.78, 1.68, sz - 0.42, g, 12); mic.rotation.set(0.5, 0, 1.2);
      const pop = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.012, 6, 20), dark); pop.position.set(sx - 0.95, 1.6, sz - 0.5); pop.rotation.y = 0.9; g.add(pop);
      box(0.4, 0.07, 0.22, dark, x + 0.72, 0.985, z + 0.22, g); for (let i = 0; i < 4; i++) sph(0.016, glow([0x30d158, 0x30d158, 0xff9f0a, 0xff453a][i], 2), x + 0.56 + i * 0.1, 1.03, z + 0.3, g, 5);
      for (const [px, py] of [[-1.3, 1.0], [-0.1, 1.0], [-1.3, 1.95], [-0.1, 1.95]]) box(0.9, 0.9, 0.08, mat(0x2a2520, { roughness: 1 }), cx + px + 0.7, py, wallZ + 0.1, g);
      break;
    }
    case "montajchi": { // ikkinchi monitor + jog-wheel
      desk.mons.push(addScreen(x + 1.0, 1.45, z - 0.38, 1.15, 0.65, -0.32, true));
      cyl(0.16, 0.16, 0.05, dark, x + 0.75, 0.99, z + 0.3, g, 20); cyl(0.11, 0.11, 0.03, mat(0x3a3f4a), x + 0.75, 1.03, z + 0.3, g, 20, false);
      box(0.9, 0.05, 0.05, mat(0x2a2e38), cx, 2.5, wallZ + 0.1, g, false);
      for (let i = 0; i < 5; i++) box(0.6, 0.36, 0.03, mat([0x0a84ff, 0x30d158, 0xff9f0a, 0xbf5af2, 0xff375f][i], { roughness: 0.6 }), cx - 1.8 + i * 0.9, 1.9, wallZ + 0.1, g, false);
      break;
    }
    case "rangchi": { // rang paneli (3 trekbol) + devorda rang palitrasi
      box(0.95, 0.06, 0.42, dark, x + 0.3, 0.98, z + 0.22, g);
      for (let i = 0; i < 3; i++) { sph(0.085, mat(0xd8dbe0, { roughness: 0.25 }), x + 0.02 + i * 0.28, 1.05, z + 0.26, g, 10); for (let k = 0; k < 3; k++) cyl(0.025, 0.025, 0.03, mat(0x3a3f4a), x - 0.08 + i * 0.28 + k * 0.1, 1.02, z + 0.07, g, 8, false); }
      for (let i = 0; i < 7; i++) box(0.55, 0.9, 0.03, glow([0xff375f, 0xff9f0a, 0xffd60a, 0x30d158, 0x64d2ff, 0x0a84ff, 0xbf5af2][i], 0.45), cx - 2.1 + i * 0.7, 1.7, wallZ + 0.1, g, false);
      break;
    }
    case "motion": { // planshet + stilus + devorda ramkali grafikalar
      const t = box(0.72, 0.03, 0.46, dark, x + 0.95, 0.975, z + 0.3, g); t.rotation.y = 0.12;
      const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.36), mat(0x2f3340, { roughness: 0.3 })); sc.rotation.set(-Math.PI / 2, 0, 0.12); sc.position.set(x + 0.95, 0.992, z + 0.3); g.add(sc);
      const pen = cyl(0.012, 0.012, 0.3, mat(0xe8e8ec, { roughness: 0.4 }), x + 1.05, 1.0, z + 0.25, g, 6, false); pen.rotation.set(Math.PI / 2, 0, 0.6);
      for (let i = 0; i < 3; i++) { box(1.0, 0.7, 0.04, mat(0x2a2e38), cx - 1.3 + i * 1.3, 1.7, wallZ + 0.1, g, false); box(0.86, 0.56, 0.02, mat([0x3b2a6b, 0x1e3d5a, 0x4a1e4a][i], { roughness: 0.8 }), cx - 1.3 + i * 1.3, 1.7, wallZ + 0.14, g, false); }
      break;
    }
    case "rejissyor": { // klapper + devorda katta ekran
      const k = new THREE.Group(); k.position.set(x - 1.0, 0.95, z - 0.15); k.rotation.y = -0.4; g.add(k);
      box(0.44, 0.3, 0.03, dark, 0, 0.15, 0, k);
      const bar = new THREE.Group(); bar.position.set(-0.22, 0.3, 0); bar.rotation.z = 0.45; k.add(bar);
      for (let i = 0; i < 6; i++) box(0.0733, 0.07, 0.035, i % 2 ? dark : mat(0xe9e9ec, { roughness: 0.5 }), 0.0367 + i * 0.0733, 0.035, 0, bar, false);
      box(3.7, 1.95, 0.1, mat(0x14161b, { roughness: 0.5 }), cx, 1.45, wallZ + 0.12, g);
      desk.mons.push(addScreen(cx, 1.45, wallZ + 0.18, 3.5, 1.78, 0, false));
      break;
    }
  }
}
