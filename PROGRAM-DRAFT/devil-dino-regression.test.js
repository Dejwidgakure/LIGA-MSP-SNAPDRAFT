"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

global.window=global;
global.alert=()=>{};
global.showDecks=()=>{};
global.showPack=()=>{};
global.updateRoundQueueDisplay=()=>{};
global.showDraftPickToast=()=>{};
global.document={
    body:{appendChild(){},classList:{contains(){return false;}}},
    getElementById(){return null;},
    querySelectorAll(){return [];},
    createElement(){throw new Error("Ten test nie otwiera warstwy prezentacji.");}
};

global.players=["Dino","Rywal"];
global.decks=[[],[]];
global.currentPack=[];
global.pickOrder=[0,1,1,0];
global.currentPickIndex=0;
global.packStartIndex=0;
global.draftFinished=false;
global.packIsOpen=true;
global.packOpeningInProgress=false;
global.packEnding=false;
global.cardDatabase=[];
global.superpowerLog=[];

let runtimeSequence=0;
let record=null;
let zones={devilDinoBelly:[],tournamentEscrow:[],limbo:[]};
let graveyard=[];

global.SuperpowerEngine={getPlayerData(){return record;}};
global.DraftStateEngine={log(){return {};},getPack(){return {packId:"pack-1"};}};
global.DraftFoundation={
    getRuntimeZone(name){return zones[name]||[];},
    addCardToRuntimeZone(name,card,metadata={}){
        const entry={runtimeEntryId:`runtime-test-${++runtimeSequence}`,zone:name,card,ownerIndex:metadata.ownerIndex??null,metadata:metadata.metadata||{}};
        (zones[name]||(zones[name]=[])).push(entry);
        return entry;
    },
    removeCardFromRuntimeZone(name,entryId){
        const zone=zones[name]||[];
        const index=zone.findIndex(entry=>entry.runtimeEntryId===entryId);
        if(index<0) return null;
        return zone.splice(index,1)[0];
    },
    archiveCardToGraveyard(category,card,options={}){
        const entry={category,card,options};
        graveyard.push(entry);
        return entry;
    },
    beginTransaction(){return {ok:true,transactionId:"test-tx"};},
    commitTransaction(){return true;},
    rollbackTransaction(){return true;},
    hasOpenTransaction(){return false;}
};

const source=fs.readFileSync(path.join(__dirname,"superpowers-devildino.js"),"utf8");
vm.runInThisContext(source,{filename:"superpowers-devildino.js"});

function state(overrides={}){
    return {
        version:1,activated:true,bellyLocked:false,unlockedAt:null,
        activationPackNumber:1,activationPickIndex:0,activationPlayerIndex:0,
        pendingQueuePenalty:0,consumedWindowIds:[],consumptionHistory:[],
        pendingBackup:null,finalExchangeOffered:false,finalExchangeResolved:false,
        ...overrides
    };
}

function card(name,cost,power,id=name.toLowerCase().replace(/\W+/g,"-"),extra={}){
    return {name,cost,power,instanceId:id,...extra};
}

function reset(cards=[],overrides={}){
    runtimeSequence=0;
    graveyard=[];
    zones={devilDinoBelly:[],tournamentEscrow:[],limbo:[]};
    record={powerId:"devil_dinosaur",used:true,data:{dino:state(overrides)}};
    cards.forEach(item=>global.DraftFoundation.addCardToRuntimeZone("devilDinoBelly",item,{ownerIndex:0}));
    global.players=["Dino","Rywal"];
    global.decks=[[],[]];
    global.currentPack=[];
    global.pickOrder=[0,1,1,0];
    global.currentPickIndex=0;
    global.packStartIndex=0;
    global.draftFinished=false;
    global.cardDatabase=[];
    global.getSpiderManReservationForCard=()=>null;
    global.getDoctorStrangeLockedEffect=()=>null;
    return record.data.dino;
}

function entry(index=0){return zones.devilDinoBelly[index];}

const lowA=card("Low A",1,2,"low-a");
const lowB=card("Low B",2,3,"low-b");
const lowC=card("Low C",3,4,"low-c");
const highA=card("High A",4,7,"high-a");
const highB=card("High B",6,10,"high-b");
const highC=card("High C",5,8,"high-c");

