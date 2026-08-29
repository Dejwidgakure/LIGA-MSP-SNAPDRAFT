const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=__dirname;
const assets=path.join(root,'draft-assets');
const expected={
  'galactic_hunts_icon.png':[1024,1024],
  'bounty_badge_shell.png':[512,307],
  'bounty_badge_plus2.png':[512,307],
  'bounty_badge_plus3.png':[512,307],
  'bounty_badge_plus4.png':[512,307],
  'bounty_badge_flash_sale.png':[512,307],
  'bounty_round_banner.png':[1600,700],
  'bounty_new_alert.png':[1400,500],
  'bounty_reward_panel.png':[1200,600],
  'bounty_expired_stamp.png':[900,400],
  'bounty_flash_sale_price_ribbon.png':[1000,250],
  'galactic_hunts_encyclopedia.png':[1600,900]
};

function pngSize(buffer){
  assert.equal(buffer.toString('ascii',1,4),'PNG','asset must be a PNG');
  return [buffer.readUInt32BE(16),buffer.readUInt32BE(20)];
}

for(const [name,size] of Object.entries(expected)){
  const file=path.join(assets,name);
  assert.ok(fs.existsSync(file),`missing ${name}`);
  assert.deepEqual(pngSize(fs.readFileSync(file)),size,`wrong canvas for ${name}`);
}

const css=fs.readFileSync(path.join(root,'bounties.css'),'utf8');
assert.match(css,/\.bounty-card-marker\{[\s\S]*?left:50%!important;[\s\S]*?top:auto!important;[\s\S]*?bottom:3px!important;/);
assert.match(css,/\.bounty-card-marker::after,\s*\.bounty-card-marker::before\{display:none!important/);
assert.match(css,/bounty_badge_shell\.png/);
assert.match(css,/\.economy-product-card \.economy-price-modifier-badge\.is-bounty-flash-sale\{[\s\S]*?bottom:2\.5%!important;[\s\S]*?height:15\.5%!important;/);
assert.match(css,/bounty_flash_sale_price_ribbon\.png/);

const economy=fs.readFileSync(path.join(root,'economy-engine.js'),'utf8');
assert.match(economy,/bountyFlashSale=modified/);
assert.match(economy,/is-bounty-flash-sale/);
assert.match(economy,/is-bounty-award/);

const html=fs.readFileSync(path.join(root,'snap-draft.html'),'utf8');
assert.match(html,/draft-assets\/galactic_hunts_icon\.png/);

console.log('Bounty Hunters flat asset integration regression OK');
