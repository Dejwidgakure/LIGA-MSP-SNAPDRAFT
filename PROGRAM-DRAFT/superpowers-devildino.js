(function(global){
    "use strict";

    const POWER_ID="devil_dinosaur";
    const ZONE="devilDinoBelly";
    const MAX_SELECTION=3;
    const MAX_PRINTED_COST=10;
    const QUEUE_PENALTY=3;
    const BELLY_CONTEXT_ORDER=["pickReplacement","packReplacement","deckBackup","finalExchange"];
    const ALLOWED_CONTEXTS=new Set([
        "pickReplacement",
        "packReplacement",
        "deckBackup",
        "kunLunStake",
        "finalExchange"
    ]);
    const ASSETS=Object.freeze({
        logo:"draft-assets/devildinopowerslogo.png",
        hero:"draft-assets/devildinopowershero.png",
        belly:"draft-assets/devildino_belly_full.png",
        bellyInterior:"draft-assets/devildino_belly_interior.png",
        sleeping:"draft-assets/devildino_sleeping.png",
        claws:"draft-assets/devildino_claw_marks.png",
        chompTop:"draft-assets/devildino_chomp_top.png",
        chompBottom:"draft-assets/devildino_chomp_bottom.png",
        moonGirlCall:"draft-assets/devildino_moongirl_call_bg.png"
    });

    let windowSequence=0;
    let moonGirlCallQueue=Promise.resolve();
    const packClawMarks={packIndex:-1,instanceIds:new Set()};
    const ui={
        active:false,
        phase:"idle",
        playerName:"",
        playerIndex:-1,
        selectedPackIds:new Set(),
        action:"",
        bellyEntryId:"",
        targetInstanceId:"",
        resolutionWindowId:"",
        committing:false,
        inlineMessage:""
    };

    function escapeHtml(value){
        return String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
    }

    function clone(value){
        if(value===undefined) return undefined;
        if(typeof structuredClone==="function"){
            try{return structuredClone(value);}catch(error){}
        }
        return JSON.parse(JSON.stringify(value));
    }

    function playersList(){
        return Array.isArray(global.players)?global.players:(typeof players!=="undefined"&&Array.isArray(players)?players:[]);
    }

    function decksList(){
        return Array.isArray(global.decks)?global.decks:(typeof decks!=="undefined"&&Array.isArray(decks)?decks:[]);
    }

    function packList(){
        if(global.GalacticCurrentSuperpowerBridge?.isModeEnabled?.()) return global.GalacticCurrentSuperpowerBridge.getLiveCards?.()||[];
        return Array.isArray(global.currentPack)?global.currentPack:(typeof currentPack!=="undefined"&&Array.isArray(currentPack)?currentPack:[]);
    }

    function playerIndexFor(playerName){
        return playersList().indexOf(String(playerName||""));
    }

    function engineRecord(playerName){
        return global.SuperpowerEngine?.getPlayerData?.(playerName)||null;
    }

    function makeDinoState(){
        return {
            version:1,
            activated:true,
            bellyLocked:true,
            unlockedAt:null,
            activationPackNumber:(typeof packStartIndex!=="undefined"?Number(packStartIndex):0)+1,
        activationPickIndex:typeof currentPickIndex!=="undefined"?Number(currentPickIndex):0,
        activationPlayerIndex:ui.playerIndex,
        activationQueuePenaltyApplied:false,
        activationQueueShift:null,
        // Zachowane wyłącznie dla bezpiecznego odczytu starych zapisów.
        pendingQueuePenalty:0,
            consumedWindowIds:[],
            consumptionHistory:[],
            pendingBackup:null,
            finalExchangeOffered:false,
            finalExchangeResolved:false
        };
    }

    function dinoState(playerName,{create=false}={}){
        const record=engineRecord(playerName);
        if(!record||record.powerId!==POWER_ID) return null;
        record.data=record.data&&typeof record.data==="object"?record.data:{};
        if(!record.data.dino&&create) record.data.dino=makeDinoState();
        return record.data.dino||null;
    }

    function runtimeZone(){
        return global.DraftFoundation?.getRuntimeZone?.(ZONE)||[];
    }

    function bellyEntries(playerName){
        const index=playerIndexFor(playerName);
        return runtimeZone().filter(entry=>Number(entry?.ownerIndex)===index&&entry?.card);
    }

    function getEntry(playerName,entryId){
        return bellyEntries(playerName).find(entry=>String(entry?.runtimeEntryId||"")===String(entryId||""))||null;
    }

    function canonicalCard(card){
        if(card?.joker) return null;
        const database=Array.isArray(global.cardDatabase)?global.cardDatabase:(typeof cardDatabase!=="undefined"&&Array.isArray(cardDatabase)?cardDatabase:[]);
        const id=String(card?.cardId||card?.id||"");
        const name=String(card?.name||"").trim().toLowerCase();
        return database.find(entry=>
            (id&&String(entry?.cardId||entry?.id||"")===id)||
            (name&&String(entry?.name||"").trim().toLowerCase()===name)
        )||null;
    }

    function printedCost(card){
        if(card?.joker) return 0;
        const canonical=canonicalCard(card);
        const value=Number(canonical?.cost??card?.cost??0);
        return Number.isFinite(value)?Math.max(0,value):0;
    }


    function isMysterioIllusion(card){
        return Boolean(global.MysterioUI?.isIllusionCard?.(card));
    }

    function publicPackCardSnapshot(card){
        return global.MysterioUI?.getPublicCardSnapshot?.(card) || card;
    }

    function safeDevourValidationMessage(validation,cards){
        if((Array.isArray(cards)?cards:[]).some(isMysterioIllusion) && !validation?.ok){
            return "Jedna z wybranych Iluzji nie mieści się w zasadach Brzucha Dino.";
        }
        return validation?.message || "";
    }

    function cardKey(card){
        return String(card?.instanceId||card?.cardId||card?.id||card?.name||"");
    }

    function spiderProtected(card){
        return typeof getSpiderManReservationForCard==="function"&&Boolean(getSpiderManReservationForCard(card));
    }

    function strangeLocked(card){
        return typeof getDoctorStrangeLockedEffect==="function"&&Boolean(getDoctorStrangeLockedEffect(card));
    }

    function validateDevourSelection(cards){
        const selected=(Array.isArray(cards)?cards:[]).filter(Boolean);
        if(selected.length<1) return {ok:false,message:"Wybierz od 1 do 3 kart dla Brzucha Dino."};
        if(selected.length>MAX_SELECTION) return {ok:false,message:"Devil Dino może pożreć maksymalnie 3 karty."};
        const costs=selected.map(printedCost);
        const totalCost=costs.reduce((sum,value)=>sum+value,0);
        if(totalCost>MAX_PRINTED_COST){
            return {ok:false,message:`Suma drukowanego Costu wynosi ${totalCost}. Limit Brzucha to ${MAX_PRINTED_COST}.`,totalCost,costs};
        }
        if(selected.length===3&&costs.some(cost=>cost>=4)){
            return {ok:false,message:"Trzy karty można zjeść tylko wtedy, gdy każda ma drukowany Cost 0–3.",totalCost,costs};
        }
        if(selected.some(spiderProtected)){
            return {ok:false,message:"Pajęcza Sieć chroni jedną z wybranych kart przed pożarciem.",totalCost,costs};
        }
        if(selected.some(strangeLocked)){
            return {ok:false,message:"Portal Agamotto blokuje przeniesienie jednej z tych kart.",totalCost,costs};
        }
        if(selected.some(card=>!packList().includes(card))){
            return {ok:false,message:"Jedna z wybranych kart nie znajduje się już w aktualnej paczce.",totalCost,costs};
        }
        return {ok:true,totalCost,costs};
    }

    function externalBusy(){
        if(global.GrootUI?.isBusy?.()) return true;
        if(global.ThorUI?.isBusy?.()) return true;
        if(global.WolverineUI?.isBusy?.()) return true;
        if(global.IronFistUI?.isBusy?.()) return true;
        if(global.JokerV2UI?.isBusy?.()) return true;
        if(global.SuperpowerUI?.isBusy?.()) return true;
        return Boolean(global.DraftFoundation?.hasOpenTransaction?.());
    }

    function preflight(playerName){
        const record=engineRecord(playerName);
        const playerIndex=playerIndexFor(playerName);
        if(ui.active) return {ok:false,message:"Devil Dino już wybiera karty do pożarcia."};
        if(!record||record.powerId!==POWER_ID||playerIndex<0) return {ok:false,message:"Devil Dino nie jest przypisany do tego gracza."};
        if(record.used) return {ok:false,message:"Prehistoryczne Wgryzienie zostało już wykorzystane."};
        if(typeof draftFinished!=="undefined"&&draftFinished) return {ok:false,message:"Draft jest już zakończony."};
        if(typeof packIsOpen!=="undefined"&&!packIsOpen) return {ok:false,message:"Devil Dino potrzebuje otwartej paczki."};
        if((typeof packOpeningInProgress!=="undefined"&&packOpeningInProgress)||(typeof packEnding!=="undefined"&&packEnding)){
            return {ok:false,message:"Poczekaj, aż paczka będzie spokojna."};
        }
        if(global.GalacticCurrent?.getState?.()?.isResolving) return {ok:false,message:"Poczekaj, aż Gwiezdny Prąd zakończy przesunięcie."};
        if(externalBusy()) return {ok:false,message:"Najpierw dokończ inną aktywną sekwencję draftu."};
        const legal=packList().filter(card=>card&&!spiderProtected(card)&&!strangeLocked(card));
        if(!legal.length) return {ok:false,message:"W paczce nie ma karty, którą Dino może pożreć."};
        return {ok:true,record,playerIndex,legal};
    }

    function ensureActivationHud(){
        let hud=document.getElementById("spxDinoHud");
        if(hud) return hud;
        hud=document.createElement("aside");
        hud.id="spxDinoHud";
        hud.className="spx-dino-hud";
        hud.hidden=true;
        hud.innerHTML=`
            <span class="spx-dino-blueprint-grid" aria-hidden="true"></span>
            <span class="spx-dino-communicator" aria-hidden="true"><b>☎</b><i></i><i></i><i></i></span>
            <div class="spx-dino-hud-copy">
                <span>MOON GIRL CALL</span>
                <strong id="spxDinoHudTitle">🦖 PREHISTORYCZNE WGRYZIENIE</strong>
                <p id="spxDinoHudText"></p>
                <div id="spxDinoHudSelection" class="spx-dino-hud-selection"></div>
            </div>
            <div class="spx-dino-hud-actions">
                <button type="button" data-dino-hud="cancel">ANULUJ</button>
                <button type="button" class="is-primary" data-dino-hud="confirm">WGRYŹ SIĘ</button>
            </div>`;
        document.body.appendChild(hud);
        hud.addEventListener("click",event=>{
            const action=event.target.closest?.("[data-dino-hud]")?.dataset?.dinoHud;
            if(action==="cancel") cancelActivation();
            if(action==="confirm") commitActivation();
        });
        return hud;
    }

    function updateActivationHud(message=""){
        const hud=ensureActivationHud();
        const selected=packList().filter(card=>ui.selectedPackIds.has(cardKey(card)));
        const validation=selected.length?validateDevourSelection(selected):{ok:false,message:""};
        const hasIllusion=selected.some(isMysterioIllusion);
        const cost=selected.reduce((sum,card)=>sum+printedCost(card),0);
        const visibleCost=hasIllusion ? "?" : String(cost);
        const validationCopy=validation.ok ? "" : safeDevourValidationMessage(validation,selected);
        hud.querySelector("#spxDinoHudText").textContent=message||(
            selected.length
                ? `Oznacz karty, które Dino ma pożreć. ${selected.length}/3 • SUMA KOSZTU ${visibleCost}/${MAX_PRINTED_COST}${validationCopy?` • ${validationCopy}`:""}`
                : "Oznacz karty, które Dino ma pożreć. 0/3 • SUMA KOSZTU 0/10"
        );
        hud.querySelector("#spxDinoHudSelection").innerHTML=selected.length
            ? selected.map(card=>{
                const publicCard=publicPackCardSnapshot(card);
                const visibleCardCost=isMysterioIllusion(card)?"?":printedCost(card);
                return `<span>${escapeHtml(publicCard?.name||"ILUZJA")} · ${escapeHtml(visibleCardCost)}</span>`;
            }).join("")
            : "<em>BRZUCH JEST PUSTY</em>";
        hud.querySelector('[data-dino-hud="confirm"]').disabled=!validation.ok;
    }

    function start(playerName){
        const existing=engineRecord(playerName);
        if(existing?.used) return openBelly(playerName);
        const check=preflight(playerName);
        if(!check.ok){global.SuperpowerFeedback?.warning?.(POWER_ID,"DINO NIE MOŻE TERAZ UCZTOWAĆ",check.message);return false;}
        resetTransient();
        ui.active=true;
        ui.phase="activation";
        ui.playerName=String(playerName);
        ui.playerIndex=check.playerIndex;
        const hud=ensureActivationHud();
        hud.hidden=false;
        updateActivationHud();
        global.showPack?.(false);
        return true;
    }

    function handlePackCardClick(packIndex,card){
        if(!ui.active||ui.phase!=="activation") return false;
        const live=packList()[Number(packIndex)]||card;
        if(!live) return true;
        if(spiderProtected(live)){
            updateActivationHud("Pajęcza Sieć chroni tę kartę przed pożarciem.");
            return true;
        }
        if(strangeLocked(live)){
            updateActivationHud("Portal Agamotto nie pozwala przenieść tej karty do Brzucha.");
            return true;
        }
        const key=cardKey(live);
        if(ui.selectedPackIds.has(key)) ui.selectedPackIds.delete(key);
        else{
            const current=packList().filter(item=>ui.selectedPackIds.has(cardKey(item)));
            const next=[...current,live];
            const validation=validateDevourSelection(next);
            if(!validation.ok){updateActivationHud(safeDevourValidationMessage(validation,next));return true;}
            ui.selectedPackIds.add(key);
        }
        updateActivationHud();
        decoratePack();
        return true;
    }

    function decoratePack(){
        document.querySelectorAll("#pack [data-pack-index]").forEach(element=>{
            element.classList.remove("spx-dino-candidate","spx-dino-selected","spx-dino-blocked");
            element.querySelectorAll(":scope > .spx-dino-pack-mark,:scope > .spx-dino-heavy-scrap-mark").forEach(mark=>mark.remove());
            const card=packList()[Number(element.dataset.packIndex)];
            const livePackIndex=typeof packStartIndex!=="undefined"?Number(packStartIndex):-1;
            if(packClawMarks.packIndex===livePackIndex && card && packClawMarks.instanceIds.has(cardKey(card))){
                const scrap=document.createElement("span");
                scrap.className="spx-dino-heavy-scrap-mark";
                scrap.innerHTML=`<img src="${ASSETS.claws}" alt="Ciężki ogryzek pozostawiony przez Devil Dino">`;
                element.appendChild(scrap);
                element.title=`CIĘŻKI OGRYZEK DEVIL DINO · ${element.title||card.name||"karta"}`;
            }
            if(!ui.active||ui.phase!=="activation") return;
            if(!card) return;
            if(spiderProtected(card)||strangeLocked(card)){
                element.classList.add("spx-dino-blocked");
                return;
            }
            element.classList.add("spx-dino-candidate");
            const selected=ui.selectedPackIds.has(cardKey(card));
            if(!selected) return;
            element.classList.add("spx-dino-selected");
            const mark=document.createElement("span");
            mark.className="spx-dino-pack-mark";
            mark.innerHTML=`<img src="${ASSETS.claws}" alt="Oznaczona do pożarcia">`;
            element.appendChild(mark);
        });
    }

    function clearPackDecorations(){
        document.querySelectorAll("#pack [data-pack-index]").forEach(element=>{
            element.classList.remove("spx-dino-candidate","spx-dino-selected","spx-dino-blocked");
            element.querySelectorAll(":scope > .spx-dino-pack-mark").forEach(mark=>mark.remove());
        });
    }

    function cardVisualMarkup(card,extraClass=""){
        try{
            const source=typeof global.buildPackCardButton==="function"?global.buildPackCardButton(card,-1):null;
            const className=String(source?.className||"pack-card-btn");
            const inner=source?.innerHTML||`<div class="pack-card-inner"><div class="pack-icon pack-planet">${card?.joker?"?":printedCost(card)}</div><div class="pack-card-name">${escapeHtml(card?.name||"JOKER")}</div><div class="pack-icon pack-star">${card?.joker?"?":Number(card?.power)||0}</div></div>`;
            return `<span class="spx-dino-card-visual ${escapeHtml(className)} ${escapeHtml(extraClass)}" aria-hidden="true">${inner}</span>`;
        }catch(error){
            return `<span class="spx-dino-card-visual pack-card-btn ${escapeHtml(extraClass)}" aria-hidden="true"><span class="pack-card-inner"><span class="pack-icon pack-planet">${card?.joker?"?":printedCost(card)}</span><span class="pack-card-name">${escapeHtml(card?.name||"JOKER")}</span><span class="pack-icon pack-star">${card?.joker?"?":Number(card?.power)||0}</span></span></span>`;
        }
    }

    function showMoonGirlCall(options={}){
        return new Promise(resolve=>{
            let scene;
            try{scene=document.createElement("aside");}catch(error){resolve(false);return;}
            const sleeping=options.variant==="sleep";
            scene.className=`spx-dino-moon-call${sleeping?" is-sleep":""}`;
            scene.innerHTML=`
                <div class="spx-dino-moon-call-card" role="dialog" aria-modal="true" aria-label="Moon Girl Call">
                    <div class="spx-dino-moon-call-city" aria-hidden="true">
                        <span class="spx-dino-communicator"><b>☎</b><i></i><i></i><i></i></span>
                        ${sleeping?`<img src="${ASSETS.sleeping}" alt="">`:`<img src="${ASSETS.hero}" alt="">`}
                    </div>
                    <div class="spx-dino-moon-call-copy">
                        <span>MOON GIRL CALL</span>
                        <h2>${escapeHtml(options.title||"DEVIL!")}</h2>
                        <p>${escapeHtml(options.text||"")}</p>
                        ${options.effectText?`<small class="spx-dino-moon-effect">${escapeHtml(options.effectText)}</small>`:""}
                        ${sleeping?"<em>ZZZ</em>":""}
                        <button type="button">${escapeHtml(options.buttonText||"DALEJ")}</button>
                    </div>
                </div>`;
            document.body.appendChild(scene);
            const finish=()=>{
                scene.classList.add("is-leaving");
                global.setTimeout?.(()=>{scene.remove();resolve(true);},180);
            };
            scene.querySelector("button")?.addEventListener("click",finish,{once:true});
            scene.addEventListener("keydown",event=>{if(event.key==="Escape"||event.key==="Enter") finish();},{once:true});
            scene.tabIndex=-1;
            scene.focus?.();
        });
    }

    function queueMoonGirlCall(options={}){
        moonGirlCallQueue=moonGirlCallQueue.catch(()=>false).then(()=>showMoonGirlCall(options));
        return moonGirlCallQueue;
    }

    function playChompBurst(records){
        const items=Array.isArray(records)?records:[];
        if(!items.length) return Promise.resolve(false);
        const reduced=global.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
        const stagger=reduced?90:620;
        const duration=reduced?320:1500;
        items.forEach((record,order)=>{
            global.setTimeout?.(()=>{
                const target=document.querySelector(`#pack [data-pack-index="${Number(record.index)}"]`);
                if(!target) return;
                const burst=document.createElement("span");
                burst.className="spx-dino-chomp-burst";
                burst.innerHTML=`
                    <span class="spx-dino-chomp-old">${cardVisualMarkup(record.card,"spx-dino-chomp-visual")}</span>
                    <img class="top" src="${ASSETS.chompTop}" alt="">
                    <img class="bottom" src="${ASSETS.chompBottom}" alt="">
                    <span class="spx-dino-card-crack" aria-hidden="true"><i></i><i></i><i></i></span>
                    <strong>CIĘŻKI OGRYZEK • 6+ COST</strong>`;
                target.appendChild(burst);
                target.classList.add("spx-dino-chomp-hit");
                global.setTimeout?.(()=>{burst.remove();target.classList.remove("spx-dino-chomp-hit");},duration);
            },order*stagger);
        });
        return new Promise(resolve=>global.setTimeout?.(()=>resolve(true),(items.length-1)*stagger+duration+120));
    }

    async function runPostFeastPresentation(records,queueShift){
        await playChompBurst(records);
        await queueMoonGirlCall({
            title:"WOW, DEVIL! ZOSTAWIŁEŚ CIĘŻKIE OGRYZKI KART!",
            text:"Moon Girl podziwia prehistoryczne wgryzienie.",
            effectText:"W miejscach pożartych kart Devil pozostawił losowe karty o Koszcie 6+.",
            buttonText:"DALEJ"
        });
        await queueMoonGirlCall({
            variant:"sleep",
            title:"DINO, ZDECYDOWANIE SIĘ PRZEJADŁEŚ! WIDZĘ, ŻE JESTEŚ SENNY!",
            text:"Moon Girl wysyła Devila na zasłużoną drzemkę.",
            effectText:`Devil Dino mocno się przejadł — jego następny pick przesuwa się o ${QUEUE_PENALTY}! Brzuch odblokuje się po jego następnym pełnym picku.`,
            buttonText:"WRÓĆ DO DRAFTU"
        });
        return true;
    }

    function markStoredAssignment(playerName){
        const stored=global.draftSuperpowers?.[playerName];
        if(stored){stored.used=true;stored.status="used";}
    }

    function generatedReplacements(count,selected){
        const result=global.DraftFoundation?.generateLegalRuntimeCards?.(count,{
            excludeCards:[...packList(),...(selected||[])],
            minCost:6,
            origin:"devil_dino_pack_replacement",
            sourcePowerId:POWER_ID,
            sourceEvent:"devil_dino_devour_refill"
        });
        return Array.isArray(result)&&result.every(card=>printedCost(card)>=6)?result:[];
    }

    function commitActivation(){
        if(!ui.active||ui.phase!=="activation"||ui.committing) return false;
        const selected=packList().filter(card=>ui.selectedPackIds.has(cardKey(card)));
        const validation=validateDevourSelection(selected);
        if(!validation.ok){updateActivationHud(safeDevourValidationMessage(validation,selected));return false;}
        return commitActivationNow(selected,validation);
    }

    function commitActivationNow(selected,validation){
        if(!ui.active||ui.phase!=="activation"||ui.committing) return false;
        const replacements=generatedReplacements(selected.length,selected);
        if(replacements.length!==selected.length){updateActivationHud("Dino nie znalazł dość ciężkich ogryzków. Spróbuj ponownie.");return false;}
        const tx=global.DraftFoundation?.beginTransaction?.("devil_dino_devour",{
            powerId:POWER_ID,
            playerName:ui.playerName,
            playerIndex:ui.playerIndex,
            selectedInstanceIds:selected.map(card=>card.instanceId)
        });
        if(!tx?.ok){updateActivationHud("Najpierw dokończ bieżące rozstrzygnięcie.");return false;}

        ui.committing=true;
        try{
            const records=[];
            selected.forEach((card,order)=>{
                const index=packList().indexOf(card);
                if(index<0) throw new Error("Wybrana karta opuściła paczkę.");
                const storedCard=card;
                global.DraftFoundation?.resolvePackCardLifecycle?.("acquire",card,{
                    fromZone:"pack",toZone:ZONE,reason:"devil_dino_devoured",powerId:POWER_ID
                });
                const entry=global.DraftFoundation?.addCardToRuntimeZone?.(ZONE,storedCard,{
                    ownerIndex:ui.playerIndex,
                    sourcePowerId:POWER_ID,
                    sourceEvent:"devil_dino_card_devoured",
                    metadata:{
                        ownerName:ui.playerName,
                        printedCost:printedCost(card),
                        devouredAtPack:(typeof packStartIndex!=="undefined"?Number(packStartIndex):0)+1,
                        devouredAtPick:typeof currentPickIndex!=="undefined"?Number(currentPickIndex):0,
                        originalPackIndex:index,
                        activationOrder:order+1
                    }
                });
                if(!entry) throw new Error(`Nie udało się zapisać ${storedCard.name} w Brzuchu.`);
                const rocketResult=global.resolveRocketBombAfterPick?.(ui.playerIndex,card,storedCard);
                const replacement=replacements[order];
                if(global.GalacticCurrentSuperpowerBridge?.isModeEnabled?.()){
                    global.removeRocketBombWithCard?.(card,"devil_dino_devour",{replacementPowerId:POWER_ID,replacementCard:replacement.name});
                    const replaced=global.GalacticCurrentSuperpowerBridge.replaceLiveCard?.(index,replacement,{source:"devil_dino_devour_refill",inheritFlowAge:true,render:false});
                    if(!replaced?.ok) throw new Error(`Nie udało się uzupełnić nurtu po ${storedCard.name}.`);
                }else{
                    packList()[index]=replacement;
                }
                if(typeof updateRocketBombCardZone==="function"){
                    updateRocketBombCardZone(replacement,global.GalacticCurrentSuperpowerBridge?.isModeEnabled?.()?"galacticCurrent":"pack",{
                        packNumber:(typeof packStartIndex!=="undefined"?Number(packStartIndex):0)+1,
                        packId:global.DraftStateEngine?.getPack?.(typeof packStartIndex!=="undefined"?Number(packStartIndex):0)?.packId||null
                    });
                }
                global.DraftStateEngine?.log?.("devil_dino_pack_refilled",{
                    packNumber:(typeof packStartIndex!=="undefined"?Number(packStartIndex):0)+1,
                    pickIndex:typeof currentPickIndex!=="undefined"?Number(currentPickIndex):0,
                    playerIndex:ui.playerIndex,
                    player:ui.playerName,
                    sourceCard:card,
                    resultCard:replacement,
                    reason:"devil_dino_devour_refill",
                    data:{runtimeEntryId:entry.runtimeEntryId,printedCost:printedCost(card),powerId:POWER_ID,rocketTriggered:Boolean(rocketResult?.triggered)}
                });
                records.push({entry,card:storedCard,replacement,index,rocketResult});
            });

            const record=engineRecord(ui.playerName);
            record.data=record.data&&typeof record.data==="object"?record.data:{};
            record.data.dino=makeDinoState();
            const queueShift=applyQueuePenalty(ui.playerName,QUEUE_PENALTY,{includeCurrent:true});
            const complete=global.SuperpowerEngine?.completeActivation?.(ui.playerName,POWER_ID,{
                cards:selected.map(card=>({instanceId:card.instanceId,name:card.name,printedCost:printedCost(card)})),
                replacements:replacements.map(card=>({instanceId:card.instanceId,name:card.name})),
                totalPrintedCost:validation.totalCost,
                packNumber:(typeof packStartIndex!=="undefined"?Number(packStartIndex):0)+1,
                pickIndex:typeof currentPickIndex!=="undefined"?Number(currentPickIndex):0
            });
            if(complete?.ok===false) throw new Error("Silnik odrzucił aktywację Devil Dino.");
            markStoredAssignment(ui.playerName);
            packClawMarks.packIndex=typeof packStartIndex!=="undefined"?Number(packStartIndex):-1;
            packClawMarks.instanceIds=new Set(replacements.map(card=>cardKey(card)));
            global.superpowerLog=Array.isArray(global.superpowerLog)?global.superpowerLog:[];
            global.superpowerLog.push({
                type:"superpower_activation",event:"devil_dino_devour",playerName:ui.playerName,playerIndex:ui.playerIndex,
                powerId:POWER_ID,powerName:"PREHISTORYCZNE WGRYZIENIE",
                devoured:selected.map(card=>card.name),replacementCards:replacements.map(card=>card.name),
                queueShift,
                totalPrintedCost:validation.totalCost,packNumber:(typeof packStartIndex!=="undefined"?Number(packStartIndex):0)+1,
                pickIndex:typeof currentPickIndex!=="undefined"?Number(currentPickIndex):0,timestamp:new Date().toISOString()
            });
            global.DraftFoundation?.commitTransaction?.(tx.transactionId,{powerId:POWER_ID,bellyCount:records.length});
            const hud=ensureActivationHud();
            hud.classList.add("is-fed");
            global.setTimeout?.(()=>hud.classList.remove("is-fed"),520);
            resetTransient();
            global.showPack?.(false);
            global.showDecks?.();
            global.updateRoundQueueDisplay?.();
            runPostFeastPresentation(records,queueShift).catch(error=>console.warn("Devil Dino presentation skipped:",error));
            return true;
        }catch(error){
            console.error("Devil Dino activation rollback:",error);
            global.DraftFoundation?.rollbackTransaction?.(tx.transactionId,{powerId:POWER_ID,reason:"devil_dino_activation_failed",message:error?.message||""});
            updateActivationHud("🦖 DINO NIE MOŻE TERAZ WYKONAĆ TEJ AKCJI — dokończ bieżący efekt i spróbuj ponownie.");
            ui.committing=false;
            global.showPack?.(false);
            global.showDecks?.();
            return false;
        }
    }

    function cancelActivation(){
        if(ui.committing) return false;
        resetTransient();
        global.showPack?.(false);
        return true;
    }

    function resetTransient(){
        ui.active=false;
        ui.phase="idle";
        ui.playerName="";
        ui.playerIndex=-1;
        ui.selectedPackIds.clear();
        ui.action="";
        ui.bellyEntryId="";
        ui.targetInstanceId="";
        ui.resolutionWindowId="";
        ui.committing=false;
        const hud=document.getElementById("spxDinoHud");
        if(hud) hud.hidden=true;
        clearPackDecorations();
        global.GraveyardUI?.refreshButton?.();
    }

    function applyQueuePenalty(playerName,amount=QUEUE_PENALTY,options={}){
        const data=dinoState(playerName,{create:true});
        const playerIndex=playerIndexFor(playerName);
        const queue=typeof pickOrder!=="undefined"&&Array.isArray(pickOrder)?pickOrder:null;
        const current=typeof currentPickIndex!=="undefined"?Number(currentPickIndex):0;
        const penalty=Math.max(0,Number(amount)||0);
        if(!data||playerIndex<0||!penalty||data.activationQueuePenaltyApplied) return {applied:false,pending:0};
        // Drzemka jest jednorazowym kosztem pierwszego Wgryzienia. Nie ma
        // żadnego carry-over do późniejszych paczek ani akcji Brzucha.
        data.pendingQueuePenalty=0;
        if(!queue||!queue.length||typeof draftFinished!=="undefined"&&draftFinished){
            data.activationQueuePenaltyApplied=true;
            data.activationQueueShift={from:null,to:null,moved:0,requested:penalty,reason:"no_future_pick"};
            return {applied:false,pending:0,moved:0,remaining:0};
        }
        const searchStart=options.includeCurrent===false
            ? (queue[current]===playerIndex?current+1:Math.max(0,current))
            : Math.max(0,current);
        const from=queue.findIndex((value,index)=>index>=searchStart&&value===playerIndex);
        if(from<0){
            data.activationQueuePenaltyApplied=true;
            data.activationQueueShift={from:null,to:null,moved:0,requested:penalty,reason:"no_future_pick"};
            return {applied:false,pending:0,moved:0,remaining:0};
        }
        const [entry]=queue.splice(from,1);
        const to=Math.min(queue.length,from+penalty);
        queue.splice(to,0,entry);
        const moved=Math.max(0,to-from);
        data.activationQueuePenaltyApplied=true;
        data.activationQueueShift={from,to,moved,requested:penalty,reason:"first_devour"};
        global.updateRoundQueueDisplay?.();
        return {applied:moved>0,from,to,moved,remaining:0,pending:0};
    }

    function applyPendingQueuePenalty(playerName){
        const data=dinoState(playerName);
        if(!data) return {applied:false,pending:0};
        // Migracja starych zapisów: nigdy nie nakładamy zaległej kary.
        data.pendingQueuePenalty=0;
        return {applied:false,pending:0};
    }

    function onQueuePrepared(){
        playersList().forEach(playerName=>applyPendingQueuePenalty(playerName));
    }

    function onPickCompleted(context={}){
        const playerIndex=Number(context.playerIndex);
        const playerName=playersList()[playerIndex];
        const data=playerName?dinoState(playerName):null;
        if(!data?.bellyLocked) return false;
        data.bellyLocked=false;
        data.unlockedAt={
            packNumber:(typeof packStartIndex!=="undefined"?Number(packStartIndex):0)+1,
            pickIndex:typeof currentPickIndex!=="undefined"?Number(currentPickIndex):0,
            source:String(context.source||"pack")
        };
        global.DraftStateEngine?.log?.("devil_dino_belly_unlocked",{
            packNumber:data.unlockedAt.packNumber,pickIndex:data.unlockedAt.pickIndex,playerIndex,player:playerName,
            reason:"owner_full_pick_completed",data:{powerId:POWER_ID,bellyCount:bellyEntries(playerName).length}
        });
        global.SuperpowerFeedback?.event?.(POWER_ID,"MOON GIRL CALL: DEVIL!","Brzuch Dino został odblokowany i może być użyty w odpowiednim oknie draftu.");
        global.showDecks?.();
        return true;
    }

    function nextWindow(context){
        return `dino-${String(context||"window")}-${Date.now()}-${++windowSequence}`;
    }

    function consumeDinoBellyCard(request={}){
        const context=String(request.context||"");
        const playerName=String(request.playerName||playersList()[Number(request.playerIndex)]||"");
        const playerIndex=playerIndexFor(playerName);
        const data=dinoState(playerName);
        const entry=getEntry(playerName,request.entryId);
        const windowId=String(request.resolutionWindowId||nextWindow(context));
        if(!ALLOWED_CONTEXTS.has(context)) return {ok:false,reason:"Dino nie może teraz wykonać tej akcji."};
        if(!data||playerIndex<0) return {ok:false,reason:"Brzuch Dino nie istnieje dla tego gracza."};
        if(data.bellyLocked) return {ok:false,reason:"Brzuch odblokuje się po następnym pełnym picku właściciela Dino."};
        if(!entry) return {ok:false,reason:"Wybranej karty nie ma już w Brzuchu."};
        data.consumedWindowIds=Array.isArray(data.consumedWindowIds)?data.consumedWindowIds:[];
        if(data.consumedWindowIds.includes(windowId)) return {ok:false,reason:"Brzuch już zadziałał przy tym rozstrzygnięciu."};
        if(typeof request.effect!=="function") return {ok:false,reason:"Dino nie może teraz wykonać tej akcji."};

        let tx=null;
        if(!request.externalTransaction){
            tx=global.DraftFoundation?.beginTransaction?.(`devil_dino_${context}`,{
                powerId:POWER_ID,playerName,playerIndex,runtimeEntryId:entry.runtimeEntryId,resolutionWindowId:windowId
            });
            if(!tx?.ok) return {ok:false,reason:"Najpierw dokończ bieżące rozstrzygnięcie."};
        }
        try{
            const effectResult=request.effect(entry);
            if(effectResult?.ok===false) throw new Error(effectResult.reason||"Efekt Brzucha został odrzucony.");
            const removed=global.DraftFoundation?.removeCardFromRuntimeZone?.(ZONE,entry.runtimeEntryId,{
                reason:`devil_dino_${context}_consumed`,
                nextZone:request.nextZone||null,
                zoneContext:request.zoneContext||{}
            });
            if(!removed) throw new Error("Karta nie mogła opuścić Brzucha.");
            data.consumedWindowIds.push(windowId);
            if(data.consumedWindowIds.length>80) data.consumedWindowIds=data.consumedWindowIds.slice(-80);
            const history={
                context,windowId,runtimeEntryId:entry.runtimeEntryId,sourceInstanceId:entry.card?.instanceId||null,
                sourceCard:entry.card?.name||null,resultCard:request.resultCard?.name||entry.card?.name||null,
                queuePenalty:0,queue:null,packNumber:(typeof packStartIndex!=="undefined"?Number(packStartIndex):0)+1,
                pickIndex:typeof currentPickIndex!=="undefined"?Number(currentPickIndex):0,timestamp:Date.now()
            };
            data.consumptionHistory=Array.isArray(data.consumptionHistory)?data.consumptionHistory:[];
            data.consumptionHistory.push(history);
            if(context==="deckBackup") data.pendingBackup=null;
            global.DraftStateEngine?.log?.("devil_dino_belly_consumed",{
                packNumber:history.packNumber,pickIndex:history.pickIndex,playerIndex,player:playerName,
                sourceCard:entry.card,resultCard:request.resultCard||entry.card,reason:context,
                data:{powerId:POWER_ID,runtimeEntryId:entry.runtimeEntryId,resolutionWindowId:windowId,queuePenalty:0,queue:null}
            });
            global.superpowerLog=Array.isArray(global.superpowerLog)?global.superpowerLog:[];
            global.superpowerLog.push({type:"superpower_resolution",event:`devil_dino_${context}`,playerName,playerIndex,powerId:POWER_ID,
                card:entry.card?.name||null,resultCard:request.resultCard?.name||entry.card?.name||null,queuePenalty:0,
                packNumber:history.packNumber,pickIndex:history.pickIndex,timestamp:new Date().toISOString()});
            if(tx) global.DraftFoundation?.commitTransaction?.(tx.transactionId,{powerId:POWER_ID,context,windowId});
            global.showDecks?.();
            if(global.GalacticCurrentSuperpowerBridge?.isModeEnabled?.()) global.GalacticCurrent?.refresh?.();
            else global.showPack?.(false);
            global.updateRoundQueueDisplay?.();
            return {ok:true,entry:removed,effectResult,queue:null,windowId};
        }catch(error){
            if(tx) global.DraftFoundation?.rollbackTransaction?.(tx.transactionId,{powerId:POWER_ID,context,reason:error?.message||"consume_failed"});
            return {ok:false,reason:error?.message||"Zużycie Brzucha zostało bezpiecznie cofnięte.",rolledBack:Boolean(tx)};
        }
    }

    function ensureOverlay(){
        let overlay=document.getElementById("spxDinoOverlay");
        if(overlay) return overlay;
        overlay=document.createElement("div");
        overlay.id="spxDinoOverlay";
        overlay.className="spx-dino-overlay";
        overlay.hidden=true;
        overlay.innerHTML=`
            <section class="spx-dino-dialog" role="dialog" aria-modal="true" aria-labelledby="spxDinoTitle">
                <header class="spx-dino-head">
                    <img class="spx-dino-belly-emblem" src="${ASSETS.belly}" alt="">
                    <div><span class="spx-dino-belly-kicker">🦖 BRZUCH DINO</span><h2 id="spxDinoTitle">BRZUCH DINO</h2><p id="spxDinoLead"></p></div>
                    <button type="button" class="spx-dino-close" data-dino-action="close" aria-label="Zamknij">×</button>
                </header>
                <div id="spxDinoBody" class="spx-dino-body"></div>
                <footer id="spxDinoFooter" class="spx-dino-footer"></footer>
            </section>`;
        document.body.appendChild(overlay);
        overlay.addEventListener("click",event=>{
            const action=event.target.closest?.("[data-dino-action]")?.dataset?.dinoAction;
            if(action==="close") closeOverlay();
            if(action==="back") renderBellyHome();
            if(action==="confirm") confirmBellyAction();
            if(action==="decline-final") declineFinalExchange();
            const context=event.target.closest?.("[data-dino-context]")?.dataset?.dinoContext;
            if(context) beginBellyAction(context);
            const entry=event.target.closest?.("[data-dino-entry]")?.dataset?.dinoEntry;
            if(entry&&ui.phase==="belly_action"){ui.bellyEntryId=entry;renderBellyAction();}
            const target=event.target.closest?.("[data-dino-target]")?.dataset?.dinoTarget;
            if(target){ui.targetInstanceId=target;renderBellyAction();}
        });
        return overlay;
    }

    function closeOverlay(options={}){
        if(ui.committing&&!options.force) return false;
        const overlay=document.getElementById("spxDinoOverlay");
        if(overlay) overlay.hidden=true;
        ui.phase="idle";ui.action="";ui.bellyEntryId="";ui.targetInstanceId="";ui.resolutionWindowId="";ui.inlineMessage="";
        return true;
    }

    function showOverlay(){ensureOverlay().hidden=false;}

    function currentPickerIndex(){
        if(typeof pickOrder==="undefined"||!Array.isArray(pickOrder)) return -1;
        return Number(pickOrder[typeof currentPickIndex!=="undefined"?Number(currentPickIndex):0]);
    }

    function getStatus(playerName){
        const record=engineRecord(playerName);
        const data=dinoState(playerName);
        const count=bellyEntries(playerName).length;
        return {
            assigned:Boolean(record&&record.powerId===POWER_ID),
            used:Boolean(record?.used),
            bellyCount:count,
            locked:Boolean(data?.bellyLocked),
            pendingQueuePenalty:0,
            pendingBackup:data?.pendingBackup?clone(data.pendingBackup):null,
            finalExchangeResolved:Boolean(data?.finalExchangeResolved),
            canOpen:Boolean(record?.used&&(count>0||data?.pendingBackup))
        };
    }

    function availableContexts(playerName){
        const data=dinoState(playerName);
        const index=playerIndexFor(playerName);
        if(!data||data.bellyLocked||!bellyEntries(playerName).length) return [];
        const contexts=[];
        if(data.pendingBackup) contexts.push("deckBackup");
        if(typeof draftFinished!=="undefined"&&draftFinished&&!data.finalExchangeResolved){contexts.push("finalExchange");return contexts;}
        if(typeof packIsOpen!=="undefined"&&packIsOpen&&!(typeof packOpeningInProgress!=="undefined"&&packOpeningInProgress)&&!(typeof packEnding!=="undefined"&&packEnding)){
            if(currentPickerIndex()===index) contexts.push("pickReplacement");
            else contexts.push("packReplacement");
        }
        return contexts;
    }

    function openBelly(playerName,options={}){
        const status=getStatus(playerName);
        if(!status.assigned){global.SuperpowerFeedback?.warning?.(POWER_ID,"BRZUCH NIE NALEŻY DO TEGO GRACZA","Ten gracz nie posiada mocy Devil Dino.");return false;}
        ui.playerName=String(playerName);
        ui.playerIndex=playerIndexFor(playerName);
        ui.phase="belly";
        ui.action="";
        ui.bellyEntryId="";
        ui.targetInstanceId="";
        ui.resolutionWindowId="";
        showOverlay();
        if(options.context&&ALLOWED_CONTEXTS.has(options.context)) beginBellyAction(options.context);
        else renderBellyHome();
        return true;
    }

    function contextCopy(context){
        return {
            pickReplacement:["PICK Z BRZUCHA","Wybierz jedną połkniętą kartę. Zastąpi Twój normalny wybór."],
            packReplacement:["WYPLUCIE DO PACZKI","Przed ruchem innego gracza wstaw jedną zdobycz z Brzucha w miejsce wybranej karty paczki."],
            deckBackup:["ODRUCH ŻOŁĄDKOWY","Po wrogiej zmianie decku Brzuch może wypluć zdobycz i odbić najnowszy wrogi rezultat. Może też zadziałać, gdy Dino musi postawić kartę na szali przyszłego wydarzenia."],
            finalExchange:["OSTATNIE TRAWIENIE","Na końcu draftu wymień jedną kartę z Brzucha 1:1 za kartę o najniższej Sile w swoim decku."]
        }[context]||["BRZUCH DINO","Moon Girl pilnuje zdobyczy. Wybierz, co Dino ma zrobić."];
    }

    function contextAvailability(context){
        const data=dinoState(ui.playerName);
        const entries=bellyEntries(ui.playerName);
        if(!entries.length) return {available:false,reason:"Brzuch jest pusty."};
        if(data?.bellyLocked) return {available:false,reason:"Dino śpi. Brzuch odblokuje się po jego następnym pełnym wyborze."};
        if(availableContexts(ui.playerName).includes(context)) return {available:true,reason:"Dostępne teraz."};
        if(context==="deckBackup") return {available:false,reason:"Odblokuje się po wrogiej zmianie Twojego decku."};
        if(context==="finalExchange") return {available:false,reason:"Odblokuje się po zakończeniu draftu."};
        if(typeof packIsOpen==="undefined"||!packIsOpen) return {available:false,reason:"Wymaga otwartej paczki."};
        if(context==="pickReplacement") return {available:false,reason:"Dostępne podczas pełnego wyboru Dino."};
        if(context==="packReplacement") return {available:false,reason:"Dostępne przed ruchem przeciwnika."};
        return {available:false,reason:"To okno nie jest teraz aktywne."};
    }

    function floatingBellyCardsMarkup(entries,limit=4){
        return entries.slice(0,limit).map((entry,index)=>`<span class="spx-dino-floating-card" style="--dino-float-index:${index}">${cardVisualMarkup(entry.card)}</span>`).join("");
    }

    function createBellyBadge(playerName,options={}){
        const entries=bellyEntries(playerName);
        const data=dinoState(playerName);
        const badge=document.createElement("span");
        badge.className=`spg-dino-belly-badge${options.compact?" is-compact":""}${data?.bellyLocked?" is-sleeping":""}`;
        badge.dataset.cardCount=String(Math.min(entries.length,3));
        badge.innerHTML=`
            <img class="spg-dino-belly-art" src="${ASSETS.belly}" alt="">
            <span class="spg-dino-belly-floaters">${floatingBellyCardsMarkup(entries,3)}</span>
            <b>${entries.length}</b>
            ${data?.bellyLocked?`<span class="spg-dino-belly-zzz"><img src="${ASSETS.sleeping}" alt="">ZZZ</span>`:"<small>OTWÓRZ BRZUCH</small>"}`;
        return badge;
    }

    function renderBellyHome(){
        const data=dinoState(ui.playerName);
        const entries=bellyEntries(ui.playerName);
        const overlay=ensureOverlay();
        overlay.querySelector("#spxDinoTitle").textContent="BRZUCH DINO";
        overlay.querySelector("#spxDinoLead").textContent=data?.bellyLocked
            ? "💤 DINO JESZCZE TRAWI. Brzuch odblokuje się po jego następnym pełnym wyborze."
            : "Moon Girl pilnuje zdobyczy. Wybierz, co Dino ma zrobić.";
        overlay.querySelector("#spxDinoBody").innerHTML=`
            <div class="spx-dino-status ${data?.bellyLocked?"is-locked":"is-ready"}">
                <span>${data?.bellyLocked?"PREHISTORYCZNA DRZEMKA":"BRZUCH GOTOWY"}</span>
                <strong>${entries.length} ${entries.length===1?"KARTA":"KARTY"}</strong>
                <small>${data?.bellyLocked?"Odblokowanie: po następnym pełnym wyborze Dino.":"Każdą połkniętą kartę możesz wykorzystać tylko raz."}</small>
            </div>
            <div class="spx-dino-belly-vessel${data?.bellyLocked?" is-locked":""}" data-card-count="${Math.min(entries.length,4)}" aria-label="Brzuch Dino: ${entries.length} kart">
                <img src="${ASSETS.belly}" alt="Brzuch Devil Dino">
                <span class="spx-dino-belly-floaters" data-card-count="${Math.min(entries.length,4)}">${floatingBellyCardsMarkup(entries)}</span>
                <span class="spx-dino-belly-count">${entries.length}</span>
                <span class="spx-dino-belly-caption">${data?.bellyLocked?"DINO ŚPI":"KARTY W BRZUCHU"}</span>
                ${data?.bellyLocked?`<span class="spx-dino-belly-sleeper"><img src="${ASSETS.sleeping}" alt="Śpiący Devil Dino"><b>ZZZ</b></span>`:""}
            </div>
            <section class="spx-dino-inventory"><h3>MOŻLIWE KARTY DO WYPLUCIA</h3><div class="spx-dino-belly-grid">${entries.length?entries.map(entry=>bellyCardMarkup(entry,{interactive:false})).join(""):"<p class='spx-dino-empty'>Brzuch jest pusty.</p>"}</div></section>
            <section class="spx-dino-actions-map"><h3>CO MOŻE ZROBIĆ BRZUCH?</h3><div class="spx-dino-contexts">${BELLY_CONTEXT_ORDER.map(context=>{
                const [title,copy]=contextCopy(context);
                const availability=contextAvailability(context);
                return `<button type="button" class="${availability.available?"is-available":"is-locked"}" data-dino-context="${context}" ${availability.available?"":"disabled"}><b>${escapeHtml(title)}</b><span>${escapeHtml(copy)}</span><small>${availability.available?"✓ ":""}${escapeHtml(availability.reason)}</small>${availability.available?"":`<i class="spx-dino-context-claw"><img src="${ASSETS.claws}" alt="Zablokowane"></i>`}</button>`;
            }).join("")}</div></section>
            <aside class="spx-dino-moon-tip"><b>PODPOWIEDŹ MOON GIRL</b><span>Każdą połkniętą kartę możesz wykorzystać tylko raz. Niedostępne odruchy pozostają widoczne.</span></aside>`;
        overlay.querySelector("#spxDinoFooter").innerHTML=`<button type="button" data-dino-action="close">WRÓĆ DO DRAFTU</button>`;
    }

    function bellyCardMarkup(entry,options={}){
        const card=entry.card||{};
        const selected=String(entry.runtimeEntryId)===String(ui.bellyEntryId);
        const interactive=options.interactive!==false;
        const tag=interactive?"button":"article";
        return `<${tag}${interactive?' type="button"':""} class="spx-dino-belly-card${selected?" is-selected":""}${interactive?"":" is-preview"}"${interactive?` data-dino-entry="${escapeHtml(entry.runtimeEntryId)}"`:""}>
            <span class="spx-dino-card-shell">${cardVisualMarkup(card,"spx-dino-inventory-card")}</span>
            <span>${card.joker?"JOKER":`${printedCost(card)} KOSZT`}</span><strong>${escapeHtml(card.name||"Nieznana karta")}</strong><small>${card.joker?"Gotowy do użycia":`${Number(card.power)||0} SIŁA`}</small>
        </${tag}>`;
    }

    function legalPackTargets(context){
        return packList().filter(card=>{
            if(!card||spiderProtected(card)||strangeLocked(card)) return false;
            if(context==="pickReplacement"&&currentPickerIndex()!==ui.playerIndex) return false;
            if(context==="packReplacement"&&currentPickerIndex()===ui.playerIndex) return false;
            return true;
        });
    }

    function finalTargets(){
        const deck=decksList()[ui.playerIndex]||[];
        if(!deck.length) return [];
        const min=Math.min(...deck.map(card=>Number(card?.power)||0));
        return deck.filter(card=>(Number(card?.power)||0)===min);
    }

    function backupTarget(){
        const data=dinoState(ui.playerName);
        const deck=decksList()[ui.playerIndex]||[];
        const pending=data?.pendingBackup;
        if(!pending) return null;
        return deck.find(card=>String(card?.instanceId||"")===String(pending.targetCardInstanceId||""))||deck[Number(pending.targetIndex)]||null;
    }

    function beginBellyAction(context){
        if(!availableContexts(ui.playerName).includes(context)){
            global.SuperpowerFeedback?.warning?.(POWER_ID,"BRZUCH JESZCZE ŚPI","To okno użycia Brzucha nie jest teraz dostępne.");
            renderBellyHome();
            return false;
        }
        ui.action=context;
        ui.inlineMessage="";
        ui.phase="belly_action";
        ui.bellyEntryId="";
        ui.targetInstanceId="";
        ui.resolutionWindowId=nextWindow(context);
        renderBellyAction();
        return true;
    }

    function renderBellyAction(){
        const overlay=ensureOverlay();
        const [title,lead]=contextCopy(ui.action);
        const entries=bellyEntries(ui.playerName);
        const targets=ui.action==="finalExchange"?finalTargets():ui.action==="deckBackup"?[backupTarget()].filter(Boolean):legalPackTargets(ui.action);
        overlay.querySelector("#spxDinoTitle").textContent=title;
        overlay.querySelector("#spxDinoLead").textContent=lead;
        const targetStep=ui.action==="pickReplacement"
            ? `<section class="spx-dino-step"><h3>2. NORMALNY WYBÓR DINO USTĄPI</h3><p class="spx-dino-empty">Dino wypluje wybraną kartę, a jedna odpowiednia karta paczki odejdzie losowo.</p></section>`
            : `<section class="spx-dino-step"><h3>2. ${ui.action==="deckBackup"?"WROGI REZULTAT DO ODBICIA":"WYBIERZ CEL WYMIANY"}</h3><div class="spx-dino-target-grid">${targets.length?targets.map(card=>targetMarkup(card)).join(""):"<p class='spx-dino-empty'>Brak dostępnego celu.</p>"}</div></section>`;
        const inlineMessage=ui.inlineMessage?`<div class="spx-dino-inline-message">${escapeHtml(ui.inlineMessage)}</div>`:"";
        overlay.querySelector("#spxDinoBody").innerHTML=`
            ${inlineMessage}
            <section class="spx-dino-step"><h3>1. WYBIERZ KARTĘ Z BRZUCHA</h3><div class="spx-dino-belly-grid">${entries.map(entry=>bellyCardMarkup(entry)).join("")}</div></section>
            ${targetStep}`;
        const ready=Boolean(ui.bellyEntryId&&(ui.action==="pickReplacement"?targets.length:(ui.action==="deckBackup"?targets.length:ui.targetInstanceId)));
        overlay.querySelector("#spxDinoFooter").innerHTML=`
            <button type="button" data-dino-action="back">← WRÓĆ</button>
            ${ui.action==="finalExchange"?'<button type="button" data-dino-action="decline-final">POMIŃ OSTATNIĄ UCZTĘ</button>':""}
            <button type="button" class="is-primary" data-dino-action="confirm" ${ready?"":"disabled"}>ZATWIERDŹ WYMIANĘ</button>`;
    }

    function targetMarkup(card){
        const selected=String(card?.instanceId||"")===String(ui.targetInstanceId);
        const forced=ui.action==="deckBackup";
        if(forced&&!ui.targetInstanceId) ui.targetInstanceId=String(card?.instanceId||"");
        return `<button type="button" class="spx-dino-target${selected||forced?" is-selected":""}" data-dino-target="${escapeHtml(card?.instanceId||"")}" ${forced?"aria-pressed='true'":""}>
            <strong>${escapeHtml(card?.name||"Nieznana karta")}</strong><span>${Number(card?.cost)||0} KOSZT • ${Number(card?.power)||0} SIŁA</span>
        </button>`;
    }

    function resolveJokerForDeck(entry,context,onResolve){
        if(!entry?.card?.joker){onResolve(entry?.card);return true;}
        // Nie resetujemy tu kontekstu akcji. Joker jest osobnym widokiem tej
        // samej transakcji, a po jego rozstrzygnięciu wracamy do Brzucha.
        ensureOverlay().hidden=true;
        const opened=global.JokerV2UI?.resolveForEffect?.(entry.card,{
            playerIndex:ui.playerIndex,sourceZone:ZONE,sourcePowerId:POWER_ID,sourceEvent:`devil_dino_${context}_joker`,
            onResolve:resolved=>{showOverlay();onResolve(resolved);},
            onCancel:()=>{ui.committing=false;showOverlay();renderBellyAction();}
        });
        if(!opened){ui.committing=false;ui.inlineMessage="Jokera nie można teraz użyć z Brzucha.";showOverlay();renderBellyAction();}
        return Boolean(opened);
    }

    function archiveResolvedJokerOptions(card,context){
        if(typeof global.archivePendingJokerRejections==="function"){
            global.archivePendingJokerRejections(card,{source:`devil_dino_${context}`,powerId:POWER_ID,
                previousOwner:null,resolutionPath:`devil_dino_${context}`});
        }
    }

    function confirmBellyAction(){
        if(ui.committing) return false;
        const entry=getEntry(ui.playerName,ui.bellyEntryId);
        if(!entry){renderBellyAction();return false;}
        ui.committing=true;
        const finish=resolvedCard=>{
            const result=commitBellyAction(entry,resolvedCard);
            ui.committing=false;
            if(!result?.ok){ui.inlineMessage=result?.reason||"Nie udało się użyć Brzucha.";showOverlay();renderBellyAction();}
        };
        if(ui.action==="packReplacement") finish(entry.card);
        else resolveJokerForDeck(entry,ui.action,finish);
        return true;
    }

    function commitBellyAction(entry,resolvedCard){
        const context=ui.action;
        const deck=decksList()[ui.playerIndex]||[];
        const pickTargets=context==="pickReplacement"?legalPackTargets(context):[];
        const target= context==="deckBackup"?backupTarget():
            context==="pickReplacement"?(pickTargets.length?pickTargets[Math.floor(Math.random()*pickTargets.length)]:null):
            context==="finalExchange"?finalTargets().find(card=>String(card?.instanceId||"")===String(ui.targetInstanceId)):
            packList().find(card=>String(card?.instanceId||"")===String(ui.targetInstanceId));
        if(!target) return {ok:false,reason:"Cel wymiany nie jest już dostępny."};
        let rocketResult=null;
        const result=consumeDinoBellyCard({
            context,playerName:ui.playerName,playerIndex:ui.playerIndex,entryId:entry.runtimeEntryId,
            resolutionWindowId:ui.resolutionWindowId,resultCard:resolvedCard,
            nextZone:context==="packReplacement"?"pack":"deck",
            effect:()=>{
                if(context==="packReplacement"){
                    const index=packList().indexOf(target);
                    if(index<0||spiderProtected(target)||strangeLocked(target)) return {ok:false,reason:"Ta karta paczki jest chroniona."};
                    if(global.GalacticCurrentSuperpowerBridge?.isModeEnabled?.()){
                        global.DraftFoundation?.resolvePackCardLifecycle?.("trueReplacement",target,{fromZone:"current",toZone:"current",reason:"devil_dino_pack_replacement",powerId:POWER_ID,replacementCard:resolvedCard});
                        global.removeRocketBombWithCard?.(target,"devil_dino_pack_replacement",{replacementPowerId:POWER_ID,replacementCard:resolvedCard?.name});
                        const replaced=global.GalacticCurrentSuperpowerBridge.replaceLiveCard?.(index,resolvedCard,{source:"devil_dino_pack_replacement",inheritFlowAge:true,render:false});
                        if(!replaced?.ok) return replaced;
                        global.DraftFoundation?.archiveCardToGraveyard?.("replaced",target,{previousOwner:null,source:"devil_dino_pack_replacement",powerId:POWER_ID,recoverable:true,skipGrootHarvest:true,metadata:{replacementCardInstanceId:resolvedCard?.instanceId||null,draftMode:"galactic_current"}});
                        return {ok:true,sourceCard:target,replacementCard:resolvedCard,index};
                    }
                    return global.DraftFoundation?.replaceCardInArray?.({container:packList(),index,replacement:resolvedCard,preserveReplacementInstance:true,graveyardCategory:"replaced",reason:"devil_dino_pack_replacement",eventType:"devil_dino_pack_replacement",powerId:POWER_ID,zone:"pack",recoverable:true})||{ok:false,reason:"Nie udało się podmienić karty w paczce."};
                }
                if(context==="pickReplacement"){
                    const index=packList().indexOf(target);
                    const questPackSnapshotBeforePick=global.DraftQuestEngine?.capturePackSnapshot?.(packList())||null;
                    if(index<0||spiderProtected(target)||strangeLocked(target)) return {ok:false,reason:"Ta karta nie może teraz opuścić paczki."};
                    if(global.GalacticCurrentSuperpowerBridge?.isModeEnabled?.()){
                        const picked=global.GalacticCurrentSuperpowerBridge.resolveExternalNormalPick?.(index,ui.playerIndex,resolvedCard,{powerId:POWER_ID,render:false});
                        if(!picked?.ok) return picked;
                        rocketResult=picked.rocketResult||null;
                        archiveResolvedJokerOptions(resolvedCard,context);
                        return {ok:true,index,removedPackCard:target,resultCard:resolvedCard,rocketResult,galacticCurrent:true};
                    }
                    global.GrootUI?.harvestCard?.(target,"devil_dino_pick_slot",{natural:false,perfectEligible:false,mode:"classic",sourcePowerId:POWER_ID});
                    if(typeof removeRocketBombWithCard==="function") removeRocketBombWithCard(target,"devil_dino_pick_slot",{replacementPowerId:POWER_ID});
                    if(typeof clearDoctorStrangeLockForCard==="function") clearDoctorStrangeLockForCard(target,"devil_dino_pick_slot");
                    global.MysterioUI?.onCardLeavesPack?.(target,{reason:"devil_dino_pick_replacement_slot",fromZone:"pack",toZone:"graveyard"});
                    packList().splice(index,1);
                    global.DraftFoundation?.archiveCardToGraveyard?.("unpicked",target,{previousOwner:null,source:"devil_dino_pick_replacement_slot",powerId:POWER_ID,metadata:{bellyCardInstanceId:resolvedCard?.instanceId||null}});
                    const acquired=global.DraftFoundation?.acquireCardToDeck?.({playerIndex:ui.playerIndex,sourceCard:entry.card,resolvedCard,preserveInstance:true,sourceZone:ZONE,acquisitionType:"devil_dino_pick_replacement",eventType:"devil_dino_belly_pick",reason:"devil_dino_pick_replacement",powerId:POWER_ID});
                    if(!acquired?.ok) return acquired;
                    rocketResult=acquired.rocketResult||null;
                    if(typeof consumeProfessorXControl==="function") consumeProfessorXControl(ui.playerIndex,resolvedCard);
                    if(typeof recordDraftPickEvent==="function") recordDraftPickEvent(ui.playerIndex,resolvedCard,index,"devil_dino_belly",{sourceCard:entry.card,resultCard:resolvedCard,data:{runtimeEntryId:entry.runtimeEntryId,replacedPackCardInstanceId:target.instanceId||null},questContext:{packSnapshotBeforePick:questPackSnapshotBeforePick,pickedPackIndex:index,pickedPackCardInstanceId:target.instanceId||null}});
                    archiveResolvedJokerOptions(resolvedCard,context);
                    return {ok:true,index,removedPackCard:target,resultCard:resolvedCard,rocketResult};
                }
                const targetIndex=deck.indexOf(target);
                if(targetIndex<0) return {ok:false,reason:"Karta decku zmieniła się przed zatwierdzeniem."};
                const acquired=global.DraftFoundation?.acquireCardToDeck?.({
                    playerIndex:ui.playerIndex,sourceCard:entry.card,resolvedCard,preserveInstance:true,replacementIndex:targetIndex,
                    sourceZone:ZONE,acquisitionType:`devil_dino_${context}`,eventType:`devil_dino_${context}`,
                    reason:`devil_dino_${context}`,powerId:POWER_ID,graveyardCategory:"replaced",recoverable:true
                });
                if(!acquired?.ok) return acquired;
                rocketResult=acquired.rocketResult||null;
                archiveResolvedJokerOptions(resolvedCard,context);
                return {ok:true,targetIndex,previousCard:target,resultCard:resolvedCard,rocketResult};
            }
        });
        if(!result.ok) return result;
        if(context==="finalExchange"){
            const data=dinoState(ui.playerName);
            data.finalExchangeResolved=true;
            archiveUnusedBelly(ui.playerName,"devil_dino_post_final_exchange");
        }
        closeOverlay({force:true});
        global.SuperpowerFeedback?.event?.(POWER_ID,
            context==="pickReplacement"?"DINO ZAGRAŁ KARTĘ Z BRZUCHA":context==="deckBackup"?"DINO ODZYSKUJE ZDOBYCZ":context==="finalExchange"?"OSTATNIA UCZTA ZAKOŃCZONA":"DINO PODMIENIA KARTĘ W PACZCE",
            resolvedCard?.name?`Wykorzystano: ${resolvedCard.name}.`:"Brzuch Dino rozstrzygnął wymianę."
        );
        const finish=()=>{
            if(context==="pickReplacement"){
                if(global.GalacticCurrentSuperpowerBridge?.isModeEnabled?.()) global.GalacticCurrentSuperpowerBridge.advanceExternalTurn?.();
                else global.nextPickOrPack?.();
            }
            if(context==="finalExchange") global.continuePostDraftAfterGrootGardens?.();
        };
        if(rocketResult?.triggered&&global.SuperpowerUI?.resolveRocketBomb) global.SuperpowerUI.resolveRocketBomb(rocketResult,finish);
        else finish();
        return result;
    }

    function ensureBackupPrompt(){
        if(typeof document==="undefined") return null;
        let overlay=document.getElementById("spxDinoBackupPrompt");
        if(overlay) return overlay;
        overlay=document.createElement("div");
        overlay.id="spxDinoBackupPrompt";
        overlay.className="spx-dino-backup-prompt";
        overlay.hidden=true;
        overlay.innerHTML=`
            <section role="dialog" aria-modal="true" aria-labelledby="spxDinoBackupTitle">
                <img src="${ASSETS.belly}" alt="" aria-hidden="true">
                <div><small>ODRUCH BEZWARUNKOWY</small><h2 id="spxDinoBackupTitle">BRZUCH DINO ZAREAGOWAŁ</h2>
                <p>Wroga moc zmieniła kartę w Twoim decku. Możesz teraz otworzyć Brzuch i odzyskać jedną zdobycz.</p></div>
                <footer><button type="button" data-dino-backup="dismiss">NIE TERAZ</button><button type="button" class="is-primary" data-dino-backup="open">OTWÓRZ BRZUCH</button></footer>
            </section>`;
        document.body.appendChild(overlay);
        overlay.addEventListener("click",event=>{
            const action=event.target.closest?.("[data-dino-backup]")?.dataset?.dinoBackup;
            if(!action) return;
            const playerName=overlay.dataset.playerName||"";
            const mutationId=overlay.dataset.mutationId||"";
            overlay.hidden=true;
            if(action==="dismiss") dismissPendingBackup(playerName,mutationId);
            else{
                const data=dinoState(playerName);
                if(data?.pendingBackup&&String(data.pendingBackup.mutationId)===mutationId){
                    openBelly(playerName,{context:"deckBackup"});
                }
            }
        });
        return overlay;
    }

    function dismissPendingBackup(playerName,mutationId){
        const data=dinoState(playerName);
        if(!data?.pendingBackup||String(data.pendingBackup.mutationId)!==String(mutationId||"")) return false;
        const dismissed=clone(data.pendingBackup);
        data.pendingBackup=null;
        global.DraftStateEngine?.log?.("devil_dino_backup_dismissed",{
            packNumber:(typeof packStartIndex!=="undefined"?Number(packStartIndex):0)+1,
            pickIndex:typeof currentPickIndex!=="undefined"?Number(currentPickIndex):0,
            playerIndex:playerIndexFor(playerName),player:playerName,reason:"player_declined",
            data:{powerId:POWER_ID,...dismissed}
        });
        global.showDecks?.();
        return true;
    }

    function hostileSequenceBusy(){
        return Boolean(
            global.SuperpowerUI?.isBusy?.() || global.ThorUI?.isBusy?.() ||
            global.WolverineUI?.isBusy?.() || global.IronFistUI?.isBusy?.() ||
            global.GrootUI?.isBusy?.() || global.JokerV2UI?.isBusy?.() ||
            global.DraftFoundation?.hasOpenTransaction?.()
        );
    }

    function scheduleBackupPrompt(playerName,mutationId,attempt=0){
        global.setTimeout?.(()=>{
            const data=dinoState(playerName);
            if(!data?.pendingBackup||String(data.pendingBackup.mutationId)!==String(mutationId)) return;
            if(hostileSequenceBusy()){
                scheduleBackupPrompt(playerName,mutationId,attempt+1);
                return;
            }
            const overlay=ensureBackupPrompt();
            if(!overlay) return;
            overlay.dataset.playerName=playerName;
            overlay.dataset.mutationId=String(mutationId);
            overlay.hidden=false;
        },attempt?180:80);
    }

    function notifyHostileDeckChange(payload={}){
        const playerIndex=Number(payload.targetPlayerIndex??payload.playerIndex);
        const playerName=playersList()[playerIndex];
        const record=playerName?engineRecord(playerName):null;
        const data=playerName?dinoState(playerName):null;
        if(!record?.used||record.powerId!==POWER_ID||!data||data.bellyLocked||!bellyEntries(playerName).length) return false;
        const targetCardInstanceId=String(payload.targetCardInstanceId||payload.replacementCardInstanceId||"");
        const deck=decksList()[playerIndex]||[];
        const targetIndex=targetCardInstanceId?deck.findIndex(card=>String(card?.instanceId||"")===targetCardInstanceId):Number(payload.targetIndex);
        if(targetIndex<0||!deck[targetIndex]) return false;
        data.pendingBackup={
            mutationId:String(payload.mutationId||`hostile-${Date.now()}-${targetCardInstanceId}`),
            sourcePowerId:payload.sourcePowerId||null,
            sourceEvent:payload.sourceEvent||"hostile_deck_change",
            targetIndex,
            targetCardInstanceId:deck[targetIndex].instanceId||null,
            targetCardName:deck[targetIndex].name||null,
            previousCardInstanceId:payload.previousCardInstanceId||null,
            previousCardName:payload.previousCardName||null,
            createdAt:Date.now()
        };
        global.DraftStateEngine?.log?.("devil_dino_backup_window_opened",{
            packNumber:(typeof packStartIndex!=="undefined"?Number(packStartIndex):0)+1,
            pickIndex:typeof currentPickIndex!=="undefined"?Number(currentPickIndex):0,
            playerIndex,player:playerName,reason:data.pendingBackup.sourceEvent,
            data:{powerId:POWER_ID,...clone(data.pendingBackup)}
        });
        global.showDecks?.();
        scheduleBackupPrompt(playerName,data.pendingBackup.mutationId);
        return true;
    }

    function getKunLunStakeOptions(playerIndex){
        const playerName=playersList()[Number(playerIndex)];
        const data=playerName?dinoState(playerName):null;
        if(!data||data.bellyLocked) return [];
        return bellyEntries(playerName).map(entry=>({entry,card:entry.card}));
    }

    function consumeKunLunStake(request={}){
        const playerIndex=Number(request.playerIndex);
        const playerName=playersList()[playerIndex];
        const entry=bellyEntries(playerName).find(item=>String(item?.card?.instanceId||"")===String(request.cardInstanceId||""));
        if(!entry) return {ok:false,reason:"Wybranej stawki nie ma już w Brzuchu."};
        let escrowEntry=null;
        const result=consumeDinoBellyCard({
            context:"kunLunStake",playerName,playerIndex,entryId:entry.runtimeEntryId,
            resolutionWindowId:String(request.resolutionWindowId||"kun_lun"),externalTransaction:true,
            nextZone:"tournamentEscrow",
            effect:()=>{
                escrowEntry=global.DraftFoundation?.addCardToRuntimeZone?.("tournamentEscrow",entry.card,{
                    ownerIndex:playerIndex,sourcePowerId:"iron_fist",sourceEvent:"devil_dino_kun_lun_stake",
                    metadata:{sessionId:request.resolutionWindowId||null,role:"stake",sourceZone:ZONE,dinoRuntimeEntryId:entry.runtimeEntryId}
                });
                return escrowEntry?{ok:true,escrowEntry}:{ok:false,reason:"K’un-Lun nie przyjęło stawki z Brzucha."};
            }
        });
        return {...result,escrowEntry};
    }

    function archiveUnusedBelly(playerName,reason="devil_dino_unused_belly"){
        const entries=[...bellyEntries(playerName)];
        entries.forEach(entry=>{
            const removed=global.DraftFoundation?.removeCardFromRuntimeZone?.(ZONE,entry.runtimeEntryId,{reason,nextZone:"graveyard"});
            if(removed?.card){
                global.DraftFoundation?.archiveCardToGraveyard?.("digested",removed.card,{
                    previousOwner:playerIndexFor(playerName),source:reason,powerId:POWER_ID,recoverable:true,
                    metadata:{runtimeEntryId:entry.runtimeEntryId,unusedBelly:true}
                });
            }
        });
        return entries.length;
    }

    function pendingFinalPlayers(){
        return playersList().filter(playerName=>{
            const data=dinoState(playerName);
            return Boolean(data&&!data.finalExchangeResolved&&!data.bellyLocked&&bellyEntries(playerName).length);
        });
    }

    function hasPendingFinalExchange(){return pendingFinalPlayers().length>0;}

    function openNextFinalExchange(){
        const playerName=pendingFinalPlayers()[0];
        if(!playerName) return false;
        const data=dinoState(playerName);
        data.finalExchangeOffered=true;
        if(!finalTargetsForPlayer(playerName).length){
            data.finalExchangeResolved=true;
            archiveUnusedBelly(playerName,"devil_dino_no_legal_final_exchange");
            return openNextFinalExchange()||false;
        }
        return openBelly(playerName,{context:"finalExchange"});
    }

    function finalTargetsForPlayer(playerName){
        const index=playerIndexFor(playerName);
        const deck=decksList()[index]||[];
        if(!deck.length) return [];
        const min=Math.min(...deck.map(card=>Number(card?.power)||0));
        return deck.filter(card=>(Number(card?.power)||0)===min);
    }

    function declineFinalExchange(playerName=ui.playerName){
        const data=dinoState(playerName);
        if(!data) return false;
        data.finalExchangeResolved=true;
        archiveUnusedBelly(playerName,"devil_dino_final_exchange_declined");
        closeOverlay();
        if(!openNextFinalExchange()) global.continuePostDraftAfterGrootGardens?.();
        return true;
    }

    function onDraftFinished(){
        // Zablokowany Brzuch nie dostał wymaganego pełnego picku. Nie wolno go
        // odblokować skrótem na końcu draftu, więc karty kończą na Cmentarzysku.
        playersList().forEach(playerName=>{
            const data=dinoState(playerName);
            if(!data||data.finalExchangeResolved||!data.bellyLocked) return;
            data.finalExchangeResolved=true;
            archiveUnusedBelly(playerName,"devil_dino_belly_locked_at_draft_end");
        });
        const pending=pendingFinalPlayers();
        if(!pending.length) return false;
        global.setTimeout?.(()=>openNextFinalExchange(),120);
        return true;
    }

    function reset(){
        resetTransient();
        closeOverlay();
        const overlay=document.getElementById("spxDinoOverlay");
        if(overlay) overlay.hidden=true;
        const backupPrompt=document.getElementById("spxDinoBackupPrompt");
        if(backupPrompt) backupPrompt.hidden=true;
        global.GraveyardUI?.refreshButton?.();
        return true;
    }

    global.DevilDinoUI=Object.freeze({
        POWER_ID,ZONE,MAX_SELECTION,MAX_PRINTED_COST,QUEUE_PENALTY,ASSETS,
        start,reset,handlePackCardClick,afterPackRendered:decoratePack,decoratePack,
        validateDevourSelection,printedCost,getStatus,getBellyEntries:playerName=>clone(bellyEntries(playerName)),
        createBellyBadge,cardVisualMarkup,
        openBelly,consumeDinoBellyCard,onPickCompleted,onQueuePrepared,applyPendingQueuePenalty,
        notifyHostileDeckChange,dismissPendingBackup,getKunLunStakeOptions,consumeKunLunStake,
        hasPendingFinalExchange,onDraftFinished,declineFinalExchange,archiveUnusedBelly,
        isBusy:()=>{
            const belly=document.getElementById("spxDinoOverlay");
            const backup=document.getElementById("spxDinoBackupPrompt");
            return Boolean(ui.active||ui.committing||(belly&&!belly.hidden&&ui.phase!=="idle")||(backup&&!backup.hidden));
        },
        getLockReason:()=>{
            const backup=document.getElementById("spxDinoBackupPrompt");
            if(backup&&!backup.hidden) return "Dokończ Odruch Bezwarunkowy Devil Dino.";
            if(ui.active) return "Dokończ wybieranie kart dla Brzucha Dino.";
            if(ui.committing) return "Dokończ rozstrzyganie Brzucha Dino.";
            return "";
        }
    });
})(window);
