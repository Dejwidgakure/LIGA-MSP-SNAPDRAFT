"use strict";

// Test kontraktów integracyjnych, które nie potrzebują prawdziwego DOM-u.
// Pełne interakcje wyboru kart są sprawdzane w devil-dino-regression.test.js.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const read=name=>fs.readFileSync(path.join(__dirname,name),"utf8");
const html=read("snap-draft.html");
const dino=read("superpowers-devildino.js");
const thor=read("superpowers-thor.js");
const groot=read("superpowers-groot.js");
const dinoCss=read("superpowers-devildino.css");
const grootCss=read("superpowers-groot.css");
const thorCss=read("superpowers-thor.css");
const data=read("superpowers-data.js");
const graveyard=read("graveyard-ui.js");
const cards=fs.readFileSync(path.join(__dirname,"..","cards.js"),"utf8");

assert.match(html,/function resolvePackCardLifecycle\(/,"wspólny pipeline paczki istnieje");
assert.match(html,/resolvePackCardLifecycle\("acquire",sourceCard/,"acquire do decku przechodzi przez pipeline");
assert.match(html,/resolvePackCardLifecycle\("trueReplacement",sourceCard/,"true replacement przechodzi przez pipeline");
assert.match(html,/resolvePackCardLifecycle\("transform",sourceCard/,"transform zachowuje osobną semantykę");
assert.match(html,/minCost=Number\.isFinite/,"generator wspiera minimum printed Cost");
assert.match(html,/resolvePackCardLifecycle\("acquire",card,[\s\S]*fromZone:"pack",toZone:zoneName/,"Smocza Nagroda Iron Fista harvestuje opuszczający pack cel");

assert.match(dino,/minCost:6/,"refille Dino są ograniczone do 6+ Cost");
assert.match(dino,/result\.every\(card=>printedCost\(card\)>=6\)/,"refille Dino są walidowane po wygenerowaniu");
assert.doesNotMatch(dino,/minCost:6,[\s\S]{0,120}maxCost\s*:/,"Ogryzki Dino nie mają górnego limitu Kosztu");
assert.match(cards,/cost:\s*7\b/,"kanoniczna pula Ogryzków zawiera karty Kosztu 7");
assert.match(cards,/cost:\s*8\b/,"kanoniczna pula Ogryzków zawiera karty Kosztu 8");
assert.match(dino,/activationQueuePenaltyApplied/,"Drzemka +3 ma osobny stan jednorazowy");
assert.match(dino,/queuePenalty:0/,"użycia Brzucha nie naliczają nowej kary");
assert.match(dino,/function printedCost\(card\)\{[\s\S]*if\(card\?\.joker\) return 0/,"nierozstrzygnięty Joker ma w paszczy Dino drukowany Koszt 0");
assert.doesNotMatch(dino,/function commitActivation\(\)[\s\S]{0,900}resolveActivationJoker/,"Dino nie rozstrzyga Jokera podczas pożerania");
assert.match(dino,/if\(ui\.action==="packReplacement"\) finish\(entry\.card\);[\s\S]*else resolveJokerForDeck/,"Joker wypluty do paczki pozostaje nierozstrzygnięty, a ścieżki decku rozwiązują go najpierw");
assert.match(dino,/resolvePackCardLifecycle\?\.\("acquire",card/,"Dino harvestuje kartę przy przejściu do Brzucha");
assert.match(dino,/spx-dino-chomp-burst/,"Chomp używa osobnej warstwy prezentacji");
assert.match(dino,/devildino_belly_full\.png/,"Brzuch używa pełnego wygenerowanego assetu bez dziury");
assert.match(dino,/devildino_belly_interior\.png/,"modal używa osobnego wnętrza Brzucha");
assert.match(dino,/BELLY_CONTEXT_ORDER/,"Brzuch pokazuje pełną mapę kanonicznych akcji");
assert.match(dino,/cardVisualMarkup/,"Brzuch pokazuje prawdziwe miniatury kart paczki");
assert.match(dino,/showMoonGirlCall/,"powiadomienia Dino mają osobny Moon Girl Call");
assert.doesNotMatch(dino,/OZNACZONA|>OZNACZ</,"pazur nie wyświetla zbędnej etykiety zaznaczania");
assert.match(html,/spx-dino-queue-sleep-badge/,"kolejka pokazuje śpiącego Dino");
assert.match(dinoCss,/prefers-reduced-motion/,"Dino obsługuje reduced motion");
assert.match(dinoCss,/spx-dino-belly-vessel/,"Brzuch ma stały komponent UI");
assert.match(dinoCss,/spxDinoCardFloat/,"miniatury kart unoszą się w Brzuchu");
assert.match(dinoCss,/spx-dino-card-visual \.pack-card-name[\s\S]*top:50%!important/,"nazwy mini-kart Dino są wycentrowane jak w naturalnych kartach");
assert.match(dinoCss,/spx-dino-belly-vessel>\.spx-dino-belly-floaters \.spx-dino-floating-card \.spx-dino-card-visual[\s\S]*translate\(-50%,-50%\) scale\(\.52\)/,"1–3 realne miniatury Dino są centrowane jako grupa");
assert.match(dinoCss,/spx-dino-belly-vessel\[data-card-count\]>\.spx-dino-belly-floaters \.spx-dino-floating-card:nth-child\(n\)[\s\S]*left:auto!important[\s\S]*right:auto!important/,"starsze pozycje 1–3 kart nie mogą wypchnąć wyśrodkowanej grupy Brzucha");
assert.match(dinoCss,/spg-dino-belly-badge>\.spg-dino-belly-floaters[\s\S]*overflow:hidden/,"mini-karty na decku nie wychodzą poza asset Brzucha");
assert.doesNotMatch(dino,/spx-dino-call-scene/,"pierwszy Moon Girl Call nie używa osobnego kafla z Nowym Jorkiem");

assert.match(thor,/getPackCardBlockReason/,"Thor jasno opisuje blokadę celu");
assert.doesNotMatch(thor,/if\(!card \|\| card\.joker\) return false/,"Joker nie jest twardo blokowany w targetowaniu Thora");
assert.match(thor,/resolvePlanJokers/,"Thor rozstrzyga Jokera wyłącznie przed zdobyciem");
assert.match(thor,/thor_actual_acquisition_joker/,"Thor używa kanonicznego pipeline'u Jokera");
assert.match(thor,/verdictConsumesThorPick/,"+1 rozpoznaje, czy nowy werdykt zużywa pick");
assert.match(thor,/findShiftablePickIndexForVerdict/,"+1 szuka picku pozostającego po werdykcie");
assert.match(thor,/pickOrder\.splice\(from,1\)/,"+1 przenosi istniejący token zamiast go duplikować");
assert.match(thor,/spx-thor-verdict-tiles/,"Thor pokazuje skróconą tablicę wyroków");
assert.match(thorCss,/spx-thor-verdict-tiles/,"tablica wyroków ma styl responsywny");
assert.match(thor,/const asgardPackChanges = \[[\s\S]*rerolls\.map\(item=>item\.packIndex\)[\s\S]*deckAdds\.filter\(item=>item\.refillCard\)/,"Thor zbiera do animacji zwykłe przelosowania i refille po Łupach");
assert.match(thor,/playImpactOnCardIndices\(asgardPackChanges\)/,"każdy refill Asgardu dostaje błysk piorunów");
assert.match(thor,/ASGARD DOKONAŁ OSĄDU I PRZELOSOWAŁ KARTY/,"Thor kończy osąd komunikatem Asgardu");
assert.doesNotMatch(thor,/normalny wybór|normalne wybory|zwykły wybór|zwykłe wybory/,"Thor używa normalnego picku, nie normalnego wyboru");

assert.match(groot,/cost:4,name:"SZCZEP NASIONA"/,"cena Szczepu Nasiona wynosi 4");
assert.match(groot,/cost:3,name:"KORZEŃ NA SKRÓTY"/,"Korzeń na Skróty kosztuje 3");
assert.match(groot,/name:"LEŚNY JOKER"/,"Dziki Joker ma nową nazwę");
assert.match(groot,/name:"ODROST PLANETY X"/,"Odrodzenie ma nową nazwę");
assert.match(groot,/function growthLadderText/,"Groot pokazuje dynamiczną drabinkę wzrostu");
assert.match(groot,/const stage2=gentleGrowth\?1:2/,"przy 7+ graczach drugi etap Groota jest o pick łaskawszy");
assert.match(groot,/Math\.ceil\(growthTarget\/2\)-\(gentleGrowth\?1:0\)/,"przy 7+ graczach trzeci etap Groota jest o pick łaskawszy");
assert.match(groot,/if\(normalized==="copy"\) return true/,"ochrona Groota blokuje Lokiego także w starych zapisach");
assert.match(groot,/hasPendingGrowthPresentation\(\)[\s\S]*openNextUnlockedGarden/,"Ogród czeka na prezentację wzrostów");
assert.match(groot,/dinoSleep/,"toasty Groota czekają na komunikat Dino");
assert.match(grootCss,/spx-groot-growth-ladder/,"drabinka wzrostu ma własny styl");
assert.match(grootCss,/spx-groot-seeded\{outline:none/,"zasiana karta nie dostaje zielonego prostokąta");
assert.match(groot,/function playGardenExit/,"Planeta X ma osobne bezpieczne przejście wyjścia");
assert.match(groot,/spx-groot-garden-petals/,"ogród zawiera warstwę płatków");
assert.match(grootCss,/spx-groot-reward\.is-unavailable::after[\s\S]*var\(--spx-groot-lock-branch\)/,"zablokowane nagrody przecina osobny asset gałęzi");
assert.match(grootCss,/spx-groot-reward\.is-unavailable::after[\s\S]*z-index:30!important[\s\S]*opacity:1!important/,"gałąź blokady jest na wierzchu i bez przyciemnienia");
assert.match(grootCss,/spx-groot-reward:not\(\.is-unavailable\):not\(\.is-purchased\)::after[\s\S]*var\(--spx-groot-bed\)/,"dostępne nagrody wyrastają ze ściółki");

assert.match(groot,/getSamePackGraveyardEntries\(groot,playerIndex,entry\.index\)\.length>0/,"Odrost odblokowuje się już przy jednej odzyskiwalnej karcie");
assert.match(groot,/if\(!entries\.length\)/,"Odrost pokazuje od jednej do trzech kart zamiast wymagać dokładnie trzech");
assert.match(dino,/context==="pickReplacement"\?\(pickTargets\.length\?pickTargets\[Math\.floor\(Math\.random\(\)\*pickTargets\.length\)\]/,"Pick z Brzucha losuje odpowiednią kartę paczki");
assert.doesNotMatch(dino,/pickReplacement:\["PICK Z BRZUCHA"[\s\S]{0,200}Wskaż też kartę paczki/,"Pick z Brzucha nie daje dodatkowego celu sabotażu");
assert.match(thor,/refill:item\.refillCard\?\.name/,"summary i log Thora zachowują informację o refillu");
assert.match(thor,/currentPack\[packIndex\] = refillCard/,"każdy Łup Thora zostawia w tym samym miejscu nową kartę paczki");
assert.match(thor,/graveyardCategory: "replaced"/,"własna karta poświęcona za Łup Thora trafia na Cmentarzysko");
assert.doesNotMatch(graveyard,/options\.mode!=="wolverine" && global\.SuperpowerUI\?\.isBusy/,"podgląd Cmentarzyska nie zostaje zablokowany przez zakończoną moc");
assert.match(data,/Cyclops może aktywować moc dopiero, gdy ma co najmniej 6 kart w decku/,"Kodeks Cyclopsa pokazuje limit 6 kart");
assert.match(data,/Raz na draft, w dowolnym momencie, gdy paczka jest otwarta\./,"Kodeks Dino nie używa określenia bezpieczny moment");
const dinoDataBlock=data.slice(data.indexOf('id: "devil_dinosaur"'),data.indexOf('id: "groot"'));
const dinoPlayerCopy=dinoDataBlock.slice(dinoDataBlock.indexOf("description:"));
assert.doesNotMatch(dinoPlayerCopy,/instancj|pipeline|deckBackup|K[’']un-Lun|legaln/i,"widoczny Kodeks Dino nie zawiera technicznego żargonu ani edge case’ów");

console.log("FINALIZATION_STATIC_REGRESSION_OK",JSON.stringify({assertions:77,areas:["pipeline","thor","groot","dino","graveyard","cyclops","reduced-motion","copy-audit","cost-6-plus"]}));
