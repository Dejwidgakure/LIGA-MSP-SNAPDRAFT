(function(global){
    "use strict";

    const POWER_ID="collector";
    const MAX_FINAL_SWAPS=8;
    let adapter=null;
    const collectors=new Map();
    let overlayState={type:null,playerName:null};
    let finishCallback=null;
    let finishQueue=[];
    let activationRetryTimer=null;

    function clone(value){
        if(value===undefined) return undefined;
        try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}
    }
    function esc(value){
        return String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
    }
    function playerList(){return adapter?.getPlayers?.()||global.players||[];}
    function decks(){return adapter?.getDecks?.()||global.decks||[];}
    function getAssignment(playerName){
        return adapter?.getAssignment?.(playerName)||global.getSuperpowerRuntimeAssignment?.(playerName)||null;
    }
    function collectorState(playerName,create=false){
        const key=String(playerName||"");
        if(!key) return null;
        let state=collectors.get(key)||null;
        if(!state&&create){
            state={
                playerName:key,
                playerIndex:playerList().indexOf(key),
                activated:false,
                activationPrompted:false,
                collection:[],
                entrySequence:0,
                finalizing:false,
                finalized:false,
                swapsUsed:0,
                selectedEntryId:null,
                initialDeck:null,
                initialCollection:null,
                capturedCount:0
            };
            collectors.set(key,state);
        }
        return state;
    }
    function getAssignedCollectorNames(){
        return playerList().filter(name=>getAssignment(name)?.powerId===POWER_ID);
    }
    function getActivatedCollectors(){
        return getAssignedCollectorNames()
            .map(name=>collectorState(name,true))
            .filter(state=>state?.activated&&!state.finalized);
    }
    function ownerForCapture(){
        const active=getActivatedCollectors();
        if(!active.length) return null;
        if(active.length>1){
            // W standardowym przydziale moce nie powtarzają się przed wyczerpaniem puli.
            // Jeśli jednak operator ręcznie stworzy 2× Collector, oryginalna instancja
            // może należeć tylko do jednej Collection — deterministycznie bierze ją
            // Collector o niższym indeksie gracza.
            active.sort((a,b)=>a.playerIndex-b.playerIndex);
        }
        return active[0];
    }
    function makeEntry(state,card,sourceType,context={}){
        state.entrySequence+=1;
        return {
            entryId:`collector-${state.playerIndex}-${state.entrySequence}`,
            card,
            sourceType:String(sourceType||"packResidue"),
            packNumber:Number(context.packNumber)||null,
            packId:context.packId||null,
            packIndex:Number.isInteger(Number(context.packIndex))?Number(context.packIndex):null,
            sourceJokerInstanceId:context.sourceJokerInstanceId||null,
            capturedAt:Date.now(),
            metadata:clone(context.metadata||{})
        };
    }
    function log(event,state,entry=null,data={}){
        try{
            global.DraftStateEngine?.log?.(event,{
                packNumber:Number(entry?.packNumber)||Number(adapter?.getPackNumber?.())||null,
                pickIndex:Number(adapter?.getPickIndex?.())||0,
                playerIndex:state?.playerIndex??null,
                player:state?.playerName||null,
                sourceCard:entry?.card||null,
                reason:POWER_ID,
                data:{
                    collectionEntryId:entry?.entryId||null,
                    sourceType:entry?.sourceType||null,
                    collectionSize:state?.collection?.length||0,
                    ...data
                }
            });
        }catch(error){console.warn("Collector log failed",error);}
    }
    function pushToCollection(state,card,sourceType,context={}){
        if(!state?.activated||!card) return null;
        const instanceId=String(card.instanceId||"");
        if(instanceId&&state.collection.some(entry=>String(entry?.card?.instanceId||"")===instanceId)){
            return state.collection.find(entry=>String(entry?.card?.instanceId||"")===instanceId)||null;
        }
        const entry=makeEntry(state,card,sourceType,context);
        state.collection.push(entry);
        state.capturedCount+=1;
        log("collector_card_added",state,entry,{cardName:card?.name||"JOKER"});
        refreshControls();
        playCaptureFeedback(state,entry);
        return entry;
    }

    function configure(nextAdapter={}){
        adapter=nextAdapter&&typeof nextAdapter==="object"?nextAdapter:null;
        return true;
    }

    function reset(){
        collectors.clear();
        overlayState={type:null,playerName:null};
        finishCallback=null;
        finishQueue=[];
        if(activationRetryTimer){
            global.clearTimeout?.(activationRetryTimer);
            activationRetryTimer=null;
        }
        document.getElementById("spxCollectorOverlay")?.remove?.();
        document.querySelectorAll(".spx-collector-capture-flight").forEach(node=>node.remove());
        return true;
    }

    function ensureAssignedStates(){
        getAssignedCollectorNames().forEach(name=>collectorState(name,true));
    }

    function needsActivationNow(){
        ensureAssignedStates();
        const packNumber=Number(adapter?.getPackNumber?.())||0;
        if(packNumber!==1) return null;
        if(adapter?.isPackOpen&&adapter.isPackOpen()===false) return null;
        const playerIndex=Number(adapter?.getCurrentPlayerIndex?.());
        if(!Number.isInteger(playerIndex)) return null;
        const name=playerList()[playerIndex];
        const assignment=getAssignment(name);
        if(assignment?.powerId!==POWER_ID) return null;
        const state=collectorState(name,true);
        if(state.activated) return null;
        return state;
    }

    function blocksCurrentPick(){
        const pending=needsActivationNow();
        return Boolean(pending||overlayState.type==="activation");
    }

    function presentationIsBlockingActivation(){
        if(global.SuperpowerUI?.isBusy?.()) return true;
        if(global.JokerV2UI?.isBusy?.()) return true;
        const bounty=document.getElementById("bountyRoundOverlay");
        if(bounty && bounty.hidden===false) return true;
        return false;
    }

    function queueActivation(state){
        if(!state) return false;
        if(activationRetryTimer) return true;
        const attempt=()=>{
            activationRetryTimer=null;
            const fresh=needsActivationNow();
            if(!fresh||fresh.playerName!==state.playerName) return;
            if(presentationIsBlockingActivation()){
                activationRetryTimer=global.setTimeout(attempt,240);
                return;
            }
            openActivation(fresh);
        };
        activationRetryTimer=global.setTimeout(attempt,90);
        return true;
    }

    function onTurnReady(){
        const state=needsActivationNow();
        if(!state) return false;
        if(state.activationPrompted&&overlayState.type==="activation") return true;
        state.activationPrompted=true;
        queueActivation(state);
        return true;
    }

    function ensureOverlay(){
        let overlay=document.getElementById("spxCollectorOverlay");
        if(overlay) return overlay;
        overlay=document.createElement("div");
        overlay.id="spxCollectorOverlay";
        overlay.className="spx-collector-overlay";
        overlay.hidden=true;
        overlay.innerHTML=`<section class="spx-collector-shell" role="dialog" aria-modal="true">
            <div class="spx-collector-vault-glow" aria-hidden="true"></div>
            <header class="spx-collector-header">
                <div class="spx-collector-sigil" aria-hidden="true">◈</div>
                <div><span id="spxCollectorKicker">TIVAN ARCHIVE // PRIVATE VAULT</span><h2 id="spxCollectorTitle">THE COLLECTOR</h2><p id="spxCollectorLead"></p></div>
                <button type="button" class="spx-collector-close" id="spxCollectorClose" aria-label="Zamknij">×</button>
            </header>
            <div id="spxCollectorBody" class="spx-collector-body"></div>
            <footer id="spxCollectorActions" class="spx-collector-actions"></footer>
        </section>`;
        document.body.appendChild(overlay);
        overlay.querySelector("#spxCollectorClose")?.addEventListener("click",()=>{
            if(overlayState.type==="activation"||overlayState.type==="finalize") return;
            closeOverlay();
        });
        return overlay;
    }
    function closeOverlay(){
        const overlay=document.getElementById("spxCollectorOverlay");
        if(overlay){overlay.hidden=true;overlay.classList.remove("is-open","is-finalizing","is-gallery","is-first-opening");}
        overlayState={type:null,playerName:null};
    }
    function setOverlay({type,playerName,title,lead,kicker="TIVAN ARCHIVE // PRIVATE VAULT",body="",actions=[]}){
        const overlay=ensureOverlay();
        overlayState={type,playerName};
        overlay.querySelector("#spxCollectorKicker").textContent=kicker;
        overlay.querySelector("#spxCollectorTitle").textContent=title;
        overlay.querySelector("#spxCollectorLead").textContent=lead||"";
        const bodyRoot=overlay.querySelector("#spxCollectorBody");
        bodyRoot.innerHTML=body;
        const actionsRoot=overlay.querySelector("#spxCollectorActions");
        actionsRoot.innerHTML="";
        actions.forEach(action=>{
            const btn=document.createElement("button");
            btn.type="button";
            btn.className=`spx-collector-action ${action.className||""}`.trim();
            btn.textContent=action.label;
            btn.disabled=Boolean(action.disabled);
            btn.addEventListener("click",action.onClick);
            actionsRoot.appendChild(btn);
        });
        const close=overlay.querySelector("#spxCollectorClose");
        if(close) close.hidden=type==="activation"||type==="finalize";
        overlay.classList.toggle("is-finalizing",type==="finalize");
        overlay.classList.toggle("is-gallery",type==="gallery");
        overlay.hidden=false;
        requestAnimationFrame(()=>overlay.classList.add("is-open"));
        return overlay;
    }

    function openActivation(state){
        if(!state||state.activated) return false;
        const overlay=setOverlay({
            type:"activation",
            playerName:state.playerName,
            kicker:"TIVAN ARCHIVE // OTWARCIE PRYWATNEGO SKARBCA",
            title:"OTWÓRZ KOLEKCJĘ",
            lead:`${state.playerName}, Collector rozpoczyna polowanie na eksponaty.`,
            body:`<div class="spx-collector-activation-copy">
                <div class="spx-collector-activation-orb" aria-hidden="true">✦</div>
                <p>Karty pozostawione przez innych na końcu paczek nie znikną w próżni. Od tej chwili trafią do Twojej prywatnej galerii, gdzie możesz obserwować je przez cały draft.</p>
            </div>`,
            actions:[{label:"OTWÓRZ PRYWATNĄ KOLEKCJĘ",className:"primary",onClick:()=>activate(state.playerName)}]
        });
        overlay?.classList.add("is-first-opening");
        return true;
    }

    function backfillFirstPackJokerRejections(state){
        const engine=global.DraftStateEngine;
        if(!state?.activated||!engine?.listGraveyardEntries||!engine?.consumeGraveyardEntry) return 0;
        const currentPackNumber=Number(adapter?.getPackNumber?.())||1;
        if(currentPackNumber!==1) return 0;
        const candidates=engine.listGraveyardEntries({status:"available",recoverable:true,categories:["jokerRejected"]})||[];
        let moved=0;
        candidates.forEach(entry=>{
            if(Number(entry?.packNumber)!==1||entry?.powerId) return;
            const source=String(entry?.source||"");
            const path=String(entry?.metadata?.resolutionPath||"");
            const normalPack=source==="surprise_joker_rejected"||path==="legacy_pack_pick"||path==="joker_v2_pack_pick";
            if(!normalPack) return;
            const consumed=engine.consumeGraveyardEntry(entry.graveyardEntryId,{
                consumer:POWER_ID,
                powerId:POWER_ID,
                reason:"collector_first_pack_backfill",
                playerIndex:state.playerIndex,
                packNumber:1
            });
            if(!consumed?.card) return;
            const collectionEntry=pushToCollection(state,consumed.card,"jokerRejectedFromPack",{
                packNumber:1,
                packId:consumed.packId||entry.packId||null,
                sourceJokerInstanceId:consumed.metadata?.sourceJokerInstanceId||null,
                metadata:{
                    ...(consumed.metadata||{}),
                    collectedAfterActivation:true,
                    graveyardEntryId:consumed.graveyardEntryId||entry.graveyardEntryId
                }
            });
            if(collectionEntry){
                moved+=1;
            }else{
                engine.restoreGraveyardEntry?.(entry.graveyardEntryId,{reason:"collector_backfill_rollback",powerId:POWER_ID});
            }
        });
        if(moved) log("collector_first_pack_backfill",state,null,{moved});
        return moved;
    }

    function activate(playerName){
        const state=collectorState(playerName,true);
        const check=needsActivationNow();
        if(!state||!check||check.playerName!==playerName) return false;
        const completed=global.SuperpowerEngine?.completeActivation?.(playerName,POWER_ID,{
            packNumber:Number(adapter?.getPackNumber?.())||1,
            pickIndex:Number(adapter?.getPickIndex?.())||0,
            ongoing:true,
            collectionOpened:true
        });
        if(completed?.ok===false){
            global.SuperpowerFeedback?.error?.(POWER_ID,"SKARBIEC NIE OTWORZYŁ SIĘ",completed?.reason||"Nie udało się aktywować Kolekcji.");
            return false;
        }
        state.activated=true;
        if(activationRetryTimer){
            global.clearTimeout?.(activationRetryTimer);
            activationRetryTimer=null;
        }
        backfillFirstPackJokerRejections(state);
        const stored=global.draftSuperpowers?.[playerName];
        if(stored){stored.used=true;stored.status="used";}
        global.superpowerLog=Array.isArray(global.superpowerLog)?global.superpowerLog:[];
        global.superpowerLog.push({
            type:"superpower_activation",event:"collector_collection_opened",playerName,
            playerIndex:state.playerIndex,powerId:POWER_ID,
            packNumber:Number(adapter?.getPackNumber?.())||1,
            pickIndex:Number(adapter?.getPickIndex?.())||0,
            timestamp:new Date().toISOString()
        });
        log("collector_collection_opened",state,null,{ongoing:true});
        closeOverlay();
        refreshControls();
        global.SuperpowerFeedback?.event?.(POWER_ID,"KOLEKCJA OTWARTA","Prywatna galeria Collectora zaczyna przyjmować niewybrane eksponaty.");
        return true;
    }

    function capturePackRemainder(card,context={}){
        const state=ownerForCapture();
        if(!state||!card) return {captured:false};
        const entry=pushToCollection(state,card,"packResidue",context);
        return entry?{captured:true,playerName:state.playerName,playerIndex:state.playerIndex,entry}:{captured:false};
    }

    function isNormalPackJokerRejection(context={}){
        if(context.powerId) return false;
        const path=String(context.resolutionPath||"");
        const source=String(context.source||"");
        return path==="legacy_pack_pick"||path==="joker_v2_pack_pick"||source==="surprise_joker_rejected";
    }
    function captureJokerRejection(card,context={}){
        if(!card||!isNormalPackJokerRejection(context)) return {captured:false};
        const state=ownerForCapture();
        if(!state) return {captured:false};
        const entry=pushToCollection(state,card,"jokerRejectedFromPack",{
            ...context,
            sourceJokerInstanceId:context.sourceJokerInstanceId||null
        });
        return entry?{captured:true,playerName:state.playerName,playerIndex:state.playerIndex,entry}:{captured:false};
    }

    function playCaptureFeedback(state,entry){
        if(!document.body||global.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
        const chip=document.querySelector(`[data-collector-gallery-player="${state.playerIndex}"]`);
        const rect=chip?.getBoundingClientRect?.();
        if(!rect||!rect.width) return;
        const flight=document.createElement("div");
        flight.className="spx-collector-capture-flight";
        flight.innerHTML=`<span>◈</span><b>${esc(entry?.card?.joker?"JOKER":entry?.card?.name||"EKSPONAT")}</b>`;
        flight.style.setProperty("--collector-flight-x",`${rect.left+rect.width/2}px`);
        flight.style.setProperty("--collector-flight-y",`${rect.top+rect.height/2}px`);
        document.body.appendChild(flight);
        requestAnimationFrame(()=>flight.classList.add("is-active"));
        global.setTimeout(()=>flight.remove(),1050);
    }

    function createCardVisual(entry,{interactive=false,selected=false}={}){
        const card=entry?.card||entry;
        const button=document.createElement("button");
        button.type="button";
        const baseClass=`spx-collector-card ${card?.joker?"is-joker":"is-normal"}${interactive?" is-interactive":""}${selected?" is-selected":""}`;
        // FINAL LAST HOTFIX: normal Collector exhibits are real pack cards.
        // This intentionally reuses the exact .pack-card-btn renderer/CSS from the draft pack.
        button.className=card?.joker ? baseClass : `${baseClass} pack-card-btn`;
        button.dataset.collectionEntryId=entry?.entryId||"";
        if(card?.instanceId) button.dataset.cardInstanceId=String(card.instanceId);
        if(card?.joker){
            button.innerHTML=`<div class="joker-border"><div class="joker-card"><div class="joker-bg-glow"></div><div class="joker-starfield"></div><div class="joker-galaxy"></div><div class="joker-title">JOKER</div><div class="joker-questions"><span class="q-left">?</span><span class="q-right">?</span></div><div class="joker-desc">${esc(card.desc||card.type||"Nierozstrzygnięty eksponat")}</div></div></div><span class="spx-collector-glass" aria-hidden="true"></span>`;
        }else{
            button.innerHTML=`<div class="pack-card-inner"><div class="pack-icon pack-planet">${esc(card?.cost??"?")}</div><div class="pack-card-name">${esc(card?.name||"Karta")}</div><div class="pack-icon pack-star">${esc(card?.power??"?")}</div></div><span class="spx-collector-glass" aria-hidden="true"></span>`;
        }
        button.title=card?.joker?"Nierozstrzygnięty Joker w Kolekcji":`${card?.name||"Karta"} · ${card?.cost??"?"}/${card?.power??"?"}`;
        return button;
    }

    function galleryBody(state){
        if(!state.collection.length){
            return `<div class="spx-collector-empty"><span>◇</span><b>GABLOTY CZEKAJĄ NA PIERWSZY EKSPONAT</b><p>Gdy paczka zakończy się z niewybraną kartą, Collector przejmie ją do swojej galerii.</p></div>`;
        }
        return `<div class="spx-collector-gallery-meta"><span>EKSPONATÓW</span><strong>${state.collection.length}</strong><small>Każdy pozostał niewybrany w normalnym biegu paczki.</small></div><div class="spx-collector-gallery-grid" id="spxCollectorGalleryGrid"></div>`;
    }
    function renderGalleryCards(state){
        const grid=document.getElementById("spxCollectorGalleryGrid");
        if(!grid) return;
        grid.innerHTML="";
        state.collection.forEach(entry=>{
            const card=createCardVisual(entry);
            const label=document.createElement("small");
            label.className="spx-collector-origin";
            label.textContent=entry.sourceType==="jokerRejectedFromPack"?"NIEWYBRANY WYNIK JOKERA":`PACZKA #${entry.packNumber||"?"}`;
            const shell=document.createElement("div");
            shell.className="spx-collector-vitrine";
            shell.append(card,label);
            grid.appendChild(shell);
        });
    }
    function openGallery(playerName){
        const state=collectorState(playerName,false);
        if(!state?.activated) return false;
        setOverlay({
            type:"gallery",playerName,
            kicker:"TIVAN ARCHIVE // LIVE COLLECTION",
            title:"PRYWATNA GALERIA",
            lead:`${playerName} · ${state.collection.length} ${state.collection.length===1?"eksponat":"eksponatów"}`,
            body:galleryBody(state),
            actions:[{label:"WRÓĆ DO DRAFTU",className:"primary",onClick:closeOverlay}]
        });
        renderGalleryCards(state);
        return true;
    }

    function refreshControls(){
        try{decorateDeckPanels();}catch(error){}
        try{adapter?.refreshInspectors?.();}catch(error){}
        if(overlayState.type==="gallery"&&overlayState.playerName){
            const state=collectorState(overlayState.playerName,false);
            if(state){
                const overlay=ensureOverlay();
                overlay.querySelector("#spxCollectorLead").textContent=`${state.playerName} · ${state.collection.length} ${state.collection.length===1?"eksponat":"eksponatów"}`;
                overlay.querySelector("#spxCollectorBody").innerHTML=galleryBody(state);
                renderGalleryCards(state);
            }
        }
    }

    function decorateDeckPanels(){
        ensureAssignedStates();
        document.querySelectorAll("[data-deck-context-strip]").forEach(strip=>{
            const playerIndex=Number(strip.dataset.playerIndex);
            const name=playerList()[playerIndex];
            const state=collectorState(name,false);
            strip.querySelectorAll(".spx-collector-gallery-chip").forEach(node=>node.remove());
            if(!state?.activated) return;
            const button=document.createElement("button");
            button.type="button";
            button.className="spx-collector-gallery-chip";
            button.dataset.collectorGalleryPlayer=String(playerIndex);
            button.innerHTML=`<span aria-hidden="true">◈</span><b>COLLECTION</b><strong>${state.collection.length}</strong>`;
            button.title=`Otwórz Collection Collectora · ${state.collection.length} eksponatów`;
            button.addEventListener("click",event=>{event.stopPropagation();openGallery(name);});
            strip.appendChild(button);
        });
    }

    function decorateInspector(playerIndex){
        const name=playerList()[playerIndex];
        const state=collectorState(name,false);
        const slot=document.getElementById(`deckInspectorPower_${playerIndex}`);
        if(!slot) return;
        slot.querySelectorAll(".spx-collector-inspector-btn").forEach(node=>node.remove());
        if(!state?.activated) return;
        slot.hidden=false;
        const button=document.createElement("button");
        button.type="button";
        button.className="deckInspectorPowerBtn spx-collector-inspector-btn";
        button.innerHTML=`<span class="spx-collector-mini-sigil">◈</span><b>${state.collection.length}</b>`;
        button.title=`Collection · ${state.collection.length} eksponatów`;
        button.addEventListener("mousedown",event=>event.stopPropagation());
        button.addEventListener("click",event=>{event.stopPropagation();openGallery(name);});
        slot.appendChild(button);
    }

    function getStatus(playerName){
        const state=collectorState(playerName,false);
        if(!state) return {assigned:false,activated:false,collectionSize:0,finalized:false,swapsUsed:0,maxFinalSwaps:MAX_FINAL_SWAPS};
        return {
            assigned:true,
            activated:Boolean(state.activated),
            collectionSize:state.collection.length,
            finalized:Boolean(state.finalized),
            finalizing:Boolean(state.finalizing),
            swapsUsed:Number(state.swapsUsed)||0,
            maxFinalSwaps:MAX_FINAL_SWAPS,
            collection:state.collection.map(entry=>({
                entryId:entry.entryId,
                sourceType:entry.sourceType,
                packNumber:entry.packNumber,
                card:clone(entry.card)
            }))
        };
    }

    function canFinalize(state){
        return Boolean(state?.activated&&!state.finalized&&state.collection.length);
    }

    function beginFinalization(done){
        ensureAssignedStates();
        if(finishCallback) return true;
        finishQueue=getAssignedCollectorNames()
            .map(name=>collectorState(name,false))
            .filter(canFinalize);
        if(!finishQueue.length) return false;
        finishCallback=typeof done==="function"?done:null;
        finalizeNext();
        return true;
    }
    function finalizeNext(){
        const next=finishQueue.shift();
        if(!next){
            const callback=finishCallback;
            finishCallback=null;
            closeOverlay();
            callback?.();
            return;
        }
        startFinalization(next);
    }
    function startFinalization(state){
        const deck=decks()[state.playerIndex];
        if(!Array.isArray(deck)||deck.length!==12){
            state.finalized=true;
            log("collector_finalization_skipped",state,null,{reason:"deck_not_12",deckSize:Array.isArray(deck)?deck.length:null});
            finalizeNext();
            return;
        }
        state.finalizing=true;
        state.swapsUsed=0;
        state.selectedEntryId=null;
        renderFinalization(state);
    }

    function finalizationBody(state){
        return `<div class="spx-collector-final-summary"><span>CURATION LIMIT</span><strong>${state.swapsUsed}/${MAX_FINAL_SWAPS}</strong><small>Każda wymiana przenosi jeden eksponat do finalnej dwunastki.</small></div>
        <div class="spx-collector-curation">
            <section class="spx-collector-final-deck"><header><span>MAIN DECK</span><strong>12 KART</strong></header><div id="spxCollectorFinalDeck" class="spx-collector-final-grid"></div></section>
            <div class="spx-collector-transfer-arrow" aria-hidden="true">⇄</div>
            <section class="spx-collector-final-collection"><header><span>COLLECTION</span><strong>${state.collection.length} EKSPONATÓW</strong></header><div id="spxCollectorFinalCollection" class="spx-collector-final-grid collection"></div></section>
        </div>
        <p class="spx-collector-final-hint" id="spxCollectorFinalHint">Wybierz eksponat z Collection, a potem kartę w Main Decku. Możesz też przeciągnąć eksponat bezpośrednio na wybrany slot.</p>`;
    }

    function renderFinalization(state){
        const overlay=setOverlay({
            type:"finalize",playerName:state.playerName,
            kicker:"TIVAN ARCHIVE // FINAL CURATION",
            title:"OSTATNIA WYSTAWA",
            lead:`${state.playerName}, wybierz które eksponaty zostaną częścią finalnego decku.`,
            body:finalizationBody(state),
            actions:[
                {label:"ZAMKNIJ KOLEKCJĘ",className:"primary",onClick:()=>confirmFinalization(state)}
            ]
        });
        renderFinalizationCards(state);
        return overlay;
    }

    function renderFinalizationCards(state){
        const deckRoot=document.getElementById("spxCollectorFinalDeck");
        const collectionRoot=document.getElementById("spxCollectorFinalCollection");
        if(!deckRoot||!collectionRoot) return;
        const deck=decks()[state.playerIndex]||[];
        deckRoot.innerHTML="";
        deck.forEach((card,index)=>{
            const entry={entryId:`deck-${index}`,card};
            const visual=createCardVisual(entry,{interactive:true});
            visual.classList.add("spx-collector-deck-slot");
            visual.dataset.deckIndex=String(index);
            visual.addEventListener("dragover",event=>event.preventDefault());
            visual.addEventListener("drop",event=>{
                event.preventDefault();
                const entryId=event.dataTransfer?.getData("text/collector-entry")||state.selectedEntryId;
                if(entryId) performSwap(state,entryId,index);
            });
            visual.addEventListener("click",()=>{
                if(!state.selectedEntryId){setFinalHint("Najpierw wybierz eksponat z Collection.");return;}
                performSwap(state,state.selectedEntryId,index);
            });
            deckRoot.appendChild(visual);
        });
        collectionRoot.innerHTML="";
        if(!state.collection.length){
            collectionRoot.innerHTML=`<div class="spx-collector-final-empty">Collection nie ma już eksponatów do wymiany.</div>`;
        }else{
            state.collection.forEach(entry=>{
                const selected=state.selectedEntryId===entry.entryId;
                const visual=createCardVisual(entry,{interactive:true,selected});
                visual.draggable=true;
                visual.addEventListener("dragstart",event=>{
                    state.selectedEntryId=entry.entryId;
                    event.dataTransfer?.setData("text/collector-entry",entry.entryId);
                    event.dataTransfer&&(event.dataTransfer.effectAllowed="move");
                    renderFinalizationCards(state);
                });
                visual.addEventListener("click",()=>{
                    state.selectedEntryId=selected?null:entry.entryId;
                    renderFinalizationCards(state);
                    setFinalHint(state.selectedEntryId?`Wybrano: ${entry.card?.joker?"JOKER":entry.card?.name||"eksponat"}. Teraz wskaż kartę Main Decku.`:"Wybierz eksponat z Collection.");
                });
                collectionRoot.appendChild(visual);
            });
        }
        const summary=document.querySelector(".spx-collector-final-summary strong");
        if(summary) summary.textContent=`${state.swapsUsed}/${MAX_FINAL_SWAPS}`;
    }

    function setFinalHint(text){
        const hint=document.getElementById("spxCollectorFinalHint");
        if(hint) hint.textContent=text;
    }

    function resolveJoker(entry,state){
        return new Promise(resolve=>{
            const joker=entry?.card;
            if(!joker?.joker){resolve({card:joker,resolved:false});return;}
            const ui=global.JokerV2UI;
            if(!ui?.resolveForEffect){resolve(null);return;}
            const overlay=document.getElementById("spxCollectorOverlay");
            overlay?.classList.add("has-child-modal");
            let settled=false;
            const finish=value=>{
                if(settled) return;
                settled=true;
                overlay?.classList.remove("has-child-modal");
                resolve(value?{card:value,resolved:true}:null);
            };
            const opened=ui.resolveForEffect(joker,{
                playerIndex:state.playerIndex,
                sourceZone:"collector_collection",
                sourcePowerId:POWER_ID,
                sourceEvent:"collector_final_joker",
                allowCancel:true,
                onResolve:card=>finish(card),
                onCancel:()=>finish(null)
            });
            if(opened===false) finish(null);
        });
    }

    async function performSwap(stateOrName,entryId,deckIndex){
        const state=typeof stateOrName==="string"?collectorState(stateOrName,false):stateOrName;
        if(!state?.finalizing) return {ok:false,reason:"Collection nie jest teraz finalizowana."};
        if(state.swapsUsed>=MAX_FINAL_SWAPS){
            setFinalHint(`Wykorzystano limit ${MAX_FINAL_SWAPS} wymian.`);
            return {ok:false,reason:"swap_limit"};
        }
        const index=Number(deckIndex);
        const deck=decks()[state.playerIndex]||[];
        if(!Number.isInteger(index)||!deck[index]) return {ok:false,reason:"deck_target_missing"};
        const collectionIndex=state.collection.findIndex(entry=>entry.entryId===entryId);
        if(collectionIndex<0) return {ok:false,reason:"collection_entry_missing"};
        const entry=state.collection[collectionIndex];
        const resolved=await resolveJoker(entry,state);
        if(!resolved?.card){
            setFinalHint("Joker pozostaje w Collection.");
            return {ok:false,reason:"joker_cancelled"};
        }
        const outgoing=deck[index];
        const incoming=resolved.card;

        if(resolved.resolved){
            // Próba wyjęcia Jokera z gabloty jest momentem jego ostatecznego rozstrzygnięcia.
            // Nawet jeśli wynik okaże się duplikatem i nie wejdzie jeszcze do Main Decku,
            // nie wolno ponownie losować/wybierać tego samego Jokera. Zostaje on w Collection
            // już jako rozstrzygnięta realna karta, a odrzucone opcje idą normalną ścieżką Graveyardu.
            entry.card=incoming;
            entry.sourceType="resolvedJokerFromCollection";
            entry.metadata={
                ...(entry.metadata||{}),
                resolvedFromJoker:true,
                resolvedAt:Date.now()
            };
            if(typeof global.archivePendingJokerRejections==="function"){
                global.archivePendingJokerRejections(incoming,{
                    source:"collector_final_joker_rejected",
                    powerId:POWER_ID,
                    resolutionPath:"collector_final_joker",
                    metadata:{collectorPlayerIndex:state.playerIndex}
                });
            }
            log("collector_joker_resolved",state,entry,{resultCard:incoming?.name||null});
        }

        const duplicateName=deck.some((card,deckIdx)=>deckIdx!==index&&String(card?.name||"").trim().toLowerCase()===String(incoming?.name||"").trim().toLowerCase());
        if(duplicateName){
            state.selectedEntryId=entry.entryId;
            renderFinalizationCards(state);
            setFinalHint(`${incoming.name} jest już w Main Decku. Joker został rozstrzygnięty i pozostaje w Collection.`);
            return {ok:false,reason:"duplicate",jokerResolved:Boolean(resolved.resolved)};
        }
        deck[index]=incoming;
        state.collection.splice(collectionIndex,1);
        state.collection.push(makeEntry(state,outgoing,"finalSwapOut",{
            packNumber:Number(adapter?.getPackNumber?.())||null,
            metadata:{replacedByInstanceId:incoming?.instanceId||null,replacedAtDeckIndex:index}
        }));
        state.swapsUsed+=1;
        state.selectedEntryId=null;
        log("collector_final_swap",state,null,{
            swapNumber:state.swapsUsed,
            incomingCard:incoming?.name||"JOKER",
            outgoingCard:outgoing?.name||null,
            deckIndex:index,
            jokerResolved:Boolean(resolved.resolved)
        });
        adapter?.refreshDecks?.();
        renderFinalization(state);
        setFinalHint(`${incoming?.name||"Eksponat"} trafia do Main Decku. ${MAX_FINAL_SWAPS-state.swapsUsed} wymian pozostało.`);
        return {ok:true,incoming,outgoing,swapsUsed:state.swapsUsed};
    }

    function confirmFinalization(state){
        if(!state?.finalizing) return false;
        const deck=decks()[state.playerIndex]||[];
        if(deck.length!==12){
            setFinalHint("Finalny Main Deck musi mieć dokładnie 12 kart.");
            return false;
        }
        state.finalizing=false;
        state.finalized=true;
        state.selectedEntryId=null;
        global.superpowerLog=Array.isArray(global.superpowerLog)?global.superpowerLog:[];
        global.superpowerLog.push({
            type:"superpower_resolution",event:"collector_collection_finalized",playerName:state.playerName,
            playerIndex:state.playerIndex,powerId:POWER_ID,swapsUsed:state.swapsUsed,
            collectionRemaining:state.collection.length,finalDeck:deck.map(card=>card?.name).filter(Boolean),
            timestamp:new Date().toISOString()
        });
        log("collector_collection_finalized",state,null,{swapsUsed:state.swapsUsed,collectionRemaining:state.collection.length,deckSize:deck.length});
        closeOverlay();
        adapter?.refreshDecks?.();
        finalizeNext();
        return true;
    }

    function exportState(){
        return {
            version:1,
            collectors:[...collectors.entries()].map(([name,state])=>[name,{
                ...clone(state),
                // Snapshot nie powinien wznawiać otwartego końcowego modala jako pół-transakcji.
                finalizing:false,
                selectedEntryId:null,
                initialDeck:null,
                initialCollection:null
            }])
        };
    }
    function restoreState(snapshot){
        collectors.clear();
        const entries=Array.isArray(snapshot?.collectors)?snapshot.collectors:[];
        entries.forEach(([name,raw])=>{
            const state={...clone(raw),playerName:String(name||raw?.playerName||"")};
            state.collection=Array.isArray(state.collection)?state.collection:[];
            state.entrySequence=Number(state.entrySequence)||state.collection.length;
            state.playerIndex=playerList().indexOf(state.playerName);
            state.finalizing=false;
            state.selectedEntryId=null;
            state.initialDeck=null;
            state.initialCollection=null;
            collectors.set(state.playerName,state);
        });
        closeOverlay();
        refreshControls();
        return true;
    }

    function isBusy(){return overlayState.type==="activation"||overlayState.type==="finalize";}
    function getLockReason(){
        if(overlayState.type==="activation") return "Collector musi otworzyć swoją Collection przed pierwszym pickiem.";
        if(overlayState.type==="finalize") return "Collector finalizuje swoją Collection.";
        return "";
    }

    global.CollectorUI=Object.freeze({
        configure,reset,onTurnReady,blocksCurrentPick,capturePackRemainder,captureJokerRejection,
        openGallery,decorateDeckPanels,decorateInspector,getStatus,beginFinalization,
        performSwap,confirmFinalization,exportState,restoreState,isBusy,getLockReason,
        MAX_FINAL_SWAPS
    });
})(window);
