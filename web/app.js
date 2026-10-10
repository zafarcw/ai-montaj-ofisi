/* AI Montaj Ofisi — sahifa mantig'i. Hamma holat faqat serverdan kelgan haqiqiy hodisalardan. */
(() => {
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtTime = (ts) => { const d = new Date((ts || 0) * 1000); return d.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" }); };
const fileUrl = (p) => "/api/file?path=" + encodeURIComponent(p);
const VIDEO_EXT = /\.(mp4|mov|m4v|mkv|webm|avi|mts|m2ts)$/i;
const STATUS_UZ = { new: "Yangi", queued: "Navbatda", running: "Ishlayapti", done: "Tayyor", error: "Xato", cancelled: "Bekor qilindi", cancelling: "Bekor qilinmoqda" };

const state = {
  cfg: null, jobs: [], job: null, es: null, esJob: null, eventsSeen: 0,
  agents: {}, segments: [], decisions: 0, logCount: 0, replayTimer: null, replaying: false,
  monitorMode: "", lastStatus: null, uploads: [], selectedSources: [],
};

// ---------- umumiy ----------
async function api(path, opts = {}) {
  const r = await fetch(path, { headers: { "Content-Type": "application/json" }, ...opts });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
}
let toastT = null;
function toast(msg, err = false) {
  const t = $("#toast"); t.textContent = msg; t.className = "toast" + (err ? " err" : ""); t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), err ? 5000 : 2600);
}
function applyTheme(cfg) {
  document.documentElement.style.setProperty("--accent", cfg.accent || "#0A84FF");
  $("#site-name").textContent = cfg.name || "AI Montaj Ofisi";
  document.title = cfg.name || "AI Montaj Ofisi";
  const img = $("#logo-img"), mark = $("#logo-mark");
  if (cfg.logo) { img.src = cfg.logo; img.hidden = false; mark.hidden = true; img.onerror = () => { img.hidden = true; mark.hidden = false; }; }
  else { img.hidden = true; mark.hidden = false; }
}
function tickClock() { $("#clock").textContent = new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" }); }
setInterval(tickClock, 1000); tickClock();

// ---------- personajlar (original SVG) ----------
function fig(id, c) {
  const skin = "#E8C39E", skin2 = "#D9A87C", hair = "#2b2b30";
  const base = (extra, headExtra = "", deskExtra = "") => `
<svg class="fig" viewBox="0 0 120 92" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="g-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="${c}" stop-opacity=".65"/></linearGradient></defs>
  <ellipse cx="60" cy="86" rx="46" ry="5" fill="${c}" opacity=".12"/>
  <rect x="18" y="66" width="84" height="8" rx="4" fill="#2c2c2e"/>
  <rect x="42" y="50" width="36" height="17" rx="3" fill="#3a3a3c"/>
  <rect class="screen" x="45" y="52" width="30" height="12" rx="2" fill="${c}" opacity=".55"/>
  ${deskExtra}
  <rect x="38" y="36" width="44" height="34" rx="12" fill="url(#g-${id})"/>
  <circle class="hand-l" cx="46" cy="64" r="4.5" fill="${skin}"/>
  <circle class="hand-r" cx="74" cy="64" r="4.5" fill="${skin}"/>
  <g class="head">
    <rect x="54" y="28" width="12" height="10" rx="4" fill="${skin2}"/>
    <circle cx="60" cy="20" r="15" fill="${skin}"/>
    ${headExtra}
    <ellipse class="eye-l" cx="54" cy="21" rx="1.8" ry="2.2" fill="#1c1c1e"/>
    <ellipse class="eye-r" cx="66" cy="21" rx="1.8" ry="2.2" fill="#1c1c1e"/>
    <path d="M56 27 q4 3 8 0" stroke="#b5775a" stroke-width="1.4" fill="none" stroke-linecap="round"/>
  </g>
  ${extra}
</svg>`;
  switch (id) {
    case "rejissyor": // beret + klapper
      return base(
        `<g transform="translate(8 44)"><rect x="0" y="4" width="22" height="16" rx="2" fill="#1c1c1e" stroke="${c}" stroke-width="1.2"/><path d="M0 4 l22 0 l-3 -6 l-22 0z" fill="${c}"/><path d="M2 -1l3 5M8 -1l3 5M14 -1l3 5" stroke="#1c1c1e" stroke-width="1.4"/></g>`,
        `<path d="M44 14 q16 -14 32 -2 q-6 -4 -16 -3 q-10 1 -16 5z" fill="${hair}"/><path d="M45 12 q15 -16 34 -4 l-2 4 q-16 -8 -30 2z" fill="${c}"/>`
      );
    case "ovozchi": // naushnik + to'lqin
      return base(
        `<g class="wave" transform="translate(88 48)"><rect x="0" y="6" width="3" height="12" rx="1.5" fill="${c}"/><rect x="5" y="2" width="3" height="16" rx="1.5" fill="${c}"/><rect x="10" y="8" width="3" height="10" rx="1.5" fill="${c}"/><rect x="15" y="0" width="3" height="18" rx="1.5" fill="${c}"/><rect x="20" y="6" width="3" height="12" rx="1.5" fill="${c}"/></g>`,
        `<path d="M46 8 q14 -14 28 0" stroke="#1c1c1e" stroke-width="3" fill="none"/><rect x="42" y="14" width="7" height="12" rx="3" fill="${c}"/><rect x="71" y="14" width="7" height="12" rx="3" fill="${c}"/><path d="M48 6 q12 -10 24 0" stroke="${c}" stroke-width="1.2" fill="none"/>`
      );
    case "montajchi": // ko'zoynak + plyonka
      return base(
        `<g transform="translate(6 46)"><rect x="0" y="0" width="26" height="14" rx="2" fill="#1c1c1e" stroke="${c}" stroke-width="1.2"/><rect x="3" y="2" width="4" height="3" fill="${c}"/><rect x="11" y="2" width="4" height="3" fill="${c}"/><rect x="19" y="2" width="4" height="3" fill="${c}"/><rect x="3" y="9" width="4" height="3" fill="${c}"/><rect x="11" y="9" width="4" height="3" fill="${c}"/><rect x="19" y="9" width="4" height="3" fill="${c}"/></g>`,
        `<path d="M45 10 q15 -12 30 0 l-2 6 q-13 -8 -26 0z" fill="${hair}"/><circle cx="54" cy="21" r="5" fill="none" stroke="${c}" stroke-width="1.6"/><circle cx="66" cy="21" r="5" fill="none" stroke="${c}" stroke-width="1.6"/><path d="M59 21h2" stroke="${c}" stroke-width="1.6"/>`
      );
    case "motion": // sochtaroq + planshet + uchqun
      return base(
        `<g transform="translate(86 44)"><rect x="0" y="4" width="26" height="18" rx="3" fill="#1c1c1e" stroke="${c}" stroke-width="1.2"/><path d="M5 16 q6 -10 16 -2" stroke="${c}" stroke-width="1.6" fill="none" stroke-linecap="round"/><g class="sparkle"><path d="M20 2 l1.2 3 l3 1.2 l-3 1.2 l-1.2 3 l-1.2 -3 l-3 -1.2 l3 -1.2z" fill="${c}"/></g></g>`,
        `<path d="M44 12 q6 -16 20 -10 q8 2 12 10 q-6 -5 -14 -4 q-10 1 -18 4z" fill="${hair}"/><path d="M62 3 q8 -4 12 4" stroke="${c}" stroke-width="2" fill="none" stroke-linecap="round"/>`
      );
    case "rangchi": // kepka + rang doirasi
      return base(
        `<g class="spin" transform="translate(10 44)"><circle cx="14" cy="14" r="12" fill="#1c1c1e" stroke="${c}" stroke-width="1.2"/><path d="M14 14 L14 2 A12 12 0 0 1 24.4 8z" fill="#FF453A"/><path d="M14 14 L24.4 8 A12 12 0 0 1 24.4 20z" fill="#FF9F0A"/><path d="M14 14 L24.4 20 A12 12 0 0 1 14 26z" fill="#30D158"/><path d="M14 14 L14 26 A12 12 0 0 1 3.6 20z" fill="#64D2FF"/><path d="M14 14 L3.6 20 A12 12 0 0 1 3.6 8z" fill="#0A84FF"/><path d="M14 14 L3.6 8 A12 12 0 0 1 14 2z" fill="#BF5AF2"/><circle cx="14" cy="14" r="4" fill="#1c1c1e"/></g>`,
        `<path d="M44 14 q16 -14 32 0 l0 3 l-32 0z" fill="${c}"/><path d="M74 15 l12 1 l-1 3 l-11 -1z" fill="${c}"/><circle cx="60" cy="9" r="2" fill="#fff" opacity=".6"/>`
      );
    default:
      return base("", `<path d="M45 12 q15 -14 30 0 l-2 5 q-13 -8 -26 0z" fill="${hair}"/>`);
  }
}

function renderAgents() {
  const box = $("#agents");
  box.innerHTML = state.cfg.agents.map((a) => `
    <div class="agent idle" id="agent-${a.id}" data-agent="${a.id}" style="--c:${a.color}">
      <div class="agent-top"><span class="agent-dot"></span><span class="agent-name">${esc(a.name)}</span><span class="agent-role" title="${esc(a.role || "")}">${esc(a.role || "")}</span></div>
      <div class="agent-fig">${fig(a.id, a.color)}<span class="badge ok">✓</span><span class="badge err">!</span></div>
      <div class="bubble" data-empty="1">${esc(a.id === "rejissyor" ? "Ish kutilmoqda" : "Kutmoqda")}</div>
      <div class="agent-progress"><i></i></div>
      <div class="chips"></div>
    </div>`).join("");
  state.agents = {};
  state.cfg.agents.forEach((a) => (state.agents[a.id] = { state: "idle", text: "", pct: null, metrics: {} }));
}
function agentEl(id) { return $("#agent-" + id); }
function resetAgents() {
  for (const a of state.cfg.agents) {
    const el = agentEl(a.id); if (!el) continue;
    el.className = "agent idle";
    $(".bubble", el).textContent = a.id === "rejissyor" ? "Ish kutilmoqda" : "Kutmoqda";
    $(".agent-progress i", el).style.width = "0";
    $(".chips", el).innerHTML = "";
    state.agents[a.id] = { state: "idle", text: "", pct: null, metrics: {} };
  }
}
function updateAgent(ev, live) {
  const id = ev.agent; const el = agentEl(id); if (!el) return;
  const st = state.agents[id] || (state.agents[id] = { metrics: {} });
  if (ev.state) { st.state = ev.state; el.classList.remove("idle", "working", "done", "error"); el.classList.add(ev.state); }
  if (ev.text) {
    st.text = ev.text; const b = $(".bubble", el); b.textContent = ev.text; b.removeAttribute("data-empty");
    if (live) { b.classList.remove("in"); void b.offsetWidth; b.classList.add("in"); }
  }
  if (ev.pct != null) { st.pct = ev.pct; $(".agent-progress i", el).style.width = Math.max(0, Math.min(100, ev.pct)) + "%"; }
  if (ev.state === "done") $(".agent-progress i", el).style.width = "100%";
  if (ev.metrics) {
    Object.assign(st.metrics, ev.metrics);
    const chips = Object.entries(st.metrics).filter(([, v]) => v !== null && v !== undefined && v !== "").slice(-5);
    $(".chips", el).innerHTML = chips.map(([k, v]) => `<span class="chip" title="${esc(k)}">${esc(k)} ${esc(typeof v === "number" ? (Number.isInteger(v) ? v : v.toFixed(1)) : v)}</span>`).join("");
  }
}

// ---------- handoff animatsiyasi ----------
function handoff(from, to) {
  const a = agentEl(from), b = agentEl(to); if (!a || !b) return;
  const layer = $("#handoff-layer"); const lr = layer.getBoundingClientRect();
  const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
  const x1 = ra.left + ra.width / 2 - lr.left, y1 = ra.top + ra.height * 0.55 - lr.top;
  const x2 = rb.left + rb.width / 2 - lr.left, y2 = rb.top + rb.height * 0.55 - lr.top;
  const cx = (x1 + x2) / 2, cy = Math.min(y1, y2) - 46;
  const color = (state.cfg.agents.find((x) => x.id === to) || {}).color || "#fff";
  const ns = "http://www.w3.org/2000/svg";
  const path = document.createElementNS(ns, "path"); path.setAttribute("d", `M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}`); path.setAttribute("stroke", color);
  const dot = document.createElementNS(ns, "circle"); dot.setAttribute("r", "5"); dot.setAttribute("fill", color); dot.style.color = color;
  layer.appendChild(path); layer.appendChild(dot);
  const len = path.getTotalLength(); const t0 = performance.now(); const dur = 900;
  const ease = (t) => 1 - Math.pow(1 - t, 4);
  (function step(now) {
    const t = Math.min(1, (now - t0) / dur); const p = path.getPointAtLength(ease(t) * len);
    dot.setAttribute("cx", p.x); dot.setAttribute("cy", p.y); path.style.opacity = String(0.7 * (1 - t * 0.6));
    if (t < 1) requestAnimationFrame(step); else { b.animate([{ transform: "translateY(-2px) scale(1)" }, { transform: "translateY(-6px) scale(1.02)" }, { transform: "translateY(-2px) scale(1)" }], { duration: 500, easing: "cubic-bezier(.16,1,.3,1)" }); setTimeout(() => { path.remove(); dot.remove(); }, 250); }
  })(t0);
}

// ---------- monitor / timeline ----------
function showVideo(path, label) {
  const v = $("#video"), s = $("#still");
  s.hidden = true; $("#monitor-empty").hidden = true;
  if (state.monitorMode !== "video:" + path) { v.src = fileUrl(path); v.load(); state.monitorMode = "video:" + path; }
  v.hidden = false; const l = $("#monitor-label"); l.textContent = label; l.hidden = false;
}
function showStill(path, label) {
  const v = $("#video"), s = $("#still");
  v.hidden = true; $("#monitor-empty").hidden = true; s.src = fileUrl(path) + "&_=" + Date.now(); s.hidden = false; state.monitorMode = "still:" + path;
  const l = $("#monitor-label"); l.textContent = label; l.hidden = false;
}
function clearMonitor() {
  const v = $("#video"); v.pause(); v.removeAttribute("src"); v.hidden = true; $("#still").hidden = true; $("#monitor-empty").hidden = false; $("#monitor-label").hidden = true; $("#render-overlay").hidden = true; state.monitorMode = "";
}
function setFormat(fmt) { $("#monitor").className = "monitor " + (fmt === "16:9" ? "fmt-16x9" : fmt === "1:1" ? "fmt-1x1" : "fmt-9x16"); }
function renderOverlay(ev) {
  const o = $("#render-overlay"); const pct = ev.pct == null ? null : Math.max(0, Math.min(100, ev.pct));
  if (ev.state === "done" || ev.state === "error") { setTimeout(() => (o.hidden = true), ev.state === "done" ? 1200 : 0); if (ev.state === "done") { $("#render-arc").style.strokeDashoffset = "0"; $("#render-pct").textContent = "100%"; $("#render-text").textContent = ev.text || "Render tugadi"; } return; }
  o.hidden = false; $("#render-text").textContent = ev.text || "Render";
  if (pct != null) { $("#render-arc").style.strokeDashoffset = String(97.4 * (1 - pct / 100)); $("#render-pct").textContent = Math.round(pct) + "%"; }
  else { const m = ev.metrics || {}; $("#render-pct").textContent = m.kadr ? String(m.kadr) : "…"; }
}
function drawTimeline(segs) {
  state.segments = segs || [];
  const tl = $("#timeline"); $$(".seg", tl).forEach((e) => e.remove());
  if (!segs || !segs.length) { $("#tl-info").textContent = "EDL kutilmoqda"; return; }
  const total = Math.max(...segs.map((s) => s.t1)) || 1;
  segs.forEach((s, i) => {
    const d = document.createElement("div"); d.className = "seg " + (s.kind || "clip");
    d.style.left = (s.t0 / total * 100) + "%"; d.style.width = Math.max(0.4, (s.t1 - s.t0) / total * 100) + "%"; d.style.animationDelay = (i * 40) + "ms";
    d.title = `${s.t0.toFixed(2)}–${s.t1.toFixed(2)} s ${s.src ? "· " + s.src.split("/").pop() : ""} ${s.label || ""}`; d.textContent = s.label || (s.src ? s.src.split("/").pop() : "");
    tl.appendChild(d);
  });
  $("#tl-info").textContent = `${segs.length} kesim · ${total.toFixed(1)} s`;
}
$("#video").addEventListener("timeupdate", () => {
  const v = $("#video"); const ph = $("#playhead");
  if (!state.segments.length || !v.duration) { ph.hidden = true; return; }
  const total = Math.max(...state.segments.map((s) => s.t1));
  if (Math.abs(total - v.duration) > total * 0.25 + 2) { ph.hidden = true; return; }
  ph.hidden = false; ph.style.left = (v.currentTime / total * 100) + "%";
});

// ---------- jurnal / qarorlar ----------
function logLine(ev, live) {
  const ul = $("#log"); const li = document.createElement("li");
  const agent = state.cfg.agents.find((a) => a.id === ev.agent);
  const color = agent ? agent.color : (ev.type === "tool" ? "var(--txt-3)" : "var(--accent)");
  let txt = "", cls = "";
  if (ev.type === "tool") {
    if (ev.name === "Bash") { txt = `<span class="txt cmd">$ ${esc(ev.text)}</span>`; }
    else if (ev.name === "matn") { txt = `<span class="txt">${esc(ev.text)}</span>`; }
    else { txt = `<span class="txt"><b>${esc(ev.name)}</b> ${esc(ev.text)}</span>`; }
  } else if (ev.type === "status") { cls = "status" + (ev.status === "error" ? " error" : ""); txt = `<span class="txt"><b>${esc(STATUS_UZ[ev.status] || ev.status)}</b> · ${esc(ev.text || "")}</span>`; }
  else { txt = `<span class="txt"><b>${esc(agent ? agent.name : (ev.agent || ""))}</b> ${esc(ev.text || "")}${ev.pct != null ? ` <span class="muted">${Math.round(ev.pct)}%</span>` : ""}</span>`; }
  li.className = cls; li.innerHTML = `<span class="ts">${fmtTime(ev.ts)}</span><span class="dot" style="background:${color}"></span>${txt}`;
  if (!live) li.style.animation = "none";
  ul.appendChild(li); state.logCount++; $("#log-count").textContent = state.logCount;
  while (ul.children.length > 500) ul.removeChild(ul.firstChild);
  if (ul.parentElement.classList.contains("active")) ul.parentElement.scrollTop = ul.parentElement.scrollHeight;
}
function decisionLine(ev, live) {
  const ul = $("#decisions"); const li = document.createElement("li");
  li.innerHTML = `<span class="ts">${fmtTime(ev.ts)}</span><span class="txt">${esc(ev.text || "")}</span>`;
  if (!live) li.style.animation = "none";
  ul.appendChild(li); state.decisions++; $("#dec-count").textContent = state.decisions;
}
function clearPanels() { $("#log").innerHTML = ""; $("#decisions").innerHTML = ""; state.logCount = 0; state.decisions = 0; $("#log-count").textContent = "0"; $("#dec-count").textContent = "0"; }

// ---------- hodisa qo'llash ----------
function applyEvent(ev, live) {
  const t = ev.type;
  if (t === "status") {
    if (ev.status === "running") { resetAgents(); $("#render-overlay").hidden = true; $("#replay-badge").hidden = true; }
    setJobStatus(ev.status);
    if (["done", "error", "cancelled"].includes(ev.status)) { refreshJob(); refreshJobs(); }
    logLine(ev, live); return;
  }
  if (t === "tool") { logLine(ev, live); return; }
  if (ev.agent) updateAgent(ev, live);
  if (ev.handoff && live) setTimeout(() => handoff(ev.agent, ev.handoff), 50);
  if (ev.image) { const a = state.cfg.agents.find((x) => x.id === ev.agent); showStill(ev.image, (a ? a.name : "Still") + " · still"); }
  if (t === "edl" && ev.edl) drawTimeline(ev.edl);
  if (t === "render") { renderOverlay(ev); if (ev.file && VIDEO_EXT.test(ev.file) && ev.state === "done") showVideo(ev.file, "Preview"); }
  if (t === "final" && ev.file) {
    $("#render-overlay").hidden = true;
    if (state.job) { const vs = state.job.versions || (state.job.versions = []); if (!vs.some((v) => v.path === ev.file)) vs.push({ v: (vs.length ? vs[vs.length - 1].v : 0) + 1, path: ev.file, ts: ev.ts, metrics: ev.metrics || {} }); renderVersions(state.job); showVideo(ev.file, "Yakuniy v" + vs[vs.length - 1].v); }
    else showVideo(ev.file, "Yakuniy");
  }
  if (t === "decision") decisionLine(ev, live);
  if (t !== "render" || ev.state !== "working" || !ev.metrics || !ev.metrics.kadr || (ev.metrics.kadr % 10 === 0)) logLine(ev, live);
}
function setJobStatus(st) {
  state.lastStatus = st;
  const p = $("#desk-status"); p.textContent = STATUS_UZ[st] || st || "—"; p.className = "status-pill " + (st || "");
  const running = st === "running" || st === "queued" || st === "cancelling";
  $("#btn-start").hidden = running; $("#btn-cancel").hidden = !running;
  $("#btn-start").textContent = (state.job && state.job.versions && state.job.versions.length) ? "▶ Qayta ishga tushirish" : "▶ Boshlash";
  $("#live").classList.toggle("on", running && !!state.es && !state.replaying);
  $("#replay-badge").hidden = !(state.replaying || ["done", "error", "cancelled"].includes(st));
  if (state.job) state.job.status = st;
  const it = $(`.job-item[data-id="${CSS.escape(state.job ? state.job.id : "")}"] .status-pill`); if (it) { it.textContent = STATUS_UZ[st] || st; it.className = "status-pill " + st; }
}

// ---------- SSE ----------
function connect(jobId, after = 0) {
  disconnect();
  const es = new EventSource(`/api/jobs/${encodeURIComponent(jobId)}/stream?after=${after}`);
  state.es = es; state.esJob = jobId; state.eventsSeen = after;
  es.addEventListener("ev", (e) => {
    if (state.esJob !== jobId || state.replaying) return;
    let ev; try { ev = JSON.parse(e.data); } catch { return; }
    state.eventsSeen++;
    const live = (Date.now() / 1000 - (ev.ts || 0)) < 4;
    applyEvent(ev, live);
  });
  es.onopen = () => { if (state.lastStatus === "running") $("#live").classList.add("on"); };
  es.onerror = () => { $("#live").classList.remove("on"); };
}
function disconnect() { if (state.es) { state.es.close(); state.es = null; } $("#live").classList.remove("on"); }

// ---------- ish tanlash ----------
async function selectJob(id) {
  stopReplay();
  const job = await api("/api/jobs/" + encodeURIComponent(id));
  state.job = job; state.segments = [];
  $$(".job-item").forEach((e) => e.classList.toggle("active", e.dataset.id === id));
  $("#desk-client").textContent = job.client; $("#desk-topic").textContent = job.topic;
  $("#job-controls").hidden = false;
  $("#job-meta").textContent = `${job.format} · ${job.fps} fps · ${job.model}/${job.effort}${job.queue_pos ? " · navbat #" + job.queue_pos : ""}`;
  setFormat(job.format); clearMonitor(); clearPanels(); resetAgents(); drawTimeline([]);
  renderVersions(job);
  const src = (job.sources || []).find((s) => VIDEO_EXT.test(s));
  if (job.versions && job.versions.length) showVideo(job.versions[job.versions.length - 1].path, "Yakuniy v" + job.versions[job.versions.length - 1].v);
  else if (src) showVideo(src, "Manba");
  setJobStatus(job.status);
  connect(id);
  try { localStorage.setItem("ofis.job", id); } catch {}
}
async function refreshJob() {
  if (!state.job) return;
  try { const job = await api("/api/jobs/" + encodeURIComponent(state.job.id));
    const local = (state.job && state.job.versions) || [];
    job.versions = job.versions || [];
    for (const v of local) if (!job.versions.some((x) => x.path === v.path)) job.versions.push(v);  // final hodisadan kelgan, hali job.json ga yozilmagan
    state.job = job; renderVersions(job); if (job.versions && job.versions.length && !state.replaying) showVideo(job.versions[job.versions.length - 1].path, "Yakuniy v" + job.versions[job.versions.length - 1].v); } catch {}
}
function renderVersions(job) {
  const vs = job.versions || []; const panel = $("#final-panel"); panel.hidden = !(vs.length || job.session_id);
  $("#versions").innerHTML = vs.map((v, i) => `<span class="ver ${i === vs.length - 1 ? "active" : ""}" data-path="${esc(v.path)}" data-v="${v.v}">v${v.v}<small>${esc(v.metrics && v.metrics.davomiylik ? v.metrics.davomiylik + " s" : "")}${v.metrics && v.metrics.lufs ? " · " + v.metrics.lufs + " LUFS" : ""}${v.metrics && v.metrics.hajm_mb ? " · " + v.metrics.hajm_mb + " MB" : ""}</small></span>`).join("") || `<span class="muted">Hali versiya yo'q</span>`;
  $$("#versions .ver").forEach((el) => el.onclick = () => { $$("#versions .ver").forEach((x) => x.classList.remove("active")); el.classList.add("active"); showVideo(el.dataset.path, "Yakuniy v" + el.dataset.v); });
  $("#btn-fix").disabled = !job.session_id || !vs.length;
}
async function refreshJobs() {
  const jobs = await api("/api/jobs"); state.jobs = jobs;
  const ul = $("#job-list"); $("#side-empty").hidden = jobs.length > 0;
  ul.innerHTML = jobs.map((j) => `<li class="job-item ${state.job && state.job.id === j.id ? "active" : ""}" data-id="${esc(j.id)}">
    <span class="t">${esc(j.client)} — ${esc(j.topic)}</span><span class="status-pill ${esc(j.status)}">${esc(STATUS_UZ[j.status] || j.status)}</span>
    <span class="s"><span>${new Date(j.created * 1000).toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span><span>${esc(j.format)}</span>${j.versions && j.versions.length ? `<span>v${j.versions[j.versions.length - 1].v}</span>` : ""}</span></li>`).join("");
  $$(".job-item", ul).forEach((li) => li.onclick = () => selectJob(li.dataset.id));
}

// ---------- qayta o'ynatish (faqat yozib olingan haqiqiy hodisalar) ----------
function stopReplay() { if (state.replayTimer) { clearTimeout(state.replayTimer); state.replayTimer = null; } if (state.replaying) { state.replaying = false; $("#live").classList.remove("replay"); } }
async function replayJob() {
  if (!state.job) return;
  stopReplay(); disconnect();
  const { events } = await api(`/api/jobs/${encodeURIComponent(state.job.id)}/events`);
  state.replaying = true; $("#replay-badge").hidden = false; $("#live").classList.add("replay");
  clearMonitor(); clearPanels(); resetAgents(); drawTimeline([]);
  const src = (state.job.sources || []).find((s) => VIDEO_EXT.test(s)); if (src) showVideo(src, "Manba (qayta ko'rish)");
  let i = 0;
  const step = () => {
    if (!state.replaying) return;
    if (i >= events.length) { state.replaying = false; $("#live").classList.remove("replay"); state.replayTimer = null; connect(state.job.id, events.length); return; }
    const ev = events[i], prev = events[i - 1];
    if (ev.type === "status" && ev.status === "running") { resetAgents(); $("#render-overlay").hidden = true; }
    if (ev.type === "status") { logLine(ev, true); } else { applyEvent(ev, true); }
    $("#replay-badge").hidden = false;
    i++;
    const gap = prev ? Math.min(1200, Math.max(120, ((ev.ts || 0) - (prev.ts || 0)) * 1000 / 20)) : 300;
    state.replayTimer = setTimeout(step, gap);
  };
  step();
}

// ---------- holat so'rovi ----------
async function pollStatus() {
  try {
    const st = await api("/api/status");
    $("#st-today").textContent = st.today; $("#st-queue").textContent = st.queue.length + (st.running ? 1 : 0);
    const c = $("#st-claude"); const b = $("b", c);
    if (!st.claude.found) { b.textContent = "topilmadi"; c.className = "stat claude-st bad"; c.title = "Claude Code CLI yo'q — README"; }
    else if (st.claude.logged_in === false) { b.textContent = "login yo'q"; c.className = "stat claude-st warn"; c.title = "Terminal: claude → login"; }
    else { b.textContent = st.claude.version ? st.claude.version.split(" ")[0] : "tayyor"; c.className = "stat claude-st ok"; c.title = st.claude.path; }
    if (!st.ffmpeg) { b.textContent += " · ffmpeg yo'q"; c.className = "stat claude-st bad"; }
    if (state.job && st.running === state.job.id && !state.es && !state.replaying) connect(state.job.id);
  } catch { $("#live").classList.remove("on"); }
}

// ---------- yangi ish ----------
function openModal(id) { $(id).hidden = false; } function closeModals() { $$(".modal").forEach((m) => (m.hidden = true)); }
$$(".modal-close").forEach((b) => b.onclick = closeModals);
$$(".modal").forEach((m) => m.addEventListener("click", (e) => { if (e.target === m) closeModals(); }));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModals(); });

