const fs=require("fs");
const assert=require("assert");
const path=name=>fs.readFileSync(__dirname+"/"+name,"utf8");

const groot=path("superpowers-groot.js");
const grootCss=path("superpowers-groot.css");
const economy=path("economy-engine.js");
const economyCss=path("economy.css");
const html=path("snap-draft.html");
const saveSteal=path("saveSteal.js");
const data=path("superpowers-data.js");

assert.match(groot,/GARDEN_ECONOMY_CONVERSION_CAP=5/);
assert.match(groot,/id:"heart",cost:8[\s\S]*?options:4,chooseCost:true/);
assert.match(groot,/data-groot-heart-cost/);
assert.match(groot,/replacementPool\(state\.gardenPlayerIndex,state\.gardenDeckIndex\)/);
assert.match(groot,/EconomyEngine\?\.credit\?\.\(state\.gardenPlayerIndex,amount/);
assert.match(groot,/reason:"groot_tree_of_abundance"/);
assert.match(groot,/convertedGrowthPoints/);
assert.match(groot,/convertedJeffCoins/);
assert.match(groot,/groot\.purchases\|\|\[\]\)\.length/,'conversion requires a normal Garden purchase');
assert.match(grootCss,/spx-groot-economy-bridge/);
assert.match(grootCss,/spx-groot-cost-grid/);

assert.match(html,/\["steal","copy","destroy","reroll","replace","transform"\]\.includes\(normalizedEffect\)/);
assert.match(saveSteal,/EconomyEngine\?\.isPlayerCardProtected\?\.\(victim,card\)/);
assert.match(economy,/\.card\[data-card-instance-id\],\.deckInspectorCard\[data-card-instance-id\]/);
assert.match(economy,/economy-stellar-shield-field/);
assert.match(economyCss,/economyStellarShieldSweep/);
assert.doesNotMatch(economyCss,/\.economy-stellar-shield-marker\s*\{/,'legacy star marker CSS removed');
assert.match(data,/heartPlanetX: \{options:4,chooseCost:true,permanentProtection:true\}/);
assert.match(data,/economyGrowthConversion: \{enabledWhenEconomy:true,rate:"1:1",maxJeffCoins:5,requiresGardenPurchase:true\}/);

console.log("Patch Groot + Shop Ochrona V1 regression OK");
