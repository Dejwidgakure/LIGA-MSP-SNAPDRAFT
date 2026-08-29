(function(){
    "use strict";

    const state={
        active:false,
        complete:false,
        offered:false,
        playerIndex:0,
        sideboards:[],
        pools:[],
        selections:[]
    };

    const byId=id=>document.getElementById(id);
    const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
    const norm=value=>String(value??"").trim().toLocaleLowerCase("pl");

    function isPokerMode(){return Boolean(byId("enablePokerDraft")?.checked);}
    function isEnabled(){return Boolean(byId("enablePlanetaryReserve")?.checked)&&!isPokerMode();}

    function removeOffer(){byId("planetaryReserveLaunch")?.remove();}

    function reset(playerNames){
        byId("planetaryReserveModal")?.remove();
        removeOffer();
        state.active=false;
        state.complete=false;
        state.offered=false;
        state.playerIndex=0;
        state.sideboards=Array.from({length:Array.isArray(playerNames)?playerNames.length:0},()=>[]);
        state.pools=[];
        state.selections=[];
    }

    function currentPlayers(){try{return Array.isArray(players)?players:[];}catch(_){return [];}}
    function currentDecks(){try{return Array.isArray(decks)?decks:[];}catch(_){return [];}}
    function currentCards(){try{return Array.isArray(cardDatabase)?cardDatabase:[];}catch(_){return [];}}
    function currentTags(){try{return typeof TAGS==="object"&&TAGS?TAGS:{};}catch(_){return {};}}
    function currentConfig(){return window.SettingsV2?.getConfig?.()||{};}
    function currentBans(){try{return Array.isArray(bannedCards)?bannedCards:[];}catch(_){return [];}}

    function buildPools(){
        const engine=window.PlanetaryReserveEngine;
        if(!engine?.buildCandidatePool) return false;
        const deckList=currentDecks();
        const suggestionCounts=new Map();
        state.pools=currentPlayers().map((_,index)=>{
            const pool=engine.buildCandidatePool({
                deck:deckList[index]||[],
                cards:currentCards(),
                tags:currentTags(),
                bannedCards:currentBans(),
                config:currentConfig(),
                suggestionCounts
            });
            (pool?.candidates||[]).forEach(item=>{
                const name=norm(item?.card?.name);
                if(name) suggestionCounts.set(name,(suggestionCounts.get(name)||0)+1);
            });
            return pool;
        });
        state.selections=state.pools.map(()=>[]);
        return true;
    }

    function buildCanonicalCard(card,index,click){
        const button=typeof buildPackCardButton==="function"?buildPackCardButton(card,index):document.createElement("button");
        button.type="button";
        button.classList.add("planetary-reserve-card");
        button.classList.remove("selected");
        button.onclick=event=>{
            event.preventDefault();
            event.stopPropagation();
            click();
        };
        return button;
    }

    function renderCandidate(item,index,selected){
        const wrap=document.createElement("div");
        wrap.className="planetary-reserve-candidate"+(selected?" is-selected":"");
        wrap.dataset.candidateIndex=String(index);
        wrap.style.setProperty("--pr-delay",`${Math.min(440,index*34)}ms`);
        if(selected){
            wrap.innerHTML=`<button type="button" class="planetary-reserve-return" aria-label="Przywróć ${escapeHtml(item.card.name)} do puli"><span>W REZERWIE</span><small>KLIKNIJ, ABY COFNĄĆ</small></button><div class="planetary-reserve-reason">${escapeHtml(item.reason)}</div>`;
            wrap.querySelector("button").onclick=()=>toggleSelection(index);
            return wrap;
        }
        wrap.appendChild(buildCanonicalCard(item.card,index,()=>toggleSelection(index)));
        const reason=document.createElement("div");
        reason.className="planetary-reserve-reason";
        reason.textContent=item.reason;
        wrap.appendChild(reason);
        return wrap;
    }

    function renderBenchSlot(slotIndex,candidateIndex){
        const slot=document.createElement("div");
        slot.className="planetary-reserve-bench-slot"+(Number.isInteger(candidateIndex)?" is-filled":"");
        if(!Number.isInteger(candidateIndex)){
            slot.innerHTML=`<img src="draft-assets/planetary_reserve_badge.png" alt=""><span>REZERWOWY ${slotIndex+1}</span>`;
            return slot;
        }
        const item=state.pools[state.playerIndex].candidates[candidateIndex];
        slot.appendChild(buildCanonicalCard(item.card,candidateIndex,()=>toggleSelection(candidateIndex)));
        const remove=document.createElement("button");
        remove.type="button";
        remove.className="planetary-reserve-remove";
        remove.textContent="WRÓĆ DO PULI";
        remove.onclick=()=>toggleSelection(candidateIndex);
        slot.appendChild(remove);
        return slot;
    }

    function techMessage(rule={}){
        if(!rule.reserved) return {text:"TECH: ZABEZPIECZONE",className:"is-ok"};
        if(rule.fullyCovered) return {text:"TECH ×2: DODANE",className:"is-ok"};
        if(rule.fulfilled&&Number(rule.offered)>0) return {text:`TECH: ${Number(rule.offered)} LEGALNA OPCJA`,className:"is-warn"};
        return {text:"TECH: BRAK LEGALNEJ OPCJI",className:"is-warn"};
    }

    function render(){
        const modal=byId("planetaryReserveModal");
        if(!modal) return;
        const pool=state.pools[state.playerIndex];
        if(!pool) return;
        const selected=state.selections[state.playerIndex]||[];
        const playerName=currentPlayers()[state.playerIndex]||`Gracz ${state.playerIndex+1}`;
        modal.querySelector("[data-pr-player]").textContent=playerName;
        modal.querySelector("[data-pr-progress]").textContent=`${state.playerIndex+1} / ${currentPlayers().length}`;
        modal.querySelector("[data-pr-count]").textContent=`${selected.length} / 3`;
        const tech=modal.querySelector("[data-pr-tech]");
        const techState=techMessage(pool.techRule);
        tech.textContent=techState.text;
        tech.className=`planetary-reserve-tech-chip ${techState.className}`;

        const grid=modal.querySelector("[data-pr-grid]");
        grid.innerHTML="";
        pool.candidates.forEach((item,index)=>grid.appendChild(renderCandidate(item,index,selected.includes(index))));

        const bench=modal.querySelector("[data-pr-bench]");
        bench.innerHTML="";
        for(let slot=0;slot<3;slot++) bench.appendChild(renderBenchSlot(slot,selected[slot]));

        const confirm=modal.querySelector("[data-pr-confirm]");
        confirm.disabled=selected.length!==3;
        confirm.textContent=selected.length===3?"POTWIERDŹ REZERWĘ":"WYBIERZ DOKŁADNIE 3 KARTY";
    }

    function toggleSelection(index){
        const selected=state.selections[state.playerIndex];
        const position=selected.indexOf(index);
        if(position>=0){
            selected.splice(position,1);
            render();
            return;
        }
        if(selected.length>=3) return;
        const candidate=byId("planetaryReserveModal")?.querySelector(`[data-candidate-index="${index}"]`);
        candidate?.classList.add("is-picking");
        const commit=()=>{
            if(!selected.includes(index)&&selected.length<3) selected.push(index);
            const arrivalSlot=Math.max(0,selected.indexOf(index));
            render();
            const slot=byId("planetaryReserveModal")?.querySelectorAll?.(".planetary-reserve-bench-slot")?.[arrivalSlot];
            if(slot){slot.classList.add("is-transfer-arrival");setTimeout(()=>slot.classList.remove("is-transfer-arrival"),760);}
        };
        if(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) commit();
        else setTimeout(commit,180);
    }

    function finishReserve(){
        state.complete=true;
        state.active=false;
        byId("planetaryReserveModal")?.remove();
        removeOffer();
        const finish=byId("draftFinishPanel");
        if(finish){
            const title=finish.querySelector(".draft-finish-title");
            const subtitle=finish.querySelector(".draft-finish-subtitle");
            if(title) title.textContent="DRAFT ZAKOŃCZONY";
            if(subtitle) subtitle.textContent="Main Decki i Planetarne Rezerwy są gotowe. Shop i Galaktyczny Targ mogą nadal zmieniać wyłącznie Main Deck.";
        }
        if(typeof showDecks==="function") showDecks();
        window.dispatchEvent(new CustomEvent("planetary-reserve:complete",{detail:{players:currentPlayers().length,size:3}}));
    }

    function confirmCurrentPlayer(){
        const selected=state.selections[state.playerIndex]||[];
        if(selected.length!==3) return;
        const pool=state.pools[state.playerIndex];
        state.sideboards[state.playerIndex]=selected.map(index=>{
            const source=pool.candidates[index].card;
            if(typeof createDraftCardInstance==="function"){
                const instance=createDraftCardInstance(source,{origin:"planetary_reserve",sourceEvent:"planetary_reserve_pick",forceNew:true});
                instance.zone="sideboard";
                return instance;
            }
            return {...source,zone:"sideboard",origin:"planetary_reserve"};
        });
        state.playerIndex++;
        if(state.playerIndex<currentPlayers().length){
            const body=byId("planetaryReserveModal")?.querySelector(".planetary-reserve-body");
            body?.classList.remove("is-entering");
            void body?.offsetWidth;
            body?.classList.add("is-entering");
            render();
            return;
        }
        finishReserve();
    }

    function openModal(){
        removeOffer();
        const overlay=document.createElement("div");
        overlay.id="planetaryReserveModal";
        overlay.className="planetary-reserve-overlay is-opening";
        overlay.innerHTML=`
            <div class="planetary-reserve-space" aria-hidden="true">
                <i class="pr-planet pr-planet-a"></i><i class="pr-planet pr-planet-b"></i><i class="pr-planet pr-planet-c"></i>
                <i class="pr-star s1"></i><i class="pr-star s2"></i><i class="pr-star s3"></i><i class="pr-star s4"></i><i class="pr-star s5"></i><i class="pr-star s6"></i>
                <i class="pr-light-sweep"></i>
            </div>
            <section class="planetary-reserve-modal" role="dialog" aria-modal="true" aria-labelledby="planetaryReserveTitle">
                <header class="planetary-reserve-header">
                    <img class="planetary-reserve-logo" src="draft-assets/planetary_reserve_logo.png" alt="Planetarna Rezerwa — Sideboard">
                    <div class="planetary-reserve-head-copy">
                        <small>ORBITALNE CENTRUM REZERWY</small>
                        <h2 id="planetaryReserveTitle">WYBIERA: <span data-pr-player></span></h2>
                        <p>12 propozycji dobranych do aktualnego Main Decku. Wybierz dokładnie 3 Rezerwowych.</p>
                    </div>
                    <div class="planetary-reserve-step"><small>GRACZ</small><strong data-pr-progress></strong></div>
                </header>
                <div class="planetary-reserve-body is-entering">
                    <main class="planetary-reserve-main">
                        <div class="planetary-reserve-section-title"><span>KANDYDACI DO REZERWY</span><small data-pr-tech></small></div>
                        <div class="planetary-reserve-grid" data-pr-grid></div>
                    </main>
                    <aside class="planetary-reserve-bench-panel">
                        <div class="planetary-reserve-bench-heading"><img src="draft-assets/planetary_reserve_badge.png" alt=""><div><small>PLANETARNA REZERWA</small><strong>REZERWOWI</strong></div><b data-pr-count>0 / 3</b></div>
                        <div class="planetary-reserve-bench" data-pr-bench></div>
                        <p>Main Deck pozostaje osobną dwunastką. Rezerwowi zapisują się w strefie SIDEBOARD.</p>
                    </aside>
                </div>
                <footer class="planetary-reserve-footer">
                    <span>Każdy badge mówi, dlaczego system zaproponował daną kartę.</span>
                    <button type="button" data-pr-confirm disabled>WYBIERZ DOKŁADNIE 3 KARTY</button>
                </footer>
            </section>`;
        overlay.querySelector("[data-pr-confirm]").onclick=confirmCurrentPlayer;
        document.body.appendChild(overlay);
        requestAnimationFrame(()=>overlay.classList.add("is-visible"));
        setTimeout(()=>overlay.classList.remove("is-opening"),1150);
        render();
    }

    function beginAfterFinalization(){
        if(!isEnabled()||state.complete) return false;
        if(state.active) return true;
        const playerNames=currentPlayers();
        if(!playerNames.length) return false;
        if(!state.sideboards.length||state.sideboards.length!==playerNames.length) reset(playerNames);
        if(!buildPools()) return false;
        const incomplete=state.pools.find(pool=>!pool?.exact);
        if(incomplete){
            console.error("Planetarna Rezerwa: pula legalnych kart jest mniejsza niż 12.",incomplete);
            alert("Planetarna Rezerwa nie może zbudować pełnej puli 12 legalnych kart. Sprawdź filtry i bany.");
            return false;
        }
        state.active=true;
        state.offered=true;
        state.playerIndex=0;
        openModal();
        return true;
    }

    function offerPhase(options={}){
        if(!isEnabled()||state.complete) return false;
        state.offered=true;
        if(state.active) return true;
        const finish=byId("draftFinishPanel");
        if(!finish) return beginAfterFinalization();
        const title=finish.querySelector(".draft-finish-title");
        const subtitle=finish.querySelector(".draft-finish-subtitle");
        if(title) title.textContent="DRAFTOWANIE ZAKOŃCZONE";
        if(subtitle) subtitle.textContent="Możesz jeszcze skorzystać ze Shopu, Targu lub odebrać Questy. Gdy jesteście gotowi, przejdź do ostatniej fazy.";
        let launch=byId("planetaryReserveLaunch");
        if(!launch){
            launch=document.createElement("button");
            launch.id="planetaryReserveLaunch";
            launch.type="button";
            launch.className="planetary-reserve-launch";
            launch.innerHTML=`<span>OSTATNIA FAZA</span><strong>PRZEJDŹ DO PLANETARNEJ REZERWY</strong><small>12 propozycji → wybierz 3 Rezerwowych</small>`;
            launch.onclick=()=>beginAfterFinalization();
            finish.appendChild(launch);
        }
        if(options.focus){
            launch.classList.remove("is-pulsing");
            void launch.offsetWidth;
            launch.classList.add("is-pulsing");
            launch.scrollIntoView?.({block:"center",behavior:"smooth"});
        }
        return true;
    }

    function getPlayerSideboard(index){return Array.isArray(state.sideboards[index])?state.sideboards[index].slice():[];}
    function getPlayerSideboardNames(index){return getPlayerSideboard(index).map(card=>card.name);}

    window.PlanetaryReserveUI=Object.freeze({
        isEnabled,
        isComplete:()=>!isEnabled()||state.complete,
        isActive:()=>state.active,
        isOffered:()=>state.offered,
        reset,
        offerPhase,
        beginAfterFinalization,
        getPlayerSideboard,
        getPlayerSideboardNames
    });
})();
