// Prediction Market Tracker — frontend.
// Vanilla JS, no build step. Talks only to our own /api/* proxy.

const REFRESH_MS = 30000;
const WATCH_KEY = "pmt.watchlist";

const els = {
  grid: document.getElementById("grid"),
  empty: document.getElementById("empty"),
  search: document.getElementById("search"),
  sort: document.getElementById("sort"),
  statusDot: document.getElementById("statusDot"),
  statusText: document.getElementById("statusText"),
  watchCount: document.getElementById("watchCount"),
  lastUpdated: document.getElementById("lastUpdated"),
  tpl: document.getElementById("cardTemplate"),
};

const state = {
  tab: "all",
  sort: "volume24hr",
  q: "",
  markets: [],
  watch: loadWatch(),
};

// --- watchlist persistence ---------------------------------------------------

function loadWatch() {
  try {
    return new Set(JSON.parse(localStorage.getItem(WATCH_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveWatch() {
  localStorage.setItem(WATCH_KEY, JSON.stringify([...state.watch]));
  els.watchCount.textContent = state.watch.size;
}

function toggleWatch(id) {
  if (state.watch.has(id)) state.watch.delete(id);
  else state.watch.add(id);
  saveWatch();
  if (state.tab === "watchlist") load();
}

// --- formatting helpers ------------------------------------------------------

function fmtMoney(n) {
  if (!n) return "$0";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

function fmtPct(p) {
  if (p == null) return "—";
  return `${(p * 100).toFixed(1)}%`;
}

function fmtEnds(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const days = Math.round((d - Date.now()) / 86400000);
  if (days < 0) return "ended";
  if (days === 0) return "today";
  if (days < 31) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

function classifyOption(label) {
  const l = (label || "").toLowerCase();
  if (l === "yes") return "yes";
  if (l === "no") return "no";
  return "";
}

// --- data fetching -----------------------------------------------------------

async function fetchMarkets() {
  if (state.tab === "watchlist") {
    const ids = [...state.watch];
    if (ids.length === 0) return [];
    const r = await fetch(`/api/markets/by-ids?ids=${ids.join(",")}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const { markets } = await r.json();
    return sortLocally(markets);
  }
  const params = new URLSearchParams({ sort: state.sort, limit: "60" });
  if (state.q) params.set("q", state.q);
  const r = await fetch(`/api/markets?${params}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const { markets } = await r.json();
  return markets;
}

function sortLocally(markets) {
  const s = state.sort;
  const copy = [...markets];
  if (s === "endDate") {
    copy.sort((a, b) => new Date(a.endDate || 0) - new Date(b.endDate || 0));
  } else {
    copy.sort((a, b) => (b[s] || 0) - (a[s] || 0));
  }
  return copy;
}

function setStatus(kind, text) {
  els.statusDot.className = `dot ${kind}`;
  els.statusText.textContent = text;
}

let loadToken = 0;
async function load({ silent = false } = {}) {
  const token = ++loadToken;
  if (!silent && els.grid.children.length === 0) renderSkeletons();
  setStatus("", silent ? els.statusText.textContent : "Updating…");
  try {
    const markets = await fetchMarkets();
    if (token !== loadToken) return; // a newer request superseded this one
    state.markets = markets;
    render();
    setStatus("live", "Live");
    els.lastUpdated.textContent = `updated ${new Date().toLocaleTimeString()}`;
  } catch (err) {
    if (token !== loadToken) return;
    setStatus("error", "Connection error");
    if (els.grid.children.length === 0) {
      els.empty.hidden = false;
      els.empty.textContent = `Could not load markets: ${err.message}`;
    }
  }
}

// --- rendering ---------------------------------------------------------------

function renderSkeletons() {
  els.empty.hidden = true;
  els.grid.innerHTML = "";
  for (let i = 0; i < 6; i++) {
    const sk = document.createElement("div");
    sk.className = "skeleton";
    els.grid.appendChild(sk);
  }
}

function render() {
  els.grid.innerHTML = "";
  const markets = state.markets;

  if (markets.length === 0) {
    els.empty.hidden = false;
    els.empty.textContent =
      state.tab === "watchlist"
        ? "Your watchlist is empty. Tap ☆ on any market to track it."
        : "No markets match your search.";
    return;
  }
  els.empty.hidden = true;

  for (const m of markets) els.grid.appendChild(buildCard(m));
}

function buildCard(m) {
  const node = els.tpl.content.firstElementChild.cloneNode(true);

  const star = node.querySelector(".star");
  const refreshStar = () => {
    const on = state.watch.has(m.id);
    star.classList.toggle("on", on);
    star.textContent = on ? "★" : "☆";
    star.title = on ? "Remove from watchlist" : "Add to watchlist";
  };
  refreshStar();
  star.addEventListener("click", () => {
    toggleWatch(m.id);
    refreshStar();
  });

  const thumb = node.querySelector(".thumb");
  if (m.image) thumb.src = m.image;
  node.querySelector(".question").textContent = m.question;

  // Options: show top 3 by price so multi-outcome markets stay compact.
  const optsHost = node.querySelector(".options");
  const sorted = [...m.options]
    .filter((o) => o.price != null)
    .sort((a, b) => b.price - a.price)
    .slice(0, 3);
  for (const o of sorted) {
    const row = document.createElement("div");
    row.className = `opt ${classifyOption(o.label)}`;
    row.innerHTML = `
      <div class="bar">
        <div class="fill" style="width:${Math.max(0, Math.min(100, o.price * 100))}%"></div>
        <span class="name">${escapeHtml(o.label)}</span>
      </div>
      <span class="pct">${fmtPct(o.price)}</span>`;
    optsHost.appendChild(row);
  }

  node.querySelector(".vol24").textContent = fmtMoney(m.volume24hr);
  node.querySelector(".voltotal").textContent = fmtMoney(m.volume);
  node.querySelector(".liq").textContent = fmtMoney(m.liquidity);
  node.querySelector(".ends").textContent = fmtEnds(m.endDate);

  const link = node.querySelector(".open-link");
  if (m.url) link.href = m.url;
  else link.hidden = true;

  wireChart(node, m);
  return node;
}

function wireChart(node, m) {
  const toggle = node.querySelector(".toggle-chart");
  const area = node.querySelector(".chart-area");
  const host = node.querySelector(".chart-host");
  const tabs = node.querySelectorAll(".chart-tabs button");

  // Chart the leading outcome's token (its price line tells the market story).
  const primary = [...m.options]
    .filter((o) => o.tokenId)
    .sort((a, b) => (b.price ?? 0) - (a.price ?? 0))[0];

  let loaded = false;
  toggle.addEventListener("click", () => {
    const showing = !area.hidden;
    area.hidden = showing;
    toggle.textContent = showing ? "Show chart ▾" : "Hide chart ▴";
    if (!showing && !loaded) {
      loaded = true;
      drawChart(host, primary, "1m");
    }
  });

  tabs.forEach((btn) =>
    btn.addEventListener("click", () => {
      tabs.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      drawChart(host, primary, btn.dataset.int);
    })
  );
}

async function drawChart(host, option, interval) {
  if (!option || !option.tokenId) {
    host.innerHTML = `<div class="msg">No price history available.</div>`;
    return;
  }
  host.innerHTML = `<div class="msg">Loading…</div>`;
  try {
    const r = await fetch(
      `/api/history?tokenId=${option.tokenId}&interval=${interval}`
    );
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const { points } = await r.json();
    if (!points || points.length < 2) {
      host.innerHTML = `<div class="msg">Not enough data.</div>`;
      return;
    }
    host.innerHTML = sparkline(points, option.label);
  } catch (err) {
    host.innerHTML = `<div class="msg">Chart unavailable (${err.message}).</div>`;
  }
}

// Inline SVG sparkline of a probability series (0..1 mapped to 0..100%).
function sparkline(points, label) {
  const W = 300;
  const H = 90;
  const pad = 6;
  const ps = points.map((p) => p.p);
  const first = ps[0];
  const last = ps[ps.length - 1];
  const min = Math.min(...ps);
  const max = Math.max(...ps);
  const span = max - min || 1;
  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const tspan = t1 - t0 || 1;

  const coords = points.map((p) => {
    const x = pad + ((p.t - t0) / tspan) * (W - 2 * pad);
    const y = pad + (1 - (p.p - min) / span) * (H - 2 * pad);
    return [x, y];
  });

  const line = coords.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const areaPath = `${line} L${coords[coords.length - 1][0].toFixed(1)} ${H - pad} L${coords[0][0].toFixed(1)} ${H - pad} Z`;
  const up = last >= first;
  const color = up ? "#22c55e" : "#ef4444";
  const change = ((last - first) * 100).toFixed(1);
  const sign = up ? "+" : "";

  return `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img"
         aria-label="${escapeHtml(label)} price history">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.30"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${areaPath}" fill="url(#g)" stroke="none"/>
      <path d="${line}" fill="none" stroke="${color}" stroke-width="2"
            stroke-linejoin="round" stroke-linecap="round"/>
      <text x="${pad}" y="14" fill="${color}" font-size="12" font-weight="700">
        ${fmtPct(last)} (${sign}${change}pp)
      </text>
    </svg>`;
}

// --- Kalshi indicator panel --------------------------------------------------

function fmtNum(n) {
  if (n == null) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}

function setChange(el, pct) {
  if (pct == null) {
    el.textContent = "—";
    el.className = "chg";
    return;
  }
  const up = pct >= 0;
  el.textContent = `${up ? "+" : ""}${pct.toFixed(1)}%`;
  el.className = `chg ${up ? "up" : "down"}`;
}

async function loadKalshi() {
  const panel = document.getElementById("kalshiPanel");
  try {
    const r = await fetch("/api/kalshi");
    if (r.status === 503) {
      panel.hidden = true; // Dune key not configured — hide silently
      return;
    }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    const { latest, series } = data;
    if (!latest) {
      panel.hidden = true;
      return;
    }

    document.getElementById("kalshiSource").textContent = data.source;
    document.getElementById("kalshiAdv").textContent = fmtNum(latest.adv);
    document.getElementById("kalshiTotal").textContent = fmtNum(latest.totalContracts);
    setChange(document.getElementById("kalshiMom"), latest.momPct);
    setChange(document.getElementById("kalshiYoy"), latest.yoyPct);

    document.getElementById("kalshiChart").innerHTML = barChart(
      series.map((s) => ({ label: s.month, value: s.adv }))
    );

    const sum = data.summary || {};
    const range = sum.firstMonth
      ? `${sum.firstMonth} → ${sum.lastMonth} (${sum.months} mo)`
      : `${series.length} mo`;
    const allTime = sum.allTimeContracts
      ? ` · ${fmtNum(sum.allTimeContracts)} contracts all-time`
      : "";
    const note =
      `History: ${range}${allTime} · ADV = contracts ÷ calendar days · ` +
      `latest ${latest.month}` +
      (latest.partial ? ` (partial — ${latest.calendarDays} days so far)` : "");
    document.getElementById("kalshiNote").textContent = note;

    panel.hidden = false;
  } catch {
    panel.hidden = true; // don't let the indicator break the dashboard
  }
}

// Monthly bar chart (absolute values, e.g. ADV) as inline SVG.
function barChart(items) {
  if (!items || items.length === 0) return "";
  const W = 720;
  const H = 70;
  const max = Math.max(...items.map((d) => d.value), 1);
  const gap = 3;
  const bw = (W - gap * (items.length - 1)) / items.length;
  const bars = items
    .map((d, i) => {
      const h = Math.max(2, (d.value / max) * (H - 16));
      const x = i * (bw + gap);
      const y = H - h;
      const last = i === items.length - 1;
      return (
        `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" ` +
        `height="${h.toFixed(1)}" rx="2" fill="${last ? "#3b82f6" : "#2f6fd0"}" ` +
        `opacity="${last ? 1 : 0.6}"><title>${escapeHtml(d.label)}: ${fmtNum(d.value)}</title></rect>`
      );
    })
    .join("");
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img"
    aria-label="Monthly average daily volume">${bars}</svg>`;
}

function escapeHtml(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

// --- events & boot -----------------------------------------------------------

document.querySelectorAll(".tab").forEach((tab) =>
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    state.tab = tab.dataset.tab;
    load();
  })
);

let searchTimer;
els.search.addEventListener("input", (e) => {
  state.q = e.target.value.trim();
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => load(), 300);
});

els.sort.addEventListener("change", (e) => {
  state.sort = e.target.value;
  load();
});

saveWatch();
load();
loadKalshi();
setInterval(() => load({ silent: true }), REFRESH_MS);
setInterval(loadKalshi, 3600000); // Dune data updates ~daily; refresh hourly
