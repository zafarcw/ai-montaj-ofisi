// CHAT-bosqich: xodim bilan ovozli chat — faqat 3D sahifada. Xodimni bosish → oʻng panel.
// Matn yoki 🎙 (bosib turish → ASR) → POST /api/chat (haiku, persona) → javob + TTS (navbat bilan, bitta ovoz) + 3D pufakcha + ogʻiz animatsiyasi.
// Montaj runner'iga tegmaydi: hamma soʻrovlar serverda alohida jarayon.
const $ = (id) => document.getElementById(id);
const STATE_TXT = { working: ["ishlayapti", "busy"], sleep: ["uxlayapti", "sleep"], walk: ["yurib ketyapti", ""], idle: ["boʻsh", ""], error: ["xato!", "busy"] };

function toast(msg, err) {
  const t = document.createElement("div"); t.className = "toast" + (err ? " err" : ""); t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}
async function api(url, opt = {}) {
  const r = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opt });
  if (!r.ok) { let m = r.statusText; try { m = (await r.json()).error || m; } catch { /* matn */ } throw Object.assign(new Error(m), { status: r.status }); }
  return r.json();
}
const fmtTok = (u, ms) => `${u?.in ?? 0}↑ ${u?.out ?? 0}↓ token${ms ? ` · ${(ms / 1000).toFixed(1)} s` : ""}`;

