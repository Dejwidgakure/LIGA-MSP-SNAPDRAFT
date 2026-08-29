const fs=require('fs');
const assert=require('assert');

const catalog=fs.readFileSync(__dirname+'/economy-catalog-data.js','utf8');
const shop=fs.readFileSync(__dirname+'/economy-shop-core.js','utf8');
const engine=fs.readFileSync(__dirname+'/economy-engine.js','utf8');
const html=fs.readFileSync(__dirname+'/snap-draft.html','utf8');

assert.match(catalog,/id:"graveyard_revival"/);
assert.match(catalog,/prices:\{sale:6,standard:6\}/);
assert.match(catalog,/shop_art_graveyard_revival\.png/);
assert.match(shop,/function graveyardCandidates\(/);
assert.match(shop,/listGraveyardEntries\?\.\(\{status:"available",recoverable:true\}\)/);
assert.match(shop,/\.slice\(0,5\)/);
assert.match(shop,/recoverGraveyardCard\?\.\(playerIndex,selected\.graveyardEntryId,release\.index\)/);
assert.match(html,/function recoverEconomyGraveyardCard\(playerIndex,graveyardEntryId,replacementIndex\)/);
assert.match(html,/consumeGraveyardEntry\?\.\(entryId/);
assert.match(html,/preserveInstance:true/);
assert.match(html,/sourceZone:"graveyard"/);
assert.match(html,/replacementIndex:ci/);
assert.match(html,/decks\[p\]\.length!==deckSizeBefore/);
assert.match(shop,/WYMIANA 1:1/);
assert.match(shop,/onlyUnprotected:true/);
assert.match(html,/restoreGraveyardEntry\?\.\(entryId/);
assert.match(html,/recoverGraveyardCard:recoverEconomyGraveyardCard/);
assert.match(engine,/slice\(0,5\)/);
assert.match(engine,/slice\(5,10\)/);

console.log('Economy graveyard revival regression OK');
