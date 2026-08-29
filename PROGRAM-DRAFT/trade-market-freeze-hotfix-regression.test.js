"use strict";
const fs=require("node:fs");
const path=require("node:path");
const assert=require("node:assert/strict");
const ui=fs.readFileSync(path.join(__dirname,"trade-market-ui.js"),"utf8");
const html=fs.readFileSync(path.join(__dirname,"snap-draft.html"),"utf8");
assert.match(ui,/1\.0\.3-trade-market-open-runtime-fix/);
assert.ok(html.includes("trade-market-ui.js?v=1.0.5-final-audit-01"));

const start=ui.indexOf("function decorateListedCards(){");
const end=ui.indexOf("function decorateAll()",start);
assert.notEqual(start,-1);
assert.notEqual(end,-1);
const decorate=ui.slice(start,end);

assert.doesNotMatch(decorate,/querySelectorAll\("\.is-trade-market-listed"\)[\s\S]*badge\.remove\(\)/,
  "decorator no longer clears every badge before rebuilding it");
assert.match(decorate,/if\(!listing\)[\s\S]*if\(badge\) badge\.remove\(\)/,
  "a badge is removed only when that card is no longer listed");
assert.match(decorate,/if\(!badge\)[\s\S]*appendChild\(nextBadge\)/,
  "existing listing badges are reused instead of recreated every pass");
assert.match(decorate,/dataset\.tradeMarketDecoration="listing"/,
  "Trade Market listing badges own an explicit decoration marker for observer filtering");
assert.match(ui,/dataset\.tradeMarketDecoration="quick-button"/,
  "Trade Market quick buttons are also marked as observer-owned decorations");

assert.doesNotMatch(ui,/function initObserver\(\)/,
  "Trade Market no longer owns a whole-deck MutationObserver");
assert.doesNotMatch(ui,/new MutationObserver\(/,
  "Trade Market UI is fully event/render driven after hard-freeze fix");
assert.match(ui,/function scheduleDecorate\(delay=0\)/,
  "decoration refreshes are coalesced instead of firing recursively");
assert.match(ui,/function schedulePanelRender\(delay=0\)/,
  "panel refreshes are coalesced across Economy/Trade events");
assert.match(html,/window\.TradeMarketUI\?\.refresh\?\.\(\);/,
  "canonical showDecks render explicitly refreshes Trade Market decorations");

const css=fs.readFileSync(path.join(__dirname,"trade-market.css"),"utf8");
assert.doesNotMatch(css,/TRADE MARKET HARD FREEZE SAFE MODE/,
  "diagnostic visual safe-mode is removed after the runtime crash root cause was identified");
console.log("PASS Trade Market freeze hotfix regression");
