const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=__dirname;
const engine=fs.readFileSync(path.join(root,'bounties-engine.js'),'utf8');
const economy=fs.readFileSync(path.join(root,'economy-engine.js'),'utf8');
const css=fs.readFileSync(path.join(root,'bounties.css'),'utf8');
const html=fs.readFileSync(path.join(root,'snap-draft.html'),'utf8');

assert.match(engine,/const VERSION="1\.4\.0"/);
assert.match(html,/bounties\.css\?v=1\.4\.0/);
assert.match(html,/bounties-engine\.js\?v=1\.4\.0/);
assert.match(html,/economy-engine\.js\?v=2\.3\.1/);

// Announcement timing: readable hold + separate fade, not the old ~1.8s flash.
assert.match(engine,/dismissAnnouncement\(toast,\{hold:2850,fade:470\}\)/);
assert.match(engine,/setTimeout\(\(\)=>overlay\.classList\.add\("is-leaving"\),3350\)/);
assert.match(engine,/3850/);

// Dynamic text is fitted to explicit UI zones.
assert.match(engine,/function fitTextToBox/);
assert.match(engine,/data-bounty-fit-max="38"/);
assert.match(engine,/class="bounty-round-title"/);
assert.match(engine,/class="bounty-aged-name"/);

// Marker is deliberately larger than the Work first pass.
assert.match(css,/--bounty-marker-width:clamp\(60px,60%,76px\)!important/);

// Reward frame: exactly one canonical static JeffCoin in the art slot.
assert.match(economy,/economy-bounty-award-static-coin/);
assert.match(css,/\.economy-bounty-award-static-coin/);
assert.match(css,/\.economy-jeffcoin-award-flight\.is-bounty-award \.economy-award-coins\{display:none!important;\}/);

// Multiple coins exist only as a separate flight to the Player Panel.
assert.match(economy,/economy-bounty-coin-burst/);
assert.match(css,/@keyframes bountyCoinFly/);
assert.match(css,/bounty-award-arrival-pulse/);

// Typography uses game UI treatment rather than a flat browser font.
assert.match(css,/-webkit-text-stroke:1\.25px/);
assert.match(css,/drop-shadow\(0 6px 0 #21133f\)/);
assert.match(css,/font-family:"Orbitron","Arial Black"/);

console.log('Bounty Hunters B5 UI polish regression OK');