async function openNew() {
  const f = $("#form-new"); f.reset(); state.selectedSources = []; renderSelected();
  $("#upload-list").innerHTML = "";
  const [src, refs, music, ready] = await Promise.all([api("/api/sources"), api("/api/assets/refs"), api("/api/assets/music").catch(() => []), api("/api/assets/ready").catch(() => [])]);
  $("#source-tree").innerHTML = `<div class="src-group">01_Kiruvchi</div>` + (src.items.length ? src.items.map(nodeHtml).join("") : `<div class="muted" style="padding:6px">bo'sh — faylni o'ngga tashlang</div>`)
    + (ready.length ? `<div class="src-group">04_Tayyor_videolar <small>(tayyor videoni manba qilish)</small></div>` + ready.map(nodeHtml).join("") : "");
  $$("#source-tree .src-item").forEach((el) => el.onclick = () => toggleSource(el.dataset.path, el));
  $("#sel-ref").innerHTML = `<option value="">Asosiy (Apple style)</option>` + refs.filter((r) => !r.startsWith("_")).map((r) => `<option value="${esc(r)}">${esc(r.replace(/_/g, " "))}</option>`).join("");
  $("#sel-music").innerHTML = `<option value="avto">Avto (02_Assets/Musiqa)</option><option value="yoq">Yo'q</option>` + (music || []).filter((m) => !m.dir).map((m) => `<option value="${esc(m.path)}">${esc(m.name)}</option>`).join("");
  fillModelSelects($("#sel-model"), $("#sel-effort"), state.cfg.model, state.cfg.effort);
  $("#drop-dest").textContent = `01_Kiruvchi/<mijoz>_${new Date().toISOString().slice(0, 10)}/`;
  openModal("#modal-new");
}
function nodeHtml(n) {
  if (n.dir) return `<div class="src-item dir" data-path="${esc(n.path)}">📁 ${esc(n.name)}<span class="sz">${n.count ?? ""}</span></div>` + (n.children || []).map((c) => `<div class="src-child">${nodeHtml(c)}</div>`).join("");
  return `<div class="src-item" data-path="${esc(n.path)}">${VIDEO_EXT.test(n.name) ? "🎬" : "📄"} ${esc(n.name)}<span class="sz">${esc(n.size_h || "")}</span></div>`;
}
function toggleSource(p, el) {
  const i = state.selectedSources.indexOf(p);
  if (i >= 0) state.selectedSources.splice(i, 1); else state.selectedSources.push(p);
  if (el) el.classList.toggle("sel", i < 0); renderSelected();
}
function renderSelected() {
  $("#selected-sources").innerHTML = state.selectedSources.map((p) => `<span class="chip src" data-path="${esc(p)}" title="olib tashlash">${esc(p.split("/").slice(-2).join("/"))} ✕</span>`).join("") || `<span class="muted">Manba tanlanmagan</span>`;
  $$("#selected-sources .chip").forEach((c) => c.onclick = () => { toggleSource(c.dataset.path); const el = $(`#source-tree .src-item[data-path="${CSS.escape(c.dataset.path)}"]`); if (el) el.classList.remove("sel"); });
}
function fillModelSelects(ms, es, m, e) {
  ms.innerHTML = state.cfg.models.map((x) => `<option ${x === m ? "selected" : ""}>${esc(x)}</option>`).join("");
  es.innerHTML = state.cfg.efforts.map((x) => `<option ${x === e ? "selected" : ""}>${esc(x)}</option>`).join("");
}
// yuklash (bo'laklab)
const CHUNK = 32 * 1024 * 1024;
async function uploadFile(file) {
  const client = $("#form-new input[name=client]").value || "Mijoz";
  const row = document.createElement("div"); row.className = "up"; row.innerHTML = `<span>${esc(file.name)}</span><span class="pct">0%</span><div class="bar"><i></i></div>`; $("#upload-list").appendChild(row);
  const init = await api("/api/upload/init", { method: "POST", body: JSON.stringify({ name: file.name, size: file.size, client }) });
  let off = 0;
  while (off < file.size) {
    const blob = file.slice(off, Math.min(file.size, off + CHUNK));
    const r = await fetch(`/api/upload/${init.upload_id}?offset=${off}`, { method: "PUT", body: blob });
    if (!r.ok) throw new Error("yuklash xatosi " + r.status);
    off += blob.size; const pct = Math.round(off / file.size * 100); $(".pct", row).textContent = pct + "%"; $(".bar i", row).style.width = pct + "%";
  }
  const done = await api(`/api/upload/${init.upload_id}/done`, { method: "POST", body: "{}" });
  $(".pct", row).textContent = "✓"; state.selectedSources.push(done.path); renderSelected();
}
async function handleFiles(files) {
  for (const f of files) { try { await uploadFile(f); } catch (e) { toast("Yuklash xatosi: " + e.message, true); } }
}
const drop = $("#drop");
drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); handleFiles(e.dataTransfer.files); });
$("#btn-pick").onclick = () => $("#file-input").click();
$("#file-input").onchange = (e) => handleFiles(e.target.files);

