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

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Prediction market tracker running at http://localhost:${PORT}`);
});
