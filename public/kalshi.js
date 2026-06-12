// Kalshi daily dashboard — interactive charts over the full daily history.
// Talks only to our /api/kalshi/daily proxy.

const els = {
  dashboard: document.getElementById("dashboard"),
  notConfigured: document.getElementById("notconfigured"),
  statCards: document.getElementById("statCards"),
  dailyChart: document.getElementById("dailyChart"),
  cumChart: document.getElementById("cumChart"),
  rangeTabs: document.getElementById("rangeTabs"),
  sourceLabel: document.getElementById("sourceLabel"),
  lastUpdated: document.getElementById("lastUpdated"),
};

let state = { range: "all" };

// --- formatting --------------------------------------------------------------

function fmtNum(n) {
  if (n == null) return "—";
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}

function fmtFull(n) {
  return n == null ? "—" : Math.round(n).toLocaleString();
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// --- data --------------------------------------------------------------------

async function load() {
  try {
    const r = await fetch(`/api/kalshi/daily?range=${state.range}`);
    if (r.status === 503) {
      els.notConfigured.hidden = false;
      els.dashboard.hidden = true;
      return;
    }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();

    els.sourceLabel.textContent = data.source;
    els.notConfigured.hidden = true;
    els.dashboard.hidden = false;

    renderStats(data.summary);
    renderArea(els.dailyChart, data.series, "trades", "#3b82f6", "trades");
    renderArea(els.cumChart, data.series, "cumulative", "#22c55e", "cumulative");
    els.lastUpdated.textContent = `updated ${new Date().toLocaleTimeString()}`;
  } catch (err) {
    els.dashboard.hidden = true;
    els.notConfigured.hidden = false;
    els.notConfigured.textContent = `Could not load daily data: ${err.message}`;
  }
}

function renderStats(s) {
  const cards = [
    { label: "Latest day", value: fmtNum(s.latest?.trades), sub: fmtDate(s.latest?.date) },
    { label: "7-day avg", value: fmtNum(s.avg7), sub: "trades / day" },
    { label: "30-day avg", value: fmtNum(s.avg30), sub: "trades / day" },
    { label: "30-day total", value: fmtNum(s.total30), sub: "trades" },
    { label: "Peak day", value: fmtNum(s.peak?.trades), sub: fmtDate(s.peak?.date) },
    { label: "All-time", value: fmtNum(s.allTimeContracts), sub: `${s.days} days` },
  ];
  els.statCards.innerHTML = cards
    .map(
      (c) => `
      <div class="stat-card">
        <span class="stat-label">${c.label}</span>
        <span class="stat-value">${c.value}</span>
        <span class="stat-sub">${c.sub}</span>
      </div>`
    )
    .join("");
}

// --- charts ------------------------------------------------------------------

// Responsive SVG area chart with a hover guide line + tooltip.
function renderArea(host, points, key, color, unit) {
  if (!points || points.length < 2) {
    host.innerHTML = `<div class="msg">Not enough data.</div>`;
    return;
  }
  const W = 1000;
  const H = 280;
  const padX = 8;
  const padTop = 12;
  const padBot = 22;
  const vals = points.map((p) => p[key]);
  const max = Math.max(...vals, 1);
  const min = Math.min(...vals, 0);
  const span = max - min || 1;
  const n = points.length;

  const xAt = (i) => padX + (i / (n - 1)) * (W - 2 * padX);
  const yAt = (v) => padTop + (1 - (v - min) / span) * (H - padTop - padBot);

  const coords = points.map((p, i) => [xAt(i), yAt(p[key])]);
  const line = coords
    .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const area =
    `${line} L${coords[n - 1][0].toFixed(1)} ${H - padBot} ` +
    `L${coords[0][0].toFixed(1)} ${H - padBot} Z`;

  // A few date ticks along the x-axis.
  const ticks = [];
  const tickCount = Math.min(6, n);
  for (let t = 0; t < tickCount; t++) {
    const i = Math.round((t / (tickCount - 1)) * (n - 1));
    ticks.push(
      `<text x="${xAt(i).toFixed(1)}" y="${H - 6}" class="tick" ` +
        `text-anchor="${t === 0 ? "start" : t === tickCount - 1 ? "end" : "middle"}">` +
        `${fmtDate(points[i].date).replace(/,/, "")}</text>`
    );
  }

  const gid = `grad-${key}`;
  host.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="area-svg">
      <defs>
        <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${area}" fill="url(#${gid})"/>
      <path d="${line}" fill="none" stroke="${color}" stroke-width="2"
            stroke-linejoin="round" stroke-linecap="round"
            vector-effect="non-scaling-stroke"/>
      <line class="guide" x1="0" y1="${padTop}" x2="0" y2="${H - padBot}"
            stroke="${color}" stroke-width="1" opacity="0" />
      <circle class="dot" r="3.5" fill="${color}" opacity="0" />
      ${ticks.join("")}
    </svg>
    <div class="tip" hidden></div>`;

  wireHover(host, { points, key, unit, coords, W, H, color });
}

function wireHover(host, ctx) {
  const svg = host.querySelector("svg");
  const guide = svg.querySelector(".guide");
  const dot = svg.querySelector(".dot");
  const tip = host.querySelector(".tip");
  const { points, key, unit, coords, W } = ctx;

  const move = (e) => {
    const rect = svg.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const i = Math.round(ratio * (points.length - 1));
    const p = points[i];
    const [cx, cy] = coords[i];

    guide.setAttribute("x1", cx);
    guide.setAttribute("x2", cx);
    guide.setAttribute("opacity", "0.5");
    dot.setAttribute("cx", cx);
    dot.setAttribute("cy", cy);
    dot.setAttribute("opacity", "1");

    tip.hidden = false;
    tip.innerHTML = `<strong>${fmtDate(p.date)}</strong><br>${fmtFull(p[key])} ${unit}`;
    // position tooltip within the host, following the cursor
    const hostRect = host.getBoundingClientRect();
    let left = clientX - hostRect.left + 12;
    if (left > hostRect.width - 130) left = clientX - hostRect.left - 130;
    tip.style.left = `${Math.max(4, left)}px`;
    tip.style.top = `8px`;
  };

  const leave = () => {
    guide.setAttribute("opacity", "0");
    dot.setAttribute("opacity", "0");
    tip.hidden = true;
  };

  svg.addEventListener("mousemove", move);
  svg.addEventListener("mouseleave", leave);
  svg.addEventListener("touchstart", move, { passive: true });
  svg.addEventListener("touchmove", move, { passive: true });
  svg.addEventListener("touchend", leave);
}

// --- events & boot -----------------------------------------------------------

els.rangeTabs.querySelectorAll("button").forEach((btn) =>
  btn.addEventListener("click", () => {
    els.rangeTabs.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.range = btn.dataset.range;
    load();
  })
);

load();
setInterval(load, 3600000); // refresh hourly
