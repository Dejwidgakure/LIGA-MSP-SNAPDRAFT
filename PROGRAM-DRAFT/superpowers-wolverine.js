(function(global){
    "use strict";

    const POWER_ID="wolverine";
    const MAX_PACK=5;
    const state={
        active:false,phase:"idle",playerName:"",playerIndex:-1,
        firstEntry:null,firstCostIndex:-1,firstResult:null,
        secondEntry:null,secondCostIndex:-1,secondResult:null,
        committing:false,notice:""
    };

    function assignment(){return global.SuperpowerEngine?.getPlayerData?.(state.playerName)||null;}
    function isGalacticCurrent(){return Boolean(global.GalacticCurrentSuperpowerBridge?.isModeEnabled?.());}
    function flowNumber(){
        if(isGalacticCurrent()) return Number(global.GalacticCurrentSuperpowerBridge?.getFlowContext?.()?.round||1);
        return Number(packStartIndex||0)+1;
    }
    function flowSurfaceLocative(){return isGalacticCurrent()?"nurcie":"paczce";}
    function isProtected(card){return Boolean(card?.instanceMeta?.wolverineRegenerationProtected);}
    function capProtected(index,playerIndex=state.playerIndex){return typeof isCaptainAmericaProtectedCard==="function"&&isCaptainAmericaProtectedCard(playerIndex,index);}
    function isAvailableCost(card,index,excludeFirst=false,playerIndex=state.playerIndex){
        if(!card||isProtected(card)||capProtected(index,playerIndex)) return false;
        if(card?.instanceMeta?.locked||card?.instanceMeta?.cannotReplace) return false;
        if(excludeFirst&&index===state.firstCostIndex) return false;
        return true;
    }
    function normalized(value){return String(value||"").trim().toLowerCase();}
    function createsDuplicate(resultCard,costIndex,simulatedFirst=false,playerIndex=state.playerIndex){
        const deck=decks[playerIndex]||[];
        const name=normalized(resultCard?.name);
        if(!name) return true;
        return deck.some((card,index)=>{
            if(index===costIndex) return false;
            if(simulatedFirst&&index===state.firstCostIndex) return normalized(state.firstResult?.name)===name;
            return normalized(card?.name)===name;
        });
    }
    function knownTemplate(entry){
        if(entry?.card?.joker) return null;
        if(typeof findCardByName==="function") return findCardByName(entry.card.name)||entry.card;
        return (Array.isArray(cardDatabase)?cardDatabase:[]).find(card=>normalized(card?.name)===normalized(entry?.card?.name))||entry?.card||null;
    }
    function availableCostsFor(entry,simulatedFirst=false,playerIndex=state.playerIndex){
        const deck=decks[playerIndex]||[];
        const template=knownTemplate(entry);
        return deck.map((card,index)=>({card,index,ok:isAvailableCost(card,index,simulatedFirst,playerIndex)})).map(option=>{
            if(!option.ok) return option;
            if(template&&createsDuplicate(template,option.index,simulatedFirst,playerIndex)) return {...option,ok:false,reason:`${template.name} jest już w Twoim decku.`};
            return option;
        });
    }
    function getEntries(){return global.GraveyardUI?.getAvailableEntries?.()||[];}
    function preflight(playerName){
        const playerIndex=players.indexOf(playerName);
        const data=global.SuperpowerEngine?.getPlayerData?.(playerName);
        if(state.active) return {ok:false,message:"Adamantiowa Regeneracja jest już w toku."};
        if(!data||data.powerId!==POWER_ID) return {ok:false,message:"Wolverine nie jest przypisany do tego gracza."};
        if(data.used) return {ok:false,message:"Adamantiowa Regeneracja została już wykorzystana."};
        if(draftFinished) return {ok:false,message:"Draft jest już zakończony."};
        if(!packIsOpen||packOpeningInProgress||packEnding) return {ok:false,message:`Wolverine może wejść na Cmentarzysko tylko przy aktywnym, spokojnym ${isGalacticCurrent()?"nurcie":"stole paczki"}.`};
        if(flowNumber()>MAX_PACK) return {ok:false,message:isGalacticCurrent()?"Czynnik regeneracyjny działa najpóźniej podczas piątego obiegu Gwiezdnego Prądu.":"Czynnik regeneracyjny działa najpóźniej podczas piątej paczki."};
        if(pickOrder[currentPickIndex]!==playerIndex) return {ok:false,message:"Wolverine może użyć mocy wyłącznie podczas własnej tury, przed wyborem karty."};
        if(global.SuperpowerUI?.isBusy?.()) return {ok:false,message:"Najpierw dokończ aktywną sekwencję Supermocy."};
        if(global.IronFistUI?.isBusy?.()||global.JokerV2UI?.isBusy?.()||global.DraftFoundation?.hasOpenTransaction?.()) return {ok:false,message:"Najpierw dokończ aktywną sekwencję draftu."};
        if(global.GraveyardUI?.isOpen?.()) return {ok:false,message:"Najpierw zamknij podgląd Cmentarzyska."};
        const entries=getEntries();
        if(entries.length<2) return {ok:false,message:"Cmentarzysko potrzebuje co najmniej dwóch dostępnych nagrobków."};
        const costs=(decks[playerIndex]||[]).filter((card,index)=>isAvailableCost(card,index,false,playerIndex));
        if(costs.length<2) return {ok:false,message:"Wolverine potrzebuje co najmniej dwóch dostępnych kart w swoim decku."};
        const hasLegalFirst=entries.some(entry=>{
            if(entry?.card?.joker){
                return Boolean(global.JokerV2UI?.resolveForEffect)&&costs.length>0;
            }
            return Boolean(knownTemplate(entry))&&availableCostsFor(entry,false,playerIndex).some(option=>option.ok);
        });
        if(!hasLegalFirst) return {ok:false,message:"Żaden dostępny nagrobek nie może legalnie wrócić do decku Wolverinea."};
        return {ok:true,playerIndex,entries};
    }
    function reset(){
        Object.assign(state,{active:false,phase:"idle",playerName:"",playerIndex:-1,firstEntry:null,firstCostIndex:-1,firstResult:null,secondEntry:null,secondCostIndex:-1,secondResult:null,committing:false,notice:""});
        global.GraveyardUI?.close?.("wolverine_reset",true,true);
        closePrompt();
        global.GraveyardUI?.refreshButton?.();
    }
    function ensurePrompt(){
        let overlay=document.getElementById("spxWolverineOverlay");
        if(overlay) return overlay;
        overlay=document.createElement("div");
        overlay.id="spxWolverineOverlay";
        overlay.className="spx-wolverine-overlay";
        overlay.hidden=true;
        overlay.innerHTML=`<section class="spx-wolverine-dogtags" role="dialog" aria-modal="true">
            <header class="spx-wolverine-header"><img class="spx-wolverine-emblem" src="draft-assets/wolverinepowers.png" alt=""><div><div class="spx-wolverine-kicker">LOGAN · CZYNNIK REGENERACYJNY</div><h2 class="spx-wolverine-title" id="spxWolverineTitle">ADAMANTIOWA REGENERACJA</h2><p class="spx-wolverine-lead" id="spxWolverineLead"></p></div></header>
            <div id="spxWolverineBody"></div><div class="spx-wolverine-actions" id="spxWolverineActions"></div>
        </section>`;
        document.body.appendChild(overlay);
        return overlay;
    }
    function openPrompt(){const overlay=ensurePrompt();overlay.hidden=false;}
    function closePrompt(){const overlay=document.getElementById("spxWolverineOverlay");if(overlay)overlay.hidden=true;}
    function setPrompt(title,lead,body,actions){
        const overlay=ensurePrompt();
        overlay.querySelector("#spxWolverineTitle").textContent=title;
        overlay.querySelector("#spxWolverineLead").textContent=lead;
        overlay.querySelector("#spxWolverineBody").innerHTML=body||"";
        const actionRoot=overlay.querySelector("#spxWolverineActions");actionRoot.innerHTML="";
        (actions||[]).forEach(action=>{
            const button=document.createElement("button");button.type="button";button.className=`spx-wolverine-action ${action.className||""}`;button.textContent=action.label;button.disabled=Boolean(action.disabled);button.addEventListener("click",action.onClick);actionRoot.appendChild(button);
        });
        openPrompt();
    }
    function start(playerName){
        const check=preflight(playerName);
        if(!check.ok){global.SuperpowerFeedback?.warning?.(POWER_ID,"LOGAN NIE MOŻE WEJŚĆ NA CMENTARZYSKO",check.message);return false;}
        state.active=true;state.phase="first_grave";state.playerName=playerName;state.playerIndex=check.playerIndex;
        global.GraveyardUI.open({mode:"wolverine",locked:false,entries:check.entries,message:`${playerName}: wybierz pierwszy nagrobek, który Logan nasyci swoim czynnikiem regeneracyjnym.`,onSelect:selectFirstEntry,onClose:()=>cancelBeforeCommit()});
        global.GraveyardUI.refreshButton();
        return true;
    }
    function selectFirstEntry(entry){
        if(!state.active||state.phase!=="first_grave")return;
        state.firstEntry=entry;state.phase="first_cost";
        global.GraveyardUI.close("first_selected",true,true);
        showFirstCost();
    }
    function showFirstCost(){
        const options=availableCostsFor(state.firstEntry,false);
        const cards=options.map(option=>`<button type="button" class="spx-wolverine-card" data-index="${option.index}" ${option.ok?"":"disabled"}><strong>${escapeHtml(option.card.name)}</strong><span>${escapeHtml(option.card.cost)} KOSZT · ${escapeHtml(option.card.power)} SIŁA</span><small>${option.ok?"ODDAJ TĘ KARTĘ ZA WSKRZESZENIE":escapeHtml(option.reason||"KARTA JEST CHRONIONA")}</small></button>`).join("");
        const notice=state.notice?`<div class="spx-wolverine-inline-warning">${escapeHtml(state.notice)}</div>`:"";
        setPrompt("PIERWSZA WYMIANA",`Wskrzeszasz: ${state.firstEntry.card.name}. Wybierz kartę, która spocznie na Cmentarzysku w jej miejsce.`,`${notice}<div class="spx-wolverine-cards">${cards}</div>`,[
            {label:"WRÓĆ DO NAGROBKÓW",onClick:()=>{closePrompt();state.phase="first_grave";state.firstEntry=null;global.GraveyardUI.open({mode:"wolverine",entries:getEntries(),message:`${state.playerName}: wybierz pierwszy nagrobek.`,onSelect:selectFirstEntry,onClose:cancelBeforeCommit});}}
        ]);
        let selected=-1;const overlay=ensurePrompt();const actions=overlay.querySelector("#spxWolverineActions");
        const confirm=document.createElement("button");confirm.type="button";confirm.className="spx-wolverine-action primary";confirm.textContent="PRZENIEŚ CZYNNIK REGENERACYJNY";confirm.disabled=true;confirm.onclick=()=>{state.notice="";state.firstCostIndex=selected;resolveEntry(state.firstEntry,result=>{if(createsDuplicate(result,state.firstCostIndex,false)){state.notice=`${result.name} jest już w Twoim decku. Wybierz inną kartę.`;state.firstResult=null;showFirstCost();return;}state.firstResult=result;state.phase="optional_second";showOptionalSecond();},showFirstCost);};actions.appendChild(confirm);
        overlay.querySelectorAll(".spx-wolverine-card:not(:disabled)").forEach(button=>button.addEventListener("click",()=>{selected=Number(button.dataset.index);overlay.querySelectorAll(".spx-wolverine-card").forEach(item=>item.classList.toggle("is-selected",item===button));confirm.disabled=false;}));
    }
    function resolveEntry(entry,onResolve,onCancel){
        closePrompt();
        if(!entry?.card?.joker){onResolve(knownTemplate(entry));return;}
        const opened=global.JokerV2UI?.resolveForEffect?.(entry.card,{playerIndex:state.playerIndex,sourceZone:"graveyard",sourcePowerId:POWER_ID,sourceEvent:"wolverine_graveyard_joker",onResolve,onCancel});
        if(!opened){state.notice="Nie udało się otworzyć Jokera z Cmentarzyska.";onCancel?.();}
    }
    function showOptionalSecond(){
        const deck=decks[state.playerIndex]||[];
        const possibleSecond=deck.some((card,index)=>isAvailableCost(card,index,true));
        setPrompt("PIERWSZA KARTA ODDYCHA",`${state.firstResult.name} wraca do decku. Możesz zakończyć moc albo zaryzykować drugie wskrzeszenie.`,`<div class="spx-wolverine-protection"><b>${escapeHtml(state.firstResult.name)}</b> otrzyma pełny czynnik regeneracyjny Logana: do końca draftu nie będzie można jej zniszczyć ani przelosować.</div>`,[
            {label:"ZAKOŃCZ NA PIERWSZEJ KARCIE",className:"primary",onClick:()=>commit(false)},
            {label:"OTWÓRZ DRUGI NAGROBEK",className:"green",disabled:!possibleSecond,onClick:openSecondGrave}
        ]);
    }
    function openSecondGrave(){
        closePrompt();state.phase="second_grave";
        global.GraveyardUI.open({mode:"wolverine",locked:false,entries:getEntries(),excludeIds:[state.firstEntry.graveyardEntryId],message:"Wybierz drugi nagrobek. Tym razem Logan losowo zabierze inną kartę z Twojego decku.",onSelect:selectSecondEntry,onClose:()=>{state.phase="optional_second";showOptionalSecond();}});
    }
    function selectSecondEntry(entry){
        if(!state.active||state.phase!=="second_grave")return;
        state.secondEntry=entry;state.phase="second_resolve";
        global.GraveyardUI.close("second_selected",true,true);
        resolveEntry(entry,result=>{
            state.secondResult=result;
            const options=availableCostsFor(entry,true).filter(option=>option.ok&&option.index!==state.firstCostIndex&&normalized(option.card.name)!==normalized(state.firstResult.name));
            const valid=options.filter(option=>!createsDuplicate(result,option.index,true));
            if(!valid.length){
                setPrompt("✕ LOGAN ZATRZYMUJE SIĘ NA JEDNYM WSKRZESZENIU","Pierwsza uratowana karta pozostaje w decku.","",[]);
                global.setTimeout(()=>commit(false),1250);return;
            }
            const victim=valid[Math.floor(Math.random()*valid.length)];state.secondCostIndex=victim.index;
            setPrompt("NIE MA ODWROTU",`Czynnik regeneracyjny wskazał cenę: ${victim.card.name}. Za chwilę karta spocznie na Cmentarzysku, a ${result.name} powróci.`,`<div class="spx-wolverine-reveal">${escapeHtml(victim.card.name)} → ${escapeHtml(result.name)}</div>`,[]);
            global.setTimeout(()=>commit(true),1450);
        },()=>{state.secondEntry=null;state.secondResult=null;state.phase="optional_second";showOptionalSecond();});
    }
    function cleanInstance(template,first){
        const result=typeof createDraftCardInstance==="function"?createDraftCardInstance(template,{origin:"wolverine_regeneration",sourcePowerId:POWER_ID,sourceEvent:first?"wolverine_first_resurrection":"wolverine_second_resurrection",forceNew:true}):{...template};
        result.instanceMeta={...(result.instanceMeta||{}),wolverineResurrected:true,wolverineRegenerationProtected:Boolean(first),wolverineResurrectionOrder:first?1:2,sourceGraveyardEntryId:first?state.firstEntry?.graveyardEntryId:state.secondEntry?.graveyardEntryId};
        return result;
    }
    function commit(includeSecond){
        if(state.committing)return;state.committing=true;state.phase="commit";
        const deck=decks[state.playerIndex]||[];
        const deckBefore=deck.slice();
        const engineBefore=global.DraftStateEngine?.exportState?.();
        const tx=global.DraftStateEngine?.beginTransaction?.("wolverine_adamantium_regeneration",{playerIndex:state.playerIndex,firstEntryId:state.firstEntry?.graveyardEntryId,secondEntryId:includeSecond?state.secondEntry?.graveyardEntryId:null});
        try{
            if(!deck[state.firstCostIndex])throw new Error("Pierwsza karta wymiany zniknęła.");
            if(includeSecond&&(!deck[state.secondCostIndex]||state.secondCostIndex===state.firstCostIndex))throw new Error("Druga karta wymiany zniknęła.");
            const firstCost=deck[state.firstCostIndex];const secondCost=includeSecond?deck[state.secondCostIndex]:null;
            const first=cleanInstance(state.firstResult,true);const second=includeSecond?cleanInstance(state.secondResult,false):null;
            if(createsDuplicate(first,state.firstCostIndex,false))throw new Error("Pierwsze wskrzeszenie stworzyłoby duplikat.");
            deck[state.firstCostIndex]=first;
            if(includeSecond){
                if(createsDuplicate(second,state.secondCostIndex,true))throw new Error("Drugie wskrzeszenie stworzyłoby duplikat.");
                deck[state.secondCostIndex]=second;
            }
            const consumeMeta={consumer:state.playerName,powerId:POWER_ID,reason:"wolverine_resurrection",playerIndex:state.playerIndex,packNumber:flowNumber(),pickIndex:currentPickIndex};
            if(!global.DraftStateEngine?.consumeGraveyardEntry?.(state.firstEntry.graveyardEntryId,consumeMeta))throw new Error("Pierwszy nagrobek nie jest już dostępny.");
            if(includeSecond&&!global.DraftStateEngine?.consumeGraveyardEntry?.(state.secondEntry.graveyardEntryId,consumeMeta))throw new Error("Drugi nagrobek nie jest już dostępny.");
            archiveCardToGraveyard("sacrificed",firstCost,{previousOwner:state.playerIndex,source:"wolverine_regeneration_cost",powerId:POWER_ID,recoverable:true,metadata:{resurrectionOrder:1,resultCardInstanceId:first.instanceId}});
            if(includeSecond)archiveCardToGraveyard("sacrificed",secondCost,{previousOwner:state.playerIndex,source:"wolverine_regeneration_cost",powerId:POWER_ID,recoverable:true,metadata:{resurrectionOrder:2,resultCardInstanceId:second.instanceId}});
            const firstRejected=global.archivePendingJokerRejections?.(first,{source:"wolverine_surprise_joker_rejected",powerId:POWER_ID,resolutionPath:"wolverine_first_resurrection",metadata:{resurrectionOrder:1}})||[];
            const secondRejected=includeSecond?(global.archivePendingJokerRejections?.(second,{source:"wolverine_surprise_joker_rejected",powerId:POWER_ID,resolutionPath:"wolverine_second_resurrection",metadata:{resurrectionOrder:2}})||[]):[];
            global.DraftStateEngine?.commitTransaction?.(tx?.transactionId,{firstResult:first.name,secondResult:second?.name||null});
            const completed=global.SuperpowerEngine?.completeActivation?.(state.playerName,POWER_ID,{packNumber:flowNumber(),pickIndex:currentPickIndex,firstResult:first.name,secondResult:second?.name||null,firstProtectedInstanceId:first.instanceId});
            if(!completed?.ok)throw new Error(completed?.reason||"Nie udało się oznaczyć mocy jako wykorzystanej.");
            const stored=global.draftSuperpowers?.[state.playerName];
            if(stored){stored.used=true;stored.status="used";}
            global.superpowerLog=global.superpowerLog||[];global.superpowerLog.push({type:"superpower_activation",event:"wolverine_adamantium_regeneration",playerName:state.playerName,playerIndex:state.playerIndex,powerId:POWER_ID,saved:[first.name,...(second?[second.name]:[])],lost:[firstCost.name,...(secondCost?[secondCost.name]:[])],rejectedJokerCards:[...firstRejected,...secondRejected].map(entry=>entry?.card?.name).filter(Boolean),packNumber:flowNumber(),pickIndex:currentPickIndex,timestamp:new Date().toISOString()});
            closePrompt();if(typeof showDecks==="function")showDecks();global.GraveyardUI?.refreshButton?.();playFinale(()=>showSummary(first,second,firstCost,secondCost));
        }catch(error){
            deck.splice(0,deck.length,...deckBefore);if(engineBefore)global.DraftStateEngine?.restoreState?.(engineBefore);console.error("Wolverine rollback:",error);global.SuperpowerFeedback?.error?.(POWER_ID,"ADAMANTIOWA REGENERACJA COFNIĘTA",error.message||"Nie udało się dokończyć regeneracji.");state.committing=false;state.phase="optional_second";showOptionalSecond();
        }
    }
    function playFinale(done){
        let layer=document.getElementById("spxWolverineClawFinale");if(!layer){layer=document.createElement("div");layer.id="spxWolverineClawFinale";layer.className="spx-wolverine-claw-finale";layer.innerHTML="<i></i><i></i><i></i>";document.body.appendChild(layer);}layer.hidden=false;requestAnimationFrame(()=>layer.classList.add("is-active"));global.setTimeout(()=>{layer.classList.remove("is-active");layer.hidden=true;done?.();},850);
    }
    function showSummary(first,second,firstCost,secondCost){
        state.phase="summary";
        setPrompt("LOGAN WYRWAŁ KARTY ŚMIERCI",`${state.playerName} kończy Adamantiową Regenerację.`,`<div class="spx-wolverine-summary-list"><div class="spx-wolverine-summary-box"><b>URATOWANE</b><span>${escapeHtml(first.name)}</span>${second?`<span>${escapeHtml(second.name)}</span>`:""}</div><div class="spx-wolverine-summary-box"><b>POZOSTAŁY NA CMENTARZYSKU</b><span>${escapeHtml(firstCost.name)}</span>${secondCost?`<span>${escapeHtml(secondCost.name)}</span>`:""}</div></div><div class="spx-wolverine-protection"><b>${escapeHtml(first.name)}</b> została nasycona najpotężniejszą dawką czynnika regeneracyjnego. Do końca draftu nie można jej zniszczyć ani przelosować.</div>`,[{label:"WRÓĆ DO DRAFTU",className:"primary",onClick:()=>{reset();if(typeof showDecks==="function")showDecks();}}]);
    }
    function cancelBeforeCommit(){if(!state.active||state.firstResult)return false;reset();return true;}
    function escapeHtml(value){return String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));}

    global.WolverineUI={start,isBusy:()=>state.active,getLockReason:()=>state.active?"Dokończ Adamantiową Regenerację Wolverinea.":"",isProtectedCard:isProtected,reset};
})(window);
