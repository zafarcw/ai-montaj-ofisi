// SSE'dan haqiqiy hodisalarni o'qiydi → Office. Soxta hodisa yo'q.
// 2-bosqich: eng oxirgi ish (/api/jobs[0] — yangilanishi bo'yicha) ga ulanadi. Ish tanlash — 3-bosqichda.
const AGENT_IDS = new Set(["rejissyor", "ovozchi", "montajchi", "motion", "rangchi"]);

export function connectFeed(office) {
  let es = null, current = null, active = null; // active: oxirgi "working" agent (tool hodisalari agentsiz keladi)

  function apply(ev) {
    const age = Math.max(0, Date.now() / 1000 - (ev.ts || 0));
    const now = performance.now() / 1000 - age;      // hodisaning haqiqiy vaqti
    const stale = age > 60;                          // eski hodisa (qayta o'ynash) — hech kim "ishlayapti" bo'lmasin
    if (ev.type === "tool") {
      if (stale) return;
      if (active && ev.name && !["init", "result", "matn"].includes(ev.name)) office.tool(active, ev.name, ev.text);
      return;
    }
    if (ev.type === "status") { if (ev.status === "new") { office.reset(); active = null; } return; }
    if (!AGENT_IDS.has(ev.agent) && !office.workers[ev.agent]) return;
    if (ev.state === "working") active = ev.agent;
    if (ev.type === "render" && ev.state === "working") active = ev.agent;
    office.event(ev.agent, { state: stale && ev.state === "working" ? "done" : ev.state, text: stale ? "" : ev.text }, now);
  }

  function open(id) {
    if (es) es.close();
    current = id; active = null; office.reset();
    es = new EventSource(`/api/jobs/${encodeURIComponent(id)}/stream?after=0`);
    es.addEventListener("ev", (e) => { try { apply(JSON.parse(e.data)); } catch { /* buzuq qator */ } });
  }

  async function pick() {
    try {
      const jobs = await (await fetch("/api/jobs")).json();
      const latest = [...jobs].sort((a, b) => (b.updated || 0) - (a.updated || 0))[0];
      if (latest && latest.id !== current) open(latest.id);
    } catch { /* server vaqtincha yo'q */ }
  }
  pick(); setInterval(pick, 5000);
}
