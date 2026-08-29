"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=name=>fs.readFileSync(path.join(__dirname,name),"utf8");
const between=(source,start,end)=>{
    const from=source.indexOf(start);
    const to=source.indexOf(end,from+start.length);
    assert.notEqual(from,-1,`brak początku sekcji: ${start}`);
    assert.notEqual(to,-1,`brak końca sekcji: ${end}`);
    return source.slice(from,to);
};

const html=read("snap-draft.html");
const ui=read("superpowers-ui.js");
const thor=read("superpowers-thor.js");
const wolverine=read("superpowers-wolverine.js");
const dino=read("superpowers-devildino.js");
const groot=read("superpowers-groot.js");
const data=read("superpowers-data.js");
const jokerEngine=read("jokerEngine.js");

const lokiUi=between(ui,"function getLokiTargets(","function buildLokiEligibility(");
const lokiCommit=between(html,"function commitLokiDeckSwap(","function getHulkReplacementPool(");
assert.match(lokiUi,/occupiedNames=new Set\([\s\S]*index!==sourceCardIndex/,"Loki UI zna inne sloty własnego decku");
assert.match(lokiUi,/!occupiedNames\.has\(normalizeName\(entry\.card\.name\)\)/,"Loki UI usuwa kandydatów-duplikaty");
assert.match(lokiCommit,/copiedName[\s\S]*index!==sourceCardIndex[\s\S]*===copiedName/,"commit Lokiego ponownie blokuje duplikat");

const jeff=between(html,"function getJeffWaveMinimumRarity(","function getRocketBombCandidates(");
assert.match(jeff,/if\(!card\?\.joker\) return "epic"/,"zwykła karta Jeffa przechodzi w Epic Jokera");
assert.match(jeff,/if\(livePack\.length<4\)/,"Jeff liczy całą aktywną strefę draftową");
assert.match(jeff,/inGalacticCurrent \? gcBridge\.getLiveCards\(\) : currentPack/,"Jeff korzysta z prawdziwego nurtu bez cofania Classica");
assert.match(jeff,/pickOrder\[currentPickIndex\]!==playerIndex/,"Jeff działa tylko przed własnym pickiem");
assert.match(jeff,/getPremiumJoker\(\{exactRarity:targetRarity\}\)/,"Fala Jeffa żąda dokładnego poziomu Jokera");
assert.match(jeff,/exactRarity:"legendary"[\s\S]*surpriseOnly:true/,"prywatny Joker Jeffa jest Legendary");
assert.match(jokerEngine,/exactRarity[\s\S]*allowedRarities=rarityOrder\.includes\(exactRarity\)[\s\S]*\[exactRarity\]/,"Joker Engine obsługuje dokładną rzadkość bez awansu ponad kanon");

const rocketUi=between(ui,"function startRocket(","function resolveRocketBomb(");
const rocketResolve=between(html,"function resolveRocketBombAfterPick(","function commitRocketSalvage(");
const rocketSalvage=between(html,"function commitRocketSalvage(","const DEADPOOL_ALWAYS_FORBIDDEN");
assert.match(rocketUi,/rocketExpectedBombs=Math\.min\(2,candidates\.length\)/,"Rocket może uzbroić dwie bomby");
assert.doesNotMatch(rocketResolve,/filter\(entry=>entry\?\.ownerName!==trap\.ownerName\)/,"wynik jednej bomby nie kasuje wszystkich bomb właściciela");
assert.ok((rocketResolve.match(/filter\(entry=>entry!==trap\)/g)||[]).length>=4,"każdy wynik usuwa wyłącznie konkretny ładunek");
assert.match(rocketResolve,/stillArmed \? "armed" : "used"/,"druga bomba pozostaje aktywna po pierwszym wyniku");
assert.match(rocketSalvage,/rocketBombTraps\.some\([\s\S]*status==="armed"/,"osobne rozstrzygnięcie złomu zachowuje kolejny ładunek");

const professor=between(html,"function hasProfessorXFuturePick(","function getProfessorXControlForPlayer(");
const professorCommit=between(html,"function commitProfessorXMindControl(","function consumeProfessorXControl(");
assert.match(professor,/currentPickIndex\+1/,"Professor X sprawdza naprawdę kolejny, nie bieżący pick");
assert.match(professorCommit,/hasProfessorXFuturePick\(index\)/,"commit Xaviera nie zapisuje martwego celu");
assert.match(professorCommit,/Math\.min\(2,legalTargetIndices\.length\)/,"fallback Profesora X pozostaje 2→1");

const deadpoolOptions=between(html,"function getDeadpoolDraftOptions(","function cloneDoctorDoomCard(");
assert.match(deadpoolOptions,/mode=hasConfiguredBans \? "banned" : "free"/,"FREE zależy wyłącznie od pustej listy banów");
assert.match(deadpoolOptions,/!offeredCandidates\.length&&hasConfiguredBans/,"niepusta lista bez kandydata kończy się komunikatem");
assert.match(deadpoolOptions,/function buildDeadpoolPaymentPlan/,"Deadpool buduje pełny plan płatności przed startem");
assert.match(deadpoolOptions,/const paymentPlan=buildDeadpoolPaymentPlan[\s\S]*if\(!paymentPlan\)/,"commit używa wykonalnego planu zamiast losować w ciemno");

assert.match(thor,/Number\(state\.roll\) >= 1 && Number\(state\.roll\) <= 4/,"boost Thora istnieje tylko dla 1–4");
assert.match(thor,/Math\.min\(5,Number\(state\.roll\)\+1\)/,"boost Thora nie przekracza 5");
assert.match(thor,/from>=0&&from<pickOrder\.length-1/,"pick już ostatni nie daje darmowego +1");
assert.match(thor,/hasFullyExecutablePair\(playerIndex,selectable\)/,"Thor wymaga wykonalnej pary przed startem");

assert.match(dino,/if\(card\?\.joker\) return 0/,"nierozstrzygnięty Joker Dino ma Cost 0");
assert.doesNotMatch(between(dino,"function commitActivation(){","function commitActivationNow("),/resolveForEffect|resolveJoker/,"pożarcie nie rozstrzyga Jokera");
assert.match(dino,/if\(ui\.action==="packReplacement"\) finish\(entry\.card\)/,"Brzuch→paczka zachowuje Jokera");
assert.match(dino,/else resolveJokerForDeck\(entry,ui\.action,finish\)/,"Brzuch→deck rozstrzyga Jokera przed wejściem");
assert.match(dino,/data-dino-backup="open"[\s\S]*OTWÓRZ BRZUCH/,"Odruch oferuje otwarcie Brzucha");
assert.match(dino,/data-dino-backup="dismiss"[\s\S]*NIE TERAZ/,"Odruch ma jawne odrzucenie");
assert.match(dino,/String\(data\.pendingBackup\.mutationId\)!==String\(mutationId/,"dismissal dotyczy konkretnego triggera");
assert.match(dino,/data\.pendingBackup=null/,"odrzucony trigger nie pozostaje pending");
assert.match(dino,/if\(hostileSequenceBusy\(\)\)\{[\s\S]*scheduleBackupPrompt\(playerName,mutationId,attempt\+1\)/,"prompt czeka na pełne zakończenie wrogiej sekwencji");
assert.doesNotMatch(dino,/attempt<120/,"Odruch nie ma sztucznego limitu ~18 sekund");
assert.match(dino,/spxDinoBackupPrompt[\s\S]*isBusy:/,"prompt Odruchu jest częścią busy-state Dino");

assert.match(wolverine,/hasLegalFirst=entries\.some/,"Wolverine sprawdza wykonalne pierwsze wskrzeszenie");
assert.match(html,/WolverineUI\?\.isBusy\?\.\(\) && powerId!=="wolverine"/,"centralny start blokuje inne moce podczas Wolverinea");
assert.match(ui,/ADAMANTIOWA REGENERACJA W TOKU/,"bezpośredni start wspólnego UI także respektuje blokadę Wolverinea");

assert.match(html,/function canHulkDestroyTarget[\s\S]*getHulkReplacementPool/,"Hulk preflight wymaga niszczalnej karty z legalnym zamiennikiem");
assert.match(ui,/hasPackTarget[\s\S]*if\(!hasPackTarget\) return \[\]/,"Doom preflight wymaga legalnego celu w paczce");
assert.match(ui,/KUŹNIA NIE MA WZORCA/,"pusta kuźnia Dooma nie jest otwierana");
assert.match(groot,/owners\.forEach\(owner=>markGardenUnlocked\(owner,true\)\)/,"forced Garden pozostaje obowiązkowy");
assert.match(data,/id: "loki"[\s\S]*timing: "anytime"/,"timing ANYTIME Lokiego nie został cofnięty");

console.log("FINAL_SUPERPOWER_SANITY_REGRESSION_OK",JSON.stringify({
    assertions:44,
    areas:["loki","jeff","rocket","professor-x","deadpool","thor","devil-dino","wolverine","hulk","doctor-doom","groot"]
}));
