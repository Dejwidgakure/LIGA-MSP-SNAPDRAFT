const fs = require('fs');
const path = require('path');
const base = __dirname;
const css = fs.readFileSync(path.join(base,'economy.css'),'utf8');
const js = fs.readFileSync(path.join(base,'economy-engine.js'),'utf8');
const html = fs.readFileSync(path.join(base,'snap-draft.html'),'utf8');
function assert(cond,msg){ if(!cond){ throw new Error(msg); } }
assert(html.includes('economy.css?v=2.6.0'),'snap-draft should reference economy.css v2.6.0');
assert(html.includes('economy-engine.js?v=2.6.0'),'snap-draft should reference economy-engine.js v2.6.0');
assert(js.includes('economy-product-v2-spark economy-product-v2-spark-a'),'Product cards should render sparkle overlays');
assert((js.match(/economy-shop-coin-drift/g)||[]).length >= 6,'Shop overlay should render multiple ambient JeffCoins');
assert(css.includes('@keyframes economyProductTitleGlow'),'Shop CSS should animate product title glow');
assert(css.includes('@keyframes economyProductSheen'),'Shop CSS should animate product sheen');
assert(css.includes('.economy-shop-panel.economy-shop-v2 .economy-product-v2-promo{'),'Shop CSS should define promo ribbon styling');
console.log('PATCH113A shop typography regression checks passed.');
