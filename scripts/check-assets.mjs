#!/usr/bin/env node
/**
 * Guards the two asset invariants that broke the NCAA card art in production.
 *
 * 1. NO TWO SOURCE ASSETS MAY BE BYTE-IDENTICAL.
 *
 *    Vite content-hashes assets, so identical bytes collapse to one emitted
 *    file — but the SSR build can still resolve an import to the OTHER original
 *    filename, which was never written. The page then 404s that image on first
 *    paint and silently "fixes itself" on client navigation, because the client
 *    bundle uses the name that exists. It is invisible in dev, invisible in a
 *    typecheck, and only shows up as a broken image on a cold load in prod.
 *
 * 2. EVERY IMAGE THE SSR BUNDLE REFERENCES MUST EXIST IN THE CLIENT OUTPUT.
 *    This is the direct check for the same failure, and it also catches any
 *    other cause of the same symptom. Skipped when there is no build yet.
 *
 * Run: node scripts/check-assets.mjs   (after `vite build` for check 2)
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

let failed = false;

// ── 1. duplicate source assets ────────────────────────────────────────────────
const ASSET_DIR = "src/assets";
const byHash = new Map();
for (const name of readdirSync(ASSET_DIR)) {
  const path = join(ASSET_DIR, name);
  if (!statSync(path).isFile()) continue;
  if (!/\.(jpe?g|png|webp|avif|gif|svg)$/i.test(name)) continue;
  const hash = createHash("md5").update(readFileSync(path)).digest("hex");
  byHash.set(hash, [...(byHash.get(hash) ?? []), name]);
}
const dupes = [...byHash.values()].filter((names) => names.length > 1);
if (dupes.length) {
  failed = true;
  console.error("\n✖ Byte-identical assets found. Vite will emit only one of each");
  console.error("  set, and the SSR build may reference a name that was never written.");
  console.error("  Delete the copies and import the single canonical file everywhere.\n");
  for (const names of dupes) console.error(`    ${names.join("  ==  ")}`);
} else {
  console.log("✔ No duplicate source assets");
}

// ── 2. SSR image references resolve to real files ────────────────────────────
const SERVER_DIR = ".output/server";
const PUBLIC_DIR = ".output/public";
if (existsSync(SERVER_DIR) && existsSync(PUBLIC_DIR)) {
  const refs = new Set();
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(m?js|json)$/.test(e.name)) {
        const text = readFileSync(p, "utf8");
        for (const m of text.matchAll(/\/assets\/[A-Za-z0-9_-]+\.(?:jpe?g|png|webp|avif|gif)/g)) {
          refs.add(m[0]);
        }
      }
    }
  };
  walk(SERVER_DIR);

  const missing = [...refs].filter((u) => !existsSync(join(PUBLIC_DIR, u)));
  if (missing.length) {
    failed = true;
    console.error(`\n✖ ${missing.length} image(s) referenced by the SSR bundle do not exist:`);
    for (const m of missing) console.error(`    ${m}`);
  } else {
    console.log(`✔ All ${refs.size} SSR-referenced images exist in the client output`);
  }
} else {
  console.log("• Skipped SSR check (no .output — run `vite build` first)");
}

process.exit(failed ? 1 : 0);
