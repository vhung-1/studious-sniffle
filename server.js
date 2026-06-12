// Prediction Market Tracker — backend.
//
// Thin proxy + cache in front of Polymarket's public APIs. The browser never
// talks to Polymarket directly; everything is normalized and cached here so the
// UI gets a stable shape and we stay friendly to the upstream rate limits.

import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 3000;
const GAMMA = "https://gamma-api.polymarket.com";
const CLOB = "https://clob.polymarket.com";

// Dune Analytics — optional. Powers the Kalshi indicator panel. The key is
// read from the environment (never committed); the query id defaults to the
// "daily Kalshi trades" query but can be overridden.
const DUNE_API = "https://api.dune.com/api/v1";
const DUNE_KEY = process.env.DUNE_API_KEY || "";
const KALSHI_QUERY_ID = process.env.KALSHI_DUNE_QUERY_ID || "5741350";

const app = express();
app.use(express.static(path.join(__dirname, "public")));

// --- tiny in-memory TTL cache ------------------------------------------------

const cache = new Map();

async function cached(key, ttlMs, producer) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await producer();
  cache.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    throw new Error(`upstream ${res.status} for ${url}`);
  }
  return res.json();
}

async function fetchText(url, headers = {}) {
  const res = await fetch(url, {
    headers: { accept: "text/csv", ...headers },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    throw new Error(`upstream ${res.status} for ${url}`);
  }
  return res.text();
}

// outcomes / outcomePrices / clobTokenIds arrive as JSON-encoded strings.
function parseMaybeJson(value, fallback) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// Reduce a raw Polymarket market to the fields the UI actually renders.
function normalizeMarket(m) {
  const outcomes = parseMaybeJson(m.outcomes, []);
  const prices = parseMaybeJson(m.outcomePrices, []).map(num);
  const tokenIds = parseMaybeJson(m.clobTokenIds, []);

  const options = outcomes.map((label, i) => ({
    label,
    price: prices[i] ?? null,
    tokenId: tokenIds[i] ?? null,
  }));

  return {
    id: String(m.id),
    question: m.question,
    slug: m.slug,
    image: m.image || m.icon || null,
    endDate: m.endDate || m.endDateIso || null,
    closed: Boolean(m.closed),
    active: Boolean(m.active),
    options,
    volume: num(m.volumeNum ?? m.volume),
    volume24hr: num(m.volume24hr),
    volume1wk: num(m.volume1wk),
    liquidity: num(m.liquidityNum ?? m.liquidity),
    url: m.slug ? `https://polymarket.com/market/${m.slug}` : null,
  };
}

const SORTS = {
  volume24hr: "volume24hr",
  volume: "volumeNum",
  liquidity: "liquidityNum",
  endDate: "endDate",
};

// --- API routes --------------------------------------------------------------

// GET /api/markets?sort=&q=&limit=
app.get("/api/markets", async (req, res) => {
  try {
    const sort = SORTS[req.query.sort] ? req.query.sort : "volume24hr";
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 60, 1), 200);
    const q = (req.query.q || "").trim().toLowerCase();

    // For search we pull a wider window then filter locally, since Gamma's text
    // search is limited; otherwise we ask upstream to sort for us.
    const upstreamLimit = q ? 500 : limit;
    const params = new URLSearchParams({
      closed: "false",
      active: "true",
      archived: "false",
      order: SORTS[sort],
      ascending: sort === "endDate" ? "true" : "false",
      limit: String(upstreamLimit),
    });

    const key = `markets:${params.toString()}`;
    const raw = await cached(key, 20000, () =>
      fetchJson(`${GAMMA}/markets?${params}`)
    );

    let markets = raw.map(normalizeMarket).filter((m) => m.options.length > 0);

    if (q) {
      markets = markets.filter((m) => m.question?.toLowerCase().includes(q));
      // keep search results in the requested sort order
      const dir = sort === "endDate" ? 1 : -1;
      const field = sort === "endDate" ? "endDate" : sort;
      markets.sort((a, b) => {
        if (field === "endDate") {
          return (new Date(a.endDate) - new Date(b.endDate)) * dir;
        }
        return (a[field] - b[field]) * dir;
      });
      markets = markets.slice(0, limit);
    }

    res.json({ count: markets.length, markets });
  } catch (err) {
    res.status(502).json({ error: String(err.message || err) });
  }
});

// GET /api/markets/by-ids?ids=1,2,3  — used to refresh the watchlist
app.get("/api/markets/by-ids", async (req, res) => {
  try {
    const ids = (req.query.ids || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 100);
    if (ids.length === 0) return res.json({ markets: [] });

    const params = new URLSearchParams();
    ids.forEach((id) => params.append("id", id));
    params.set("limit", String(ids.length));

    const key = `byids:${ids.sort().join(",")}`;
    const raw = await cached(key, 20000, () =>
      fetchJson(`${GAMMA}/markets?${params}`)
    );
    res.json({ markets: raw.map(normalizeMarket) });
  } catch (err) {
    res.status(502).json({ error: String(err.message || err) });
  }
});

