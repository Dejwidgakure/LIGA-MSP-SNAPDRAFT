"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=name=>fs.readFileSync(path.join(__dirname,name),"utf8");
const ui=read("superpowers-ui.js");
const html=read("snap-draft.html");
const dino=read("superpowers-devildino.js");
const groot=read("superpowers-groot.js");
const thorCss=read("superpowers-thor.css");
const ironCss=read("superpowers-ironman.css");
const dinoCss=read("superpowers-devildino.css");
const strangeCss=read("superpowers-doctorstrange.css");
const spiderCss=read("superpowers-spiderman.css");
const capCss=read("superpowers-captainamerica.css");
const data=read("superpowers-data.js");

const between=(source,start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
const loki=between(ui,"function startLoki(","function decorateLokiCards(");
const cyclops=between(ui,"function startCyclops(","function openCyclopsTagPanel(");

assert.doesNotMatch(loki,/deck\.length<6|Cyclops potrzebuje/,"Loki nie dziedziczy blokady Cyclopsa");
assert.match(cyclops,/deck\.length<6[\s\S]*Cyclops potrzebuje co najmniej 6 kart/,"Cyclops blokuje wejście przed otwarciem sekwencji");
assert.match(ui,/WRACA DO X-MANSION/,"finał Cyclopsa pokazuje los poświęconych kart");

assert.match(html,/function doctorStrangeCanReplaceDuplicate[\s\S]*return Boolean\(normalizeBanText\(targetCard\?\.name\)/,"Strange dopuszcza duplikat przy legalnym wyjściu 1:1");
assert.doesNotMatch(ui,/LINIA CZASU WYMAGA TEJ SAMEJ KARTY|RÓWNOWAGA WYMAGA TEJ SAMEJ KARTY/,"UI Strange'a nie wymusza usuwania istniejącego duplikatu");
assert.doesNotMatch(html,/Aby sprowadzić \$\{resolvedCardA\.name\}|Aby sprowadzić \$\{cardB\.name\}/,"commit Strange'a nie odrzuca duplikatów");
assert.match(ui,/doctorStrangeReadyNoticeShown/,"gotowość Strange'a jest ogłaszana tylko raz");
assert.match(ui,/PORTAL DO PRZYSZŁOŚCI OTWARTY/,"otwarty portal ma docelowy komunikat");
assert.match(strangeCss,/nazwy przyszłych kart wyłaniają się z samego portalu/,"nazwy kart pozostają przy portalu");

assert.match(dino,/packClawMarks=\{packIndex:-1,instanceIds:new Set\(\)\}/,"ślady Ogryzków są stanem widoku paczki");
assert.match(dino,/spx-dino-heavy-scrap-mark/,"refille Dino dostają widoczny ślad pazura");
assert.doesNotMatch(dino,/replacement\.(instanceMeta|metadata).*claw|heavyScrap.*instanceMeta/i,"ślad pazura nie podróżuje w danych karty");
assert.match(dinoCss,/\.spx-dino-hud\{width:min\(920px/,"Moon Girl Call jest kompaktowy");
assert.match(dinoCss,/\.spg-deck-power\.spg-dino-belly-ready \.spg-deck-power-btn::before\{display:none/,"stary orbitujący pierścień Dino jest usunięty");
assert.match(dinoCss,/spg-roster-belly-preview[\s\S]*top:50%/,"brzuch w przydziale mocy jest wycentrowany pionowo");

assert.match(ironCss,/#spxIronManHud[\s\S]*transform:translateX\(-50%\)/,"prompt Iron Mana jest wyśrodkowany");
assert.match(ironCss,/overflow-x:hidden!important/,"modal Iron Mana nie skacze od poziomego scrolla");
assert.match(ui,/function playIronManUpgrade/,"Iron Man ma prezentację transformacji po commicie");
assert.match(ui,/JARVIS: REAKTOR URUCHOMIONY/,"prezentacja Iron Mana kończy się komunikatem JARVISA");

assert.match(html,/function getCaptainAmericaStatus/,"Kapitan udostępnia trwały stan tarcz i rykoszetu");
assert.match(html,/RYKOSZET GOTOWY/,"status Kapitana pokazuje gotowy rykoszet");
assert.match(ui,/REFLEKS KAPITANA GOTOWY NA KONTRATAK/,"po aktywacji Kapitan przypomina o zaakceptowanej pasywce");
assert.match(capCss,/spg-cap-defense-status/,"stan Kapitana ma własny czytelny komponent");

assert.match(groot,/\+\$\{pointsForStage\(item\.stage\)\} 🌿/,"tooltip sadzonki pokazuje aktualny zysk listków bez starej etykiety");
assert.match(spiderCss,/spxSpiderSenseWaves/,"Spider-Sense używa czerwono-niebieskich fal zamiast okręgów");
assert.match(ui,/Spider-Man wyczuwa karty, które może opleść siecią/,"prompt Spider-Mana jest lore'owy");
assert.match(thorCss,/\.spx-thor-pack-shell[\s\S]*overflow:hidden!important[\s\S]*background-size:112% 148%/,"mały modal Thora ma pełną ramę bez scrolla");
assert.match(data,/Głodny symbiont pochłania/,"opis Venoma używa poprawnego słowa symbiont");

console.log("SUPERPOWERS_FINAL_POLISH_REGRESSION_OK",JSON.stringify({assertions:28,areas:["thor","cyclops","loki","dino","iron-man","doctor-strange","spider-man","captain-america","groot","venom"]}));
