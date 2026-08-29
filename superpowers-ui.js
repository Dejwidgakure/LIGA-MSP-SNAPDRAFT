/**
 * MSP SnapDraft - Superpowers UI
 * PATCH 39.3: Next Superpowers Foundation
 */

const SuperpowerUI = (()=>{
    let adapter=null;
    let selectedCandidateName="";
    let deadpoolChatterTimer=null;
    let deadpoolSequenceTimers=[];
    let deadpoolStageFinish=null;
    let deadpoolPendingCuts=null;
    const announcedSpiderReservations=new Set();
    const strangeReadyNoticeUntil=new Map();
    let feedbackContextPowerId="";

    const state={
        active:false,
        powerId:"",
        playerName:"",
        playerIndex:-1,
        sourceCardIndex:-1,
        targetPlayerIndex:-1,
        targetCardIndex:-1,
        targetPackIndex:-1,
        spiderCandidateCards:new Set(),
        spiderSelectedCards:new Set(),
        hulkExpectedHits:0,
        hulkHitResults:[],
        hulkTargetPlayerIndices:new Set(),
        hulkPendingTarget:null,
        hulkResolving:false,
        cyclopsAnchorIndex:-1,
        cyclopsAnchorOptions:new Map(),
        cyclopsMode:null,
        cyclopsPlannedSwaps:[],
        cyclopsPendingTargetIndex:-1,
        cyclopsSelectedReplacementName:"",
        professorXTargetIndices:new Set(),
        professorXRequiredTargetCount:2,
        jeffPersonalJoker:null,
        jeffOptions:[],
        jeffChosenCardName:"",
        rocketSelectedCards:new Set(),
        rocketExpectedBombs:0,
        rocketPhase:null,
        rocketContinue:null,
        rocketExplosionResult:null,
        doomSelectedName:"",
        doomContinue:null,
        deadpoolSelectedName:"",
        deadpoolMode:null,
        deadpoolCandidates:[],
        captainSelectedCardIndices:new Set(),
        captainResolving:false,
        venomPhase:null,
        venomPairMap:new Map(),
        venomOwnerOptions:[],
        venomOpponentOptions:[],
        venomOwnerReplacementName:"",
        venomOpponentReplacementName:"",
        venomResolving:false,
        candidatesByCardIndex:new Map(),
        strangeFutureToDeckId:"",
        strangeFutureToDeckResolvedCard:null,
        strangeDeckToFutureId:"",
        strangeFutureToCurrentId:"",
        strangeCurrentToFutureId:"",
        strangeVisionOpened:false,
        strangePhase:"idle"
    };

    function configure(nextAdapter){
        adapter=nextAdapter||null;
        ensureInterface();
        return Boolean(adapter);
    }

    function isGalacticCurrentMode(){
        return Boolean(window.GalacticCurrentSuperpowerBridge?.isModeEnabled?.());
    }
    function flowText(classicText,currentText){
        return isGalacticCurrentMode()?currentText:classicText;
    }

    function getPowerDefinition(powerId){
        if(
            typeof SuperpowerEngine==="undefined" ||
            typeof SuperpowerEngine.getRegisteredPowers!=="function"
        ) return null;
        return SuperpowerEngine.getRegisteredPowers().find(power=>power?.id===powerId)||null;
    }

    function normalizeName(value){
        return String(value||"").trim().toLowerCase();
    }

    function getPowerValue(card){
        const value=Number(card?.power);
        return Number.isFinite(value) ? value : null;
    }

    function getMultiplier(definition){
        const value=Number(definition?.effect?.powerMultiplier);
        return Number.isFinite(value) && value>0 ? value : 2;
    }

    function getCardTags(card){
        const seen=new Set();
        return (Array.isArray(card?.tags) ? card.tags : [])
            .map(tag=>String(tag||"").trim().toLowerCase())
            .filter(tag=>{
                if(!tag || seen.has(tag)) return false;
                seen.add(tag);
                return true;
            });
    }

    function getCyclopsAllowedTagIds(){
        const allowedCategories=["mechanicFamilies","deckArchetypes","themes"];
        const ids=new Set();
        if(typeof TAGS!=="undefined" && TAGS){
            allowedCategories.forEach(category=>{
                (Array.isArray(TAGS[category]) ? TAGS[category] : []).forEach(tag=>{
                    const id=String(tag?.id||"").trim().toLowerCase();
                    if(id) ids.add(id);
                });
            });
        }
        return ids;
    }

    function getCyclopsEligibleTags(card){
        const allowed=getCyclopsAllowedTagIds();
        return getCardTags(card).filter(tag=>allowed.has(tag));
    }

    function formatTagLabel(tag){
        const wanted=String(tag||"").trim().toLowerCase();
        if(typeof TAGS!=="undefined" && TAGS){
            for(const items of Object.values(TAGS)){
                const found=(Array.isArray(items)?items:[]).find(item=>String(item?.id||"").trim().toLowerCase()===wanted);
                if(found?.name) return String(found.name);
            }
        }
        const windMatch=/^wind(\d+)$/i.exec(wanted);
        if(windMatch) return `WIND ${windMatch[1]}`;
        return wanted.replace(/[-_]+/g," ").toUpperCase();
    }

    function getCyclopsSimulatedDeck(playerIndex,plannedSwaps=[]){
        const sourceDeck=(adapter?.getDecks?.()||[])[playerIndex]||[];
        const simulated=[...sourceDeck];
        plannedSwaps.forEach(swap=>{
            if(Number.isInteger(swap?.targetCardIndex) && swap?.replacementCard){
                simulated[swap.targetCardIndex]=swap.replacementCard;
            }
        });
        return simulated;
    }

    function getCyclopsReplacementCandidates(
        playerIndex,
        anchorIndex,
        targetCardIndex,
        mode,
        plannedSwaps=[]
    ){
        const database=adapter?.getCardDatabase?.()||[];
        const simulatedDeck=getCyclopsSimulatedDeck(playerIndex,plannedSwaps);
        const anchor=(adapter?.getDecks?.()||[])[playerIndex]?.[anchorIndex];
        const target=simulatedDeck[targetCardIndex];
        if(!anchor || !target || !mode) return [];

        const banned=new Set((adapter?.getBannedCards?.()||[]).map(normalizeName));
        const occupiedNames=new Set(
            simulatedDeck
                .filter((card,index)=>index!==targetCardIndex && card?.name)
                .map(card=>normalizeName(card.name))
        );
        const targetName=normalizeName(target.name);
        const anchorPower=getPowerValue(anchor);
        const seen=new Set();

        return database
            .filter(card=>{
                if(!card?.name) return false;
                const name=normalizeName(card.name);
                if(
                    !name ||
                    seen.has(name) ||
                    name===targetName ||
                    banned.has(name) ||
                    occupiedNames.has(name)
                ) return false;

                const matches=mode.type==="tag"
                    ? getCardTags(card).includes(mode.value)
                    : anchorPower!==null && getPowerValue(card)===anchorPower;
                if(!matches) return false;

                seen.add(name);
                return true;
            })
            .sort((a,b)=>
                Number(a.cost||0)-Number(b.cost||0) ||
                Number(a.power||0)-Number(b.power||0) ||
                String(a.name).localeCompare(String(b.name),"pl")
            );
    }

    function getCyclopsTargetCandidates(
        playerIndex,
        anchorIndex,
        mode,
        plannedSwaps=[]
    ){
        const deck=(adapter?.getDecks?.()||[])[playerIndex]||[];
        const usedTargets=new Set(plannedSwaps.map(swap=>swap.targetCardIndex));
        const result=new Map();

        deck.forEach((card,index)=>{
            if(index===anchorIndex || usedTargets.has(index) || !card) return;
            const candidates=getCyclopsReplacementCandidates(
                playerIndex,
                anchorIndex,
                index,
                mode,
                plannedSwaps
            );
            if(candidates.length) result.set(index,candidates);
        });
        return result;
    }

    function canCompleteCyclopsMode(playerIndex,anchorIndex,mode){
        const firstTargets=getCyclopsTargetCandidates(
            playerIndex,
            anchorIndex,
            mode,
            []
        );
        for(const [targetCardIndex,candidates] of firstTargets){
            for(const replacementCard of candidates){
                const planned=[{targetCardIndex,replacementCard}];
                const secondTargets=getCyclopsTargetCandidates(
                    playerIndex,
                    anchorIndex,
                    mode,
                    planned
                );
                if(secondTargets.size) return true;
            }
        }
        return false;
    }

    function getCyclopsModes(playerIndex,anchorIndex){
        const card=(adapter?.getDecks?.()||[])[playerIndex]?.[anchorIndex];
        if(!card) return [];
        const tags=getCyclopsEligibleTags(card);
        const rawModes=tags.length
            ? tags.map(tag=>({
                type:"tag",
                value:tag,
                label:formatTagLabel(tag)
            }))
            : [{
                type:"power",
                value:getPowerValue(card),
                label:`TA SAMA SIŁA: ${getPowerValue(card)}`
            }];

        return rawModes.map(mode=>({
            ...mode,
            usable:mode.value!==null &&
                mode.value!==undefined &&
                canCompleteCyclopsMode(playerIndex,anchorIndex,mode)
        }));
    }

    function buildCyclopsAnchorOptions(playerIndex){
        const deck=(adapter?.getDecks?.()||[])[playerIndex]||[];
        const result=new Map();
        deck.forEach((card,index)=>{
            const modes=getCyclopsModes(playerIndex,index);
            if(modes.some(mode=>mode.usable)) result.set(index,modes);
        });
        return result;
    }

    function getIronManCandidates(playerIndex,sourceCardIndex){
        const decks=adapter?.getDecks?.()||[];
        const database=adapter?.getCardDatabase?.()||[];
        const banned=new Set(
            (adapter?.getBannedCards?.()||[]).map(normalizeName)
        );
        const deck=decks[playerIndex]||[];
        const source=deck[sourceCardIndex];
        const sourcePower=getPowerValue(source);
        if(sourcePower===null) return [];

        const definition=getPowerDefinition("iron_man");
        const targetPower=sourcePower*getMultiplier(definition);
        const occupiedNames=new Set(
            deck
                .filter((card,index)=>index!==sourceCardIndex && card?.name)
                .map(card=>normalizeName(card.name))
        );
        const sourceName=normalizeName(source?.name);
        const seen=new Set();

        return database
            .filter(card=>{
                if(!card?.name) return false;
                const name=normalizeName(card.name);
                if(!name || seen.has(name)) return false;
                if(name===sourceName || banned.has(name) || occupiedNames.has(name)) return false;
                if(getPowerValue(card)!==targetPower) return false;
                seen.add(name);
                return true;
            })
            .sort((a,b)=>
                Number(a.cost||0)-Number(b.cost||0) ||
                String(a.name).localeCompare(String(b.name),"pl")
            );
    }

    function buildEligibility(playerIndex){
        const deck=(adapter?.getDecks?.()||[])[playerIndex]||[];
        const map=new Map();
        deck.forEach((card,index)=>{
            const candidates=getIronManCandidates(playerIndex,index);
            if(candidates.length) map.set(index,candidates);
        });
        return map;
    }

    function getDoctorStrangeOptions(){
        if(state.powerId!=="doctor_strange" || !state.playerName) return null;
        return adapter?.getDoctorStrangePortalOptions?.(state.playerName)
            || adapter?.canDoctorStrangeActivate?.(state.playerName)
            || null;
    }

    function findStrangeCard(list,id){
        return (Array.isArray(list)?list:[]).find(card=>card?.instanceId===id)||null;
    }

    function publicStrangePackCardName(card){
        return window.MysterioUI?.getPublicCardLabel?.(card) || card?.name || "ILUZJA";
    }

    function getDoctorStrangeSelection(){
        const options=getDoctorStrangeOptions();
        if(!options?.ok) return {options};
        const sourceCardA=findStrangeCard(
            options.futureToDeckCards||options.futureCards,
            state.strangeFutureToDeckId
        );
        return {
            options,
            sourceCardA,
            cardA:state.strangeFutureToDeckResolvedCard||sourceCardA,
            cardB:findStrangeCard(options.futureToCurrentCards||options.futureCards,state.strangeFutureToCurrentId),
            ownCard:findStrangeCard(options.deck,state.strangeDeckToFutureId),
            currentCard:findStrangeCard(options.currentCards,state.strangeCurrentToFutureId)
        };
    }

    function setDoctorStrangePhase(phase){
        state.strangePhase=phase;
        document.body.classList.toggle("spx-strange-selecting-deck",phase==="deck");
        document.body.classList.toggle("spx-strange-selecting-current",phase==="current");
        updateDoctorStrangePortalDock();
        updateDoctorStrangeHud();
    }

    function ensureDoctorStrangeInterface(){
        if(!document.getElementById("spxDoctorStrangeOverlay")){
            const overlay=document.createElement("div");
            overlay.id="spxDoctorStrangeOverlay";
            overlay.className="spx-strange-overlay";
            overlay.hidden=true;
            overlay.innerHTML=`
                <section class="spx-strange-panel" role="dialog" aria-modal="true" aria-labelledby="spxStrangeTitle">
                    <div class="spx-strange-portal-stage" aria-hidden="true">
                        <img class="spx-strange-portal-layer spx-strange-portal-core" src="draft-assets/doctorstrangeportalcore.png" alt="">
                        <img class="spx-strange-portal-layer spx-strange-portal-ring" src="draft-assets/doctorstrangeportalring.png" alt="">
                        <img class="spx-strange-portal-layer spx-strange-portal-sparks" src="draft-assets/doctorstrangeportalsparks.png" alt="">
                    </div>
                    <header class="spx-strange-head">
                        <img class="spx-strange-logo" src="draft-assets/doctorstrangepowers.png" alt="" aria-hidden="true">
                        <div class="spx-strange-title-copy">
                            <span id="spxStrangeKicker">OKO AGAMOTTO</span>
                            <h2 id="spxStrangeTitle">OTWÓRZ OKO AGAMOTTO</h2>
                            <p id="spxStrangeLead">Wybierz jedną z możliwych przyszłości.</p>
                        </div>
                        <img class="spx-strange-hero" src="draft-assets/doctorstrangepowershero.png" alt="Doctor Strange Jeff" aria-hidden="true">
                    </header>

                    <div id="spxStrangePreflight" class="spx-strange-preflight">
                        <strong>⚠️ OTWARCIE PORTALU JEST DECYZJĄ OSTATECZNĄ</strong>
                        <p>Po ujrzeniu przyszłości zaklęcie trzeba doprowadzić do końca.</p>
                        <div class="spx-strange-preflight-actions">
                            <button id="spxStrangeCancel" class="spx-strange-cancel" type="button">JESZCZE NIE</button>
                            <button id="spxStrangeOpenPortal" class="spx-strange-open" type="button">OTWÓRZ PORTAL AGAMOTTO</button>
                        </div>
                    </div>

                    <div id="spxStrangeFutureVision" class="spx-strange-future" hidden>
                        <div class="spx-strange-future-copy">
                            <span>ZDECYDUJ O ZASADACH SWOJEGO ZAKLĘCIA</span>
                            <h3 id="spxStrangeFutureTitle">PIERWSZA KARTA PRZECHODZI DO DECKU</h3>
                            <p id="spxStrangeFutureInstruction">Wskaż kartę, którą Strange wyciągnie przez Portal bezpośrednio do swojego decku.</p>
                        </div>
                        <div class="spx-strange-role-legend" aria-live="polite">
                            <span id="spxStrangeRoleA"><b>I</b> DO DECKU STRANGE’A</span>
                            <span id="spxStrangeRoleB"><b>II</b> DO AKTUALNEJ PACZKI</span>
                        </div>
                        <div id="spxStrangeFutureCards" class="spx-strange-future-cards"></div>
                        <div id="spxStrangeFutureSummary" class="spx-strange-future-summary"></div>
                        <div class="spx-strange-future-actions">
                            <button id="spxStrangeFutureReset" class="spx-strange-secondary" type="button">WYBIERZ OD NOWA</button>
                            <button id="spxStrangeFutureConfirm" class="spx-strange-confirm" type="button" disabled>PRZENIEŚ DWIE KARTY PRZEZ PORTAL</button>
                        </div>
                    </div>

                    <div id="spxStrangeFinalSummary" class="spx-strange-final-summary" hidden>
                        <span class="spx-strange-summary-kicker">OSTATECZNY SPLOT WYDARZEŃ</span>
                        <h3>PRZEPISZ LOS</h3>
                        <p>Karta za kartę. Teraźniejszość i przyszłość muszą pozostać w równowadze.</p>
                        <div id="spxStrangeSummaryRows" class="spx-strange-summary-rows"></div>
                        <aside class="spx-strange-cost">
                            <strong>CENA ZAKLĘCIA</strong>
                            <span>Utrzymanie Portalu wyczerpało Strange’a. Musi odzyskać siły, zanim ponownie sięgnie po kartę — jego drugi pick zostanie przesunięty na koniec tej paczki.</span>
                        </aside>
                        <div class="spx-strange-summary-actions">
                            <button id="spxStrangeSummaryBack" class="spx-strange-secondary" type="button">ZMIEŃ OSTATNIE WSKAZANIA</button>
                            <button id="spxStrangeConfirm" class="spx-strange-confirm" type="button">ZMIEŃ PRZYSZŁOŚĆ</button>
                        </div>
                    </div>
                </section>`;
            document.body.appendChild(overlay);
            overlay.querySelector("#spxStrangeCancel").addEventListener("click",()=>cancel());
            overlay.querySelector("#spxStrangeOpenPortal").addEventListener("click",openDoctorStrangeVision);
            overlay.querySelector("#spxStrangeFutureReset").addEventListener("click",resetDoctorStrangeFutureChoices);
            overlay.querySelector("#spxStrangeFutureConfirm").addEventListener("click",lockDoctorStrangeFutureChoices);
            overlay.querySelector("#spxStrangeSummaryBack").addEventListener("click",reopenDoctorStrangeLiveChoices);
            overlay.querySelector("#spxStrangeConfirm").addEventListener("click",commitDoctorStrangeSelection);
            overlay.addEventListener("click",event=>{
                if(event.target!==overlay) return;
                if(state.strangePhase==="preflight") cancel();
                else showToast("PORTAL POZOSTAJE OTWARTY","Po ujrzeniu przyszłości zaklęcie musi zostać doprowadzone do końca.");
            });
        }

        if(!document.getElementById("spxDoctorStrangeResolution")){
            const resolution=document.createElement("div");
            resolution.id="spxDoctorStrangeResolution";
            resolution.className="spx-strange-resolution";
            resolution.hidden=true;
            resolution.innerHTML=`
                <div class="spx-strange-resolution-portals" aria-hidden="true">
                    <div class="spx-strange-resolution-portal is-left"><img src="draft-assets/doctorstrangeportalcore.png" alt=""><img src="draft-assets/doctorstrangeportalring.png" alt=""><img src="draft-assets/doctorstrangeportalsparks.png" alt=""></div>
                    <div class="spx-strange-resolution-portal is-right"><img src="draft-assets/doctorstrangeportalcore.png" alt=""><img src="draft-assets/doctorstrangeportalring.png" alt=""><img src="draft-assets/doctorstrangeportalsparks.png" alt=""></div>
                </div>
                <img class="spx-strange-resolution-hero" src="draft-assets/doctorstrangepowershero.png" alt="" aria-hidden="true">
                <div class="spx-strange-resolution-copy"><img src="draft-assets/doctorstrangepowers.png" alt=""><strong>PRZYSZŁOŚĆ ZOSTAŁA ZMIENIONA</strong><span id="spxStrangeResolutionText"></span></div>`;
            document.body.appendChild(resolution);
        }

        ensureDoctorStrangePortalDock();
        ensureDoctorStrangeHud();
    }

    function getDoctorStrangeRuntimeData(playerName){
        const record=adapter?.getSuperpowerData?.(playerName);
        if(!record) return null;
        record.data=record.data&&typeof record.data==="object"?record.data:{};
        return record.data;
    }

    function ensureDoctorStrangePortalDock(){
        let dock=document.getElementById("spxDoctorStrangeDock");
        if(!dock){
            dock=document.createElement("button");
            dock.id="spxDoctorStrangeDock";
            dock.className="spx-strange-dock";
            dock.type="button";
            dock.hidden=true;
            dock.innerHTML=`
                <span class="spx-strange-dock-portal" aria-hidden="true">
                    <img class="spx-strange-dock-core" src="draft-assets/doctorstrangeportalcore.png" alt="">
                    <img class="spx-strange-dock-ring" src="draft-assets/doctorstrangeportalring.png" alt="">
                    <img class="spx-strange-dock-sparks" src="draft-assets/doctorstrangeportalsparks.png" alt="">
                    <span id="spxStrangeGlimpses" class="spx-strange-glimpses"></span>
                </span>
                <span class="spx-strange-dock-copy">
                    <strong id="spxStrangeDockTitle">PORTAL AGAMOTTO</strong>
                    <small id="spxStrangeDockText">Otwórz przyszłą paczkę</small>
                    <em id="spxStrangeDockAction">AKTYWUJ MOC</em>
                </span>`;
            dock.addEventListener("click",()=>{
                if(state.active && state.powerId==="doctor_strange"){
                    if(["portal_preview","future_a","future_b"].includes(state.strangePhase)){
                        openDoctorStrangeFutureModal();
                    }else if(state.strangePhase==="deck" || state.strangePhase==="current"){
                        updateDoctorStrangeHud();
                    }
                    return;
                }
                const playerName=dock.dataset.playerName||"";
                // Przejście przez wspólną bramkę zapobiega nadpisaniu
                // niedokończonej sekwencji innej Supermocy lub Jokera.
                if(playerName) start(playerName,"doctor_strange");
            });
        }
        const stage=document.getElementById("packStage");
        const pack=document.getElementById("pack");
        if(stage && pack && dock.parentElement!==stage) stage.insertBefore(dock,pack);
    }

    function ensureDoctorStrangeHud(){
        let hud=document.getElementById("spxDoctorStrangeHud");
        if(!hud){
            hud=document.createElement("section");
            hud.id="spxDoctorStrangeHud";
            hud.className="spx-strange-hud";
            hud.hidden=true;
            hud.innerHTML=`
                <span class="spx-strange-hud-eye" aria-hidden="true"><img src="draft-assets/doctorstrangeportalring.png" alt=""></span>
                <div class="spx-strange-hud-copy">
                    <strong id="spxStrangeHudTitle"></strong>
                    <span id="spxStrangeHudText"></span>
                    <em id="spxStrangeHudChoice">Nie wskazano jeszcze karty.</em>
                </div>
                <button id="spxStrangeHudConfirm" type="button" disabled></button>`;
            hud.querySelector("#spxStrangeHudConfirm").addEventListener("click",confirmDoctorStrangeHudStep);
        }
        const stage=document.getElementById("packStage");
        const pack=document.getElementById("pack");
        if(stage && pack && hud.parentElement!==stage) stage.insertBefore(hud,pack);
    }

    function renderDoctorStrangePortalGlimpses(cards,mode="future"){
        const container=document.getElementById("spxStrangeGlimpses");
        if(!container) return;
        container.innerHTML="";
        const list=(Array.isArray(cards)?cards:[]).filter(Boolean).slice(0,6);
        list.forEach((card,index)=>{
            const span=document.createElement("span");
            span.className=`slot-${index+1}`;
            span.textContent=card?.name||"?";
            if(mode==="bound") span.title=index===0?"Do decku Strange’a":"Do aktualnej paczki";
            container.appendChild(span);
        });
    }

    function updateDoctorStrangePortalDock(){
        ensureDoctorStrangePortalDock();
        const dock=document.getElementById("spxDoctorStrangeDock");
        if(!dock) return;
        dock.classList.remove("is-ready","is-open","is-bound");

        if(state.active){
            if(state.powerId!=="doctor_strange" || ["preflight","resolving","idle"].includes(state.strangePhase)){
                dock.hidden=true;
                return;
            }
            const selection=getDoctorStrangeSelection();
            const title=dock.querySelector("#spxStrangeDockTitle");
            const text=dock.querySelector("#spxStrangeDockText");
            const action=dock.querySelector("#spxStrangeDockAction");
            dock.dataset.playerName=state.playerName;
            dock.hidden=false;
            if(["portal_preview","future_a","future_b"].includes(state.strangePhase)){
                dock.classList.add("is-open");
                if(title) title.textContent="PORTAL DO PRZYSZŁOŚCI OTWARTY";
                if(text) text.textContent="Karty wyłaniają się bezpośrednio z Portalu Agamotto";
                if(action) action.textContent="SPÓJRZ W PRZYSZŁOŚĆ";
                renderDoctorStrangePortalGlimpses(selection.options?.futureCards||[],"future");
            }else{
                dock.classList.add("is-bound");
                if(title) title.textContent="PORTAL POZOSTAJE OTWARTY";
                if(text) text.textContent=state.strangePhase==="deck"
                    ? "Linia czasu oczekuje pierwszego zastępstwa"
                    : state.strangePhase==="current"
                    ? "Teraźniejszość musi oddać swoje miejsce"
                    : "Splot wydarzeń czeka na zatwierdzenie";
                if(action) action.textContent="KARTA ZA KARTĘ";
                renderDoctorStrangePortalGlimpses([selection.cardA,selection.cardB].filter(Boolean),"bound");
            }
            return;
        }

        const players=adapter?.getPlayers?.()||[];
        const strangeName=players.find(name=>adapter?.getAssignment?.(name)?.powerId==="doctor_strange");
        if(!strangeName){dock.hidden=true;return;}
        const assignment=adapter?.getAssignment?.(strangeName);
        if(assignment?.used){dock.hidden=true;return;}
        const check=adapter?.canDoctorStrangeActivate?.(strangeName);
        if(!check?.ok){dock.hidden=true;dock.title=check?.reason||"Portal jest zamknięty.";return;}
        const runtimeData=getDoctorStrangeRuntimeData(strangeName);
        const now=Date.now();
        let visibleUntil=Number(strangeReadyNoticeUntil.get(strangeName)||0);
        if(!runtimeData?.doctorStrangeReadyNoticeShown){
            if(runtimeData) runtimeData.doctorStrangeReadyNoticeShown=true;
            visibleUntil=now+4600;
            strangeReadyNoticeUntil.set(strangeName,visibleUntil);
            clearTimeout(updateDoctorStrangePortalDock.readyTimer);
            updateDoctorStrangePortalDock.readyTimer=setTimeout(updateDoctorStrangePortalDock,4700);
        }
        if(visibleUntil<=now){dock.hidden=true;return;}
        dock.classList.add("is-ready");
        dock.dataset.playerName=strangeName;
        dock.title=`${strangeName}: Strange naładował moc`;
        dock.querySelector("#spxStrangeDockTitle").textContent="STRANGE NAŁADOWAŁ MOC";
        dock.querySelector("#spxStrangeDockText").textContent="Portal Agamotto jest gotowy do rzucenia zaklęcia";
        dock.querySelector("#spxStrangeDockAction").textContent="MOC GOTOWA";
        renderDoctorStrangePortalGlimpses([],"future");
        dock.hidden=false;
    }

    function updateDoctorStrangeHud(){
        ensureDoctorStrangeHud();
        const hud=document.getElementById("spxDoctorStrangeHud");
        if(!hud) return;
        if(!state.active || state.powerId!=="doctor_strange" || !["deck","current"].includes(state.strangePhase)){
            hud.hidden=true;
            return;
        }
        const selection=getDoctorStrangeSelection();
        const title=hud.querySelector("#spxStrangeHudTitle");
        const text=hud.querySelector("#spxStrangeHudText");
        const choice=hud.querySelector("#spxStrangeHudChoice");
        const confirm=hud.querySelector("#spxStrangeHudConfirm");
        if(state.strangePhase==="deck"){
            title.textContent="🌀 RÓWNOWAGA LINII CZASU";
            text.textContent="Wybierz kartę z decku → trafi do przyszłej paczki.";
            choice.textContent=selection.ownCard ? `Wybrano: ${selection.ownCard.name}` : "Wskaż kartę w decku Strange’a.";
            confirm.textContent="ZACHOWAJ RÓWNOWAGĘ";
            confirm.disabled=!selection.ownCard;
        }else{
            title.textContent="🌀 TERAŹNIEJSZOŚĆ MUSI USTĄPIĆ";
            text.textContent="Wybierz kartę z paczki → trafi do przyszłości.";
            choice.textContent=selection.currentCard ? `Wybrano: ${publicStrangePackCardName(selection.currentCard)}` : "Wskaż kartę w aktualnej paczce.";
            confirm.textContent="DOMKNIJ WYMIANĘ";
            confirm.disabled=!selection.currentCard;
        }
        hud.hidden=false;
    }

    function getStrangeMiniPortalMarkup(){
        return `
            <span class="spx-strange-mini-portal" aria-hidden="true">
                <img src="draft-assets/doctorstrangeportalcore.png" alt="">
                <img src="draft-assets/doctorstrangeportalring.png" alt="">
                <img src="draft-assets/doctorstrangeportalsparks.png" alt="">
            </span>`;
    }

    function addStrangeMiniPortal(element){
        if(!element || element.querySelector(".spx-strange-mini-portal")) return;
        element.insertAdjacentHTML("beforeend",getStrangeMiniPortalMarkup());
    }

    function getStrangeFutureCardButton(card,legalIds){
        const button=document.createElement("button");
        button.type="button";
        const isA=card?.instanceId===state.strangeFutureToDeckId;
        const isB=card?.instanceId===state.strangeFutureToCurrentId;
        const isJoker=Boolean(card?.joker);
        const roleLegal=!legalIds || legalIds.has(card?.instanceId);
        button.className="spx-strange-card"+(isA?" is-selected-a":"")+(isB?" is-selected-b":"")+(isJoker?" is-joker":"");
        button.disabled=!roleLegal || (state.strangePhase==="future_b" && isA);
        button.title=roleLegal
            ? ""
            : state.strangePhase==="future_a"
                ? "Ta karta nie może zastąpić żadnej karty w decku Strange’a."
                : "Ta karta koliduje z aktualną paczką albo z aktywnym efektem.";
        button.innerHTML=`
            ${getStrangeMiniPortalMarkup()}
            <span class="spx-strange-card-role">${isA?"I · DO DECKU":isB?"II · DO PACZKI":roleLegal?"WARIANT PRZYSZŁOŚCI":"LINIA CZASU ODRZUCONA"}</span>
            <strong>${escapeText(card?.name||"?")}</strong>
            ${isJoker?'<em class="spx-strange-joker-badge">JOKER</em>':''}
            <span class="spx-strange-card-stats">${escapeText(card?.cost??0)} COST · ${escapeText(card?.power??0)} POWER</span>
            ${isJoker?`<small class="spx-strange-joker-effect">${escapeText(card?.desc||card?.description||"Po wyborze Joker pokaże dostępne warianty karty.")}</small>`:''}`;
        button.addEventListener("click",()=>selectDoctorStrangeFutureCard(card));
        return button;
    }

    function openDoctorStrangeVision(){
        if(state.powerId!=="doctor_strange" || state.strangeVisionOpened) return;
        const check=adapter?.canDoctorStrangeActivate?.(state.playerName);
        if(!check?.ok){showToast("PORTAL ZAMKNIĘTY",check?.reason||"Nie można teraz otworzyć portalu.");return;}
        state.strangeVisionOpened=true;
        adapter?.noteDoctorStrangePortalOpened?.(state.playerName);
        setDoctorStrangePhase("portal_preview");
        const overlay=document.getElementById("spxDoctorStrangeOverlay");
        if(overlay) overlay.hidden=true;
        showEventToast("PORTAL DO PRZYSZŁOŚCI OTWARTY","Oko Agamotto odnalazło możliwą przyszłość. Kliknij Portal nad paczką, aby ją ujrzeć.");
    }

    function openDoctorStrangeFutureModal(){
        if(state.powerId!=="doctor_strange" || !state.strangeVisionOpened) return;
        const options=getDoctorStrangeOptions();
        if(!options?.ok){showToast("PRZYSZŁOŚĆ SIĘ ROZPADŁA",options?.reason||"Stan draftu zmienił się podczas otwierania portalu.");return;}
        if(!["future_a","future_b"].includes(state.strangePhase)){
            setDoctorStrangePhase(state.strangeFutureToDeckId?"future_b":"future_a");
        }
        const overlay=document.getElementById("spxDoctorStrangeOverlay");
        if(overlay) overlay.hidden=false;
        renderDoctorStrangeModal();
    }

    function selectDoctorStrangeFutureCard(card){
        if(state.strangePhase==="future_a"){
            state.strangeFutureToDeckId=card.instanceId;
            state.strangeFutureToDeckResolvedCard=null;
            if(state.strangeFutureToCurrentId===card.instanceId) state.strangeFutureToCurrentId="";

            if(card?.joker){
                const overlay=document.getElementById("spxDoctorStrangeOverlay");
                if(overlay) overlay.hidden=true;
                const opened=window.JokerV2UI?.resolveForEffect?.(card,{
                    playerIndex:state.playerIndex,
                    sourceZone:"futurePack",
                    sourcePowerId:"doctor_strange",
                    sourceEvent:"portal_future_joker_to_deck",
                    onResolve:resolvedCard=>{
                        state.strangeFutureToDeckResolvedCard={...resolvedCard};
                        setDoctorStrangePhase("future_b");
                        if(overlay) overlay.hidden=false;
                        renderDoctorStrangeModal();
                    },
                    onCancel:()=>{
                        state.strangeFutureToDeckId="";
                        state.strangeFutureToDeckResolvedCard=null;
                        setDoctorStrangePhase("future_a");
                        if(overlay) overlay.hidden=false;
                        renderDoctorStrangeModal();
                    }
                });
                if(!opened){
                    state.strangeFutureToDeckId="";
                    if(overlay) overlay.hidden=false;
            showToast("JOKER NIE ODSŁONIŁ PRZYSZŁOŚCI","Ten Joker nie ma dostępnej karty do wyboru.");
                }
                return;
            }

            setDoctorStrangePhase("future_b");
        }else if(state.strangePhase==="future_b" && card.instanceId!==state.strangeFutureToDeckId){
            state.strangeFutureToCurrentId=card.instanceId;
        }
        renderDoctorStrangeModal();
    }

    function resetDoctorStrangeFutureChoices(){
        state.strangeFutureToDeckId="";
        state.strangeFutureToDeckResolvedCard=null;
        state.strangeFutureToCurrentId="";
        setDoctorStrangePhase("future_a");
        renderDoctorStrangeModal();
    }

    function lockDoctorStrangeFutureChoices(){
        const selection=getDoctorStrangeSelection();
        if(
            !selection.cardA ||
            !selection.sourceCardA ||
            !selection.cardB ||
            selection.sourceCardA===selection.cardB
        ){
            showToast("WIZJA NIEPEŁNA","Wybierz dwie różne karty z przyszłej paczki.");
            return;
        }
        const overlay=document.getElementById("spxDoctorStrangeOverlay");
        if(overlay) overlay.hidden=true;
        setDoctorStrangePhase("deck");
        adapter?.refreshDecks?.();
        adapter?.refreshPack?.();
        updateDoctorStrangeHud();
    }

    function renderDoctorStrangeModal(){
        const overlay=document.getElementById("spxDoctorStrangeOverlay");
        if(!overlay || state.powerId!=="doctor_strange") return;
        const preflight=overlay.querySelector("#spxStrangePreflight");
        const future=overlay.querySelector("#spxStrangeFutureVision");
        const summary=overlay.querySelector("#spxStrangeFinalSummary");
        const isPreflight=state.strangePhase==="preflight";
        const isFuture=["future_a","future_b"].includes(state.strangePhase);
        const isSummary=state.strangePhase==="summary";
        preflight.hidden=!isPreflight;
        future.hidden=!isFuture;
        summary.hidden=!isSummary;
        overlay.classList.toggle("is-preflight",isPreflight);
        overlay.classList.toggle("is-future",isFuture);
        overlay.classList.toggle("is-summary",isSummary);

        const title=overlay.querySelector("#spxStrangeTitle");
        const lead=overlay.querySelector("#spxStrangeLead");
        const kicker=overlay.querySelector("#spxStrangeKicker");
        if(isPreflight){
            kicker.textContent="OKO AGAMOTTO";
            title.textContent="OTWÓRZ OKO AGAMOTTO";
            lead.textContent="Wybierz jedną z możliwych przyszłości.";
            return;
        }

        const selection=getDoctorStrangeSelection();
        if(!selection.options?.ok){
            showToast("PRZYSZŁOŚĆ SIĘ ROZPADŁA",selection.options?.reason||"Nie można odczytać przyszłej paczki.");
            return;
        }

        if(isFuture){
            kicker.textContent="PORTAL AGAMOTTO";
            title.textContent="ZDECYDUJ O ZASADACH ZAKLĘCIA";
            lead.textContent="Wybierz dwie karty, które przekroczą granicę czasu.";
            const futureTitle=overlay.querySelector("#spxStrangeFutureTitle");
            const instruction=overlay.querySelector("#spxStrangeFutureInstruction");
            if(state.strangePhase==="future_a"){
                futureTitle.textContent="PIERWSZA KARTA PRZECHODZI DO DECKU";
                instruction.textContent="Wskaż kartę, którą Strange wyciągnie przez Portal i sprowadzi bezpośrednio do swojego decku.";
            }else{
                futureTitle.textContent="DRUGA KARTA PRZECHODZI DO PACZKI";
                instruction.textContent="Wskaż drugą kartę. Portal sprowadzi ją do aktualnej paczki. Strange widział już jej przeznaczenie — sam nie będzie mógł jej wybrać.";
            }
            const cards=overlay.querySelector("#spxStrangeFutureCards");
            cards.innerHTML="";
            const roleCards=state.strangePhase==="future_a"
                ? (selection.options.futureToDeckCards||selection.options.futureCards||[])
                : (selection.options.futureToCurrentCards||selection.options.futureCards||[]);
            const legalIds=new Set(roleCards.map(card=>card?.instanceId));
            (selection.options.futureCards||[]).forEach(card=>cards.appendChild(getStrangeFutureCardButton(card,legalIds)));
            overlay.querySelector("#spxStrangeRoleA").classList.toggle("is-filled",Boolean(selection.cardA));
            overlay.querySelector("#spxStrangeRoleB").classList.toggle("is-filled",Boolean(selection.cardB));
            overlay.querySelector("#spxStrangeFutureSummary").innerHTML=`
                <span><b>I</b>${escapeText(selection.cardA?.name||"Jeszcze nie wybrano")}</span>
                <span><b>II</b>${escapeText(selection.cardB?.name||"Jeszcze nie wybrano")}</span>`;
            overlay.querySelector("#spxStrangeFutureConfirm").disabled=!(selection.cardA&&selection.cardB&&selection.cardA!==selection.cardB);
            return;
        }

        if(isSummary){
            kicker.textContent="OSTATECZNE ZAKLĘCIE";
            title.textContent="PRZEPISZ LOS";
            lead.textContent="Linia czasu czeka na ostateczne zatwierdzenie.";
            overlay.querySelector("#spxStrangeSummaryRows").innerHTML=`
                <span><i>PRZYSZŁOŚĆ → DECK</i><strong>${escapeText(selection.cardA?.name||"—")}</strong></span>
                <span><i>DECK → PRZYSZŁOŚĆ</i><strong>${escapeText(selection.ownCard?.name||"—")}</strong></span>
                <span><i>PRZYSZŁOŚĆ → AKTUALNA PACZKA</i><strong>${escapeText(selection.cardB?.name||"—")}</strong></span>
                <span><i>AKTUALNA PACZKA → PRZYSZŁOŚĆ</i><strong>${escapeText(selection.currentCard ? publicStrangePackCardName(selection.currentCard) : "—")}</strong></span>`;
        }
    }

    function startDoctorStrange(playerName){
        if(state.active && state.powerId && state.powerId!=="doctor_strange"){
            showToast("INNE ZAKLĘCIE JEST W TOKU","Dokończ albo anuluj aktywną Supermoc, zanim Doctor Strange otworzy Portal Agamotto.");
            return false;
        }
        if(!adapter?.isDraftActive?.()){showToast("PORTAL ZAMKNIĘTY","Moc działa tylko podczas aktywnego draftu.");return false;}
        const check=adapter?.canDoctorStrangeActivate?.(playerName);
        if(!check?.ok){showToast("PORTAL ZAMKNIĘTY",check?.reason||"Nie można teraz otworzyć Portalu Agamotto.");return false;}
        cancel({silent:true,refresh:false,force:true});
        state.active=true;
        state.powerId="doctor_strange";
        state.playerName=playerName;
        state.playerIndex=check.playerIndex;
        state.strangeVisionOpened=false;
        state.strangeFutureToDeckId="";
        state.strangeFutureToDeckResolvedCard=null;
        state.strangeDeckToFutureId="";
        state.strangeFutureToCurrentId="";
        state.strangeCurrentToFutureId="";
        state.strangePhase="preflight";
        ensureDoctorStrangeInterface();
        const overlay=document.getElementById("spxDoctorStrangeOverlay");
        if(overlay) overlay.hidden=false;
        updateDoctorStrangePortalDock();
        renderDoctorStrangeModal();
        return true;
    }

    function handleDoctorStrangeDeckCardClick(playerIndex,cardIndex){
        if(state.strangePhase!=="deck"){
            showToast("PORTAL OCZEKUJE",state.strangePhase==="current"
                ? "Teraz wskaż kartę z aktualnej paczki."
                : "Dokończ bieżący etap zaklęcia.");
            return true;
        }
        if(playerIndex!==state.playerIndex){
            showToast("NIE TA LINIA CZASU",`Wybierz kartę z decku gracza ${state.playerName}.`);
            return true;
        }
        const card=(adapter?.getDecks?.()||[])[playerIndex]?.[cardIndex];
        if(!card) return true;
        state.strangeDeckToFutureId=card.instanceId;
        adapter?.refreshDecks?.();
        updateDoctorStrangeHud();
        return true;
    }

    function handleDoctorStrangePackCardClick(packIndex,card){
        if(state.strangePhase!=="current"){
            showToast("PORTAL OCZEKUJE",state.strangePhase==="deck"
                ? "Najpierw wskaż kartę ze swojego decku."
                : "Dokończ bieżący etap zaklęcia.");
            return true;
        }
        const options=getDoctorStrangeOptions();
        const legalIds=new Set((options?.currentCards||[]).map(entry=>entry?.instanceId));
        if(!legalIds.has(card?.instanceId)){
            showToast("LINIA CZASU ODRZUCA TĘ KARTĘ","Pajęcza Sieć chroni tę kartę przed wyrwaniem z aktualnej paczki.");
            return true;
        }
        state.strangeCurrentToFutureId=card.instanceId;
        adapter?.refreshPack?.();
        updateDoctorStrangeHud();
        return true;
    }

    function decorateDoctorStrangeDeckCards(){
        const deck=(adapter?.getDecks?.()||[])[state.playerIndex]||[];
        document.querySelectorAll(".card[data-player-index]").forEach(element=>{
            element.classList.remove("spx-strange-deck-candidate","spx-strange-deck-selected","spx-strange-deck-locked");
            element.querySelectorAll(".spx-strange-mini-portal").forEach(marker=>marker.remove());
            const playerIndex=Number(element.dataset.playerIndex);
            const cardIndex=Number(element.dataset.cardIndex);
            const card=(adapter?.getDecks?.()||[])[playerIndex]?.[cardIndex];
            if(state.strangePhase==="deck" && playerIndex===state.playerIndex){
                element.classList.add("spx-strange-deck-candidate");
                if(card?.instanceId===state.strangeDeckToFutureId) element.classList.add("spx-strange-deck-selected");
                addStrangeMiniPortal(element);
                element.title="PORTAL AGAMOTTO: odeślij tę kartę do przyszłej paczki";
            }else{
                element.classList.add("spx-strange-deck-locked");
            }
        });
        updateDoctorStrangeHud();
    }

    function decorateDoctorStrangePackCards(){
        if(!state.active || state.powerId!=="doctor_strange") return;
        const options=getDoctorStrangeOptions();
        const legalIds=new Set((options?.currentCards||[]).map(card=>card?.instanceId));
        const pack=adapter?.getCurrentPack?.()||[];
        document.querySelectorAll("#pack [data-pack-index]").forEach(element=>{
            element.classList.remove("spx-strange-current-candidate","spx-strange-current-selected","spx-strange-pack-paused");
            element.querySelectorAll(".spx-strange-mini-portal").forEach(marker=>marker.remove());
            const card=pack[Number(element.dataset.packIndex)];
            if(state.strangePhase==="current" && legalIds.has(card?.instanceId)){
                element.classList.add("spx-strange-current-candidate");
                if(card?.instanceId===state.strangeCurrentToFutureId) element.classList.add("spx-strange-current-selected");
                addStrangeMiniPortal(element);
                element.title="PORTAL AGAMOTTO: odeślij tę kartę do przyszłości";
            }else{
                element.classList.add("spx-strange-pack-paused");
            }
        });
        updateDoctorStrangeHud();
    }

    function confirmDoctorStrangeHudStep(){
        const selection=getDoctorStrangeSelection();
        if(state.strangePhase==="deck"){
            if(!selection.ownCard){showToast("RÓWNOWAGA NIEPEŁNA","Wskaż kartę z decku Strange’a.");return;}
            setDoctorStrangePhase("current");
            adapter?.refreshDecks?.();
            adapter?.refreshPack?.();
            showToast("TERAŹNIEJSZOŚĆ MUSI USTĄPIĆ","Wskaż kartę z aktualnej paczki, która zajmie miejsce drugiej sprowadzonej karty w przyszłości.");
            return;
        }
        if(state.strangePhase==="current"){
            if(!selection.currentCard){showToast("WYMIANA NIEPEŁNA","Wskaż kartę z aktualnej paczki.");return;}
            setDoctorStrangePhase("summary");
            const overlay=document.getElementById("spxDoctorStrangeOverlay");
            if(overlay) overlay.hidden=false;
            renderDoctorStrangeModal();
        }
    }

    function reopenDoctorStrangeLiveChoices(){
        state.strangeDeckToFutureId="";
        state.strangeCurrentToFutureId="";
        const overlay=document.getElementById("spxDoctorStrangeOverlay");
        if(overlay) overlay.hidden=true;
        setDoctorStrangePhase("deck");
        adapter?.refreshDecks?.();
        adapter?.refreshPack?.();
    }

    function playDoctorStrangeResolution(result,done){
        const overlay=document.getElementById("spxDoctorStrangeOverlay");if(overlay) overlay.hidden=true;
        const hud=document.getElementById("spxDoctorStrangeHud");if(hud) hud.hidden=true;
        const dock=document.getElementById("spxDoctorStrangeDock");if(dock) dock.hidden=true;
        const layer=document.getElementById("spxDoctorStrangeResolution");
        if(!layer){done?.();return;}
        const text=layer.querySelector("#spxStrangeResolutionText");
        if(text) text.textContent="Portal gaśnie, a Oko Agamotto milknie. Wyczerpany zaklęciem Strange odzyska siły dopiero u kresu tej kolejki.";
        layer.hidden=false;
        layer.classList.remove("is-playing");
        void layer.offsetWidth;
        layer.classList.add("is-playing");
        setTimeout(()=>{layer.hidden=true;layer.classList.remove("is-playing");done?.();},2450);
    }

    function commitDoctorStrangeSelection(){
        const selection=getDoctorStrangeSelection();
        if(!(selection.cardA&&selection.cardB&&selection.ownCard&&selection.currentCard)){
            showToast("SPLOT JEST NIEPEŁNY","Nie wszystkie cztery karty zostały wskazane.");
            return;
        }
        setDoctorStrangePhase("resolving");
        const button=document.getElementById("spxStrangeConfirm");
        if(button) button.disabled=true;
        const result=adapter?.commitDoctorStrangePortal?.({
            playerName:state.playerName,
            futureToDeckInstanceId:state.strangeFutureToDeckId,
            futureToDeckResolvedName:selection.sourceCardA?.joker ? selection.cardA?.name : "",
            futureToDeckResolvedCard:selection.sourceCardA?.joker ? selection.cardA : null,
            deckToFutureInstanceId:state.strangeDeckToFutureId,
            futureToCurrentInstanceId:state.strangeFutureToCurrentId,
            currentToFutureInstanceId:state.strangeCurrentToFutureId
        });
        if(!result?.ok){
            if(button) button.disabled=false;
            setDoctorStrangePhase("summary");
            showToast("PRZYSZŁOŚĆ ODRZUCONA",result?.reason||"Nie udało się rozstrzygnąć portalu.");
            return;
        }
        playDoctorStrangeResolution(result,()=>{
            cancel({silent:true,refresh:false,force:true});
            adapter?.refreshDecks?.();adapter?.refreshPack?.();adapter?.refreshQueue?.();
            showEventToast("PRZYSZŁOŚĆ ZOSTAŁA ZMIENIONA",`${result.cardA?.name||"Karta"} trafiła do decku, a ${result.cardB?.name||"karta"} pojawiła się w aktualnej paczce. Drugi wybór Strange’a czeka na końcu kolejki.`);
            if(result.rocketResult?.triggered){
                resolveRocketBomb(result.rocketResult,()=>{
                    adapter?.refreshDecks?.();
                    adapter?.refreshPack?.();
                    adapter?.refreshQueue?.();
                });
            }
        });
    }

    function ensureInterface(){
        ensureDoctorStrangeInterface();
        if(!document.getElementById("spxIronManHud")){
            const hud=document.createElement("div");
            hud.id="spxIronManHud";
            hud.className="spx-im-hud";
            hud.hidden=true;
            hud.innerHTML=`
                <img class="spx-power-prompt-logo" src="draft-assets/ironmanpowers.png" alt="" aria-hidden="true">
                <div class="spx-im-hud-reactor" aria-hidden="true">
                    <span></span>
                </div>
                <div class="spx-im-hud-copy">
                    <strong>AKTYWACJA REAKTORA</strong>
                    <span id="spxIronManHudText">Wybierz kartę ze swojego decku.</span>
                </div>
                <button id="spxIronManCancel" class="spx-im-cancel" type="button">ANULUJ</button>
            `;
            document.body.appendChild(hud);
            hud.querySelector("#spxIronManCancel").addEventListener("click",()=>cancel());
        }

        if(!document.getElementById("spxIronManOverlay")){
            const overlay=document.createElement("div");
            overlay.id="spxIronManOverlay";
            overlay.className="spx-im-overlay";
            overlay.hidden=true;
            overlay.innerHTML=`
                <section class="spx-im-reactor-panel" role="dialog" aria-modal="true" aria-labelledby="spxIronManTitle">
                    <div class="spx-im-scanlines" aria-hidden="true"></div>
                    <header class="spx-im-reactor-header">
                        <img class="spx-power-prompt-logo" src="draft-assets/ironmanpowers.png" alt="" aria-hidden="true">
                        <div class="spx-im-arc-reactor" aria-hidden="true"><span></span></div>
                        <div>
                            <span class="spx-im-kicker">IRON MAN // SYSTEM ONLINE</span>
                            <h2 id="spxIronManTitle">AKTYWACJA REAKTORA</h2>
                            <p id="spxIronManLead"></p>
                        </div>
                    </header>
                    <div id="spxIronManEquation" class="spx-im-equation"></div>
                    <div id="spxIronManCandidates" class="spx-im-candidates"></div>
                    <div id="spxIronManChoice" class="spx-im-choice">Wybierz kartę docelową.</div>
                    <footer class="spx-im-actions">
                        <button id="spxIronManBack" class="spx-im-secondary-btn" type="button">WRÓĆ DO DECKU</button>
                        <button id="spxIronManConfirm" class="spx-im-confirm-btn" type="button" disabled>
                            AKTYWUJ REAKTOR
                        </button>
                    </footer>
                </section>
            `;
            document.body.appendChild(overlay);
            overlay.querySelector("#spxIronManBack").addEventListener("click",backToDeckSelection);
            overlay.querySelector("#spxIronManConfirm").addEventListener("click",confirmIronManSwap);
            overlay.addEventListener("click",event=>{
                if(event.target===overlay) backToDeckSelection();
            });
        }

        if(!document.getElementById("spxIronManUpgrade")){
            const layer=document.createElement("div");
            layer.id="spxIronManUpgrade";
            layer.className="spx-im-upgrade";
            layer.hidden=true;
            document.body.appendChild(layer);
        }

        if(!document.getElementById("spxLokiHud")){
            const hud=document.createElement("div");
            hud.id="spxLokiHud";
            hud.className="spx-loki-hud";
            hud.hidden=true;
            hud.innerHTML=`
                <img class="spx-power-prompt-logo" src="draft-assets/lokipowers.png" alt="" aria-hidden="true">
                <div class="spx-loki-horns" aria-hidden="true"><span></span></div>
                <div class="spx-loki-hud-copy">
                    <strong>MAGICZNY PODSTĘP</strong>
                    <span id="spxLokiHudText">Wybierz własną kartę do poświęcenia.</span>
                </div>
                <div class="spx-loki-particles" aria-hidden="true"></div>
                <button id="spxLokiCancel" class="spx-loki-cancel" type="button">ANULUJ</button>
            `;
            document.body.appendChild(hud);
            const particles=hud.querySelector(".spx-loki-particles");
            for(let index=0;index<14;index++){
                const particle=document.createElement("i");
                particle.style.left=`${5+index*6.8}%`;
                particle.style.setProperty("--spx-loki-drift",`${(index-7)*2}px`);
                particle.style.setProperty("--spx-loki-delay",`${(index%7)*-.31}s`);
                particles.appendChild(particle);
            }
            hud.querySelector("#spxLokiCancel").addEventListener("click",()=>cancel());
        }

        if(!document.getElementById("spxLokiOverlay")){
            const overlay=document.createElement("div");
            overlay.id="spxLokiOverlay";
            overlay.className="spx-loki-overlay";
            overlay.hidden=true;
            overlay.innerHTML=`
                <section class="spx-loki-confirm-panel" role="dialog" aria-modal="true" aria-labelledby="spxLokiTitle">
                    <div class="spx-loki-runes" aria-hidden="true">ᚲ ᛟ ᛈ ᛁ ᚨ</div>
                    <header class="spx-loki-confirm-header">
                        <img class="spx-power-prompt-logo" src="draft-assets/lokipowers.png" alt="" aria-hidden="true">
                        <div class="spx-loki-crown" aria-hidden="true"><span></span></div>
                        <div>
                            <span>LOKI // ILUZJA GOTOWA</span>
                            <h2 id="spxLokiTitle">MAGICZNY PODSTĘP</h2>
                            <p id="spxLokiLead"></p>
                        </div>
                    </header>
                    <div id="spxLokiExchange" class="spx-loki-exchange"></div>
                    <p class="spx-loki-original-note">
                        Oryginał pozostaje w decku przeciwnika. Loki otrzymuje magiczną kopię.
                    </p>
                    <footer class="spx-loki-actions">
                        <button id="spxLokiBack" class="spx-loki-secondary-btn" type="button">WRÓĆ DO WYBORU</button>
                        <button id="spxLokiConfirm" class="spx-loki-confirm-btn" type="button">
                            STWÓRZ KOPIĘ
                        </button>
                    </footer>
                </section>
            `;
            document.body.appendChild(overlay);
            overlay.querySelector("#spxLokiBack").addEventListener("click",backToLokiTargetSelection);
            overlay.querySelector("#spxLokiConfirm").addEventListener("click",confirmLokiSwap);
            overlay.addEventListener("click",event=>{
                if(event.target===overlay) backToLokiTargetSelection();
            });
        }

        if(!document.getElementById("spxLokiMagicLayer")){
            const layer=document.createElement("div");
            layer.id="spxLokiMagicLayer";
            layer.className="spx-loki-magic-layer";
            layer.hidden=true;
            document.body.appendChild(layer);
        }

        if(!document.getElementById("spxSpiderHud")){
            const hud=document.createElement("div");
            hud.id="spxSpiderHud";
            hud.className="spx-spider-hud";
            hud.hidden=true;
            hud.innerHTML=`
                <img class="spx-power-prompt-logo" src="draft-assets/spidermanpowers.png" alt="" aria-hidden="true">
                <div class="spx-spider-hud-symbol" aria-hidden="true"></div>
                <div class="spx-spider-hud-copy">
                    <strong>SPIDER-SENSE · PAJĘCZA SIEĆ</strong>
                    <span id="spxSpiderHudText">Spider-Man wyczuwa karty, które może opleść siecią do swojej następnej tury.</span>
                </div>
                <button id="spxSpiderConfirm" class="spx-spider-confirm" type="button" disabled>
                    ZARZUĆ SIEĆ 0/2
                </button>
                <button id="spxSpiderCancel" class="spx-spider-cancel" type="button">ANULUJ</button>
            `;
            document.body.appendChild(hud);
            hud.querySelector("#spxSpiderConfirm").addEventListener("click",confirmSpiderReservations);
            hud.querySelector("#spxSpiderCancel").addEventListener("click",()=>cancel());
        }

        if(!document.getElementById("spxSpiderWebLayer")){
            const layer=document.createElement("div");
            layer.id="spxSpiderWebLayer";
            layer.hidden=true;
            document.body.appendChild(layer);
        }

        if(!document.getElementById("spxCaptainHud")){
            const hud=document.createElement("div");
            hud.id="spxCaptainHud";
            hud.className="spx-cap-hud";
            hud.hidden=true;
            hud.innerHTML=`
                <img class="spx-cap-hud-logo" src="draft-assets/captainamericapowers.png" alt="" aria-hidden="true">
                <div class="spx-cap-hud-copy">
                    <strong>TARCZA KAPITANA</strong>
                    <span id="spxCaptainHudText">Wybierz trzy własne karty do osłonięcia.</span>
                </div>
                <span id="spxCaptainCount" class="spx-cap-count">0 / 3</span>
                <button id="spxCaptainConfirm" class="spx-cap-confirm" type="button" disabled>ROZSTAW TARCZE</button>
                <button id="spxCaptainCancel" class="spx-cap-cancel" type="button">ANULUJ</button>
            `;
            document.body.appendChild(hud);
            hud.querySelector("#spxCaptainConfirm").addEventListener("click",confirmCaptainAmericaShields);
            hud.querySelector("#spxCaptainCancel").addEventListener("click",()=>cancel());
        }

        if(!document.getElementById("spxCaptainActivationLayer")){
            const layer=document.createElement("div");
            layer.id="spxCaptainActivationLayer";
            layer.className="spx-cap-activation-layer";
            layer.hidden=true;
            document.body.appendChild(layer);
        }

        if(!document.getElementById("spxCaptainReadyPrompt")){
            const prompt=document.createElement("section");
            prompt.id="spxCaptainReadyPrompt";
            prompt.className="spx-cap-ready-prompt";
            prompt.setAttribute("role","status");
            prompt.setAttribute("aria-live","assertive");
            prompt.hidden=true;
            document.body.appendChild(prompt);
        }

        if(!document.getElementById("spxCaptainRicochetLayer")){
            const layer=document.createElement("div");
            layer.id="spxCaptainRicochetLayer";
            layer.className="spx-cap-ricochet-layer";
            layer.hidden=true;
            document.body.appendChild(layer);
        }

        if(!document.getElementById("spxVenomHud")){
            const hud=document.createElement("div");
            hud.id="spxVenomHud";
            hud.className="spx-venom-hud";
            hud.hidden=true;
            hud.innerHTML=`
                <img class="spx-venom-hud-logo" src="draft-assets/venompowers.png" alt="" aria-hidden="true">
                <div class="spx-venom-hud-copy">
                    <strong>SYMBIOTYCZNE POŻARCIE</strong>
                    <span id="spxVenomHudText">Wybierz własną kartę do pożarcia.</span>
                </div>
                <button id="spxVenomCancel" class="spx-venom-cancel" type="button">ANULUJ</button>
            `;
            document.body.appendChild(hud);
            hud.querySelector("#spxVenomCancel").addEventListener("click",()=>cancel());
        }

        if(!document.getElementById("spxVenomOverlay")){
            const overlay=document.createElement("div");
            overlay.id="spxVenomOverlay";
            overlay.className="spx-venom-overlay";
            overlay.hidden=true;
            overlay.innerHTML=`
                <section class="spx-venom-panel" role="dialog" aria-modal="true" aria-labelledby="spxVenomTitle">
                    <div class="spx-venom-panel-tendrils" aria-hidden="true"></div>
                    <header class="spx-venom-panel-header">
                        <img src="draft-assets/venompowers.png" alt="" aria-hidden="true">
                        <div>
                            <span>VENOM // GŁÓD SYMBIOTA</span>
                            <h2 id="spxVenomTitle">SYMBIOTYCZNE POŻARCIE</h2>
                            <p id="spxVenomLead"></p>
                        </div>
                    </header>
                    <div id="spxVenomEquation" class="spx-venom-equation"></div>
                    <div class="spx-venom-choice-columns">
                        <section>
                            <h3>ZAMIENNIK VENOMA</h3>
                            <p id="spxVenomOwnerHint"></p>
                            <div id="spxVenomOwnerOptions" class="spx-venom-options"></div>
                        </section>
                        <section>
                            <h3>WYBÓR PRZECIWNIKA</h3>
                            <p id="spxVenomOpponentHint"></p>
                            <div id="spxVenomOpponentOptions" class="spx-venom-options spx-venom-options-opponent"></div>
                        </section>
                    </div>
                    <div id="spxVenomChoiceStatus" class="spx-venom-choice-status">
                        Wybierz po jednym zamienniku.
                    </div>
                    <footer class="spx-venom-actions">
                        <button id="spxVenomBack" class="spx-venom-secondary" type="button">WRÓĆ DO CELÓW</button>
                        <button id="spxVenomConfirm" class="spx-venom-confirm" type="button" disabled>
                            POŻREJ OBIE KARTY
                        </button>
                    </footer>
                </section>
            `;
            document.body.appendChild(overlay);
            overlay.querySelector("#spxVenomBack").addEventListener("click",backToVenomTargetSelection);
            overlay.querySelector("#spxVenomConfirm").addEventListener("click",confirmVenomFeast);
            overlay.addEventListener("click",event=>{
                if(event.target===overlay) backToVenomTargetSelection();
            });
        }

        if(!document.getElementById("spxVenomFeastLayer")){
            const layer=document.createElement("div");
            layer.id="spxVenomFeastLayer";
            layer.className="spx-venom-feast-layer";
            layer.hidden=true;
            document.body.appendChild(layer);
        }

        if(!document.getElementById("spxHulkHud")){
            const hud=document.createElement("div");
            hud.id="spxHulkHud";
            hud.className="spx-hulk-hud";
            hud.hidden=true;
            hud.innerHTML=`
                <img class="spx-power-prompt-logo" src="draft-assets/hulkpowers.png" alt="" aria-hidden="true">
                <div class="spx-hulk-hud-fist spx-power-prompt-decoration" aria-hidden="true">👊</div>
                <div class="spx-hulk-hud-copy">
                    <strong>HULK SMASH!</strong>
                    <span id="spxHulkHudText">Wybierz kartę przeciwnika do zmiażdżenia.</span>
                </div>
                <button id="spxHulkCancel" class="spx-hulk-cancel" type="button">ANULUJ</button>
            `;
            document.body.appendChild(hud);
            hud.querySelector("#spxHulkCancel").addEventListener("click",()=>cancel());
        }

        if(!document.getElementById("spxHulkConfirmOverlay")){
            const overlay=document.createElement("div");
            overlay.id="spxHulkConfirmOverlay";
            overlay.className="spx-hulk-overlay";
            overlay.hidden=true;
            overlay.innerHTML=`
                <section class="spx-hulk-panel" role="dialog" aria-modal="true" aria-labelledby="spxHulkTitle">
                    <div class="spx-hulk-panel-cracks" aria-hidden="true"></div>
                    <header class="spx-hulk-panel-header">
                        <img class="spx-power-prompt-logo" src="draft-assets/hulkpowers.png" alt="" aria-hidden="true">
                        <div class="spx-hulk-panel-fist spx-power-prompt-decoration" aria-hidden="true">👊</div>
                        <div>
                            <span>GAMMA IMPACT // CEL NAMIERZONY</span>
                            <h2 id="spxHulkTitle">HULK SMASH!</h2>
                            <p id="spxHulkLead"></p>
                        </div>
                    </header>
                    <div id="spxHulkTargetCard" class="spx-hulk-target-card"></div>
                    <footer class="spx-hulk-actions">
                        <button id="spxHulkBack" class="spx-hulk-secondary-btn" type="button">WRÓĆ DO WYBORU</button>
                        <button id="spxHulkConfirm" class="spx-hulk-confirm-btn" type="button">ZMIAŻDŻ KARTĘ</button>
                    </footer>
                </section>
            `;
            document.body.appendChild(overlay);
            overlay.querySelector("#spxHulkBack").addEventListener("click",backToHulkTargetSelection);
            overlay.querySelector("#spxHulkConfirm").addEventListener("click",confirmHulkHit);
            overlay.addEventListener("click",event=>{
                if(event.target===overlay) backToHulkTargetSelection();
            });
        }

        if(!document.getElementById("spxHulkRevealOverlay")){
            const overlay=document.createElement("div");
            overlay.id="spxHulkRevealOverlay";
            overlay.className="spx-hulk-overlay spx-hulk-reveal-overlay";
            overlay.hidden=true;
            overlay.innerHTML=`
                <section class="spx-hulk-panel spx-hulk-reveal-panel" role="dialog" aria-modal="true" aria-labelledby="spxHulkRevealTitle">
                    <div class="spx-hulk-panel-cracks" aria-hidden="true"></div>
                    <header class="spx-hulk-panel-header">
                        <img class="spx-power-prompt-logo" src="draft-assets/hulkpowers.png" alt="" aria-hidden="true">
                        <div class="spx-hulk-panel-fist spx-power-prompt-decoration" aria-hidden="true">👊</div>
                        <div>
                            <span>PRZELOSOWANIE ZAKOŃCZONE</span>
                            <h2 id="spxHulkRevealTitle">NOWA KARTA</h2>
                            <p id="spxHulkRevealLead"></p>
                        </div>
                    </header>
                    <div id="spxHulkReplacement" class="spx-hulk-replacement"></div>
                    <footer class="spx-hulk-actions">
                        <button id="spxHulkContinue" class="spx-hulk-confirm-btn" type="button">DRUGI CIOS</button>
                    </footer>
                </section>
            `;
            document.body.appendChild(overlay);
            overlay.querySelector("#spxHulkContinue").addEventListener("click",continueHulkSequence);
        }

        if(!document.getElementById("spxHulkImpactLayer")){
            const layer=document.createElement("div");
            layer.id="spxHulkImpactLayer";
            layer.className="spx-hulk-impact-layer";
            layer.hidden=true;
            document.body.appendChild(layer);
        }

        if(!document.getElementById("spxCyclopsHud")){
            const hud=document.createElement("div");
            hud.id="spxCyclopsHud";
            hud.className="spx-cyclops-hud";
            hud.hidden=true;
            hud.innerHTML=`
                <img class="spx-power-prompt-logo" src="draft-assets/cyclopspowers.png" alt="" aria-hidden="true">
                <div class="spx-cyclops-hud-visor" aria-hidden="true"><span></span></div>
                <div class="spx-cyclops-hud-copy">
                    <strong>DO MNIE, MOJA DRUŻYNO!</strong>
                    <span id="spxCyclopsHudText">🔴 WYBIERZ KAPITANA DRUŻYNY</span>
                </div>
                <button id="spxCyclopsCancel" class="spx-cyclops-cancel" type="button">ANULUJ</button>
            `;
            document.body.appendChild(hud);
            hud.querySelector("#spxCyclopsCancel").addEventListener("click",()=>cancel());
        }

        if(!document.getElementById("spxCyclopsTagOverlay")){
            const overlay=document.createElement("div");
            overlay.id="spxCyclopsTagOverlay";
            overlay.className="spx-cyclops-overlay";
            overlay.hidden=true;
            overlay.innerHTML=`
                <section class="spx-cyclops-panel" role="dialog" aria-modal="true" aria-labelledby="spxCyclopsTagTitle">
                    <div class="spx-cyclops-laser-scan" aria-hidden="true"></div>
                    <header class="spx-cyclops-header">
                        <img src="draft-assets/cyclopspowers.png" alt="" aria-hidden="true">
                        <div>
                            <span>X-MEN TEAM LINK // KAPITAN GOTOWY</span>
                            <h2 id="spxCyclopsTagTitle">WYBIERZ SYNERGIĘ KAPITANA</h2>
                            <p id="spxCyclopsTagLead"></p>
                        </div>
                    </header>
                    <article id="spxCyclopsAnchorCard" class="spx-cyclops-anchor-card"></article>
                    <div id="spxCyclopsTagChoices" class="spx-cyclops-tag-choices"></div>
                    <p id="spxCyclopsTagHint" class="spx-cyclops-tag-hint"></p>
                    <footer class="spx-cyclops-actions">
                        <button id="spxCyclopsTagBack" class="spx-cyclops-secondary-btn" type="button">WYBIERZ INNEGO KAPITANA</button>
                        <button id="spxCyclopsTagConfirm" class="spx-cyclops-confirm-btn" type="button" disabled>
                            ZATWIERDŹ SYNERGIĘ
                        </button>
                    </footer>
                </section>
            `;
            document.body.appendChild(overlay);
            overlay.querySelector("#spxCyclopsTagBack").addEventListener("click",backToCyclopsAnchorSelection);
            overlay.querySelector("#spxCyclopsTagConfirm").addEventListener("click",confirmCyclopsMode);
            overlay.addEventListener("click",event=>{
                if(event.target===overlay) backToCyclopsAnchorSelection();
            });
        }

        if(!document.getElementById("spxCyclopsCandidateOverlay")){
            const overlay=document.createElement("div");
            overlay.id="spxCyclopsCandidateOverlay";
            overlay.className="spx-cyclops-overlay";
            overlay.hidden=true;
            overlay.innerHTML=`
                <section class="spx-cyclops-panel spx-cyclops-candidate-panel" role="dialog" aria-modal="true" aria-labelledby="spxCyclopsCandidateTitle">
                    <div class="spx-cyclops-laser-scan" aria-hidden="true"></div>
                    <header class="spx-cyclops-header">
                        <img src="draft-assets/cyclopspowers.png" alt="" aria-hidden="true">
                        <div>
                            <span id="spxCyclopsCandidateStep">PIERWSZY CZŁONEK DRUŻYNY</span>
                            <h2 id="spxCyclopsCandidateTitle">PRZYWOŁAJ KARTĘ</h2>
                            <p id="spxCyclopsCandidateLead"></p>
                        </div>
                    </header>
                    <article id="spxCyclopsTargetCard" class="spx-cyclops-anchor-card"></article>
                    <div id="spxCyclopsCandidates" class="spx-cyclops-candidates"></div>
                    <div id="spxCyclopsCandidateChoice" class="spx-cyclops-choice">Wybierz kartę z drużyny.</div>
                    <footer class="spx-cyclops-actions">
                        <button id="spxCyclopsCandidateBack" class="spx-cyclops-secondary-btn" type="button">WRÓĆ DO DECKU</button>
                        <button id="spxCyclopsCandidateConfirm" class="spx-cyclops-confirm-btn" type="button" disabled>
                            DODAJ DO PLANU
                        </button>
                    </footer>
                </section>
            `;
            document.body.appendChild(overlay);
            overlay.querySelector("#spxCyclopsCandidateBack").addEventListener("click",backToCyclopsTargetSelection);
            overlay.querySelector("#spxCyclopsCandidateConfirm").addEventListener("click",confirmCyclopsReplacementSelection);
            overlay.addEventListener("click",event=>{
                if(event.target===overlay) backToCyclopsTargetSelection();
            });
        }

        if(!document.getElementById("spxCyclopsFinalOverlay")){
            const overlay=document.createElement("div");
            overlay.id="spxCyclopsFinalOverlay";
            overlay.className="spx-cyclops-overlay";
            overlay.hidden=true;
            overlay.innerHTML=`
                <section class="spx-cyclops-panel spx-cyclops-final-panel" role="dialog" aria-modal="true" aria-labelledby="spxCyclopsFinalTitle">
                    <div class="spx-cyclops-laser-scan" aria-hidden="true"></div>
                    <header class="spx-cyclops-header">
                        <img src="draft-assets/cyclopspowers.png" alt="" aria-hidden="true">
                        <div>
                            <span>CEREBRO // DRUŻYNA GOTOWA</span>
                            <h2 id="spxCyclopsFinalTitle">DO MNIE, MOJA DRUŻYNO!</h2>
                            <p>Obie wymiany zostaną wykonane jednocześnie.</p>
                        </div>
                    </header>
                    <div id="spxCyclopsFinalSummary" class="spx-cyclops-final-summary"></div>
                    <footer class="spx-cyclops-actions">
                        <button id="spxCyclopsFinalBack" class="spx-cyclops-secondary-btn" type="button">ZMIEŃ PLAN</button>
                        <button id="spxCyclopsFinalConfirm" class="spx-cyclops-confirm-btn" type="button">
                            PRZYWOŁAJ DRUŻYNĘ
                        </button>
                    </footer>
                </section>
            `;
            document.body.appendChild(overlay);
            overlay.querySelector("#spxCyclopsFinalBack").addEventListener("click",backFromCyclopsFinal);
            overlay.querySelector("#spxCyclopsFinalConfirm").addEventListener("click",confirmCyclopsTeamCall);
        }

        if(!document.getElementById("spxProfessorXOverlay")){
            const overlay=document.createElement("div");
            overlay.id="spxProfessorXOverlay";
            overlay.className="spx-professorx-overlay";
            overlay.hidden=true;
            overlay.innerHTML=`
                <section class="spx-professorx-panel" role="dialog" aria-modal="true" aria-labelledby="spxProfessorXTitle">
                    <div class="spx-professorx-psychic-field" aria-hidden="true"></div>
                    <header class="spx-professorx-header">
                        <img src="draft-assets/professorxpowers.png" alt="" aria-hidden="true">
                        <div>
                            <span>CEREBRO // ŁĄCZE TELEPATYCZNE</span>
                            <h2 id="spxProfessorXTitle">KONTROLA UMYSŁU</h2>
                            <p id="spxProfessorXLead"></p>
                        </div>
                    </header>
                    <div id="spxProfessorXTargets" class="spx-professorx-targets"></div>
                    <p id="spxProfessorXSelection" class="spx-professorx-selection">
                        WYBRANO 0 / 2 PRZECIWNIKÓW
                    </p>
                    <footer class="spx-professorx-actions">
                        <button id="spxProfessorXCancel" class="spx-professorx-secondary-btn" type="button">ANULUJ</button>
                        <button id="spxProfessorXConfirm" class="spx-professorx-confirm-btn" type="button" disabled>
                            PRZEKAŻ MYŚL
                        </button>
                    </footer>
                </section>
            `;
            document.body.appendChild(overlay);
            overlay.querySelector("#spxProfessorXCancel").addEventListener("click",()=>cancel());
            overlay.querySelector("#spxProfessorXConfirm").addEventListener("click",confirmProfessorXTargets);
            overlay.addEventListener("click",event=>{
                if(event.target===overlay) cancel();
            });
        }

        if(!document.getElementById("spxJeffHud")){
            const hud=document.createElement("div");
            hud.id="spxJeffHud";
            hud.className="spx-jeff-hud";
            hud.hidden=true;
            hud.innerHTML=`
                <img src="draft-assets/jeffpowerslogo.png" alt="" aria-hidden="true">
                <div class="spx-jeff-hud-copy">
                    <strong>JOKEROWA FALA</strong>
                    <span id="spxJeffHudText">Wybierz kartę Jeffa do wymiany.</span>
                </div>
            `;
            document.body.appendChild(hud);
        }

        if(!document.getElementById("spxJeffOverlay")){
            const overlay=document.createElement("div");
            overlay.id="spxJeffOverlay";
            overlay.className="spx-jeff-overlay";
            overlay.hidden=true;
            overlay.innerHTML=`
                <section class="spx-jeff-panel" role="dialog" aria-modal="true" aria-labelledby="spxJeffTitle">
                    <div class="spx-jeff-water-glow" aria-hidden="true"></div>
                    <header class="spx-jeff-header">
                        <img src="draft-assets/jeffpowerslogo.png" alt="" aria-hidden="true">
                        <div>
                            <span>PREMIUM JOKER // NIESPODZIANKA JEFFA</span>
                            <h2 id="spxJeffTitle">JOKEROWA FALA</h2>
                            <p id="spxJeffLead"></p>
                        </div>
                    </header>
                    <div id="spxJeffJokerInfo" class="spx-jeff-joker-info"></div>
                    <div id="spxJeffCandidates" class="spx-jeff-candidates"></div>
                    <p class="spx-jeff-note">
                        Wybierz nagrodę Jokera, a potem wskaż kartę w decku Jeffa, którą ma zastąpić.
                    </p>
                </section>
            `;
            document.body.appendChild(overlay);
        }

        if(!document.getElementById("spxJeffSwimLayer")){
            const layer=document.createElement("div");
            layer.id="spxJeffSwimLayer";
            layer.className="spx-jeff-swim-layer";
            layer.hidden=true;
            layer.innerHTML=`
                <div class="spx-jeff-wave" aria-hidden="true"></div>
                <img src="draft-assets/jeffpowershero.png" alt="Jeff przepływa przez Draft"
                     onerror="this.onerror=null;this.src='draft-assets/jeff_joker.webp'">
                <strong>JOKEROWA FALA!</strong>
            `;
            document.body.appendChild(layer);
        }

        if(!document.getElementById("spxRocketHud")){
            const hud=document.createElement("div");
            hud.id="spxRocketHud";
            hud.className="spx-rocket-hud";
            hud.hidden=true;
            hud.innerHTML=`
                <img class="spx-power-prompt-logo" src="draft-assets/rocketpowers.png" alt="" aria-hidden="true">
                <div class="spx-rocket-hud-copy">
                    <strong>💣 ŁADUNEK WYBUCHOWY</strong>
                    <span id="spxRocketHudText">Wybierz 2 karty do zaminowania.</span>
                </div>
                <button id="spxRocketArm" class="spx-rocket-arm" type="button" disabled>UZBRÓJ BOMBY</button>
                <button id="spxRocketCancel" class="spx-rocket-cancel" type="button">ANULUJ</button>
            `;
            document.body.appendChild(hud);
            hud.querySelector("#spxRocketArm").addEventListener("click",armRocketBombs);
            hud.querySelector("#spxRocketCancel").addEventListener("click",()=>cancel());
        }

        if(!document.getElementById("spxRocketExplosion")){
            const layer=document.createElement("div");
            layer.id="spxRocketExplosion";
            layer.className="spx-rocket-explosion";
            layer.hidden=true;
            layer.innerHTML=`
                <div class="spx-rocket-bomb-drop">
                    <img src="draft-assets/rocketbomb.png" alt="" aria-hidden="true">
                </div>
                <div class="spx-rocket-flash" aria-hidden="true"></div>
                <div class="spx-rocket-shockwave spx-rocket-shockwave-one" aria-hidden="true"></div>
                <div class="spx-rocket-shockwave spx-rocket-shockwave-two" aria-hidden="true"></div>
                <div class="spx-rocket-debris" aria-hidden="true"></div>
                <section class="spx-rocket-result" role="dialog" aria-modal="true">
                    <img src="draft-assets/rocketpowers.png" alt="" aria-hidden="true">
                    <span>BOOM!</span>
                    <h2>ŁADUNEK WYBUCHOWY</h2>
                    <p id="spxRocketResultText"></p>
                    <div class="spx-rocket-result-actions">
                        <button id="spxRocketLeaveLoot" class="spx-rocket-result-secondary" type="button">
                            ODPUŚĆ ZŁOM
                        </button>
                        <button id="spxRocketTakeLoot" class="spx-rocket-result-primary" type="button">
                            ODZYSKAJ ZŁOM
                        </button>
                    </div>
                </section>
            `;
            document.body.appendChild(layer);
            layer.querySelector("#spxRocketLeaveLoot").addEventListener("click",finishRocketWithoutSalvage);
            layer.querySelector("#spxRocketTakeLoot").addEventListener("click",beginRocketSalvage);
        }
    }

    function setHudMessage(message){
        const text=document.getElementById("spxIronManHudText");
        if(text) text.textContent=message;
    }

    function setLokiHudMessage(message){
        const text=document.getElementById("spxLokiHudText");
        if(text) text.textContent=message;
    }

    function setSpiderHudMessage(message){
        const text=document.getElementById("spxSpiderHudText");
        if(text) text.textContent=message;
    }

    function setHulkHudMessage(message){
        const text=document.getElementById("spxHulkHudText");
        if(text) text.textContent=message;
    }

    function setCyclopsHudMessage(message){
        const text=document.getElementById("spxCyclopsHudText");
        if(text) text.textContent=message;
    }

    function feedbackMeta(powerId){
        const definition=getPowerDefinition(powerId);
        return {
            powerId:String(powerId||""),
            color:definition?.color||"#62efff",
            icon:definition?.icon||"",
            name:definition?.name||"SUPERPOWER"
        };
    }

    function showFeedback(kind,powerId,title,message){
        const eventKind=kind==="event";
        const id=eventKind?"spxPowerEventToast":"spxPowerFeedbackToast";
        let toast=document.getElementById(id);
        if(!toast){
            toast=document.createElement("div");
            toast.id=id;
            toast.className=`spx-power-feedback ${eventKind?"is-event":"is-corner"}`;
            toast.setAttribute("aria-live",eventKind?"polite":"assertive");
            document.body.appendChild(toast);
        }
        const meta=feedbackMeta(powerId);
        toast.dataset.kind=kind||"warning";
        toast.dataset.powerId=meta.powerId;
        toast.style.setProperty("--spx-feedback-accent",meta.color);
        toast.innerHTML=`
            ${meta.icon?`<img class="spx-power-feedback-icon" src="${escapeText(meta.icon)}" alt="">`:""}
            <div class="spx-power-feedback-copy">
                <strong>${escapeText(title)}</strong>
                <span>${escapeText(message)}</span>
            </div>`;
        toast.classList.remove("is-visible");
        void toast.offsetWidth;
        toast.classList.add("is-visible");
        const timerKey=eventKind?"eventTimer":"cornerTimer";
        clearTimeout(showFeedback[timerKey]);
        showFeedback[timerKey]=setTimeout(()=>toast.classList.remove("is-visible"),eventKind?3000:4300);
    }

    function showToast(title,message,options={}){
        const powerId=options.powerId||state.powerId||feedbackContextPowerId||"";
        showFeedback(options.kind||"warning",powerId,title,message);
    }

    function showEventToast(title,message,options={}){
        const powerId=options.powerId||state.powerId||feedbackContextPowerId||"";
        showFeedback("event",powerId,title,message);
    }

    function escapeText(value){
        return String(value??"").replace(/[&<>"']/g,char=>({
            "&":"&amp;",
            "<":"&lt;",
            ">":"&gt;",
            "\"":"&quot;",
            "'":"&#039;"
        }[char]));
    }

    function getLokiTargets(playerIndex,sourceCardIndex){
        const decks=adapter?.getDecks?.()||[];
        const banned=new Set((adapter?.getBannedCards?.()||[]).map(normalizeName));
        const occupiedNames=new Set(
            (decks[playerIndex]||[])
                .filter((card,index)=>index!==sourceCardIndex&&card?.name)
                .map(card=>normalizeName(card.name))
        );
        const source=decks[playerIndex]?.[sourceCardIndex];
        if(!source) return [];

        return decks.flatMap((deck,targetPlayerIndex)=>{
            if(targetPlayerIndex===playerIndex || !Array.isArray(deck)) return [];
            return deck
                .map((card,targetCardIndex)=>({
                    card,
                    targetPlayerIndex,
                    targetCardIndex
                }))
                .filter(entry=>
                    entry.card?.name &&
                    window.GrootUI?.isProtectedCard?.(entry.card,"copy")!==true &&
                    !banned.has(normalizeName(entry.card.name)) &&
                    !occupiedNames.has(normalizeName(entry.card.name)) &&
                    String(entry.card.name)!==String(source.name) &&
                    adapter.canSuperpowerTargetDeckCard?.({
                        actorPlayerIndex:playerIndex,
                        targetPlayerIndex:entry.targetPlayerIndex,
                        targetCardIndex:entry.targetCardIndex,
                        effect:"copy"
                    })!==false
                );
        });
    }

    function buildLokiEligibility(playerIndex){
        const deck=(adapter?.getDecks?.()||[])[playerIndex]||[];
        const map=new Map();
        deck.forEach((card,index)=>{
            const targets=getLokiTargets(playerIndex,index);
            if(targets.length) map.set(index,targets);
        });
        return map;
    }

    function startLoki(playerName){
        if(!adapter.isDraftActive?.()){
            showToast("ILUZJA ZABLOKOWANA","Supermocy można użyć podczas aktywnego draftu.");
            return false;
        }

        const assignment=adapter.getAssignment?.(playerName);
        if(!assignment || assignment.powerId!=="loki"){
            showToast("BŁĄD PRZYPISANIA","Ten gracz nie posiada Supermocy Lokiego.");
            return false;
        }
        if(assignment.used){
            showToast("ILUZJA ROZPROSZONA","Loki wykorzystał już MAGICZNY PODSTĘP.");
            return false;
        }

        const players=adapter.getPlayers?.()||[];
        const playerIndex=players.indexOf(playerName);
        if(playerIndex<0) return false;
        const eligibility=buildLokiEligibility(playerIndex);
        if(!eligibility.size){
            showToast(
                "BRAK CELU DLA ILUZJI",
                "Loki potrzebuje własnej karty oraz innej karty znajdującej się w decku przeciwnika."
            );
            return false;
        }

        cancel({silent:true,refresh:false});
        state.active=true;
        state.powerId="loki";
        state.playerName=playerName;
        state.playerIndex=playerIndex;
        state.sourceCardIndex=-1;
        state.targetPlayerIndex=-1;
        state.targetCardIndex=-1;
        state.candidatesByCardIndex=eligibility;

        document.body.classList.add("spx-loki-selecting-own");
        const hud=document.getElementById("spxLokiHud");
        if(hud) hud.hidden=false;
        setLokiHudMessage(`${playerName}: wybierz własną kartę do poświęcenia.`);
        adapter.refreshDecks?.();
        return true;
    }

    function decorateLokiCards(){
        const choosingTarget=state.sourceCardIndex>=0;
        const targets=choosingTarget
            ? state.candidatesByCardIndex.get(state.sourceCardIndex)||[]
            : [];
        const targetKeys=new Set(
            targets.map(entry=>`${entry.targetPlayerIndex}:${entry.targetCardIndex}`)
        );

        document.querySelectorAll(".card[data-player-index]").forEach(cardElement=>{
            const playerIndex=Number(cardElement.dataset.playerIndex);
            const cardIndex=Number(cardElement.dataset.cardIndex);
            cardElement.classList.remove(
                "spx-loki-own-eligible",
                "spx-loki-sacrifice",
                "spx-loki-target",
                "spx-loki-ineligible"
            );

            if(!choosingTarget){
                if(playerIndex===state.playerIndex && state.candidatesByCardIndex.has(cardIndex)){
                    cardElement.classList.add("spx-loki-own-eligible");
                    cardElement.title="LOKI: wybierz tę kartę do poświęcenia";
                }else{
                    cardElement.classList.add("spx-loki-ineligible");
                }
                return;
            }

            if(playerIndex===state.playerIndex && cardIndex===state.sourceCardIndex){
                cardElement.classList.add("spx-loki-sacrifice");
                cardElement.title="Karta przeznaczona do zastąpienia magiczną kopią";
            }else if(targetKeys.has(`${playerIndex}:${cardIndex}`)){
                cardElement.classList.add("spx-loki-target");
                cardElement.title="LOKI: skopiuj tę kartę";
            }else{
                cardElement.classList.add("spx-loki-ineligible");
            }
        });
    }

    function handleLokiDeckCardClick(playerIndex,cardIndex){
        if(state.sourceCardIndex<0){
            if(
                playerIndex!==state.playerIndex ||
                !state.candidatesByCardIndex.has(cardIndex)
            ){
                setLokiHudMessage(`Najpierw wybierz kartę z decku gracza ${state.playerName}.`);
                return true;
            }

            state.sourceCardIndex=cardIndex;
            document.body.classList.remove("spx-loki-selecting-own");
            document.body.classList.add("spx-loki-selecting-target");
            setLokiHudMessage("Wybierz kartę przeciwnika, którą Loki ma skopiować.");
            adapter.refreshDecks?.();
            return true;
        }

        if(playerIndex===state.playerIndex){
            if(state.candidatesByCardIndex.has(cardIndex)){
                state.sourceCardIndex=cardIndex;
                setLokiHudMessage("Zmieniono kartę poświęcaną. Teraz wybierz kartę przeciwnika.");
                adapter.refreshDecks?.();
            }
            return true;
        }

        const targets=state.candidatesByCardIndex.get(state.sourceCardIndex)||[];
        const selected=targets.find(entry=>
            entry.targetPlayerIndex===playerIndex &&
            entry.targetCardIndex===cardIndex
        );
        if(!selected){
            setLokiHudMessage("Ta karta nie jest dostępnym celem iluzji.");
            return true;
        }

        state.targetPlayerIndex=playerIndex;
        state.targetCardIndex=cardIndex;
        openLokiConfirmation();
        return true;
    }

    function openLokiConfirmation(){
        const decks=adapter?.getDecks?.()||[];
        const players=adapter?.getPlayers?.()||[];
        const source=decks[state.playerIndex]?.[state.sourceCardIndex];
        const target=decks[state.targetPlayerIndex]?.[state.targetCardIndex];
        const overlay=document.getElementById("spxLokiOverlay");
        const lead=document.getElementById("spxLokiLead");
        const exchange=document.getElementById("spxLokiExchange");
        if(!source || !target || !overlay || !lead || !exchange) return;

        lead.textContent=`${state.playerName} skopiuje kartę gracza ${players[state.targetPlayerIndex]}.`;
        exchange.innerHTML=`
            <article class="spx-loki-card spx-loki-card-sacrifice" data-card-name="${escapeText(source.name)}">
                <span>KARTA POŚWIĘCANA</span>
                <strong>${escapeText(source.name)}</strong>
                <b>${escapeText(source.cost)} / ${escapeText(source.power)}</b>
            </article>
            <div class="spx-loki-copy-mark" aria-hidden="true">ᛟ</div>
            <article class="spx-loki-card spx-loki-card-copy" data-card-name="${escapeText(target.name)}">
                <span>MAGICZNA KOPIA</span>
                <strong>${escapeText(target.name)}</strong>
                <b>${escapeText(target.cost)} / ${escapeText(target.power)}</b>
                <small>${escapeText(players[state.targetPlayerIndex])}</small>
            </article>
        `;
        overlay.hidden=false;
    }

    function backToLokiTargetSelection(){
        const overlay=document.getElementById("spxLokiOverlay");
        if(overlay) overlay.hidden=true;
        state.targetPlayerIndex=-1;
        state.targetCardIndex=-1;
        setLokiHudMessage("Wybierz kartę przeciwnika, którą Loki ma skopiować.");
    }

    function getDeckCardElement(playerIndex,cardIndex){
        return document.querySelector(
            `.card[data-player-index="${playerIndex}"][data-card-index="${cardIndex}"]`
        );
    }

    function playLokiTransfer(sourceRect,targetRect,cardName,onComplete){
        const layer=document.getElementById("spxLokiMagicLayer");
        if(!layer || !sourceRect || !targetRect){
            onComplete?.();
            return;
        }

        const startX=targetRect.left+targetRect.width/2;
        const startY=targetRect.top+targetRect.height/2;
        const endX=sourceRect.left+sourceRect.width/2;
        const endY=sourceRect.top+sourceRect.height/2;
        const dx=endX-startX;
        const dy=endY-startY;
        const distance=Math.max(1,Math.hypot(dx,dy));
        const angle=Math.atan2(dy,dx)*180/Math.PI;

        layer.innerHTML=`
            <div class="spx-loki-beam"></div>
            <div class="spx-loki-flying-card">${escapeText(cardName)}</div>
            <div class="spx-loki-impact spx-loki-impact-source"></div>
            <div class="spx-loki-impact spx-loki-impact-target"></div>
        `;
        layer.style.setProperty("--spx-loki-start-x",`${startX}px`);
        layer.style.setProperty("--spx-loki-start-y",`${startY}px`);
        layer.style.setProperty("--spx-loki-end-x",`${endX}px`);
        layer.style.setProperty("--spx-loki-end-y",`${endY}px`);
        layer.style.setProperty("--spx-loki-dx",`${dx}px`);
        layer.style.setProperty("--spx-loki-dy",`${dy}px`);
        layer.style.setProperty("--spx-loki-distance",`${distance}px`);
        layer.style.setProperty("--spx-loki-angle",`${angle}deg`);
        layer.style.setProperty("--spx-loki-card-width",`${Math.max(110,targetRect.width)}px`);
        layer.hidden=false;

        clearTimeout(playLokiTransfer.timer);
        playLokiTransfer.timer=setTimeout(()=>{
            layer.hidden=true;
            layer.innerHTML="";
            onComplete?.();
        },1050);
    }

    function confirmLokiSwap(){
        if(
            !state.active ||
            state.powerId!=="loki" ||
            state.sourceCardIndex<0 ||
            state.targetPlayerIndex<0 ||
            state.targetCardIndex<0
        ) return;

        const sourceElement=getDeckCardElement(state.playerIndex,state.sourceCardIndex);
        const targetElement=getDeckCardElement(state.targetPlayerIndex,state.targetCardIndex);
        const sourceRect=sourceElement?.getBoundingClientRect?.();
        const targetRect=targetElement?.getBoundingClientRect?.();

        const result=adapter.commitLokiSwap?.({
            playerName:state.playerName,
            playerIndex:state.playerIndex,
            sourceCardIndex:state.sourceCardIndex,
            targetPlayerIndex:state.targetPlayerIndex,
            targetCardIndex:state.targetCardIndex
        });

        if(!result?.ok){
            showToast("ILUZJA PRZERWANA",result?.message||"Nie udało się stworzyć kopii karty.");
            return;
        }

        const removed=result.removedCard?.name||"karta";
        const copied=result.copiedCard?.name||"kopia";
        const overlay=document.getElementById("spxLokiOverlay");
        if(overlay) overlay.hidden=true;
        document.body.classList.add("spx-loki-animating");

        playLokiTransfer(sourceRect,targetRect,copied,()=>{
            playCaptainAmericaRicochet(result.counterattack,()=>{
                cancel({silent:true,refresh:false});
                document.body.classList.remove("spx-loki-animating");
                adapter.refreshDecks?.();
            showEventToast("ILUZJA DOSKONAŁA",`${removed} → ${copied}. Oryginał pozostał u przeciwnika.`);
            });
        });
    }

    function setCaptainHudMessage(message){
        const text=document.getElementById("spxCaptainHudText");
        if(text) text.textContent=message;
    }

    function updateCaptainSelectionHud(){
        const count=state.captainSelectedCardIndices.size;
        const counter=document.getElementById("spxCaptainCount");
        const confirm=document.getElementById("spxCaptainConfirm");
        if(counter) counter.textContent=`${count} / 3`;
        if(confirm) confirm.disabled=count!==3 || state.captainResolving;
    }

    function startCaptainAmerica(playerName){
        if(!adapter.isDraftActive?.()){
            showToast("TARCZA JESZCZE SPOCZYWA","Supermocy można użyć podczas aktywnego draftu.");
            return false;
        }

        const assignment=adapter.getAssignment?.(playerName);
        if(!assignment || assignment.powerId!=="captain_america"){
            showToast("BŁĄD PRZYPISANIA","Ten gracz nie posiada Supermocy Kapitana Ameryki.");
            return false;
        }
        if(assignment.used){
            showToast("TARCZE JUŻ ROZSTAWIONE","TARCZA KAPITANA została już aktywowana.");
            return false;
        }

        const players=adapter.getPlayers?.()||[];
        const decks=adapter.getDecks?.()||[];
        const playerIndex=players.indexOf(playerName);
        const deck=decks[playerIndex]||[];
        const unprotectedCount=deck.reduce((count,card,index)=>
            count + (card && !adapter.isCaptainAmericaProtectedCard?.(playerIndex,index) ? 1 : 0),0
        );
        if(playerIndex<0 || unprotectedCount<3){
            showToast("ZA MAŁO NIEOSŁONIĘTYCH KART","Kapitan potrzebuje trzech kart bez aktywnej Tarczy Kapitana.");
            return false;
        }

        cancel({silent:true,refresh:false,force:true});
        state.active=true;
        state.powerId="captain_america";
        state.playerName=playerName;
        state.playerIndex=playerIndex;
        state.captainSelectedCardIndices=new Set();
        state.captainResolving=false;

        document.body.classList.add("spx-cap-selecting");
        const hud=document.getElementById("spxCaptainHud");
        if(hud) hud.hidden=false;
        setCaptainHudMessage(`${playerName}: wybierz dokładnie trzy karty, które mają zostać osłonięte.`);
        updateCaptainSelectionHud();
        adapter.refreshDecks?.();
        return true;
    }

    function decorateCaptainAmericaCards(){
        document.querySelectorAll(".card[data-player-index]").forEach(cardElement=>{
            const playerIndex=Number(cardElement.dataset.playerIndex);
            const cardIndex=Number(cardElement.dataset.cardIndex);
            cardElement.classList.remove("spx-cap-candidate","spx-cap-selected","spx-cap-locked");
            cardElement.querySelectorAll(".spx-cap-selection-mark").forEach(marker=>marker.remove());

            if(playerIndex!==state.playerIndex){
                cardElement.classList.add("spx-cap-locked");
                return;
            }
            if(adapter.isCaptainAmericaProtectedCard?.(playerIndex,cardIndex)){
                cardElement.classList.add("spx-cap-locked");
                cardElement.title="Ta karta ma już Tarczę Kapitana.";
                return;
            }

            cardElement.classList.add("spx-cap-candidate");
            cardElement.title="CAPTAIN AMERICA: kliknij, aby włączyć lub wyłączyć wibraniową tarczę";
            if(state.captainSelectedCardIndices.has(cardIndex)){
                cardElement.classList.add("spx-cap-selected");
                const marker=document.createElement("img");
                marker.className="spx-cap-selection-mark";
                marker.src="draft-assets/captainamericashield.png";
                marker.alt="";
                marker.setAttribute("aria-hidden","true");
                cardElement.appendChild(marker);
            }
        });
    }

    function handleCaptainAmericaDeckCardClick(playerIndex,cardIndex){
        if(playerIndex!==state.playerIndex){
            setCaptainHudMessage(`Wybierz trzy karty z decku gracza ${state.playerName}.`);
            return true;
        }
        if(adapter.isCaptainAmericaProtectedCard?.(playerIndex,cardIndex)){
            setCaptainHudMessage("Ta karta ma już Tarczę Kapitana. Wybierz inną kartę.");
            return true;
        }

        if(state.captainSelectedCardIndices.has(cardIndex)){
            state.captainSelectedCardIndices.delete(cardIndex);
        }else{
            if(state.captainSelectedCardIndices.size>=3){
                setCaptainHudMessage("Masz już trzy tarcze. Odznacz jedną kartę, aby zmienić wybór.");
                return true;
            }
            state.captainSelectedCardIndices.add(cardIndex);
        }

        setCaptainHudMessage(
            state.captainSelectedCardIndices.size===3
                ? "Drużyna osłonięta. Potwierdź rozstawienie tarcz."
                : "Wybierz dokładnie trzy karty do osłonięcia."
        );
        updateCaptainSelectionHud();
        adapter.refreshDecks?.();
        return true;
    }

    function playCaptainAmericaActivation(onComplete){
        const layer=document.getElementById("spxCaptainActivationLayer");
        if(!layer){
            onComplete?.();
            return;
        }
        layer.innerHTML=`
            <div class="spx-cap-activation-flash"></div>
            <img class="spx-cap-activation-shield" src="draft-assets/captainamericapowers.png" alt="">
        `;
        layer.hidden=false;
        clearTimeout(playCaptainAmericaActivation.timer);
        playCaptainAmericaActivation.timer=setTimeout(()=>{
            layer.hidden=true;
            layer.innerHTML="";
            onComplete?.();
        },1080);
    }

    function showCaptainAmericaReadyPrompt(protectedNames=[]){
        const prompt=document.getElementById("spxCaptainReadyPrompt");
        if(!prompt){
            showToast(
                "REFLEKS KAPITANA GOTOWY NA KONTRATAK",
                "Gdy wrogi cios przebije obronę, Kapitan automatycznie odbije atak."
            );
            return;
        }

        const protectedLabel=protectedNames.length
            ? `TARCZE CHRONIĄ: ${protectedNames.join(" • ")}`
            : "TRZY TARCZE ROZSTAWIONE";
        prompt.innerHTML=`
            <div class="spx-cap-ready-card">
                <div class="spx-cap-ready-burst" aria-hidden="true"></div>
                <img src="draft-assets/captainamericapowers.png" alt="" aria-hidden="true">
                <div class="spx-cap-ready-copy">
                    <span>WIBRANIOWY REFLEKS</span>
                    <h2>REFLEKS KAPITANA GOTOWY NA KONTRATAK</h2>
                    <p>Gdy wrogi cios przebije obronę, Kapitan automatycznie odbije atak tarczą.</p>
                    <small>${protectedLabel}</small>
                </div>
            </div>
        `;
        clearTimeout(showCaptainAmericaReadyPrompt.timer);
        prompt.hidden=false;
        prompt.classList.remove("is-visible");
        void prompt.offsetWidth;
        prompt.classList.add("is-visible");
        showCaptainAmericaReadyPrompt.timer=setTimeout(()=>{
            prompt.classList.remove("is-visible");
            prompt.hidden=true;
            prompt.innerHTML="";
        },3400);
    }

    function playCaptainAmericaRicochet(result,onComplete){
        if(!result?.triggered){
            onComplete?.();
            return;
        }
        const layer=document.getElementById("spxCaptainRicochetLayer");
        const targetElement=getDeckCardElement(result.defenderPlayerIndex,result.defenderCardIndex);
        const attackerElement=getDeckCardElement(result.attackerPlayerIndex,result.rerolledCardIndex);
        const targetRect=targetElement?.getBoundingClientRect?.();
        const attackerRect=attackerElement?.getBoundingClientRect?.();
        if(!layer){
            showEventToast(
                "RYKOSZET KAPITANA!",
                `${result.attackerName}: ${result.removedCard?.name||"karta"} → ${result.replacementCard?.name||"nowa karta"}.`,
                {powerId:"captain_america"}
            );
            onComplete?.();
            return;
        }

        const startX=targetRect ? targetRect.left+targetRect.width/2 : window.innerWidth*.34;
        const startY=targetRect ? targetRect.top+targetRect.height/2 : window.innerHeight*.58;
        const endX=attackerRect ? attackerRect.left+attackerRect.width/2 : window.innerWidth*.72;
        const endY=attackerRect ? attackerRect.top+attackerRect.height/2 : window.innerHeight*.42;
        const dx=endX-startX;
        const dy=endY-startY;
        const distance=Math.max(1,Math.hypot(dx,dy));
        const angle=Math.atan2(dy,dx)*180/Math.PI;
        layer.style.setProperty("--spx-cap-start-x",`${startX}px`);
        layer.style.setProperty("--spx-cap-start-y",`${startY}px`);
        layer.style.setProperty("--spx-cap-dx",`${dx}px`);
        layer.style.setProperty("--spx-cap-dy",`${dy}px`);
        layer.style.setProperty("--spx-cap-distance",`${distance}px`);
        layer.style.setProperty("--spx-cap-angle",`${angle}deg`);
        layer.innerHTML=`
            <div class="spx-cap-counter-stars" aria-hidden="true"></div>
            <div class="spx-cap-ricochet-beam"></div>
            <img class="spx-cap-ricochet-disc" src="draft-assets/cap_shield_flying.png" alt="">
            <section class="spx-cap-counter-stage" role="dialog" aria-modal="true" aria-live="polite">
                <span>TARCZA KAPITANA</span>
                <h2>KONTRUJĄCY RZUT TARCZĄ</h2>
                <img class="spx-cap-counter-ready-shield" src="draft-assets/captainamericapowers.png" alt="" aria-hidden="true">
                <p class="spx-cap-counter-flavor">Kapitan Ameryka nie zdążył osłonić karty <strong>${escapeText(result.defenderCardName||"tej karty")}</strong> przed ciosem. Nie pozostawia jednak ataku bez odpowiedzi — wykonuje kontrujący rzut tarczą w deck napastnika.</p>
                <div class="spx-cap-counter-versus">
                    <article><small>ATAKUJĄCY</small><strong>${escapeText(result.attackerName||"Przeciwnik")}</strong></article>
                    <b>VS</b>
                    <article><small>OBRONIONY GRACZ</small><strong>${escapeText(result.defenderName||"Captain America")}</strong></article>
                </div>
                <div class="spx-cap-counter-result">
                    <span>${escapeText(result.removedCard?.name||"Karta")}</span>
                    <b>→</b>
                    <strong>${escapeText(result.replacementCard?.name||"Nowa karta")}</strong>
                </div>
                <div class="spx-cap-counter-actions"><button class="spx-cap-counter-launch" type="button">RZUĆ TARCZĄ</button></div>
            </section>
        `;
        layer.classList.remove("is-launched","is-resolved");
        layer.hidden=false;
        clearTimeout(playCaptainAmericaRicochet.timer);
        const launchButton=layer.querySelector(".spx-cap-counter-launch");
        let resolved=false;
        const close=()=>{
            layer.hidden=true;
            layer.innerHTML="";
            layer.classList.remove("is-launched","is-resolved");
            adapter.refreshRoster?.();
            onComplete?.();
        };
        launchButton?.addEventListener("click",()=>{
            if(resolved){
                close();
                return;
            }
            layer.classList.add("is-launched");
            launchButton.disabled=true;
            launchButton.textContent="TARCZA W LOCIE…";
            playCaptainAmericaRicochet.timer=setTimeout(()=>{
                resolved=true;
                layer.classList.add("is-resolved");
                launchButton.disabled=false;
                launchButton.textContent="KONTYNUUJ";
                launchButton.focus();
            },1600);
        });
        launchButton?.focus();
    }

    function playCaptainAmericaRicochets(results,onComplete){
        const queue=(Array.isArray(results) ? results : []).filter(result=>result?.triggered);
        const next=()=>{
            const result=queue.shift();
            if(!result){
                onComplete?.();
                return;
            }
            playCaptainAmericaRicochet(result,next);
        };
        next();
    }

    function confirmCaptainAmericaShields(){
        if(
            !state.active ||
            state.powerId!=="captain_america" ||
            state.captainResolving ||
            state.captainSelectedCardIndices.size!==3
        ) return;

        state.captainResolving=true;
        updateCaptainSelectionHud();
        const result=adapter.commitCaptainAmericaShields?.({
            playerName:state.playerName,
            playerIndex:state.playerIndex,
            cardIndices:[...state.captainSelectedCardIndices]
        });
        if(!result?.ok){
            state.captainResolving=false;
            updateCaptainSelectionHud();
            showToast("TARCZE ODRZUCONE",result?.message||"Nie udało się osłonić kart.");
            return;
        }

        const hud=document.getElementById("spxCaptainHud");
        if(hud) hud.hidden=true;
        playCaptainAmericaActivation(()=>{
            const protectedNames=(result.protectedCards||[]).map(card=>card?.name).filter(Boolean);
            cancel({silent:true,refresh:false,force:true});
            adapter.refreshDecks?.();
            adapter.refreshRoster?.();
            showCaptainAmericaReadyPrompt(protectedNames);
        });
    }

    function setVenomHudMessage(message){
        const text=document.getElementById("spxVenomHudText");
        if(text) text.textContent=message;
    }

    function buildVenomPairMap(playerName,playerIndex){
        const decks=adapter?.getDecks?.()||[];
        const sourceDeck=decks[playerIndex]||[];
        const pairs=new Map();

        sourceDeck.forEach((sourceCard,sourceCardIndex)=>{
            const targets=[];
            decks.forEach((deck,targetPlayerIndex)=>{
                if(targetPlayerIndex===playerIndex || !Array.isArray(deck)) return;
                deck.forEach((targetCard,targetCardIndex)=>{
                    const result=adapter?.getVenomPairOptions?.({
                        playerName,
                        playerIndex,
                        sourceCardIndex,
                        targetPlayerIndex,
                        targetCardIndex
                    });
                    if(result?.ok){
                        targets.push({
                            targetPlayerIndex,
                            targetCardIndex,
                            combinedPower:result.combinedPower
                        });
                    }
                });
            });
            if(targets.length) pairs.set(sourceCardIndex,targets);
        });
        return pairs;
    }

    function startVenom(playerName){
        if(!adapter.isDraftActive?.()){
            showToast("SYMBIONT JESZCZE ŚPI","Supermocy można użyć podczas aktywnego draftu.");
            return false;
        }

        const assignment=adapter.getAssignment?.(playerName);
        if(!assignment || assignment.powerId!=="venom"){
            showToast("BŁĄD PRZYPISANIA","Ten gracz nie posiada Supermocy Venoma.");
            return false;
        }
        if(assignment.used){
            showToast("VENOM JEST JUŻ SYTY","SYMBIOTYCZNE POŻARCIE zostało już wykorzystane.");
            return false;
        }

        const players=adapter.getPlayers?.()||[];
        const playerIndex=players.indexOf(playerName);
        if(playerIndex<0) return false;
        const pairMap=buildVenomPairMap(playerName,playerIndex);
        if(!pairMap.size){
            showToast(
                "BRAK POŻYWNEJ PARY",
                "Venom nie znajduje zamiennika dla tej pary."
            );
            return false;
        }

        cancel({silent:true,refresh:false,force:true});
        state.active=true;
        state.powerId="venom";
        state.playerName=playerName;
        state.playerIndex=playerIndex;
        state.sourceCardIndex=-1;
        state.targetPlayerIndex=-1;
        state.targetCardIndex=-1;
        state.venomPhase="own";
        state.venomPairMap=pairMap;
        state.venomOwnerOptions=[];
        state.venomOpponentOptions=[];
        state.venomOwnerReplacementName="";
        state.venomOpponentReplacementName="";
        state.venomResolving=false;

        document.body.classList.add("spx-venom-selecting-own");
        const hud=document.getElementById("spxVenomHud");
        if(hud) hud.hidden=false;
        setVenomHudMessage(`${playerName}: wybierz własną kartę, którą pożre symbiont.`);
        adapter.refreshDecks?.();
        return true;
    }

    function getVenomTargetPairs(){
        return state.venomPairMap.get(state.sourceCardIndex)||[];
    }

    function addVenomCardMark(cardElement,variant){
        const marker=document.createElement("img");
        marker.className=`spx-venom-card-mark spx-venom-card-mark-${variant}`;
        marker.src="draft-assets/venom_symbiote_card_slime.png";
        marker.alt="";
        marker.setAttribute("aria-hidden","true");
        cardElement.appendChild(marker);
    }

    function decorateVenomCards(){
        const targetPairs=getVenomTargetPairs();
        document.querySelectorAll(".spx-venom-deck-frame").forEach(frame=>frame.remove());
        document.querySelectorAll(".card[data-player-index]").forEach(cardElement=>{
            const playerIndex=Number(cardElement.dataset.playerIndex);
            const cardIndex=Number(cardElement.dataset.cardIndex);
            cardElement.classList.remove(
                "spx-venom-own-candidate",
                "spx-venom-target-candidate",
                "spx-venom-selected",
                "spx-venom-locked",
                "spx-strange-deck-candidate",
                "spx-strange-deck-selected",
                "spx-strange-deck-locked",
                "spx-strange-current-candidate",
                "spx-strange-current-selected",
                "spx-strange-pack-paused"
            );
            cardElement.querySelectorAll(".spx-venom-card-mark").forEach(marker=>marker.remove());

            if(state.venomPhase==="own"){
                if(playerIndex===state.playerIndex && state.venomPairMap.has(cardIndex)){
                    cardElement.classList.add("spx-venom-own-candidate");
                    cardElement.title="VENOM: wybierz tę własną kartę do pożarcia";
                }else{
                    cardElement.classList.add("spx-venom-locked");
                }
                return;
            }

            if(playerIndex===state.playerIndex && cardIndex===state.sourceCardIndex){
                cardElement.classList.add("spx-venom-selected");
                cardElement.title="VENOM: własna karta przeznaczona do pożarcia";
                addVenomCardMark(cardElement,"own");
                return;
            }
            const isTarget=targetPairs.some(pair=>
                pair.targetPlayerIndex===playerIndex &&
                pair.targetCardIndex===cardIndex
            );
            if(isTarget){
                cardElement.classList.add("spx-venom-target-candidate");
                cardElement.title="VENOM: pożryj tę kartę przeciwnika";
            }else{
                cardElement.classList.add("spx-venom-locked");
            }
        });

        document.querySelectorAll(".deck-section").forEach(section=>{
            const hasCandidate=section.querySelector(
                state.venomPhase==="own"
                    ? ".card.spx-venom-own-candidate"
                    : ".card.spx-venom-target-candidate"
            );
            if(!hasCandidate) return;
            const frame=document.createElement("img");
            frame.className="spx-venom-deck-frame";
            frame.src="draft-assets/venom_symbiote_card_slime.png";
            frame.alt="";
            frame.setAttribute("aria-hidden","true");
            section.appendChild(frame);
        });
    }

    function handleVenomDeckCardClick(playerIndex,cardIndex){
        if(state.venomResolving) return true;

        if(state.venomPhase==="own"){
            if(playerIndex!==state.playerIndex || !state.venomPairMap.has(cardIndex)){
                setVenomHudMessage("Wybierz podświetloną kartę z własnego decku.");
                return true;
            }
            state.sourceCardIndex=cardIndex;
            state.venomPhase="target";
            document.body.classList.remove("spx-venom-selecting-own");
            document.body.classList.add("spx-venom-selecting-target");
            setVenomHudMessage("Teraz wybierz podświetloną kartę przeciwnika.");
            adapter.refreshDecks?.();
            return true;
        }

        if(playerIndex===state.playerIndex && cardIndex===state.sourceCardIndex){
            state.sourceCardIndex=-1;
            state.venomPhase="own";
            document.body.classList.remove("spx-venom-selecting-target");
            document.body.classList.add("spx-venom-selecting-own");
            setVenomHudMessage("Wybierz inną własną kartę do pożarcia.");
            adapter.refreshDecks?.();
            return true;
        }

        const pair=getVenomTargetPairs().find(entry=>
            entry.targetPlayerIndex===playerIndex &&
            entry.targetCardIndex===cardIndex
        );
        if(!pair){
            setVenomHudMessage("Venom nie znajduje zamiennika dla tej pary.");
            return true;
        }

        state.targetPlayerIndex=playerIndex;
        state.targetCardIndex=cardIndex;
        const prepared=adapter.prepareVenomFeast?.({
            playerName:state.playerName,
            playerIndex:state.playerIndex,
            sourceCardIndex:state.sourceCardIndex,
            targetPlayerIndex:playerIndex,
            targetCardIndex:cardIndex
        });
        if(!prepared?.ok){
            showToast("VENOM NIE MOŻE UGRYŹĆ",prepared?.message||"Nie udało się przygotować pożarcia.");
            state.targetPlayerIndex=-1;
            state.targetCardIndex=-1;
            return true;
        }

        state.venomOwnerOptions=prepared.ownerOptions||[];
        state.venomOpponentOptions=prepared.opponentOptions||[];
        state.venomOwnerReplacementName="";
        state.venomOpponentReplacementName="";
        openVenomChoicePanel(prepared);
        return true;
    }

    function createVenomOptionButton(card,side){
        const button=document.createElement("button");
        button.type="button";
        button.className="spx-venom-option";
        button.dataset.cardName=card.name;
        button.innerHTML=`
            <strong>${escapeText(card.name)}</strong>
            <span><b>${escapeText(card.cost)}</b> KOSZT <b>${escapeText(card.power)}</b> SIŁA</span>
        `;
        button.addEventListener("click",()=>{
            const container=button.parentElement;
            container.querySelectorAll(".spx-venom-option").forEach(item=>{
                item.classList.toggle("spx-venom-option-selected",item===button);
            });
            if(side==="owner"){
                state.venomOwnerReplacementName=card.name;
            }else{
                state.venomOpponentReplacementName=card.name;
            }
            updateVenomChoiceStatus();
        });
        return button;
    }

    function updateVenomChoiceStatus(){
        const confirm=document.getElementById("spxVenomConfirm");
        const status=document.getElementById("spxVenomChoiceStatus");
        const ready=Boolean(
            state.venomOwnerReplacementName &&
            state.venomOpponentReplacementName
        );
        if(confirm) confirm.disabled=!ready || state.venomResolving;
        if(status){
            status.innerHTML=ready
                ? `VENOM: <strong>${escapeText(state.venomOwnerReplacementName)}</strong> • `+
                  `PRZECIWNIK: <strong>${escapeText(state.venomOpponentReplacementName)}</strong>`
                : "Wybierz po jednym zamienniku.";
        }
    }

    function openVenomChoicePanel(prepared){
        const overlay=document.getElementById("spxVenomOverlay");
        const lead=document.getElementById("spxVenomLead");
        const equation=document.getElementById("spxVenomEquation");
        const ownerHint=document.getElementById("spxVenomOwnerHint");
        const opponentHint=document.getElementById("spxVenomOpponentHint");
        const ownerOptions=document.getElementById("spxVenomOwnerOptions");
        const opponentOptions=document.getElementById("spxVenomOpponentOptions");
        if(
            !overlay || !lead || !equation || !ownerHint || !opponentHint ||
            !ownerOptions || !opponentOptions
        ) return;

        lead.textContent=`🦷 Łączna Siła ofiar: ${prepared.combinedPower}`;
        equation.innerHTML=`
            <article>
                <span>VENOM POŻERA</span>
                <strong>${escapeText(prepared.sourceCard?.name||"—")}</strong>
                <b>${escapeText(prepared.sourceCard?.power)} SIŁY</b>
            </article>
            <i aria-hidden="true">+</i>
            <article>
                <span>${escapeText(prepared.targetOwner||"PRZECIWNIK")} TRACI</span>
                <strong>${escapeText(prepared.targetCard?.name||"—")}</strong>
                <b>${escapeText(prepared.targetCard?.power)} SIŁY</b>
            </article>
            <i aria-hidden="true">=</i>
            <article class="spx-venom-total">
                <span>ŁĄCZNY GŁÓD</span>
                <strong>${escapeText(prepared.combinedPower)}</strong>
                <b>SIŁY ZAMIENNIKA</b>
            </article>
        `;
        ownerHint.textContent=`Wybierz kartę o ${prepared.combinedPower} Siły.`;
        opponentHint.textContent=`${prepared.targetOwner} wybiera 1 z 2.`;
        ownerOptions.innerHTML="";
        opponentOptions.innerHTML="";
        state.venomOwnerOptions.forEach(card=>
            ownerOptions.appendChild(createVenomOptionButton(card,"owner"))
        );
        state.venomOpponentOptions.forEach(card=>
            opponentOptions.appendChild(createVenomOptionButton(card,"opponent"))
        );
        updateVenomChoiceStatus();
        overlay.hidden=false;
    }

    function backToVenomTargetSelection(){
        if(state.venomResolving) return;
        const overlay=document.getElementById("spxVenomOverlay");
        if(overlay) overlay.hidden=true;
        state.targetPlayerIndex=-1;
        state.targetCardIndex=-1;
        state.venomOwnerOptions=[];
        state.venomOpponentOptions=[];
        state.venomOwnerReplacementName="";
        state.venomOpponentReplacementName="";
        setVenomHudMessage("Wybierz podświetloną kartę przeciwnika.");
        adapter.refreshDecks?.();
    }

    function playVenomFeastAnimation(sourceRect,targetRect,result,onComplete){
        const layer=document.getElementById("spxVenomFeastLayer");
        if(!layer || !sourceRect || !targetRect){
            setTimeout(()=>onComplete?.(),500);
            return;
        }
        const startX=sourceRect.left+sourceRect.width/2;
        const startY=sourceRect.top+sourceRect.height/2;
        const endX=targetRect.left+targetRect.width/2;
        const endY=targetRect.top+targetRect.height/2;
        const dx=endX-startX;
        const dy=endY-startY;
        const distance=Math.max(1,Math.hypot(dx,dy));
        const angle=Math.atan2(dy,dx)*180/Math.PI;
        layer.style.setProperty("--spx-venom-start-x",`${startX}px`);
        layer.style.setProperty("--spx-venom-start-y",`${startY}px`);
        layer.style.setProperty("--spx-venom-end-x",`${endX}px`);
        layer.style.setProperty("--spx-venom-end-y",`${endY}px`);
        layer.style.setProperty("--spx-venom-distance",`${distance}px`);
        layer.style.setProperty("--spx-venom-angle",`${angle}deg`);
        layer.innerHTML=`
            <div class="spx-venom-feast-flash"></div>
            <div class="spx-venom-tendril-beam"></div>
            <img class="spx-venom-bite spx-venom-bite-own" src="draft-assets/venombite.png" alt="">
            <img class="spx-venom-bite spx-venom-bite-target" src="draft-assets/venombite.png" alt="">
            <div class="spx-venom-feast-label">
                <strong>WE ARE VENOM</strong>
                <span>${escapeText(result.combinedPower)} ŁĄCZNEJ SIŁY</span>
            </div>
        `;
        layer.hidden=false;
        clearTimeout(playVenomFeastAnimation.timer);
        playVenomFeastAnimation.timer=setTimeout(()=>{
            layer.hidden=true;
            layer.innerHTML="";
            onComplete?.();
        },1550);
    }

    function confirmVenomFeast(){
        if(
            !state.active ||
            state.powerId!=="venom" ||
            state.venomResolving ||
            !state.venomOwnerReplacementName ||
            !state.venomOpponentReplacementName
        ) return;

        state.venomResolving=true;
        updateVenomChoiceStatus();
        const sourceElement=getDeckCardElement(state.playerIndex,state.sourceCardIndex);
        const targetElement=getDeckCardElement(state.targetPlayerIndex,state.targetCardIndex);
        const sourceRect=sourceElement?.getBoundingClientRect?.();
        const targetRect=targetElement?.getBoundingClientRect?.();
        const result=adapter.commitVenomFeast?.({
            playerName:state.playerName,
            ownerReplacementName:state.venomOwnerReplacementName,
            opponentReplacementName:state.venomOpponentReplacementName
        });
        if(!result?.ok){
            state.venomResolving=false;
            updateVenomChoiceStatus();
            showToast("SYMBIONT ODRZUCIŁ WYBÓR",result?.message||"Nie udało się pożreć kart.");
            return;
        }

        const overlay=document.getElementById("spxVenomOverlay");
        const hud=document.getElementById("spxVenomHud");
        if(overlay) overlay.hidden=true;
        if(hud) hud.hidden=true;
        document.body.classList.add("spx-venom-animating");
        playVenomFeastAnimation(sourceRect,targetRect,result,()=>{
            cancel({silent:true,refresh:false,force:true});
            adapter.refreshDecks?.();
            const finish=()=>showEventToast(
                "SYMBIOTYCZNE POŻARCIE",
                `${result.consumedOwnCard.name} + ${result.consumedOpponentCard.name} → `+
                `${result.ownerReplacement.name}. ${result.targetOwner} otrzymuje `+
                `${result.opponentReplacement.name}.`
            );
            if(result.counterattack?.triggered){
                playCaptainAmericaRicochet(result.counterattack,finish);
            }else{
                finish();
            }
        });
    }

    function getHulkEligibleOpponentIndices(){
        const decks=adapter?.getDecks?.()||[];
        return decks
            .map((deck,index)=>({deck,index}))
            .filter(entry=>
                entry.index!==state.playerIndex &&
                Array.isArray(entry.deck) &&
                entry.deck.some((card,cardIndex)=>
                    card && (
                        adapter.canHulkDestroyTarget
                            ? adapter.canHulkDestroyTarget(state.playerIndex,entry.index,cardIndex)
                            : adapter.canSuperpowerTargetDeckCard?.({
                                actorPlayerIndex:state.playerIndex,targetPlayerIndex:entry.index,
                                targetCardIndex:cardIndex,effect:"destroy"
                            })!==false
                    )
                ) &&
                !state.hulkTargetPlayerIndices.has(entry.index)
            )
            .map(entry=>entry.index);
    }

    function startHulk(playerName){
        if(!adapter.isDraftActive?.()){
            showToast("SMASH ZABLOKOWANY","Supermocy można użyć podczas aktywnego draftu.");
            return false;
        }

        const assignment=adapter.getAssignment?.(playerName);
        if(!assignment || assignment.powerId!=="hulk"){
            showToast("BŁĄD PRZYPISANIA","Ten gracz nie posiada Supermocy Hulka.");
            return false;
        }
        if(assignment.used){
            showToast("HULK JUŻ UDERZYŁ","HULK SMASH! został już wykorzystany.");
            return false;
        }

        const players=adapter.getPlayers?.()||[];
        const decks=adapter.getDecks?.()||[];
        const playerIndex=players.indexOf(playerName);
        if(playerIndex<0) return false;

        const eligibleOpponents=decks.filter((deck,index)=>
            index!==playerIndex &&
            Array.isArray(deck) &&
            deck.some((card,cardIndex)=>
                card && (
                    adapter.canHulkDestroyTarget
                        ? adapter.canHulkDestroyTarget(playerIndex,index,cardIndex)
                        : adapter.canSuperpowerTargetDeckCard?.({
                            actorPlayerIndex:playerIndex,targetPlayerIndex:index,
                            targetCardIndex:cardIndex,effect:"destroy"
                        })!==false
                )
            )
        ).length;
        if(!eligibleOpponents){
            showToast(
                "BRAK CELÓW DLA HULKA",
                "Żaden przeciwnik nie ma jeszcze karty, którą Hulk mógłby zmiażdżyć."
            );
            return false;
        }

        cancel({silent:true,refresh:false,force:true});
        state.active=true;
        state.powerId="hulk";
        state.playerName=playerName;
        state.playerIndex=playerIndex;
        state.targetPlayerIndex=-1;
        state.targetCardIndex=-1;
        state.hulkExpectedHits=Math.min(2,eligibleOpponents);
        state.hulkHitResults=[];
        state.hulkTargetPlayerIndices=new Set();
        state.hulkPendingTarget=null;
        state.hulkResolving=false;

        document.body.classList.add("spx-hulk-selecting");
        const hud=document.getElementById("spxHulkHud");
        if(hud) hud.hidden=false;
        setHulkHudMessage(
            state.hulkExpectedHits===2
                ? `${playerName}: wybierz pierwszą kartę przeciwnika do zmiażdżenia.`
                : `${playerName}: wybierz kartę przeciwnika do zmiażdżenia.`
        );
        adapter.refreshDecks?.();
        return true;
    }

    function decorateHulkCards(){
        const eligiblePlayers=new Set(getHulkEligibleOpponentIndices());

        document.querySelectorAll(".card[data-player-index]").forEach(cardElement=>{
            const playerIndex=Number(cardElement.dataset.playerIndex);
            const cardIndex=Number(cardElement.dataset.cardIndex);
            cardElement.classList.remove(
                "spx-hulk-eligible",
                "spx-hulk-ineligible",
                "spx-hulk-locked-owner"
            );

            const targetable=eligiblePlayers.has(playerIndex) && (
                adapter.canHulkDestroyTarget
                    ? adapter.canHulkDestroyTarget(state.playerIndex,playerIndex,cardIndex)
                    : adapter.canSuperpowerTargetDeckCard?.({
                        actorPlayerIndex:state.playerIndex,targetPlayerIndex:playerIndex,
                        targetCardIndex:cardIndex,effect:"destroy"
                    })!==false
            );
            if(targetable){
                cardElement.classList.add("spx-hulk-eligible");
                cardElement.title="HULK: zmiażdż tę kartę";
            }else{
                cardElement.classList.add("spx-hulk-ineligible");
                if(state.hulkTargetPlayerIndices.has(playerIndex)){
                    cardElement.classList.add("spx-hulk-locked-owner");
                    cardElement.title="Hulk uderzył już kartę tego przeciwnika";
                }
            }
        });
    }

    function handleHulkDeckCardClick(playerIndex,cardIndex){
        if(state.hulkResolving) return true;

        const eligiblePlayers=new Set(getHulkEligibleOpponentIndices());
        const card=(adapter?.getDecks?.()||[])[playerIndex]?.[cardIndex];
        const targetable=eligiblePlayers.has(playerIndex) &&
            card &&
            adapter.canSuperpowerTargetDeckCard?.({
                actorPlayerIndex:state.playerIndex,
                targetPlayerIndex:playerIndex,
                targetCardIndex:cardIndex,
                effect:"destroy"
            })!==false;
        if(!targetable){
            setHulkHudMessage(
                state.hulkTargetPlayerIndices.has(playerIndex)
                    ? "Drugi cios musi trafić kartę innego przeciwnika."
                    : "Wybierz kartę z podświetlonego decku przeciwnika."
            );
            return true;
        }

        state.targetPlayerIndex=playerIndex;
        state.targetCardIndex=cardIndex;
        state.hulkPendingTarget={playerIndex,cardIndex,card};
        openHulkConfirmation();
        return true;
    }

    function openHulkConfirmation(){
        const players=adapter?.getPlayers?.()||[];
        const target=state.hulkPendingTarget;
        const overlay=document.getElementById("spxHulkConfirmOverlay");
        const lead=document.getElementById("spxHulkLead");
        const targetCard=document.getElementById("spxHulkTargetCard");
        if(!target?.card || !overlay || !lead || !targetCard) return;

        const hitNumber=state.hulkHitResults.length+1;
        lead.textContent=`Cios #${hitNumber}: karta gracza ${players[target.playerIndex]}.`;
        targetCard.dataset.cardName=target.card.name;
        targetCard.innerHTML=`
            <span>CEL UDERZENIA</span>
            <strong>${escapeText(target.card.name)}</strong>
            <b>${escapeText(target.card.cost)} COST / ${escapeText(target.card.power)} POWER</b>
            <small>${escapeText(players[target.playerIndex])}</small>
        `;
        overlay.hidden=false;
    }

    function backToHulkTargetSelection(){
        if(state.hulkResolving) return;
        const overlay=document.getElementById("spxHulkConfirmOverlay");
        if(overlay) overlay.hidden=true;
        state.targetPlayerIndex=-1;
        state.targetCardIndex=-1;
        state.hulkPendingTarget=null;
        setHulkHudMessage(
            state.hulkHitResults.length
                ? "Pierwszy cios wykonany. Wybierz kartę innego przeciwnika."
                : "Wybierz kartę przeciwnika do zmiażdżenia."
        );
    }

    function playHulkSmash(targetRect,onComplete){
        const layer=document.getElementById("spxHulkImpactLayer");
        if(!layer || !targetRect){
            onComplete?.();
            return;
        }

        const centerX=targetRect.left+targetRect.width/2;
        const centerY=targetRect.top+targetRect.height/2;
        layer.innerHTML=`
            <div class="spx-hulk-falling-fist">
                <img src="draft-assets/hulkpowers.png" alt="">
                <span aria-hidden="true">👊</span>
            </div>
            <div class="spx-hulk-impact-flash"></div>
            <div class="spx-hulk-impact-cracks"></div>
            <div class="spx-hulk-rubble" aria-hidden="true">
                ${Array.from(
                    {length:14},
                    (_,index)=>`<i style="--spx-hulk-angle:${index*25.7}deg"></i>`
                ).join("")}
            </div>
        `;
        const image=layer.querySelector(".spx-hulk-falling-fist img");
        if(image){
            image.addEventListener("error",()=>{
                image.hidden=true;
                const fallback=image.nextElementSibling;
                if(fallback) fallback.hidden=false;
            },{once:true});
        }
        layer.style.setProperty("--spx-hulk-impact-x",`${centerX}px`);
        layer.style.setProperty("--spx-hulk-impact-y",`${centerY}px`);
        layer.style.setProperty("--spx-hulk-target-width",`${targetRect.width}px`);
        layer.style.setProperty("--spx-hulk-target-height",`${targetRect.height}px`);
        layer.hidden=false;

        clearTimeout(playHulkSmash.timer);
        playHulkSmash.timer=setTimeout(()=>{
            layer.hidden=true;
            layer.innerHTML="";
            onComplete?.();
        },1250);
    }

    function openHulkReplacementReveal(result){
        const overlay=document.getElementById("spxHulkRevealOverlay");
        const lead=document.getElementById("spxHulkRevealLead");
        const replacement=document.getElementById("spxHulkReplacement");
        const continueButton=document.getElementById("spxHulkContinue");
        if(!overlay || !lead || !replacement || !continueButton) return;

        lead.textContent=`${result.targetOwner} otrzymuje jedną automatycznie wylosowaną kartę.`;
        replacement.innerHTML=`
            <article class="spx-hulk-destroyed-card" data-card-name="${escapeText(result.destroyedCard?.name||"")}">
                <span>ZMIAŻDŻONA</span>
                <strong>${escapeText(result.destroyedCard?.name||"Karta")}</strong>
            </article>
            <div class="spx-hulk-replacement-arrow" aria-hidden="true">➜</div>
            <article class="spx-hulk-new-card" data-card-name="${escapeText(result.replacementCard?.name||"")}">
                <span>PRZELOSOWANA</span>
                <strong>${escapeText(result.replacementCard?.name||"Karta")}</strong>
                <b>${escapeText(result.replacementCard?.cost)} COST / ${escapeText(result.replacementCard?.power)} POWER</b>
            </article>
        `;
        continueButton.textContent=result.complete ? "ZAKOŃCZ HULK SMASH" : "DRUGI CIOS";
        overlay.hidden=false;
    }

    function confirmHulkHit(){
        if(
            !state.active ||
            state.powerId!=="hulk" ||
            state.hulkResolving ||
            !state.hulkPendingTarget
        ) return;

        const target=state.hulkPendingTarget;
        const targetElement=getDeckCardElement(target.playerIndex,target.cardIndex);
        const targetRect=targetElement?.getBoundingClientRect?.();
        state.hulkResolving=true;

        const result=adapter.commitHulkHit?.({
            playerName:state.playerName,
            playerIndex:state.playerIndex,
            targetPlayerIndex:target.playerIndex,
            targetCardIndex:target.cardIndex,
            expectedHits:state.hulkExpectedHits
        });

        if(!result?.ok){
            state.hulkResolving=false;
            showToast("SMASH PRZERWANY",result?.message||"Nie udało się zmiażdżyć karty.");
            return;
        }

        const confirmOverlay=document.getElementById("spxHulkConfirmOverlay");
        if(confirmOverlay) confirmOverlay.hidden=true;
        state.hulkHitResults.push(result);
        state.hulkTargetPlayerIndices.add(target.playerIndex);
        state.hulkPendingTarget=null;
        document.body.classList.add("spx-hulk-animating");

        playHulkSmash(targetRect,()=>{
            state.hulkResolving=false;
            document.body.classList.remove("spx-hulk-animating");
            adapter.refreshDecks?.();
            openHulkReplacementReveal(result);
        });
    }

    function continueHulkSequence(){
        const revealOverlay=document.getElementById("spxHulkRevealOverlay");
        if(revealOverlay) revealOverlay.hidden=true;
        const lastResult=state.hulkHitResults[state.hulkHitResults.length-1];

        if(lastResult?.complete || state.hulkHitResults.length>=state.hulkExpectedHits){
            const summary=state.hulkHitResults
                .map(hit=>`${hit.destroyedCard?.name||"karta"} → ${hit.replacementCard?.name||"karta"}`)
                .join("; ");
            playCaptainAmericaRicochets(
                lastResult.counterattacks||[lastResult.counterattack],
                ()=>{
                    cancel({silent:true,refresh:false,force:true});
                    adapter.refreshDecks?.();
                    showEventToast("HULK SMASH ZAKOŃCZONY",summary);
                }
            );
            return;
        }

        state.targetPlayerIndex=-1;
        state.targetCardIndex=-1;
        setHulkHudMessage("Pierwszy cios wykonany. Wybierz kartę innego przeciwnika.");
        adapter.refreshDecks?.();
    }

    function getCyclopsCardTagText(card){
        const tags=getCyclopsEligibleTags(card);
        if(tags.length){
            return tags.map(formatTagLabel).join(" • ");
        }
        const power=getPowerValue(card);
        return `TA SAMA SIŁA: ${power===null ? "?" : power}`;
    }

    function startCyclops(playerName){
        if(!adapter.isDraftActive?.()){
            showToast("CEREBRO OFFLINE","Supermocy można użyć podczas aktywnego draftu.");
            return false;
        }

        const assignment=adapter.getAssignment?.(playerName);
        if(!assignment || assignment.powerId!=="cyclops"){
            showToast("BŁĄD PRZYPISANIA","Ten gracz nie posiada Supermocy Cyclopsa.");
            return false;
        }
        if(assignment.used){
            showToast("DRUŻYNA JUŻ WEZWANA","Cyclops wykorzystał już DO MNIE, MOJA DRUŻYNO!.");
            return false;
        }

        const players=adapter.getPlayers?.()||[];
        const playerIndex=players.indexOf(playerName);
        if(playerIndex<0) return false;
        const deck=(adapter.getDecks?.()||[])[playerIndex]||[];
        if(deck.length<6){
            showToast("DRUŻYNA JESZCZE NIEGOTOWA","Cyclops potrzebuje co najmniej 6 kart w decku.");
            return false;
        }

        const anchorOptions=buildCyclopsAnchorOptions(playerIndex);
        if(!anchorOptions.size){
            showToast(
                "BRAK DOSTĘPNEJ SYNERGII",
                "Żadna karta-Kapitan nie pozwala obecnie zaplanować dwóch dostępnych wymian."
            );
            return false;
        }

        cancel({silent:true,refresh:false});
        state.active=true;
        state.powerId="cyclops";
        state.playerName=playerName;
        state.playerIndex=playerIndex;
        state.cyclopsAnchorIndex=-1;
        state.cyclopsAnchorOptions=anchorOptions;
        state.cyclopsMode=null;
        state.cyclopsPlannedSwaps=[];
        state.cyclopsPendingTargetIndex=-1;
        state.cyclopsSelectedReplacementName="";

        document.body.classList.add("spx-cyclops-selecting-anchor");
        const hud=document.getElementById("spxCyclopsHud");
        if(hud) hud.hidden=false;
        setCyclopsHudMessage("🔴 WYBIERZ KAPITANA DRUŻYNY");
        adapter.refreshDecks?.();
        return true;
    }

    function openCyclopsTagPanel(anchorIndex){
        const deck=(adapter?.getDecks?.()||[])[state.playerIndex]||[];
        const anchor=deck[anchorIndex];
        const modes=state.cyclopsAnchorOptions.get(anchorIndex)||[];
        const overlay=document.getElementById("spxCyclopsTagOverlay");
        const lead=document.getElementById("spxCyclopsTagLead");
        const cardBox=document.getElementById("spxCyclopsAnchorCard");
        const choices=document.getElementById("spxCyclopsTagChoices");
        const hint=document.getElementById("spxCyclopsTagHint");
        const confirm=document.getElementById("spxCyclopsTagConfirm");
        if(!anchor || !overlay || !lead || !cardBox || !choices || !hint || !confirm) return;

        state.cyclopsAnchorIndex=anchorIndex;
        state.cyclopsMode=null;
        lead.textContent=`${state.playerName}, wybierz synergię, którą Cyclops przywoła do drużyny.`;
        cardBox.dataset.cardName=anchor.name;
        cardBox.innerHTML=`
            <span>KAPITAN DRUŻYNY</span>
            <strong>${escapeText(anchor.name)}</strong>
            <b>${escapeText(anchor.cost)} COST / ${escapeText(anchor.power)} POWER</b>
            <small>${escapeText(getCyclopsCardTagText(anchor))}</small>
        `;

        choices.innerHTML="";
        modes.forEach(mode=>{
            const button=document.createElement("button");
            button.type="button";
            button.className="spx-cyclops-tag-btn";
            button.disabled=!mode.usable;
            button.innerHTML=`
                <span>${mode.type==="tag" ? "SYNERGIA KAPITANA" : "TA SAMA SIŁA"}</span>
                <strong>${escapeText(mode.label)}</strong>
                <small>${mode.usable ? "Dostępne dwie wymiany" : "Brak dwóch dostępnych wymian"}</small>
            `;
            button.addEventListener("click",()=>{
                if(!mode.usable) return;
                state.cyclopsMode={...mode};
                choices.querySelectorAll(".spx-cyclops-tag-btn").forEach(item=>{
                    item.classList.toggle("spx-cyclops-selected",item===button);
                });
                confirm.disabled=false;
                hint.textContent=mode.type==="tag"
                    ? `Obie nowe karty będą posiadały tag ${mode.label}.`
                    : `Obie nowe karty będą miały dokładnie ${mode.value} Siły.`;
            });
            choices.appendChild(button);
        });

        confirm.disabled=true;
        hint.textContent="Wybierz jedną dostępną ścieżkę synergii.";
        overlay.hidden=false;
    }

    function backToCyclopsAnchorSelection(){
        const overlay=document.getElementById("spxCyclopsTagOverlay");
        if(overlay) overlay.hidden=true;
        state.cyclopsAnchorIndex=-1;
        state.cyclopsMode=null;
        setCyclopsHudMessage("🔴 WYBIERZ KAPITANA DRUŻYNY");
        adapter.refreshDecks?.();
    }

    function confirmCyclopsMode(){
        if(
            !state.active ||
            state.powerId!=="cyclops" ||
            state.cyclopsAnchorIndex<0 ||
            !state.cyclopsMode ||
            !state.cyclopsMode.usable
        ) return;

        const overlay=document.getElementById("spxCyclopsTagOverlay");
        if(overlay) overlay.hidden=true;
        document.body.classList.remove("spx-cyclops-selecting-anchor");
        document.body.classList.add("spx-cyclops-selecting-target");
        state.cyclopsPlannedSwaps=[];
        state.cyclopsPendingTargetIndex=-1;
        state.cyclopsSelectedReplacementName="";
        setCyclopsHudMessage(
            "WYBIERZ PIERWSZEGO CZŁONKA DO WYMIANY"
        );
        adapter.refreshDecks?.();
    }

    function getSafeCyclopsCandidates(targetCardIndex){
        const candidates=getCyclopsReplacementCandidates(
            state.playerIndex,
            state.cyclopsAnchorIndex,
            targetCardIndex,
            state.cyclopsMode,
            state.cyclopsPlannedSwaps
        );
        if(state.cyclopsPlannedSwaps.length>0) return candidates;

        return candidates.filter(replacementCard=>{
            const planned=[{targetCardIndex,replacementCard}];
            return getCyclopsTargetCandidates(
                state.playerIndex,
                state.cyclopsAnchorIndex,
                state.cyclopsMode,
                planned
            ).size>0;
        });
    }

    function openCyclopsCandidatePanel(targetCardIndex){
        const deck=(adapter?.getDecks?.()||[])[state.playerIndex]||[];
        const target=deck[targetCardIndex];
        const candidates=getSafeCyclopsCandidates(targetCardIndex);
        const overlay=document.getElementById("spxCyclopsCandidateOverlay");
        const step=document.getElementById("spxCyclopsCandidateStep");
        const lead=document.getElementById("spxCyclopsCandidateLead");
        const targetBox=document.getElementById("spxCyclopsTargetCard");
        const container=document.getElementById("spxCyclopsCandidates");
        const choice=document.getElementById("spxCyclopsCandidateChoice");
        const confirm=document.getElementById("spxCyclopsCandidateConfirm");
        if(!target || !candidates.length || !overlay || !step || !lead || !targetBox || !container || !choice || !confirm){
            setCyclopsHudMessage("Ta karta nie ma dostępnego zamiennika dla wybranej synergii.");
            return;
        }

        state.cyclopsPendingTargetIndex=targetCardIndex;
        state.cyclopsSelectedReplacementName="";
        const randomSlot=state.cyclopsPlannedSwaps.length===1;
        step.textContent=randomSlot ? "🔴 CYCLOPS WSKAZUJE DRUGI CEL" : "TWÓJ PIERWSZY WYBÓR";
        lead.textContent=randomSlot
            ? `${target.name}. Wybierz dla niej nowego członka drużyny.`
            : `Wybierz zamiennik z synergii ${state.cyclopsMode.label}.`;
        targetBox.dataset.cardName=target.name;
        targetBox.innerHTML=`
            <span>KARTA DO WYMIANY</span>
            <strong>${escapeText(target.name)}</strong>
            <b>${escapeText(target.cost)} COST / ${escapeText(target.power)} POWER</b>
        `;
        container.innerHTML="";

        candidates.forEach(candidate=>{
            const button=document.createElement("button");
            button.type="button";
            button.className="spx-cyclops-candidate";
            button.dataset.cardName=candidate.name;
            button.innerHTML=`
                <span>NOWY CZŁONEK DRUŻYNY</span>
                <strong>${escapeText(candidate.name)}</strong>
                <small>${escapeText(getCyclopsCardTagText(candidate))}</small>
                <b>${escapeText(candidate.cost)} COST / ${escapeText(candidate.power)} POWER</b>
            `;
            button.addEventListener("click",()=>{
                state.cyclopsSelectedReplacementName=candidate.name;
                container.querySelectorAll(".spx-cyclops-candidate").forEach(item=>{
                    item.classList.toggle("spx-cyclops-selected",item===button);
                });
                choice.innerHTML=`DOŁĄCZA DO DRUŻYNY: <strong>${escapeText(candidate.name)}</strong>`;
                confirm.disabled=false;
            });
            container.appendChild(button);
        });

        choice.textContent="Wybierz kartę z drużyny.";
        confirm.disabled=true;
        overlay.hidden=false;
    }

    function backToCyclopsTargetSelection(){
        const overlay=document.getElementById("spxCyclopsCandidateOverlay");
        if(overlay) overlay.hidden=true;
        if(state.cyclopsPlannedSwaps.length===1){
            state.cyclopsPlannedSwaps.pop();
            state.cyclopsPendingTargetIndex=-1;
            state.cyclopsSelectedReplacementName="";
            setCyclopsHudMessage("Plan cofnięty. Wybierz ponownie jedną własną kartę do wymiany.");
            adapter.refreshDecks?.();
            return;
        }
        state.cyclopsPendingTargetIndex=-1;
        state.cyclopsSelectedReplacementName="";
        setCyclopsHudMessage(
            state.cyclopsPlannedSwaps.length
                ? `Pierwszy członek gotowy. Wybierz drugą kartę do wymiany.`
                : `Synergia ${state.cyclopsMode?.label||""}: wybierz pierwszą kartę do wymiany.`
        );
    }

    function confirmCyclopsReplacementSelection(){
        if(
            !state.active ||
            state.powerId!=="cyclops" ||
            state.cyclopsPendingTargetIndex<0 ||
            !state.cyclopsSelectedReplacementName
        ) return;

        const candidates=getSafeCyclopsCandidates(state.cyclopsPendingTargetIndex);
        const replacementCard=candidates.find(
            card=>card?.name===state.cyclopsSelectedReplacementName
        );
        const originalCard=(adapter?.getDecks?.()||[])[state.playerIndex]?.[
            state.cyclopsPendingTargetIndex
        ];
        if(!replacementCard || !originalCard){
            showToast("CEL UTRACONY","Wybrana karta nie jest już dostępnym celem.");
            return;
        }

        state.cyclopsPlannedSwaps.push({
            targetCardIndex:state.cyclopsPendingTargetIndex,
            originalCard,
            replacementCard,
            selectionType:state.cyclopsPlannedSwaps.length===0 ? "chosen" : "random"
        });
        const overlay=document.getElementById("spxCyclopsCandidateOverlay");
        if(overlay) overlay.hidden=true;
        state.cyclopsPendingTargetIndex=-1;
        state.cyclopsSelectedReplacementName="";

        if(state.cyclopsPlannedSwaps.length>=2){
            openCyclopsFinalPanel();
            return;
        }

        const randomTargets=[...getCyclopsTargetCandidates(
            state.playerIndex,
            state.cyclopsAnchorIndex,
            state.cyclopsMode,
            state.cyclopsPlannedSwaps
        ).keys()];
        if(!randomTargets.length){
            state.cyclopsPlannedSwaps.pop();
            setCyclopsHudMessage("Ta kombinacja nie pozostawia losowej drugiej ofiary. Wybierz inną kartę.");
            adapter.refreshDecks?.();
            return;
        }
        const randomTargetIndex=randomTargets[Math.floor(Math.random()*randomTargets.length)];
        setCyclopsHudMessage("🔴 CYCLOPS WSKAZUJE DRUGI CEL");
        adapter.refreshDecks?.();
        openCyclopsCandidatePanel(randomTargetIndex);
    }

    function openCyclopsFinalPanel(){
        const overlay=document.getElementById("spxCyclopsFinalOverlay");
        const summary=document.getElementById("spxCyclopsFinalSummary");
        if(!overlay || !summary) return;

        summary.innerHTML=state.cyclopsPlannedSwaps.map((swap,index)=>`
            <article>
                <span>${swap.selectionType==="random" ? "CEL WSKAZANY PRZEZ CYCLOPSA" : "TWÓJ WYBÓR"}</span>
                <div>
                    <strong data-card-name="${escapeText(swap.originalCard?.name||"")}">${escapeText(swap.originalCard?.name||"Karta")}<small>WRACA DO X-MANSION</small></strong>
                    <i aria-hidden="true">→</i>
                    <strong data-card-name="${escapeText(swap.replacementCard?.name||"")}">${escapeText(swap.replacementCard?.name||"Karta")}</strong>
                </div>
            </article>
        `).join("");
        overlay.hidden=false;
    }

    function backFromCyclopsFinal(){
        const overlay=document.getElementById("spxCyclopsFinalOverlay");
        if(overlay) overlay.hidden=true;
        state.cyclopsPlannedSwaps=[];
        setCyclopsHudMessage("Plan cofnięty. Wybierz ponownie jedną własną kartę do wymiany.");
        adapter.refreshDecks?.();
    }

    function confirmCyclopsTeamCall(){
        if(
            !state.active ||
            state.powerId!=="cyclops" ||
            state.cyclopsPlannedSwaps.length!==2
        ) return;

        const result=adapter.commitCyclopsTeamCall?.({
            playerName:state.playerName,
            playerIndex:state.playerIndex,
            anchorCardIndex:state.cyclopsAnchorIndex,
            mode:{
                type:state.cyclopsMode.type,
                value:state.cyclopsMode.value,
                label:state.cyclopsMode.label
            },
            swaps:state.cyclopsPlannedSwaps.map(swap=>({
                targetCardIndex:swap.targetCardIndex,
                replacementName:swap.replacementCard.name,
                selectionType:swap.selectionType
            }))
        });

        if(!result?.ok){
            showToast("DRUŻYNA NIE ODPOWIADA",result?.message||"Nie udało się wykonać obu wymian.");
            return;
        }

        const summary=(result.swaps||[])
            .map(swap=>`${swap.removedCard?.name||"karta"} → ${swap.addedCard?.name||"karta"}`)
            .join("; ");
        const returned=(result.swaps||[]).map(swap=>swap.removedCard?.name).filter(Boolean).join(" i ");
        cancel({silent:true,refresh:false});
        adapter.refreshDecks?.();
        showEventToast("DRUŻYNA PRZYBYŁA",`${summary}. ${returned||"Wybrane karty"} wracają do X-Mansion.`);
    }

    function decorateCyclopsCards(){
        const deck=(adapter?.getDecks?.()||[])[state.playerIndex]||[];
        const plannedByIndex=new Map(
            state.cyclopsPlannedSwaps.map(swap=>[swap.targetCardIndex,swap])
        );
        const targetCandidates=state.cyclopsMode
            ? getCyclopsTargetCandidates(
                state.playerIndex,
                state.cyclopsAnchorIndex,
                state.cyclopsMode,
                state.cyclopsPlannedSwaps
            )
            : new Map();

        document.querySelectorAll(".card[data-player-index]").forEach(cardElement=>{
            const playerIndex=Number(cardElement.dataset.playerIndex);
            const cardIndex=Number(cardElement.dataset.cardIndex);
            const card=(adapter?.getDecks?.()||[])[playerIndex]?.[cardIndex];
            cardElement.classList.remove(
                "spx-cyclops-anchor-eligible",
                "spx-cyclops-anchor-locked",
                "spx-cyclops-target-eligible",
                "spx-cyclops-target-locked",
                "spx-cyclops-ineligible"
            );
            cardElement.removeAttribute("data-cyclops-tags");
            cardElement.removeAttribute("data-cyclops-replacement");

            if(playerIndex!==state.playerIndex){
                cardElement.classList.add("spx-cyclops-ineligible");
                return;
            }

            if(!state.cyclopsMode){
                const modes=state.cyclopsAnchorOptions.get(cardIndex);
                if(modes){
                    cardElement.classList.add("spx-cyclops-anchor-eligible");
                    cardElement.dataset.cyclopsTags=getCyclopsCardTagText(card);
                    cardElement.title="CYCLOPS: kliknij, aby wybrać kapitana drużyny";
                }else{
                    cardElement.classList.add("spx-cyclops-ineligible");
                }
                return;
            }

            if(cardIndex===state.cyclopsAnchorIndex){
                cardElement.classList.add("spx-cyclops-anchor-locked");
                cardElement.dataset.cyclopsTags=`KAPITAN: ${state.cyclopsMode.label}`;
                return;
            }

            const planned=plannedByIndex.get(cardIndex);
            if(planned){
                cardElement.classList.add("spx-cyclops-target-locked");
                cardElement.dataset.cyclopsReplacement=planned.replacementCard?.name||"";
                return;
            }

            const candidates=targetCandidates.get(cardIndex)||[];
            const safeCandidates=getSafeCyclopsCandidates(cardIndex);
            if(candidates.length && safeCandidates.length){
                cardElement.classList.add("spx-cyclops-target-eligible");
                cardElement.title=`CYCLOPS: ${safeCandidates.length} dostępnych kart z synergii ${state.cyclopsMode.label}`;
            }else{
                cardElement.classList.add("spx-cyclops-ineligible");
            }
        });
    }

    function handleCyclopsDeckCardClick(playerIndex,cardIndex){
        if(playerIndex!==state.playerIndex){
            setCyclopsHudMessage(`Wybierz kartę z decku gracza ${state.playerName}.`);
            return true;
        }

        if(!state.cyclopsMode){
            if(!state.cyclopsAnchorOptions.has(cardIndex)){
                setCyclopsHudMessage("Ta karta nie zapewnia dwóch dostępnych wymian synergii.");
                return true;
            }
            openCyclopsTagPanel(cardIndex);
            return true;
        }

        if(cardIndex===state.cyclopsAnchorIndex){
            setCyclopsHudMessage("Kapitan prowadzi drużynę i nie może zostać wymieniony.");
            return true;
        }
        if(state.cyclopsPlannedSwaps.some(swap=>swap.targetCardIndex===cardIndex)){
            setCyclopsHudMessage("Ta karta jest już zaplanowana do wymiany.");
            return true;
        }

        const candidates=getSafeCyclopsCandidates(cardIndex);
        if(!candidates.length){
            setCyclopsHudMessage("Ta karta nie ma dostępnego zamiennika dla wybranej synergii.");
            return true;
        }
        openCyclopsCandidatePanel(cardIndex);
        return true;
    }

    function renderProfessorXTargets(){
        const container=document.getElementById("spxProfessorXTargets");
        const selection=document.getElementById("spxProfessorXSelection");
        const confirm=document.getElementById("spxProfessorXConfirm");
        const players=adapter?.getPlayers?.()||[];
        const blocked=new Set(adapter?.getProfessorXControlledTargetIndices?.()||[]);
        const hasFuturePick=index=>adapter?.hasProfessorXFuturePick?.(index)!==false;
        if(!container || !selection || !confirm) return;

        container.innerHTML="";
        players.forEach((name,index)=>{
            if(index===state.playerIndex) return;
            const isBlocked=blocked.has(index)||!hasFuturePick(index);
            const isSelected=state.professorXTargetIndices.has(index);
            const button=document.createElement("button");
            button.type="button";
            button.className="spx-professorx-target";
            button.classList.toggle("spx-is-selected",isSelected);
            button.classList.toggle("spx-is-blocked",isBlocked);
            button.disabled=isBlocked;
            button.dataset.playerIndex=String(index);
            button.innerHTML=`
                <span class="spx-professorx-target-signal" aria-hidden="true"></span>
                <strong>${escapeText(name)}</strong>
                <small>${isBlocked ? "UMYSŁ JUŻ KONTROLOWANY" : isSelected ? "ŁĄCZE GOTOWE" : "WYBIERZ CEL"}</small>
            `;
            button.addEventListener("click",()=>{
                if(state.professorXTargetIndices.has(index)){
                    state.professorXTargetIndices.delete(index);
                }else if(state.professorXTargetIndices.size<state.professorXRequiredTargetCount){
                    state.professorXTargetIndices.add(index);
                }else{
                    showToast("ŁĄCZE CEREBRO JEST PEŁNE","Najpierw odznacz jednego z wybranych przeciwników.");
                    return;
                }
                renderProfessorXTargets();
            });
            container.appendChild(button);
        });

        const count=state.professorXTargetIndices.size;
        const required=state.professorXRequiredTargetCount;
        selection.textContent=count===required
            ? `CEREBRO • ŁĄCZE GOTOWE ${count}/${required}`
            : `CEREBRO • WYBRANO ${count}/${required}`;
        confirm.disabled=count!==required;
    }

    function startProfessorX(playerName){
        if(!adapter?.isDraftActive?.()){
            showToast("CEREBRO POZA ZASIĘGIEM","Supermocy można użyć podczas aktywnego draftu.");
            return false;
        }

        const assignment=adapter.getAssignment?.(playerName);
        if(!assignment || assignment.powerId!=="professor_x"){
            showToast("BŁĄD PRZYPISANIA","Ten gracz nie posiada Supermocy Profesora X.");
            return false;
        }
        if(assignment.used){
            showToast("ŁĄCZE WYGASŁO","Professor X wykorzystał już KONTROLĘ UMYSŁU.");
            return false;
        }

        const players=adapter.getPlayers?.()||[];
        const playerIndex=players.indexOf(playerName);
        const blocked=new Set(adapter?.getProfessorXControlledTargetIndices?.()||[]);
        const hasFuturePick=index=>adapter?.hasProfessorXFuturePick?.(index)!==false;
        const legalTargets=players
            .map((name,index)=>({name,index}))
            .filter(entry=>entry.index!==playerIndex && !blocked.has(entry.index) && hasFuturePick(entry.index));
        if(playerIndex<0){
            showToast("CEREBRO NIE ODNAJDUJE PROFESORA","Nie udało się rozpoznać właściciela tej Supermocy.");
            return false;
        }
        if(legalTargets.length<1){
            showToast(
                "BRAK WOLNYCH UMYSŁÓW",
                "Żaden wolny przeciwnik nie ma już przyszłego picka, który Xavier mógłby przejąć."
            );
            return false;
        }

        cancel({silent:true,refresh:false});
        state.active=true;
        state.powerId="professor_x";
        state.playerName=playerName;
        state.playerIndex=playerIndex;
        state.professorXTargetIndices=new Set();
        state.professorXRequiredTargetCount=Math.min(2,legalTargets.length);

        const overlay=document.getElementById("spxProfessorXOverlay");
        const lead=document.getElementById("spxProfessorXLead");
        if(lead){
            lead.textContent=state.professorXRequiredTargetCount===1
                ? "Pozostał jeden wolny umysł. Wybierz tego rywala, aby nawiązać kontrolę."
                : "Wybierz dwóch rywali, którzy nie są już pod czyjąś kontrolą.";
        }
        renderProfessorXTargets();
        if(overlay) overlay.hidden=false;
        document.body.classList.add("spx-professorx-selecting");
        return true;
    }

    function confirmProfessorXTargets(){
        if(
            !state.active ||
            state.powerId!=="professor_x" ||
            state.professorXTargetIndices.size!==state.professorXRequiredTargetCount
        ) return;

        const result=adapter?.commitProfessorXMindControl?.({
            playerName:state.playerName,
            playerIndex:state.playerIndex,
            targetPlayerIndices:[...state.professorXTargetIndices]
        });
        if(!result?.ok){
            showToast("PRZEKAZ MYŚLI PRZERWANY",result?.message||"Nie udało się połączyć z wybranymi umysłami.");
            return;
        }

        const targetNames=(result.controls||[]).map(control=>control.targetName).join(" i ");
        playCaptainAmericaRicochets(result.counterattacks,()=>{
            cancel({silent:true,refresh:false});
            adapter?.refreshDecks?.();
            adapter?.refreshQueue?.();
        showEventToast(
            "🧠 WYBÓR PRZEJMUJE: XAVIER",
            `${targetNames}: ich najbliższe wybory kontroluje ${result.controllerName}.`,
            {powerId:"professor_x"}
            );
        });
    }

    function playJeffWaveAnimation(done){
        const layer=document.getElementById("spxJeffSwimLayer");
        if(!layer){
            done?.();
            return;
        }
        layer.hidden=false;
        layer.classList.remove("spx-jeff-swimming");
        void layer.offsetWidth;
        layer.classList.add("spx-jeff-swimming");
        setTimeout(()=>{
            layer.classList.remove("spx-jeff-swimming");
            layer.hidden=true;
            done?.();
        },2100);
    }

    function playJeffPackReplacementAnimation(done){
        const cards=[...document.querySelectorAll("#pack [data-pack-index]")];
        if(!cards.length){
            done?.();
            return;
        }
        cards.forEach((card,index)=>{
            card.style.setProperty("--spx-jeff-reveal-delay",`${index*90}ms`);
            card.classList.remove("spx-jeff-pack-transformed");
            void card.offsetWidth;
            card.classList.add("spx-jeff-pack-transformed");
        });
        setTimeout(()=>{
            cards.forEach(card=>{
                card.classList.remove("spx-jeff-pack-transformed");
                card.style.removeProperty("--spx-jeff-reveal-delay");
            });
            done?.();
        },1050+cards.length*90);
    }

    function openJeffJokerChoices(result){
        const overlay=document.getElementById("spxJeffOverlay");
        const lead=document.getElementById("spxJeffLead");
        const info=document.getElementById("spxJeffJokerInfo");
        const container=document.getElementById("spxJeffCandidates");
        if(!overlay || !lead || !info || !container) return;

        lead.textContent=`${state.playerName}, Jeff zostawił Ci zamkniętego Jokera. Kliknij go, aby odkryć nagrodę.`;
        info.innerHTML=`
            <button id="spxJeffPrivateJoker" class="spx-jeff-private-joker" type="button">
                <span class="spx-jeff-joker-glitch" aria-hidden="true">JOKER</span>
                <img src="draft-assets/jeffpowerslogo.png" alt="" aria-hidden="true">
                <span>PRYWATNY JOKER JEFFA</span>
                <strong>KLIKNIJ, ABY OTWORZYĆ</strong>
                <small>${escapeText(String(result.personalJoker?.rarity||"epic").toUpperCase())}</small>
            </button>
        `;
        container.innerHTML="";
        container.hidden=true;
        state.jeffOptions.forEach(card=>{
            const button=document.createElement("button");
            button.type="button";
            button.className="spx-jeff-candidate";
            button.dataset.cardName=card.name;
            button.innerHTML=`
                <em>JOKEROWY WYBÓR</em>
                <span>${escapeText(card.cost)} COST</span>
                <strong>${escapeText(card.name)}</strong>
                <span>${escapeText(card.power)} POWER</span>
                <small>Nagroda z prywatnego Jokera Jeffa</small>
            `;
            button.addEventListener("click",()=>{
                state.jeffChosenCardName=card.name;
                overlay.hidden=true;
                const hud=document.getElementById("spxJeffHud");
                const hudText=document.getElementById("spxJeffHudText");
                if(hud) hud.hidden=false;
                if(hudText){
                    hudText.textContent=`${state.playerName}: wybierz własną kartę, którą zastąpi ${card.name}.`;
                }
                adapter?.refreshDecks?.();
            });
            container.appendChild(button);
        });
        const privateJoker=info.querySelector("#spxJeffPrivateJoker");
        privateJoker?.addEventListener("click",()=>{
            privateJoker.classList.add("spx-jeff-private-joker-open");
            setTimeout(()=>{
                info.innerHTML=`
                    <div class="spx-jeff-open-joker">
                        <em>JOKER ${escapeText(String(result.personalJoker?.rarity||"epic").toUpperCase())}</em>
                        <strong>${escapeText(result.personalJoker?.name||"Premium Joker")}</strong>
                        <small>${escapeText(result.personalJoker?.desc||"Wybierz jedną z odkrytych kart i wymień za nią kartę w swoim decku.")}</small>
                    </div>
                `;
                lead.textContent=`${state.playerName}, Joker otwarty — wybierz jedną z odkrytych kart.`;
                container.hidden=false;
            },520);
        },{once:true});
        overlay.hidden=false;
    }

    function startJeff(playerName){
        if(!adapter.isDraftActive?.()){
            showToast("JEFF JESZCZE ŚPI","Supermocy można użyć podczas aktywnego draftu.");
            return false;
        }
        if(!adapter.isPackInteractive?.()){
            showToast("FALA CZEKA",flowText("Otwórz aktualną paczkę, aby Jeff mógł przez nią przepłynąć.","Poczekaj na aktywny nurt, aby Jeff mógł przez niego przepłynąć."));
            return false;
        }
        const assignment=adapter.getAssignment?.(playerName);
        if(!assignment || assignment.powerId!=="jeff"){
            showToast("BŁĄD PRZYPISANIA","Ten gracz nie posiada JOKEROWEJ FALI.");
            return false;
        }
        if(assignment.used){
            showToast("FALA JUŻ ODPŁYNĘŁA","Jeff wykorzystał już JOKEROWĄ FALĘ.");
            return false;
        }
        const players=adapter.getPlayers?.()||[];
        const playerIndex=players.indexOf(playerName);
        if(playerIndex<0) return false;

        const result=adapter.prepareJeffJokerWave?.({playerName,playerIndex});
        if(!result?.ok){
            showToast("JEFF NIE WYPŁYNĄŁ",result?.message||"Nie udało się uruchomić Jokerowej Fali.");
            return false;
        }

        cancel({silent:true,refresh:false,force:true});
        state.active=true;
        state.powerId="jeff";
        state.playerName=playerName;
        state.playerIndex=playerIndex;
        state.jeffPersonalJoker=result.personalJoker;
        state.jeffOptions=[...(result.options||[])];
        state.jeffChosenCardName="";
        document.body.classList.add("spx-jeff-resolving");

        playJeffWaveAnimation(()=>{
            adapter?.refreshPack?.();
            playJeffPackReplacementAnimation(()=>{
                openJeffJokerChoices(result);
                showEventToast(
                    flowText("PACZKA ZALANA JOKERAMI","NURT ZALANY JOKERAMI"),
                    `Jeff zmienił ${result.transformedCount} kart w premium Jokery. Kliknij prywatnego Jokera, aby go otworzyć.`
                );
            });
        });
        return true;
    }

    function decorateJeffCards(){
        document.querySelectorAll(".card[data-player-index]").forEach(cardElement=>{
            const playerIndex=Number(cardElement.dataset.playerIndex);
            cardElement.classList.remove("spx-jeff-swap-target","spx-jeff-locked");
            if(playerIndex===state.playerIndex && state.jeffChosenCardName){
                cardElement.classList.add("spx-jeff-swap-target");
                cardElement.title=`JEFF: wymień tę kartę na ${state.jeffChosenCardName}`;
            }else{
                cardElement.classList.add("spx-jeff-locked");
            }
        });
    }

    function handleJeffDeckCardClick(playerIndex,cardIndex){
        if(playerIndex!==state.playerIndex){
            showToast("TO NIE DECK JEFFA",`Wybierz kartę z decku gracza ${state.playerName}.`);
            return true;
        }
        if(!state.jeffChosenCardName){
            showToast("NAJPIERW OTWÓRZ JOKERA","Wybierz jedną z kart pokazanych przez prywatnego Jokera Jeffa.");
            return true;
        }
        const result=adapter.commitJeffPersonalJokerSwap?.({
            playerName:state.playerName,
            playerIndex:state.playerIndex,
            sourceCardIndex:cardIndex,
            replacementName:state.jeffChosenCardName
        });
        if(!result?.ok){
            showToast("JOKER UTKNĄŁ",result?.message||"Nie udało się wymienić karty.");
            return true;
        }
        const removed=result.removedCard?.name||"karta";
        const added=result.addedCard?.name||state.jeffChosenCardName;
        cancel({silent:true,refresh:false,force:true});
        adapter?.refreshDecks?.();
        adapter?.refreshPack?.();
        showEventToast("JEFF ZOSTAWIŁ PREZENT",`${removed} → ${added}. JOKEROWA FALA zakończona!`);
        return true;
    }

    function startSpiderMan(playerName){
        if(!adapter.isDraftActive?.()){
            showToast("SIEĆ ZABLOKOWANA","Supermocy można użyć podczas aktywnego draftu.");
            return false;
        }
        if(!adapter.isPackInteractive?.()){
            showToast(flowText("PACZKA JESZCZE ZAMKNIĘTA","NURT JESZCZE NIEAKTYWNY"),flowText("Otwórz aktualną paczkę, aby Spider-Man mógł wystrzelić sieć.","Poczekaj na aktywny Gwiezdny Prąd, aby Spider-Man mógł wystrzelić sieć."));
            return false;
        }

        const assignment=adapter.getAssignment?.(playerName);
        if(!assignment || assignment.powerId!=="spider_man"){
            showToast("BŁĄD PRZYPISANIA","Ten gracz nie posiada Supermocy Spider-Mana.");
            return false;
        }
        if(assignment.used){
            showToast("SIEĆ WYKORZYSTANA","Spider-Man wykorzystał już PAJĘCZĄ SIEĆ.");
            return false;
        }

        const players=adapter.getPlayers?.()||[];
        const playerIndex=players.indexOf(playerName);
        if(playerIndex<0) return false;

        const nextTurnIndex=adapter.getNextTurnIndex?.(playerIndex);
        if(!Number.isInteger(nextTurnIndex) || nextTurnIndex<0){
            showToast(
                "ZA PÓŹNO NA SIEĆ",
                flowText("Ten gracz nie ma już kolejnej tury wyboru w aktualnej paczce.","Ten gracz nie ma już kolejnego wyboru w Gwiezdnym Prądzie.")
            );
            return false;
        }

        const candidates=adapter.getSpiderCandidates?.(playerIndex)||[];
        if(!candidates.length){
            showToast(
                "BRAK DOSTĘPNEGO CELU",
                flowText("Nie ma karty, którą można zarezerwować bez zablokowania bieżącego wyboru.","Nie ma karty, którą można bezpiecznie zakotwiczyć bez zablokowania nurtu.")
            );
            return false;
        }

        cancel({silent:true,refresh:false});
        state.active=true;
        state.powerId="spider_man";
        state.playerName=playerName;
        state.playerIndex=playerIndex;
        state.targetPackIndex=-1;
        state.spiderSelectedCards=new Set();
        state.spiderCandidateCards=new Set(candidates.map(entry=>entry.card));

        document.body.classList.add("spx-spider-selecting");
        const hud=document.getElementById("spxSpiderHud");
        if(hud) hud.hidden=false;
        updateSpiderSelectionUi();
        adapter.refreshPack?.();
        return true;
    }

    function updateSpiderSelectionUi(){
        const selectedCount=state.spiderSelectedCards.size;
        const confirm=document.getElementById("spxSpiderConfirm");
        if(confirm){
            confirm.disabled=selectedCount<1;
            confirm.textContent=`ZARZUĆ SIEĆ ${selectedCount}/2`;
        }
        setSpiderHudMessage(
            selectedCount
                ? `${state.playerName}: wybrano ${selectedCount}/2. Możesz dodać drugą kartę albo zatwierdzić.`
                : isGalacticCurrentMode()?`Spider-Sense ${state.playerName}: zakotwicz maksymalnie dwie karty nurtu do swojego następnego wyboru.`:`Spider-Sense ${state.playerName}: opleć siecią maksymalnie dwie karty do swojej następnej tury.`
        );
    }

    function getPackCardElement(packIndex){
        return document.querySelector(
            `#pack [data-pack-index="${packIndex}"]`
        );
    }

    function playSpiderWebShot(sourceRect,targetRect,onComplete){
        const layer=document.getElementById("spxSpiderWebLayer");
        if(!layer || !targetRect){
            onComplete?.();
            return;
        }

        const startX=sourceRect
            ? sourceRect.left+sourceRect.width/2
            : Math.max(24,targetRect.left-80);
        const startY=sourceRect
            ? sourceRect.top+sourceRect.height/2
            : Math.max(24,targetRect.top-70);
        const endX=targetRect.left+targetRect.width/2;
        const endY=targetRect.top+targetRect.height/2;
        const dx=endX-startX;
        const dy=endY-startY;
        const distance=Math.max(1,Math.hypot(dx,dy));
        const angle=Math.atan2(dy,dx)*180/Math.PI;

        layer.innerHTML=`
            <div class="spx-spider-shot"></div>
            <div class="spx-spider-impact"></div>
        `;
        layer.style.setProperty("--spx-spider-start-x",`${startX}px`);
        layer.style.setProperty("--spx-spider-start-y",`${startY}px`);
        layer.style.setProperty("--spx-spider-end-x",`${endX}px`);
        layer.style.setProperty("--spx-spider-end-y",`${endY}px`);
        layer.style.setProperty("--spx-spider-distance",`${distance}px`);
        layer.style.setProperty("--spx-spider-angle",`${angle}deg`);
        layer.hidden=false;

        clearTimeout(playSpiderWebShot.timer);
        playSpiderWebShot.timer=setTimeout(()=>{
            layer.hidden=true;
            layer.innerHTML="";
            onComplete?.();
        },820);
    }

    function commitSpiderTarget(packIndex,card){
        if(!state.active || state.powerId!=="spider_man") return true;
        if(state.spiderSelectedCards.has(card)){
            state.spiderSelectedCards.delete(card);
            const refreshed=adapter.getSpiderCandidates?.(
                state.playerIndex,
                [...state.spiderSelectedCards]
            )||[];
            state.spiderCandidateCards=new Set(refreshed.map(entry=>entry.card));
            updateSpiderSelectionUi();
            adapter.refreshPack?.();
            return true;
        }
        if(!state.spiderCandidateCards.has(card)){
            setSpiderHudMessage("Ta karta nie jest dostępnym celem PAJĘCZEJ SIECI.");
            return true;
        }
        if(state.spiderSelectedCards.size>=2){
            setSpiderHudMessage("Spider-Man może zarezerwować maksymalnie dwie karty.");
            return true;
        }

        state.spiderSelectedCards.add(card);
        const refreshed=adapter.getSpiderCandidates?.(
            state.playerIndex,
            [...state.spiderSelectedCards]
        )||[];
        state.spiderCandidateCards=new Set([
            ...refreshed.map(entry=>entry.card),
            ...state.spiderSelectedCards
        ]);
        updateSpiderSelectionUi();
        adapter.refreshPack?.();
        return true;
    }

    function confirmSpiderReservations(){
        if(
            !state.active ||
            state.powerId!=="spider_man" ||
            !state.spiderSelectedCards.size
        ) return;

        const pack=adapter.getCurrentPack?.()||[];
        const selections=[...state.spiderSelectedCards].map(card=>({
            card,
            packIndex:pack.indexOf(card)
        }));
        const sourceElement=document.querySelector(
            `.spg-deck-power-btn[data-player-index="${state.playerIndex}"][data-power-id="spider_man"]`
        );
        const sourceRect=sourceElement?.getBoundingClientRect?.();
        const targetRects=selections.map(selection=>
            getPackCardElement(selection.packIndex)?.getBoundingClientRect?.()
        );
        const result=adapter.commitSpiderReservation?.({
            playerName:state.playerName,
            playerIndex:state.playerIndex,
            cards:selections
        });

        if(!result?.ok){
            showToast("SIEĆ NIE TRAFIŁA",result?.message||"Nie udało się zarezerwować kart.");
            return true;
        }

        const owner=state.playerName;
        const cardNames=selections.map(selection=>selection.card?.name||"karta");
        cancel({silent:true,refresh:false});
        document.body.classList.add("spx-spider-animating");
        let animationIndex=0;
        const playNext=()=>{
            if(animationIndex>=targetRects.length){
                document.body.classList.remove("spx-spider-animating");
                adapter.refreshPack?.();
                adapter.refreshDecks?.();
                showEventToast(
                    cardNames.length>1 ? "KARTY OPLECIONE" : "KARTA OPLECIONA",
                    isGalacticCurrentMode()?`${cardNames.join(" i ")} ${cardNames.length>1 ? "zostały zakotwiczone" : "została zakotwiczona"} w nurcie do następnego wyboru gracza ${owner}.`:`${cardNames.join(" i ")} ${cardNames.length>1 ? "czekają" : "czeka"} na następną turę gracza ${owner}.`
                );
                return;
            }
            playSpiderWebShot(sourceRect,targetRects[animationIndex++],playNext);
        };
        playNext();
        return true;
    }

    function animateBlockedSpiderCard(packIndex,reservation){
        const cardElement=getPackCardElement(packIndex);
        if(cardElement){
            cardElement.classList.remove("spx-spider-blocked-hit");
            void cardElement.offsetWidth;
            cardElement.classList.add("spx-spider-blocked-hit");
            setTimeout(()=>cardElement.classList.remove("spx-spider-blocked-hit"),850);
        }
        if(reservation?.forcedChoice){
            showToast(
                "PAJĘCZA SIEĆ CZEKA",
                `${reservation.ownerName} musi teraz wybrać jedną z zarezerwowanych kart: ${(reservation.cardNames||[]).join(" lub ")}.`,
                {powerId:"spider_man"}
            );
            return;
        }
        showToast(
            "KARTA UWIĘZIONA W SIECI",
            `Tylko ${reservation?.ownerName||"właściciel sieci"} może wybrać tę kartę w swojej następnej turze.`,
            {powerId:"spider_man"}
        );
    }

    function setRocketHudMessage(message){
        const text=document.getElementById("spxRocketHudText");
        if(text) text.textContent=message;
    }

    function updateRocketArmButton(){
        const button=document.getElementById("spxRocketArm");
        if(button){
            button.disabled=state.rocketSelectedCards.size!==state.rocketExpectedBombs;
            button.textContent=`UZBRÓJ BOMBY ${state.rocketSelectedCards.size}/${state.rocketExpectedBombs}`;
        }
        setRocketHudMessage(
            state.rocketSelectedCards.size===state.rocketExpectedBombs
                ? "Cele wybrane. Uzbrój ładunki."
                : `Wybierz 2 karty do zaminowania. ${state.rocketSelectedCards.size}/${state.rocketExpectedBombs}`
        );
    }

    function startRocket(playerName){
        if(!adapter?.isDraftActive?.() || !adapter?.isPackInteractive?.()){
            showToast("BOMBY JESZCZE W SKRZYNI",flowText("ŁADUNKU WYBUCHOWEGO można użyć po otwarciu aktywnej paczki.","ŁADUNKU WYBUCHOWEGO można użyć, gdy Gwiezdny Prąd jest aktywny."));
            return false;
        }
        const assignment=adapter.getAssignment?.(playerName);
        if(!assignment || assignment.powerId!=="rocket"){
            showToast("BŁĄD PRZYPISANIA","Ten gracz nie posiada mocy Rocketa.");
            return false;
        }
        if(assignment.used){
            showToast("MAGAZYNEK PUSTY","Rocket wykorzystał już ŁADUNEK WYBUCHOWY.");
            return false;
        }
        const players=adapter.getPlayers?.()||[];
        const playerIndex=players.indexOf(playerName);
        const candidates=adapter.getRocketBombCandidates?.(playerIndex)||[];
        if(playerIndex<0 || !candidates.length){
            showToast("BRAK CELÓW",flowText("W aktualnej paczce nie ma dostępnej karty do zaminowania.","W aktualnym nurcie nie ma dostępnej karty do zaminowania."));
            return false;
        }
        const existing=adapter.getRocketBombTraps?.()||[];
        const hasArmedBombs=existing.some(trap=>trap?.ownerName===playerName && trap?.status==="armed");
        if(hasArmedBombs && !adapter.isSuperpowerRechargeReady?.(playerName,"rocket")){
            showToast("BOMBY JUŻ UZBROJONE","Poczekaj na rozbrojenie ładunków albo użyj Recharge, aby przygotować dodatkowy arsenał.");
            return false;
        }

        cancel({silent:true,refresh:false,force:true});
        state.active=true;
        state.powerId="rocket";
        state.playerName=playerName;
        state.playerIndex=playerIndex;
        state.rocketPhase="planting";
        state.rocketSelectedCards=new Set();
        state.rocketExpectedBombs=Math.min(2,candidates.length);
        document.body.classList.add("spx-rocket-planting");
        const hud=document.getElementById("spxRocketHud");
        const arm=document.getElementById("spxRocketArm");
        const cancelButton=document.getElementById("spxRocketCancel");
        if(hud) hud.hidden=false;
        if(arm) arm.hidden=false;
        if(cancelButton) cancelButton.hidden=false;
        updateRocketArmButton();
        adapter.refreshPack?.();
        return true;
    }

    function toggleRocketBombTarget(card){
        if(!card) return true;
        const candidates=adapter.getRocketBombCandidates?.(state.playerIndex)||[];
        if(!candidates.some(entry=>entry.card===card)){
            setRocketHudMessage(flowText("Rocket może zaminować dostępną kartę w aktualnej paczce.","Rocket może zaminować dostępną kartę w aktualnym nurcie."));
            return true;
        }
        if(state.rocketSelectedCards.has(card)){
            state.rocketSelectedCards.delete(card);
        }else if(state.rocketSelectedCards.size<state.rocketExpectedBombs){
            state.rocketSelectedCards.add(card);
        }else{
            setRocketHudMessage("Wybrano już oba cele. Odznacz kartę, aby zmienić wybór.");
            return true;
        }
        updateRocketArmButton();
        adapter.refreshPack?.();
        return true;
    }

    function armRocketBombs(){
        if(!state.active || state.powerId!=="rocket" || state.rocketPhase!=="planting") return;
        const result=adapter.commitRocketBombs?.({
            playerName:state.playerName,
            playerIndex:state.playerIndex,
            cards:[...state.rocketSelectedCards]
        });
        if(!result?.ok){
            showToast("NIEWYPAŁ",result?.message||"Nie udało się uzbroić bomb.");
            return;
        }
        const owner=state.playerName;
        cancel({silent:true,refresh:false,force:true});
        adapter.refreshPack?.();
        adapter.refreshDecks?.();
        showEventToast("💣 BOMBY UZBROJONE",`${owner} zastawił pułapkę.`);
    }

    function resolveRocketBomb(result,continueDraft){
        ensureInterface();
        const layer=document.getElementById("spxRocketExplosion");
        const resultText=document.getElementById("spxRocketResultText");
        if(!layer){
            continueDraft?.();
            return;
        }

        state.active=true;
        state.powerId="rocket";
        state.playerName=result?.trap?.ownerName||"";
        state.playerIndex=Number(result?.trap?.ownerIndex);
        state.rocketPhase="explosion";
        state.rocketContinue=typeof continueDraft==="function" ? continueDraft : null;
        state.rocketExplosionResult=result;
        document.body.classList.add("spx-rocket-detonating");
        if(resultText){
            resultText.textContent=result.dud
                ? `💣 PUŁAPKA: ${result.trap?.cardName||"KARTA"} • Ładunek wygasł bez zniszczeń.`
                : `💣 PUŁAPKA: ${result.trap?.cardName||"KARTA"} • 💥 ZNISZCZONO: ${result.destroyedCard?.name||"KARTA"} → ${result.replacementCard?.name||"KARTA"}`;
        }
        const takeButton=document.getElementById("spxRocketTakeLoot");
        const leaveButton=document.getElementById("spxRocketLeaveLoot");
        if(takeButton){
            takeButton.hidden=!result.canSalvage || result.dud;
            takeButton.disabled=true;
        }
        if(leaveButton){
            leaveButton.disabled=true;
            leaveButton.textContent=result.canSalvage && !result.dud ? "ODPUŚĆ ZŁOM" : "KONTYNUUJ DRAFT";
        }
        layer.hidden=false;
        layer.classList.remove("spx-rocket-explosion-play");
        void layer.offsetWidth;
        layer.classList.add("spx-rocket-explosion-play");

        const unlockRocketResult=()=>{
            if(takeButton) takeButton.disabled=false;
            if(leaveButton) leaveButton.disabled=false;
        };
        if(result.counterattack?.triggered){
            setTimeout(()=>{
                playCaptainAmericaRicochet(result.counterattack,unlockRocketResult);
            },1050);
        }else{
            setTimeout(unlockRocketResult,1550);
        }
    }

    function closeRocketExplosionLayer(){
        const layer=document.getElementById("spxRocketExplosion");
        if(layer){
            layer.hidden=true;
            layer.classList.remove("spx-rocket-explosion-play");
        }
        document.body.classList.remove("spx-rocket-detonating");
    }

    function beginRocketSalvage(){
        const result=state.rocketExplosionResult;
        if(!result?.canSalvage) return;
        closeRocketExplosionLayer();
        state.active=true;
        state.powerId="rocket";
        state.playerName=result.trap.ownerName;
        state.playerIndex=result.trap.ownerIndex;
        state.rocketPhase="salvage";
        document.body.classList.add("spx-rocket-salvaging");
        const hud=document.getElementById("spxRocketHud");
        const arm=document.getElementById("spxRocketArm");
        const cancelButton=document.getElementById("spxRocketCancel");
        if(hud) hud.hidden=false;
        if(arm) arm.hidden=true;
        if(cancelButton) cancelButton.hidden=true;
        setRocketHudMessage(
            `${result.trap.ownerName}: wybierz własną kartę, którą opcjonalnie wymienisz na ${result.destroyedCard.name}.`
        );
        adapter.refreshDecks?.();
    }

    function finishRocketWithoutSalvage(){
        const result=state.rocketExplosionResult;
        if(!result) return;
        if(result.canSalvage){
            const declined=adapter.declineRocketSalvage?.({
                playerName:result.trap.ownerName
            });
            if(declined?.ok===false){
                showToast("NIE MOŻNA ZOSTAWIĆ ŁUPU",declined.message||"Spróbuj ponownie.");
                return;
            }
        }
        const callback=state.rocketContinue;
        closeRocketExplosionLayer();
        cancel({silent:true,refresh:false,force:true});
        state.rocketContinue=null;
        state.rocketExplosionResult=null;
        adapter.refreshDecks?.();
        callback?.();
    }

    function handleRocketSalvage(playerIndex,cardIndex){
        if(state.rocketPhase!=="salvage") return true;
        if(playerIndex!==state.playerIndex){
            setRocketHudMessage(`Wybierz kartę z decku gracza ${state.playerName}.`);
            return true;
        }
        const result=adapter.commitRocketSalvage?.({
            playerName:state.playerName,
            playerIndex,
            sourceCardIndex:cardIndex
        });
        if(!result?.ok){
            showToast("ZŁOM NIEPASUJĄCY",result?.message||"Nie udało się odzyskać karty.");
            return true;
        }

        const callback=state.rocketContinue;
        const gained=result.salvagedCard?.name||"karta";
        const paid=result.removedCard?.name||"karta";
        cancel({silent:true,refresh:false,force:true});
        state.rocketContinue=null;
        adapter.refreshDecks?.();
        showEventToast("ROCKET ZABRAŁ ŁUP",`${paid} → ${gained}. ŁADUNEK WYBUCHOWY rozstrzygnięty.`);
        callback?.();
        return true;
    }

    function handlePackCardClick(packIndex,card){
        if(window.GrootUI?.isBusy?.()){
            return window.GrootUI.handlePackCardClick(packIndex,card);
        }

        if(window.IronFistUI?.isBusy?.()){
            return window.IronFistUI.handlePackCardClick(packIndex,card);
        }

        if(window.ThorUI?.isSelectingPack?.()){
            return window.ThorUI.handlePackCardClick(packIndex,card);
        }

        if(state.active && state.powerId==="doctor_strange"){
            return handleDoctorStrangePackCardClick(packIndex,card);
        }

        if(state.active && state.powerId==="jeff"){
            showToast(
                "JEFF JESZCZE SIĘ ŚMIEJE",
                "Najpierw rozstrzygnij prywatnego Jokera i wymień kartę w decku Jeffa."
            );
            return true;
        }

        if(state.active && state.powerId==="spider_man"){
            return commitSpiderTarget(packIndex,card);
        }

        if(state.active && state.powerId==="rocket"){
            if(state.rocketPhase==="planting") return toggleRocketBombTarget(card);
            showToast("ROCKET GRZEBIE W ZŁOMIE","Najpierw dokończ odzyskiwanie zniszczonej karty.");
            return true;
        }

        if(state.active && state.powerId==="hulk"){
            setHulkHudMessage(
                state.hulkHitResults.length
                    ? "Dokończ drugi cios Hulka, zanim wrócisz do wybierania z paczki."
                    : "Najpierw wybierz kartę przeciwnika albo anuluj HULK SMASH!."
            );
            return true;
        }

        const check=adapter?.checkSpiderPackClick?.({packIndex,card});
        if(check?.allowed===false){
            animateBlockedSpiderCard(packIndex,check.reservation);
            return true;
        }
        return false;
    }

    function afterPackRendered(){
        updateDoctorStrangePortalDock();
        const pack=adapter?.getCurrentPack?.()||[];
        const reservations=adapter?.getSpiderReservations?.()||[];
        const rocketTraps=adapter?.getRocketBombTraps?.()||[];
        const rocketCandidates=state.active && state.powerId==="rocket"
            ? adapter?.getRocketBombCandidates?.(state.playerIndex)||[]
            : [];
        const rocketCandidateCards=new Set(rocketCandidates.map(entry=>entry.card));
        const currentPlayerIndex=adapter?.getCurrentPlayerIndex?.();
        const currentPickIndex=adapter?.getCurrentPickIndex?.();

        document.querySelectorAll("#pack [data-pack-index]").forEach(cardElement=>{
            const packIndex=Number(cardElement.dataset.packIndex);
            const card=pack[packIndex];
            cardElement.classList.remove(
                "spx-spider-candidate",
                "spx-spider-ineligible",
                "spx-spider-selected",
                "spx-spider-reserved",
                "spx-spider-owner-ready",
                "spx-rocket-candidate",
                "spx-rocket-selected",
                "spx-rocket-armed"
            );
            cardElement.querySelectorAll(".spx-rocket-bomb-marker").forEach(marker=>marker.remove());
            cardElement.removeAttribute("data-spider-owner");

            const reservation=reservations.find(entry=>entry.card===card);
            if(reservation){
                const ownerReady=
                    currentPlayerIndex===reservation.ownerIndex &&
                    currentPickIndex>=reservation.unlockPickIndex;
                cardElement.classList.add("spx-spider-reserved");
                if(ownerReady) cardElement.classList.add("spx-spider-owner-ready");
                cardElement.dataset.spiderOwner=reservation.ownerName;
                cardElement.title=ownerReady
                    ? `SPIDER-MAN: ${reservation.ownerName} może teraz wybrać tę kartę`
                    : `PAJĘCZA SIEĆ: karta zarezerwowana dla ${reservation.ownerName}`;

                if(ownerReady && !announcedSpiderReservations.has(reservation.id)){
                    announcedSpiderReservations.add(reservation.id);
                    showEventToast(
                        "TWOJA SIEĆ JEST GOTOWA",
                        `${reservation.ownerName} może teraz wybrać kartę ${card?.name||""}.`,
                        {powerId:"spider_man"}
                    );
                }
            }

            if(state.active && state.powerId==="spider_man"){
                cardElement.classList.add(
                    state.spiderCandidateCards.has(card)
                        ? "spx-spider-candidate"
                        : "spx-spider-ineligible"
                );
                if(state.spiderSelectedCards.has(card)){
                    cardElement.classList.add("spx-spider-selected");
                }
            }

            const rocketTrap=rocketTraps.find(trap=>trap.card===card);
            if(rocketTrap){
                cardElement.classList.add("spx-rocket-armed");
                cardElement.title=`ROCKET: bomba gracza ${rocketTrap.ownerName} — rezerwacja Spider-Mana jej nie rozbraja`;
                const marker=document.createElement("span");
                marker.className="spx-rocket-bomb-marker";
                marker.innerHTML=`<img src="draft-assets/rocketbomb.png" alt="Uzbrojona bomba Rocketa">`;
                cardElement.appendChild(marker);
            }

            if(
                state.active &&
                state.powerId==="rocket" &&
                state.rocketPhase==="planting" &&
                rocketCandidateCards.has(card)
            ){
                cardElement.classList.add("spx-rocket-candidate");
                if(state.rocketSelectedCards.has(card)){
                    cardElement.classList.add("spx-rocket-selected");
                }
            }
        });
        decorateDoctorStrangePackCards();
        window.IronFistUI?.afterPackRendered?.();
        window.ThorUI?.afterPackRendered?.();
    }

    function ensureDeadpoolInterface(){
        if(document.getElementById("spxDeadpoolOverlay")) return;

        const overlay=document.createElement("div");
        overlay.id="spxDeadpoolOverlay";
        overlay.className="spx-deadpool-overlay";
        overlay.hidden=true;
        overlay.innerHTML=`
            <section class="spx-deadpool-panel" role="dialog" aria-modal="true" aria-labelledby="spxDeadpoolTitle">
                <div class="spx-deadpool-comic-dots" aria-hidden="true"></div>
                <header class="spx-deadpool-header">
                    <img src="draft-assets/deadpoolpowers.png" alt="" aria-hidden="true">
                    <div>
                        <span>DEADPOOL PRZEBIJA CZWARTĄ ŚCIANĘ</span>
                        <h2 id="spxDeadpoolTitle">💀 BAN? JAKI BAN?!</h2>
                    </div>
                </header>
                <img class="spx-deadpool-pixel-head" src="draft-assets/deadpoolpowershero.png" alt="" aria-hidden="true">
                <div id="spxDeadpoolBubble" class="spx-deadpool-bubble">Zakazana karta? To brzmi jak zaproszenie.</div>
                <div class="spx-deadpool-content">
                    <aside class="spx-deadpool-peek" aria-hidden="true">
                        <img src="draft-assets/deadpoolpowershero.png" alt="">
                        <i></i>
                    </aside>
                    <div class="spx-deadpool-picker">
                        <p id="spxDeadpoolInstruction"></p>
                        <div id="spxDeadpoolCandidates" class="spx-deadpool-candidates"></div>
                        <div id="spxDeadpoolChoice" class="spx-deadpool-choice">Deadpool jeszcze niczego nie wybrał.</div>
                    </div>
                </div>
                <footer class="spx-deadpool-actions">
                    <button id="spxDeadpoolCancel" type="button">ANULUJ TEN BAŁAGAN</button>
                    <button id="spxDeadpoolConfirm" type="button" disabled>BIORĘ TO. NIE PYTAJ.</button>
                </footer>
            </section>
        `;
        document.body.appendChild(overlay);
        overlay.querySelector("#spxDeadpoolCancel").addEventListener("click",()=>cancel());
        overlay.querySelector("#spxDeadpoolConfirm").addEventListener("click",confirmDeadpoolBreakout);

        const stage=document.createElement("div");
        stage.id="spxDeadpoolStage";
        stage.className="spx-deadpool-stage";
        stage.hidden=true;
        stage.innerHTML=`
            <section class="spx-deadpool-stage-card" role="dialog" aria-modal="true" aria-live="polite">
                <div class="spx-deadpool-stage-dots" aria-hidden="true"></div>
                <img id="spxDeadpoolStageCharacter" class="spx-deadpool-stage-character" src="draft-assets/deadpoolpowershero.png" alt="Deadpool">
                <div class="spx-deadpool-stage-copy">
                    <img class="spx-deadpool-stage-head" src="draft-assets/deadpoolpowershero.png" alt="" aria-hidden="true">
                    <div id="spxDeadpoolStageBubble" class="spx-deadpool-stage-bubble">Siema leszcze. Tu Deadpool.</div>
                    <aside id="spxDeadpoolBansBoard" class="spx-deadpool-bans-board">
                        <span>ZBANOWANE KARTY</span>
                        <div id="spxDeadpoolBansList"></div>
                    </aside>
                    <button id="spxDeadpoolStageSkip" class="spx-deadpool-stage-skip" type="button">
                        PRZEJDŹ DO ROZPIERDUCHY
                    </button>
                </div>
            </section>
        `;
        document.body.appendChild(stage);
        stage.querySelector("#spxDeadpoolStageSkip").addEventListener("click",()=>{
            deadpoolStageFinish?.();
        });

        const result=document.createElement("div");
        result.id="spxDeadpoolResult";
        result.className="spx-deadpool-result-overlay";
        result.hidden=true;
        result.innerHTML=`
            <section class="spx-deadpool-result-card" role="dialog" aria-modal="true">
                <img class="spx-deadpool-result-head" src="draft-assets/deadpoolpowershero.png" alt="">
                <div>
                    <span>DEADPOOL ZROBIŁ SWOJE</span>
                    <h2>DEADPOOL WRACA DO DRAFTU</h2>
                    <p id="spxDeadpoolResultSummary" class="spx-deadpool-result-summary"></p>
                    <div id="spxDeadpoolResultRows"></div>
                    <p id="spxDeadpoolResultLine"></p>
                    <button id="spxDeadpoolResultClose" type="button">WRACAM DO DRAFTU</button>
                </div>
            </section>
        `;
        document.body.appendChild(result);
        result.querySelector("#spxDeadpoolResultClose").addEventListener("click",()=>{
            result.hidden=true;
            runDeadpoolGoodbye(()=>{
                const pendingCuts=deadpoolPendingCuts;
                deadpoolPendingCuts=null;
                cancel({silent:true,refresh:false,force:true});
                adapter.refreshDecks?.();
                adapter.refreshQueue?.();
                requestAnimationFrame(()=>markDeadpoolDeckCuts(pendingCuts));
            });
        });
    }

    function markDeadpoolDeckCuts(pendingCuts){
        if(!pendingCuts || !Number.isInteger(pendingCuts.playerIndex)) return;
        (pendingCuts.cardIndices||[]).forEach(cardIndex=>{
            const cardElement=document.querySelector(
                `.card[data-player-index="${pendingCuts.playerIndex}"][data-card-index="${cardIndex}"]`
            );
            if(!cardElement) return;
            cardElement.classList.add("spx-deadpool-deck-blood");
            setTimeout(()=>cardElement.classList.remove("spx-deadpool-deck-blood"),1900);
        });
    }

    function clearDeadpoolSequence(){
        deadpoolSequenceTimers.forEach(timer=>clearTimeout(timer));
        deadpoolSequenceTimers=[];
        deadpoolStageFinish=null;
    }

    function setDeadpoolStageLine(text){
        const bubble=document.getElementById("spxDeadpoolStageBubble");
        if(!bubble) return;
        bubble.textContent=text;
        bubble.classList.remove("spx-deadpool-stage-bubble-pop");
        void bubble.offsetWidth;
        bubble.classList.add("spx-deadpool-stage-bubble-pop");
    }

    function runDeadpoolEntrance(playerName,mode,onComplete){
        const stage=document.getElementById("spxDeadpoolStage");
        const board=document.getElementById("spxDeadpoolBansBoard");
        const list=document.getElementById("spxDeadpoolBansList");
        if(!stage){
            onComplete?.();
            return;
        }

        clearDeadpoolSequence();
        const bans=(adapter.getBannedCards?.()||[])
            .map(card=>typeof card==="string" ? card : card?.name)
            .filter(Boolean);
        if(list){
            list.innerHTML=bans.length
                ? bans.map(name=>`<b>${escapeText(name)}</b>`).join("")
                : "<em>BRAK. SERIO?!</em>";
        }
        board?.classList.remove("spx-deadpool-board-active");
        stage.classList.remove("spx-deadpool-goodbye");
        stage.hidden=false;
        requestAnimationFrame(()=>stage.classList.add("spx-deadpool-stage-visible"));

        let finished=false;
        const finish=()=>{
            if(finished) return;
            finished=true;
            clearDeadpoolSequence();
            stage.classList.remove("spx-deadpool-stage-visible");
            deadpoolSequenceTimers.push(setTimeout(()=>{
                stage.hidden=true;
                onComplete?.();
            },360));
        };
        deadpoolStageFinish=finish;

        setDeadpoolStageLine(mode==="banned"?"💀 BAN? JAKI BAN?!":"NICZEGO NIE ZBANOWALIŚCIE?!");
        deadpoolSequenceTimers.push(setTimeout(
            ()=>setDeadpoolStageLine(mode==="banned"?"Zakazana karta? To brzmi jak zaproszenie.":"Świetnie. Sam sobie wybiorę."),
            1800
        ));
        deadpoolSequenceTimers.push(setTimeout(()=>{
            setDeadpoolStageLine(
                mode==="banned"
                    ? "Otwieram listę zakazanych kart. To moja lista zakupów."
                    : "Brak banów? Świetnie. Sam sobie wybiorę."
            );
        },3800));
        deadpoolSequenceTimers.push(setTimeout(()=>{
            board?.classList.add("spx-deadpool-board-active");
            setDeadpoolStageLine(
                mode==="banned"
                    ? "No ładnie, ładnie. Zobaczmy, co tu sobie schowaliście."
                    : "Nawet mnie nie zbanowaliście?! To wezmę, co chcę!"
            );
        },6100));
        deadpoolSequenceTimers.push(setTimeout(finish,8500));
    }

    function runDeadpoolGoodbye(onComplete){
        const stage=document.getElementById("spxDeadpoolStage");
        const board=document.getElementById("spxDeadpoolBansBoard");
        const skip=document.getElementById("spxDeadpoolStageSkip");
        if(!stage){
            onComplete?.();
            return;
        }
        clearDeadpoolSequence();
        board?.classList.remove("spx-deadpool-board-active");
        if(board) board.hidden=true;
        if(skip) skip.hidden=true;
        stage.classList.add("spx-deadpool-goodbye","spx-deadpool-stage-visible");
        stage.hidden=false;
        const lines=[
            "ADIOS FRAJEROS :D",
            "NARA LESZCZE. Deadpool wychodzi z tego Drafta."
        ];
        setDeadpoolStageLine(lines[Math.floor(Math.random()*lines.length)]);
        deadpoolSequenceTimers.push(setTimeout(()=>{
            stage.classList.remove("spx-deadpool-stage-visible");
        },2400));
        deadpoolSequenceTimers.push(setTimeout(()=>{
            stage.hidden=true;
            stage.classList.remove("spx-deadpool-goodbye");
            if(board) board.hidden=false;
            if(skip) skip.hidden=false;
            clearDeadpoolSequence();
            onComplete?.();
        },2950));
    }

    function getDeadpoolLine(mode){
        const hasJeff=(adapter.getPlayers?.()||[]).some(name=>
            adapter.getAssignment?.(name)?.powerId==="jeff"
        );
        const lines=mode==="banned"
            ? [
                "Zakazana karta? To brzmi jak zaproszenie.",
                "Lista banów? Dla mnie to menu.",
                "Czerwona pieczątka tylko poprawia smak."
            ]
            : [
                "NICZEGO NIE ZBANOWALIŚCIE?! Świetnie. Sam sobie wybiorę.",
                "Brak banów? Pięknie. Biorę, co chcę.",
                "Nawet mnie nie zbanowaliście? Odważnie."
            ];
        if(hasJeff){
            lines.push(
                "Ooo, Jeff tu jest! Kocham cię! Nie uciekaj po ekranie!",
                "Ciekawe czy mogę przekupić Jeffa, żeby sypnął mi jakimś Jokerem :D"
            );
        }
        return lines[Math.floor(Math.random()*lines.length)];
    }

    function renderDeadpoolCandidates(){
        const container=document.getElementById("spxDeadpoolCandidates");
        const choice=document.getElementById("spxDeadpoolChoice");
        const confirm=document.getElementById("spxDeadpoolConfirm");
        if(!container || !choice || !confirm) return;
        container.innerHTML="";
        state.deadpoolCandidates.forEach(card=>{
            const button=document.createElement("button");
            button.type="button";
            button.className="spx-deadpool-candidate";
            button.dataset.cardName=card.name;
            button.innerHTML=`
                <strong>${escapeText(card.name)}</strong>
                <span>${escapeText(card.cost)} COST / ${escapeText(card.power)} POWER</span>
            `;
            button.addEventListener("click",()=>{
                state.deadpoolSelectedName=card.name;
                container.querySelectorAll(".spx-deadpool-candidate").forEach(item=>
                    item.classList.toggle("spx-deadpool-selected",item===button)
                );
                choice.innerHTML=`DEADPOOL WYBIERA: <strong>${escapeText(card.name)}</strong>`;
                confirm.disabled=false;
            });
            container.appendChild(button);
        });
    }

    function startDeadpool(playerName){
        if(!adapter.isDraftActive?.()){
            showToast("DEADPOOL JESZCZE ŚPI","Tę moc można uruchomić podczas aktywnego draftu.");
            return false;
        }
        const assignment=adapter.getAssignment?.(playerName);
        if(!assignment || assignment.powerId!=="deadpool"){
            showToast("ZŁY NAJEMNIK","Deadpool nie jest przypisany do tego gracza.");
            return false;
        }
        if(assignment.used){
            showToast("CZWARTA ŚCIANA JUŻ PĘKŁA","Deadpool wykorzystał już swój numer.");
            return false;
        }
        const players=adapter.getPlayers?.()||[];
        const playerIndex=players.indexOf(playerName);
        const deck=(adapter.getDecks?.()||[])[playerIndex]||[];
        if(playerIndex<0 || deck.length<3){
            showToast("ZA MAŁO OFIAR","Deadpool potrzebuje co najmniej 3 kart w swoim decku.");
            return false;
        }
        const options=adapter.getDeadpoolDraftOptions?.(playerIndex);
        if(!options?.candidates?.length){
            showToast(
                "PUSTA LISTA ŻYCZEŃ",
                options?.reason||"Deadpool nie znalazł żadnej dostępnej karty."
            );
            return false;
        }
        if(options.preflightOk===false){
            showToast("ZA MAŁO KART NA CENĘ",options.reason||"Deadpool nie ma czym zapłacić za wymagane przelosowania.");
            return false;
        }

        cancel({silent:true,refresh:false,force:true});
        ensureDeadpoolInterface();
        state.active=true;
        state.powerId="deadpool";
        state.playerName=playerName;
        state.playerIndex=playerIndex;
        state.deadpoolMode=options.mode;
        state.deadpoolCandidates=[...options.candidates];
        state.deadpoolSelectedName="";
        document.body.classList.add("spx-deadpool-breaking");
        const instruction=document.getElementById("spxDeadpoolInstruction");
        const bubble=document.getElementById("spxDeadpoolBubble");
        const choice=document.getElementById("spxDeadpoolChoice");
        const confirm=document.getElementById("spxDeadpoolConfirm");
        if(instruction){
            instruction.textContent=options.mode==="banned"
                ? "Wybierz jedną zbanowaną kartę. Arishem i Loki pozostają poza zasięgiem nawet dla Deadpoola."
                : "Brak dostępnych banów: wybierz dowolną dostępną kartę. Ceną będą dwa dodatkowe przelosowania.";
        }
        if(bubble){
            bubble.textContent=options.mode==="banned"
                ? "Wybierz kartę z listy banów. Tak, naprawdę. Nie patrz tak na mnie."
                : "Skoro niczego nie zbanowaliście, wybiorę sobie coś sam.";
        }
        clearInterval(deadpoolChatterTimer);
        deadpoolChatterTimer=null;
        if(choice) choice.textContent="Deadpool jeszcze niczego nie wybrał.";
        if(confirm) confirm.disabled=true;
        renderDeadpoolCandidates();
        runDeadpoolEntrance(playerName,options.mode,()=>{
            const deadpoolOverlay=document.getElementById("spxDeadpoolOverlay");
            if(deadpoolOverlay) deadpoolOverlay.hidden=false;
        });
        return true;
    }

    function confirmDeadpoolBreakout(){
        if(!state.active || state.powerId!=="deadpool" || !state.deadpoolSelectedName) return;
        const result=adapter.commitDeadpoolBreakout?.({
            playerName:state.playerName,
            playerIndex:state.playerIndex,
            cardName:state.deadpoolSelectedName
        });
        if(!result?.ok){
            showToast("DEADPOOL ZGUBIŁ SCENARIUSZ",result?.message||"Nie udało się rozstrzygnąć mocy.");
            return;
        }

        document.getElementById("spxDeadpoolOverlay").hidden=true;
        const rows=document.getElementById("spxDeadpoolResultRows");
        const summary=document.getElementById("spxDeadpoolResultSummary");
        const line=document.getElementById("spxDeadpoolResultLine");
        const lostCards=[
            result.breakout.removedCard,
            ...result.rerolls.map(entry=>entry.removedCard)
        ].filter(Boolean);
        deadpoolPendingCuts={
            playerIndex:result.playerIndex,
            cardIndices:[
                result.breakout.index,
                ...result.rerolls.map(entry=>entry.index)
            ]
        };
        const bloodCard=name=>`
            <span class="spx-deadpool-blood-card">
                <del data-card-name="${escapeText(name)}">${escapeText(name)}</del>
                <i class="spx-deadpool-blood-particles" aria-hidden="true"></i>
            </span>
        `;
        if(summary){
            const sacrificeLabel=lostCards.length===2 ? "dwie karty" : `${lostCards.length} karty`;
            const extraLine=result.mode==="banned"
                ? "Deadpool musiał uciąć sobie jeszcze jedną… kartę. <b>(Spokojnie — odrosła!)</b>"
                : "Deadpool musiał uciąć sobie jeszcze dwie… karty. <b>(Spokojnie — odrosły!)</b>";
            summary.innerHTML=`
                Deadpool wybrał:
                <strong data-card-name="${escapeText(result.selectedCard.name)}">${escapeText(result.selectedCard.name)}</strong>.
                Ceną były ${sacrificeLabel}:
                ${lostCards.map(card=>bloodCard(card.name)).join(" ")}
                <em>${extraLine}</em>
            `;
        }
        if(rows){
            rows.innerHTML=`
                <article>${bloodCard(result.breakout.removedCard.name)}<b>→</b><ins data-card-name="${escapeText(result.selectedCard.name)}">${escapeText(result.selectedCard.name)}</ins></article>
                ${result.rerolls.map(entry=>`
                    <article>${bloodCard(entry.removedCard.name)}<b>↻</b><ins data-card-name="${escapeText(entry.replacementCard.name)}">${escapeText(entry.replacementCard.name)}</ins></article>
                `).join("")}
            `;
        }
        if(line){
            const lines=[
                "I TAK ICH NIE CHCIAŁEM!!!",
                "Te karty? Nigdy ich nie lubiłem. Serio. Ani trochę.",
                "Widzicie? Balans. Zdecydowanie balans."
            ];
            line.textContent=lines[Math.floor(Math.random()*lines.length)];
        }
        document.getElementById("spxDeadpoolResult").hidden=false;
    }

    function ensureDoctorDoomInterface(){
        if(!document.getElementById("spxDoomOverlay")){
            const overlay=document.createElement("div");
            overlay.id="spxDoomOverlay";
            overlay.className="spx-doom-overlay";
            overlay.hidden=true;
            overlay.innerHTML=`
                <section class="spx-doom-panel" role="dialog" aria-modal="true" aria-labelledby="spxDoomTitle">
                    <div class="spx-doom-metal-lines" aria-hidden="true"></div>
                    <header class="spx-doom-header">
                        <img class="spx-power-prompt-logo" src="draft-assets/doompowers.png" alt="" aria-hidden="true">
                        <div>
                            <span>LATVERIA // KUŹNIA DOOMBOTÓW</span>
                            <h2 id="spxDoomTitle">MAGICZNE DOOMBOTY</h2>
                            <p>🤖 Wybierz kartę, której technologię skopiują DoomBoty.</p>
                        </div>
                    </header>
                    <label class="spx-doom-search">
                        <span>WZORZEC TECHNOLOGICZNY</span>
                        <input id="spxDoomInput" type="search" autocomplete="off" placeholder="Wpisz nazwę karty…">
                    </label>
                    <div id="spxDoomCandidates" class="spx-doom-candidates"></div>
                    <div id="spxDoomChoice" class="spx-doom-choice">
                        DoomBot zastąpi losową kartę Dooma, losową kartę paczki i najsłabszą kartę losowego przeciwnika.
                    </div>
                    <footer class="spx-doom-actions">
                        <button id="spxDoomCancel" class="spx-doom-secondary-btn" type="button">ANULUJ</button>
                        <button id="spxDoomConfirm" class="spx-doom-confirm-btn" type="button" disabled>
                            STWÓRZ DOOMBOTA
                        </button>
                    </footer>
                </section>
            `;
            document.body.appendChild(overlay);
            overlay.querySelector("#spxDoomInput").addEventListener("input",renderDoctorDoomCandidates);
            overlay.querySelector("#spxDoomCancel").addEventListener("click",()=>cancel());
            overlay.querySelector("#spxDoomConfirm").addEventListener("click",confirmDoctorDoomForge);
            overlay.addEventListener("click",event=>{
                if(event.target===overlay) cancel();
            });
        }

        if(!document.getElementById("spxDoomForgeLayer")){
            const layer=document.createElement("div");
            layer.id="spxDoomForgeLayer";
            layer.className="spx-doom-forge-layer";
            layer.hidden=true;
            document.body.appendChild(layer);
        }

        if(!document.getElementById("spxDoomResultOverlay")){
            const resultOverlay=document.createElement("div");
            resultOverlay.id="spxDoomResultOverlay";
            resultOverlay.className="spx-doom-result-overlay";
            resultOverlay.hidden=true;
            resultOverlay.innerHTML=`
                <section class="spx-doom-result-panel" role="dialog" aria-modal="true" aria-labelledby="spxDoomResultTitle">
                    <header class="spx-doom-result-header">
                        <img src="draft-assets/doompowers.png" alt="" aria-hidden="true">
                        <div>
                            <span>RAPORT INWAZJI // 3 DOOMBOTY</span>
                            <h2 id="spxDoomResultTitle">TECHNOLOGIA DOOMA ROZESŁANA</h2>
                        </div>
                    </header>
                    <div id="spxDoomResultRows" class="spx-doom-result-rows"></div>
                    <button id="spxDoomResultClose" class="spx-doom-result-close" type="button">
                        WRÓĆ DO DRAFTU
                    </button>
                </section>
            `;
            document.body.appendChild(resultOverlay);
            resultOverlay.querySelector("#spxDoomResultClose").addEventListener("click",()=>{
                const continueDraft=state.doomContinue;
                state.doomContinue=null;
                resultOverlay.hidden=true;
                continueDraft?.();
            });
        }
    }

    function getDoctorDoomCandidates(){
        const database=adapter?.getCardDatabase?.()||[];
        const pack=adapter?.getCurrentPack?.()||[];
        const decks=adapter?.getDecks?.()||[];
        const banned=new Set((adapter?.getBannedCards?.()||[]).map(normalizeName));
        const ownNames=new Set((decks[state.playerIndex]||[]).map(card=>normalizeName(card?.name)));
        const packNames=new Set(pack.map(card=>normalizeName(card?.name)));
        const seen=new Set();
        const spiderReservations=adapter?.getSpiderReservations?.()||[];
        const hasPackTarget=pack.some(card=>
            card && !spiderReservations.some(reservation=>reservation?.card===card)
        );
        if(!hasPackTarget) return [];

        return database
            .filter(card=>{
                const name=normalizeName(card?.name);
                if(
                    !name ||
                    seen.has(name) ||
                    banned.has(name) ||
                    ownNames.has(name) ||
                    packNames.has(name) ||
                    card?.joker ||
                    !Number.isFinite(Number(card?.cost)) ||
                    !Number.isFinite(Number(card?.power))
                ) return false;
                const hasOpponentTarget=decks.some((deck,index)=>
                    index!==state.playerIndex &&
                    Array.isArray(deck) &&
                    deck.length>=4 &&
                    !deck.some(entry=>normalizeName(entry?.name)===name) &&
                    deck.some((entry,cardIndex)=>
                        entry && adapter.canSuperpowerTargetDeckCard?.({
                            actorPlayerIndex:state.playerIndex,
                            targetPlayerIndex:index,
                            targetCardIndex:cardIndex,
                            effect:"replace"
                        })!==false
                    )
                );
                if(!hasOpponentTarget) return false;
                seen.add(name);
                return true;
            })
            .sort((a,b)=>String(a.name).localeCompare(String(b.name),"pl"));
    }

    function renderDoctorDoomCandidates(){
        if(!state.active || state.powerId!=="doctor_doom") return;
        const input=document.getElementById("spxDoomInput");
        const container=document.getElementById("spxDoomCandidates");
        const choice=document.getElementById("spxDoomChoice");
        const confirm=document.getElementById("spxDoomConfirm");
        if(!input || !container || !choice || !confirm) return;

        const query=normalizeName(input.value);
        const candidates=getDoctorDoomCandidates();
        const exact=candidates.find(card=>normalizeName(card.name)===query)||null;
        state.doomSelectedName=exact?.name||"";
        confirm.disabled=!exact;
        choice.innerHTML=exact
            ? `<strong>DOOMBOT: ${escapeText(exact.name)}</strong><span>${escapeText(exact.cost)} COST / ${escapeText(exact.power)} POWER</span>`
            : "Wybierz dokładną nazwę dostępnej karty.";

        container.innerHTML="";
        if(!query){
            container.hidden=true;
            return;
        }
        const matches=candidates
            .filter(card=>normalizeName(card.name).includes(query))
            .slice(0,8);
        container.hidden=!matches.length;
        matches.forEach(card=>{
            const button=document.createElement("button");
            button.type="button";
            button.className="spx-doom-candidate";
            button.dataset.cardName=card.name;
            button.innerHTML=`
                <strong>${escapeText(card.name)}</strong>
                <span>${escapeText(card.cost)} / ${escapeText(card.power)}</span>
            `;
            button.addEventListener("click",()=>{
                input.value=card.name;
                renderDoctorDoomCandidates();
                container.hidden=true;
            });
            container.appendChild(button);
        });
    }

    function startDoctorDoom(playerName){
        if(!adapter.isDraftActive?.() || !adapter.isPackInteractive?.()){
            showToast("KUŹNIA ZAMKNIĘTA",flowText("Magiczne DoomBoty wymagają otwartej, aktywnej paczki.","Magiczne DoomBoty wymagają aktywnego nurtu."));
            return false;
        }
        const assignment=adapter.getAssignment?.(playerName);
        if(!assignment || assignment.powerId!=="doctor_doom"){
            showToast("BŁĄD PRZYPISANIA","Ten gracz nie posiada Supermocy Doctora Dooma.");
            return false;
        }
        if(assignment.used){
            showToast("DOOMBOTY JUŻ WYSŁANE","MAGICZNE DOOMBOTY zostały już wykorzystane.");
            return false;
        }

        const players=adapter.getPlayers?.()||[];
        const decks=adapter.getDecks?.()||[];
        const playerIndex=players.indexOf(playerName);
        const opponents=decks.filter((deck,index)=>index!==playerIndex);
        if(playerIndex<0) return false;
        if((adapter.getCurrentPack?.()||[]).length<4){
            showToast("ZA PÓŹNO NA INWAZJĘ",flowText("W aktualnej paczce muszą pozostać co najmniej 4 karty.","W aktualnym nurcie muszą znajdować się co najmniej 4 karty."));
            return false;
        }
        if((decks[playerIndex]||[]).length<4 || opponents.some(deck=>!Array.isArray(deck) || deck.length<4)){
            showToast("ZA MAŁO CELÓW","Doctor Doom i każdy przeciwnik muszą mieć co najmniej 4 karty w decku.");
            return false;
        }

        state.playerIndex=playerIndex;
        const forgeCandidates=getDoctorDoomCandidates();
        if(!forgeCandidates.length){
            state.playerIndex=-1;
            showToast("KUŹNIA NIE MA WZORCA","Nie istnieje karta, dla której wszystkie trzy DoomBoty mogą poprawnie zakończyć inwazję.");
            return false;
        }

        cancel({silent:true,refresh:false,force:true});
        ensureDoctorDoomInterface();
        state.active=true;
        state.powerId="doctor_doom";
        state.playerName=playerName;
        state.playerIndex=playerIndex;
        state.doomSelectedName="";
        document.body.classList.add("spx-doom-forging");
        const overlay=document.getElementById("spxDoomOverlay");
        const input=document.getElementById("spxDoomInput");
        const choice=document.getElementById("spxDoomChoice");
        if(input) input.value="";
        if(choice) choice.textContent=flowText(
            "DoomBot zastąpi losową kartę Dooma, losową kartę paczki i najsłabszą kartę losowego przeciwnika.",
            "DoomBot zastąpi losową kartę Dooma, losową kartę aktualnego nurtu i najsłabszą kartę losowego przeciwnika."
        );
        if(overlay) overlay.hidden=false;
        renderDoctorDoomCandidates();
        setTimeout(()=>input?.focus(),40);
        return true;
    }

    function playDoctorDoomForge(result,onComplete){
        const layer=document.getElementById("spxDoomForgeLayer");
        if(!layer){
            onComplete?.();
            return;
        }
        const particles=Array.from({length:24},(_,index)=>
            `<i style="--spx-doom-p:${index};--spx-doom-delay:${(index%8)*.08}s"></i>`
        ).join("");
        layer.innerHTML=`
            <div class="spx-doom-particles" aria-hidden="true">${particles}</div>
            <div class="spx-doom-forge-core">
                <img src="draft-assets/doompowers.png" alt="">
                <strong>${escapeText(result.createdCard?.name||"DOOMBOT")}</strong>
                <span>WYKUTO TECHNOLOGIĘ DOOMA</span>
            </div>
            <div class="spx-doom-beam spx-doom-beam-owner"></div>
            <div class="spx-doom-beam spx-doom-beam-pack"></div>
            <div class="spx-doom-beam spx-doom-beam-enemy"></div>
            <div class="spx-doom-bot spx-doom-bot-owner">
                <img src="draft-assets/doompowers.png" alt="">
                <b>DECK: ${escapeText(result.ownerName)}</b>
                <span>${escapeText(result.removedOwnCard?.name||"KARTA")} → ${escapeText(result.createdCard?.name||"DOOMBOT")}</span>
            </div>
            <div class="spx-doom-bot spx-doom-bot-pack">
                <img src="draft-assets/doompowers.png" alt="">
                <b>${flowText("AKTUALNA PACZKA","AKTUALNY NURT")}</b>
                <span>${escapeText(result.removedPackCard?.name||"KARTA")} → ${escapeText(result.createdCard?.name||"DOOMBOT")}</span>
            </div>
            <div class="spx-doom-bot spx-doom-bot-enemy">
                <img src="draft-assets/doompowers.png" alt="">
                <b>DECK: ${escapeText(result.opponentName)}</b>
                <span>${escapeText(result.removedOpponentCard?.name||"KARTA")} → ${escapeText(result.createdCard?.name||"DOOMBOT")}</span>
            </div>
        `;
        layer.hidden=false;
        void layer.offsetWidth;
        layer.classList.add("spx-doom-forge-active");
        setTimeout(()=>{
            layer.classList.remove("spx-doom-forge-active");
            layer.hidden=true;
            layer.innerHTML="";
            onComplete?.();
        },2350);
    }

    function showDoctorDoomResult(result){
        const overlay=document.getElementById("spxDoomResultOverlay");
        const rows=document.getElementById("spxDoomResultRows");
        if(!overlay || !rows) return;
        const replacementRow=(label,owner,removed,extra="")=>`
            <article class="spx-doom-result-row">
                <img src="draft-assets/doompowers.png" alt="" aria-hidden="true">
                <div class="spx-doom-result-destination">
                    <span>${escapeText(label)}</span>
                    <strong>${escapeText(owner)}</strong>
                    ${extra ? `<small>${escapeText(extra)}</small>` : ""}
                </div>
                <div class="spx-doom-result-swap">
                    <del data-card-name="${escapeText(removed?.name||"")}">${escapeText(removed?.name||"Nieznana karta")}</del>
                    <b aria-hidden="true">→</b>
                    <ins data-card-name="${escapeText(result.createdCard?.name||"")}">${escapeText(result.createdCard?.name||"DOOMBOT")}</ins>
                </div>
            </article>
        `;
        rows.innerHTML=
            replacementRow("DECK WŁAŚCICIELA MOCY",result.ownerName,result.removedOwnCard,"losowa karta")+
            replacementRow(flowText("AKTUALNA PACZKA","AKTUALNY NURT"),flowText("PACZKA","NURT"),result.removedPackCard,"losowa karta")+
            replacementRow("DECK PRZECIWNIKA",result.opponentName,result.removedOpponentCard,"najsłabsza karta");
        overlay.hidden=false;
    }

    function confirmDoctorDoomForge(){
        if(!state.active || state.powerId!=="doctor_doom" || !state.doomSelectedName) return;
        const result=adapter.commitDoctorDoomForge?.({
            playerName:state.playerName,
            playerIndex:state.playerIndex,
            cardName:state.doomSelectedName
        });
        if(!result?.ok){
            showToast("KUŹNIA ODRZUCIŁA TECHNOLOGIĘ",result?.message||"Nie udało się stworzyć DoomBotów.");
            return;
        }

        const overlay=document.getElementById("spxDoomOverlay");
        if(overlay) overlay.hidden=true;
        playDoctorDoomForge(result,()=>{
            playCaptainAmericaRicochet(result.counterattack,()=>{
                state.doomContinue=()=>{
                    cancel({silent:true,refresh:false,force:true});
                    adapter.refreshDecks?.();
                    adapter.refreshPack?.();
                    adapter.refreshQueue?.();
                };
                showDoctorDoomResult(result);
            });
        });
    }

    function start(playerName,powerId){
        ensureInterface();
        feedbackContextPowerId=String(powerId||"");
        if(!adapter) return false;

        if(window.WolverineUI?.isBusy?.()){
            showToast(
                "ADAMANTIOWA REGENERACJA W TOKU",
                window.WolverineUI.getLockReason?.()||"Najpierw dokończ sekwencję Wolverinea."
            );
            return false;
        }

        if(window.BlackCatUI?.isBusy?.()){
            showToast(
                "KOCI HEIST W TOKU",
                window.BlackCatUI.getLockReason?.()||"Najpierw dokończ napad Black Cat."
            );
            return false;
        }

        if(window.IronFistUI?.isBusy?.()){
            showToast(
                "BRAMY K’UN-LUN SĄ ZAMKNIĘTE",
                window.IronFistUI.getLockReason?.()||"Najpierw dokończ Wyzwanie K’un-Lun."
            );
            return false;
        }

        if(window.JokerV2UI?.isBusy?.()){
            showToast(
                "JOKER CZEKA NA ROZSTRZYGNIĘCIE",
                "Najpierw zakończ wybór Jokera, zanim uruchomisz Supermoc."
            );
            return false;
        }

        if(state.active){
            const activePower=getPowerDefinition(state.powerId);
            showToast(
                "SUPER MOC JEST JUŻ W TOKU",
                `Najpierw dokończ albo anuluj: ${activePower?.power||activePower?.name||state.powerId}.`
            );
            return false;
        }

        if(
            state.active &&
            state.powerId==="rocket" &&
            state.rocketPhase==="salvage"
        ){
            showToast(
                "ROCKET JESZCZE GRZEBIE W ZŁOMIE",
                "Najpierw wybierz kartę Rocketa do wymiany za zdobycz z eksplozji."
            );
            return false;
        }

        if(
            state.active &&
            state.powerId==="hulk" &&
            state.hulkHitResults.length>0
        ){
            showToast(
                "HULK JESZCZE NIE SKOŃCZYŁ",
                "Dokończ sekwencję HULK SMASH!, zanim uruchomisz inną Supermoc."
            );
            return false;
        }

        if(
            state.active &&
            state.powerId==="doctor_strange" &&
            state.strangeVisionOpened
        ){
            showToast(
                "PORTAL POZOSTAJE OTWARTY",
                "Dokończ przepisywanie linii czasu, zanim uruchomisz inną Supermoc."
            );
            return false;
        }

        if(powerId==="doctor_strange"){
            return startDoctorStrange(playerName);
        }

        if(powerId==="iron_fist"){
            return window.IronFistUI?.start?.(playerName)||false;
        }

        if(powerId==="captain_america"){
            return startCaptainAmerica(playerName);
        }

        if(powerId==="venom"){
            return startVenom(playerName);
        }

        if(powerId==="loki"){
            return startLoki(playerName);
        }

        if(powerId==="spider_man"){
            return startSpiderMan(playerName);
        }

        if(powerId==="hulk"){
            return startHulk(playerName);
        }

        if(powerId==="cyclops"){
            return startCyclops(playerName);
        }

        if(powerId==="professor_x"){
            return startProfessorX(playerName);
        }

        if(powerId==="jeff"){
            return startJeff(playerName);
        }

        if(powerId==="rocket"){
            return startRocket(playerName);
        }

        if(powerId==="doctor_doom"){
            return startDoctorDoom(playerName);
        }

        if(powerId==="deadpool"){
            return startDeadpool(playerName);
        }

        if(powerId==="thor"){
            return window.ThorUI?.start?.(playerName)||false;
        }

        if(powerId!=="iron_man"){
            showToast("MOC JESZCZE NIEAKTYWNA","Mechanika tego Championa pojawi się w kolejnym patchu.");
            return false;
        }

        if(!adapter.isDraftActive?.()){
            showToast("REAKTOR ZABLOKOWANY","Supermocy można użyć podczas aktywnego draftu.");
            return false;
        }

        const assignment=adapter.getAssignment?.(playerName);
        if(!assignment || assignment.powerId!==powerId){
            showToast("BŁĄD PRZYPISANIA","Ten gracz nie posiada wskazanej Supermocy.");
            return false;
        }
        if(assignment.used){
            showToast("REAKTOR WYGASZONY","Iron Man wykorzystał już AKTYWACJĘ REAKTORA.");
            return false;
        }

        const players=adapter.getPlayers?.()||[];
        const playerIndex=players.indexOf(playerName);
        if(playerIndex<0) return false;

        const eligibility=buildEligibility(playerIndex);
        if(!eligibility.size){
            showToast(
                "JARVIS NIE ZNALAZŁ ULEPSZENIA",
                "W puli nie ma obecnie karty o dokładnie dwukrotnie większej Sile."
            );
            return false;
        }

        cancel({silent:true,refresh:false});
        state.active=true;
        state.powerId=powerId;
        state.playerName=playerName;
        state.playerIndex=playerIndex;
        state.sourceCardIndex=-1;
        state.candidatesByCardIndex=eligibility;
        selectedCandidateName="";
        clearInterval(deadpoolChatterTimer);
        deadpoolChatterTimer=null;

        document.body.classList.add("spx-im-selecting");
        const hud=document.getElementById("spxIronManHud");
        if(hud) hud.hidden=false;
        setHudMessage(`${playerName}: wybierz podświetloną kartę do wymiany.`);
        adapter.refreshDecks?.();
        return true;
    }

    function afterDecksRendered(){
        if(!state.active) return;

        if(state.powerId==="doctor_strange"){
            decorateDoctorStrangeDeckCards();
            return;
        }

        if(state.powerId==="captain_america"){
            decorateCaptainAmericaCards();
            return;
        }

        if(state.powerId==="venom"){
            decorateVenomCards();
            return;
        }

        if(state.powerId==="loki"){
            decorateLokiCards();
            return;
        }

        if(state.powerId==="hulk"){
            decorateHulkCards();
            return;
        }

        if(state.powerId==="cyclops"){
            decorateCyclopsCards();
            return;
        }

        if(state.powerId==="jeff"){
            decorateJeffCards();
            return;
        }

        if(state.powerId==="rocket"){
            if(state.rocketPhase==="salvage"){
                document.querySelectorAll(".card[data-player-index]").forEach(cardElement=>{
                    const playerIndex=Number(cardElement.dataset.playerIndex);
                    cardElement.classList.add(
                        playerIndex===state.playerIndex
                            ? "spx-rocket-salvage-target"
                            : "spx-rocket-salvage-locked"
                    );
                    if(playerIndex===state.playerIndex){
                        cardElement.title="ROCKET: wymień tę kartę na zdobycz z eksplozji";
                    }
                });
            }
            return;
        }

        document.querySelectorAll(".card[data-player-index]").forEach(cardElement=>{
            const playerIndex=Number(cardElement.dataset.playerIndex);
            const cardIndex=Number(cardElement.dataset.cardIndex);
            cardElement.classList.remove("spx-im-eligible","spx-im-ineligible");

            if(playerIndex===state.playerIndex && state.candidatesByCardIndex.has(cardIndex)){
                cardElement.classList.add("spx-im-eligible");
                cardElement.title="IRON MAN: wybierz tę kartę do dopalenia";
            }else{
                cardElement.classList.add("spx-im-ineligible");
            }
        });
    }

    function handleDeckCardClick(playerIndex,cardIndex){
        if(window.IronFistUI?.isBusy?.()){
            return window.IronFistUI.handleDeckCardClick(playerIndex,cardIndex);
        }
        if(!state.active) return false;

        if(state.powerId==="doctor_strange"){
            return handleDoctorStrangeDeckCardClick(playerIndex,cardIndex);
        }

        if(state.powerId==="captain_america"){
            return handleCaptainAmericaDeckCardClick(playerIndex,cardIndex);
        }

        if(state.powerId==="venom"){
            return handleVenomDeckCardClick(playerIndex,cardIndex);
        }

        if(state.powerId==="loki"){
            return handleLokiDeckCardClick(playerIndex,cardIndex);
        }

        if(state.powerId==="hulk"){
            return handleHulkDeckCardClick(playerIndex,cardIndex);
        }

        if(state.powerId==="cyclops"){
            return handleCyclopsDeckCardClick(playerIndex,cardIndex);
        }

        if(state.powerId==="jeff"){
            return handleJeffDeckCardClick(playerIndex,cardIndex);
        }

        if(state.powerId==="rocket"){
            return handleRocketSalvage(playerIndex,cardIndex);
        }

        if(playerIndex!==state.playerIndex){
            setHudMessage(`Wybierz kartę z decku gracza ${state.playerName}.`);
            return true;
        }

        const candidates=state.candidatesByCardIndex.get(cardIndex)||[];
        if(!candidates.length){
            setHudMessage("Ta karta nie ma dostępnego odpowiednika o dokładnie podwójnej Sile.");
            return true;
        }

        state.sourceCardIndex=cardIndex;
        selectedCandidateName="";
        openCandidatePanel(candidates);
        return true;
    }

    function openCandidatePanel(candidates){
        const deck=(adapter?.getDecks?.()||[])[state.playerIndex]||[];
        const source=deck[state.sourceCardIndex];
        if(!source) return;

        const overlay=document.getElementById("spxIronManOverlay");
        const lead=document.getElementById("spxIronManLead");
        const equation=document.getElementById("spxIronManEquation");
        const container=document.getElementById("spxIronManCandidates");
        const choice=document.getElementById("spxIronManChoice");
        const confirm=document.getElementById("spxIronManConfirm");
        if(!overlay || !lead || !equation || !container || !choice || !confirm) return;

        lead.textContent=`${state.playerName}, wybierz nową kartę dla reaktora.`;
        equation.innerHTML=`
            <article data-card-name="${escapeText(source.name)}">
                <span>KARTA ŹRÓDŁOWA</span>
                <strong>${escapeText(source.name)}</strong>
                <b>${escapeText(source.cost)} / ${escapeText(source.power)}</b>
            </article>
            <i aria-hidden="true">×2</i>
            <article>
                <span>WYMAGANA SIŁA</span>
                <strong>${escapeText(Number(source.power)*2)} POWER</strong>
                <b>DOSTĘPNY CEL</b>
            </article>
        `;

        container.innerHTML="";
        candidates.forEach(candidate=>{
            const button=document.createElement("button");
            button.type="button";
            button.className="spx-im-candidate";
            button.dataset.cardName=candidate.name;
            button.innerHTML=`
                <span class="spx-im-candidate-tech">STARK TARGET</span>
                <strong>${escapeText(candidate.name)}</strong>
                <span class="spx-im-candidate-stats">
                    <b>${escapeText(candidate.cost)}</b> COST
                    <b>${escapeText(candidate.power)}</b> POWER
                </span>
            `;
            button.addEventListener("click",()=>{
                selectedCandidateName=candidate.name;
                container.querySelectorAll(".spx-im-candidate").forEach(item=>{
                    item.classList.toggle("spx-im-selected",item===button);
                });
                choice.innerHTML=`CEL REAKTORA: <strong>${escapeText(candidate.name)}</strong>`;
                confirm.disabled=false;
            });
            container.appendChild(button);
        });

        choice.textContent="Wybierz kartę docelową.";
        confirm.disabled=true;
        overlay.hidden=false;
    }

    function backToDeckSelection(){
        const overlay=document.getElementById("spxIronManOverlay");
        if(overlay) overlay.hidden=true;
        state.sourceCardIndex=-1;
        selectedCandidateName="";
        setHudMessage(`${state.playerName}: wybierz podświetloną kartę do wymiany.`);
    }

    function confirmIronManSwap(){
        if(!state.active || state.sourceCardIndex<0 || !selectedCandidateName) return;

        const result=adapter.commitIronManSwap?.({
            playerName:state.playerName,
            playerIndex:state.playerIndex,
            sourceCardIndex:state.sourceCardIndex,
            replacementName:selectedCandidateName
        });

        if(!result?.ok){
            showToast("JARVIS: PROCEDURA ULEPSZENIA PRZERWANA",result?.message||"Nie udało się podmienić karty.");
            return;
        }

        const added=result.addedCard?.name||selectedCandidateName;
        cancel({silent:true,refresh:false});
        adapter.refreshDecks?.();
        playIronManUpgrade(result,()=>{
            showEventToast("JARVIS: REAKTOR URUCHOMIONY",`Nowa konfiguracja: ${added}. Ulepszenie zakończone.`);
        });
    }

    function playIronManUpgrade(result,onComplete){
        const layer=document.getElementById("spxIronManUpgrade");
        if(!layer){onComplete?.();return;}
        const oldCard=result?.removedCard||{};
        const newCard=result?.addedCard||{};
        const face=(entry,kind)=>`
            <div class="spx-im-evolution-face is-${kind}" data-card-name="${escapeText(entry?.name||"")}">
                <span>${kind==="old"?"MATRYCA ŹRÓDŁOWA":"NOWA ZBROJA"}</span>
                <strong>${escapeText(entry?.name||"Karta")}</strong>
                <small>${escapeText(entry?.cost??"?")} COST · ${escapeText(entry?.power??"?")} POWER</small>
            </div>
        `;
        layer.innerHTML=`
            <section class="spx-im-evolution" role="status" aria-live="polite">
                <header>
                    <em>JARVIS // NANOFORGE ONLINE</em>
                    <h2>STARK EVOLUTION</h2>
                </header>
                <div class="spx-im-evolution-stage">
                    <div class="spx-im-evolution-rings" aria-hidden="true"></div>
                    <article class="spx-im-evolution-card">
                        ${face(oldCard,"old")}
                        ${face(newCard,"new")}
                        <div class="spx-im-evolution-grid" aria-hidden="true"></div>
                        <div class="spx-im-evolution-scan" aria-hidden="true"></div>
                        <div class="spx-im-evolution-core" aria-hidden="true"></div>
                        <div class="spx-im-armor-plates" aria-hidden="true">${"<i></i>".repeat(8)}</div>
                    </article>
                    <div class="spx-im-evolution-arcs" aria-hidden="true"></div>
                </div>
                <p>Nanozbroja zamyka się na karcie. Reaktor przebudowuje jej matrycę.</p>
            </section>
        `;
        layer.hidden=false;
        layer.classList.remove("is-playing");
        void layer.offsetWidth;
        layer.classList.add("is-playing");
        const reduced=globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
        clearTimeout(playIronManUpgrade.timer);
        playIronManUpgrade.timer=setTimeout(()=>{
            layer.hidden=true;
            layer.classList.remove("is-playing");
            layer.innerHTML="";
            onComplete?.();
        },reduced?760:3900);
    }

    function cancel(options={}){
        const strangeOverlay=document.getElementById("spxDoctorStrangeOverlay");
        const strangeResolution=document.getElementById("spxDoctorStrangeResolution");
        const strangeDock=document.getElementById("spxDoctorStrangeDock");
        const strangeHud=document.getElementById("spxDoctorStrangeHud");
        if(
            state.active &&
            state.powerId==="doctor_strange" &&
            state.strangeVisionOpened &&
            !options.force
        ){
            showToast(
                "PORTAL POZOSTAJE OTWARTY",
                "Po ujrzeniu przyszłości zaklęcie musi zostać doprowadzone do końca."
            );
            return false;
        }
        if(strangeOverlay) strangeOverlay.hidden=true;
        if(strangeResolution) strangeResolution.hidden=true;
        if(strangeDock) strangeDock.hidden=true;
        if(strangeHud) strangeHud.hidden=true;
        if(
            state.active &&
            state.powerId==="rocket" &&
            state.rocketPhase==="salvage" &&
            !options.force
        ){
            showToast(
                "ROCKET NIE ZOSTAWIA ŁUPU",
                "Wybierz własną kartę do wymiany i dokończ odzyskiwanie."
            );
            return false;
        }

        if(
            state.active &&
            state.powerId==="jeff" &&
            !options.force
        ){
            showToast(
                "FALA JUŻ RUSZYŁA",
                "Dokończ prywatnego Jokera Jeffa, aby wrócić do draftu."
            );
            return false;
        }

        if(
            state.active &&
            state.powerId==="hulk" &&
            state.hulkHitResults.length>0 &&
            !options.force
        ){
            showToast(
                "HULK MUSI DOKOŃCZYĆ",
                "Pierwszy cios został wykonany. Wybierz kartę innego przeciwnika i dokończ HULK SMASH!."
            );
            return false;
        }

        clearDeadpoolSequence();
        clearInterval(deadpoolChatterTimer);
        deadpoolChatterTimer=null;

        const wasActive=state.active;
        const cancelledPower=state.powerId;
        state.active=false;
        state.powerId="";
        state.playerName="";
        state.playerIndex=-1;
        state.sourceCardIndex=-1;
        state.targetPlayerIndex=-1;
        state.targetCardIndex=-1;
        state.targetPackIndex=-1;
        state.spiderCandidateCards=new Set();
        state.spiderSelectedCards=new Set();
        state.hulkExpectedHits=0;
        state.hulkHitResults=[];
        state.hulkTargetPlayerIndices=new Set();
        state.hulkPendingTarget=null;
        state.hulkResolving=false;
        state.cyclopsAnchorIndex=-1;
        state.cyclopsAnchorOptions=new Map();
        state.cyclopsMode=null;
        state.cyclopsPlannedSwaps=[];
        state.cyclopsPendingTargetIndex=-1;
        state.cyclopsSelectedReplacementName="";
        state.professorXTargetIndices=new Set();
        state.professorXRequiredTargetCount=2;
        state.jeffPersonalJoker=null;
        state.jeffOptions=[];
        state.jeffChosenCardName="";
        state.rocketSelectedCards=new Set();
        state.rocketExpectedBombs=0;
        state.rocketPhase=null;
        state.rocketContinue=null;
        state.rocketExplosionResult=null;
        state.doomSelectedName="";
        state.doomContinue=null;
        state.deadpoolSelectedName="";
        state.deadpoolMode=null;
        state.deadpoolCandidates=[];
        state.captainSelectedCardIndices=new Set();
        state.captainResolving=false;
        state.venomPhase=null;
        state.venomPairMap=new Map();
        state.venomOwnerOptions=[];
        state.venomOpponentOptions=[];
        state.venomOwnerReplacementName="";
        state.venomOpponentReplacementName="";
        state.venomResolving=false;
        state.candidatesByCardIndex=new Map();
        state.strangeFutureToDeckId="";
        state.strangeFutureToDeckResolvedCard=null;
        state.strangeDeckToFutureId="";
        state.strangeFutureToCurrentId="";
        state.strangeCurrentToFutureId="";
        state.strangeVisionOpened=false;
        state.strangePhase="idle";
        selectedCandidateName="";

        document.body.classList.remove("spx-im-selecting");
        document.body.classList.remove(
            "spx-loki-selecting-own",
            "spx-loki-selecting-target",
            "spx-spider-selecting",
            "spx-spider-animating",
            "spx-hulk-selecting",
            "spx-hulk-animating",
            "spx-cyclops-selecting-anchor",
            "spx-cyclops-selecting-target",
            "spx-professorx-selecting",
            "spx-jeff-resolving",
            "spx-rocket-planting",
            "spx-rocket-salvaging",
            "spx-rocket-detonating",
            "spx-doom-forging",
            "spx-deadpool-breaking"
            ,"spx-cap-selecting",
            "spx-venom-selecting-own",
            "spx-venom-selecting-target",
            "spx-venom-animating",
            "spx-strange-selecting-deck",
            "spx-strange-selecting-current"
        );
        const hud=document.getElementById("spxIronManHud");
        const overlay=document.getElementById("spxIronManOverlay");
        const lokiHud=document.getElementById("spxLokiHud");
        const lokiOverlay=document.getElementById("spxLokiOverlay");
        const spiderHud=document.getElementById("spxSpiderHud");
        const hulkHud=document.getElementById("spxHulkHud");
        const hulkConfirmOverlay=document.getElementById("spxHulkConfirmOverlay");
        const hulkRevealOverlay=document.getElementById("spxHulkRevealOverlay");
        const cyclopsHud=document.getElementById("spxCyclopsHud");
        const cyclopsTagOverlay=document.getElementById("spxCyclopsTagOverlay");
        const cyclopsCandidateOverlay=document.getElementById("spxCyclopsCandidateOverlay");
        const cyclopsFinalOverlay=document.getElementById("spxCyclopsFinalOverlay");
        const professorXOverlay=document.getElementById("spxProfessorXOverlay");
        const jeffHud=document.getElementById("spxJeffHud");
        const jeffOverlay=document.getElementById("spxJeffOverlay");
        const jeffSwimLayer=document.getElementById("spxJeffSwimLayer");
        const rocketHud=document.getElementById("spxRocketHud");
        const rocketExplosion=document.getElementById("spxRocketExplosion");
        const doomOverlay=document.getElementById("spxDoomOverlay");
        const doomForgeLayer=document.getElementById("spxDoomForgeLayer");
        const doomResultOverlay=document.getElementById("spxDoomResultOverlay");
        const deadpoolOverlay=document.getElementById("spxDeadpoolOverlay");
        const deadpoolResult=document.getElementById("spxDeadpoolResult");
        const deadpoolStage=document.getElementById("spxDeadpoolStage");
        const captainHud=document.getElementById("spxCaptainHud");
        const captainActivation=document.getElementById("spxCaptainActivationLayer");
        const captainReadyPrompt=document.getElementById("spxCaptainReadyPrompt");
        const captainRicochet=document.getElementById("spxCaptainRicochetLayer");
        const venomHud=document.getElementById("spxVenomHud");
        const venomOverlay=document.getElementById("spxVenomOverlay");
        const venomFeastLayer=document.getElementById("spxVenomFeastLayer");
        if(hud) hud.hidden=true;
        if(overlay) overlay.hidden=true;
        if(lokiHud) lokiHud.hidden=true;
        if(lokiOverlay) lokiOverlay.hidden=true;
        if(spiderHud) spiderHud.hidden=true;
        if(hulkHud) hulkHud.hidden=true;
        if(hulkConfirmOverlay) hulkConfirmOverlay.hidden=true;
        if(hulkRevealOverlay) hulkRevealOverlay.hidden=true;
        if(cyclopsHud) cyclopsHud.hidden=true;
        if(cyclopsTagOverlay) cyclopsTagOverlay.hidden=true;
        if(cyclopsCandidateOverlay) cyclopsCandidateOverlay.hidden=true;
        if(cyclopsFinalOverlay) cyclopsFinalOverlay.hidden=true;
        if(professorXOverlay) professorXOverlay.hidden=true;
        if(jeffHud) jeffHud.hidden=true;
        if(jeffOverlay) jeffOverlay.hidden=true;
        if(jeffSwimLayer) jeffSwimLayer.hidden=true;
        if(rocketHud) rocketHud.hidden=true;
        if(rocketExplosion) rocketExplosion.hidden=true;
        if(doomOverlay) doomOverlay.hidden=true;
        if(doomForgeLayer) doomForgeLayer.hidden=true;
        if(doomResultOverlay) doomResultOverlay.hidden=true;
        if(deadpoolOverlay) deadpoolOverlay.hidden=true;
        if(deadpoolResult) deadpoolResult.hidden=true;
        if(captainHud) captainHud.hidden=true;
        if(captainActivation) captainActivation.hidden=true;
        if(captainReadyPrompt){
            captainReadyPrompt.hidden=true;
            captainReadyPrompt.classList.remove("is-visible");
        }
        if(captainRicochet) captainRicochet.hidden=true;
        if(venomHud) venomHud.hidden=true;
        if(venomOverlay) venomOverlay.hidden=true;
        if(venomFeastLayer) venomFeastLayer.hidden=true;
        if(deadpoolStage){
            deadpoolStage.hidden=true;
            deadpoolStage.classList.remove("spx-deadpool-stage-visible","spx-deadpool-goodbye");
        }

        document.querySelectorAll(
            ".spx-im-eligible,.spx-im-ineligible,.spx-loki-own-eligible,"+
            ".spx-loki-sacrifice,.spx-loki-target,.spx-loki-ineligible,"+
            ".spx-spider-candidate,.spx-spider-ineligible,.spx-spider-selected,"+
            ".spx-hulk-eligible,.spx-hulk-ineligible,.spx-hulk-locked-owner,"+
            ".spx-cyclops-anchor-eligible,.spx-cyclops-anchor-locked,"+
            ".spx-cyclops-target-eligible,.spx-cyclops-target-locked,"+
            ".spx-cyclops-ineligible,.spx-jeff-swap-target,.spx-jeff-locked,"+
            ".spx-rocket-salvage-target,.spx-rocket-salvage-locked,"+
            ".spx-cap-candidate,.spx-cap-selected,.spx-cap-locked,"+
            ".spx-venom-own-candidate,.spx-venom-target-candidate,"+
            ".spx-venom-selected,.spx-venom-locked,"+
            ".spx-strange-deck-candidate,.spx-strange-deck-selected,"+
            ".spx-strange-deck-locked,.spx-strange-current-candidate,"+
            ".spx-strange-current-selected,.spx-strange-pack-paused"
        ).forEach(element=>{
            element.classList.remove(
                "spx-im-eligible",
                "spx-im-ineligible",
                "spx-loki-own-eligible",
                "spx-loki-sacrifice",
                "spx-loki-target",
                "spx-loki-ineligible",
                "spx-spider-candidate",
                "spx-spider-ineligible",
                "spx-spider-selected",
                "spx-hulk-eligible",
                "spx-hulk-ineligible",
                "spx-hulk-locked-owner",
                "spx-cyclops-anchor-eligible",
                "spx-cyclops-anchor-locked",
                "spx-cyclops-target-eligible",
                "spx-cyclops-target-locked",
                "spx-cyclops-ineligible",
                "spx-jeff-swap-target",
                "spx-jeff-locked",
                "spx-rocket-salvage-target",
                "spx-rocket-salvage-locked",
                "spx-cap-candidate",
                "spx-cap-selected",
                "spx-cap-locked",
                "spx-venom-own-candidate",
                "spx-venom-target-candidate",
                "spx-venom-selected",
                "spx-venom-locked",
                "spx-strange-deck-candidate",
                "spx-strange-deck-selected",
                "spx-strange-deck-locked",
                "spx-strange-current-candidate",
                "spx-strange-current-selected",
                "spx-strange-pack-paused"
            );
            element.querySelectorAll(".spx-cap-selection-mark").forEach(marker=>marker.remove());
            element.querySelectorAll(".spx-venom-card-mark").forEach(marker=>marker.remove());
            element.removeAttribute("data-cyclops-tags");
            element.removeAttribute("data-cyclops-replacement");
        });
        document.querySelectorAll(".spx-venom-deck-frame").forEach(frame=>frame.remove());

        if(wasActive && options.refresh!==false){
            adapter?.refreshDecks?.();
            if(["spider_man","rocket","doctor_strange"].includes(cancelledPower)) adapter?.refreshPack?.();
        }
        if(wasActive && !options.silent){
            const cancelTitles={
                loki:"ILUZJA ANULOWANA",
                captain_america:"TARCZE SCHOWANE",
                venom:"SYMBIONT ODPUSZCZA",
                spider_man:"SIEĆ SCHOWANA",
                hulk:"SMASH ANULOWANY",
                cyclops:"WEZWANIE ANULOWANE",
                professor_x:"PRZEKAZ MYŚLI ANULOWANY",
                rocket:"BOMBY SCHOWANE",
                doctor_strange:"PORTAL ZAMKNIĘTY",
                jeff:"FALA ZATRZYMANA",
                doctor_doom:"KUŹNIA ZAMKNIĘTA",
                deadpool:"DEADPOOL ODPUSZCZA",
                iron_man:"REAKTOR WYŁĄCZONY"
            };
            showToast(cancelTitles[cancelledPower]||"SUPERPOWER ANULOWANA","Nie zużyto Supermocy.",{powerId:cancelledPower});
        }
        window.GraveyardUI?.refreshButton?.();
        return true;
    }

    function isDraftMutationLocked(){
        return Boolean(
            state.active ||
            window.GambitUI?.isBusy?.() ||
            window.DevilDinoUI?.isBusy?.() ||
            window.GrootUI?.isBusy?.() ||
            window.WolverineUI?.isBusy?.() ||
            window.BlackCatUI?.isBusy?.() ||
            window.IronFistUI?.isBusy?.() ||
            window.JokerV2UI?.isBusy?.() ||
            window.DraftFoundation?.hasOpenTransaction?.()
        );
    }

    function getDraftMutationLockReason(){
        if(window.GambitUI?.isBusy?.()) return window.GambitUI.getLockReason?.()||"Dokończ Kinetyczne Kasyno i Salwę Gambita.";
        if(window.DevilDinoUI?.isBusy?.()) return window.DevilDinoUI.getLockReason?.()||"Dokończ aktywne rozstrzygnięcie Devil Dino.";
        if(window.GrootUI?.isBusy?.()) return window.GrootUI.getLockReason?.()||"Dokończ sadzenie Nasion Planety X Groota.";
        if(window.JokerV2UI?.isBusy?.()) return "Najpierw dokończ wybór Jokera.";
        if(window.WolverineUI?.isBusy?.()) return window.WolverineUI.getLockReason?.()||"Dokończ Adamantiową Regenerację Wolverinea.";
        if(window.BlackCatUI?.isBusy?.()) return window.BlackCatUI.getLockReason?.()||"Dokończ KOCI HEIST Black Cat.";
        if(window.IronFistUI?.isBusy?.()) return window.IronFistUI.getLockReason?.()||"Dokończ Wyzwanie K’un-Lun.";
        if(window.DraftFoundation?.hasOpenTransaction?.()) return "Najpierw dokończ bieżące rozstrzygnięcie.";
        if(!state.active) return "";
        const activePower=getPowerDefinition(state.powerId);
        return `Najpierw dokończ albo anuluj: ${activePower?.power||activePower?.name||state.powerId}.`;
    }

    function showPower(player){
        console.log("Supermoc:",player?.superpower?.name);
    }

    function notify(text){
        showToast("SUPERPOWER",text);
    }

    window.SuperpowerFeedback=Object.freeze({
        error:(powerId,title,message)=>showFeedback("error",powerId,title,message),
        warning:(powerId,title,message)=>showFeedback("warning",powerId,title,message),
        event:(powerId,title,message)=>showFeedback("event",powerId,title,message)
    });

    function activateAnimation(player){
        console.log("Animacja aktywacji:",player?.name);
    }

    function playCaptainAmericaCounters(counters,done){
        const queue=(Array.isArray(counters)?counters:[]).filter(entry=>entry?.triggered);
        let index=0;
        const next=()=>{
            if(index>=queue.length){done?.();return;}
            playCaptainAmericaRicochet(queue[index++],next);
        };
        next();
    }

    return {
        configure,
        start,
        cancel,
        afterDecksRendered,
        afterPackRendered,
        handleDeckCardClick,
        handlePackCardClick,
        resolveRocketBomb,
        playCaptainAmericaCounters,
        isDraftMutationLocked,
        getDraftMutationLockReason,
        showPower,
        notify,
        activateAnimation,
        isOwnBusy:()=>Boolean(state.active),
        isBusy:()=>Boolean(state.active||window.GambitUI?.isBusy?.()||window.DevilDinoUI?.isBusy?.()||window.GrootUI?.isBusy?.()||window.IronFistUI?.isBusy?.()||window.WolverineUI?.isBusy?.()||window.BlackCatUI?.isBusy?.()||window.ThorUI?.isBusy?.()||window.CollectorUI?.isBusy?.())
    };
})();

window.SuperpowerUI=SuperpowerUI;
