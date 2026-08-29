const fs=require('fs');
const assert=require('assert');

const shop=fs.readFileSync(__dirname+'/economy-shop-core.js','utf8');
const css=fs.readFileSync(__dirname+'/economy.css','utf8');
const html=fs.readFileSync(__dirname+'/snap-draft.html','utf8');

assert.match(shop,/const VERSION="2\.5\.1"/);
assert.match(html,/economy-shop-core\.js\?v=2\.5\.1/);
assert.match(html,/economy\.css\?v=2\.6\.0-shop-refinement/);
assert.match(shop,/function miniCardMarkup\(/);
assert.match(shop,/function showCardExchangeAnimation\(/);
assert.match(shop,/shop_mini_card_frame\.png/);
assert.match(css,/shop_coin_swirl_fx\.png/);

// Locked reveal: direct rerolls/scans must commit before generating/revealing,
// and result selection after commit has no cancel path.
assert.match(shop,/confirmCommit\(\{[\s\S]*actionLabel:kind==="deep"\?"OTWÓRZ SKAN":"LOSUJ"/);
assert.match(shop,/const generated=b\.getReplacementOptions[\s\S]*chooseReplacement\(generated,\{[\s\S]*allowCancel:false/);
assert.match(shop,/SKAN KOSZTU[\s\S]*actionLabel:"SKANUJ"[\s\S]*chooseReplacement\(options,\{[\s\S]*allowCancel:false,kind:"cost"/);
assert.match(shop,/SKAN SYNERGII[\s\S]*actionLabel:"SKANUJ"[\s\S]*chooseReplacement\(options,\{[\s\S]*allowCancel:false,kind:"synergy"/);

// Mystery must ask before reveal, then force realization with no close button.
assert.match(shop,/TAJEMNICZA OFERTA[\s\S]*actionLabel:"LOSUJ",kind:"mystery"/);
assert.match(shop,/runInterlude\(\{title:"TAJEMNICZA OFERTA"[\s\S]*const chosen=candidates\[Math\.floor\(Math\.random\(\)\*candidates\.length\)\]/);
assert.match(shop,/showNotice\("TAJEMNICZA OFERTA"[\s\S]*Wynik jest zablokowany/);

// Product-specific motion hooks exist for every core family.
for(const kind of ['exchange','sift','deep','orbit','cost','synergy','momentum','shield','mystery']){
  assert.ok(shop.includes(`kind:"${kind}"`) || shop.includes(`kind="${kind}"`) || shop.includes(`economy-flow-${kind}`),`missing JS hook ${kind}`);
  assert.ok(css.includes(`economy-flow-${kind}`),`missing CSS motion ${kind}`);
}
assert.match(css,/economy-purchase-burst/);
assert.match(css,/prefers-reduced-motion/);

console.log('Economy E2.1 flow regression OK');