$("#form-new").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target); const data = Object.fromEntries(fd.entries());
  data.start = fd.get("start") === "on"; data.sources = state.selectedSources.slice();
  if (!data.sources.length) { toast("Manba fayl tanlang yoki yuklang", true); return; }
  try {
    const r = await api("/api/jobs", { method: "POST", body: JSON.stringify(data) });
    closeModals(); await refreshJobs(); await selectJob(r.job.id);
    if (r.warning) toast(r.warning, true); else toast(data.start ? "Ish navbatga qo'yildi" : "Ish yaratildi");
  } catch (err) { toast(err.message, true); }
});
$("#btn-new").onclick = openNew;

// ---------- boshqaruv ----------
$("#btn-start").onclick = async () => { if (!state.job) return; try { await api(`/api/jobs/${encodeURIComponent(state.job.id)}/start`, { method: "POST", body: "{}" }); toast("Boshlandi"); refreshJobs(); } catch (e) { toast(e.message, true); } };
$("#btn-cancel").onclick = async () => { if (!state.job) return; try { await api(`/api/jobs/${encodeURIComponent(state.job.id)}/cancel`, { method: "POST", body: "{}" }); } catch (e) { toast(e.message, true); } };
$("#btn-fix").onclick = async () => {
  const text = $("#fix-text").value.trim(); if (!text || !state.job) return;
  try { await api(`/api/jobs/${encodeURIComponent(state.job.id)}/fix`, { method: "POST", body: JSON.stringify({ text }) }); $("#fix-text").value = ""; toast("Tuzatish navbatga qo'yildi"); refreshJobs(); } catch (e) { toast(e.message, true); }
};
$("#btn-reveal").onclick = async () => { if (!state.job) return; const act = $("#versions .ver.active"); try { const r = await api(`/api/jobs/${encodeURIComponent(state.job.id)}/reveal`, { method: "POST", body: JSON.stringify({ path: act ? act.dataset.path : null }) }); if (!r.ok) toast("Faqat macOS'da: " + (r.path || "")); } catch (e) { toast(e.message, true); } };
$("#btn-replay").onclick = () => { if (state.replaying) { stopReplay(); selectJob(state.job.id); } else { replayJob(); } };
$$(".tab").forEach((t) => t.onclick = () => { $$(".tab").forEach((x) => x.classList.toggle("active", x === t)); $$(".tab-pane").forEach((p) => p.classList.toggle("active", p.id === "tab-" + t.dataset.tab)); });