global.currentPack=[lowA];
assert.equal(DevilDinoUI.validateDevourSelection([lowA]).ok,true,"aktywacja: jedna karta");
global.currentPack=[highA,highB];
assert.equal(DevilDinoUI.validateDevourSelection([highA,highB]).ok,true,"aktywacja: dwie karty Cost 4+");
global.currentPack=[lowA,lowB,highA];
assert.equal(DevilDinoUI.validateDevourSelection([lowA,lowB,highA]).ok,false,"blokada trzech kart z Cost 4+");
global.currentPack=[lowA,lowB,lowC];
assert.equal(DevilDinoUI.validateDevourSelection([lowA,lowB,lowC]).ok,true,"trzy legalne karty Cost 0–3");
global.currentPack=[highB,highC];
assert.equal(DevilDinoUI.validateDevourSelection([highB,highC]).ok,false,"blokada sumy Cost >10");
global.currentPack=[lowA];
global.getSpiderManReservationForCard=target=>target===lowA?{reservationId:"web"}:null;
assert.equal(DevilDinoUI.validateDevourSelection([lowA]).ok,false,"Pajęcza Sieć blokuje cel");

let dino=reset([lowA,lowB]);
global.pickOrder=[1,0,1,0];
global.currentPickIndex=0;
let first=DevilDinoUI.consumeDinoBellyCard({
    context:"packReplacement",playerName:"Dino",entryId:entry(0).runtimeEntryId,
    resolutionWindowId:"window-one",nextZone:"pack",resultCard:lowA,effect:()=>({ok:true})
});
assert.equal(first.ok,true,"pierwsze zużycie Brzucha");
assert.equal(zones.devilDinoBelly.length,1,"usunięto dokładnie jedną instancję");
assert.equal(dino.pendingQueuePenalty,0,"akcja Brzucha nie nakłada ani nie przenosi kary kolejki");
let repeated=DevilDinoUI.consumeDinoBellyCard({
    context:"packReplacement",playerName:"Dino",entryId:entry(0).runtimeEntryId,
    resolutionWindowId:"window-one",nextZone:"pack",resultCard:lowB,effect:()=>({ok:true})
});
assert.equal(repeated.ok,false,"tylko jedno zużycie w oknie rozstrzygnięcia");
assert.equal(zones.devilDinoBelly.length,1,"druga próba nie zmienia stanu");

global.pickOrder=[0,1,1,0];
global.currentPickIndex=0;
const legacyQueue=[...global.pickOrder];
dino.pendingQueuePenalty=3;
DevilDinoUI.onQueuePrepared();
assert.deepEqual(global.pickOrder,legacyQueue,"stara oczekująca kara nie przechodzi już do kolejnej paczki");
assert.equal(dino.pendingQueuePenalty,0,"stary zapis +3 jest bezpiecznie czyszczony");

dino=reset([lowA],{bellyLocked:true});
assert.equal(DevilDinoUI.onPickCompleted({playerIndex:0,source:"pack"}),true,"pełny pick odblokowuje Brzuch");
assert.equal(dino.bellyLocked,false,"Brzuch jest odblokowany");

dino=reset([lowA]);
global.decks[0]=[card("Hostile Result",2,5,"hostile-result")];
assert.equal(DevilDinoUI.notifyHostileDeckChange({
    targetPlayerIndex:0,targetCardInstanceId:"hostile-result",previousCardInstanceId:"old-card",
    sourcePowerId:"hulk",sourceEvent:"hulk_smash",mutationId:"mutation-1"
}),true,"wroga zmiana otwiera świadomy deckBackup");
assert.equal(dino.pendingBackup.targetCardInstanceId,"hostile-result","backup wskazuje dokładny rezultat mutacji");
assert.equal(DevilDinoUI.dismissPendingBackup("Dino","inna-mutacja"),false,"odrzucenie nie kasuje innego triggera Odruchu");
assert.equal(DevilDinoUI.dismissPendingBackup("Dino","mutation-1"),true,"NIE TERAZ kasuje dokładnie bieżący trigger Odruchu");
assert.equal(dino.pendingBackup,null,"odrzucony Odruch nie wisi do późniejszego użycia");

dino=reset([lowA],{pendingBackup:{targetCardInstanceId:"hostile-result",targetIndex:0}});
global.decks[0]=[card("Hostile Result",2,5,"hostile-result")];
let backup=DevilDinoUI.consumeDinoBellyCard({
    context:"deckBackup",playerName:"Dino",entryId:entry(0).runtimeEntryId,
    resolutionWindowId:"backup-1",nextZone:"deck",resultCard:lowA,
    effect:()=>{global.decks[0][0]=lowA;return {ok:true};}
});
assert.equal(backup.ok,true,"deckBackup zużywa jedną świadomą zdobycz");
assert.equal(global.decks[0][0].instanceId,"low-a","deckBackup odbija konkretny wrogi rezultat");
assert.equal(dino.pendingBackup,null,"okno backupu zamyka się po sukcesie");

