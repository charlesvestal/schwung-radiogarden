#!/usr/bin/env bash
# The UI contract the DSP serves (src/ui_hierarchy.json + src/chain_params.json)
# must parse, every key a level names must exist in chain_params, and the
# Browse canvas must stay an enterable page -- the host plans the module's
# first page from exactly these fields.
set -euo pipefail
cd "$(dirname "$0")/.."
node -e '
const fs = require("fs");
const h = JSON.parse(fs.readFileSync("src/ui_hierarchy.json", "utf8"));
const cp = JSON.parse(fs.readFileSync("src/chain_params.json", "utf8"));
const keys = new Set(cp.map((p) => p.key));
let fails = 0;
const fail = (m) => { console.log("FAIL: " + m); fails++; };
for (const [name, lvl] of Object.entries(h.levels || {})) {
  for (const k of [...(lvl.knobs || []), ...(lvl.params || [])]) {
    if (typeof k === "string" && !keys.has(k)) fail(`level ${name} names ${k}, which chain_params does not declare`);
    if (k && typeof k === "object" && k.level && !h.levels[k.level]) fail(`level ${name} links to missing level ${k.level}`);
  }
}
const b = cp.find((p) => p.key === "browse");
if (!b || b.type !== "canvas" || b.as_page !== true || b.enterable !== true)
  fail("browse must be an as_page, enterable canvas");
if (!fs.existsSync("src/" + (b && b.canvas_script))) fail("canvas_script does not exist in src/");
const root = h.levels.root;
if (!root || !root.params || root.params[0] !== "browse" || !(b && b.page_first === true))
  fail("browse must be the first param of root and page_first, so it is the FIRST page");
if (!root || !Array.isArray(root.knobs) || !root.knobs.length)
  fail("root must declare knobs: they are what the chain editor maps, and what the Browse page carries");
if (fails) process.exit(1);
console.log("PASS: ui contract");
'