export function initChat({ office, agents, onOpen, onClose }) {
  const panel = $("chat"), log = $("chat-log"), form = $("chat-form"), input = $("chat-text"), mic = $("chat-mic"), stopBtn = $("chat-stop");
  const voiceBtn = $("chat-voice"), modeEl = $("chat-mode"), noteEl = $("chat-note"), stateEl = $("chat-state");
  let cfg = null, cur = null, voiceOn = true, waiting = false, voices = null, personas = null;

  // ---------- sozlamalar (config.json → chat, tts) ----------
  async function loadCfg() { cfg = await api("/api/config"); voiceOn = cfg.chat?.voice_reply !== false; voiceBtn.setAttribute("aria-pressed", String(voiceOn)); voiceBtn.title = voiceOn ? "Ovozli javob (yoqiq)" : "Ovozli javob (oʻchiq)"; return cfg; }
  async function saveCfg(patch) { cfg = await api("/api/config", { method: "PUT", body: JSON.stringify(patch) }); refreshMode(); return cfg; }
  const roastActive = () => cfg?.chat?.mode !== "soft" && !!cfg?.chat?.roast_ok;
  function refreshMode() {
    const roast = roastActive(); modeEl.textContent = roast ? "Roast 18+" : "Yumshoq"; modeEl.classList.toggle("soft", !roast);
    const hasKey = !!(cfg?.tts?.elevenlabs_key || "").trim(), prov = cfg?.tts?.provider || "auto";
    noteEl.innerHTML = (!hasKey || prov === "say") && voiceOn ? "Oʻzbekcha tabiiy ovoz uchun <a id=\"chat-note-cfg\">Sozlamalar → ElevenLabs kaliti</a>" : "";
    noteEl.querySelector("a")?.addEventListener("click", openCfg);
  }
  function agentOf(id) { return agents.find((a) => a.id === id) || { id, name: id, role: "", color: "#888" }; }

  // ---------- panel ----------
  function addMsg(role, text, meta, cls = "") {
    log.querySelector(".chat-empty")?.remove();
    const d = document.createElement("div"); d.className = `msg ${role} ${cls}`.trim(); d.textContent = text;
    if (meta) { const s = document.createElement("small"); s.textContent = meta; d.appendChild(s); }
    log.appendChild(d); log.scrollTop = log.scrollHeight; return d;
  }
  function typing() { const d = document.createElement("div"); d.className = "msg bot typing"; d.innerHTML = "<i>•</i><i>•</i><i>•</i>"; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; }
  function updateState() {
    if (!cur) return; const w = office.workers[cur]; const [txt, cls] = STATE_TXT[w?.state] || STATE_TXT.idle;
    stateEl.textContent = w?.err ? "xato!" : txt; stateEl.className = "chat-state " + (w?.err ? "busy" : cls);
  }
  setInterval(updateState, 500);

  async function open(id) {
    if (!cfg) await loadCfg().catch(() => { cfg = { chat: {}, tts: {} }; });
    if (cur && cur !== id) office.setChat(cur, false);
    cur = id; const a = agentOf(id);
    panel.style.setProperty("--c", a.color); $("chat-avatar").style.setProperty("--c", a.color);
    $("chat-name").textContent = a.name; $("chat-role").textContent = a.role || "";
    panel.hidden = false; refreshMode(); updateState(); office.setChat(id, true); onOpen?.(office.workers[id]);
    log.innerHTML = "";
    try {
      const hist = await api(`/api/chat/${encodeURIComponent(id)}/history?n=30`);
      if (cur !== id) return;
      if (!hist.length) log.innerHTML = `<div class="chat-empty">${a.name} bilan suhbat. Yozing yoki 🎙 ni bosib turib gapiring — javob ovoz bilan keladi.</div>`;
      for (const h of hist) addMsg(h.role === "user" ? "user" : "bot", h.text, h.role === "assistant" ? fmtTok(h.usage, h.ms) : null);
    } catch (e) { addMsg("bot", "Tarix yuklanmadi: " + e.message, null, "err"); }
    if (cfg.chat?.mode !== "soft" && !cfg.chat?.roast_ok) $("age-gate").hidden = false; else if (matchMedia("(min-width: 761px)").matches) input.focus();
  }
  function close() { if (!cur) return; stopAudio(); office.setChat(cur, false); panel.hidden = true; $("age-gate").hidden = true; cur = null; onClose?.(); }

  // ---------- yuborish ----------
  async function send(text) {
    text = (text || "").trim(); if (!text || !cur || waiting) return;
    const id = cur; waiting = true; form.classList.add("wait"); input.value = "";
    addMsg("user", text); const tip = typing(); office.think(id, true);
    try {
      const r = await api("/api/chat", { method: "POST", body: JSON.stringify({ agent: id, text }) });
      tip.remove();
      if (cur === id) addMsg("bot", r.text, fmtTok(r.usage, r.ms) + (r.busy ? " · band" : ""));   // panel boshqa xodimga oʻtgan boʻlsa — faqat 3D pufakcha
      office.say(id, r.text);
      if (voiceOn) speak(id, r.text);
    } catch (e) {
      tip.remove(); if (cur === id) addMsg("bot", e.status === 429 ? "Boshqa suhbat hali tugamagan — bir oz kuting." : "Javob kelmadi: " + e.message, null, "err");
    } finally { office.think(id, false); waiting = false; form.classList.remove("wait"); if (cur === id && matchMedia("(min-width: 761px)").matches) input.focus(); }
  }
  form.addEventListener("submit", (e) => { e.preventDefault(); send(input.value); });

  // ---------- ovozli javob (TTS): navbat, bitta ovoz, ogʻiz amplitudasi ----------
  const queue = []; let audio = null, actx = null, analyser = null, raf = 0, srcNode = null;
  function speak(id, text) { queue.push({ id, text }); pump(); }
  async function pump() {
    if (audio || !queue.length) return;
    const { id, text } = queue.shift();
    try {
      const r = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agent: id, text }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText);
      const note = r.headers.get("X-TTS-Note"); if (note) console.warn("TTS:", note);
      const blob = await r.blob(); const url = URL.createObjectURL(blob);
      audio = new Audio(url); audio.crossOrigin = "anonymous";
      stopBtn.hidden = false;
      try { // amplituda → ogʻiz
        actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === "suspended") actx.resume();
        srcNode = actx.createMediaElementSource(audio); analyser = actx.createAnalyser(); analyser.fftSize = 256; srcNode.connect(analyser); analyser.connect(actx.destination);
      } catch { analyser = null; }
      const data = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
      const loop = () => {
        if (!audio) return; let amp = 0;
        if (analyser) { analyser.getByteTimeDomainData(data); let s = 0; for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; s += v * v; } amp = Math.min(1, Math.sqrt(s / data.length) * 4); }
        else amp = audio.paused ? 0 : 0.35 + 0.35 * Math.abs(Math.sin(performance.now() / 90));
        office.setTalk(id, amp); raf = requestAnimationFrame(loop);
      };
      const done = () => { cancelAnimationFrame(raf); office.setTalk(id, 0); try { srcNode?.disconnect(); analyser?.disconnect(); } catch { /* yoʻq */ } URL.revokeObjectURL(url); audio = null; stopBtn.hidden = queue.length === 0; pump(); };
      audio.addEventListener("ended", done); audio.addEventListener("error", done);
      await audio.play(); loop();
    } catch (e) { audio = null; stopBtn.hidden = true; office.setTalk(id, 0); toast("Ovoz chiqmadi: " + e.message, true); pump(); }
  }
  function stopAudio() { queue.length = 0; if (audio) { const a = audio; audio = null; a.pause(); cancelAnimationFrame(raf); } if (cur) office.setTalk(cur, 0); stopBtn.hidden = true; }
  stopBtn.addEventListener("click", stopAudio);
  voiceBtn.addEventListener("click", async () => {
    voiceOn = !voiceOn; voiceBtn.setAttribute("aria-pressed", String(voiceOn)); voiceBtn.title = voiceOn ? "Ovozli javob (yoqiq)" : "Ovozli javob (oʻchiq)"; if (!voiceOn) stopAudio(); refreshMode();
    try { await saveCfg({ chat: { ...(cfg.chat || {}), voice_reply: voiceOn } }); } catch { /* lokal holat yetarli */ }
  });

  // ---------- ovozli kirish (ASR): bosib turish → yozish → qoʻyib yuborish → matn → avtomatik yuborish ----------
  let rec = null, chunks = [], recT0 = 0, stream = null;
  async function startRec(e) {
    e.preventDefault(); if (rec || waiting || mic.classList.contains("busy")) return;
    if (!navigator.mediaDevices?.getUserMedia) return toast("Mikrofon qoʻllanmaydi (HTTPS yoki localhost kerak)", true);
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch (err) { return toast("Mikrofonga ruxsat yoʻq: " + err.message, true); }
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((m) => MediaRecorder.isTypeSupported(m)) || "";
    rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined); chunks = []; recT0 = performance.now();
    rec.addEventListener("dataavailable", (ev) => { if (ev.data.size) chunks.push(ev.data); });
    rec.addEventListener("stop", onRecStop);
    rec.start(); mic.classList.add("rec"); input.placeholder = "Yozilmoqda… qoʻyib yuboring";
    if (audio) stopAudio();
  }
  function stopRec() { if (!rec) return; try { rec.stop(); } catch { /* allaqachon */ } stream?.getTracks().forEach((t) => t.stop()); mic.classList.remove("rec"); }
  async function onRecStop() {
    const r = rec; rec = null; const dur = performance.now() - recT0; const blob = new Blob(chunks, { type: r.mimeType || "audio/webm" });
    input.placeholder = "Yozing yoki 🎙 ni bosib turib gapiring…";
    if (dur < 350 || blob.size < 1000) return toast("Juda qisqa — 🎙 ni bosib turib gapiring");
    mic.classList.add("busy"); input.placeholder = "Tanilmoqda…";
    try {
      const res = await fetch("/api/asr", { method: "POST", headers: { "Content-Type": blob.type }, body: blob });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
      const d = await res.json(); input.value = d.text || "";
      if (!d.text) toast("Gap tanilmadi — yana urinib koʻring");
      else send(d.text);
    } catch (err) { toast("ASR xato: " + err.message, true); }
    finally { mic.classList.remove("busy"); input.placeholder = "Yozing yoki 🎙 ni bosib turib gapiring…"; }
  }
  mic.addEventListener("pointerdown", startRec);
  for (const ev of ["pointerup", "pointercancel", "pointerleave"]) mic.addEventListener(ev, stopRec);
  mic.addEventListener("contextmenu", (e) => e.preventDefault());

  // ---------- 18+ tasdiq (bir marta) ----------
  $("age-yes").addEventListener("click", async () => { try { await saveCfg({ chat: { ...(cfg.chat || {}), roast_ok: true, mode: "roast" } }); } catch (e) { toast(e.message, true); } $("age-gate").hidden = true; input.focus(); });
  $("age-soft").addEventListener("click", async () => { try { await saveCfg({ chat: { ...(cfg.chat || {}), mode: "soft" } }); } catch (e) { toast(e.message, true); } $("age-gate").hidden = true; input.focus(); });

  // ---------- sozlamalar oynasi ----------
  const cfgModal = $("chat-cfg"), cfgForm = $("cfg-form");
  async function openCfg() {
    try { if (!voices) voices = await api("/api/tts/voices"); if (!personas) personas = await api("/api/personas"); await loadCfg(); } catch (e) { return toast(e.message, true); }
    const f = cfgForm; f.mode.value = cfg.chat?.mode || "roast"; f.voice_reply.value = cfg.chat?.voice_reply === false ? "0" : "1";
    f.provider.value = cfg.tts?.provider || "auto"; f.chat_model.value = cfg.chat?.model || "haiku"; f.elevenlabs_key.value = cfg.tts?.elevenlabs_key || "";
    const byLang = {}; for (const v of voices) (byLang[v.lang] ||= []).push(v);
    const opts = Object.keys(byLang).sort().map((l) => `<optgroup label="${l}">${byLang[l].map((v) => `<option value="${v.name.replace(/"/g, "&quot;")}">${v.name}</option>`).join("")}</optgroup>`).join("");
    $("cfg-voices").innerHTML = `<div class="vrow vhead"><span>Xodim</span><span>macOS say ovozi</span><span>Tezlik</span><span>ElevenLabs voice_id</span></div>` +
      agents.map((a) => { const v = cfg.tts?.voices?.[a.id] || {}; return `<div class="vrow" style="--c:${a.color}"><b>${a.name}</b><select data-a="${a.id}" data-k="say">${opts}</select><input type="number" min="90" max="320" data-a="${a.id}" data-k="rate" value="${v.rate || 180}"><input data-a="${a.id}" data-k="eleven" value="${v.eleven || ""}" placeholder="voice_id"></div>`; }).join("");
    for (const a of agents) { const sel = $("cfg-voices").querySelector(`select[data-a="${a.id}"]`); const want = cfg.tts?.voices?.[a.id]?.say || ""; sel.value = want; if (sel.value !== want) { const base = want.split(" (")[0]; const o = [...sel.options].find((x) => x.value.split(" (")[0] === base); if (o) sel.value = o.value; } }
    $("cfg-personas").innerHTML = agents.map((a) => `<label>${a.name}<textarea data-p="${a.id}">${(personas.xodimlar?.[a.id] || "").replace(/</g, "&lt;")}</textarea></label>`).join("");
    $("cfg-info").textContent = cur ? `Joriy xodim: ${agentOf(cur).name}` : "";
    cfgModal.hidden = false;
  }
  $("chat-cfg-btn").addEventListener("click", openCfg); $("cfg-close").addEventListener("click", () => { cfgModal.hidden = true; });
  cfgModal.addEventListener("click", (e) => { if (e.target === cfgModal) cfgModal.hidden = true; });
  cfgForm.addEventListener("submit", async (e) => {
    e.preventDefault(); const f = cfgForm; const vs = {};
    for (const el of $("cfg-voices").querySelectorAll("[data-a]")) { (vs[el.dataset.a] ||= {})[el.dataset.k] = el.dataset.k === "rate" ? Number(el.value) || 180 : el.value; }
    const xod = {}; for (const t of $("cfg-personas").querySelectorAll("textarea[data-p]")) xod[t.dataset.p] = t.value;
    try {
      await saveCfg({ chat: { ...(cfg.chat || {}), mode: f.mode.value, voice_reply: f.voice_reply.value === "1", model: f.chat_model.value },
        tts: { ...(cfg.tts || {}), provider: f.provider.value, elevenlabs_key: f.elevenlabs_key.value.trim(), voices: vs } });
      personas = await api("/api/personas", { method: "PUT", body: JSON.stringify({ xodimlar: xod }) });
      voiceOn = cfg.chat?.voice_reply !== false; voiceBtn.setAttribute("aria-pressed", String(voiceOn)); refreshMode(); cfgModal.hidden = true; toast("Saqlandi");
      if (cur && cfg.chat?.mode === "roast" && !cfg.chat?.roast_ok) $("age-gate").hidden = false;
    } catch (err) { toast(err.message, true); }
  });
  $("cfg-clear").addEventListener("click", async () => { if (!cur) return; try { await api(`/api/chat/${encodeURIComponent(cur)}/clear`, { method: "POST" }); log.innerHTML = `<div class="chat-empty">Tarix tozalandi.</div>`; toast("Tarix tozalandi"); } catch (err) { toast(err.message, true); } });

  $("chat-close").addEventListener("click", close);
  addEventListener("keydown", (e) => { if (e.key === "Escape") { if (!cfgModal.hidden) cfgModal.hidden = true; else close(); } });
  loadCfg().catch(() => { /* server yoʻq */ });
  return { open, close, isOpen: () => !!cur, current: () => cur };
}
