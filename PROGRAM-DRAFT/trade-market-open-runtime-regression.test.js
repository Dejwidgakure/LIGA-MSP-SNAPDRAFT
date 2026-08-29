const fs=require("fs");
const path=require("path");
const assert=require("assert");

const ui=fs.readFileSync(path.join(__dirname,"trade-market-ui.js"),"utf8");
const html=fs.readFileSync(path.join(__dirname,"snap-draft.html"),"utf8");

assert.match(ui,/const VERSION="1\.0\.3-trade-market-open-runtime-fix"/);
assert.match(ui,/function canActAs\(playerIndex\)\{/,
  "Trade Market UI must define canActAs before Market/Negotiations render");
assert.match(ui,/function renderMarketView\(playerIndex\)[\s\S]*?canActAs\(playerIndex\)/,
  "Market view must use the local permission helper");
assert.match(ui,/function renderNegotiationsView\(playerIndex\)[\s\S]*?canActAs\(playerIndex\)/,
  "Negotiations view must use the local permission helper");
assert.match(ui,/if\(runtime\(\)\?\.isPostDraft\?\.\(\)\) return true;/,
  "Post-draft operator access must stay available");
assert.match(ui,/return activePlayer\(\)===p;/,
  "During draft only the active player's panel may act");
assert.match(html,/trade-market-ui\.js\?v=1\.0\.5-final-audit-01/,
  "snap-draft.html must cache-bust the runtime fix");
assert.doesNotMatch(ui,/PRĄD • ADAPTER|PRĄD • GOTOWA/);
console.log("Trade Market open runtime regression — PASS");
