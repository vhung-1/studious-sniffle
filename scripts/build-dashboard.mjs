// Build a fully self-contained dashboard.html with the Kalshi daily history
// baked in. Fetches the Dune query once and injects the data into the template,
// so the resulting file opens in any browser with no server and no API key.
//
//   DUNE_API_KEY=... node scripts/build-dashboard.mjs
//
// (npm run build:dashboard auto-loads .env)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const DUNE_API = "https://api.dune.com/api/v1";
const KEY = process.env.DUNE_API_KEY || "";
const QUERY_ID = process.env.KALSHI_DUNE_QUERY_ID || "5741350";

if (!KEY) {
  console.error("DUNE_API_KEY is not set. Aborting.");
  process.exit(1);
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(",");
    const row = {};
    headers.forEach((h, i) => (row[h] = (cols[i] ?? "").trim()));
    return row;
  });
}

const res = await fetch(`${DUNE_API}/query/${QUERY_ID}/results/csv`, {
  headers: { "x-dune-api-key": KEY, accept: "text/csv" },
  signal: AbortSignal.timeout(60000),
});
if (!res.ok) {
  console.error(`Dune fetch failed: HTTP ${res.status}`);
  process.exit(1);
}

const rows = parseCsv(await res.text());
const daily = rows
  .filter((r) => r.date && r.date.length >= 10)
  .map((r) => [r.date.slice(0, 10), Number(r.Trades) || 0])
  .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

const data = {
  source: `Dune Analytics #${QUERY_ID}`,
  queryId: QUERY_ID,
  generatedAt: new Date().toISOString(),
  daily,
};

const template = fs.readFileSync(
  path.join(ROOT, "public", "dashboard.template.html"),
  "utf8"
);
// Function replacement avoids $-pattern interpretation in String.replace.
const out = template.replace("/*__DATA__*/ null", () => JSON.stringify(data));

const dest = path.join(ROOT, "public", "dashboard.html");
fs.writeFileSync(dest, out);

const bytes = Buffer.byteLength(out);
console.log(
  `Wrote ${path.relative(ROOT, dest)} — ${daily.length} days ` +
    `(${daily[0][0]} → ${daily[daily.length - 1][0]}), ${(bytes / 1024).toFixed(0)} KB`
);
