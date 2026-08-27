// One-off: clear every rate-limiter key from Upstash.
//
//   node scripts/flush-ratelimit.mjs            # all groups
//   node scripts/flush-ratelimit.mjs auth       # just the "auth" group
//
// Needs UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN in .env.local
// (the same values set in Netlify). Handy when a burst of traffic — or a
// load test — has tripped a limiter and you want to reset it immediately
// instead of waiting out the window.
import { readFileSync } from "node:fs";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*(UPSTASH_[A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] ??= m[2].trim().replace(/^["']|["']$/g, "");
}

const URL_ = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
if (!URL_ || !TOKEN) {
  console.error("Missing UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (.env.local or env).");
  process.exit(1);
}

const group = process.argv[2];
const pattern = group ? `braidr:ratelimit:${group}:*` : "braidr:ratelimit:*";

async function redis(path) {
  const res = await fetch(`${URL_.replace(/\/$/, "")}/${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  return (await res.json()).result;
}

const keys = await redis(`keys/${encodeURIComponent(pattern)}`);
if (!keys?.length) {
  console.log(`No keys match ${pattern} — nothing to flush.`);
  process.exit(0);
}
for (const k of keys) {
  await redis(`del/${encodeURIComponent(k)}`);
  console.log(`deleted ${k}`);
}
console.log(`\nFlushed ${keys.length} key(s). Limiters reset.`);