// ---------- sozlamalar ----------
$("#btn-settings").onclick = () => {
  const f = $("#form-settings"); const c = state.cfg;
  f.name.value = c.name; f.accent.value = c.accent; f.accent_hex.value = c.accent; f.logo.value = c.logo || ""; f.claude_bin.value = c.claude_bin || "";
  fillModelSelects($("#set-model"), $("#set-effort"), c.model, c.effort);
  $("#agents-edit").innerHTML = `<div class="muted" style="font-size:12px">Agentlar (rang · nom · vazifa)</div>` + c.agents.map((a, i) => `<div class="ag-row"><input type="color" name="ag_color_${i}" value="${esc(a.color)}"><input name="ag_name_${i}" value="${esc(a.name)}"><input name="ag_role_${i}" value="${esc(a.role || "")}"></div>`).join("");
  f.accent.oninput = () => (f.accent_hex.value = f.accent.value); f.accent_hex.oninput = () => { if (/^#[0-9a-f]{6}$/i.test(f.accent_hex.value)) f.accent.value = f.accent_hex.value; };
  $("#settings-info").textContent = "Har montaj ishi sizning Claude limitingizdan sarflanadi.";
  openModal("#modal-settings");
};
$("#form-settings").addEventListener("submit", async (e) => {
  e.preventDefault(); const f = e.target;
  const agents = state.cfg.agents.map((a, i) => ({ ...a, color: f[`ag_color_${i}`].value, name: f[`ag_name_${i}`].value.trim() || a.name, role: f[`ag_role_${i}`].value.trim() }));
  const patch = { name: f.name.value.trim() || "AI Montaj Ofisi", accent: (/^#[0-9a-f]{6}$/i.test(f.accent_hex.value) ? f.accent_hex.value : f.accent.value), logo: f.logo.value.trim(), model: f.model.value, effort: f.effort.value, claude_bin: f.claude_bin.value.trim(), agents };
  try { state.cfg = await api("/api/config", { method: "PUT", body: JSON.stringify(patch) }); applyTheme(state.cfg); renderAgents(); if (state.job) selectJob(state.job.id); closeModals(); toast("Saqlandi"); } catch (err) { toast(err.message, true); }
});

// ---------- boshlash ----------
(async function init() {
  state.cfg = await api("/api/config"); applyTheme(state.cfg); renderAgents();
  await refreshJobs(); await pollStatus(); setInterval(pollStatus, 5000); setInterval(refreshJobs, 15000);
  let pick = null; try { pick = localStorage.getItem("ofis.job"); } catch {}
  const running = state.jobs.find((j) => j.status === "running" || j.status === "queued");
  const target = running || state.jobs.find((j) => j.id === pick) || state.jobs[0];
  if (target) selectJob(target.id);
  window.addEventListener("resize", () => {});
})().catch((e) => toast("Server bilan aloqa yo'q: " + e.message, true));
})();