dino=reset([lowB]);
global.currentPack=[card("Pick Slot",3,5,"pick-slot")];
global.decks[0]=[];
let pickReplacement=DevilDinoUI.consumeDinoBellyCard({
    context:"pickReplacement",playerName:"Dino",entryId:entry(0).runtimeEntryId,
    resolutionWindowId:"pick-1",nextZone:"deck",resultCard:lowB,
    effect:()=>{global.currentPack.splice(0,1);global.decks[0].push(lowB);return {ok:true};}
});
assert.equal(pickReplacement.ok,true,"pickReplacement przechodzi przez wspólny konsument");
assert.equal(global.decks[0].length,1,"pickReplacement nie tworzy dodatkowego picku");

dino=reset([lowC]);
global.decks[0]=[card("Lowest",1,1,"lowest"),card("Higher",5,9,"higher")];
let finalExchange=DevilDinoUI.consumeDinoBellyCard({
    context:"finalExchange",playerName:"Dino",entryId:entry(0).runtimeEntryId,
    resolutionWindowId:"final-1",nextZone:"deck",resultCard:lowC,
    effect:()=>{global.decks[0][0]=lowC;return {ok:true};}
});
assert.equal(finalExchange.ok,true,"Ostatnia Uczta używa whitelisty finalExchange");
assert.equal(global.decks[0].length,2,"końcowa wymiana pozostaje 1:1");

dino=reset([lowA]);
let stake=DevilDinoUI.consumeKunLunStake({playerIndex:0,cardInstanceId:"low-a",resolutionWindowId:"kun-lun-1"});
assert.equal(stake.ok,true,"K’un-Lun przyjmuje odblokowaną kartę Brzucha");
assert.equal(zones.devilDinoBelly.length,0,"stawka opuszcza Brzuch");
assert.equal(zones.tournamentEscrow.length,1,"stawka trafia do depozytu turnieju");
assert.equal(dino.pendingQueuePenalty,0,"stawka K’un-Lun nie nalicza dodatkowego +3");

const joker=card("Joker Surprise",0,0,"joker-surprise",{joker:true,type:"surprise",instanceMeta:{rejectedOptions:["A","B"]}});
global.currentPack=[joker,lowA,lowB];
assert.equal(DevilDinoUI.validateDevourSelection([joker,lowA,lowB]).ok,true,"nierozstrzygnięty Joker liczy się jako Cost 0 przy pożarciu");
dino=reset([joker]);
const saved=JSON.parse(JSON.stringify({record,zones}));
record=JSON.parse(JSON.stringify(saved.record));
zones=JSON.parse(JSON.stringify(saved.zones));
assert.equal(DevilDinoUI.getStatus("Dino").bellyCount,1,"save/load zachowuje Brzuch");
assert.equal(DevilDinoUI.getBellyEntries("Dino")[0].card.instanceMeta.rejectedOptions.length,2,"save/load zachowuje metadane Jokera");

const jokerChoice=card("Joker Choice",0,0,"joker-choice",{joker:true,type:"choice",instanceMeta:{chosenOption:"Mystique"}});
const rocketBomb=card("Rocket Bomb",1,1,"rocket-bomb",{instanceMeta:{bombId:"bomb-7",armed:true,sourcePowerId:"rocket_raccoon"}});
dino=reset([jokerChoice,joker,rocketBomb],{pendingQueuePenalty:3});
const richSaved=JSON.parse(JSON.stringify({record,zones}));
record=JSON.parse(JSON.stringify(richSaved.record));
zones=JSON.parse(JSON.stringify(richSaved.zones));
assert.equal(DevilDinoUI.getStatus("Dino").bellyCount,3,"save/load zachowuje oba typy Jokera i bombę Rocketa");
assert.equal(DevilDinoUI.getStatus("Dino").pendingQueuePenalty,0,"save/load nie przywraca wycofanego carry-over +3");
assert.equal(DevilDinoUI.getBellyEntries("Dino")[0].card.instanceMeta.chosenOption,"Mystique","Joker Choice zachowuje wybór");
assert.deepEqual(DevilDinoUI.getBellyEntries("Dino")[1].card.instanceMeta.rejectedOptions,["A","B"],"Joker Surprise zachowuje odrzucone opcje");
assert.equal(DevilDinoUI.getBellyEntries("Dino")[2].card.instanceMeta.bombId,"bomb-7","bomba Rocketa zachowuje tożsamość i stan");

dino=reset([lowA,lowB]);
assert.equal(DevilDinoUI.archiveUnusedBelly("Dino"),2,"koniec draftu archiwizuje cały niewykorzystany Brzuch");
assert.equal(graveyard.length,2,"niewykorzystane karty są na Cmentarzysku");
assert.equal(new Set(graveyard.map(item=>item.card.instanceId)).size,2,"brak zduplikowanych instanceId");

console.log("DEVIL_DINO_REGRESSION_OK",JSON.stringify({assertions:41,contexts:["pickReplacement","packReplacement","deckBackup","kunLunStake","finalExchange"],saveLoad:true,queuePenalty:true,jokers:true,rocketBomb:true,backupDismissal:true}));
