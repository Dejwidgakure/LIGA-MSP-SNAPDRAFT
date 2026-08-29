(function(global){
    "use strict";

    const POWER_ID="groot";
    const SEED_COUNT=2;
    const MAX_GARDEN_PURCHASES=2;
    const GARDEN_ECONOMY_CONVERSION_CAP=5;
    const GARDEN_REWARDS=[
        {id:"bark",cost:2,name:"KORA PLANETY X",emoji:"🛡️",kind:"protect",protection:"permanent",description:"Wybierz 1 kartę ze swojego decku. Jest chroniona przed wrogą ingerencją do końca draftu."},
        {id:"sprout",cost:2,name:"MŁODY PĘD",emoji:"🌱",kind:"replace",options:2,description:"Wymień 1 kartę z decku na wybraną z 2 losowych kart."},
        {id:"seed_graft",cost:4,name:"SZCZEP NASIONA",emoji:"🪴",kind:"seed_copy",description:"Wybierz jedną z dwóch kart, na których rosły Nasiona, a potem jedną z 3 losowych kart swojego decku do zastąpienia jej kopią."},
        {id:"wild_joker",cost:4,name:"LEŚNY JOKER",emoji:"🃏",kind:"joker",description:"Wybierz 1 kartę decku. Zastąp ją losowym Jokerem i od razu rozstrzygnij jego efekt."},
        {id:"queue_root",cost:3,name:"KORZEŃ NA SKRÓTY",emoji:"⚡",kind:"queue_shift",shift:3,description:"Twój następny pick przesuwa się maksymalnie o 3 miejsca wcześniej w kolejce."},
        {id:"bloom",cost:5,name:"ROZKWIT PLANETY X",emoji:"🌺",kind:"replace",options:5,description:"Wymień 1 kartę z decku na wybraną z 5 losowych kart."},
        {id:"rebirth",cost:6,name:"ODROST PLANETY X",emoji:"♻️",kind:"graveyard",options:3,description:"Wymień 1 kartę decku na wybraną spośród maksymalnie 3 odzyskiwalnych kart z Graveyardu tej paczki."},
        {id:"heart",cost:8,name:"SERCE PLANETY X",emoji:"💚",kind:"replace",options:4,chooseCost:true,protection:"permanent",description:"Wybierz Cost, potem wymień 1 kartę na wybraną z 4 losowych kart o tym Coście. Nowa karta dostaje ochronę do końca draftu."}
    ];
    let seedSequence=0;
    let protectionSequence=0;

    const state={
        active:false,
        playerName:"",
        playerIndex:-1,
        selectedKeys:new Set(),
        selectedOrder:[],
        committing:false,
        gardenOpen:false,
        gardenPlayerName:"",
        gardenPlayerIndex:-1,
        gardenRewardId:"",
        gardenDeckIndex:-1,
        gardenOptions:[],
        gardenSeedSourceIndex:-1,
        gardenSeedTargetIndexes:[],
        gardenTransaction:false,
        gardenAutomatic:false,
        gardenHidden:false
    };

    const GROOT_CARD_STAGE_ASSETS=Object.freeze({
        1:"draft-assets/groot_seed_stage1.png",
        2:"draft-assets/groot_seed_stage2.png",
        3:"draft-assets/groot_seed_stage3.png",
        4:"draft-assets/groot_seed_stage4.png"
    });
    const GROOT_PICK_TOAST_ID="galacticCurrentToast";
    let growthToastQueue=[];
    let growthToastTimer=null;
    let growthToastRetryTimer=null;
    let growthToastShowing=false;
    let gardenToastWaitTimer=null;
    let mandatoryGardenOpenTimer=null;

    function escapeHtml(value){
        return String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
    }

    function publicPackCardName(card){
        return global.MysterioUI?.getPublicCardLabel?.(card) || card?.name || "KARTA";
    }

    function cardKey(card,index=-1){
        if(!card||typeof card!=="object") return "";
        return String(card.instanceId||card.instanceMeta?.instanceId||`${card.id||card.name||"card"}::${index}`);
    }

    function getPack(){
        return Array.isArray(global.currentPack) ? global.currentPack : (typeof currentPack!=="undefined"&&Array.isArray(currentPack)?currentPack:[]);
    }

    function getPlayers(){
        return Array.isArray(global.players) ? global.players : (typeof players!=="undefined"&&Array.isArray(players)?players:[]);
    }

    function isUnresolvedJoker(card){
        return Boolean(card&&typeof card==="object"&&card.joker);
    }

    // PATCH100A — Nasiona są stanem per właściciel, nie per karta.
    // Zachowujemy migrację starego `grootSeed`, żeby istniejące save'y nie traciły stanu.
    function seedList(card){
        if(!card||typeof card!=="object") return [];
        const meta=card.instanceMeta;
        if(!meta) return [];
        let list=Array.isArray(meta.grootSeeds)?meta.grootSeeds.filter(Boolean):[];
        const legacy=meta.grootSeed;
        if(legacy&&typeof legacy==="object"){
            if(!list.some(item=>item?.seedId&&item.seedId===legacy.seedId)) list=[...list,legacy];
            meta.grootSeeds=list;
            delete meta.grootSeed;
        }
        return list;
    }

    function activeSeeds(card){
        return seedList(card).filter(seed=>seed&&!seed.harvested);
    }

    function existingSeed(card,owner=null){
        const seeds=activeSeeds(card);
        if(owner===null||owner===undefined||owner==="") return seeds[0]||null;
        return seeds.find(seed=>String(seed?.owner||"")===String(owner))||null;
    }

    function setSeedList(card,seeds){
        if(!card||typeof card!=="object") return [];
        card.instanceMeta={...(card.instanceMeta||{})};
        const clean=(Array.isArray(seeds)?seeds:[]).filter(Boolean);
        if(clean.length) card.instanceMeta.grootSeeds=clean;
        else delete card.instanceMeta.grootSeeds;
        delete card.instanceMeta.grootSeed;
        return clean;
    }

    function appendSeed(card,seed){
        const seeds=[...seedList(card)];
        if(seed?.seedId&&!seeds.some(item=>item?.seedId===seed.seedId)) seeds.push(seed);
        setSeedList(card,seeds);
        return seed;
    }

    function removeSeedFromCard(card,seedId){
        const seeds=seedList(card).filter(seed=>seed?.seedId!==seedId);
        setSeedList(card,seeds);
        return seeds;
    }

    function isPlantable(card,owner=state.playerName){
        if(!card||typeof card!=="object") return false;
        // Joker jest pełnoprawnym obiektem paczki i może być zasiany.
        return !existingSeed(card,owner);
    }

    function legalCards(){
        return getPack().map((card,index)=>({card,index,key:cardKey(card,index)})).filter(entry=>entry.key&&isPlantable(entry.card,state.playerName));
    }

    function engineData(playerName=state.playerName){
        return global.SuperpowerEngine?.getPlayerData?.(playerName)||null;
    }

    function getCurrentBusyState(){
        const current=global.GalacticCurrent?.getState?.();
        if(!current?.active) return null;
        if(current.isResolving) return "resolving";
        if(current.isFinishing) return "finishing";
        return null;
    }

    function isExternalBusy(){
        // `SuperpowerUI.isBusy()` agreguje również GrootUI. Użycie go tutaj
        // tworzyło pętlę: oczekujący Ogród blokował własne automatyczne otwarcie.
        // Pytamy wyłącznie o sekwencję należącą bezpośrednio do wspólnego UI.
        if(global.SuperpowerUI?.isOwnBusy?.()) return true;
        if(global.IronFistUI?.isBusy?.()) return true;
        if(global.ThorUI?.isBusy?.()) return true;
        if(global.WolverineUI?.isBusy?.()) return true;
        if(global.JokerV2UI?.isBusy?.()) return true;
        if(global.DraftFoundation?.hasOpenTransaction?.()) return true;
        return false;
    }

    function preflight(playerName){
        const data=engineData(playerName);
        const playerList=getPlayers();
        const playerIndex=playerList.indexOf(playerName);
        if(state.active) return {ok:false,message:"Groot już wybiera miejsca dla swoich nasion."};
        if(!data||data.powerId!==POWER_ID) return {ok:false,message:"Groot nie jest przypisany do tego gracza."};
        if(data.used) return {ok:false,message:"Nasiona Planety X zostały już zasiane."};
        if(typeof draftFinished!=="undefined"&&draftFinished) return {ok:false,message:"Draft jest już zakończony."};
        if(typeof packIsOpen!=="undefined"&&!packIsOpen) return {ok:false,message:"Groot potrzebuje otwartej paczki."};
        if(typeof packOpeningInProgress!=="undefined"&&packOpeningInProgress) return {ok:false,message:"Poczekaj, aż skrzynka skończy się otwierać."};
        if(typeof packEnding!=="undefined"&&packEnding) return {ok:false,message:"Ta paczka właśnie się zamyka."};
        const currentBusy=getCurrentBusyState();
        if(currentBusy==="resolving") return {ok:false,message:"Poczekaj, aż Gwiezdny Prąd zakończy aktualne przesunięcie lub wygaszanie kart."};
        if(currentBusy==="finishing") return {ok:false,message:"Poczekaj, aż Gwiezdny Prąd zakończy bieżący obieg."};
        if(isExternalBusy()) return {ok:false,message:"Najpierw dokończ aktywną sekwencję draftu lub Supermocy."};
        const legal=legalCards();
        if(legal.length<SEED_COUNT) return {ok:false,message:"W aktualnej puli muszą znajdować się co najmniej dwie karty bez Nasiona tego Groota."};
        return {ok:true,playerIndex,legal};
    }

    function ensureHud(){
        let hud=document.getElementById("spxGrootHud");
        if(hud) return hud;
        hud=document.createElement("aside");
        hud.id="spxGrootHud";
        hud.className="spx-groot-hud";
        hud.hidden=true;
        hud.innerHTML=`
            <div class="spx-groot-hud-leaf" aria-hidden="true">🌱</div>
            <div class="spx-groot-hud-copy">
                <div class="spx-groot-kicker">GROOT · PLANETA X</div>
                <strong>NASIONA PLANETY X</strong>
                <span id="spxGrootHudText">Zasadź 2 Nasiona. 0/2</span>
            </div>
            <div class="spx-groot-hud-actions">
                <button type="button" id="spxGrootCancel">ANULUJ</button>
                <button type="button" id="spxGrootConfirm" class="primary" disabled>ZASADŹ 2 NASIONA</button>
            </div>`;
        document.body.appendChild(hud);
        hud.querySelector("#spxGrootCancel")?.addEventListener("click",()=>cancel());
        hud.querySelector("#spxGrootConfirm")?.addEventListener("click",()=>commit());
        return hud;
    }

    function updateHud(message=""){
        const hud=ensureHud();
        const text=hud.querySelector("#spxGrootHudText");
        const confirm=hud.querySelector("#spxGrootConfirm");
        if(text){
            text.textContent=message||`Zasadź 2 Nasiona. ${state.selectedKeys.size}/${SEED_COUNT}`;
        }
        if(confirm) confirm.disabled=state.selectedKeys.size!==SEED_COUNT||state.committing;
    }

    function start(playerName){
        const check=preflight(playerName);
        if(!check.ok){
            global.SuperpowerFeedback?.warning?.(POWER_ID,"PLANETA X NIE ODPOWIADA",check.message);
            return false;
        }
        state.active=true;
        state.playerName=playerName;
        state.playerIndex=check.playerIndex;
        state.selectedKeys.clear();
        state.selectedOrder=[];
        state.committing=false;
        document.body.classList.add("spx-groot-planting");
        const hud=ensureHud();
        hud.hidden=false;
        updateHud(`Zasadź 2 Nasiona. 0/${SEED_COUNT}`);
        decoratePack();
        return true;
    }

    function handlePackCardClick(packIndex,card){
        if(state.gardenOpen) return true;
        if(!state.active) return false;
        const pack=getPack();
        const liveCard=pack[packIndex]||card;
        if(!liveCard) return true;
        if(existingSeed(liveCard,state.playerName)){
            updateHud("Ten Groot ma już Nasiono Planety X na tej karcie.");
            return true;
        }
        const key=cardKey(liveCard,packIndex);
        if(!key) return true;
        if(state.selectedKeys.has(key)){
            state.selectedKeys.delete(key);
            state.selectedOrder=state.selectedOrder.filter(item=>item!==key);
        }else{
            if(state.selectedKeys.size>=SEED_COUNT){
                updateHud("Masz już wybrane dwa nasiona. Odznacz jedną kartę albo zatwierdź sadzenie.");
                return true;
            }
            state.selectedKeys.add(key);
            state.selectedOrder.push(key);
        }
        updateHud(`${state.playerName}: wybrano ${state.selectedKeys.size}/${SEED_COUNT}. ${state.selectedKeys.size===SEED_COUNT?"Możesz zasadzić nasiona.":"Wskaż jeszcze jedną kartę."}`);
        decoratePack();
        return true;
    }

    function selectedEntries(){
        const pack=getPack();
        return state.selectedOrder.map(key=>{
            const index=pack.findIndex((card,idx)=>cardKey(card,idx)===key);
            return index>=0?{card:pack[index],index,key}:null;
        }).filter(Boolean);
    }

    function makeSeedTemplate(card){
        if(!card||typeof card!=="object") return null;
        const template=JSON.parse(JSON.stringify(card));
        delete template.instanceId;
        delete template.instanceMeta;
        return template;
    }

    function makeSeedRecord(card,index,order){
        const now=Date.now();
        const id=`groot-seed-${now}-${++seedSequence}`;
        return {
            seedId:id,
            owner:state.playerName,
            ownerIndex:state.playerIndex,
            cardInstanceId:cardKey(card,index),
            cardName:card?.name||null,
            cardTemplate:makeSeedTemplate(card),
            plantedAtPack:(typeof packStartIndex!=="undefined"?packStartIndex:0)+1,
            plantedAtPick:typeof currentPickIndex!=="undefined"?currentPickIndex:0,
            growth:0,
            stage:1,
            harvested:false,
            harvestedPoints:0,
            harvestReason:null,
            order,
            version:1
        };
    }

    function commit(){
        if(!state.active||state.committing) return false;
        const selected=selectedEntries();
        if(selected.length!==SEED_COUNT){
            updateHud("Jedna z wybranych kart zniknęła z paczki. Wybierz ponownie.");
            state.selectedKeys.clear();
            state.selectedOrder=[];
            decoratePack();
            return false;
        }
        if(selected.some(entry=>!isPlantable(entry.card))){
            updateHud("Jednej z tych kart nie można już obsadzić. Wybierz ponownie.");
            state.selectedKeys.clear();
            state.selectedOrder=[];
            decoratePack();
            return false;
        }
        state.committing=true;
        updateHud("Groot zapuszcza korzenie…");
        const data=engineData();
        if(!data){state.committing=false;return false;}
        const playerCount=Math.max(1,getPlayers().length||4);
        const growthTarget=Math.max(4,playerCount);
        const gentleGrowth=playerCount>=7;
        const stage2=gentleGrowth?1:2;
        const stage3=Math.max(stage2+1,Math.ceil(growthTarget/2)-(gentleGrowth?1:0));
        const records=selected.map((entry,i)=>makeSeedRecord(entry.card,entry.index,i+1));
        selected.forEach((entry,i)=>{
            appendSeed(entry.card,{...records[i]});
        });
        data.data=data.data||{};
        data.data.groot={
            version:3,
            activated:true,
            sourcePackNumber:(typeof packStartIndex!=="undefined"?packStartIndex:0)+1,
            growthTarget,
            stage2,
            stage3,
            stage4:growthTarget,
            growthPoints:0,
            spentGrowthPoints:0,
            gardenReady:false,
            gardenUnlocked:false,
            gardenMandatory:false,
            gardenClosed:false,
            expiredGrowthPoints:0,
            purchases:[],
            queueShiftPending:0,
            seeds:records.map(record=>({...record}))
        };
        const completed=global.SuperpowerEngine?.completeActivation?.(state.playerName,POWER_ID,{
            packNumber:(typeof packStartIndex!=="undefined"?packStartIndex:0)+1,
            pickIndex:typeof currentPickIndex!=="undefined"?currentPickIndex:0,
            seedCount:records.length,
            seedCardInstanceIds:records.map(record=>record.cardInstanceId),
            growthTarget
        });
        if(!completed?.ok){
            records.forEach((record,index)=>{
                const card=selected[index]?.card;
                if(card) removeSeedFromCard(card,record.seedId);
            });
            delete data.data.groot;
            state.committing=false;
            updateHud(completed?.reason||"Nie udało się zapisać Nasion Planety X.");
            decoratePack();
            return false;
        }
        records.forEach((record,index)=>{
            const asset=global.SuperpowerEngine?.createRuntimeAsset?.(state.playerName,"groot_seed",record);
            if(asset?.assetId){
                record.runtimeAssetId=asset.assetId;
                const seed=data.data.groot.seeds.find(item=>item.seedId===record.seedId);
                if(seed) seed.runtimeAssetId=asset.assetId;
                const liveSeed=seedList(selected[index]?.card).find(item=>item?.seedId===record.seedId);
                if(liveSeed) liveSeed.runtimeAssetId=asset.assetId;
            }
        });
        const stored=global.draftSuperpowers?.[state.playerName];
        if(stored){stored.used=true;stored.status="used";}
        global.superpowerLog=global.superpowerLog||[];
        global.superpowerLog.push({
            type:"superpower_activation",
            event:"groot_planet_x_seeds_planted",
            playerName:state.playerName,
            playerIndex:state.playerIndex,
            powerId:POWER_ID,
            seedCardInstanceIds:records.map(record=>record.cardInstanceId),
            seedCards:selected.map(entry=>entry.card?.name||"karta"),
            growthTarget,
            packNumber:(typeof packStartIndex!=="undefined"?packStartIndex:0)+1,
            pickIndex:typeof currentPickIndex!=="undefined"?currentPickIndex:0,
            timestamp:new Date().toISOString()
        });
        const plantedNames=selected.map(entry=>entry.card?.name||"karta");
        resetSelection(false);
        if(typeof showPack==="function") showPack(false);
        records.forEach((record,index)=>{
            const card=selected[index]?.card;
            if(card) setTimeout(()=>triggerGrowthFx(card,1,"plant"),90+(index*160));
        });
        if(typeof showDecks==="function") showDecks();
        if(typeof renderSuperpowerRosterPanel==="function") renderSuperpowerRosterPanel();
        global.SuperpowerFeedback?.event?.(POWER_ID,"🌱 NASIONA ZASADZONE",plantedNames.join(" • "));
        return true;
    }

    function cancel(){
        if(!state.active||state.committing) return false;
        resetSelection(true);
        if(typeof showPack==="function") showPack(false);
        return true;
    }

    function resetSelection(hide=true){
        state.active=false;
        state.playerName="";
        state.playerIndex=-1;
        state.selectedKeys.clear();
        state.selectedOrder=[];
        state.committing=false;
        clearPackDecorations();
        document.body.classList.remove("spx-groot-planting");
        const hud=document.getElementById("spxGrootHud");
        if(hud&&hide) hud.hidden=true;
        if(hud&&!hide) hud.hidden=true;
    }

    function clearGrootTitle(element){
        if(!element || element.dataset.spxGrootTitleApplied!=="1") return;
        const previous=element.dataset.spxGrootPreviousTitle||"";
        if(previous) element.title=previous;
        else element.removeAttribute("title");
        delete element.dataset.spxGrootTitleApplied;
        delete element.dataset.spxGrootPreviousTitle;
    }

    function setGrootTitle(element,text){
        if(!element) return;
        if(element.dataset.spxGrootTitleApplied!=="1"){
            element.dataset.spxGrootPreviousTitle=element.getAttribute("title")||"";
            element.dataset.spxGrootTitleApplied="1";
        }
        element.title=text;
    }

    function clearPackDecorations(){
        document.querySelectorAll("#pack [data-pack-index]").forEach(element=>{
            element.classList.remove("spx-groot-candidate","spx-groot-selected","spx-groot-ineligible");
            clearGrootTitle(element);
        });
    }

    function decoratePack(){
        const pack=getPack();
        const elements=[...document.querySelectorAll("#pack [data-pack-index]")];
        elements.forEach(element=>{
            const index=Number(element.dataset.packIndex);
            const card=pack[index];
            const key=cardKey(card,index);
            const planted=card?activeSeeds(card):[];
            element.classList.remove("spx-groot-candidate","spx-groot-selected","spx-groot-ineligible","spx-groot-seeded");
            element.querySelectorAll(":scope > .spx-groot-seed-marker").forEach(marker=>marker.remove());
            if(planted.length){
                element.classList.add("spx-groot-seeded");
                const stageDetails=planted.map(seed=>{
                    const groot=getGrootData(seed.owner);
                    const stage=Math.max(1,Number(seed.stage)||stageForGrowth(seed.growth,groot));
                    return {seed,groot,stage};
                }).sort((a,b)=>{
                    const ownA=String(a.seed?.owner||"")===String(state.playerName||"")?1:0;
                    const ownB=String(b.seed?.owner||"")===String(state.playerName||"")?1:0;
                    if(ownB-ownA) return ownB-ownA;
                    const stageDiff=(Number(b.stage)||0)-(Number(a.stage)||0);
                    if(stageDiff) return stageDiff;
                    return (Number(b.seed?.growth)||0)-(Number(a.seed?.growth)||0);
                });
                const marker=document.createElement("span");
                const selectedOwner=stageDetails.some(item=>String(item.seed?.owner||"")===String(state.playerName||""));
                const multi=stageDetails.length>1;
                marker.className=`spx-groot-seed-marker${selectedOwner?" selected":""}${multi?" multi":""}`;
                marker.dataset.seedCount=String(stageDetails.length);
                marker.tabIndex=0;
                marker.setAttribute("role","button");
                marker.setAttribute("aria-label",stageDetails.map(item=>`${item.seed?.owner||"GROOT"}: ${stageName(item.stage)} • ${Number(item.seed?.growth||0)}/${Number(item.groot?.growthTarget||4)} • +${pointsForStage(item.stage)} listków`).join(" | "));
                const dotsHtml=stageDetails.map((item,seedIndex)=>{
                    const ownClass=String(item.seed?.owner||"")===String(state.playerName||"")?" own":"";
                    return `<span class="spx-groot-seed-dot${ownClass}" data-stage="${item.stage}" style="background-image:url('${escapeHtml(stageAsset(item.stage))}')" aria-hidden="true" data-seed-owner="${escapeHtml(item.seed?.owner||'GROOT')}" data-seed-index="${seedIndex}"></span>`;
                }).join("");
                const metaHtml=stageDetails.map(item=>`<span class="spx-groot-seed-line"><b>${escapeHtml(item.seed?.owner||"GROOT")}</b><small>${stageName(item.stage)} • ${Number(item.seed?.growth||0)}/${Number(item.groot?.growthTarget||4)} • +${pointsForStage(item.stage)} 🌿</small></span>`).join("");
                marker.innerHTML=`<span class="spx-groot-seed-stack" aria-hidden="true">${dotsHtml}</span><span class="spx-groot-seed-meta">${metaHtml}</span>`;
                marker.addEventListener("click",event=>{
                    event.preventDefault();
                    event.stopPropagation();
                    document.querySelectorAll(".spx-groot-seed-marker.show-meta").forEach(node=>{ if(node!==marker) node.classList.remove("show-meta"); });
                    marker.classList.toggle("show-meta");
                });
                marker.addEventListener("keydown",event=>{
                    if(event.key==="Enter"||event.key===" "){
                        event.preventDefault();
                        marker.click();
                    }
                    if(event.key==="Escape") marker.classList.remove("show-meta");
                });
                marker.addEventListener("blur",()=>marker.classList.remove("show-meta"));
                element.appendChild(marker);
            }
            if(!state.active) return;
            if(isPlantable(card,state.playerName)){
                element.classList.add("spx-groot-candidate");
                if(state.selectedKeys.has(key)) element.classList.add("spx-groot-selected");
                setGrootTitle(element,state.selectedKeys.has(key)?"GROOT: odznacz tę kartę":"GROOT: zasadź tutaj Nasiono Planety X");
            }else{
                element.classList.add("spx-groot-ineligible");
                setGrootTitle(element,"GROOT: na tej karcie rośnie już Twoje Nasiono Planety X");
            }
        });
    }

    function getGrootData(owner){
        const data=engineData(owner);
        return data?.data?.groot||null;
    }

    function getStoredSeed(seed){
        if(!seed?.seedId) return null;
        const groot=getGrootData(seed.owner);
        return groot?.seeds?.find(item=>item?.seedId===seed.seedId)||null;
    }

    function normalizeGrowthThresholds(groot){
        if(!groot) return null;
        const target=Math.max(4,Number(groot.growthTarget)||getPlayers().length||4);
        const playerCount=Math.max(1,getPlayers().length||target);
        const gentleGrowth=playerCount>=7||target>=7;
        groot.growthTarget=target;
        groot.stage2=gentleGrowth?1:2;
        groot.stage3=Math.max(groot.stage2+1,Math.ceil(target/2)-(gentleGrowth?1:0));
        groot.stage4=target;
        groot.version=Math.max(3,Number(groot.version)||0);
        return groot;
    }

    function growthLadderText(groot){
        const target=Math.max(4,Number(groot?.growthTarget)||getPlayers().length||4);
        const normalized=normalizeGrowthThresholds(groot);
        const stage2=Number(normalized?.stage2)||2;
        const stage3=Number(normalized?.stage3)||Math.max(stage2+1,Math.ceil(target/2));
        const firstRange=stage2<=1?"0":`0–${stage2-1}`;
        const secondRange=stage3-stage2<=1?`${stage2}`:`${stage2}–${stage3-1}`;
        return `WZROST: ${firstRange} → 1 🌿 · ${secondRange} → 2 🌿 · ${stage3}–${target-1} → 3 🌿 · ${target} → 6 🌿 · pełny naturalny cykl → 10 🌿`;
    }

    function stageForGrowth(growth,groot){
        const value=Math.max(0,Number(growth)||0);
        if(!groot) return 1;
        normalizeGrowthThresholds(groot);
        if(value>=Number(groot.stage4)) return 4;
        if(value>=Number(groot.stage3)) return 3;
        if(value>=Number(groot.stage2)) return 2;
        return 1;
    }

    function pointsForStage(stage){
        return ({1:1,2:2,3:3,4:6})[Number(stage)]||1;
    }

    function stageEmoji(stage){
        return ({1:"🌱",2:"🌿",3:"🌳",4:"🪴"})[Number(stage)]||"🌱";
    }

    function stageName(stage){
        return ({1:"NASIONO",2:"KIEŁEK",3:"ROZROST",4:"PEŁNY GROOT"})[Number(stage)]||"NASIONO";
    }

    function stageAsset(stage){
        return GROOT_CARD_STAGE_ASSETS[Number(stage)]||GROOT_CARD_STAGE_ASSETS[1];
    }

    function getPackCardElement(card){
        const pack=getPack();
        const index=pack.findIndex(item=>item===card||cardKey(item)===cardKey(card));
        if(index<0) return null;
        return document.querySelector(`#pack [data-pack-index="${index}"]`);
    }

    function triggerGrowthFx(card,stage=1,mode="growth"){
        const host=getPackCardElement(card);
        if(!host) return;
        host.classList.remove("spx-groot-stage-flash","spx-groot-stage-plant");
        void host.offsetWidth;
        host.classList.add(mode==="plant"?"spx-groot-stage-plant":"spx-groot-stage-flash");
        const burst=document.createElement("span");
        burst.className=`spx-groot-card-growth-burst stage-${Number(stage)||1} mode-${mode}`;
        burst.innerHTML=`
            <span class="spx-groot-growth-ring"></span>
            <span class="spx-groot-growth-spark sp1"></span>
            <span class="spx-groot-growth-spark sp2"></span>
            <span class="spx-groot-growth-spark sp3"></span>
            <span class="spx-groot-growth-spark sp4"></span>
            <span class="spx-groot-growth-spark sp5"></span>
            <span class="spx-groot-growth-spark sp6"></span>
            <span class="spx-groot-growth-leaf l1"></span>
            <span class="spx-groot-growth-leaf l2"></span>
            <span class="spx-groot-growth-leaf l3"></span>`;
        host.appendChild(burst);
        const marker=host.querySelector(":scope > .spx-groot-seed-marker");
        if(marker){
            marker.classList.remove("spx-groot-seed-transforming");
            void marker.offsetWidth;
            marker.classList.add("spx-groot-seed-transforming");
            setTimeout(()=>marker.classList.remove("spx-groot-seed-transforming"),1050);
        }
        setTimeout(()=>burst.remove(),1500);
        setTimeout(()=>host.classList.remove("spx-groot-stage-flash","spx-groot-stage-plant"),1050);
    }

    function isPickToastVisible(){
        const toast=document.getElementById(GROOT_PICK_TOAST_ID);
        const primaryToast=document.getElementById("draftPickToast");
        const thorOpen=!document.getElementById("spxThorOverlay")?.hidden;
        const dinoOpen=!document.getElementById("spxDinoOverlay")?.hidden;
        const dinoSleep=Boolean(document.getElementById("spxDinoSleepScene"));
        return Boolean((toast&&toast.classList.contains("is-visible")) ||
            (primaryToast&&primaryToast.classList.contains("is-visible")) || thorOpen || dinoOpen || dinoSleep);
    }

    function syncSeed(card,seedRef,patch={}){
        const seedId=typeof seedRef==="string"?seedRef:seedRef?.seedId;
        if(!seedId) return null;
        const live=seedList(card).find(seed=>seed?.seedId===seedId)||null;
        const stored=getStoredSeed(seedRef);
        if(!live&&!stored) return null;
        if(live) Object.assign(live,patch);
        if(stored) Object.assign(stored,patch);
        const runtimeAssetId=live?.runtimeAssetId||stored?.runtimeAssetId||null;
        if(runtimeAssetId){
            global.SuperpowerEngine?.updateRuntimeAsset?.(runtimeAssetId,{data:{...patch}});
        }
        return live||stored;
    }

    // Transformacja zachowuje Nasiona. Technicznie karta wynikowa może dostać nowe instanceId,
    // więc migrujemy aktywne Nasiona na nowy obiekt zamiast je zbierać.
    function transferSeeds(sourceCard,targetCard,context={}){
        if(!sourceCard||!targetCard) return {ok:false,seeds:[]};
        const sourceSeeds=seedList(sourceCard);
        const moving=sourceSeeds.filter(seed=>seed&&!seed.harvested);
        if(!moving.length) return {ok:false,seeds:[]};
        const remaining=sourceSeeds.filter(seed=>!moving.includes(seed));
        const targetSeeds=[...seedList(targetCard)];
        const transferred=[];
        moving.forEach(seed=>{
            const next={...seed,cardInstanceId:cardKey(targetCard),lastTransferReason:String(context.reason||"transform"),lastTransferredAt:Date.now()};
            const duplicateIndex=targetSeeds.findIndex(item=>item?.seedId===next.seedId);
            if(duplicateIndex>=0) targetSeeds[duplicateIndex]=next;
            else targetSeeds.push(next);
            const stored=getStoredSeed(seed);
            if(stored){
                stored.cardInstanceId=next.cardInstanceId;
                stored.lastTransferReason=next.lastTransferReason;
                stored.lastTransferredAt=next.lastTransferredAt;
            }
            if(next.runtimeAssetId){
                global.SuperpowerEngine?.updateRuntimeAsset?.(next.runtimeAssetId,{data:{cardInstanceId:next.cardInstanceId,lastTransferReason:next.lastTransferReason,lastTransferredAt:next.lastTransferredAt}});
            }
            transferred.push(next);
            logGrowthEvent("groot_seed_transferred",next,targetCard,{
                reason:next.lastTransferReason,
                fromCardInstanceId:sourceCard?.instanceId||null,
                toCardInstanceId:targetCard?.instanceId||null,
                transformedFromName:sourceCard?.name||null,
                transformedIntoName:targetCard?.name||null
            });
        });
        setSeedList(sourceCard,remaining);
        setSeedList(targetCard,targetSeeds);
        return {ok:true,seeds:transferred};
    }

    function logGrowthEvent(type,seed,card,data={}){
        const payload={
            type,
            event:type,
            playerName:seed?.owner||null,
            playerIndex:Number.isInteger(seed?.ownerIndex)?seed.ownerIndex:null,
            powerId:POWER_ID,
            seedId:seed?.seedId||null,
            cardInstanceId:seed?.cardInstanceId||card?.instanceId||null,
            cardName:card?.name||null,
            packNumber:(typeof packStartIndex!=="undefined"?packStartIndex:0)+1,
            pickIndex:typeof currentPickIndex!=="undefined"?currentPickIndex:0,
            timestamp:new Date().toISOString(),
            ...data
        };
        global.superpowerLog=global.superpowerLog||[];
        global.superpowerLog.push(payload);
        global.DraftStateEngine?.log?.(type,{
            packNumber:payload.packNumber,
            pickIndex:payload.pickIndex,
            playerIndex:payload.playerIndex,
            player:payload.playerName,
            sourceCard:card||null,
            resultCard:card||null,
            reason:data.reason||type,
            data:{powerId:POWER_ID,seedId:payload.seedId,...data}
        });
    }

    function ensureGrowthToast(){
        let toast=document.getElementById("spxGrootGrowthToast");
        if(toast) return toast;
        toast=document.createElement("div");
        toast.id="spxGrootGrowthToast";
        toast.className="spx-groot-growth-toast";
        toast.setAttribute("aria-live","polite");
        document.body.appendChild(toast);
        return toast;
    }

    function flushGrowthToastQueue(){
        if(growthToastShowing) return;
        if(!growthToastQueue.length) return;
        if(isPickToastVisible()){
            clearTimeout(growthToastRetryTimer);
            growthToastRetryTimer=setTimeout(flushGrowthToastQueue,240);
            return;
        }
        const next=growthToastQueue.shift();
        if(!next) return;
        const toast=ensureGrowthToast();
        growthToastShowing=true;
        toast.dataset.kind=next.kind;
        toast.innerHTML=next.html;
        toast.classList.remove("is-visible");
        void toast.offsetWidth;
        toast.classList.add("is-visible");
        clearTimeout(growthToastTimer);
        growthToastTimer=setTimeout(()=>{
            toast.classList.remove("is-visible");
            growthToastShowing=false;
            if(growthToastQueue.length) setTimeout(flushGrowthToastQueue,240);
        },next.duration);
    }

    function showGrowthToast(html,kind="growth",duration=2300){
        const owners=getGrootOwners();
        if(owners.length && owners.every(owner=>Boolean(getGardenData(owner)?.gardenClosed))) return false;
        const key=String(html).replace(/\s+/g," ");
        if(growthToastQueue.some(item=>item.key===key)) return false;
        growthToastQueue.push({html,kind,duration:Math.max(1500,Number(duration)||2300),key});
        flushGrowthToastQueue();
        return true;
    }

    function clearGrowthToasts(){
        growthToastQueue=[];
        growthToastShowing=false;
        clearTimeout(growthToastTimer);
        clearTimeout(growthToastRetryTimer);
        clearTimeout(gardenToastWaitTimer);
        gardenToastWaitTimer=0;
        const toast=document.getElementById("spxGrootGrowthToast");
        if(toast){toast.classList.remove("is-visible");toast.innerHTML="";}
    }

    function hasPendingGrowthPresentation(){
        return Boolean(growthToastShowing||growthToastQueue.length);
    }

    function advanceSurvivors(cards,context={}){
        const list=Array.isArray(cards)?cards:[];
        const advanced=[];
        for(const card of list){
            const seeds=[...activeSeeds(card)];
            for(const seed of seeds){
                const groot=getGrootData(seed.owner);
                if(!groot) continue;
                const eventKey=`${String(context.mode||"classic")}:${Number(context.packNumber||0)}:${Number(context.pickIndex??context.riverPickNumber??-1)}`;
                if(String(seed.lastGrowthEventKey||"")===eventKey) continue;
                const previousGrowth=Math.max(0,Number(seed.growth)||0);
                const previousStage=Math.max(1,Number(seed.stage)||stageForGrowth(previousGrowth,groot));
                const growth=previousGrowth+1;
                const stage=stageForGrowth(growth,groot);
                const updated=syncSeed(card,seed,{growth,stage,lastGrowthAtPick:typeof currentPickIndex!=="undefined"?currentPickIndex:0,lastGrowthEventKey:eventKey});
                if(!updated) continue;
                advanced.push({card,seed:{...updated},growth,stage,previousStage});
                logGrowthEvent("groot_seed_grew",updated,card,{
                    growth,stage,previousStage,
                    mode:context.mode||"classic",
                    riverVariant:context.riverVariant||null,
                    reason:"survived_pick"
                });
                // Każdy przyrost ma czytelny błysk liści i ściółki; toast nadal
                // pojawia się wyłącznie przy faktycznej zmianie etapu.
                if(stage>previousStage){
                    // Najpierw odświeżamy asset etapu, dopiero potem nakładamy
                    // na nowy element właściwą animację przemiany.
                    decoratePack();
                    setTimeout(()=>triggerGrowthFx(card,stage,"growth"),35);
                    showGrowthToast(`<b>${stageEmoji(stage)} ${escapeHtml(publicPackCardName(card))}</b><span>${escapeHtml(seed.owner||"GROOT")} • ${stageName(stage)} • WZROST ${growth}/${Number(groot.growthTarget||4)}</span>`,"stage");
                    logGrowthEvent("groot_seed_stage_changed",updated,card,{
                        growth,stage,previousStage,
                        mode:context.mode||"classic",
                        riverVariant:context.riverVariant||null,
                        reason:"growth_threshold"
                    });
                }else triggerGrowthFx(card,stage,"growth");
            }
        }
        if(advanced.length) decoratePack();
        return advanced;
    }

    function harvestSeed(card,seed,reason="harvest",options={}){
        if(!seed?.seedId||seed.harvested) return {ok:false,reason:"no_active_seed"};
        const groot=getGrootData(seed.owner);
        if(!groot) return {ok:false,reason:"missing_groot_state",seedId:seed.seedId};
        const stored=getStoredSeed(seed);
        if(stored?.harvested){
            syncSeed(card,seed,{...stored});
            return {ok:false,reason:"already_harvested",seedId:seed.seedId};
        }
        if(!stored?.cardTemplate){
            const template=makeSeedTemplate(card);
            if(template){
                if(stored) stored.cardTemplate=template;
                if(stored) stored.cardName=stored.cardName||card?.name||null;
            }
        }
        const growth=Math.max(0,Number(seed.growth)||0);
        const naturalStage=stageForGrowth(growth,groot);
        const forcedPerfect=Boolean(options.forcePerfect);
        const stage=forcedPerfect?4:naturalStage;
        const basePoints=pointsForStage(stage);
        const perfect=Boolean(forcedPerfect||(options.natural&&options.perfectEligible&&naturalStage>=4));
        const points=perfect?10:basePoints;
        const harvestedAt=Date.now();
        const patch={
            growth,
            stage,
            harvested:true,
            harvestedPoints:points,
            harvestBasePoints:basePoints,
            harvestBonus:perfect?Math.max(0,points-basePoints):0,
            perfectHarvest:perfect,
            perfectForced:Boolean(forcedPerfect),
            harvestReason:String(reason||"harvest"),
            harvestedAt,
            harvestedAtPack:(typeof packStartIndex!=="undefined"?packStartIndex:0)+1,
            harvestedAtPick:typeof currentPickIndex!=="undefined"?currentPickIndex:0
        };
        const updated=syncSeed(card,seed,patch)||{...seed,...patch};
        groot.growthPoints=Math.max(0,Number(groot.growthPoints)||0)+points;
        const allHarvested=Array.isArray(groot.seeds)&&groot.seeds.length>=SEED_COUNT&&groot.seeds.every(item=>item?.harvested);
        if(allHarvested&&!groot.gardenReady){
            groot.gardenReady=true;
            groot.gardenReadyAt=Date.now();
            groot.gardenReadyAtPick=typeof currentPickIndex!=="undefined"?currentPickIndex:0;
        }
        const runtimeAssetId=updated.runtimeAssetId||stored?.runtimeAssetId||null;
        if(runtimeAssetId){
            global.SuperpowerEngine?.consumeRuntimeAsset?.(runtimeAssetId,{
                reason:String(reason||"harvest"),
                points,
                perfectHarvest:perfect,
                growth,
                stage
            });
        }
        logGrowthEvent("groot_seed_harvested",updated,card,{
            reason:String(reason||"harvest"),
            growth,stage,points,basePoints,perfectHarvest:perfect,
            totalGrowthPoints:groot.growthPoints,
            gardenReady:Boolean(groot.gardenReady),
            mode:options.mode||"classic",
            riverVariant:options.riverVariant||null
        });
        if(perfect){
            const perfectCopy=forcedPerfect
                ? `${escapeHtml(publicPackCardName(card))} została wysłana przez Portal Agamotto do przyszłej paczki — przeżycie źródłowej paczki jest gwarantowane.`
                : `${escapeHtml(publicPackCardName(card))} przetrwała cały naturalny cykl.`;
            showGrowthToast(`<b>✨ JACKPOT GROOTA • +${points} 🌿</b><span>${escapeHtml(seed.owner||"GROOT")} • ${perfectCopy}</span>`,"perfect");
        }else{
            showGrowthToast(`<b>🌿 ZBIÓR • +${points}</b><span>${escapeHtml(seed.owner||"GROOT")} • ${escapeHtml(publicPackCardName(card))} • ${stageName(stage)}</span>`,"harvest");
        }
        if(allHarvested){
            const timingCopy=options.mode==="current"
                ? "Ogród otworzy się automatycznie po zakończeniu bieżącego rozstrzygnięcia."
                : "Ogród otworzy się automatycznie po zakończeniu tej paczki.";
            logGrowthEvent("groot_garden_ready",updated,card,{
                reason:"all_seeds_harvested",
                totalGrowthPoints:groot.growthPoints
            });
        }
        return {ok:true,seed:{...updated},points,basePoints,perfect,growth,stage,totalGrowthPoints:groot.growthPoints,gardenReady:Boolean(groot.gardenReady)};
    }

    function harvestCard(card,reason="harvest",options={}){
        const seeds=[...activeSeeds(card)];
        if(!seeds.length) return {ok:false,reason:"no_active_seed",harvests:[]};
        const harvests=seeds.map(seed=>harvestSeed(card,seed,reason,options)).filter(result=>result?.ok);
        if(harvests.length) decoratePack();
        return {
            ok:Boolean(harvests.length),
            reason:harvests.length?null:"no_active_seed",
            harvests,
            points:harvests.reduce((sum,item)=>sum+Math.max(0,Number(item.points)||0),0)
        };
    }

    function clone(value){
        return value===undefined ? undefined : JSON.parse(JSON.stringify(value));
    }

    function getPlayerIndex(playerName){
        return getPlayers().indexOf(playerName);
    }

    function getGardenData(playerName){
        const groot=getGrootData(playerName);
        if(!groot) return null;
        if(!Array.isArray(groot.purchases)) groot.purchases=[];
        if(!Number.isFinite(Number(groot.spentGrowthPoints))){
            groot.spentGrowthPoints=groot.purchases.reduce((sum,item)=>sum+Math.max(0,Number(item?.cost)||0),0);
        }
        normalizeGrowthThresholds(groot);
        if(typeof groot.gardenClosed!=="boolean") groot.gardenClosed=false;
        if(typeof groot.gardenUnlocked!=="boolean") groot.gardenUnlocked=false;
        if(typeof groot.gardenMandatory!=="boolean") groot.gardenMandatory=false;
        if(!Number.isFinite(Number(groot.expiredGrowthPoints))) groot.expiredGrowthPoints=0;
        if(!Number.isFinite(Number(groot.convertedGrowthPoints))) groot.convertedGrowthPoints=0;
        if(!Number.isFinite(Number(groot.convertedJeffCoins))) groot.convertedJeffCoins=0;
        if(!Number.isFinite(Number(groot.queueShiftPending))) groot.queueShiftPending=0;
        if(!Number.isFinite(Number(groot.sourcePackNumber))){
            groot.sourcePackNumber=Number(groot.seeds?.[0]?.plantedAtPack)||null;
        }
        return groot;
    }

    function availableGrowthPoints(groot){
        if(!groot) return 0;
        return Math.max(0,Number(groot.growthPoints||0)-Number(groot.spentGrowthPoints||0)-Number(groot.expiredGrowthPoints||0)-Number(groot.convertedGrowthPoints||0));
    }

    function getReward(rewardId){
        return GARDEN_REWARDS.find(item=>item.id===String(rewardId||""))||null;
    }

    function getGardenStatus(playerName){
        const groot=getGardenData(playerName);
        if(!groot) return null;
        const purchases=Array.isArray(groot.purchases)?groot.purchases:[];
        return {
            gardenReady:Boolean(groot.gardenReady),
            gardenUnlocked:Boolean(groot.gardenUnlocked),
            gardenMandatory:Boolean(groot.gardenMandatory),
            gardenClosed:Boolean(groot.gardenClosed),
            growthPoints:Number(groot.growthPoints||0),
            spentGrowthPoints:Number(groot.spentGrowthPoints||0),
            expiredGrowthPoints:Number(groot.expiredGrowthPoints||0),
            convertedGrowthPoints:Number(groot.convertedGrowthPoints||0),
            convertedJeffCoins:Number(groot.convertedJeffCoins||0),
            availableGrowthPoints:availableGrowthPoints(groot),
            purchases:clone(purchases),
            purchaseCount:purchases.length,
            maxPurchases:MAX_GARDEN_PURCHASES,
            canOpen:Boolean(groot.gardenReady&&groot.gardenUnlocked&&!groot.gardenClosed&&purchases.length<MAX_GARDEN_PURCHASES)
        };
    }

    function canOpenGarden(playerName){
        const status=getGardenStatus(playerName);
        return Boolean(status?.canOpen);
    }

    function isGardenEconomyEnabled(){
        return Boolean(global.EconomyEngine?.isEnabled?.());
    }

    function remainingGardenConversionCapacity(groot){
        return Math.max(0,GARDEN_ECONOMY_CONVERSION_CAP-Math.max(0,Number(groot?.convertedJeffCoins||0)));
    }

    function gardenConversionAmount(groot){
        if(!isGardenEconomyEnabled()||!(groot?.purchases||[]).length) return 0;
        return Math.max(0,Math.min(availableGrowthPoints(groot),remainingGardenConversionCapacity(groot)));
    }

    function gardenPreflight(playerName,options={}){
        const data=engineData(playerName);
        const groot=getGardenData(playerName);
        const playerIndex=getPlayerIndex(playerName);
        if(!data||data.powerId!==POWER_ID) return {ok:false,message:"Groot nie jest przypisany do tego gracza."};
        if(!groot?.gardenReady) return {ok:false,message:"Ogród Groota jeszcze nie dojrzał. Najpierw oba Nasiona Planety X muszą zostać zebrane."};
        if(!groot.gardenUnlocked) return {ok:false,message:"Ogród Groota nie jest sklepem na żądanie — otworzy się automatycznie po zakończeniu paczki (lub rozstrzygnięcia Gwiezdnego Prądu)."};
        if(groot.gardenClosed) return {ok:false,message:"Ogród Groota został już zamknięty."};
        if((groot.purchases||[]).length>=MAX_GARDEN_PURCHASES) return {ok:false,message:"Groot wybrał już dwie różne nagrody z Ogrodu."};
        if(playerIndex<0) return {ok:false,message:"Nie udało się odnaleźć decku Groota."};
        if(state.active) return {ok:false,message:"Najpierw dokończ sadzenie Nasion Planety X."};
        if(state.gardenOpen&&state.gardenPlayerName!==playerName) return {ok:false,message:"Inny Ogród Groota jest już otwarty."};
        const currentBusy=getCurrentBusyState();
        if(currentBusy) return {ok:false,message:"Poczekaj, aż Gwiezdny Prąd zakończy aktualne rozstrzygnięcie."};
        // Ogród otwierany automatycznie jest obowiązkowym domknięciem paczki.
        // Nie może czekać na zagregowany stan innych UI, bo oczekujący Ogród
        // sam blokuje kolejne akcje draftu i powstałby stan bez wyjścia.
        if(!options.automatic&&!state.gardenOpen&&isExternalBusy()) return {ok:false,message:"Najpierw dokończ aktywną sekwencję draftu lub innej Supermocy."};
        return {ok:true,data,groot,playerIndex};
    }

    function ensureGardenModal(){
        let overlay=document.getElementById("spxGrootGardenOverlay");
        if(overlay) return overlay;
        overlay=document.createElement("div");
        overlay.id="spxGrootGardenOverlay";
        overlay.className="spx-groot-garden-overlay";
        overlay.hidden=true;
        overlay.innerHTML=`
            <section class="spx-groot-garden" role="dialog" aria-modal="true" aria-labelledby="spxGrootGardenTitle">
                <div class="spx-groot-garden-petals" aria-hidden="true">
                    ${Array.from({length:14},(_,index)=>`<i style="--petal-index:${index}"></i>`).join("")}
                </div>
                <header class="spx-groot-garden-head">
                    <div><span class="spx-groot-garden-kicker">PLANETA X · PUNKTY WZROSTU</span><h2 id="spxGrootGardenTitle">🌳 OGRÓD GROOTA</h2></div>
                </header>
                <div id="spxGrootGardenBody" class="spx-groot-garden-body"></div>
                <footer class="spx-groot-garden-footer">
                    <button type="button" data-groot-action="back" class="spx-groot-garden-back" hidden>← WRÓĆ DO NAGRÓD</button>
                    <div class="spx-groot-garden-footer-spacer"></div>
                    <button type="button" data-groot-action="finalize" class="spx-groot-collect-btn">ODBIERZ NAGRODY Z PLANETY X</button>
                </footer>
            </section>`;
        document.body.appendChild(overlay);
        overlay.addEventListener("click",event=>{
            if(event.target===overlay) return;
            const action=event.target.closest?.("[data-groot-action]")?.dataset?.grootAction;
            if(!action) return;
            if(action==="finalize") finalizeGarden();
            if(action==="back") renderGardenShop();
        });
        return overlay;
    }

    function setGardenBackVisible(visible){
        const overlay=ensureGardenModal();
        const button=overlay.querySelector('[data-groot-action="back"]');
        const collect=overlay.querySelector('[data-groot-action="finalize"]');
        if(button) button.hidden=!visible;
        if(collect) collect.hidden=Boolean(visible);
    }

    function renderGardenShop(){
        const groot=getGardenData(state.gardenPlayerName);
        if(!groot) return;
        state.gardenRewardId="";
        state.gardenDeckIndex=-1;
        state.gardenOptions=[];
        const overlay=ensureGardenModal();
        const body=overlay.querySelector("#spxGrootGardenBody");
        const available=availableGrowthPoints(groot);
        const purchases=Array.isArray(groot.purchases)?groot.purchases:[];
        const purchasedIds=new Set(purchases.map(item=>item?.rewardId));
        const slotsLeft=Math.max(0,MAX_GARDEN_PURCHASES-purchases.length);
        setGardenBackVisible(false);
        body.innerHTML=`
            <div class="spx-groot-wallet">
                <div><span>DOSTĘPNE</span><strong>${available} 🌿</strong></div>
                <div><span>WYBRANE</span><strong>${purchases.length}/${MAX_GARDEN_PURCHASES}</strong></div>
            </div>
            <p class="spx-groot-garden-rule"><b>🌿 WITAJ NA PLANECIE X</b> Wydaj zebrane 🌿 na nagrody Ogrodu. Wybierz co najmniej 1 i maksymalnie 2.</p>
            <p class="spx-groot-growth-ladder">${escapeHtml(growthLadderText(groot))}</p>
            ${isGardenEconomyEnabled()?`<div class="spx-groot-economy-bridge${purchases.length?" is-unlocked":" is-locked"}">
                <div class="spx-groot-economy-copy"><span>🌳</span><div><b>DRZEWO OBFITOŚCI</b><small>${purchases.length?`Pozostały Wzrost możesz zamienić 1:1 na JeffCoiny · maks. ${GARDEN_ECONOMY_CONVERSION_CAP} JC na Ogród.`:"Najpierw wybierz co najmniej 1 normalną nagrodę Ogrodu."}</small></div></div>
                <button type="button" data-groot-convert-growth ${gardenConversionAmount(groot)>0?"":"disabled"}>${gardenConversionAmount(groot)>0?`ZAMIEŃ ${gardenConversionAmount(groot)} 🌿 → ${gardenConversionAmount(groot)} JC`:(remainingGardenConversionCapacity(groot)<=0?"LIMIT 5 JC WYKORZYSTANY":"BRAK WZROSTU DO WYMIANY")}</button>
            </div>`:""}
            <div class="spx-groot-rewards">
                ${GARDEN_REWARDS.map(reward=>{
                    const purchased=purchasedIds.has(reward.id);
                    const affordable=available>=reward.cost;
                    const availability=getRewardAvailability(reward,groot,state.gardenPlayerIndex);
                    const disabled=purchased||!affordable||!availability.available||slotsLeft<=0;
                    const reasonText=!purchased&&!availability.available?String(availability.reason||"Niedostępne"):"";
                    const reason=!purchased&&!availability.available?`<em>${escapeHtml(reasonText)}</em>`:"";
                    const buttonTitle=[reward.name,reward.description,reasonText,purchased?"Już kupione":(!affordable?`Koszt: ${reward.cost} 🌿`:"")].filter(Boolean).join(" • ");
                    return `<button type="button" title="${escapeHtml(buttonTitle)}" class="spx-groot-reward${purchased?" is-purchased":""}${!availability.available?" is-unavailable":""}" data-groot-reward="${reward.id}" ${disabled?"disabled":""}>
                        <span class="spx-groot-reward-emoji">${reward.emoji}</span>
                        <span class="spx-groot-reward-copy"><b>${escapeHtml(reward.name)}</b><small>${escapeHtml(reward.description)}</small>${reason}</span>
                        <span class="spx-groot-reward-cost">${purchased?"KUPIONE":reward.cost+" 🌿"}</span>
                    </button>`;
                }).join("")}
            </div>
            ${purchases.length?`<div class="spx-groot-purchases"><b>ZDOBYTE NAGRODY</b>${purchases.map(item=>`<span>${escapeHtml(getReward(item.rewardId)?.emoji||"🌿")} ${escapeHtml(getReward(item.rewardId)?.name||item.rewardId)} · ${Number(item.cost||0)} 🌿</span>`).join("")}</div>`:""}`;
        body.querySelectorAll("[data-groot-reward]").forEach(button=>button.addEventListener("click",()=>beginReward(button.dataset.grootReward)));
        body.querySelector("[data-groot-convert-growth]")?.addEventListener("click",()=>convertGrowthToJeffCoins());
        const collect=overlay.querySelector('[data-groot-action="finalize"]');
        if(collect){
            collect.hidden=false;
            collect.disabled=purchases.length<1&&hasMandatoryLegalReward(groot,state.gardenPlayerIndex);
            collect.textContent=purchases.length
                ? `ODBIERZ NAGRODY Z PLANETY X · ${purchases.length}/${MAX_GARDEN_PURCHASES}`
                : "ODBIERZ NAGRODY Z PLANETY X";
        }
    }

    function renderGardenMessage(title,message,kind="info"){
        const body=ensureGardenModal().querySelector("#spxGrootGardenBody");
        body.innerHTML=`<div class="spx-groot-garden-message" data-kind="${escapeHtml(kind)}"><b>${escapeHtml(title)}</b><span>${escapeHtml(message)}</span></div>`;
    }

    function showGardenModal(){
        const overlay=ensureGardenModal();
        overlay.hidden=false;
        const garden=overlay.querySelector(".spx-groot-garden");
        if(garden){
            garden.classList.remove("is-entering-planetx");
            void garden.offsetWidth;
            garden.classList.add("is-entering-planetx");
            global.setTimeout?.(()=>garden.classList.remove("is-entering-planetx"),900);
        }
        state.gardenHidden=false;
        document.body.classList.add("spx-groot-garden-open");
        return overlay;
    }

    function openGarden(playerName,options={}){
        const check=gardenPreflight(playerName,options);
        if(!check.ok){
            if(!options.silent) global.SuperpowerFeedback?.warning?.(POWER_ID,"OGRÓD PLANETY X NIEDOSTĘPNY",check.message);
            return false;
        }
        if(state.gardenOpen&&state.gardenPlayerName===playerName){
            showGardenModal();
            return true;
        }
        state.gardenOpen=true;
        state.gardenPlayerName=playerName;
        state.gardenPlayerIndex=check.playerIndex;
        state.gardenRewardId="";
        state.gardenDeckIndex=-1;
        state.gardenOptions=[];
        state.gardenSeedSourceIndex=-1;
        state.gardenSeedTargetIndexes=[];
        state.gardenTransaction=false;
        state.gardenAutomatic=Boolean(options.automatic);
        state.gardenHidden=false;
        showGardenModal();
        renderGardenShop();
        return true;
    }

    function hideGardenModal(){
        const overlay=document.getElementById("spxGrootGardenOverlay");
        if(overlay) overlay.hidden=true;
        state.gardenOpen=false;
        state.gardenRewardId="";
        state.gardenDeckIndex=-1;
        state.gardenOptions=[];
        state.gardenSeedSourceIndex=-1;
        state.gardenSeedTargetIndexes=[];
        state.gardenAutomatic=false;
        state.gardenHidden=false;
        document.body.classList.remove("spx-groot-garden-open");
        global.GraveyardUI?.refreshButton?.();
        return true;
    }

    function playGardenExit(onDone){
        const overlay=document.getElementById("spxGrootGardenOverlay");
        const garden=overlay?.querySelector?.(".spx-groot-garden");
        if(!overlay||!garden){onDone?.();return false;}
        const reduced=Boolean(global.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
        garden.classList.add("is-leaving-planetx");
        const scene=document.createElement("div");
        scene.className="spx-groot-planet-exit";
        scene.setAttribute("aria-live","polite");
        scene.innerHTML=`<strong>OPUSZCZASZ PLANETĘ X</strong><span>Ogród Groota zamyka się.</span><div aria-hidden="true">${Array.from({length:16},(_,index)=>`<i style="--exit-index:${index}"></i>`).join("")}</div>`;
        garden.appendChild(scene);
        global.setTimeout?.(()=>{
            scene.remove();
            garden.classList.remove("is-leaving-planetx");
            onDone?.();
        },reduced?180:1050);
        return true;
    }

    function hasMandatoryLegalReward(groot,playerIndex){
        const available=availableGrowthPoints(groot);
        return GARDEN_REWARDS.some(reward=>
            reward.cost<=available &&
            !(groot.purchases||[]).some(item=>item.rewardId===reward.id) &&
            getRewardAvailability(reward,groot,playerIndex).available
        );
    }

    function dismissGarden(){
        if(state.gardenTransaction) return false;
        if(!state.gardenOpen) return false;
        renderGardenMessage("PLANETA X JESZCZE CIĘ NIE WYPUSZCZA","Odbierz co najmniej jedną dostępną nagrodę i zakończ wizytę w Ogrodzie.","warning");
        showGardenModal();
        return false;
    }

    function convertGrowthToJeffCoins(){
        if(state.gardenTransaction||!state.gardenOpen) return false;
        const groot=getGardenData(state.gardenPlayerName);
        if(!groot||!isGardenEconomyEnabled()) return false;
        if(!(groot.purchases||[]).length){
            renderGardenMessage("NAJPIERW WYBIERZ NAGRODĘ","Drzewo Obfitości budzi się dopiero po wybraniu co najmniej jednej normalnej nagrody Ogrodu.","warning");
            return false;
        }
        const amount=gardenConversionAmount(groot);
        if(amount<=0) return false;
        state.gardenTransaction=true;
        const result=global.EconomyEngine?.credit?.(state.gardenPlayerIndex,amount,{
            kind:"bonus",
            reason:"groot_tree_of_abundance",
            packNumber:(typeof packStartIndex!=="undefined"?packStartIndex:0)+1,
            pickIndex:typeof currentPickIndex!=="undefined"?currentPickIndex:0,
            data:{powerId:POWER_ID,source:"groot_garden",growthSpent:amount,conversionRate:"1:1",conversionCap:GARDEN_ECONOMY_CONVERSION_CAP}
        });
        if(!result?.ok){
            state.gardenTransaction=false;
            renderGardenMessage("DRZEWO NIE ZAKWITŁO",result?.reason||"Nie udało się zamienić Wzrostu na JeffCoiny.","warning");
            return false;
        }
        groot.convertedGrowthPoints=Math.max(0,Number(groot.convertedGrowthPoints||0))+amount;
        groot.convertedJeffCoins=Math.max(0,Number(groot.convertedJeffCoins||0))+amount;
        logGardenEvent("groot_growth_converted_to_jeffcoins",{growthSpent:amount,jeffCoinsGranted:amount,conversionRate:"1:1",conversionCap:GARDEN_ECONOMY_CONVERSION_CAP,remainingGrowthPoints:availableGrowthPoints(groot)});
        global.EconomyEngine?.playJeffCoinAward?.(state.gardenPlayerIndex,amount,{source:"groot",label:"DRZEWO OBFITOŚCI"});
        state.gardenTransaction=false;
        showGrowthToast(`<b>🌳 DRZEWO OBFITOŚCI</b><span>${amount} 🌿 zamieniło się w ${amount} JeffCoinów.</span>`,`garden`);
        renderGardenShop();
        return true;
    }

    function finalizeGarden(options={}){
        if(!state.gardenOpen||state.gardenTransaction) return false;
        const groot=getGardenData(state.gardenPlayerName);
        if(!groot) return false;
        const purchases=(groot.purchases||[]).length;
        if(groot.gardenMandatory&&purchases<1&&hasMandatoryLegalReward(groot,state.gardenPlayerIndex)){
            renderGardenMessage("NAJPIERW WYBIERZ NAGRODĘ","Groot musi zabrać przynajmniej jedną nagrodę z tego Ogrodu.","warning");
            return false;
        }
        const remaining=availableGrowthPoints(groot);
        groot.expiredGrowthPoints=Math.max(0,Number(groot.expiredGrowthPoints||0))+remaining;
        groot.gardenMandatory=false;
        groot.gardenClosed=true;
        groot.gardenClosedAt=Date.now();
        groot.gardenClosedAtPick=typeof currentPickIndex!=="undefined"?currentPickIndex:0;
        if(getGrootOwners().every(owner=>Boolean(getGardenData(owner)?.gardenClosed))) clearGrowthToasts();
        logGardenEvent("groot_garden_closed",{expiredGrowthPoints:remaining,purchaseCount:purchases});
        const finishGardenExit=()=>{
            hideGardenModal();
            if(typeof showDecks==="function") showDecks();
            if(typeof renderSuperpowerRosterPanel==="function") renderSuperpowerRosterPanel();
            global.setTimeout?.(()=>{
                const openedNext=openNextUnlockedGarden();
                if(!openedNext) global.continuePostDraftAfterGrootGardens?.();
            },90);
        };
        playGardenExit(finishGardenExit);
        return true;
    }

    function legalDeckEntries(playerIndex){
        const deck=Array.isArray(global.decks?.[playerIndex])?global.decks[playerIndex]:(typeof decks!=="undefined"&&Array.isArray(decks?.[playerIndex])?decks[playerIndex]:[]);
        return deck.map((card,index)=>({card,index})).filter(entry=>entry.card&&typeof entry.card==="object");
    }

    function getSeedSourceOptions(groot,playerIndex){
        const deck=legalDeckEntries(playerIndex);
        const occupied=new Set(deck.map(entry=>normalizedName(entry.card)).filter(Boolean));
        return (Array.isArray(groot?.seeds)?groot.seeds:[]).map((seed,index)=>{
            let template=seed?.cardTemplate||null;
            if(!template&&seed?.cardName){
                const database=Array.isArray(global.cardDatabase)?global.cardDatabase:[];
                template=database.find(card=>normalizedName(card)===String(seed.cardName||"").trim().toLocaleLowerCase("pl"))||null;
            }
            const name=normalizedName(template||{name:seed?.cardName});
            return {seed,index,template,available:Boolean(template&&name&&!occupied.has(name)),reason:occupied.has(name)?"Ta karta jest już w decku Groota.":(!template?"Brak zapisanego wzorca karty.":"")};
        });
    }

    function getSamePackGraveyardEntries(groot,playerIndex,cardIndex=null){
        const engine=global.DraftStateEngine;
        if(!engine?.listGraveyardEntries) return [];
        const packNumber=Number(groot?.sourcePackNumber)||Number(groot?.seeds?.[0]?.plantedAtPack)||null;
        const deck=legalDeckEntries(playerIndex);
        const bannedSource=Array.isArray(global.bannedCards)?global.bannedCards:[];
        const banned=new Set(bannedSource.map(item=>String(item||"").trim().toLocaleLowerCase("pl")));
        const occupied=new Set(deck.filter(entry=>cardIndex===null||entry.index!==cardIndex).map(entry=>normalizedName(entry.card)).filter(Boolean));
        const seen=new Set();
        return engine.listGraveyardEntries({status:"available",recoverable:true}).filter(entry=>{
            const card=entry?.card;
            const name=normalizedName(card);
            if(!card||card.joker||!name||seen.has(name)||banned.has(name)||occupied.has(name)) return false;
            if(packNumber&&Number(entry.packNumber)!==packNumber) return false;
            if(["jokerRejected","temporaryRemoved"].includes(String(entry.category||""))) return false;
            seen.add(name);
            return true;
        });
    }

    function hasFuturePickOpportunity(){
        const current=global.GalacticCurrent?.getState?.();
        if(current?.active){
            return !(Array.isArray(global.decks)&&global.decks.every(deck=>Array.isArray(deck)&&deck.length>=12));
        }
        if(typeof totalPacks==="function"&&typeof packStartIndex!=="undefined") return Number(packStartIndex)<Number(totalPacks())-1;
        return true;
    }

    function getQueueShiftPotential(playerName,shift=3){
        const playerIndex=getPlayerIndex(playerName);
        if(playerIndex<0||!hasFuturePickOpportunity()) return 0;
        const current=global.GalacticCurrent?.getState?.();
        if(current?.active&&typeof pickOrder!=="undefined"&&Array.isArray(pickOrder)&&typeof currentPickIndex!=="undefined"){
            const from=Math.max(0,Number(currentPickIndex));
            const index=pickOrder.findIndex((value,i)=>i>=from&&Number(value)===playerIndex);
            return index<0?0:Math.max(0,Math.min(Number(shift)||3,index-from));
        }
        if(typeof packStartIndex!=="undefined"&&typeof numPlayers!=="undefined"){
            const n=Math.max(1,Number(numPlayers)||getPlayers().length||1);
            const nextPackIndex=Number(packStartIndex)+1;
            const order=[];
            for(let i=0;i<n;i++) order.push((nextPackIndex+i)%n);
            for(let i=n-1;i>=0;i--) order.push((nextPackIndex+i)%n);
            const index=order.findIndex(value=>Number(value)===playerIndex);
            return index<0?0:Math.max(0,Math.min(Number(shift)||3,index));
        }
        return Number(shift)||3;
    }

    function getRewardAvailability(reward,groot,playerIndex){
        const deck=legalDeckEntries(playerIndex);
        if(!reward) return {available:false,reason:"Nieznana nagroda."};
        if(reward.kind==="queue_shift"){
            const potential=getQueueShiftPotential(state.gardenPlayerName,Number(reward.shift)||3);
            return potential>0
                ? {available:true}
                : {available:false,reason:"Najbliższego picku Groota nie da się już przesunąć wcześniej."};
        }
        if(reward.kind==="joker"){
            if(!deck.length) return {available:false,reason:"Deck Groota jest pusty."};
            if(!global.JokerV2UI?.resolveForEffect||typeof global.getRandomJoker!=="function") return {available:false,reason:"Leśny Joker nie odpowiada."};
            return {available:true};
        }
        if(reward.kind==="seed_copy"){
            if(deck.length<3) return {available:false,reason:"Potrzebujesz co najmniej 3 kart w decku."};
            if(!getSeedSourceOptions(groot,playerIndex).some(option=>option.available)) return {available:false,reason:"Żadna z kart-nasion nie może teraz zostać skopiowana bez duplikatu."};
            return {available:true};
        }
        if(reward.kind==="graveyard"){
            if(!deck.length) return {available:false,reason:"Deck Groota jest pusty."};
            const hasRecoverableCard=deck.some(entry=>getSamePackGraveyardEntries(groot,playerIndex,entry.index).length>0);
            return hasRecoverableCard?{available:true}:{available:false,reason:"W Graveyardzie tej paczki nie ma karty, która może odrosnąć."};
        }
        if(reward.kind==="protect"){
            return deck.some(entry=>!getProtection(entry.card))?{available:true}:{available:false,reason:"Wszystkie karty Groota są już chronione."};
        }
        if(reward.kind==="replace"){
            const need=Number(reward.options)||0;
            if(reward.chooseCost){
                const hasCostSet=deck.some(entry=>{
                    const counts=new Map();
                    replacementPool(playerIndex,entry.index).forEach(card=>{
                        const cost=Number(card?.cost);
                        if(Number.isFinite(cost)) counts.set(cost,(counts.get(cost)||0)+1);
                    });
                    return [...counts.values()].some(count=>count>=need);
                });
                return hasCostSet?{available:true}:{available:false,reason:`Ogród nie znalazł Costu z co najmniej ${need} legalnymi kartami.`};
            }
            return deck.some(entry=>replacementPool(playerIndex,entry.index).length>=need)?{available:true}:{available:false,reason:`Ogród nie znalazł ${need} kart do tej wymiany.`};
        }
        return deck.length?{available:true}:{available:false,reason:"Deck Groota jest pusty."};
    }

    function renderDeckTargetStep(reward){
        const entries=legalDeckEntries(state.gardenPlayerIndex);
        const body=ensureGardenModal().querySelector("#spxGrootGardenBody");
        setGardenBackVisible(true);
        if(!entries.length){
            renderGardenMessage("DECK JEST JESZCZE PUSTY","Wróć do draftu i otwórz Ogród ponownie, gdy Groot będzie miał kartę, na której może zakorzenić nagrodę.","warning");
            return;
        }
        body.innerHTML=`
            <div class="spx-groot-step-head"><span>${reward.emoji}</span><div><b>${escapeHtml(reward.name)}</b><small>Wybierz kartę Groota, której dotyczy nagroda.</small></div><strong>${reward.cost} 🌿</strong></div>
            <div class="spx-groot-deck-grid">${entries.map(entry=>`<button type="button" class="spx-groot-deck-card" data-groot-deck-index="${entry.index}"><span class="cost">${escapeHtml(entry.card.cost??"?")}</span><b>${escapeHtml(entry.card.name||"KARTA")}</b><span class="power">${escapeHtml(entry.card.power??"?")}</span></button>`).join("")}</div>`;
        body.querySelectorAll("[data-groot-deck-index]").forEach(button=>button.addEventListener("click",()=>selectGardenDeckCard(Number(button.dataset.grootDeckIndex))));
    }

    function beginReward(rewardId){
        const reward=getReward(rewardId);
        const groot=getGardenData(state.gardenPlayerName);
        if(!reward||!groot||state.gardenTransaction) return false;
        const purchases=Array.isArray(groot.purchases)?groot.purchases:[];
        if(purchases.some(item=>item.rewardId===reward.id)){renderGardenMessage("TA NAGRODA JUŻ WYROSŁA","Każdą nagrodę Ogrodu można kupić tylko raz.","warning");return false;}
        if(purchases.length>=MAX_GARDEN_PURCHASES){renderGardenMessage("OGRÓD JEST PEŁNY","Groot może zabrać maksymalnie dwie różne nagrody.","warning");return false;}
        if(availableGrowthPoints(groot)<reward.cost){renderGardenMessage("ZA MAŁO WZROSTU",`Potrzebujesz ${reward.cost} Punktów Wzrostu.`,"warning");return false;}
        const availability=getRewardAvailability(reward,groot,state.gardenPlayerIndex);
        if(!availability.available){renderGardenMessage("NAGRODA NIEDOSTĘPNA",availability.reason||"Tej nagrody nie można teraz wybrać.","warning");return false;}
        state.gardenRewardId=reward.id;
        state.gardenDeckIndex=-1;
        state.gardenOptions=[];
        state.gardenSeedSourceIndex=-1;
        state.gardenSeedTargetIndexes=[];
        if(reward.kind==="queue_shift") return commitQueueShiftReward(reward);
        if(reward.kind==="seed_copy") return renderSeedSourceStep(reward);
        renderDeckTargetStep(reward);
        return true;
    }

    function normalizedName(card){return String(card?.name||"").trim().toLocaleLowerCase("pl");}

    function replacementPool(playerIndex,cardIndex){
        const database=Array.isArray(global.cardDatabase)?global.cardDatabase:(typeof cardDatabase!=="undefined"&&Array.isArray(cardDatabase)?cardDatabase:[]);
        const deck=legalDeckEntries(playerIndex);
        const bannedSource=Array.isArray(global.bannedCards)?global.bannedCards:(typeof bannedCards!=="undefined"&&Array.isArray(bannedCards)?bannedCards:[]);
        const banned=new Set(bannedSource.map(item=>String(item||"").trim().toLocaleLowerCase("pl")));
        const occupied=new Set(deck.filter(entry=>entry.index!==cardIndex).map(entry=>normalizedName(entry.card)).filter(Boolean));
        const currentName=normalizedName(deck.find(entry=>entry.index===cardIndex)?.card);
        const seen=new Set();
        return database.filter(card=>{
            const name=normalizedName(card);
            if(!name||seen.has(name)||name===currentName||occupied.has(name)||banned.has(name)||card?.joker) return false;
            if(!Number.isFinite(Number(card?.cost))||!Number.isFinite(Number(card?.power))) return false;
            seen.add(name);return true;
        });
    }

    function shuffled(list){
        const result=[...(Array.isArray(list)?list:[])];
        for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
        return result;
    }

    function selectGardenDeckCard(cardIndex){
        const reward=getReward(state.gardenRewardId);
        const entry=legalDeckEntries(state.gardenPlayerIndex).find(item=>item.index===cardIndex);
        if(!reward||!entry) return false;
        state.gardenDeckIndex=cardIndex;
        if(reward.kind==="protect" && getProtection(entry.card)){
            renderGardenMessage("TA KARTA JUŻ MA KORZENIE","Wybierz inną kartę. Aktywne ochrony Groota nie nakładają się na siebie.","warning");
            return false;
        }
        if(reward.kind==="protect") return commitProtectionReward(reward,entry.card);
        if(reward.kind==="joker") return beginJokerReward(reward,entry.card);
        if(reward.kind==="graveyard"){
            const entries=shuffled(getSamePackGraveyardEntries(getGardenData(state.gardenPlayerName),state.gardenPlayerIndex,cardIndex)).slice(0,Number(reward.options)||3);
            if(!entries.length){
                renderGardenMessage("KORZENIE NIE ZNALAZŁY KARTY","W Graveyardzie tej paczki nic nie może teraz odrosnąć.","warning");
                return false;
            }
            state.gardenOptions=entries;
            renderGraveyardOptions(reward,entry.card,entries);
            return true;
        }
        if(reward.kind==="replace"&&reward.chooseCost){
            return renderHeartCostStep(reward,entry.card);
        }
        const options=shuffled(replacementPool(state.gardenPlayerIndex,cardIndex)).slice(0,Number(reward.options)||0);
        if(options.length<Number(reward.options||0)){
            renderGardenMessage("KORZENIE NIE ZNALAZŁY DROGI","Nie udało się wykonać tej wymiany. Spróbuj ponownie.","warning");
            return false;
        }
        state.gardenOptions=options;
        renderReplacementOptions(reward,entry.card,options);
        return true;
    }

    function getHeartCostOptions(reward){
        const need=Math.max(1,Number(reward?.options)||4);
        const pool=replacementPool(state.gardenPlayerIndex,state.gardenDeckIndex);
        const groups=new Map();
        pool.forEach(card=>{
            const cost=Number(card?.cost);
            if(!Number.isFinite(cost)) return;
            if(!groups.has(cost)) groups.set(cost,[]);
            groups.get(cost).push(card);
        });
        return [...groups.entries()]
            .filter(([,cards])=>cards.length>=need)
            .sort((a,b)=>a[0]-b[0])
            .map(([cost,cards])=>({cost,cards}));
    }

    function renderHeartCostStep(reward,sourceCard){
        const costs=getHeartCostOptions(reward);
        if(!costs.length){
            renderGardenMessage("SERCE NIE ZNALAZŁO ŚCIEŻKI",`Brakuje Costu z co najmniej ${Number(reward.options)||4} legalnymi kartami do wyboru. Nic nie zostało wydane.`,"warning");
            return false;
        }
        const body=ensureGardenModal().querySelector("#spxGrootGardenBody");
        setGardenBackVisible(true);
        body.innerHTML=`
            <div class="spx-groot-step-head"><span>${reward.emoji}</span><div><b>${escapeHtml(reward.name)}</b><small>${escapeHtml(sourceCard?.name||"Karta")} zostanie zastąpiona. Najpierw wybierz Cost nowej karty.</small></div><strong>${reward.cost} 🌿</strong></div>
            <div class="spx-groot-cost-grid">${costs.map(item=>`<button type="button" class="spx-groot-cost-choice" data-groot-heart-cost="${item.cost}"><span>${item.cost}</span><b>COST ${item.cost}</b><small>${item.cards.length} legalnych kart</small></button>`).join("")}</div>
            <p class="spx-groot-option-note">Po wyborze Costu Serce pokaże dokładnie 4 losowe legalne karty o tej wartości.</p>`;
        body.querySelectorAll("[data-groot-heart-cost]").forEach(button=>button.addEventListener("click",()=>selectHeartCost(reward,Number(button.dataset.grootHeartCost))));
        return true;
    }

    function selectHeartCost(reward,cost){
        const group=getHeartCostOptions(reward).find(item=>Number(item.cost)===Number(cost));
        const source=legalDeckEntries(state.gardenPlayerIndex).find(item=>item.index===state.gardenDeckIndex);
        if(!group||!source) return false;
        const need=Math.max(1,Number(reward.options)||4);
        const options=shuffled(group.cards).slice(0,need);
        if(options.length<need) return false;
        state.gardenOptions=options;
        renderReplacementOptions(reward,source.card,options,{selectedCost:Number(cost)});
        return true;
    }

    function renderReplacementOptions(reward,sourceCard,options,context={}){
        const body=ensureGardenModal().querySelector("#spxGrootGardenBody");
        setGardenBackVisible(true);
        body.innerHTML=`
            <div class="spx-groot-step-head"><span>${reward.emoji}</span><div><b>${escapeHtml(reward.name)}</b><small>${escapeHtml(sourceCard?.name||"Karta")} zostanie zastąpiona. Wybierz jedną realną opcję.</small></div><strong>${reward.cost} 🌿</strong></div>
            <div class="spx-groot-options">${options.map((card,index)=>`<button type="button" class="spx-groot-option-card" data-groot-option-index="${index}"><span class="cost">${escapeHtml(card.cost??"?")}</span><b>${escapeHtml(card.name||"KARTA")}</b><span class="power">${escapeHtml(card.power??"?")}</span></button>`).join("")}</div>
            <p class="spx-groot-option-note">${reward.chooseCost?`Cost ${Number(context.selectedCost)} • `:""}Niewybrane propozycje są tylko wizją Ogrodu — nie trafiają do Graveyardu.</p>`;
        body.querySelectorAll("[data-groot-option-index]").forEach(button=>button.addEventListener("click",()=>commitReplacementReward(reward,Number(button.dataset.grootOptionIndex),context)));
    }

    function renderSeedSourceStep(reward){
        const groot=getGardenData(state.gardenPlayerName);
        const options=getSeedSourceOptions(groot,state.gardenPlayerIndex);
        const body=ensureGardenModal().querySelector("#spxGrootGardenBody");
        setGardenBackVisible(true);
        body.innerHTML=`
            <div class="spx-groot-step-head"><span>${reward.emoji}</span><div><b>${escapeHtml(reward.name)}</b><small>Wybierz kartę, na której rosło jedno z dwóch Nasion.</small></div><strong>${reward.cost} 🌿</strong></div>
            <div class="spx-groot-options">${options.map(option=>{
                const card=option.template||{};
                return `<button type="button" class="spx-groot-option-card" data-groot-seed-source="${option.index}" ${option.available?"":"disabled"}><span class="cost">${escapeHtml(card.cost??"?")}</span><b>${escapeHtml(card.name||option.seed?.cardName||"KARTA")}</b><span class="power">${escapeHtml(card.power??"?")}</span></button>`;
            }).join("")}</div>
            <p class="spx-groot-option-note">Następnie zobaczysz 3 losowe karty z decku Groota. Jedną z nich zastąpisz kopią karty-nasiona.</p>`;
        body.querySelectorAll("[data-groot-seed-source]").forEach(button=>button.addEventListener("click",()=>selectSeedSource(reward,Number(button.dataset.grootSeedSource))));
        return true;
    }

    function selectSeedSource(reward,seedIndex){
        const groot=getGardenData(state.gardenPlayerName);
        const option=getSeedSourceOptions(groot,state.gardenPlayerIndex).find(item=>item.index===seedIndex&&item.available);
        if(!option) return false;
        const targets=shuffled(legalDeckEntries(state.gardenPlayerIndex)).slice(0,3);
        if(targets.length<3){renderGardenMessage("ZA MAŁO KART W DECKU","SZCZEP NASIONA wymaga co najmniej 3 kart w decku.","warning");return false;}
        state.gardenSeedSourceIndex=seedIndex;
        state.gardenSeedTargetIndexes=targets.map(entry=>entry.index);
        state.gardenOptions=[option.template];
        const body=ensureGardenModal().querySelector("#spxGrootGardenBody");
        body.innerHTML=`
            <div class="spx-groot-step-head"><span>${reward.emoji}</span><div><b>${escapeHtml(reward.name)}</b><small>${escapeHtml(option.template?.name||option.seed?.cardName||"Karta")} odrośnie w decku. Wybierz 1 z 3 losowych kart do zastąpienia.</small></div><strong>${reward.cost} 🌿</strong></div>
            <div class="spx-groot-deck-grid">${targets.map(entry=>`<button type="button" class="spx-groot-deck-card" data-groot-seed-target="${entry.index}"><span class="cost">${escapeHtml(entry.card.cost??"?")}</span><b>${escapeHtml(entry.card.name||"KARTA")}</b><span class="power">${escapeHtml(entry.card.power??"?")}</span></button>`).join("")}</div>`;
        body.querySelectorAll("[data-groot-seed-target]").forEach(button=>button.addEventListener("click",()=>commitSeedCopyReward(reward,Number(button.dataset.grootSeedTarget))));
        return true;
    }

    function commitSeedCopyReward(reward,targetIndex){
        const template=state.gardenOptions?.[0];
        const source=legalDeckEntries(state.gardenPlayerIndex).find(entry=>entry.index===targetIndex&&state.gardenSeedTargetIndexes.includes(entry.index));
        if(!template||!source) return false;
        state.gardenDeckIndex=targetIndex;
        return commitReplacementTemplate(reward,template,{seedCopy:true,seedSourceIndex:state.gardenSeedSourceIndex});
    }

    function renderGraveyardOptions(reward,sourceCard,entries){
        const body=ensureGardenModal().querySelector("#spxGrootGardenBody");
        setGardenBackVisible(true);
        body.innerHTML=`
            <div class="spx-groot-step-head"><span>${reward.emoji}</span><div><b>${escapeHtml(reward.name)}</b><small>${escapeHtml(sourceCard?.name||"Karta")} zostanie zastąpiona. Wybierz kartę, która odrośnie z Graveyardu tej paczki.</small></div><strong>${reward.cost} 🌿</strong></div>
            <div class="spx-groot-options">${entries.map((entry,index)=>`<button type="button" class="spx-groot-option-card" data-groot-grave-index="${index}"><span class="cost">${escapeHtml(entry.card?.cost??"?")}</span><b>${escapeHtml(entry.card?.name||"KARTA")}</b><span class="power">${escapeHtml(entry.card?.power??"?")}</span></button>`).join("")}</div>`;
        body.querySelectorAll("[data-groot-grave-index]").forEach(button=>button.addEventListener("click",()=>commitGraveyardReward(reward,Number(button.dataset.grootGraveIndex))));
    }

    function commitGraveyardReward(reward,optionIndex){
        const entry=state.gardenOptions?.[optionIndex];
        if(!entry?.card||!entry.graveyardEntryId) return false;
        const engine=global.DraftStateEngine;
        const consumed=engine?.consumeGraveyardEntry?.(entry.graveyardEntryId,{consumer:"groot_garden",powerId:POWER_ID,reason:"groot_rebirth",playerIndex:state.gardenPlayerIndex,packNumber:(typeof packStartIndex!=="undefined"?packStartIndex:0)+1,pickIndex:typeof currentPickIndex!=="undefined"?currentPickIndex:0});
        if(!consumed){renderGardenMessage("KARTA ZNIKNĘŁA Z GRAVEYARDU","Wybierz nagrodę ponownie. Nic nie zostało wydane.","warning");return false;}
        const ok=commitReplacementTemplate(reward,entry.card,{graveyardEntryId:entry.graveyardEntryId,graveyardCategory:entry.category,fromGraveyard:true});
        if(!ok){engine?.restoreGraveyardEntry?.(entry.graveyardEntryId,{reason:"groot_rebirth_rollback",powerId:POWER_ID});return false;}
        return true;
    }

    function beginJokerReward(reward,sourceCard){
        if(state.gardenTransaction) return false;
        const randomJoker=typeof global.getRandomJoker==="function"?global.getRandomJoker():null;
        if(!randomJoker||!global.JokerV2UI?.resolveForEffect){renderGardenMessage("JOKER NIE ODPOWIADA","Leśny Joker nie pojawił się w Ogrodzie. Nic nie zostało wydane.","warning");return false;}
        const joker={joker:true,...randomJoker};
        state.gardenTransaction=true;
        hideGardenModalForSubflow();
        const opened=global.JokerV2UI.resolveForEffect(joker,{
            playerIndex:state.gardenPlayerIndex,
            sourceZone:"groot_garden",
            sourcePowerId:POWER_ID,
            sourceEvent:"groot_garden_wild_joker",
            onResolve:(resolvedCard)=>{
                state.gardenTransaction=false;
                showGardenModalAfterSubflow();
                commitReplacementTemplate(reward,resolvedCard,{jokerId:joker.id||null,jokerType:global.getJokerMode?.(joker)||joker.type||null,wildJoker:true,archivePendingJoker:true});
            },
            onCancel:()=>{
                state.gardenTransaction=false;
                showGardenModalAfterSubflow();
                renderGardenMessage("JOKER ODWOŁANY","Nagroda nie została kupiona i Punkty Wzrostu nie zostały wydane.","warning");
            }
        });
        if(!opened){state.gardenTransaction=false;showGardenModalAfterSubflow();renderGardenMessage("JOKER NIE ODPOWIADA","Nie udało się otworzyć rozstrzygnięcia Jokera.","warning");return false;}
        return true;
    }

    function hideGardenModalForSubflow(){
        const overlay=document.getElementById("spxGrootGardenOverlay");
        if(overlay) overlay.hidden=true;
    }

    function showGardenModalAfterSubflow(){
        const overlay=ensureGardenModal();
        overlay.hidden=false;
        document.body.classList.add("spx-groot-garden-open");
    }

    function applyPendingQueueShift(playerName,options={}){
        const groot=getGardenData(playerName);
        const shift=Math.max(0,Number(groot?.queueShiftPending)||0);
        if(!groot||!shift||typeof pickOrder==="undefined"||!Array.isArray(pickOrder)) return {applied:false,reason:"no_pending_shift"};
        const playerIndex=getPlayerIndex(playerName);
        if(playerIndex<0) return {applied:false,reason:"missing_player"};
        const defaultFrom=typeof currentPickIndex!=="undefined"?Math.max(0,Number(currentPickIndex)):0;
        const from=Math.max(0,Number.isFinite(Number(options.fromIndex))?Number(options.fromIndex):defaultFrom);
        const index=pickOrder.findIndex((value,i)=>i>=from&&Number(value)===playerIndex);
        if(index<0) return {applied:false,reason:"no_future_slot"};
        const target=Math.max(from,index-shift);
        if(target===index){groot.queueShiftPending=0;return {applied:true,moved:0,from:index,to:target};}
        pickOrder.splice(index,1);
        pickOrder.splice(target,0,playerIndex);
        const moved=index-target;
        groot.queueShiftPending=0;
        logGardenEvent("groot_queue_shift_applied",{playerName,playerIndex,moved,fromIndex:index,toIndex:target});
        if(typeof updateRoundQueueDisplay==="function") updateRoundQueueDisplay();
        return {applied:true,moved,from:index,to:target};
    }

    function commitQueueShiftReward(reward){
        const groot=getGardenData(state.gardenPlayerName);
        if(!groot) return false;
        groot.queueShiftPending=Math.max(Number(groot.queueShiftPending)||0,Number(reward.shift)||3);
        const application=applyPendingQueueShift(state.gardenPlayerName);
        return commitPurchase(reward,{queueShift:Number(reward.shift)||3,appliedImmediately:Boolean(application.applied),moved:Number(application.moved)||0});
    }

    function refreshProtectionDecorations(){
        const decorate=(selector)=>{
            document.querySelectorAll(selector).forEach(element=>{
                const playerIndex=Number(element.dataset.playerIndex);
                const cardIndex=Number(element.dataset.cardIndex);
                const card=(Array.isArray(global.decks)?global.decks[playerIndex]?.[cardIndex]:null) || (typeof decks!=="undefined" ? decks?.[playerIndex]?.[cardIndex] : null);
                const protection=getProtection(card);
                element.classList.remove("spx-groot-protected-card","spx-groot-protected-permanent","spx-groot-protected-one-use");
                if(!protection){
                    if(element.dataset.grootProtectionTitle){
                        element.title=element.dataset.grootProtectionBaseTitle||"";
                        delete element.dataset.grootProtectionTitle;
                    }
                    return;
                }
                if(element.dataset.grootProtectionTitle!=="1"){
                    element.dataset.grootProtectionBaseTitle=element.getAttribute("title")||"";
                    element.dataset.grootProtectionTitle="1";
                }
                element.classList.add("spx-groot-protected-card", protection.kind==="one_use"?"spx-groot-protected-one-use":"spx-groot-protected-permanent");
                const protectionText=protection.kind==="one_use"
                    ? "Ochrona Groota — karta chroniona przed wrogą ingerencją. Jednorazowa osłona."
                    : "Ochrona Groota — karta chroniona przed wrogą ingerencją do końca draftu.";
                element.title=protectionText;
            });
        };
        decorate('.deck .card[data-player-index][data-card-index]');
        decorate('.deckInspectorCard[data-player-index][data-card-index]');
    }

    function makeProtectionRecord(playerName,reward,card){
        return {
            protectionId:`groot-protection-${Date.now()}-${++protectionSequence}`,
            owner:playerName,
            rewardId:reward.id,
            kind:reward.protection,
            active:true,
            remainingUses:reward.protection==="one_use"?1:null,
            blockedEffects:["steal","copy","destroy","reroll","replace","transform"],
            createdAt:Date.now(),
            cardInstanceId:card?.instanceId||null,
            version:1
        };
    }

    function applyProtection(card,reward){
        if(!card||!reward?.protection) return null;
        const protection=makeProtectionRecord(state.gardenPlayerName,reward,card);
        card.instanceMeta={...(card.instanceMeta||{}),grootProtection:protection};
        const asset=global.SuperpowerEngine?.createRuntimeAsset?.(state.gardenPlayerName,"groot_protection",protection);
        if(asset?.assetId){
            protection.runtimeAssetId=asset.assetId;
            card.instanceMeta.grootProtection.runtimeAssetId=asset.assetId;
            global.SuperpowerEngine?.updateRuntimeAsset?.(asset.assetId,{data:{runtimeAssetId:asset.assetId}});
        }
        global.setTimeout?.(()=>refreshProtectionDecorations(),0);
        return protection;
    }

    function getProtection(card){
        const protection=card?.instanceMeta?.grootProtection;
        return protection?.active ? protection : null;
    }

    function isProtectedCard(card,effect=""){
        const protection=getProtection(card);
        if(!protection) return false;
        const normalized=String(effect||"").trim().toLowerCase();
        // Migracja starszych zapisów: ochrona Groota zawsze blokuje kopiowanie,
        // nawet jeżeli rekord powstał przed dopisaniem pola `copy`.
        if(normalized==="copy") return true;
        return !normalized||!Array.isArray(protection.blockedEffects)||protection.blockedEffects.includes(normalized);
    }

    function consumeProtection(card,effect=""){
        const protection=getProtection(card);
        if(!protection||!isProtectedCard(card,effect)) return {blocked:false};
        if(protection.kind==="permanent") return {blocked:true,consumed:false,protection:clone(protection)};
        const remaining=Math.max(0,Number(protection.remainingUses||1)-1);
        protection.remainingUses=remaining;
        protection.active=remaining>0;
        protection.consumedAt=Date.now();
        protection.consumedByEffect=String(effect||"");
        if(protection.runtimeAssetId){
            if(protection.active) global.SuperpowerEngine?.updateRuntimeAsset?.(protection.runtimeAssetId,{data:{remainingUses:remaining}});
            else global.SuperpowerEngine?.consumeRuntimeAsset?.(protection.runtimeAssetId,{reason:"groot_protection_triggered",effect:String(effect||"")});
        }
        global.setTimeout?.(()=>refreshProtectionDecorations(),0);
        return {blocked:true,consumed:!protection.active,protection:clone(protection)};
    }

    function logGardenEvent(event,data={}){
        const playerName=state.gardenPlayerName||data.playerName||"";
        const playerIndex=Number.isInteger(state.gardenPlayerIndex)?state.gardenPlayerIndex:getPlayerIndex(playerName);
        const payload={
            type:event,event,playerName,playerIndex,powerId:POWER_ID,
            packNumber:(typeof packStartIndex!=="undefined"?packStartIndex:0)+1,
            pickIndex:typeof currentPickIndex!=="undefined"?currentPickIndex:0,
            timestamp:new Date().toISOString(),...data
        };
        global.superpowerLog=global.superpowerLog||[];
        global.superpowerLog.push(payload);
        global.DraftStateEngine?.log?.(event,{packNumber:payload.packNumber,pickIndex:payload.pickIndex,playerIndex,player:playerName,reason:event,data:{powerId:POWER_ID,...data}});
    }

    function commitPurchase(reward,result={}){
        const groot=getGardenData(state.gardenPlayerName);
        if(!groot||!reward) return false;
        const available=availableGrowthPoints(groot);
        if(available<reward.cost) return false;
        if((groot.purchases||[]).some(item=>item.rewardId===reward.id)) return false;
        if((groot.purchases||[]).length>=MAX_GARDEN_PURCHASES) return false;
        const purchase={
            rewardId:reward.id,
            rewardName:reward.name,
            cost:reward.cost,
            purchasedAt:Date.now(),
            purchasedAtPack:(typeof packStartIndex!=="undefined"?packStartIndex:0)+1,
            purchasedAtPick:typeof currentPickIndex!=="undefined"?currentPickIndex:0,
            ...result
        };
        groot.purchases.push(purchase);
        groot.spentGrowthPoints=Math.max(0,Number(groot.spentGrowthPoints||0))+reward.cost;
        groot.lastPurchaseAt=Date.now();
        if(groot.purchases.length>=1) groot.gardenMandatory=false;
        logGardenEvent("groot_garden_purchase",{rewardId:reward.id,rewardName:reward.name,cost:reward.cost,remainingGrowthPoints:availableGrowthPoints(groot),...result});
        if(typeof showDecks==="function") showDecks();
        if(typeof refreshOpenDeckInspectors==="function") refreshOpenDeckInspectors();
        if(typeof renderSuperpowerRosterPanel==="function") renderSuperpowerRosterPanel();
        const purchaseCount=groot.purchases.length;
        showGrowthToast(
            purchaseCount>=MAX_GARDEN_PURCHASES
                ? `<b>🌳 OGRÓD SPEŁNIONY</b><span>${escapeHtml(reward.name)} • wybrano 2/2 nagrody. Odbierz je na dole Planety X.</span>`
                : `<b>${reward.emoji} ${escapeHtml(reward.name)}</b><span>-${reward.cost} 🌿 • zostało ${availableGrowthPoints(groot)} Punktów Wzrostu.</span>`,
            `garden`
        );
        renderGardenShop();
        return true;
    }

    function commitProtectionReward(reward,card){
        if(state.gardenTransaction) return false;
        state.gardenTransaction=true;
        const protection=applyProtection(card,reward);
        if(!protection){state.gardenTransaction=false;renderGardenMessage("NIE UDAŁO SIĘ ZAKORZENIĆ OCHRONY","Nic nie zostało wydane.","warning");return false;}
        state.gardenTransaction=false;
        return commitPurchase(reward,{targetCardName:card.name||null,targetCardInstanceId:card.instanceId||null,protectionId:protection.protectionId,protectionKind:protection.kind});
    }

    function commitReplacementTemplate(reward,replacementTemplate,extra={}){
        if(state.gardenTransaction) return false;
        const source=legalDeckEntries(state.gardenPlayerIndex).find(item=>item.index===state.gardenDeckIndex);
        if(!source||!replacementTemplate){renderGardenMessage("KARTA ZMIENIŁA POZYCJĘ","Wróć do nagród i wybierz cel ponownie. Nic nie zostało wydane.","warning");return false;}
        if(typeof global.replaceDeckCardWithHistory!=="function"&&typeof replaceDeckCardWithHistory!=="function"){
            renderGardenMessage("🌿 KORZENIE NIE ZNALAZŁY DROGI","Nie udało się wykonać tej wymiany. Spróbuj ponownie.","warning");return false;
        }
        state.gardenTransaction=true;
        const replaceFn=typeof global.replaceDeckCardWithHistory==="function"?global.replaceDeckCardWithHistory:replaceDeckCardWithHistory;
        const result=replaceFn(state.gardenPlayerIndex,state.gardenDeckIndex,replacementTemplate,{
            allowDuringSuperpower:true,
            eventType:"groot_garden_deck_replacement",
            reason:`groot_garden_${reward.id}`,
            origin:"groot_garden",
            sourcePowerId:POWER_ID,
            sourceEvent:"groot_garden_purchase",
            graveyardCategory:"replaced",
            recoverable:true,
            graveyardMetadata:{grootGarden:true,rewardId:reward.id},
            data:{rewardId:reward.id,rewardCost:reward.cost,gardenPurchase:true,...extra}
        });
        if(!result){state.gardenTransaction=false;renderGardenMessage("WYMIANA NIE POWIODŁA SIĘ","Deck pozostał bez zmian, a Punkty Wzrostu nie zostały wydane.","warning");return false;}
        if(extra.archivePendingJoker&&typeof global.archivePendingJokerRejections==="function"){
            global.archivePendingJokerRejections(result.resultCard,{source:"groot_garden_joker_rejected",powerId:POWER_ID,resolutionPath:"groot_garden_wild_joker",metadata:{rewardId:reward.id}});
        }
        let protection=null;
        if(reward.protection) protection=applyProtection(result.resultCard,reward);
        state.gardenTransaction=false;
        return commitPurchase(reward,{
            replacedCardName:result.previousCard?.name||null,
            replacedCardInstanceId:result.previousCard?.instanceId||null,
            resultCardName:result.resultCard?.name||null,
            resultCardInstanceId:result.resultCard?.instanceId||null,
            optionCount:Number(reward.options)||0,
            protectionId:protection?.protectionId||null,
            protectionKind:protection?.kind||null,
            ...extra
        });
    }

    function commitReplacementReward(reward,optionIndex,context={}){
        const replacementTemplate=state.gardenOptions?.[optionIndex];
        return commitReplacementTemplate(reward,replacementTemplate,{optionIndex,...context});
    }

    function getGrootOwners(){
        return getPlayers().filter(playerName=>engineData(playerName)?.powerId===POWER_ID&&getGardenData(playerName)?.activated);
    }

    function markGardenUnlocked(playerName,mandatory=true){
        const groot=getGardenData(playerName);
        if(!groot||!groot.gardenReady||groot.gardenClosed) return false;
        groot.gardenUnlocked=true;
        groot.gardenMandatory=Boolean(mandatory&&(groot.purchases||[]).length<1);
        groot.gardenUnlockedAt=groot.gardenUnlockedAt||Date.now();
        return true;
    }

    function getNextUnlockedGardenOwner(){
        return getGrootOwners().find(playerName=>{
            const groot=getGardenData(playerName);
            return Boolean(groot?.gardenReady&&groot.gardenUnlocked&&!groot.gardenClosed&&(groot.purchases||[]).length<MAX_GARDEN_PURCHASES);
        })||"";
    }

    function hasPendingGardenResolution(){
        return Boolean(getNextUnlockedGardenOwner());
    }

    function queueMandatoryGardenOpen(delay=80){
        const owner=getNextUnlockedGardenOwner();
        if(!owner) return false;
        clearTimeout(mandatoryGardenOpenTimer);
        mandatoryGardenOpenTimer=global.setTimeout?.(()=>{
            mandatoryGardenOpenTimer=0;
            const nextOwner=getNextUnlockedGardenOwner();
            if(!nextOwner||state.gardenOpen) return;
            const classicPackTransitionBusy=Boolean(
                (typeof packOpeningInProgress!=="undefined"&&packOpeningInProgress) ||
                (typeof packEnding!=="undefined"&&packEnding) ||
                (typeof packIsOpen!=="undefined"&&packIsOpen)
            );
            if(
                state.active ||
                state.gardenTransaction ||
                classicPackTransitionBusy ||
                Boolean(getCurrentBusyState())
            ){
                queueMandatoryGardenOpen(220);
                return;
            }
            // Po zamknięciu paczki Ogród ma pierwszeństwo przed zaległymi
            // toastami wzrostu. Punktacja jest już zapisana w stanie Ogrodu.
            clearGrowthToasts();
            if(!openGarden(nextOwner,{automatic:true,silent:true})){
                queueMandatoryGardenOpen(220);
            }
        },Math.max(0,Number(delay)||0));
        return true;
    }

    function openNextUnlockedGarden(){
        if(state.gardenOpen) return true;
        const owner=getNextUnlockedGardenOwner();
        if(!owner) return false;
        if(state.gardenTransaction||state.active||Boolean(getCurrentBusyState())){
            return queueMandatoryGardenOpen(220);
        }
        clearGrowthToasts();
        return openGarden(owner,{automatic:true,silent:true})||queueMandatoryGardenOpen(220);
    }

    function onClassicPackCompleted(context={}){
        if(global.GalacticCurrent?.getState?.()?.active) return false;
        const packNumber=Number(context.packNumber)||(typeof packStartIndex!=="undefined"?Number(packStartIndex)+1:null);
        const owners=getGrootOwners().filter(playerName=>{
            const groot=getGardenData(playerName);
            return groot&&!groot.gardenClosed&&groot.gardenReady&&Number(groot.sourcePackNumber||groot.seeds?.[0]?.plantedAtPack)===packNumber;
        });
        if(!owners.length) return false;
        owners.forEach(owner=>markGardenUnlocked(owner,true));
        queueMandatoryGardenOpen(80);
        return true;
    }

    function onCurrentResolutionComplete(context={}){
        const owners=getGrootOwners().filter(playerName=>{
            const groot=getGardenData(playerName);
            return groot?.gardenReady&&!groot.gardenClosed&&!groot.gardenUnlocked;
        });
        if(!owners.length) return false;
        owners.forEach(owner=>markGardenUnlocked(owner,true));
        queueMandatoryGardenOpen(80);
        return true;
    }

    function forceStrangeFutureJackpot(card,context={}){
        if(!activeSeeds(card).length) return {ok:false,reason:"no_active_seed"};
        return harvestCard(card,"doctor_strange_future",{
            natural:true,
            perfectEligible:true,
            forcePerfect:true,
            mode:"classic",
            sourcePowerId:"doctor_strange",
            futurePackNumber:context.futurePackNumber||null
        });
    }

    function getPowerState(playerName){
        const data=global.SuperpowerEngine?.getPlayerData?.(playerName);
        return data?.data?.groot ? JSON.parse(JSON.stringify(data.data.groot)) : null;
    }

    function getAllActiveSeeds(){
        const result=[];
        getPack().forEach((card,index)=>{
            activeSeeds(card).forEach(seed=>result.push({card,index,seed:{...seed}}));
        });
        return result;
    }

    global.GrootUI={
        start,
        cancel,
        openGarden,
        dismissGarden,
        finalizeGarden,
        canOpenGarden,
        getGardenStatus,
        getGardenRewards:()=>clone(GARDEN_REWARDS),
        getRewardAvailability:(rewardId,playerName)=>{
            const reward=getReward(rewardId),groot=getGardenData(playerName),playerIndex=getPlayerIndex(playerName);
            return getRewardAvailability(reward,groot,playerIndex);
        },
        isBusy:()=>Boolean(state.active||state.gardenOpen||state.gardenTransaction||hasPendingGardenResolution()),
        isSelecting:()=>state.active,
        isGardenOpen:()=>state.gardenOpen,
        getLockReason:()=>state.active
            ? "Dokończ sadzenie Nasion Planety X Groota."
            : (state.gardenOpen||hasPendingGardenResolution()?"Odbierz nagrody i zakończ wizytę w Ogrodzie Groota.":""),
        handlePackCardClick,
        decoratePack,
        getPowerState,
        getAllActiveSeeds,
        getActiveSeeds:card=>clone(activeSeeds(card)),
        isSeededCard:card=>Boolean(activeSeeds(card).length),
        transferSeeds,
        getProtection,
        isProtectedCard,
        consumeProtection,
        advanceSurvivors,
        harvestCard,
        onClassicPackCompleted,
        onCurrentResolutionComplete,
        forceStrangeFutureJackpot,
        applyPendingQueueShift,
        getGrowthStage:(card)=>{
            const seeds=activeSeeds(card);
            if(!seeds.length) return null;
            return Math.max(...seeds.map(seed=>stageForGrowth(seed.growth,getGrootData(seed.owner))));
        },
        getGrowthSummary:(playerName)=>{
            const groot=getGrootData(playerName);
            return groot?JSON.parse(JSON.stringify(groot)):null;
        },
        refreshProtectionDecorations,
        reset:()=>{clearTimeout(mandatoryGardenOpenTimer);hideGardenModal();clearGrowthToasts();return resetSelection(true);}
    };

    global.setTimeout?.(()=>{
        refreshProtectionDecorations();
        queueMandatoryGardenOpen(260);
    },0);
})(window);
