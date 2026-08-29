"use strict";
const fs=require("fs");
const assert=require("assert");
const path=require("path");
const root=__dirname;
const read=n=>fs.readFileSync(path.join(root,n),"utf8");
const mysterio=read("superpowers-mysterio.js");
const bounty=read("bounties-engine.js");
const html=read("snap-draft.html");

assert.match(mysterio,/const VERSION="1\.2\.2"/);
assert.match(mysterio,/resolvePendingReflectionDiscovery\(\)\.catch/);
const pickStart=mysterio.indexOf("function onPickFinalized(context={})");
const pickEnd=mysterio.indexOf("function takePendingPickResolution",pickStart);
assert.ok(pickStart>=0&&pickEnd>pickStart);
const pickBlock=mysterio.slice(pickStart,pickEnd);
assert.doesNotMatch(pickBlock,/await resolvePendingReflectionDiscovery/);
assert.match(pickBlock,/mysterio_stale_pattern_offer_discarded_on_pick/);
assert.match(mysterio,/requireDifferent:true/);
assert.match(mysterio,/if\(state\.currentPeek\) clearPeek\(\{rerender:false\}\)/);

assert.match(bounty,/const VERSION="1\.4\.7"/);
assert.match(bounty,/function closePresentationTable\(tableKey\)/);
assert.match(bounty,/requiresActiveTable:true/);
assert.match(bounty,/closedPresentationTables\.has/);
assert.match(bounty,/if\(remainingPicks<=0\)\{[\s\S]*closePresentationTable\(tableKey\)/);
assert.match(bounty,/announceBountyIncrease\(bounty,\{tableKey\}\)/);
assert.match(bounty,/announceAgedBounty\(bounty,\{tableKey\}\)/);

assert.match(html,/superpowers-mysterio\.js\?v=1\.2\.2/);
assert.match(html,/bounties-engine\.js\?v=1\.4\.7/);
assert.match(html,/patch112a-main-ui-neon-polish/);
assert.match(html,/#roundQueue>div\{[\s\S]*-webkit-text-stroke:0!important/);
assert.match(html,/\.deck-section \.deck>\.card,[\s\S]*0 0 5px currentColor/);

for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)){
  if(match[1].trim()) Function(match[1]);
}
console.log("PATCH112A focused regression OK");