// GET /api/history?tokenId=...&interval=1m|1w|1d|max
app.get("/api/history", async (req, res) => {
  try {
    const tokenId = (req.query.tokenId || "").trim();
    if (!tokenId) return res.status(400).json({ error: "tokenId required" });

    const allowed = new Set(["1d", "1w", "1m", "max"]);
    const interval = allowed.has(req.query.interval) ? req.query.interval : "1m";
    const fidelity = interval === "1d" ? 5 : interval === "1w" ? 60 : 720;

    const params = new URLSearchParams({
      market: tokenId,
      interval,
      fidelity: String(fidelity),
    });
    const key = `hist:${params.toString()}`;
    const data = await cached(key, 60000, () =>
      fetchJson(`${CLOB}/prices-history?${params}`)
    );

    const points = (data.history || []).map((h) => ({ t: h.t, p: h.p }));
    res.json({ points });
  } catch (err) {
    res.status(502).json({ error: String(err.message || err) });
  }
});

// --- Kalshi indicator (Dune Analytics) --------------------------------------

// Minimal CSV parser — the Dune export has clean, comma-free integer fields.
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(",");
    const row = {};
    headers.forEach((h, i) => (row[h] = (cols[i] ?? "").trim()));
    return row;
  });
}

// Roll daily trade counts up into monthly totals and derive ADV / MoM / YoY.
// Returns the FULL monthly history (oldest first); callers slice if they want a
// shorter window. `rows` come from query #5741350:
// { date: "YYYY-MM-DD", Trades, "Cumulative Trades" }.
function rollupKalshi(rows) {
  const byMonth = new Map(); // "YYYY-MM" -> { total, maxDay }
  for (const r of rows) {
    const date = r.date;
    if (!date || date.length < 10) continue;
    const month = date.slice(0, 7);
    const day = Number(date.slice(8, 10));
    const trades = num(r.Trades);
    const cur = byMonth.get(month) || { total: 0, maxDay: 0 };
    cur.total += trades;
    cur.maxDay = Math.max(cur.maxDay, day);
    byMonth.set(month, cur);
  }

  const months = [...byMonth.keys()].sort();
  const lastMonth = months[months.length - 1];

  const series = months.map((m) => {
    const { total, maxDay } = byMonth.get(m);
    const [y, mo] = m.split("-").map(Number);
    const daysInMonth = new Date(y, mo, 0).getDate();
    // The trailing month is usually partial; measure ADV over days elapsed.
    const partial = m === lastMonth && maxDay < daysInMonth;
    const calendarDays = partial ? maxDay : daysInMonth;
    const adv = calendarDays ? total / calendarDays : 0;
    return { month: m, totalContracts: total, calendarDays, adv, partial };
  });

  // MoM / YoY computed on ADV (normalizes for month length) using full history.
  const advByMonth = new Map(series.map((s) => [s.month, s.adv]));
  const pct = (cur, prev) => (prev ? ((cur - prev) / prev) * 100 : null);
  for (const s of series) {
    const [y, mo] = s.month.split("-").map(Number);
    const prevM = `${mo === 1 ? y - 1 : y}-${String(mo === 1 ? 12 : mo - 1).padStart(2, "0")}`;
    const prevY = `${y - 1}-${String(mo).padStart(2, "0")}`;
    s.momPct = pct(s.adv, advByMonth.get(prevM));
    s.yoyPct = pct(s.adv, advByMonth.get(prevY));
  }

  return series;
}

// GET /api/kalshi[?months=N] — monthly Kalshi trade activity from Dune query
// #5741350. Returns the full history back to inception by default; pass
// `months` to limit the window (e.g. ?months=13).
app.get("/api/kalshi", async (req, res) => {
  if (!DUNE_KEY) {
    return res
      .status(503)
      .json({ error: "DUNE_API_KEY not configured", configured: false });
  }
  try {
    const full = await cached(`kalshi:${KALSHI_QUERY_ID}`, 3600000, async () => {
      const text = await fetchText(
        `${DUNE_API}/query/${KALSHI_QUERY_ID}/results/csv`,
        { "x-dune-api-key": DUNE_KEY }
      );
      return rollupKalshi(parseCsv(text));
    });

    const months = parseInt(req.query.months, 10);
    const series = months > 0 ? full.slice(-months) : full;

    res.json({
      source: `Dune Analytics #${KALSHI_QUERY_ID}`,
      summary: {
        firstMonth: full[0]?.month || null,
        lastMonth: full[full.length - 1]?.month || null,
        months: full.length,
        allTimeContracts: full.reduce((a, s) => a + s.totalContracts, 0),
      },
      latest: full[full.length - 1] || null,
      series,
    });
  } catch (err) {
    res.status(502).json({ error: String(err.message || err) });
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Prediction market tracker running at http://localhost:${PORT}`);
});
