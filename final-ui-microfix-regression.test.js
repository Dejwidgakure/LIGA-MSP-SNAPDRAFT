"use strict";
const fs=require("node:fs");
const path=require("node:path");
const assert=require("node:assert/strict");
const html=fs.readFileSync(path.join(__dirname,"snap-draft.html"),"utf8");
const grootCss=fs.readFileSync(path.join(__dirname,"superpowers-groot.css"),"utf8");

assert.doesNotMatch(html,/PRĄD • ADAPTER/);
assert.doesNotMatch(html,/PRĄD • GOTOWA/);
assert.match(html,/if\(gcMode&&gcCompatibility&&gcBlocked\)/);
assert.match(html,/badge\.textContent="NIEKOMPATYBILNA"/);
assert.doesNotMatch(html,/row\.classList\.toggle\("spm-gc-adapted"/);

assert.match(html,/superpowers-groot\.css\?v=106\.4-tree-final-flow/);
assert.match(grootCss,/FINAL TREE OF ABUNDANCE FLOW/);
assert.match(grootCss,/grid-template-rows:auto auto auto auto minmax\(0,1fr\) auto!important/);
assert.match(grootCss,/\.spx-groot-economy-bridge\{[\s\S]*grid-row:4!important/);
assert.match(grootCss,/\.spx-groot-rewards\{[\s\S]*grid-row:5!important/);

console.log("PASS final UI microfix regression");
