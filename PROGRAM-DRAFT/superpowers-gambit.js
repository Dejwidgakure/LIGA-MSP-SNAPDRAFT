(function(global){
    "use strict";

    const POWER_ID="gambit";
    const RESERVE_ZONE="kineticReserve";
    const VERSION="3.2.6";
    const MAX_CHARGE=5;
    const STEP_LABELS={
        self_reroll:"KONTROLOWANY WYBUCH",
        enemy_shot:"STRZAŁ W DECK",
        queue_momentum:"KINETYCZNE MOMENTUM",
        pack_shot:"STRZAŁ W PACZKĘ",
        bonus_shot:"PODWÓJNA SALWA",
        precision_shot:"KRÓLEWSKI RYKOSZET",
        loot:"KINETYCZNE ODBICIE"
    };
    const REWARD_LABELS=[
        "WŁASNE PRZELOSOWANIE",
        "TRAFIENIE W DECK",
        "MOMENTUM KOLEJKI",
        "RYKOSZET PACZKI",
        "PODWÓJNA SALWA",
        "KRÓLEWSKI RYKOSZET"
    ];

    let activePlayerName="";
    let rolling=false;
    let rollTimer=0;
    let phaseTimer=0;
    let burstTimer=0;
    let salvoRunning=false;
    let closing=false;

    function clone(value){
        if(value===undefined) return undefined;
        if(typeof structuredClone==="function"){
            try{return structuredClone(value);}catch(error){}
        }
        return JSON.parse(JSON.stringify(value));
    }

    function normalize(value){return String(value||"").trim().toLowerCase();}
    function escapeHtml(value){
        return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
    }
    function shuffled(items){
        const copy=[...(items||[])];
        for(let index=copy.length-1;index>0;index--){
            const swap=Math.floor(Math.random()*(index+1));
            [copy[index],copy[swap]]=[copy[swap],copy[index]];
        }
        return copy;
    }
    function context(){return global.DraftFoundation?.getGambitRuntimeContext?.()||null;}
    function assignment(playerName=activePlayerName){return global.SuperpowerEngine?.getPlayerData?.(playerName)||null;}
    function getState(playerName=activePlayerName){return assignment(playerName)?.data?.gambit||null;}
    function getPlayerIndex(playerName){return context()?.players?.indexOf(String(playerName||""))??-1;}
    function reducedMotion(){return Boolean(global.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);}

    function rewardProfileForCharge(charge){
        const value=Math.max(0,Math.min(MAX_CHARGE,Number(charge)||0));
        return Object.freeze({
            charge:value,
            selfReroll:value===0,
            enemyShots:value===0?0:value>=5?3:value>=4?2:1,
            queueMomentum:value>=2,
            packShots:value>=3?1:0,
            precisionShot:value>=5,
            lootSlots:value>=5?2:value>=3?1:0
        });
    }

    function rewardStepsForCharge(charge){
        const profile=rewardProfileForCharge(charge);
        if(profile.selfReroll) return ["self_reroll"];
        const steps=["enemy_shot"];
        if(profile.queueMomentum) steps.push("queue_momentum");
        if(profile.packShots) steps.push("pack_shot");
        if(profile.enemyShots>=2) steps.push("bonus_shot");
        if(profile.precisionShot) steps.push("precision_shot");
        if(profile.lootSlots) steps.push("loot");
        return steps;
    }

    function evaluatePrediction(currentPower,nextPower,direction){
        const current=Number(currentPower);
        const next=Number(nextPower);
        if(next===current) return "push";
        if(direction==="higher") return next>current?"success":"miss";
        if(direction==="lower") return next<current?"success":"miss";
        return "invalid";
    }

    function applyRollResult(model,outcome){
        const next={
            charge:Math.max(0,Math.min(MAX_CHARGE,Number(model?.charge)||0)),
            protections:Math.max(0,Math.min(2,Number(model?.protections)||0)),
            bust:false,
            jackpot:false
        };
        if(outcome==="success") next.charge=Math.min(MAX_CHARGE,next.charge+1);
        if(outcome==="miss"&&next.protections>0){
            next.protections-=1;
            next.charge=Math.max(0,next.charge-1);
        }else if(outcome==="miss"){
            next.charge=Math.max(0,next.charge-2);
            next.bust=true;
        }
        next.jackpot=next.charge===MAX_CHARGE;
        return next;
    }

    function createState(playerName,playerIndex,currentCard){
        return {
            version:VERSION,
            active:true,
            completed:false,
            phase:"casino",
            playerName,
            playerIndex,
            charge:0,
            protections:2,
            currentCard:{name:currentCard.name,power:Number(currentCard.power),cost:Number(currentCard.cost)},
            direction:"",
            lastResult:"",
            endReason:"",
            rewardCharge:null,
            targetPlayerIndex:null,
            stepIndex:0,
            completedSteps:{},
            stepResult:null,
            pending:{},
            reserveEntryIds:[],
            shotPlan:[],
            executedShotIds:[],
            rewardProfile:null,
            selectedLootEntryIds:[],
            lootResolved:false,
            selfRerollResolved:false,
            chosenLootEntryId:null,
            finalSummary:[],
            log:[],
            activatedAt:{
                packNumber:Number(context()?.packStartIndex||0)+1,
                pickIndex:Number(context()?.currentPickIndex||0),
                timestamp:new Date().toISOString()
            }
        };
    }

    function persist(state){
        const data=assignment(state?.playerName);
        if(!data) return false;
        data.data=data.data||{};
        data.data.gambit=clone(state);
        const stored=global.draftSuperpowers?.[state.playerName];
        if(stored){
            stored.used=true;
            stored.status=state.active?"resolving":"used";
        }
        return true;
    }

    function addLog(state,event,details={}){
        const entry={
            event,
            charge:Number(state.charge)||0,
            protections:Number(state.protections)||0,
            ...clone(details||{}),
            timestamp:new Date().toISOString()
        };
        state.log=Array.isArray(state.log)?state.log:[];
        state.log.push(entry);
        global.superpowerLog=global.superpowerLog||[];
        global.superpowerLog.push({
            type:event==="activated"?"superpower_activation":"superpower_resolution",
            powerId:POWER_ID,
            powerName:"KINETYCZNE KASYNO",
            playerName:state.playerName,
            playerIndex:state.playerIndex,
            packNumber:Number(context()?.packStartIndex||0)+1,
            pickIndex:Number(context()?.currentPickIndex||0),
            ...clone(entry)
        });
        global.DraftStateEngine?.log?.(`gambit_${event}`,{
            packNumber:Number(context()?.packStartIndex||0)+1,
            pickIndex:Number(context()?.currentPickIndex||0),
            playerIndex:state.playerIndex,
            player:state.playerName,
            reason:`gambit_${event}`,
            data:clone(entry)
        });
        return entry;
    }

    function showWarning(title,message){
        global.SuperpowerFeedback?.warning?.(POWER_ID,title,message);
    }
    function showError(title,message){
        global.SuperpowerFeedback?.error?.(POWER_ID,title,message);
    }

    function getCasinoPool(){
        const ctx=context();
        if(!ctx) return [];
        const banned=new Set((ctx.bannedCards||[]).map(normalize));
        const seen=new Set();
        return (ctx.cardDatabase||[]).filter(card=>{
            const name=normalize(card?.name);
            if(!name||seen.has(name)||banned.has(name)||card?.joker||!Number.isFinite(Number(card?.power))) return false;
            seen.add(name);
            return true;
        });
    }

    function drawCasinoCard(excludedName=""){
        const excluded=normalize(excludedName);
        const pool=getCasinoPool().filter(card=>normalize(card?.name)!==excluded);
        const card=pool[Math.floor(Math.random()*pool.length)]||getCasinoPool()[0];
        return card?{name:card.name,power:Number(card.power),cost:Number(card.cost)}:null;
    }

    function canReplaceOwnCard(card,index,effect="replace",ownerIndex){
        const state=getState();
        const resolvedOwnerIndex=Number.isInteger(ownerIndex)?ownerIndex:state?.playerIndex;
        if(!card||card?.joker||card?.instanceMeta?.locked||card?.instanceMeta?.cannotReplace) return false;
        if(effect==="reroll"&&card?.instanceMeta?.wolverineRegenerationProtected) return false;
        return global.DraftFoundation?.canSuperpowerTargetDeckCard?.({
            actorPlayerIndex:resolvedOwnerIndex,
            targetPlayerIndex:resolvedOwnerIndex,
            targetCardIndex:index,
            effect
        })!==false;
    }

    function replacementTemplates(deck,sourceIndex){
        const ctx=context();
        if(!ctx||!Array.isArray(deck)||!deck[sourceIndex]) return [];
        const banned=new Set((ctx.bannedCards||[]).map(normalize));
        const occupied=new Set(deck.filter((_,index)=>index!==sourceIndex).map(card=>normalize(card?.name)).filter(Boolean));
        const sourceName=normalize(deck[sourceIndex]?.name);
        const seen=new Set();
        return (ctx.cardDatabase||[]).filter(card=>{
            const name=normalize(card?.name);
            if(!name||name===sourceName||seen.has(name)||occupied.has(name)||banned.has(name)||card?.joker) return false;
            if(!Number.isFinite(Number(card.cost))||!Number.isFinite(Number(card.power))) return false;
            seen.add(name);
            return true;
        });
    }

    function createReplacementOptions(deck,sourceIndex,event){
        if(replacementTemplates(deck,sourceIndex).length<2) return [];
        return global.DraftFoundation?.generateLegalRuntimeCards?.(2,{
            excludeCards:[...(deck||[])],
            origin:"gambit_replacement",
            sourcePowerId:POWER_ID,
            sourceEvent:event
        })||[];
    }

    function createSameCostReplacementOptions(deck,sourceIndex,event,count=1,extraExcluded=[]){
        const source=deck?.[sourceIndex];
        if(!source) return [];
        return global.DraftFoundation?.generateLegalRuntimeCards?.(count,{
            excludeCards:[...(context()?.decks||[]).flat(),...(context()?.currentPack||[]),...(extraExcluded||[])],
            exactCost:Number(source.cost),
            ignoreCustomPack:true,
            origin:"gambit_same_cost_replacement",
            sourcePowerId:POWER_ID,
            sourceEvent:event
        })||[];
    }

    function hasSameCostReplacement(deck,index,count=1){
        const source=deck?.[index];
        if(!source) return false;
        const occupied=new Set([...(context()?.decks||[]).flat(),...(context()?.currentPack||[])]
            .map(card=>normalize(card?.name)).filter(Boolean));
        const banned=new Set((context()?.bannedCards||[]).map(normalize));
        let matches=0;
        for(const template of context()?.cardDatabase||[]){
            const name=normalize(template?.name);
            if(!name||template?.joker||banned.has(name)||occupied.has(name)||Number(template?.cost)!==Number(source.cost)) continue;
            matches+=1;
            if(matches>=count) return true;
        }
        return false;
    }

    function legalZeroRerollEntries(playerIndex){
        const deck=context()?.decks?.[playerIndex]||[];
        return deck.map((card,index)=>({card,index})).filter(entry=>
            canReplaceOwnCard(entry.card,entry.index,"reroll",playerIndex)&&hasSameCostReplacement(deck,entry.index,3)
        );
    }

    function legalSameCostTargetEntries(ownerIndex,targetIndex,excludedIds=new Set()){
        const deck=context()?.decks?.[targetIndex]||[];
        return deck.map((card,index)=>({card,index})).filter(entry=>
            !excludedIds.has(entry.card?.instanceId)&&
            legalTargetEntries(ownerIndex,targetIndex,"reroll").some(candidate=>candidate.index===entry.index)&&
            hasSameCostReplacement(deck,entry.index,1)
        );
    }

    function legalSameCostPackEntries(excludedIds=new Set()){
        const ctx=context();
        return (ctx?.currentPack||[]).map((card,index)=>({card,index})).filter(entry=>
            entry.card&&!entry.card.joker&&!excludedIds.has(entry.card.instanceId)&&
            !global.DraftFoundation?.getGambitPackCardBlockReason?.(entry.card)&&
            hasSameCostReplacement(ctx.currentPack,entry.index,1)
        );
    }

    function legalSelfRerollEntries(playerIndex){
        const deck=context()?.decks?.[playerIndex]||[];
        return deck.map((card,index)=>({card,index})).filter(entry=>
            canReplaceOwnCard(entry.card,entry.index,"reroll",playerIndex)&&replacementTemplates(deck,entry.index).length>=2
        );
    }

    function hasLegalOwnSlotForIncoming(incomingCard,playerIndex){
        const deck=context()?.decks?.[playerIndex]||[];
        const incomingName=normalize(incomingCard?.name);
        if(!incomingName) return false;
        return deck.some((card,index)=>{
            if(!canReplaceOwnCard(card,index,"replace",playerIndex)) return false;
            return !deck.some((other,otherIndex)=>otherIndex!==index&&normalize(other?.name)===incomingName);
        });
    }

    function legalTargetEntries(ownerIndex,targetIndex,effect="reroll"){
        const deck=context()?.decks?.[targetIndex]||[];
        return deck.map((card,index)=>({card,index})).filter(entry=>{
            if(!entry.card||entry.card?.joker||entry.card?.instanceMeta?.locked||entry.card?.instanceMeta?.cannotReplace) return false;
            if(global.DraftFoundation?.canSuperpowerTargetDeckCard?.({
                actorPlayerIndex:ownerIndex,
                targetPlayerIndex:targetIndex,
                targetCardIndex:entry.index,
                effect
            })===false) return false;
            return replacementTemplates(deck,entry.index).length>=2;
        });
    }

    function legalRoyalEntries(ownerIndex,targetIndex){
        return legalTargetEntries(ownerIndex,targetIndex,"reroll").filter(entry=>
            hasLegalOwnSlotForIncoming(entry.card,ownerIndex)
        );
    }

    function legalTargets(ownerIndex,charge=1){
        const ctx=context();
        return (ctx?.players||[]).map((name,index)=>({name,index})).filter(player=>{
            if(player.index===ownerIndex) return false;
            if(!legalTargetEntries(ownerIndex,player.index,"reroll").length) return false;
            if(Number(charge)>=5&&legalRoyalEntries(ownerIndex,player.index).length<3) return false;
            return true;
        });
    }

    function legalPackRicochetEntries(ownerIndex){
        const ctx=context();
        if(!ctx) return [];
        const economy=global.DraftFoundation?.canConsumePackSurplus?.(1);
        if(!economy?.ok) return [];
        return (ctx.currentPack||[]).map((card,index)=>({card,index})).filter(entry=>{
            if(!entry.card||entry.card?.joker) return false;
            if(global.DraftFoundation?.getGambitPackCardBlockReason?.(entry.card)) return false;
            return hasLegalOwnSlotForIncoming(entry.card,ownerIndex);
        });
    }

    function preflight(playerName){
        const ctx=context();
        const playerIndex=ctx?.players?.indexOf(playerName)??-1;
        if(!ctx||ctx.draftFinished) return {ok:false,reason:"Draft nie jest aktywny."};
        if(!ctx.packIsOpen||ctx.packOpeningInProgress||ctx.packEnding) return {ok:false,reason:"Poczekaj, aż aktualna paczka będzie spokojnie otwarta."};
        if(playerIndex<0) return {ok:false,reason:"Nie odnaleziono Gambita w tym drafcie."};
        if(!(ctx.decks?.[playerIndex]||[]).length) return {ok:false,reason:"Gambit potrzebuje przynajmniej jednej własnej karty, aby wejść do kasyna."};
        if(getCasinoPool().length<2) return {ok:false,reason:"Kasyno nie ma wystarczającej liczby kart do gry Wyżej / Niżej."};
        return {ok:true,playerIndex};
    }

    function ensureInterface(){
        let root=document.getElementById("spxGambitRoot");
        if(root) return root;
        root=document.createElement("div");
        root.id="spxGambitRoot";
        root.className="spx-gambit-root";
        root.hidden=true;
        root.innerHTML=`<div class="spx-gambit-backdrop"></div><section class="spx-gambit-shell" role="dialog" aria-modal="true" aria-labelledby="spxGambitTitle"><div id="spxGambitContent"></div></section><div class="spx-gambit-fx" aria-hidden="true"></div>`;
        document.body.appendChild(root);
        return root;
    }

    function meterHtml(charge){
        return `<aside class="spx-gambit-meter"><div class="spx-gambit-meter-card"><span>MIERNIK KINETYCZNY</span><strong>${charge}/5</strong><div class="spx-gambit-meter-fill" style="--charge:${charge}" aria-hidden="true"></div>${REWARD_LABELS.map((label,index)=>`<i class="${index<=charge?"is-on":""}"><b>${index}</b><em>${label}</em></i>`).join("")}</div></aside>`;
    }

    function protectionsHtml(count){
        return `<div class="spx-gambit-protections" aria-label="Pozostałe Ochrony Kinetyczne">${[0,1].map(index=>`<span class="${index<count?"is-live":"is-broken"}">♦</span>`).join("")}</div>`;
    }

    function screenLivesHtml(count=0){
        return `<div class="spx-gambit-screen-lives" aria-label="Pozostałe życia Gambita"><span>ŻYCIA</span>${[0,1].map(index=>`<i class="${index<count?"is-live":"is-broken"}">♦</i>`).join("")}</div>`;
    }

    function cardNameSizeClass(name){
        const length=String(name||"").trim().length;
        if(length>=30) return "is-very-long-name";
        if(length>=18) return "is-long-name";
        return "";
    }

    function renderCasino(state){
        const root=ensureInterface();
        const content=root.querySelector("#spxGambitContent");
        const direction=state.direction||"";
        content.innerHTML=`
            <header class="spx-gambit-header"><h1 id="spxGambitTitle">KINETYCZNE KASYNO GAMBITA</h1><p>${escapeHtml(state.playerName)}, obstaw następną bazową Siłę. Każdy ładunek dokłada nowy strzał do jednej wielkiej salwy.</p></header>
            <div class="spx-gambit-casino-layout">
                ${meterHtml(state.charge)}
                <main class="spx-gambit-machine ${rolling?"is-rolling":""} ${state.lastOutcome?`has-result is-${escapeHtml(state.lastOutcome)}`:""}" style="--charge:${state.charge}">
                    <div class="spx-gambit-bulbs" aria-hidden="true">${"<i></i>".repeat(18)}</div>
                    <div class="spx-gambit-machine-sign"><span>WYŻEJ</span><b>♠</b><span>NIŻEJ</span></div>
                    <div class="spx-gambit-slot ${cardNameSizeClass(state.currentCard?.name)}">
                        <div class="spx-gambit-screen-hud">
                            <span class="spx-gambit-screen-label">AKTUALNA KARTA</span>
                            ${screenLivesHtml(state.protections)}
                        </div>
                        <strong>${escapeHtml(state.currentCard?.name||"?")}</strong>
                        <b>${escapeHtml(state.currentCard?.power??"?")} SIŁY</b>
                        <div class="spx-gambit-result spx-gambit-screen-result" aria-live="polite">${escapeHtml(state.lastResult||"Wybierz kierunek i pociągnij kinetyczną wajchę.")}</div>
                    </div>
                    <div class="spx-gambit-control-deck">
                        <div class="spx-gambit-bet-controls">
                            <button type="button" data-gambit-direction="higher" class="is-higher ${direction==="higher"?"is-selected":""}" ${rolling?"disabled":""}><span>▲</span><b>WYŻEJ</b></button>
                            <button type="button" data-gambit-direction="lower" class="is-lower ${direction==="lower"?"is-selected":""}" ${rolling?"disabled":""}><span>▼</span><b>NIŻEJ</b></button>
                        </div>
                        <footer><button type="button" class="spx-gambit-cashout" data-gambit-cashout ${rolling?"disabled":""}><span>CASH OUT</span></button></footer>
                    </div>
                    <button type="button" class="spx-gambit-lever" data-gambit-roll ${!direction||rolling?"disabled":""} aria-label="Pociągnij wajchę kasyna">
                        <img src="draft-assets/gambit_casino_lever.png" alt="" draggable="false" aria-hidden="true">
                        <b><span>CIĄGNIJ</span></b>
                    </button>
                </main>
            </div>`;
        content.querySelectorAll("[data-gambit-direction]").forEach(button=>button.addEventListener("click",()=>{
            const live=getState();
            if(!live||rolling) return;
            live.direction=button.dataset.gambitDirection;
            live.lastOutcome="";
            live.lastResult=live.direction==="higher"?"Zakład: kolejna Siła będzie WYŻSZA.":"Zakład: kolejna Siła będzie NIŻSZA.";
            persist(live);render();
        }));
        content.querySelector("[data-gambit-roll]")?.addEventListener("click",roll);
        content.querySelector("[data-gambit-cashout]")?.addEventListener("click",()=>beginSalvo("cash_out"));
    }

    function playCardBurst(charge=0){
        const root=ensureInterface();
        const layer=root.querySelector(".spx-gambit-fx");
        if(!layer||reducedMotion()) return;
        const count=6+Math.max(0,Number(charge)||0)*4;
        layer.innerHTML="";
        for(let index=0;index<count;index++){
            const card=document.createElement("img");
            card.className="spx-gambit-burst-card";
            card.src="draft-assets/gambit_kinetic_card.png";
            card.alt="";
            card.style.setProperty("--angle",`${(360/count)*index+(Math.random()*18-9)}deg`);
            card.style.setProperty("--distance",`${140+Math.random()*260}px`);
            card.style.setProperty("--delay",`${Math.random()*.14}s`);
            layer.appendChild(card);
        }
        layer.classList.remove("is-active");
        void layer.offsetWidth;
        layer.classList.add("is-active");
        global.clearTimeout?.(burstTimer);
        burstTimer=global.setTimeout?.(()=>{
            burstTimer=0;
            // Never clear the layer after Final Salvo has taken ownership of it.
            if(layer.classList.contains("is-board-salvo")) return;
            layer.classList.remove("is-active");
            layer.innerHTML="";
        },1100);
    }

    function playFinalSalvo(charge=0){
        const root=ensureInterface();
        const layer=root.querySelector(".spx-gambit-fx");
        if(!layer) return;
        global.clearTimeout?.(burstTimer);
        burstTimer=0;
        layer.classList.remove("is-active","is-final","is-transitioning");
        layer.innerHTML="";

        const scene=document.createElement("div");
        scene.className="spx-gambit-final-scene";

        const ambient=document.createElement("div");
        ambient.className="spx-gambit-ambient-cards";
        const ambientCount=32+Math.max(0,Number(charge)||0)*6;
        for(let index=0;index<ambientCount;index++){
            const card=document.createElement("img");
            card.src="draft-assets/gambit_kinetic_card.png";
            card.alt="";
            card.draggable=false;
            card.className=index%3===0?"is-charged":"";
            const side=index%2===0?-1:1;
            card.style.setProperty("--ambient-x",`${50+side*(12+Math.random()*42)}%`);
            card.style.setProperty("--ambient-y",`${12+Math.random()*74}%`);
            card.style.setProperty("--ambient-size",`${18+Math.random()*44}px`);
            card.style.setProperty("--ambient-rotate",`${-42+Math.random()*84}deg`);
            card.style.setProperty("--ambient-delay",`${Math.random()*1.25}s`);
            card.style.setProperty("--ambient-duration",`${3.2+Math.random()*3.4}s`);
            ambient.appendChild(card);
        }

        const hero=document.createElement("img");
        hero.className="spx-gambit-final-hero";
        hero.src="draft-assets/gambitpowershero.png";
        hero.alt="";
        hero.draggable=false;
        const title=document.createElement("strong");
        title.textContent="KINETYCZNA SALWA!";
        scene.append(ambient,hero,title);
        layer.appendChild(scene);
        void layer.offsetWidth;
        layer.classList.add("is-board-salvo");
    }

    function roll(){
        const state=getState();
        if(!state||state.phase!=="casino"||rolling||!["higher","lower"].includes(state.direction)) return false;
        const previousCard=clone(state.currentCard);
        const nextCard=drawCasinoCard(state.currentCard?.name);
        if(!nextCard){showError("KASYNO STRACIŁO SYGNAŁ","Nie udało się wylosować kolejnej karty.");return false;}
        const direction=state.direction;
        rolling=true;
        render();
        global.clearTimeout?.(rollTimer);
        rollTimer=global.setTimeout?.(()=>{
            const live=getState();
            if(!live) return;
            const outcome=evaluatePrediction(live.currentCard?.power,nextCard.power,direction);
            const before={charge:live.charge,protections:live.protections};
            const after=applyRollResult(before,outcome);
            live.charge=after.charge;
            live.protections=after.protections;
            live.currentCard=nextCard;
            live.direction="";
            live.lastOutcome=outcome;
            if(outcome==="push") live.lastResult=`PUSH — ${nextCard.power} równa się poprzedniej Sile. Grasz dalej.`;
            if(outcome==="success") live.lastResult=`TRAFIONY ZAKŁAD — ładunek rośnie do ${live.charge}.`;
            if(outcome==="miss"&&!after.bust) live.lastResult=`CHYBIONY ZAKŁAD — pęka Ochrona, ładunek spada do ${live.charge}.`;
            if(after.bust) live.lastResult=`KINETYCZNE PRZECIĄŻENIE — ładunek spada do ${live.charge}. Salwa zostaje rozliczona.`;
            addLog(live,outcome==="push"?"push":outcome==="success"?"higher_lower_roll":"protection_lost",{
                direction,
                previousCard:previousCard?.name||null,
                previousPower:Number(previousCard?.power),
                nextPower:nextCard.power,
                outcome,
                bust:after.bust
            });
            if(after.bust) addLog(live,"bust",{finalCharge:live.charge});
            if(after.jackpot) addLog(live,"jackpot",{finalCharge:live.charge});
            persist(live);
            rolling=false;
            playCardBurst(live.charge);
            render();
            if(after.bust||after.jackpot){
                global.setTimeout?.(()=>beginSalvo(after.jackpot?"jackpot":"bust"),reducedMotion()?180:900);
            }
        },reducedMotion()?240:1100);
        return true;
    }

    function beginSalvo(reason){
        const state=getState();
        if(!state||state.phase!=="casino") return false;
        rolling=false;
        global.clearTimeout?.(rollTimer);
        global.clearTimeout?.(phaseTimer);
        state.phase="prize";
        state.endReason=reason;
        state.rewardCharge=Math.max(0,Math.min(MAX_CHARGE,Number(state.charge)||0));
        state.rewardProfile=rewardProfileForCharge(state.rewardCharge);
        state.shotPlan=buildKineticShotPlan(state);
        state.executedShotIds=[];
        state.selectedLootEntryIds=[];
        state.lootResolved=false;
        state.selfRerollResolved=false;
        state.finalSummary=[];
        state.stepIndex=0;
        state.completedSteps={};
        state.stepResult=null;
        state.pending={};
        addLog(state,reason==="cash_out"?"cash_out":"salvo_started",{rewardCharge:state.rewardCharge,reason});
        persist(state);
        playCardBurst(state.rewardCharge);
        render();
        return true;
    }

    function randomItem(items){
        return items?.length?items[Math.floor(Math.random()*items.length)]:null;
    }

    function buildKineticShotPlan(state){
        const ctx=context();
        const profile=rewardProfileForCharge(state.rewardCharge);
        if(!ctx||profile.selfReroll) return [];
        const plan=[];
        const excludedIds=new Set();
        const usedPlayers=new Set();
        const generated=[];

        const addEnemyShot=(id,{precision=false,preferFreshPlayer=false}={})=>{
            let candidates=[];
            (ctx.players||[]).forEach((name,index)=>{
                if(index===state.playerIndex) return;
                legalSameCostTargetEntries(state.playerIndex,index,excludedIds).forEach(entry=>candidates.push({...entry,playerIndex:index,playerName:name}));
            });
            if(preferFreshPlayer){
                const fresh=candidates.filter(entry=>!usedPlayers.has(entry.playerIndex));
                if(fresh.length) candidates=fresh;
            }
            if(precision&&candidates.length){
                const lowest=Math.min(...candidates.map(entry=>Number(entry.card?.cost)||0));
                candidates=candidates.filter(entry=>Number(entry.card?.cost)===lowest);
            }
            const target=randomItem(candidates);
            if(!target) return false;
            const deck=ctx.decks?.[target.playerIndex]||[];
            const replacement=createSameCostReplacementOptions(deck,target.index,`gambit_${id}_replacement`,1,generated)[0];
            if(!replacement) return false;
            excludedIds.add(target.card.instanceId);
            usedPlayers.add(target.playerIndex);
            generated.push(replacement);
            plan.push({
                id,
                type:"enemy",
                targetPlayerIndex:target.playerIndex,
                targetPlayerName:target.playerName,
                targetInstanceId:target.card.instanceId,
                targetCardName:target.card.name,
                precision,
                replacement,
                intoReserve:profile.lootSlots>0
            });
            return true;
        };

        addEnemyShot("enemy_shot_1");
        if(profile.queueMomentum) plan.push({id:"queue_momentum",type:"queue"});
        if(profile.packShots){
            const packTarget=randomItem(legalSameCostPackEntries(excludedIds));
            if(packTarget){
                const replacement=createSameCostReplacementOptions(ctx.currentPack,packTarget.index,"gambit_pack_shot_replacement",1,generated)[0];
                if(replacement){
                    excludedIds.add(packTarget.card.instanceId);
                    generated.push(replacement);
                    plan.push({id:"pack_shot_1",type:"pack",targetInstanceId:packTarget.card.instanceId,targetCardName:packTarget.card.name,replacement,intoReserve:true});
                }
            }
        }
        if(profile.enemyShots>=2) addEnemyShot("enemy_shot_2",{preferFreshPlayer:true});
        if(profile.enemyShots>=3) addEnemyShot("precision_shot",{precision:true,preferFreshPlayer:true});
        return plan;
    }

    function prizeCopy(charge){
        const value=Math.max(0,Math.min(MAX_CHARGE,Number(charge)||0));
        return [
            ["KONTROLOWANY WYBUCH","Własny reroll 1 z 3 • ten sam koszt"],
            ["PIERWSZY ŁADUNEK","Losowy strzał w deck przeciwnika"],
            ["KINETYCZNE MOMENTUM","Strzał w deck + zamiana przyszłego picku"],
            ["RYKOSZET PACZKI","Deck + kolejka + paczka + 1 Łup"],
            ["PRZECIĄŻENIE","Dwa decki + kolejka + paczka + 1 Łup"],
            ["KRÓLEWSKI RYKOSZET","Trzy deckowe trafienia + kolejka + paczka + 2 Łupy"]
        ][value];
    }

    function renderPrize(state){
        const [title,detail]=prizeCopy(state.rewardCharge);
        return `<div class="spx-gambit-prize"><span>${state.endReason==="jackpot"?"GŁÓWNA WYGRANA":"WYGRANA ZABEZPIECZONA"}</span><strong>${state.rewardCharge}</strong><h1 id="spxGambitTitle">${escapeHtml(title)}</h1><p>${escapeHtml(detail)}</p><div>${rewardStepsForCharge(state.rewardCharge).map(step=>`<i>${escapeHtml(STEP_LABELS[step])}</i>`).join("")}</div></div>`;
    }

    function scheduleUnleash(state){
        global.clearTimeout?.(phaseTimer);
        phaseTimer=global.setTimeout?.(()=>{
            const live=getState();
            if(!live||live.phase!=="prize") return;
            if(live.rewardCharge===0){live.phase="aftermath";persist(live);render();return;}
            live.phase="unleash";
            persist(live);
            render();
            playFinalSalvo(live.rewardCharge);
            global.setTimeout?.(executeUnleash,reducedMotion()?220:2050);
        },reducedMotion()?220:700);
    }

    function renderUnleash(state){
        const done=(state.executedShotIds||[]).length;
        const total=(state.shotPlan||[]).length;
        return `<div class="spx-gambit-unleash"><span>UWOLNIENIE ENERGII KINETYCZNEJ</span><h1 id="spxGambitTitle">PEŁNA SALWA!</h1><p>Kinetyczne karty lecą w decki, paczkę i kolejkę.</p><div class="spx-gambit-unleash-track"><i style="--salvo-progress:${total?done/total:1}"></i></div><b>TRAFIENIA: ${done}/${total||0}</b></div>`;
    }

    function reserveHitCard(state,card,metadata){
        card.instanceMeta={...(card.instanceMeta||{}),gambitKineticReserve:true,gambitReserveSource:metadata.source,gambitOriginalOwnerIndex:metadata.originalOwnerIndex};
        const entry=global.DraftFoundation?.addCardToRuntimeZone?.(RESERVE_ZONE,card,{
            ownerIndex:state.playerIndex,
            sourcePowerId:POWER_ID,
            sourceEvent:metadata.event,
            metadata
        });
        if(!entry) return null;
        state.reserveEntryIds=Array.isArray(state.reserveEntryIds)?state.reserveEntryIds:[];
        state.reserveEntryIds.push(entry.runtimeEntryId);
        return entry;
    }

    function executeEnemyShot(state,shot){
        const ctx=context();
        const deck=ctx?.decks?.[shot.targetPlayerIndex]||[];
        const index=deck.findIndex(card=>card?.instanceId===shot.targetInstanceId);
        if(index<0||!legalSameCostTargetEntries(state.playerIndex,shot.targetPlayerIndex).some(entry=>entry.index===index)){
            return {ok:false,summary:`${shot.precision?"Królewski Rykoszet":"Strzał w deck"}: cel zdążył zejść z linii ognia.`};
        }
        const original=deck[index];
        const replacement=clone(shot.replacement);
        const result=withTransaction(shot.id,()=>{
            if(shot.intoReserve){
                deck[index]=replacement;
                const reserve=reserveHitCard(state,original,{source:"enemy",originalOwnerIndex:shot.targetPlayerIndex,event:`gambit_${shot.id}`,replacementCardInstanceId:replacement.instanceId});
                if(!reserve) return {ok:false,reason:"Nie udało się zabezpieczyć trafionej karty w Kinetycznej Puli."};
                return {ok:true,sourceCard:original,replacementCard:replacement,reserve};
            }
            return global.DraftFoundation.replaceCardInArray({container:deck,index,replacement,preserveReplacementInstance:true,zone:"deck",powerId:POWER_ID,eventType:`gambit_${shot.id}`,reason:"gambit_kinetic_enemy_shot",graveyardCategory:"replaced",previousOwner:shot.targetPlayerIndex,recoverable:true});
        });
        if(!result.ok) return {ok:false,summary:`Strzał w deck: ${result.reason}`};
        const mutation=result.result;
        const counter=global.DraftFoundation?.resolveCaptainAmericaCounterattack?.({attackerPlayerIndex:state.playerIndex,defenderPlayerIndex:shot.targetPlayerIndex,defenderCardIndex:index,defenderCardName:original.name,event:`gambit_${shot.id}`});
        if(counter?.triggered) global.SuperpowerUI?.playCaptainAmericaCounters?.([counter]);
        global.DevilDinoUI?.notifyHostileDeckChange?.({targetPlayerIndex:shot.targetPlayerIndex,targetCardInstanceId:replacement.instanceId,previousCardInstanceId:original.instanceId,previousCardName:original.name,sourcePowerId:POWER_ID,sourceEvent:`gambit_${shot.id}`,mutationId:mutation?.reserve?.runtimeEntryId||replacement.instanceId});
        global.DraftStateEngine?.log?.("gambit_kinetic_enemy_impact",{packNumber:ctx.packStartIndex+1,pickIndex:ctx.currentPickIndex,playerIndex:shot.targetPlayerIndex,sourceCard:original,resultCard:replacement,reason:`gambit_${shot.id}`,data:{attackerPlayerIndex:state.playerIndex,intoReserve:Boolean(shot.intoReserve),precision:Boolean(shot.precision)}});
        const summary=`${shot.precision?"Królewski Rykoszet":"Strzał w deck"} (${ctx.players?.[shot.targetPlayerIndex]}): ${original.name} → ${replacement.name} [Koszt ${original.cost}]`;
        addLog(state,"enemy_impact",{shotId:shot.id,targetPlayerIndex:shot.targetPlayerIndex,sourceCard:original.name,replacementCard:replacement.name,intoReserve:Boolean(shot.intoReserve),precision:Boolean(shot.precision),captainCounter:Boolean(counter?.triggered)});
        global.showDecks?.();
        return {ok:true,summary,kind:shot.precision?"royal":"deck"};
    }

    function executePackShot(state,shot){
        const ctx=context();
        const pack=ctx?.currentPack||[];
        const index=pack.findIndex(card=>card?.instanceId===shot.targetInstanceId);
        if(index<0||global.DraftFoundation?.getGambitPackCardBlockReason?.(pack[index])) return {ok:false,summary:"Strzał w paczkę: cel został wcześniej zabezpieczony lub zabrany."};
        const original=pack[index];
        const replacement=clone(shot.replacement);
        const result=withTransaction(shot.id,()=>{
            const bridge=global.GalacticCurrentSuperpowerBridge;
            const inCurrent=Boolean(bridge?.isModeEnabled?.());
            if(inCurrent){
                global.removeRocketBombWithCard?.(original,"gambit_pack_shot",{});
                const swapped=bridge.replaceLiveCard?.(index,replacement,{source:"gambit_pack_shot",inheritFlowAge:true,render:false});
                if(!swapped?.ok) return swapped;
            }else{
                pack[index]=replacement;
            }
            const reserve=reserveHitCard(state,original,{source:inCurrent?"current":"pack",originalOwnerIndex:null,event:"gambit_pack_shot",replacementCardInstanceId:replacement.instanceId});
            if(!reserve) return {ok:false,reason:"Nie udało się zabezpieczyć trafionej karty paczki."};
            global.DraftFoundation?.resolvePackCardLifecycle?.("move",original,{fromZone:inCurrent?"galacticCurrent":"pack",toZone:RESERVE_ZONE,reason:"gambit_pack_shot",powerId:POWER_ID});
            return {ok:true,reserve};
        });
        if(!result.ok) return {ok:false,summary:`Strzał w paczkę: ${result.reason}`};
        global.MysterioUI?.transferIllusion?.(original,replacement,{reason:"gambit_pack_shot",targetPosition:index});
        global.DraftStateEngine?.log?.("gambit_kinetic_pack_impact",{packNumber:ctx.packStartIndex+1,pickIndex:ctx.currentPickIndex,playerIndex:state.playerIndex,sourceCard:original,resultCard:replacement,reason:"gambit_pack_shot",data:{runtimeEntryId:result.result.reserve.runtimeEntryId}});
        addLog(state,"pack_impact",{shotId:shot.id,sourceCard:original.name,replacementCard:replacement.name,runtimeEntryId:result.result.reserve.runtimeEntryId});
        if(global.GalacticCurrentSuperpowerBridge?.isModeEnabled?.()) global.GalacticCurrent?.refresh?.();
        else global.showPack?.(false);
        return {ok:true,summary:`Strzał w paczkę: ${original.name} → ${replacement.name} [Koszt ${original.cost}]`,kind:"pack"};
    }

    function executeQueueShot(state){
        const hook=global.DraftFoundation?.swapGambitFuturePickEarlierRandom||global.DraftFoundation?.shiftGambitFuturePickByOne;
        const result=hook?.(state.playerIndex,-1,{actorPlayerIndex:state.playerIndex,reason:"gambit_kinetic_queue_swap"})||{ok:false,reason:"Brak hooka kolejki."};
        addLog(state,"queue_momentum",{shifted:Boolean(result.shifted),from:result.from,to:result.to,displacedPlayerIndex:result.displacedPlayerIndex,reason:result.reason||null});
        global.updateRoundQueueDisplay?.();
        return {ok:Boolean(result.ok),summary:result.shifted?`Momentum kolejki: pick Gambita ${result.from+1} → ${result.to+1}.`:`Momentum kolejki: ${result.reason||"kolejka pozostała bez zmian."}`,kind:"queue"};
    }

    function executeShot(state,shot){
        if(shot.type==="enemy") return executeEnemyShot(state,shot);
        if(shot.type==="pack") return executePackShot(state,shot);
        if(shot.type==="queue") return executeQueueShot(state,shot);
        return {ok:false,summary:"Nieznany pocisk kinetyczny."};
    }

    function elementCenter(element){
        const rect=element?.getBoundingClientRect?.();
        if(!rect||(!rect.width&&!rect.height)) return null;
        return {x:rect.left+rect.width/2,y:rect.top+rect.height/2};
    }

    function findInstanceElement(instanceId,scope=document){
        if(!instanceId) return null;
        return Array.from(scope.querySelectorAll?.("[data-card-instance-id]")||[])
            .find(element=>element.dataset?.cardInstanceId===instanceId)||null;
    }

    function resolveShotTarget(state,shot){
        if(shot.type==="enemy"){
            const direct=findInstanceElement(shot.targetInstanceId);
            if(direct) return direct;
            const sections=Array.from(document.querySelectorAll(".deck-section"));
            return sections[shot.targetPlayerIndex]||document.querySelector(".decks-container");
        }
        if(shot.type==="pack") return findInstanceElement(shot.targetInstanceId,document.getElementById("pack")||document)||document.getElementById("pack");
        if(shot.type==="queue"){
            const queue=document.getElementById("roundQueue");
            return Array.from(queue?.children||[]).find(element=>element.textContent?.includes(state.playerName))||queue;
        }
        return null;
    }

    async function flyKineticCard(state,shot,index){
        const root=ensureInterface();
        const layer=root.querySelector(".spx-gambit-fx");
        const targetElement=resolveShotTarget(state,shot);
        const target=elementCenter(targetElement)||{
            x:(Number(global.innerWidth)||1280)*(shot.type==="pack"?.54:shot.type==="queue"?.72:.28+(index%3)*.22),
            y:(Number(global.innerHeight)||720)*(shot.type==="queue"?.24:.62)
        };
        if(!layer) return {target,targetElement};
        const projectile=document.createElement("img");
        projectile.className="spx-gambit-projectile";
        projectile.src="draft-assets/gambit_kinetic_card.png";
        projectile.alt="";
        projectile.draggable=false;
        const heroElement=root.querySelector(".spx-gambit-final-hero");
        heroElement?.classList.add("is-throwing");
        const heroRect=heroElement?.getBoundingClientRect?.();
        const origin=heroRect&&heroRect.width&&heroRect.height
            ?{x:heroRect.left+heroRect.width*.29,y:heroRect.top+heroRect.height*.38}
            :{x:(Number(global.innerWidth)||1280)/2,y:(Number(global.innerHeight)||720)*.54};
        projectile.style.setProperty("--from-x",`${origin.x}px`);
        projectile.style.setProperty("--from-y",`${origin.y}px`);
        projectile.style.setProperty("--to-x",`${target.x}px`);
        projectile.style.setProperty("--to-y",`${target.y}px`);
        projectile.style.setProperty("--shot-spin",`${index%2?540:-540}deg`);
        layer.appendChild(projectile);
        void projectile.offsetWidth;
        projectile.classList.add("is-flying");
        await kineticWait(reducedMotion()?160:920);
        projectile.remove();
        heroElement?.classList.remove("is-throwing");
        return {target,targetElement};
    }

    function playKineticImpact(shot,result,index,targetInfo){
        const root=ensureInterface();
        const layer=root.querySelector(".spx-gambit-fx");
        if(!layer) return;
        const point=targetInfo?.target||{x:(Number(global.innerWidth)||1280)/2,y:(Number(global.innerHeight)||720)/2};
        const ring=document.createElement("i");
        ring.className=`spx-gambit-board-impact is-${escapeHtml(result?.kind||shot.type)}`;
        ring.style.left=`${point.x}px`;
        ring.style.top=`${point.y}px`;
        layer.appendChild(ring);
        targetInfo?.targetElement?.classList?.add("spx-gambit-target-hit");
        const label=document.createElement("b");
        label.className=`spx-gambit-live-impact is-${escapeHtml(result?.kind||shot.type)}`;
        label.style.left=`${point.x}px`;
        label.style.top=`${Math.max(54,point.y-64)}px`;
        label.style.setProperty("--impact-index",String(index));
        label.textContent=result?.kind==="queue"?"MOMENTUM KOLEJKI":result?.kind==="pack"?"TRAFIENIE W PACZKĘ":result?.kind==="royal"?"KRÓLEWSKI RYKOSZET":"TRAFIENIE W DECK";
        layer.appendChild(label);
        global.setTimeout?.(()=>{
            ring.remove();label.remove();
            targetInfo?.targetElement?.classList?.remove("spx-gambit-target-hit");
        },reducedMotion()?320:1700);
    }

    async function settleSalvoBeforeAftermath(){
        const layer=ensureInterface().querySelector(".spx-gambit-fx");
        if(!layer) return;
        layer.classList.add("is-salvo-closing");
        await kineticWait(reducedMotion()?160:1250);
    }

    async function transitionToAftermath(){
        const root=ensureInterface();
        const layer=root.querySelector(".spx-gambit-fx");
        if(!layer) return;
        const wipe=document.createElement("div");
        wipe.className="spx-gambit-aftermath-wipe";
        wipe.innerHTML=`<img src="draft-assets/gambit_kinetic_card.png" alt=""><strong>SALWA ROZLICZONA</strong>`;
        layer.appendChild(wipe);
        layer.classList.add("is-transitioning");
        await kineticWait(reducedMotion()?180:1280);
    }

    function kineticWait(ms){return new Promise(resolve=>global.setTimeout?.(resolve,reducedMotion()?Math.min(ms,80):ms));}

    async function executeUnleash(){
        if(salvoRunning) return;
        let state=getState();
        if(!state||state.phase!=="unleash") return;
        salvoRunning=true;
        try{
            const plan=state.shotPlan||[];
            for(let index=0;index<plan.length;index++){
                state=getState();
                if(!state||state.phase!=="unleash") return;
                const shot=plan[index];
                if((state.executedShotIds||[]).includes(shot.id)) continue;
                const targetInfo=await flyKineticCard(state,shot,index);
                const result=executeShot(state,shot);
                state.executedShotIds=Array.isArray(state.executedShotIds)?state.executedShotIds:[];
                state.executedShotIds.push(shot.id);
                state.finalSummary=Array.isArray(state.finalSummary)?state.finalSummary:[];
                state.finalSummary.push(result.summary);
                persist(state);
                playKineticImpact(shot,result,index,targetInfo);
                await kineticWait(760);
            }
            state=getState();
            if(!state||state.phase!=="unleash") return;
            // Let the final impact breathe while Gambit still remains on screen.
            await kineticWait(1700);
            await settleSalvoBeforeAftermath();
            await transitionToAftermath();
            // Short blackout beat after the wipe before the aftermath UI appears.
            await kineticWait(620);
            state=getState();
            if(!state||state.phase!=="unleash") return;
            state.phase="aftermath";
            addLog(state,"kinetic_aftermath",{rewardCharge:state.rewardCharge,shotsExecuted:(state.executedShotIds||[]).length,lootSlots:state.rewardProfile?.lootSlots||0});
            persist(state);
            render();
            await kineticWait(760);
            const layer=ensureInterface().querySelector(".spx-gambit-fx");
            layer?.classList.remove("is-board-salvo","is-transitioning","is-salvo-closing");
            if(layer) layer.innerHTML="";
        }finally{
            salvoRunning=false;
        }
    }

    function cardTile(entry,attributes="",extraClass=""){
        const card=entry?.card||entry;
        return `<button type="button" class="spx-gambit-card ${extraClass}" ${attributes} data-card-name="${escapeHtml(card?.name||"")}"><span>KOSZT ${escapeHtml(card?.cost??"?")}</span><strong>${escapeHtml(card?.name||"Karta")}</strong><b>SIŁA ${escapeHtml(card?.power??"?")}</b></button>`;
    }

    function selectZeroRerollSource(instanceId){
        const state=getState();
        if(!state||state.phase!=="aftermath"||Number(state.rewardCharge)!==0) return false;
        const deck=context()?.decks?.[state.playerIndex]||[];
        const index=deck.findIndex(card=>card?.instanceId===instanceId);
        if(index<0||!legalZeroRerollEntries(state.playerIndex).some(entry=>entry.index===index)){
            showWarning("WYBUCH STRACIŁ CEL","Ta karta nie może już zostać przelosowana.");
            return false;
        }
        const options=createSameCostReplacementOptions(deck,index,"gambit_charge_zero_options",3);
        if(options.length<3){
            showWarning("ZA MAŁO KART W TYM KOSZCIE","Nie udało się przygotować trzech różnych zamienników.");
            return false;
        }
        state.pending={zeroSourceId:instanceId,zeroOptions:options};
        persist(state);
        render();
        return true;
    }

    function commitZeroReroll(replacementId){
        const state=getState();
        if(!state||state.phase!=="aftermath"||Number(state.rewardCharge)!==0||state.selfRerollResolved) return false;
        const deck=context()?.decks?.[state.playerIndex]||[];
        const index=deck.findIndex(card=>card?.instanceId===state.pending?.zeroSourceId);
        const replacement=(state.pending?.zeroOptions||[]).find(card=>card?.instanceId===replacementId);
        if(index<0||!replacement||Number(deck[index]?.cost)!==Number(replacement.cost)){
            showWarning("WYBÓR WYGASŁ","Źródłowa karta albo wybrany zamiennik nie są już dostępne.");
            return false;
        }
        const original=deck[index];
        const result=withTransaction("charge_zero_reroll",()=>global.DraftFoundation?.replaceCardInArray?.({
            container:deck,
            index,
            replacement,
            preserveReplacementInstance:true,
            zone:"deck",
            powerId:POWER_ID,
            eventType:"gambit_charge_zero_reroll",
            reason:"gambit_controlled_blast",
            graveyardCategory:"replaced",
            previousOwner:state.playerIndex,
            recoverable:true
        }));
        if(!result.ok) return showError("KONTROLOWANY WYBUCH COFNIĘTY",result.reason);
        state.selfRerollResolved=true;
        state.pending={};
        state.finalSummary.push(`Kontrolowany wybuch: ${original.name} → ${replacement.name} [Cost ${original.cost}].`);
        addLog(state,"charge_zero_reroll",{sourceCard:original.name,replacementCard:replacement.name,cost:Number(original.cost)});
        persist(state);
        global.showDecks?.();
        global.GraveyardUI?.refreshButton?.();
        playCardBurst(0);
        render();
        return true;
    }

    function weakestLegalSwapEntry(state,incomingCard){
        return legalFinalSwapEntries(state,incomingCard).sort((left,right)=>
            (Number(left.card?.power)||0)-(Number(right.card?.power)||0)||
            (Number(left.card?.cost)||0)-(Number(right.card?.cost)||0)||
            left.index-right.index
        )[0]||null;
    }

    function discardReserveEntry(entry,reason="gambit_unchosen_reserve"){
        const removed=global.DraftFoundation?.removeCardFromRuntimeZone?.(RESERVE_ZONE,entry.runtimeEntryId,{
            nextZone:"graveyard",
            reason,
            zoneContext:{powerId:POWER_ID}
        });
        if(!removed) return null;
        global.DraftFoundation?.resolvePackCardLifecycle?.("move",removed.card,{fromZone:RESERVE_ZONE,toZone:"graveyard",reason,powerId:POWER_ID});
        global.removeRocketBombWithCard?.(removed.card,reason,{replacementPowerId:POWER_ID});
        global.DraftFoundation?.archiveCardToGraveyard?.("replaced",removed.card,{
            previousOwner:Number.isInteger(Number(removed.metadata?.originalOwnerIndex))?Number(removed.metadata.originalOwnerIndex):null,
            source:reason,
            powerId:POWER_ID,
            recoverable:true,
            skipGrootHarvest:true
        });
        return removed;
    }

    function toggleLoot(entryId){
        const state=getState();
        if(!state||state.phase!=="aftermath"||state.lootResolved) return false;
        const profile=state.rewardProfile||rewardProfileForCharge(state.rewardCharge);
        const available=getReserveEntries(state);
        if(!available.some(entry=>entry.runtimeEntryId===entryId)) return false;
        const selected=new Set(state.selectedLootEntryIds||[]);
        if(selected.has(entryId)) selected.delete(entryId);
        else if(selected.size<profile.lootSlots) selected.add(entryId);
        else{
            showWarning("RĘCE PEŁNE ŁUPU",`Ładunek ${state.rewardCharge} pozwala zatrzymać maksymalnie ${profile.lootSlots} ${profile.lootSlots===1?"kartę":"karty"}.`);
            return false;
        }
        state.selectedLootEntryIds=[...selected];
        persist(state);
        render();
        return true;
    }

    function resolveLootSelection(){
        const state=getState();
        if(!state||state.phase!=="aftermath"||state.lootResolved) return false;
        const profile=state.rewardProfile||rewardProfileForCharge(state.rewardCharge);
        const selectedIds=(state.selectedLootEntryIds||[]).slice(0,profile.lootSlots);
        const reserveBefore=getReserveEntries(state);
        const selectedEntries=selectedIds.map(id=>reserveBefore.find(entry=>entry.runtimeEntryId===id)).filter(Boolean);
        for(const entry of selectedEntries){
            if(!weakestLegalSwapEntry(state,entry.card)){
                showWarning("ŁUP NIE MA MIEJSCA",`${entry.card?.name||"Ta karta"} nie może teraz zastąpić żadnej karty Gambita.`);
                return false;
            }
        }
        const result=withTransaction("kinetic_loot",()=>{
            const acquired=[];
            for(const entry of selectedEntries){
                const outgoing=weakestLegalSwapEntry(state,entry.card);
                if(!outgoing) return {ok:false,reason:`Nie ma miejsca na Łup ${entry.card?.name||"?"}.`};
                const released=global.DraftFoundation?.removeCardFromRuntimeZone?.(RESERVE_ZONE,entry.runtimeEntryId,{
                    nextZone:"deck",
                    reason:"gambit_kinetic_loot_claimed",
                    zoneContext:{playerIndex:state.playerIndex}
                });
                if(!released) return {ok:false,reason:"Wybrany Łup zniknął z Kinetycznej Puli."};
                const mutation=global.DraftFoundation?.acquireCardToDeck?.({
                    playerIndex:state.playerIndex,
                    sourceCard:released.card,
                    sourceZone:RESERVE_ZONE,
                    preserveInstance:true,
                    replacementIndex:outgoing.index,
                    archivePrevious:true,
                    graveyardCategory:"replaced",
                    reason:"gambit_kinetic_loot_swap",
                    eventType:"gambit_kinetic_loot_swap",
                    powerId:POWER_ID,
                    recoverable:true,
                    acquisitionType:"kinetic_loot"
                });
                if(!mutation?.ok) return mutation||{ok:false,reason:"Nie udało się odebrać Łupu."};
                acquired.push(mutation);
            }
            reserveBefore.filter(entry=>!selectedIds.includes(entry.runtimeEntryId)).forEach(entry=>discardReserveEntry(entry));
            return {ok:true,acquired};
        });
        if(!result.ok) return showError("RYKOSZET ŁUPU COFNIĘTY",result.reason);
        state.lootResolved=true;
        state.reserveEntryIds=[];
        const acquired=result.result.acquired||[];
        acquired.forEach(item=>state.finalSummary.push(`Łup: ${item.resultCard?.name} zastępuje najsłabszą kartę ${item.previousCard?.name}.`));
        if(!acquired.length) state.finalSummary.push("Gambit zostawia całą kinetyczną pulę na Cmentarzysku.");
        addLog(state,"loot_resolved",{
            selectedCount:acquired.length,
            selectedCards:acquired.map(item=>item.resultCard?.name),
            removedCards:acquired.map(item=>item.previousCard?.name)
        });
        persist(state);
        global.showDecks?.();
        global.GraveyardUI?.refreshButton?.();
        playCardBurst(state.rewardCharge);
        render();
        return true;
    }

    function renderAftermath(state){
        const profile=state.rewardProfile||rewardProfileForCharge(state.rewardCharge);
        const summaries=(state.finalSummary||[]).filter(Boolean);
        let decision="";
        if(profile.selfReroll&&!state.selfRerollResolved){
            const deck=context()?.decks?.[state.playerIndex]||[];
            const sourceId=state.pending?.zeroSourceId;
            const options=state.pending?.zeroOptions||[];
            if(sourceId&&options.length){
                const source=deck.find(card=>card?.instanceId===sourceId);
                decision=`<section class="spx-gambit-aftermath-action"><span>KONTROLOWANY WYBUCH // ŁADUNEK 0</span><h2>WYBIERZ NOWĄ KARTĘ</h2><p>${escapeHtml(source?.name||"Wybrana karta")} zostaje przelosowana na jedną z trzech kart tego samego kosztu.</p><div class="spx-gambit-card-grid">${options.map(card=>cardTile(card,`data-gambit-zero-replacement="${escapeHtml(card.instanceId)}"`)).join("")}</div><button type="button" class="spx-gambit-secondary" data-gambit-zero-reset>ZMIEŃ KARTĘ</button></section>`;
            }else{
                const entries=legalZeroRerollEntries(state.playerIndex);
                decision=`<section class="spx-gambit-aftermath-action"><span>KONTROLOWANY WYBUCH // ŁADUNEK 0</span><h2>WSKAŻ WŁASNĄ KARTĘ</h2><p>Gambit przelosuje ją 1:1 i pokaże trzy zamienniki tego samego kosztu.</p><div class="spx-gambit-card-grid">${entries.map(entry=>cardTile(entry,`data-gambit-zero-source="${escapeHtml(entry.card.instanceId)}"`)).join("")}</div></section>`;
            }
        }else if(profile.lootSlots>0&&!state.lootResolved){
            const selected=new Set(state.selectedLootEntryIds||[]);
            const entries=getReserveEntries(state);
            decision=`<section class="spx-gambit-aftermath-action"><span>KINETYCZNA PULA // ${entries.length} KART</span><h2>WYBIERZ ${profile.lootSlots===1?"JEDEN ŁUP":`DO ${profile.lootSlots} ŁUPÓW`}</h2><p>Każdy wybrany Łup zastąpi automatycznie najsłabszą dostępną kartę Gambita. Pozostałe trafiają na Cmentarzysko.</p><div class="spx-gambit-card-grid is-loot">${entries.map(entry=>cardTile(entry.card,`data-gambit-aftermath-loot="${escapeHtml(entry.runtimeEntryId)}" aria-pressed="${selected.has(entry.runtimeEntryId)}"`,selected.has(entry.runtimeEntryId)?"is-selected is-reserve":"is-reserve")).join("")}</div><button type="button" class="spx-gambit-primary" data-gambit-resolve-loot>${selected.size?`ODBIERZ ŁUP ${selected.size}/${profile.lootSlots}`:"ZOSTAW ŁUP"}</button></section>`;
        }else{
            decision=`<button type="button" class="spx-gambit-primary" data-gambit-close>WRÓĆ DO DRAFTU</button>`;
        }
        return `<div class="spx-gambit-aftermath"><header><span>PO SALWIE // ŁADUNEK ${state.rewardCharge}</span><h1 id="spxGambitTitle">ENERGIA OPADŁA</h1><p>Kasyno podsumowuje wszystkie trafienia jednej salwy.</p></header><div class="spx-gambit-aftermath-layout"><section class="spx-gambit-aftermath-report"><h2>RAPORT TRAFIEŃ</h2><ul>${summaries.length?summaries.map(line=>`<li>${escapeHtml(line)}</li>`).join(""):`<li>Salwa nie znalazła dostępnego celu.</li>`}</ul></section>${decision}</div></div>`;
    }

    function stepRailHtml(state,steps){
        return `<ol class="spx-gambit-step-rail">${steps.map((step,index)=>`<li class="${state.completedSteps?.[step]?"is-done":index===state.stepIndex?"is-current":""}"><span>${state.completedSteps?.[step]?"✓":index+1}</span><b>${escapeHtml(STEP_LABELS[step])}</b></li>`).join("")}</ol>`;
    }

    function salvoFrame(state,steps,title,lead,body,actions=""){
        return `<header class="spx-gambit-salvo-head"><span>PEŁNA SALWA KINETYCZNA // ŁADUNEK ${state.rewardCharge}</span><h1 id="spxGambitTitle">${escapeHtml(title)}</h1><p>${escapeHtml(lead)}</p></header><div class="spx-gambit-salvo-layout">${stepRailHtml(state,steps)}<main class="spx-gambit-step"><div class="spx-gambit-step-body">${body}</div><footer>${actions}</footer></main></div>`;
    }

    function finishStep(state,step,message,detail=""){
        state.completedSteps=state.completedSteps||{};
        state.completedSteps[step]=true;
        state.stepResult={step,message,detail};
        state.pending={};
        persist(state);
        render();
    }

    function renderStepResult(state,steps,step){
        const result=state.stepResult;
        return salvoFrame(state,steps,"SALWA TRAFIA W CEL",result?.message||STEP_LABELS[step],`<div class="spx-gambit-step-success"><i>♠</i><strong>${escapeHtml(result?.message||"")}</strong><p>${escapeHtml(result?.detail||"")}</p></div>`,`<button type="button" class="spx-gambit-primary" data-gambit-next-step>DALEJ</button>`);
    }

    function advanceStep(){
        const state=getState();
        if(!state||state.phase!=="salvo") return;
        state.stepIndex+=1;
        state.stepResult=null;
        state.pending={};
        persist(state);
        render();
    }

    function withTransaction(label,callback){
        const tx=global.DraftFoundation?.beginTransaction?.(`gambit_${label}`,{playerName:activePlayerName,powerId:POWER_ID});
        if(!tx?.ok) return {ok:false,reason:tx?.reason||"Inne rozstrzygnięcie blokuje Salwę."};
        try{
            const result=callback();
            if(result?.ok===false) throw new Error(result.reason||result.message||"Operacja została odrzucona.");
            global.DraftFoundation?.commitTransaction?.(tx.transactionId,{powerId:POWER_ID,step:label});
            return {ok:true,result};
        }catch(error){
            global.DraftFoundation?.rollbackTransaction?.(tx.transactionId,{powerId:POWER_ID,step:label,message:error.message});
            global.showDecks?.();global.showPack?.(false);global.updateRoundQueueDisplay?.();
            return {ok:false,reason:error.message||"Salwa została bezpiecznie cofnięta."};
        }
    }

    function renderSelfReroll(state,steps){
        const ctx=context();
        const deck=ctx?.decks?.[state.playerIndex]||[];
        const sourceId=state.pending?.selfSourceId;
        const options=state.pending?.replacementOptions||[];
        if(sourceId&&options.length){
            const source=deck.find(card=>card?.instanceId===sourceId);
            return salvoFrame(state,steps,"KINETYCZNA ISKRA",`Wybierz jedną z dwóch kart, która zastąpi ${source?.name||"wskazaną kartę"}.`,`<div class="spx-gambit-card-grid">${options.map(card=>cardTile(card,`data-gambit-self-replacement="${escapeHtml(card.instanceId)}"`)).join("")}</div>`,`<button type="button" class="spx-gambit-secondary" data-gambit-reset-choice>ZMIEŃ KARTĘ</button>`);
        }
        const entries=legalSelfRerollEntries(state.playerIndex);
        return salvoFrame(state,steps,"KINETYCZNA ISKRA","Wskaż własną kartę do gwarantowanego przelosowania 1:1.",`<div class="spx-gambit-card-grid">${entries.map(entry=>cardTile(entry,`data-gambit-self-source="${escapeHtml(entry.card.instanceId)}"`)).join("")}</div>`);
    }

    function selectSelfSource(instanceId){
        const state=getState();
        const deck=context()?.decks?.[state.playerIndex]||[];
        const index=deck.findIndex(card=>card?.instanceId===instanceId);
        if(index<0||!canReplaceOwnCard(deck[index],index,"reroll")) return showWarning("ISKRA ZGASŁA","Ta karta nie może już zostać przelosowana.");
        const options=createReplacementOptions(deck,index,"gambit_self_reroll_options");
        if(options.length<2) return showWarning("BRAK DWÓCH ŚCIEŻEK","Pula nie ma dwóch zamienników dla tej karty.");
        state.pending={selfSourceId:instanceId,replacementOptions:options};
        persist(state);render();
    }

    function commitSelfReroll(replacementId){
        const state=getState();
        const ctx=context();
        const deck=ctx?.decks?.[state.playerIndex]||[];
        const index=deck.findIndex(card=>card?.instanceId===state.pending?.selfSourceId);
        const replacement=(state.pending?.replacementOptions||[]).find(card=>card?.instanceId===replacementId);
        if(index<0||!replacement) return showWarning("ISKRA ZGASŁA","Wybór nie jest już aktualny.");
        const result=withTransaction("self_reroll",()=>global.DraftFoundation.replaceCardInArray({container:deck,index,replacement,preserveReplacementInstance:true,zone:"deck",powerId:POWER_ID,eventType:"gambit_self_reroll",reason:"gambit_kinetic_spark",graveyardCategory:"rerolled",previousOwner:state.playerIndex,recoverable:true}));
        if(!result.ok) return showError("ISKRA ODBIŁA",result.reason);
        const mutation=result.result;
        addLog(state,"self_reroll",{removedCard:mutation.sourceCard?.name,replacementCard:mutation.replacementCard?.name});
        state.finalSummary.push(`Iskra: ${mutation.sourceCard?.name} → ${mutation.replacementCard?.name}`);
        global.showDecks?.();
        finishStep(state,"self_reroll","Własna karta została przelosowana.",`${mutation.sourceCard?.name} ustępuje miejsca karcie ${mutation.replacementCard?.name}.`);
    }

    function renderTarget(state,steps){
        const players=legalTargets(state.playerIndex,state.rewardCharge);
        return salvoFrame(state,steps,"CEL SALWY KINETYCZNEJ","Wszystkie ofensywne uderzenia tej salwy trafią w jednego przeciwnika.",`<div class="spx-gambit-target-grid">${players.map(player=>`<button type="button" data-gambit-target="${player.index}"><span>♠</span><strong>${escapeHtml(player.name)}</strong><small>${legalTargetEntries(state.playerIndex,player.index).length} celów • ${legalRoyalEntries(state.playerIndex,player.index).length} królewskich</small></button>`).join("")}</div>`);
    }

    function selectTarget(targetIndex){
        const state=getState();
        const target=legalTargets(state.playerIndex,state.rewardCharge).find(player=>player.index===Number(targetIndex));
        if(!target) return showWarning("CEL POZA ZASIĘGIEM","Ten przeciwnik nie spełnia już warunków pełnej Salwy.");
        state.targetPlayerIndex=target.index;
        addLog(state,"target_selected",{targetPlayerIndex:target.index,targetPlayerName:target.name});
        finishStep(state,"target","Cel Salwy został zablokowany.",`${target.name} pozostaje celem wszystkich ofensywnych efektów Gambita.`);
    }

    function renderDisruption(state,steps){
        const ctx=context();
        const targetDeck=ctx?.decks?.[state.targetPlayerIndex]||[];
        const sourceId=state.pending?.disruptionSourceId;
        const options=state.pending?.replacementOptions||[];
        if(sourceId&&options.length){
            const source=targetDeck.find(card=>card?.instanceId===sourceId);
            return salvoFrame(state,steps,"ZAKŁÓCENIE KINETYCZNE",`${ctx.players[state.targetPlayerIndex]} wybiera zamiennik za kartę ${source?.name||"cel"}.`,`<div class="spx-gambit-card-grid">${options.map(card=>cardTile(card,`data-gambit-disruption-replacement="${escapeHtml(card.instanceId)}"`)).join("")}</div>`);
        }
        const entries=legalTargetEntries(state.playerIndex,state.targetPlayerIndex,"reroll");
        return salvoFrame(state,steps,"ZAKŁÓCENIE KINETYCZNE",`Gambit wskazuje jedną kartę z decku gracza ${ctx?.players?.[state.targetPlayerIndex]||"celu"}.`,`<div class="spx-gambit-card-grid">${entries.map(entry=>cardTile(entry,`data-gambit-disruption-source="${escapeHtml(entry.card.instanceId)}"`)).join("")}</div>`);
    }

    function selectDisruptionSource(instanceId){
        const state=getState();
        const deck=context()?.decks?.[state.targetPlayerIndex]||[];
        const index=deck.findIndex(card=>card?.instanceId===instanceId);
        if(index<0||!legalTargetEntries(state.playerIndex,state.targetPlayerIndex,"reroll").some(entry=>entry.index===index)) return showWarning("CEL ODBIŁ SALWĘ","Ta karta jest chroniona albo zmieniła miejsce.");
        const options=createReplacementOptions(deck,index,"gambit_target_disruption_options");
        if(options.length<2) return showWarning("BRAK ZAMIENNIKÓW","Nie udało się przygotować dwóch kart dla przeciwnika.");
        state.pending={disruptionSourceId:instanceId,replacementOptions:options};
        persist(state);render();
    }

    function commitDisruption(replacementId){
        const state=getState();
        const ctx=context();
        const deck=ctx?.decks?.[state.targetPlayerIndex]||[];
        const index=deck.findIndex(card=>card?.instanceId===state.pending?.disruptionSourceId);
        const replacement=(state.pending?.replacementOptions||[]).find(card=>card?.instanceId===replacementId);
        if(index<0||!replacement) return showWarning("SALWA STRACIŁA CEL","Wybór nie jest już aktualny.");
        const result=withTransaction("target_disruption",()=>global.DraftFoundation.replaceCardInArray({container:deck,index,replacement,preserveReplacementInstance:true,zone:"deck",powerId:POWER_ID,eventType:"gambit_target_disruption",reason:"gambit_kinetic_disruption",graveyardCategory:"replaced",previousOwner:state.targetPlayerIndex,recoverable:true}));
        if(!result.ok) return showError("ZAKŁÓCENIE COFNIĘTE",result.reason);
        const mutation=result.result;
        const counter=global.DraftFoundation.resolveCaptainAmericaCounterattack?.({attackerPlayerIndex:state.playerIndex,defenderPlayerIndex:state.targetPlayerIndex,defenderCardIndex:index,defenderCardName:mutation.sourceCard?.name,event:"gambit_target_disruption"});
        if(counter?.triggered) global.SuperpowerUI?.playCaptainAmericaCounters?.([counter]);
        addLog(state,"enemy_disruption",{targetPlayerIndex:state.targetPlayerIndex,removedCard:mutation.sourceCard?.name,replacementCard:mutation.replacementCard?.name,captainCounter:Boolean(counter?.triggered)});
        state.finalSummary.push(`Zakłócenie: ${mutation.sourceCard?.name} → ${mutation.replacementCard?.name}`);
        global.showDecks?.();
        finishStep(state,"disruption","Synergia przeciwnika została zakłócona.",`${ctx.players[state.targetPlayerIndex]} wybrał ${mutation.replacementCard?.name} w miejsce ${mutation.sourceCard?.name}.`);
    }

    function renderQueueStep(state,steps,step){
        const targetName=context()?.players?.[step==="target_delay"?state.targetPlayerIndex:state.playerIndex]||"gracza";
        const copy=step==="target_delay"?`Najbliższy przyszły pick gracza ${targetName} spróbuje przesunąć się o jedno miejsce później.`:`Najbliższy przyszły pick Gambita spróbuje przesunąć się o jedno miejsce wcześniej.`;
        return salvoFrame(state,steps,STEP_LABELS[step],copy,`<div class="spx-gambit-momentum"><span>◀</span><b>${escapeHtml(targetName)}</b><span>▶</span><p>Twarde wymuszenia i granice aktualnej paczki pozostają ważniejsze.</p></div>`,`<button type="button" class="spx-gambit-primary" data-gambit-queue-step="${step}">URUCHOM MOMENTUM</button>`);
    }

    function applyQueueStep(step){
        const state=getState();
        const playerIndex=step==="target_delay"?state.targetPlayerIndex:state.playerIndex;
        const direction=step==="target_delay"?1:-1;
        const result=global.DraftFoundation?.shiftGambitFuturePickByOne?.(playerIndex,direction,{actorPlayerIndex:state.playerIndex,reason:step==="target_delay"?"gambit_target_queue_delay":"gambit_self_queue_advance"})||{ok:false,reason:"Brak hooka kolejki."};
        if(!result.ok) return showError("MOMENTUM ZABLOKOWANE",result.reason);
        addLog(state,step==="target_delay"?"queue_delay":"self_queue_advance",{playerIndex,shifted:Boolean(result.shifted),from:result.from,to:result.to,reason:result.reason||null});
        const label=result.shifted?`Pick przesunięty: pozycja ${result.from+1} → ${result.to+1}.`:`Kolejka bez zmiany: ${result.reason}`;
        state.finalSummary.push(`${STEP_LABELS[step]}: ${label}`);
        finishStep(state,step,result.shifted?"Kinetyczne momentum zmieniło kolejkę.":"Momentum ustąpiło twardszym zasadom.",label);
    }

    function renderPackRicochet(state,steps){
        const entries=legalPackRicochetEntries(state.playerIndex);
        return salvoFrame(state,steps,"KINETYCZNY RYKOSZET","Wybierz kartę z aktualnej paczki. Trafi do Kinetycznej Puli, a paczka natychmiast otrzyma zamiennik.",`<div class="spx-gambit-card-grid">${entries.map(entry=>cardTile(entry,`data-gambit-pack-ricochet="${escapeHtml(entry.card.instanceId)}"`)).join("")}</div>`);
    }

    function commitPackRicochet(instanceId){
        const state=getState();
        const ctx=context();
        const entry=legalPackRicochetEntries(state.playerIndex).find(item=>item.card?.instanceId===instanceId);
        if(!entry) return showWarning("RYKOSZET NIELEGALNY","Ta karta jest chroniona albo paczka nie ma już nadwyżki.");
        const replacement=(global.DraftFoundation?.generateLegalRuntimeCards?.(1,{excludeCards:[...(ctx.currentPack||[]),...(ctx.decks||[]).flat()],origin:"gambit_pack_replacement",sourcePowerId:POWER_ID,sourceEvent:"gambit_pack_ricochet_replacement"})||[])[0];
        if(!replacement) return showWarning("PUSTA PACZKA ZAMIENNIKÓW","Nie znaleziono karty, która wypełni miejsce po rykoszecie.");
        const result=withTransaction("pack_ricochet",()=>{
            const bridge=global.GalacticCurrentSuperpowerBridge;
            const inCurrent=Boolean(bridge?.isModeEnabled?.());
            let moved=null;
            if(inCurrent){
                const live=bridge.getLiveCards?.()||[];
                const index=live.findIndex(card=>card?.instanceId===instanceId);
                if(index<0) return {ok:false,reason:"Karta opuściła już Gwiezdny Prąd."};
                const sourceCard=live[index];
                global.removeRocketBombWithCard?.(sourceCard,"gambit_pack_ricochet",{});
                replacement.instanceMeta={...(replacement.instanceMeta||{}),gambitRicochetReplacement:true,sourceCardInstanceId:sourceCard.instanceId||null};
                const swapped=bridge.replaceLiveCard?.(index,replacement,{source:"gambit_pack_ricochet",inheritFlowAge:true,render:false});
                if(!swapped?.ok) return swapped;
                const reserve=reserveHitCard(state,sourceCard,{source:"current",originalOwnerIndex:null,event:"gambit_pack_ricochet",replacementCardInstanceId:replacement.instanceId});
                if(!reserve) return {ok:false,reason:"Nie udało się zabezpieczyć trafionej karty w Kinetycznej Puli."};
                global.DraftFoundation?.resolvePackCardLifecycle?.("move",sourceCard,{fromZone:"galacticCurrent",toZone:RESERVE_ZONE,reason:"gambit_pack_ricochet",powerId:POWER_ID});
                moved={ok:true,card:sourceCard,index,entry:reserve};
            }else{
                moved=global.DraftFoundation.consumeCurrentPackSurplusCard({instanceId,zoneName:RESERVE_ZONE,ownerIndex:state.playerIndex,sourcePowerId:POWER_ID,sourceEvent:"gambit_pack_ricochet",preserveIllusion:true,metadata:{source:"pack",originalOwnerIndex:null}});
                if(!moved?.ok) return moved;
                replacement.instanceMeta={...(replacement.instanceMeta||{}),gambitRicochetReplacement:true,sourceCardInstanceId:moved.card?.instanceId||null};
                ctx.currentPack.splice(moved.index,0,replacement);
            }
            global.MysterioUI?.transferIllusion?.(moved.card,replacement,{reason:"gambit_pack_ricochet",targetPosition:moved.index});
            moved.entry.card.instanceMeta={...(moved.entry.card.instanceMeta||{}),gambitKineticReserve:true,gambitReserveSource:inCurrent?"current":"pack"};
            global.DraftStateEngine?.log?.("gambit_pack_replaced",{packNumber:ctx.packStartIndex+1,pickIndex:ctx.currentPickIndex,playerIndex:state.playerIndex,sourceCard:moved.card,resultCard:replacement,reason:"gambit_pack_ricochet",data:{runtimeEntryId:moved.entry.runtimeEntryId,powerId:POWER_ID,galacticCurrent:inCurrent}});
            return {ok:true,moved,replacement};
        });
        if(!result.ok) return showError("RYKOSZET COFNIĘTY",result.reason);
        const moved=result.result.moved;
        state.reserveEntryIds.push(moved.entry.runtimeEntryId);
        addLog(state,"pack_ricochet",{card:moved.card?.name,replacement:replacement.name,runtimeEntryId:moved.entry.runtimeEntryId});
        state.finalSummary.push(`Rykoszet paczki: ${moved.card?.name} trafia do Kinetycznej Puli; ${replacement.name} wchodzi do paczki.`);
        if(global.GalacticCurrentSuperpowerBridge?.isModeEnabled?.()) global.GalacticCurrent?.refresh?.();
        else global.showPack?.(false);
        playCardBurst(state.rewardCharge);
        finishStep(state,"pack_ricochet","Karta odbiła do Kinetycznej Puli.",`${moved.card?.name} czeka w Puli, a ${replacement.name} uzupełnia paczkę.`);
    }

    function prepareRoyalCandidates(state){
        if(Array.isArray(state.pending?.royalCandidateIds)&&state.pending.royalCandidateIds.length) return;
        const candidates=shuffled(legalRoyalEntries(state.playerIndex,state.targetPlayerIndex)).slice(0,3);
        state.pending={royalCandidateIds:candidates.map(entry=>entry.card.instanceId)};
        persist(state);
    }

    function renderRoyalRicochet(state,steps){
        prepareRoyalCandidates(state);
        const ctx=context();
        const deck=ctx?.decks?.[state.targetPlayerIndex]||[];
        const sourceId=state.pending?.royalSourceId;
        const options=state.pending?.replacementOptions||[];
        if(sourceId&&options.length){
            const source=deck.find(card=>card?.instanceId===sourceId);
            return salvoFrame(state,steps,"KRÓLEWSKI RYKOSZET",`${ctx.players[state.targetPlayerIndex]} wybiera zamiennik za kartę wybitą do Kinetycznej Puli: ${source?.name||"cel"}.`,`<div class="spx-gambit-card-grid">${options.map(card=>cardTile(card,`data-gambit-royal-replacement="${escapeHtml(card.instanceId)}"`)).join("")}</div>`);
        }
        const entries=(state.pending?.royalCandidateIds||[]).map(id=>{const index=deck.findIndex(card=>card?.instanceId===id);return index>=0?{card:deck[index],index}:null;}).filter(Boolean);
        return salvoFrame(state,steps,"KRÓLEWSKI RYKOSZET","Kasyno odsłania trzy karty celu. Gambit wybiera jedną i wybija ją do Kinetycznej Puli.",`<div class="spx-gambit-card-grid is-royal">${entries.map(entry=>cardTile(entry,`data-gambit-royal-source="${escapeHtml(entry.card.instanceId)}"`)).join("")}</div>`);
    }

    function selectRoyalSource(instanceId){
        const state=getState();
        if(!(state.pending?.royalCandidateIds||[]).includes(instanceId)) return showWarning("KRÓLEWSKI RYKOSZET CHYBIŁ","Ta karta nie należy już do wylosowanej trójki.");
        const deck=context()?.decks?.[state.targetPlayerIndex]||[];
        const index=deck.findIndex(card=>card?.instanceId===instanceId);
        if(index<0) return showWarning("CEL ZNIKNĄŁ","Karta nie znajduje się już w decku celu.");
        const options=createReplacementOptions(deck,index,"gambit_royal_victim_options");
        if(options.length<2) return showWarning("BRAK ZAMIENNIKÓW","Nie udało się przygotować dwóch kart dla celu.");
        state.pending={...state.pending,royalSourceId:instanceId,replacementOptions:options};
        persist(state);render();
    }

    function commitRoyalRicochet(replacementId){
        const state=getState();
        const ctx=context();
        const deck=ctx?.decks?.[state.targetPlayerIndex]||[];
        const index=deck.findIndex(card=>card?.instanceId===state.pending?.royalSourceId);
        const replacement=(state.pending?.replacementOptions||[]).find(card=>card?.instanceId===replacementId);
        if(index<0||!replacement) return showWarning("KRÓLEWSKI RYKOSZET CHYBIŁ","Wybór nie jest już aktualny.");
        const original=deck[index];
        const result=withTransaction("royal_ricochet",()=>{
            deck[index]=replacement;
            original.instanceMeta={...(original.instanceMeta||{}),gambitKineticReserve:true,gambitReserveSource:"royal",gambitOriginalOwnerIndex:state.targetPlayerIndex};
            const reserve=global.DraftFoundation.addCardToRuntimeZone(RESERVE_ZONE,original,{ownerIndex:state.playerIndex,sourcePowerId:POWER_ID,sourceEvent:"gambit_royal_ricochet",metadata:{source:"royal",originalOwnerIndex:state.targetPlayerIndex,replacementCardInstanceId:replacement.instanceId}});
            if(!reserve) return {ok:false,reason:"Nie udało się otworzyć Kinetycznej Puli."};
            global.DraftStateEngine?.log?.("gambit_royal_target_replaced",{packNumber:ctx.packStartIndex+1,pickIndex:ctx.currentPickIndex,playerIndex:state.targetPlayerIndex,sourceCard:original,resultCard:replacement,reason:"gambit_royal_ricochet",data:{runtimeEntryId:reserve.runtimeEntryId,attackerPlayerIndex:state.playerIndex,powerId:POWER_ID}});
            return {ok:true,reserve};
        });
        if(!result.ok) return showError("KRÓLEWSKI RYKOSZET COFNIĘTY",result.reason);
        const reserve=result.result.reserve;
        state.reserveEntryIds.push(reserve.runtimeEntryId);
        global.DevilDinoUI?.notifyHostileDeckChange?.({targetPlayerIndex:state.targetPlayerIndex,targetCardInstanceId:replacement.instanceId,previousCardInstanceId:original.instanceId,previousCardName:original.name,sourcePowerId:POWER_ID,sourceEvent:"gambit_royal_ricochet",mutationId:reserve.runtimeEntryId});
        const counter=global.DraftFoundation.resolveCaptainAmericaCounterattack?.({attackerPlayerIndex:state.playerIndex,defenderPlayerIndex:state.targetPlayerIndex,defenderCardIndex:index,defenderCardName:original.name,event:"gambit_royal_ricochet"});
        if(counter?.triggered) global.SuperpowerUI?.playCaptainAmericaCounters?.([counter]);
        addLog(state,"royal_ricochet",{targetPlayerIndex:state.targetPlayerIndex,card:original.name,replacement:replacement.name,runtimeEntryId:reserve.runtimeEntryId,captainCounter:Boolean(counter?.triggered)});
        state.finalSummary.push(`Królewski Rykoszet: ${original.name} trafia do Kinetycznej Puli; ${replacement.name} odbudowuje deck celu.`);
        global.showDecks?.();playCardBurst(5);
        finishStep(state,"royal_ricochet","Królewski Rykoszet trafił.",`${original.name} czeka w Puli, a przeciwnik wybrał ${replacement.name}.`);
    }

    function getReserveEntries(state){
        return (state.reserveEntryIds||[]).map(id=>global.DraftFoundation?.getRuntimeZoneEntry?.(RESERVE_ZONE,id)).filter(Boolean);
    }

    function renderChooseLoot(state,steps){
        const entries=getReserveEntries(state);
        return salvoFrame(state,steps,"WYBIERZ SWÓJ ŁUP","Kinetyczna Pula nie daje darmowej karty. Wybierz dokładnie jeden Łup do finałowej wymiany 1:1.",`<div class="spx-gambit-card-grid is-loot">${entries.map(entry=>cardTile(entry.card,`data-gambit-loot="${escapeHtml(entry.runtimeEntryId)}"`,"is-reserve")).join("")}</div>`);
    }

    function chooseLoot(entryId){
        const state=getState();
        const entry=getReserveEntries(state).find(item=>item.runtimeEntryId===entryId);
        if(!entry) return showWarning("ŁUP ODBIŁ W CIEMNOŚĆ","Karta nie znajduje się już w Kinetycznej Puli.");
        state.chosenLootEntryId=entryId;
        addLog(state,"loot_chosen",{runtimeEntryId:entryId,card:entry.card?.name});
        finishStep(state,"choose_loot","Gambit zatrzymuje jeden Łup.",`${entry.card?.name} zostanie wymieniony 1:1 za własną kartę.`);
    }

    function legalFinalSwapEntries(state,incomingCard){
        const deck=context()?.decks?.[state.playerIndex]||[];
        const incomingName=normalize(incomingCard?.name);
        return deck.map((card,index)=>({card,index})).filter(entry=>{
            if(!canReplaceOwnCard(entry.card,entry.index,"replace")) return false;
            return !deck.some((other,otherIndex)=>otherIndex!==entry.index&&normalize(other?.name)===incomingName);
        });
    }

    function renderFinalSwap(state,steps){
        const entry=global.DraftFoundation?.getRuntimeZoneEntry?.(RESERVE_ZONE,state.chosenLootEntryId);
        const outgoing=legalFinalSwapEntries(state,entry?.card);
        return salvoFrame(state,steps,"FINAŁOWA WYMIANA 1:1",`${entry?.card?.name||"Wybrany Łup"} zajmie miejsce jednej karty Gambita.`,`<div class="spx-gambit-final-swap"><div>${entry?cardTile(entry.card,"disabled","is-reserve"):""}</div><b>⇄</b><div class="spx-gambit-card-grid">${outgoing.map(item=>cardTile(item,`data-gambit-final-source="${escapeHtml(item.card.instanceId)}"`)).join("")}</div></div>`);
    }

    function commitFinalSwap(sourceInstanceId){
        const state=getState();
        const ctx=context();
        const chosen=global.DraftFoundation?.getRuntimeZoneEntry?.(RESERVE_ZONE,state.chosenLootEntryId);
        if(!chosen) return showWarning("KINETYCZNA PULA JEST PUSTA","Wybrany Łup nie jest już dostępny.");
        const deck=ctx?.decks?.[state.playerIndex]||[];
        const sourceIndex=deck.findIndex(card=>card?.instanceId===sourceInstanceId);
        if(!legalFinalSwapEntries(state,chosen.card).some(item=>item.index===sourceIndex)) return showWarning("WYMIANA ZABLOKOWANA","Ta karta nie może już opuścić decku Gambita.");
        const reserveBefore=getReserveEntries(state);
        const result=withTransaction("final_swap",()=>{
            const released=global.DraftFoundation.removeCardFromRuntimeZone(RESERVE_ZONE,chosen.runtimeEntryId,{nextZone:"deck",reason:"gambit_loot_claimed",zoneContext:{playerIndex:state.playerIndex}});
            if(!released) return {ok:false,reason:"Nie udało się wyjąć Łupu z Kinetycznej Puli."};
            const acquired=global.DraftFoundation.acquireCardToDeck({playerIndex:state.playerIndex,sourceCard:released.card,sourceZone:RESERVE_ZONE,preserveInstance:true,replacementIndex:sourceIndex,archivePrevious:true,graveyardCategory:"replaced",reason:"gambit_final_swap",eventType:"gambit_final_swap",powerId:POWER_ID,recoverable:true,acquisitionType:"kinetic_loot"});
            if(!acquired?.ok) return acquired;
            reserveBefore.filter(entry=>entry.runtimeEntryId!==chosen.runtimeEntryId).forEach(entry=>{
                const discarded=global.DraftFoundation.removeCardFromRuntimeZone(RESERVE_ZONE,entry.runtimeEntryId,{nextZone:"graveyard",reason:"gambit_unchosen_reserve",zoneContext:{powerId:POWER_ID}});
                if(!discarded) return;
                global.DraftFoundation.resolvePackCardLifecycle?.("move",discarded.card,{fromZone:RESERVE_ZONE,toZone:"graveyard",reason:"gambit_unchosen_reserve",powerId:POWER_ID});
                global.removeRocketBombWithCard?.(discarded.card,"gambit_unchosen_reserve",{replacementPowerId:POWER_ID});
                global.DraftFoundation.archiveCardToGraveyard("replaced",discarded.card,{previousOwner:Number.isInteger(Number(discarded.metadata?.originalOwnerIndex))?Number(discarded.metadata.originalOwnerIndex):null,source:"gambit_unchosen_reserve",powerId:POWER_ID,recoverable:true,skipGrootHarvest:true});
            });
            return {ok:true,acquired};
        });
        if(!result.ok) return showError("FINAŁOWY RYKOSZET COFNIĘTY",result.reason);
        const acquired=result.result.acquired;
        state.reserveEntryIds=[];
        addLog(state,"final_swap",{loot:acquired.resultCard?.name,removedCard:acquired.previousCard?.name,deckSize:deck.length});
        state.finalSummary.push(`Łup: ${acquired.resultCard?.name} zastępuje ${acquired.previousCard?.name}.`);
        global.showDecks?.();global.GraveyardUI?.refreshButton?.();
        finishStep(state,"final_swap","Łup trafił do decku Gambita.",`${acquired.resultCard?.name} zastąpił kartę ${acquired.previousCard?.name}. Deck zachował rozmiar ${deck.length}.`);
        if(acquired.rocketResult?.triggered){
            const root=ensureInterface();root.hidden=true;
            global.SuperpowerUI?.resolveRocketBomb?.(acquired.rocketResult,()=>{root.hidden=false;render();});
        }
    }

    function finishToSummary(state){
        state.phase="summary";
        state.stepResult=null;
        state.pending={};
        addLog(state,"completed",{finalCharge:state.rewardCharge,endReason:state.endReason,deckSize:context()?.decks?.[state.playerIndex]?.length||0});
        persist(state);render();
        global.setTimeout?.(()=>playCardBurst(state.rewardCharge),reducedMotion()?20:120);
    }

    function renderSummary(state){
        const reason=state.endReason==="jackpot"?"JACKPOT":state.endReason==="bust"?"PRZECIĄŻENIE":"ODEBRANA WYGRANA";
        const reasonLabel=reason==="jackpot"?"GŁÓWNA WYGRANA":reason==="cash_out"?"ODEBRANA WYGRANA":"KONIEC SALWY";
        return `<div class="spx-gambit-summary"><span>GAMBIT // ${reasonLabel}</span><h1 id="spxGambitTitle">SALWA ROZLICZONA</h1><div class="spx-gambit-summary-charge">${state.rewardCharge}<small>KOŃCOWY ŁADUNEK</small></div><ul>${(state.finalSummary||[]).map(line=>`<li>${escapeHtml(line)}</li>`).join("")}</ul><button type="button" class="spx-gambit-primary" data-gambit-close>WRÓĆ DO DRAFTU</button></div>`;
    }

    function closeSummary(){
        const state=getState();
        if(!state||closing||!(state.phase==="summary"||state.phase==="aftermath")) return;
        const profile=state.rewardProfile||rewardProfileForCharge(state.rewardCharge);
        if(state.phase==="aftermath"&&profile.selfReroll&&!state.selfRerollResolved){
            showWarning("WYBUCH CZEKA NA DECYZJĘ","Najpierw dokończ kontrolowane przelosowanie na Ładunku 0.");
            return;
        }
        if(state.phase==="aftermath"&&profile.lootSlots>0&&!state.lootResolved){
            showWarning("KINETYCZNA PULA CZEKA NA DECYZJĘ","Odbierz wybrany Łup albo pozostaw wszystkie karty na Cmentarzysku.");
            return;
        }
        closing=true;
        const root=ensureInterface();
        root.classList.add("is-closing");
        playCardBurst(state.rewardCharge);
        global.setTimeout?.(()=>{
            const live=getState()||state;
            live.active=false;
            live.completed=true;
            live.phase="complete";
            live.pending={};
            live.reserveEntryIds=[];
            persist(live);
            root.hidden=true;
            root.classList.remove("is-closing","is-board-phase","is-aftermath-phase");
            document.body?.classList?.remove("spx-gambit-active");
            activePlayerName="";
            closing=false;
            global.showDecks?.();global.showPack?.(false);global.updateRoundQueueDisplay?.();global.GraveyardUI?.refreshButton?.();
            global.DraftTurnTimer?.sync?.();
        },reducedMotion()?120:620);
    }

    function renderSalvo(state){
        const root=ensureInterface();
        const content=root.querySelector("#spxGambitContent");
        const steps=rewardStepsForCharge(state.rewardCharge);
        if(state.stepIndex>=steps.length){finishToSummary(state);return;}
        const step=steps[state.stepIndex];
        if(state.stepResult?.step===step){content.innerHTML=renderStepResult(state,steps,step);content.querySelector("[data-gambit-next-step]")?.addEventListener("click",advanceStep);return;}
        if(step==="self_reroll") content.innerHTML=renderSelfReroll(state,steps);
        if(step==="target") content.innerHTML=renderTarget(state,steps);
        if(step==="disruption") content.innerHTML=renderDisruption(state,steps);
        if(step==="target_delay"||step==="self_advance") content.innerHTML=renderQueueStep(state,steps,step);
        if(step==="pack_ricochet") content.innerHTML=renderPackRicochet(state,steps);
        if(step==="royal_ricochet") content.innerHTML=renderRoyalRicochet(state,steps);
        if(step==="choose_loot") content.innerHTML=renderChooseLoot(state,steps);
        if(step==="final_swap") content.innerHTML=renderFinalSwap(state,steps);
        content.querySelectorAll("[data-gambit-self-source]").forEach(button=>button.addEventListener("click",()=>selectSelfSource(button.dataset.gambitSelfSource)));
        content.querySelectorAll("[data-gambit-self-replacement]").forEach(button=>button.addEventListener("click",()=>commitSelfReroll(button.dataset.gambitSelfReplacement)));
        content.querySelector("[data-gambit-reset-choice]")?.addEventListener("click",()=>{state.pending={};persist(state);render();});
        content.querySelectorAll("[data-gambit-target]").forEach(button=>button.addEventListener("click",()=>selectTarget(Number(button.dataset.gambitTarget))));
        content.querySelectorAll("[data-gambit-disruption-source]").forEach(button=>button.addEventListener("click",()=>selectDisruptionSource(button.dataset.gambitDisruptionSource)));
        content.querySelectorAll("[data-gambit-disruption-replacement]").forEach(button=>button.addEventListener("click",()=>commitDisruption(button.dataset.gambitDisruptionReplacement)));
        content.querySelector("[data-gambit-queue-step]")?.addEventListener("click",event=>applyQueueStep(event.currentTarget.dataset.gambitQueueStep));
        content.querySelectorAll("[data-gambit-pack-ricochet]").forEach(button=>button.addEventListener("click",()=>commitPackRicochet(button.dataset.gambitPackRicochet)));
        content.querySelectorAll("[data-gambit-royal-source]").forEach(button=>button.addEventListener("click",()=>selectRoyalSource(button.dataset.gambitRoyalSource)));
        content.querySelectorAll("[data-gambit-royal-replacement]").forEach(button=>button.addEventListener("click",()=>commitRoyalRicochet(button.dataset.gambitRoyalReplacement)));
        content.querySelectorAll("[data-gambit-loot]").forEach(button=>button.addEventListener("click",()=>chooseLoot(button.dataset.gambitLoot)));
        content.querySelectorAll("[data-gambit-final-source]").forEach(button=>button.addEventListener("click",()=>commitFinalSwap(button.dataset.gambitFinalSource)));
    }

    function render(){
        const state=getState();
        const root=ensureInterface();
        if(!state?.active){root.hidden=true;document.body?.classList?.remove("spx-gambit-active");return;}
        root.hidden=false;
        document.body.classList.add("spx-gambit-active");
        const boardPhase=state.phase==="prize"||state.phase==="unleash";
        root.classList.toggle("is-board-phase",boardPhase);
        root.classList.toggle("is-aftermath-phase",state.phase==="aftermath");
        if(state.phase==="casino") renderCasino(state);
        else if(state.phase==="prize"){
            root.querySelector("#spxGambitContent").innerHTML=renderPrize(state);
            scheduleUnleash(state);
        }
        else if(state.phase==="unleash"){
            root.querySelector("#spxGambitContent").innerHTML=renderUnleash(state);
        }
        else if(state.phase==="aftermath"){
            root.querySelector("#spxGambitContent").innerHTML=renderAftermath(state);
            root.querySelectorAll("[data-gambit-zero-source]").forEach(button=>button.addEventListener("click",()=>selectZeroRerollSource(button.dataset.gambitZeroSource)));
            root.querySelectorAll("[data-gambit-zero-replacement]").forEach(button=>button.addEventListener("click",()=>commitZeroReroll(button.dataset.gambitZeroReplacement)));
            root.querySelector("[data-gambit-zero-reset]")?.addEventListener("click",()=>{state.pending={};persist(state);render();});
            root.querySelectorAll("[data-gambit-aftermath-loot]").forEach(button=>button.addEventListener("click",()=>toggleLoot(button.dataset.gambitAftermathLoot)));
            root.querySelector("[data-gambit-resolve-loot]")?.addEventListener("click",resolveLootSelection);
            root.querySelector("[data-gambit-close]")?.addEventListener("click",closeSummary);
        }
        else if(state.phase==="salvo") renderSalvo(state);
        else if(state.phase==="summary"){
            root.querySelector("#spxGambitContent").innerHTML=renderSummary(state);
            root.querySelector("[data-gambit-close]")?.addEventListener("click",closeSummary);
        }
        global.DraftTurnTimer?.sync?.();
    }

    function start(playerName){
        const check=global.SuperpowerEngine?.canActivate?.(playerName,POWER_ID);
        if(!check?.ok){showWarning("KASYNO JEST ZAMKNIĘTE",check?.reason||"Gambit wykorzystał już swoją szansę.");return false;}
        if(global.SuperpowerUI?.isBusy?.()||global.JokerV2UI?.isBusy?.()||global.GraveyardUI?.isOpen?.()){
            showWarning("STÓŁ JEST ZAJĘTY","Najpierw dokończ aktywne rozstrzygnięcie i zamknij Cmentarzysko.");return false;
        }
        const eligibility=preflight(playerName);
        if(!eligibility.ok){showWarning("GAMBIT CZEKA NA LEPSZY UKŁAD",eligibility.reason);return false;}
        const firstCard=drawCasinoCard();
        if(!firstCard){showError("KASYNO NIECZYNNE","Globalna pula nie ma karty, od której można rozpocząć grę.");return false;}
        const engine=global.SuperpowerEngine.completeActivation?.(playerName,POWER_ID,{status:"in_progress",packNumber:Number(context()?.packStartIndex||0)+1,pickIndex:Number(context()?.currentPickIndex||0)});
        if(engine?.ok===false){showError("KASYNO ODRZUCIŁO ŻETON",engine.reason||"Silnik odrzucił aktywację.");return false;}
        activePlayerName=playerName;
        const state=createState(playerName,eligibility.playerIndex,firstCard);
        addLog(state,"activated",{currentCard:firstCard.name,currentPower:firstCard.power});
        persist(state);
        render();
        return true;
    }

    function afterRestore(){
        const names=Object.keys(global.draftSuperpowers||{});
        const owner=names.find(name=>assignment(name)?.data?.gambit?.active);
        if(!owner) return false;
        activePlayerName=owner;
        rolling=false;
        salvoRunning=false;
        render();
        const state=getState();
        if(state?.phase==="prize") scheduleUnleash(state);
        if(state?.phase==="unleash"){
            playFinalSalvo(state.rewardCharge);
            global.setTimeout?.(executeUnleash,reducedMotion()?160:1550);
        }
        return true;
    }

    function reset(){
        global.clearTimeout?.(rollTimer);
        global.clearTimeout?.(phaseTimer);
        global.clearTimeout?.(burstTimer);
        burstTimer=0;
        rolling=false;
        salvoRunning=false;
        closing=false;
        activePlayerName="";
        const root=document.getElementById("spxGambitRoot");
        if(root) root.hidden=true;
        document.body?.classList?.remove("spx-gambit-active");
    }

    global.GambitUI=Object.freeze({
        VERSION,
        start,
        afterRestore,
        isBusy:()=>Boolean(getState()?.active),
        getLockReason:()=>getState()?.active?"Dokończ zakład Wyżej/Niżej i rozlicz pełną salwę kinetyczną Gambita.":"",
        getStatus:playerName=>clone(assignment(playerName)?.data?.gambit||null),
        reset,
        __test:Object.freeze({evaluatePrediction,applyRollResult,rewardStepsForCharge,rewardProfileForCharge,prizeCopy})
    });
})(window);
