(function(global){
    "use strict";

    const POWER_ID = "thor";
    const THOR_ASSETS = Object.freeze({
        hammerNeutral: "draft-assets/thor_mjolnir_throw.png",
        hammerCharged: "draft-assets/thor_mjolnir_charged.png",
        selectedOverlay: "draft-assets/thor_card_selected_overlay.png",
        impactOverlay: "draft-assets/thor_card_impact_overlay.png",
        sweepFrames: ["draft-assets/thor_sweep_01.png", "draft-assets/thor_sweep_02.png", "draft-assets/thor_sweep_03.png"]
    });
    const THOR_SWEEP_FRAME_MS = 125;
    const VERDICTS = {
        1: {
            title: "ODRZUCENIE",
            subtitle: "BURZA ROZBIJA PYCHĘ",
            copy: "Obie naznaczone karty zostają przelosowane w paczce.",
            odin: "Odyn odsuwa Mjolnir od dłoni Thora. Burza pozostawia po sobie tylko nowe losy.",
            summary: "Obie naznaczone karty zostały przelosowane."
        },
        2: {
            title: "CHWIEJNA GODNOŚĆ",
            subtitle: "JEDNA DŁOŃ SIĘGA PO MJOLNIR",
            copy: "Los wybiera jedną kartę, która zastąpi normalny pick Thora. Druga zostaje przelosowana.",
            odin: "Grom dopuszcza tylko jeden łup. Druga ofiara musi wrócić do wiru gwiazd.",
            summary: "Jedna karta zastąpiła pick Thora, druga została przelosowana."
        },
        3: {
            title: "GODNY WYBORU",
            subtitle: "ODYN POZWALA WSKAZAĆ ŚCIEŻKĘ",
            copy: "Thor wybiera kartę, która zastąpi jego normalny pick. Druga zostaje przelosowana.",
            odin: "Thor słyszy przychylny szept Asgardu i sam wskazuje, który łup wart jest chwili chwały.",
            summary: "Thor wybrał kartę zastępującą pick; druga została przelosowana."
        },
        4: {
            title: "BŁOGOSŁAWIEŃSTWO ASGARDU",
            subtitle: "MJOLNIR WRACA Z ŁUPEM",
            copy: "Thor wybiera jeden dodatkowy łup do decku. Druga karta zostaje przelosowana.",
            odin: "Burza nagradza odwagę. Mjolnir wraca z darem, a nie z ciężarem obowiązku.",
            summary: "Jedna karta trafiła do decku jako dodatkowa zdobycz, a druga została przelosowana."
        },
        5: {
            title: "POWRÓT MJOLNIRA Z ŁUPEM",
            subtitle: "ŁUP I GODNOŚĆ W JEDNEJ BURZY",
            copy: "Jedna karta staje się dodatkowym łupem. Druga zastępuje normalny pick Thora.",
            odin: "Thor zgarnia łup Asgardu, a zarazem wykuwa sobie drogę przez kolejny pick.",
            summary: "Jedna karta została dodatkową zdobyczą, a druga zastąpiła pick Thora."
        },
        6: {
            title: "PEŁNA GODNOŚĆ",
            subtitle: "ASGARD ODDAJE OBA ŁUPY",
            copy: "Obie karty stają się dodatkowymi łupami. Thor zachowuje wszystkie zwykłe picki.",
            odin: "To nie jest już próba. To triumf. Mjolnir wraca do swego pana z podwójnym darem.",
            summary: "Obie karty trafiły do decku jako dodatkowe zdobycze."
        }
    };

    const state = {
        active: false,
        phase: "idle",
        committing: false,
        playerName: "",
        playerIndex: -1,
        transactionId: null,
        selectedIndices: [],
        selectedCards: [],
        roll: null,
        naturalRoll: null,
        boostUsed: false,
        currentTurnMovedToEnd: false,
        consumedCurrentTurnPick: false,
        shouldAdvanceAfterSummary: false,
        pendingNormalPickCard: null,
        pendingRocketQueue: [],
        plan: null,
        summaryHtml: "",
        rollShiftInfo: null,
        returningCards: [],
        resolvedJokers: new Map()
    };

    function normalize(value){ return String(value || "").trim().toLowerCase(); }
    function escapeHtml(value){
        return String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
    }
    function publicPackCardName(card){
        return global.MysterioUI?.getPublicCardLabel?.(card) || card?.name || "ILUZJA";
    }
    function revealCommittedThorIllusions(){
        state.selectedCards.forEach(card => {
            global.MysterioUI?.revealForExternalEffect?.(card, {
                reason:"thor_mjolnir_target_committed",
                rerender:false
            });
        });
        global.showPack?.(false);
    }
    function ownDeck(){ return Array.isArray(decks?.[state.playerIndex]) ? decks[state.playerIndex] : []; }
    function currentPackList(){
        if(global.GalacticCurrentSuperpowerBridge?.isModeEnabled?.()) return global.GalacticCurrentSuperpowerBridge.getLiveCards?.()||[];
        return Array.isArray(currentPack) ? currentPack : [];
    }

    function isGalacticCurrent(){ return Boolean(global.GalacticCurrentSuperpowerBridge?.isModeEnabled?.()); }
    function flowText(classicText,currentText){ return isGalacticCurrent()?currentText:classicText; }
    function verdictCopy(verdict){
        if(!isGalacticCurrent()) return verdict?.copy||"";
        if(verdict===VERDICTS[1]) return "Obie naznaczone karty zostają przelosowane w nurcie.";
        return verdict?.copy||"";
    }
    function currentVerdict(){ return VERDICTS[Number(state.roll)] || VERDICTS[1]; }
    function isBusy(){ return Boolean(state.active); }
    function isSelectingPack(){ return state.active && state.phase === "select_pack_cards"; }
    function getLockReason(){ return state.active ? "Dokończ Test Godności Mjolnira." : ""; }

    function canUseOwnDeckSlot(card,index,simulatedDeck=null){
        if(!card) return false;
        if(card?.instanceMeta?.locked || card?.instanceMeta?.cannotReplace) return false;
        const deck = Array.isArray(simulatedDeck) ? simulatedDeck : ownDeck();
        return Boolean(deck[index]);
    }

    function getLegalDeckIndicesForIncoming(incomingCard, deckSnapshot = null, excludedIndices = []){
        const deck = Array.isArray(deckSnapshot) ? deckSnapshot : ownDeck();
        const incomingName = normalize(incomingCard?.name);
        const excluded = new Set((excludedIndices || []).map(Number));
        if(!incomingName) return [];
        const result = [];
        deck.forEach((card,index)=>{
            if(excluded.has(index) || !canUseOwnDeckSlot(card,index,deck)) return;
            const duplicate = deck.some((other,otherIndex)=>{
                if(otherIndex === index || excluded.has(otherIndex)) return false;
                return normalize(other?.name) === incomingName;
            });
            if(!duplicate) result.push(index);
        });
        return result;
    }

    function canPlaceBothCards(cardA, cardB){
        const deck = ownDeck();
        const firstOptions = getLegalDeckIndicesForIncoming(cardA, deck, []);
        for(const firstIndex of firstOptions){
            const simulated = [...deck];
            simulated[firstIndex] = cardA;
            const secondOptions = getLegalDeckIndicesForIncoming(cardB, simulated, [firstIndex]);
            if(secondOptions.length) return true;
        }
        return false;
    }

    function getPackCardBlockReason(card, playerIndex){
        if(!card) return flowText("Ta karta nie istnieje już w paczce.","Ta karta nie znajduje się już w nurcie.");
        if(typeof global.isSpiderManCardAvailableToPlayer === "function" && !global.isSpiderManCardAvailableToPlayer(card, playerIndex, currentPickIndex)) return "Pajęcza Sieć Spider-Mana rezerwuje tę kartę.";
        const strangeLock = typeof global.getDoctorStrangeLockedEffect === "function" ? global.getDoctorStrangeLockedEffect(card) : null;
        if(strangeLock && Number(strangeLock.data?.forbiddenPlayerIndex) === playerIndex) return "Portal Agamotto blokuje ten cel dla Thora.";
        return "";
    }

    function isPackCardSelectable(card, playerIndex){
        return !getPackCardBlockReason(card,playerIndex);
    }

    function getSelectablePackEntries(playerIndex){
        return currentPackList().map((card,index)=>({ card, index })).filter(entry => isPackCardSelectable(entry.card, playerIndex));
    }

    function validateSelection(cards){
        if(!Array.isArray(cards) || cards.length !== 2){
            return { ok:false, message:"Mjolnir domaga się dokładnie dwóch kart." };
        }
        const [cardA, cardB] = cards;
        const hasDeckSlot=card=>card?.joker ? ownDeck().some((entry,index)=>canUseOwnDeckSlot(entry,index)) : getLegalDeckIndicesForIncoming(card).length;
        if(!hasDeckSlot(cardA) || !hasDeckSlot(cardB)){
            return { ok:false, message:"Jedna z naznaczonych kart nie może zająć miejsca w Twoim arsenale. Wybierz inną parę." };
        }
        if(!cardA?.joker&&!cardB?.joker&&!canPlaceBothCards(cardA, cardB)){
            return { ok:false, message:"Ta para nie przechodzi najwyższej próby Odyna. Wybierz inną dwójkę kart." };
        }
        return { ok:true };
    }

    function countRemainingPicksForPlayer(playerIndex){
        if(!Array.isArray(pickOrder)) return 0;
        let count = 0;
        for(let i = currentPickIndex; i < pickOrder.length; i++){
            if(pickOrder[i] === playerIndex) count++;
        }
        return count;
    }

    function findFuturePickIndex(playerIndex){
        if(!Array.isArray(pickOrder)) return -1;
        for(let i = currentPickIndex + 1; i < pickOrder.length; i++){
            if(pickOrder[i] === playerIndex) return i;
        }
        return -1;
    }

    function verdictConsumesThorPick(roll){
        return [2,3,5].includes(Number(roll));
    }

    function findShiftablePickIndexForVerdict(roll){
        const consumes=verdictConsumesThorPick(roll);
        if(!consumes && pickOrder?.[currentPickIndex]===state.playerIndex&&!state.currentTurnMovedToEnd) return currentPickIndex;
        return findFuturePickIndex(state.playerIndex);
    }

    function hasPickToShift(nextRoll=state.roll){
        const from=findShiftablePickIndexForVerdict(nextRoll);
        return from>=0&&from<pickOrder.length-1;
    }

    function shiftNextPickToEnd(nextRoll){
        if(!Array.isArray(pickOrder)) return null;
        const from=findShiftablePickIndexForVerdict(nextRoll);
        if(from<0||from>=pickOrder.length-1) return null;
        const [token]=pickOrder.splice(from,1);
        const to=pickOrder.length;
        pickOrder.push(token);
        if(from===currentPickIndex){
            state.currentTurnMovedToEnd = true;
            return { from, to, current: true };
        }
        return { from, to, current: false };
    }

    function consumeThorPick(){
        if(!Array.isArray(pickOrder)) throw new Error("Brak kolejki draftu do rozliczenia picku Thora.");
        if(pickOrder[currentPickIndex] === state.playerIndex && !state.currentTurnMovedToEnd){
            state.consumedCurrentTurnPick = true;
            state.shouldAdvanceAfterSummary = true;
            return { mode:"current" };
        }
        const futureIndex = findFuturePickIndex(state.playerIndex);
        if(futureIndex < 0) throw new Error("Thor nie ma już picku, który można wykorzystać.");
        pickOrder.splice(futureIndex, 1);
        return { mode:"future", index: futureIndex };
    }

    function getPackRerollPool(removedCard, excludedCards = []){
        const removedName = normalize(removedCard?.name);
        const banned = new Set((Array.isArray(bannedCards) ? bannedCards : []).map(normalize));
        const excludedNames = new Set((excludedCards || []).map(card => normalize(card?.name)));
        const occupiedNames = new Set(currentPackList().filter(Boolean).map(card => normalize(card?.name)));
        return (Array.isArray(cardDatabase) ? cardDatabase : []).filter(card => {
            const name = normalize(card?.name);
            return Boolean(name && !card?.joker && name !== removedName && !banned.has(name) && !excludedNames.has(name) && !occupiedNames.has(name));
        });
    }

    function createRerolledPackCard(sourceCard, excludedCards = []){
        const pool = getPackRerollPool(sourceCard, excludedCards);
        if(!pool.length) throw new Error(`Brak kart do gwiezdnego przelosowania w miejsce: ${sourceCard?.name || "?"}.`);
        return global.createDraftCardInstance(pool[Math.floor(Math.random() * pool.length)], {
            origin: "thor_test_of_worthiness_reroll",
            sourcePowerId: POWER_ID,
            sourceEvent: "thor_pack_reroll",
            forceNew: true
        });
    }

    function canRerollBothSelectedCards(cards){
        const [cardA,cardB]=cards;
        const firstPool=getPackRerollPool(cardA,[cardB]);
        return firstPool.some(firstReplacement=>
            getPackRerollPool(cardB,[cardA,firstReplacement]).length>0
        );
    }

    function hasFullyExecutablePair(playerIndex,selectable){
        const previousPlayerIndex=state.playerIndex;
        state.playerIndex=playerIndex;
        try{
            for(let first=0;first<selectable.length-1;first++){
                for(let second=first+1;second<selectable.length;second++){
                    const cards=[selectable[first].card,selectable[second].card];
                    if(validateSelection(cards).ok&&canRerollBothSelectedCards(cards)) return true;
                }
            }
            return false;
        }finally{
            state.playerIndex=previousPlayerIndex;
        }
    }

    function preflight(playerName){
        const playerIndex = players?.indexOf(playerName);
        const data = global.SuperpowerEngine?.getPlayerData?.(playerName);
        if(state.active) return { ok:false, message:"Test Godności Mjolnira jest już w toku." };
        if(!data || data.powerId !== POWER_ID) return { ok:false, message:"Ten gracz nie włada mocą Thora." };
        if(data.used) return { ok:false, message:"Thor już wzywał dziś Mjolnira." };
        if(draftFinished) return { ok:false, message:"Draft dobiegł już końca." };
        if(!packIsOpen || packOpeningInProgress || packEnding) return { ok:false, message:flowText("Thor potrzebuje otwartej i spokojnej paczki.","Thor potrzebuje spokojnego, aktywnego nurtu.") };
        if(global.WolverineUI?.isBusy?.() || global.IronFistUI?.isBusy?.() || global.JokerV2UI?.isBusy?.() || global.SuperpowerUI?.isBusy?.() || global.DraftFoundation?.hasOpenTransaction?.()){
            return { ok:false, message:"Najpierw dokończ inną aktywną sekwencję draftu albo Supermocy." };
        }
        const selectable = getSelectablePackEntries(playerIndex);
        if(selectable.length < 2) return { ok:false, message:flowText("W tej paczce nie ma dwóch kart, które Mjolnir mógłby naznaczyć.","W aktualnym nurcie nie ma dwóch kart, które Mjolnir mógłby naznaczyć.") };
        if((decks?.[playerIndex] || []).length < 2) return { ok:false, message:"Thor potrzebuje przynajmniej dwóch kart w swoim decku, by złożyć ofiarę Asgardowi." };
        if(countRemainingPicksForPlayer(playerIndex) < 1) return { ok:false, message:flowText("Thor nie ma już picku w tej paczce.","Thor nie ma już normalnego picku do wykonania w tej kolejce.") };
        if(!hasFullyExecutablePair(playerIndex,selectable)) return { ok:false, message:flowText("W tej paczce nie ma pary kart, dla której Asgard może bezpiecznie rozstrzygnąć każdy werdykt.","W aktualnym nurcie nie ma pary kart, dla której Asgard może rozstrzygnąć każdy werdykt.") };
        return { ok:true, playerIndex, selectable };
    }

    function bindPackHudPositioning(){
        if(bindPackHudPositioning.bound) return;
        const schedule = () => global.requestAnimationFrame?.(positionPackHud) || positionPackHud();
        global.addEventListener?.("resize", schedule);
        global.addEventListener?.("scroll", schedule, true);
        bindPackHudPositioning.bound = true;
    }

    function positionPackHud(){
        const hud = document.getElementById("spxThorPackHud");
        if(!hud || hud.hidden) return;
        const anchor = document.getElementById("pack") || document.getElementById("packStage");
        if(!anchor) return;
        const rect = anchor.getBoundingClientRect();
        const width = Math.min(760, Math.max(420, rect.width - 24));
        hud.style.width = `${Math.round(width)}px`;
        hud.style.left = `${Math.round(rect.left + (rect.width - width) / 2)}px`;
        const hudHeight = hud.offsetHeight || 164;
        const top = Math.max(8, rect.top - hudHeight - 12);
        hud.style.top = `${Math.round(top)}px`;
    }

    function ensurePackHud(){
        let hud = document.getElementById("spxThorPackHud");
        if(hud) return hud;
        hud = document.createElement("div");
        hud.id = "spxThorPackHud";
        hud.className = "spx-thor-pack-hud";
        hud.hidden = true;
        hud.innerHTML = `
            <div class="spx-thor-pack-shell">
                <div class="spx-thor-pack-runes" aria-hidden="true">ᚨ ᛋ ᚷ ᚨ ᚱ ᛞ · ᛟ ᛞ ᛁ ᚾ · ᛗ ᛃ ᛟ ᛚ ᚾ ᛁ ᚱ</div>
                <div class="spx-thor-pack-kicker">TEST GODNOŚCI MJOLNIRA</div>
                <div class="spx-thor-pack-title" id="spxThorPackTitle">Asgard wstrzymuje oddech</div>
                <div class="spx-thor-pack-copy" id="spxThorPackCopy"></div>
                <div class="spx-thor-pack-picked" id="spxThorPackPicked"></div>
                <div class="spx-thor-pack-actions">
                    <button type="button" class="spx-thor-btn secondary" id="spxThorCancelPack">WYCOFAJ PRÓBĘ</button>
                    <button type="button" class="spx-thor-btn gold" id="spxThorInvoke">WEZWIJ MJOLNIR</button>
                </div>
            </div>
        `;
        document.body.appendChild(hud);
        bindPackHudPositioning();
        hud.querySelector("#spxThorCancelPack").addEventListener("click", ()=>rollbackAndReset("thor_pre_roll_cancelled"));
        hud.querySelector("#spxThorInvoke").addEventListener("click", ()=>beginRoll());
        return hud;
    }

    function showPackHud(){
        const hud = ensurePackHud();
        hud.hidden = false;
        updatePackHud();
        global.requestAnimationFrame?.(positionPackHud) || positionPackHud();
    }

    function hidePackHud(){
        const hud = document.getElementById("spxThorPackHud");
        if(hud) hud.hidden = true;
    }

    function updatePackHud(message = ""){
        const hud = ensurePackHud();
        const title = hud.querySelector("#spxThorPackTitle");
        const copy = hud.querySelector("#spxThorPackCopy");
        const picked = hud.querySelector("#spxThorPackPicked");
        const invokeBtn = hud.querySelector("#spxThorInvoke");
        const selectedCards = state.selectedIndices.map(index => currentPackList()[index]).filter(Boolean);
        const validation = selectedCards.length === 2 ? validateSelection(selectedCards) : { ok:false, message:"" };

        title.textContent = flowText("Naznacz dwie karty z paczki","Naznacz dwie karty z aktualnego nurtu");
        copy.textContent = message || (selectedCards.length < 2
            ? `${state.playerName}, wskaż dwie karty. Kliknij Mjolnir, by poznać wyrok Odyna.`
            : (validation.ok
                ? "Mjolnir jest gotów. Gdy go wezwiesz, nie będzie już odwrotu."
                : validation.message));
        picked.innerHTML = selectedCards.length
            ? selectedCards.map(card => `<span class="spx-thor-picked-chip">${escapeHtml(publicPackCardName(card))}</span>`).join("")
            : `<span class="spx-thor-picked-empty">Brak naznaczonych kart</span>`;
        const ready = selectedCards.length === 2 && validation.ok;
        invokeBtn.disabled = !ready;
        hud.classList.toggle("is-ready", ready);
        global.requestAnimationFrame?.(positionPackHud) || positionPackHud();
    }

    function ensureOverlay(){
        let overlay = document.getElementById("spxThorOverlay");
        if(overlay) return overlay;
        overlay = document.createElement("div");
        overlay.id = "spxThorOverlay";
        overlay.className = "spx-thor-overlay";
        overlay.hidden = true;
        overlay.innerHTML = `
            <section class="spx-thor-dialog" role="dialog" aria-modal="true" aria-labelledby="spxThorTitle">
                <div class="spx-thor-content">
                    <header class="spx-thor-header">
                        <img class="spx-thor-hero" src="draft-assets/thorpowershero.png" alt="Thor">
                        <div>
                            <div class="spx-thor-kicker">ZŁOTE RUNY ASGARDU · SĄD ODYNA</div>
                            <h2 class="spx-thor-title" id="spxThorTitle">TEST GODNOŚCI MJOLNIRA</h2>
                            <p class="spx-thor-lead" id="spxThorLead"></p>
                            <div class="spx-thor-rolebar" id="spxThorRolebar"></div>
                        </div>
                    </header>
                    <div id="spxThorBody"></div>
                    <div class="spx-thor-actions" id="spxThorActions"></div>
                </div>
            </section>
        `;
        document.body.appendChild(overlay);
        return overlay;
    }

    function openOverlay(){ ensureOverlay().hidden = false; }
    function closeOverlay(){ const overlay = document.getElementById("spxThorOverlay"); if(overlay) overlay.hidden = true; }

    function playAssetSequence(host, className, frames = THOR_ASSETS.sweepFrames, frameMs = THOR_SWEEP_FRAME_MS){
        if(!host || !Array.isArray(frames) || !frames.length) return;
        const baseClass = String(className || "").trim().split(/\s+/)[0];
        if(baseClass) host.querySelectorAll(`.${baseClass}`).forEach(node => node.remove());
        const image = document.createElement("img");
        image.className = className;
        image.src = frames[0];
        image.alt = "";
        image.setAttribute("aria-hidden", "true");
        host.appendChild(image);
        let frame = 0;
        const timer = global.setInterval(() => {
            frame += 1;
            if(frame >= frames.length){
                global.clearInterval(timer);
                image.classList.add("is-fading");
                global.setTimeout(() => image.remove(), 170);
                return;
            }
            image.src = frames[frame];
        }, frameMs);
    }

    function addPersistentSelectionOverlay(cardElement){
        if(!cardElement || cardElement.querySelector(".spx-thor-selected-overlay")) return;
        const overlay = document.createElement("img");
        overlay.className = "spx-thor-selected-overlay";
        overlay.src = THOR_ASSETS.selectedOverlay;
        overlay.alt = "";
        overlay.setAttribute("aria-hidden", "true");
        cardElement.appendChild(overlay);
    }

    function playCardSweep(cardElement, mode = "selection"){
        if(!cardElement) return;
        cardElement.classList.add("spx-thor-fx-active");
        playAssetSequence(cardElement, `spx-thor-card-sweep spx-thor-card-sweep-${mode}`);
        global.setTimeout(() => cardElement.classList.remove("spx-thor-fx-active"), THOR_SWEEP_FRAME_MS * 3 + 220);
    }

    function playImpactOnCardIndices(indices){
        (indices || []).forEach((packIndex, order) => {
            const cardElement = document.querySelector(`#pack [data-pack-index="${packIndex}"]`);
            if(!cardElement) return;
            global.setTimeout(() => {
                const impact = document.createElement("img");
                impact.className = "spx-thor-card-impact";
                impact.src = THOR_ASSETS.impactOverlay;
                impact.alt = "";
                impact.setAttribute("aria-hidden", "true");
                cardElement.appendChild(impact);
                playCardSweep(cardElement, "impact");
                global.setTimeout(() => impact.remove(), 760);
            }, order * 70);
        });
    }

    function runChoiceWithSweep(button, callback){
        if(!button || button.disabled) return;
        button.disabled = true;
        button.classList.add("is-thor-confirmed");
        playAssetSequence(button, "spx-thor-choice-sweep", THOR_ASSETS.sweepFrames, 110);
        global.setTimeout(() => callback?.(), 390);
    }

    function ensureCinematicLayer(){
        let layer = document.getElementById("spxThorCinematicLayer");
        if(layer) return layer;
        layer = document.createElement("div");
        layer.id = "spxThorCinematicLayer";
        layer.className = "spx-thor-cinematic-layer";
        layer.hidden = true;
        document.body.appendChild(layer);
        return layer;
    }

    function averagePoint(points){
        if(!points.length) return { x: window.innerWidth * 0.5, y: window.innerHeight * 0.3 };
        const sum = points.reduce((acc, point)=>({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
        return { x: sum.x / points.length, y: sum.y / points.length };
    }

    function elementCenter(node){
        if(!node) return null;
        const rect = node.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, rect };
    }

    function getSelectedPackPoint(){
        const nodes = state.selectedIndices
            .map(index => document.querySelector(`#pack [data-pack-index="${index}"]`))
            .filter(Boolean)
            .map(elementCenter)
            .filter(Boolean);
        if(nodes.length) return averagePoint(nodes);
        const hud = document.getElementById("spxThorPackHud");
        const center = elementCenter(hud);
        return center ? { x: center.x, y: center.y } : { x: window.innerWidth * 0.5, y: window.innerHeight * 0.28 };
    }

    function getDeckTargetPoint(){
        const deckSection = document.querySelectorAll('#decks .deck-section')[state.playerIndex];
        const center = elementCenter(deckSection);
        if(center){
            return { x: center.rect.left + center.rect.width * 0.5, y: center.rect.top + 140 };
        }
        return { x: window.innerWidth * 0.18, y: window.innerHeight * 0.78 };
    }

    function runFlightAnimation({ start, end, cardNames = [], done, returning = false, impactCardIndices = [] }){
        const layer = ensureCinematicLayer();
        const duration = returning ? 2280 : 1520;
        layer.hidden = false;
        layer.innerHTML = "";
        layer.classList.toggle("is-returning", returning);
        layer.classList.toggle("is-outbound", !returning);
        layer.style.setProperty("--thor-flight-duration", `${duration}ms`);

        const hammer = document.createElement("img");
        hammer.className = `spx-thor-cinematic-hammer ${returning ? "returning" : "outbound"}`;
        hammer.src = returning ? THOR_ASSETS.hammerCharged : THOR_ASSETS.hammerNeutral;
        hammer.alt = "Mjolnir";
        hammer.style.left = `${start.x}px`;
        hammer.style.top = `${start.y}px`;
        hammer.style.setProperty("--start-x", `${start.x}px`);
        hammer.style.setProperty("--start-y", `${start.y}px`);
        hammer.style.setProperty("--end-x", `${end.x}px`);
        hammer.style.setProperty("--end-y", `${end.y}px`);
        layer.appendChild(hammer);

        const aura = document.createElement("div");
        aura.className = "spx-thor-flight-aura";
        aura.style.left = `${start.x}px`;
        aura.style.top = `${start.y}px`;
        aura.style.setProperty("--start-x", `${start.x}px`);
        aura.style.setProperty("--start-y", `${start.y}px`);
        aura.style.setProperty("--end-x", `${end.x}px`);
        aura.style.setProperty("--end-y", `${end.y}px`);
        layer.appendChild(aura);

        const burst = document.createElement("div");
        burst.className = "spx-thor-cinematic-burst";
        burst.style.left = `${end.x}px`;
        burst.style.top = `${end.y}px`;
        layer.appendChild(burst);

        cardNames.slice(0, 2).forEach((name, index) => {
            const card = document.createElement("div");
            card.className = "spx-thor-cinematic-card";
            card.innerHTML = `<span class="spx-thor-cinematic-card-rune">⚡</span><span>${escapeHtml(name)}</span>`;
            card.style.left = `${start.x + (index === 0 ? -48 : 48)}px`;
            card.style.top = `${start.y + 32 + index * 12}px`;
            card.style.setProperty("--start-x", `${start.x + (index === 0 ? -48 : 48)}px`);
            card.style.setProperty("--start-y", `${start.y + 32 + index * 12}px`);
            card.style.setProperty("--end-x", `${end.x + (index === 0 ? -38 : 38)}px`);
            card.style.setProperty("--end-y", `${end.y + 14 + index * 10}px`);
            card.style.animationDelay = `${90 + 90 * index}ms`;
            layer.appendChild(card);
        });

        requestAnimationFrame(() => {
            layer.classList.add("is-active");
            hammer.classList.add("fly");
            aura.classList.add("fly");
            burst.classList.add("flash");
            layer.querySelectorAll(".spx-thor-cinematic-card").forEach(card => card.classList.add("fly"));
        });

        if(!returning && impactCardIndices.length){
            global.setTimeout(() => playImpactOnCardIndices(impactCardIndices), Math.round(duration * 0.73));
        }

        const cleanup = () => {
            layer.classList.remove("is-active", "is-returning", "is-outbound");
            layer.hidden = true;
            layer.innerHTML = "";
            done?.();
        };
        global.setTimeout(cleanup, duration + 220);
    }

    function playThrowToPack(done){
        const start = { x: Math.max(140, window.innerWidth * 0.16), y: window.innerHeight * 0.82 };
        const end = getSelectedPackPoint();
        runFlightAnimation({ start, end, impactCardIndices:[...state.selectedIndices], done });
    }

    function playReturnToDeck(done){
        const start = getSelectedPackPoint();
        const end = getDeckTargetPoint();
        runFlightAnimation({
            start,
            end,
            returning:true,
            cardNames: state.returningCards || [],
            done
        });
    }

    function setFrame({ title, lead, bodyHtml = "", actions = [], badges = [] }){
        const overlay = ensureOverlay();
        overlay.querySelector("#spxThorTitle").textContent = title;
        overlay.querySelector("#spxThorLead").textContent = lead;
        overlay.querySelector("#spxThorBody").innerHTML = bodyHtml;
        const badgeRoot = overlay.querySelector("#spxThorRolebar");
        badgeRoot.innerHTML = "";
        (badges || []).forEach(label => {
            const badge = document.createElement("span");
            badge.className = "spx-thor-badge";
            badge.textContent = label;
            badgeRoot.appendChild(badge);
        });
        const actionRoot = overlay.querySelector("#spxThorActions");
        actionRoot.innerHTML = "";
        (actions || []).forEach(action => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = `spx-thor-btn ${action.className || "secondary"}`;
            btn.textContent = action.label;
            btn.disabled = Boolean(action.disabled);
            btn.addEventListener("click", action.onClick);
            actionRoot.appendChild(btn);
        });
        openOverlay();
    }

    function resetInternal(){
        Object.assign(state, {
            active:false,
            phase:"idle",
            committing:false,
            playerName:"",
            playerIndex:-1,
            transactionId:null,
            selectedIndices:[],
            selectedCards:[],
            roll:null,
            naturalRoll:null,
            boostUsed:false,
            currentTurnMovedToEnd:false,
            consumedCurrentTurnPick:false,
            shouldAdvanceAfterSummary:false,
            pendingNormalPickCard:null,
            pendingRocketQueue:[],
            plan:null,
            summaryHtml:"",
            rollShiftInfo:null,
            returningCards:[],
            resolvedJokers:new Map()
        });
        hidePackHud();
        closeOverlay();
        global.GraveyardUI?.refreshButton?.();
    }

    function rollbackAndReset(reason = "thor_cancelled"){
        if(state.transactionId && global.DraftFoundation?.rollbackTransaction){
            global.DraftFoundation.rollbackTransaction(state.transactionId, { powerId:POWER_ID, reason });
        }
        resetInternal();
        global.showDecks?.();
        global.showPack?.(false);
        global.updateRoundQueueDisplay?.();
        global.GraveyardUI?.refreshButton?.();
    }

    function start(playerName){
        const check = preflight(playerName);
        if(!check.ok){ global.SuperpowerFeedback?.warning?.(POWER_ID,"MJOLNIR ODRZUCIŁ PRÓBĘ",check.message); return false; }
        const tx = global.DraftFoundation?.beginTransaction?.("thor_test_of_worthiness", {
            playerName,
            playerIndex: check.playerIndex,
            packNumber: (packStartIndex || 0) + 1,
            pickIndex: currentPickIndex
        });
        if(tx?.ok === false){ global.SuperpowerFeedback?.error?.(POWER_ID,"MJOLNIR PRZERWAŁ PRÓBĘ",tx.reason || "Nie udało się rozpocząć Testu Godności Mjolnira."); return false; }
        state.active = true;
        state.phase = "select_pack_cards";
        state.playerName = playerName;
        state.playerIndex = check.playerIndex;
        state.transactionId = tx?.transactionId || null;
        showPackHud();
        global.showPack?.(false);
        global.showDecks?.();
        global.updateRoundQueueDisplay?.();
        return true;
    }

    function handlePackCardClick(packIndex, card){
        if(!isSelectingPack()) return false;
        if(!isPackCardSelectable(card, state.playerIndex)){
            updatePackHud(getPackCardBlockReason(card,state.playerIndex)||"Burza omija tę kartę. Wybierz inną ofiarę dla Mjolnira.");
            return true;
        }
        const pos = state.selectedIndices.indexOf(packIndex);
        const selecting = pos < 0;
        if(pos >= 0){
            state.selectedIndices.splice(pos, 1);
        } else {
            if(state.selectedIndices.length >= 2) state.selectedIndices.shift();
            state.selectedIndices.push(packIndex);
        }
        updatePackHud();
        global.showPack?.(false);
        global.requestAnimationFrame(() => global.requestAnimationFrame(() => {
            afterPackRendered();
            const cardElement = document.querySelector(`#pack [data-pack-index="${packIndex}"]`);
            if(selecting && state.selectedIndices.includes(packIndex)) playCardSweep(cardElement, "selection");
        }));
        return true;
    }

    function afterPackRendered(){
        document.querySelectorAll("#pack [data-pack-index]").forEach(cardElement => {
            const packIndex = Number(cardElement.dataset.packIndex);
            const card = currentPackList()[packIndex];
            cardElement.classList.remove("spx-thor-candidate", "spx-thor-selected", "spx-thor-ineligible");
            cardElement.querySelectorAll(".spx-thor-pack-marker,.spx-thor-selected-overlay").forEach(marker => marker.remove());
            if(!isSelectingPack()) return;
            if(isPackCardSelectable(card, state.playerIndex)){
                cardElement.classList.add("spx-thor-candidate");
                if(state.selectedIndices.includes(packIndex)){
                    cardElement.classList.add("spx-thor-selected");
                    addPersistentSelectionOverlay(cardElement);
                }
            } else {
                cardElement.classList.add("spx-thor-ineligible");
            }
        });
    }

    function beginRoll(){
        const cards = state.selectedIndices.map(index => currentPackList()[index]).filter(Boolean);
        const validation = validateSelection(cards);
        if(!validation.ok){ updatePackHud(validation.message); return; }
        state.selectedCards = cards;
        state.phase = "hammer_throw_intro";
        hidePackHud();
        global.showPack?.(false);
        playThrowToPack(() => {
            state.phase = "roll_setup";
            showRollSetup();
        });
    }

    function showRollSetup(){
        const verdictTiles=[
            ["1","↻","obie"],["2","🎲","losowy pick + ↻"],["3","👉","Twój pick + ↻"],
            ["4","🎁","Łup + ↻"],["5","🎁","Łup + pick"],["6","🎁🎁","dwa Łupy"]
        ].map(([roll,icon,copy])=>`<span title="Wynik ${roll}: ${copy}"><b>${roll}</b><i>${icon}</i><small>${copy}</small></span>`).join("");
        setFrame({
            title: "TEST GODNOŚCI MJOLNIRA",
            lead: "Kliknij Mjolnir. Rzut 1–6 wyznaczy werdykt Odyna.",
            bodyHtml: `
                <div class="spx-thor-roll-stage mjolnir-stage">
                    <div class="spx-thor-hammer-wrap">
                        <button type="button" id="spxThorHammerRoll" class="spx-thor-hammer-btn" aria-label="Rzuć Mjolnirem">
                            <img id="spxThorHammer" class="spx-thor-hammer is-restless" src="draft-assets/thor_mjolnir_throw.png" alt="Mjolnir">
                            <span class="spx-thor-roll-etched" id="spxThorRollNumber">?</span>
                        </button>
                    </div>
                    <div class="spx-thor-rollbox asgardic">
                        <div class="spx-thor-roll-label">WYROK ODYNA · CZY JESTEŚ GODZIEN?</div>
                        <div class="spx-thor-roll-name" id="spxThorRollName">Kliknij Mjolnir</div>
                        <div class="spx-thor-roll-copy" id="spxThorRollCopy">Rzut odsłoni jeden z sześciu werdyktów.</div>
                        <div class="spx-thor-verdict"><strong>NAZNACZONE KARTY</strong><span>${escapeHtml(publicPackCardName(state.selectedCards[0]))} · ${escapeHtml(publicPackCardName(state.selectedCards[1]))}</span></div>
                        <div class="spx-thor-verdict-tiles" aria-label="Skrócona tablica wyroków Odyna">${verdictTiles}</div>
                    </div>
                </div>`,
            badges:["⚠️ PO RZUCIE BRAK ODWROTU"],
            actions:[{ label:"WYCOFAJ PRÓBĘ", className:"secondary", onClick:()=>rollbackAndReset("thor_pre_roll_cancelled") }]
        });
        const hammerBtn = ensureOverlay().querySelector("#spxThorHammerRoll");
        hammerBtn?.addEventListener("click", rollMjolnir, { once:true });
    }

    function rollMjolnir(){
        // The click on Mjolnir is the irreversible commit point. Until now Mysterio
        // masks the real identity; from this point Thor may reveal the marked cards.
        revealCommittedThorIllusions();
        state.phase = "rolling";
        const overlay = ensureOverlay();
        const hammerBtn = overlay.querySelector("#spxThorHammerRoll");
        const hammer = overlay.querySelector("#spxThorHammer");
        const rollNumber = overlay.querySelector("#spxThorRollNumber");
        const rollName = overlay.querySelector("#spxThorRollName");
        const rollCopy = overlay.querySelector("#spxThorRollCopy");
        if(hammerBtn) hammerBtn.disabled = true;
        hammer?.classList.remove("is-restless");
        hammer?.classList.add("is-shaking");
        if(rollCopy) rollCopy.textContent = "Runy drżą. Burza szuka prawdy w sercu Thora...";

        let ticks = 0;
        const previewTimer = global.setInterval(() => {
            const preview = (ticks % 6) + 1;
            const previewVerdict = VERDICTS[preview];
            if(rollNumber) rollNumber.textContent = String(preview);
            if(rollName) rollName.textContent = previewVerdict.title;
            ticks++;
        }, 105);

        global.setTimeout(() => {
            global.clearInterval(previewTimer);
            const roll = Math.floor(Math.random() * 6) + 1;
            state.naturalRoll = roll;
            state.roll = roll;
            const verdict = currentVerdict();
            hammer?.classList.remove("is-shaking");
            hammer?.classList.add("is-surging", "is-charged");
            if(hammer) hammer.src = THOR_ASSETS.hammerCharged;
            if(rollNumber) rollNumber.textContent = String(roll);
            if(rollName) rollName.textContent = verdict.title;
            if(rollCopy) rollCopy.textContent = verdictCopy(verdict);
            global.setTimeout(() => showResolvedRoll(), 480);
        }, 1700);
    }

    function canBoostRoll(){
        return !state.boostUsed && Number(state.roll) >= 1 && Number(state.roll) <= 4 && hasPickToShift(Math.min(5,Number(state.roll)+1));
    }

    function boostRoll(){
        if(!canBoostRoll()) return;
        const before = Number(state.roll);
        const nextRoll=Math.min(5,before+1);
        const shift = shiftNextPickToEnd(nextRoll);
        if(!shift) return;
        state.boostUsed = true;
        state.rollShiftInfo = shift;
        state.currentTurnMovedToEnd = state.currentTurnMovedToEnd || Boolean(shift.current);
        state.roll = nextRoll;
        if(shift.current) state.shouldAdvanceAfterSummary = true;
        global.updateRoundQueueDisplay?.();
        global.showDecks?.();
        global.showPack?.(false);
        showResolvedRoll();
    }

    function showResolvedRoll(){
        state.phase = "roll_resolved";
        const verdict = currentVerdict();
        const shiftNote = state.rollShiftInfo
            ? `<div class="spx-thor-mini-note">⚡ Asgardzka Nieustępliwość: wynik ${escapeHtml(state.naturalRoll)} → ${escapeHtml(state.roll)}. ${escapeHtml(flowText("Twój najbliższy pick przesuwa się na koniec paczki.","Twój najbliższy wybór przesuwa się na koniec aktualnej kolejki."))}</div>`
            : "";
        setFrame({
            title: verdict.title,
            lead: verdictCopy(verdict),
            bodyHtml: `
                <div class="spx-thor-roll-stage mjolnir-stage">
                    <div class="spx-thor-hammer-wrap static">
                        <div class="spx-thor-hammer-btn static-display">
                            <img class="spx-thor-hammer is-surging is-charged" src="draft-assets/thor_mjolnir_charged.png" alt="Mjolnir">
                            <span class="spx-thor-roll-etched">${escapeHtml(state.roll)}</span>
                        </div>
                    </div>
                    <div class="spx-thor-rollbox asgardic">
                        <div class="spx-thor-roll-label">OSĄD ODYNA</div>
                        <div class="spx-thor-roll-name">${escapeHtml(verdict.subtitle)}</div>
                        <div class="spx-thor-verdict"><strong>NAZNACZONE KARTY</strong><span>${escapeHtml(state.selectedCards[0].name)} · ${escapeHtml(state.selectedCards[1].name)}</span></div>
                        ${shiftNote}
                    </div>
                </div>`,
            badges:[`WYNIK ${state.roll}`, "WERDYKT ODYNA"],
            actions:[
                canBoostRoll()
                    ? { label:"⚡ ASGARDZKA NIEUSTĘPLIWOŚĆ (+1)", className:"gold", onClick: boostRoll }
                    : null,
                { label:"PRZYJMIJ WERDYKT", className:"primary", onClick: advanceByRoll }
            ].filter(Boolean)
        });
    }

    function roleChoiceHtml(text){
        return `<div class="spx-thor-choice-box"><h3>SĄD MJOLNIRA</h3><p>${text}</p></div>`;
    }

    function showChooseBetweenSelected({ title, lead, helper, actionLabel, onChoose }){
        const cardsHtml = state.selectedCards.map((card,index)=>`
            <button type="button" class="spx-thor-card" data-choice-index="${index}">
                <span class="spx-thor-mark">NAZNACZONA</span>
                <strong>${escapeHtml(card.name)}</strong>
                <span>${escapeHtml(card.cost)} KOSZT · ${escapeHtml(card.power)} SIŁA</span>
                <small>${escapeHtml(actionLabel)}</small>
            </button>`).join("");
        setFrame({
            title,
            lead,
            bodyHtml: `${roleChoiceHtml(helper)}<div class="spx-thor-grid">${cardsHtml}</div>`,
            badges:[`WYNIK ${state.roll}`, currentVerdict().subtitle, "ODYN CZEKA"],
            actions:[]
        });
        ensureOverlay().querySelectorAll(".spx-thor-card").forEach(button => button.addEventListener("click", () => {
            const chosenIndex = Number(button.dataset.choiceIndex);
            runChoiceWithSweep(button, () => onChoose(chosenIndex));
        }));
    }

    function showChooseSingleDeckReplacement(incomingCard, seed = {}){
        const legalIndices = getLegalDeckIndicesForIncoming(incomingCard);
        const deckHtml = legalIndices.map(index => {
            const card = ownDeck()[index];
            return `<button type="button" class="spx-thor-card" data-deck-index="${index}"><span class="spx-thor-mark">DECK</span><strong>${escapeHtml(card.name)}</strong><span>${escapeHtml(card.cost)} KOSZT · ${escapeHtml(card.power)} SIŁA</span><small>Ta karta ustąpi miejsca łupowi Asgardu.</small></button>`;
        }).join("");
        setFrame({
            title: currentVerdict().title,
            lead: `${currentVerdict().odin} Wskaż kartę z własnego decku, która odda miejsce dla: ${incomingCard.name}.`,
            bodyHtml: `${roleChoiceHtml(`<b>${escapeHtml(incomingCard.name)}</b> wróci z Mjolnirem do Twojego decku. Wybierz kartę, którą poświęcisz.`)}<div class="spx-thor-grid deck">${deckHtml}</div>`,
            badges:[`WYNIK ${state.roll}`, "ŁUP ASGARDU", "BEZ ODWROTU"],
            actions:[]
        });
        ensureOverlay().querySelectorAll(".spx-thor-card").forEach(button => button.addEventListener("click", ()=>{
            const replacementIndex = Number(button.dataset.deckIndex);
            runChoiceWithSweep(button, () => {
                state.plan = Object.assign({}, seed, {
                    deckAcquisitions: [{ incomingCard, replacementIndex, refillSlot: true }]
                });
                commitPlan();
            });
        }));
    }

    function chooseReplacementSequence(queue, chosen, onDone){
        const step = chosen.length;
        if(step >= queue.length){ onDone(chosen); return; }
        const simulated = [...ownDeck()];
        chosen.forEach(item => { simulated[item.replacementIndex] = item.incomingCard; });
        const target = queue[step];
        const legalIndices = getLegalDeckIndicesForIncoming(target.incomingCard, simulated, chosen.map(item => item.replacementIndex));
        const deckHtml = legalIndices.map(index => {
            const card = simulated[index];
            return `<button type="button" class="spx-thor-card" data-deck-index="${index}"><span class="spx-thor-mark">DECK</span><strong>${escapeHtml(card.name)}</strong><span>${escapeHtml(card.cost)} KOSZT · ${escapeHtml(card.power)} SIŁA</span><small>Ta karta ustąpi miejsca dla: ${escapeHtml(target.incomingCard.name)}.</small></button>`;
        }).join("");
        setFrame({
            title: currentVerdict().title,
            lead: `${currentVerdict().odin} Wybierz ${step === 0 ? "pierwszą" : "drugą"} kartę decku do wymiany.`,
            bodyHtml: `${roleChoiceHtml(`<b>${escapeHtml(target.incomingCard.name)}</b> wraca z Mjolnirem do Twojego arsenału.`)}<div class="spx-thor-grid deck">${deckHtml}</div>`,
            badges:[`WYNIK ${state.roll}`, step === 0 ? "PIERWSZY ŁUP" : "DRUGI ŁUP", "RUNY ASGARDU"],
            actions:[]
        });
        ensureOverlay().querySelectorAll(".spx-thor-card").forEach(button => button.addEventListener("click", ()=>{
            const replacementIndex = Number(button.dataset.deckIndex);
            runChoiceWithSweep(button, () => {
                chooseReplacementSequence(queue, [...chosen, { incomingCard:target.incomingCard, replacementIndex, refillSlot:true }], onDone);
            });
        }));
    }

    function advanceByRoll(){
        if(!state.active) return;
        const roll = Number(state.roll);
        const [cardA, cardB] = state.selectedCards;
        if(roll === 1){
            state.plan = { rerollCards:[cardA, cardB], deckAcquisitions:[], normalPickCard:null };
            commitPlan();
            return;
        }
        if(roll === 2){
            const chosenIndex = Math.random() < 0.5 ? 0 : 1;
            const chosen = state.selectedCards[chosenIndex];
            const reroll = state.selectedCards[chosenIndex === 0 ? 1 : 0];
            state.plan = { rerollCards:[reroll], deckAcquisitions:[], normalPickCard:chosen };
            commitPlan();
            return;
        }
        if(roll === 3){
            showChooseBetweenSelected({
                title: currentVerdict().title,
                lead: currentVerdict().odin,
                helper: flowText("Wskaż kartę, która ma zastąpić normalny pick Thora. Druga oznaczona karta paczki zostanie przelosowana.","Wskaż kartę, która ma zastąpić normalny pick Thora. Druga naznaczona karta nurtu zostanie przelosowana."),
                actionLabel: "Ta karta zastąpi normalny pick.",
                onChoose: (chosenIndex) => {
                    const chosen = state.selectedCards[chosenIndex];
                    const reroll = state.selectedCards[chosenIndex === 0 ? 1 : 0];
                    state.plan = { rerollCards:[reroll], deckAcquisitions:[], normalPickCard:chosen };
                    commitPlan();
                }
            });
            return;
        }
        if(roll === 4){
            showChooseBetweenSelected({
                title: currentVerdict().title,
                lead: currentVerdict().odin,
                helper: flowText("Wskaż kartę, która ma wrócić z Mjolnirem jako dodatkowy łup. Druga oznaczona karta paczki zostanie przelosowana.","Wskaż kartę, która ma wrócić z Mjolnirem jako dodatkowy łup. Druga naznaczona karta nurtu zostanie przelosowana."),
                actionLabel: "Ta karta stanie się dodatkowym łupem.",
                onChoose: (chosenIndex) => {
                    const extra = state.selectedCards[chosenIndex];
                    const reroll = state.selectedCards[chosenIndex === 0 ? 1 : 0];
                    showChooseSingleDeckReplacement(extra, { rerollCards:[reroll], normalPickCard:null });
                }
            });
            return;
        }
        if(roll === 5){
            showChooseBetweenSelected({
                title: currentVerdict().title,
                lead: currentVerdict().odin,
                helper: "Wskaż kartę, która ma stać się dodatkowym łupem. Druga zastąpi normalny pick Thora.",
                actionLabel: "Ta karta stanie się dodatkowym łupem.",
                onChoose: (chosenIndex) => {
                    const extra = state.selectedCards[chosenIndex];
                    const normal = state.selectedCards[chosenIndex === 0 ? 1 : 0];
                    showChooseSingleDeckReplacement(extra, { rerollCards:[], normalPickCard:normal });
                }
            });
            return;
        }
        chooseReplacementSequence([
            { incomingCard: cardA },
            { incomingCard: cardB }
        ], [], acquisitions => {
            state.plan = { rerollCards:[], deckAcquisitions: acquisitions, normalPickCard:null };
            commitPlan();
        });
    }

    function rerollPackCard(card){
        const packIndex = currentPackList().indexOf(card);
        if(packIndex < 0) throw new Error(flowText(`Nie udało się odnaleźć karty paczki do przelosowania: ${card?.name || "?"}.`,`Nie udało się odnaleźć karty nurtu do przelosowania: ${card?.name || "?"}.`));
        const replacement = createRerolledPackCard(card, state.selectedCards);
        global.clearDoctorStrangeLockForCard?.(card, "thor_pack_reroll");
        let result;
        if(global.GalacticCurrentSuperpowerBridge?.isModeEnabled?.()){
            global.DraftFoundation?.resolvePackCardLifecycle?.("trueReplacement",card,{fromZone:"current",toZone:"current",reason:"thor_test_of_worthiness_reroll",powerId:POWER_ID,replacementCard:replacement});
            global.removeRocketBombWithCard?.(card,"thor_pack_reroll",{replacementPowerId:POWER_ID,replacementCard:replacement.name});
            result=global.GalacticCurrentSuperpowerBridge.replaceLiveCard?.(packIndex,replacement,{source:"thor_test_of_worthiness_reroll",inheritFlowAge:true,render:false});
            if(result?.ok){
                global.MysterioUI?.transferIllusion?.(card,replacement,{reason:"thor_pack_reroll",targetPosition:packIndex});
                global.DraftFoundation?.archiveCardToGraveyard?.("rerolled",card,{previousOwner:null,source:"thor_test_of_worthiness_reroll",powerId:POWER_ID,recoverable:true,skipGrootHarvest:true,metadata:{replacementCardInstanceId:replacement.instanceId||null,draftMode:"galactic_current"}});
            }
        }else{
            result = (global.replaceCardInArray || global.DraftFoundation?.replaceCardInArray)?.({
                container: currentPack,index: packIndex,replacement,preserveReplacementInstance: true,origin: "thor_test_of_worthiness_reroll",powerId: POWER_ID,eventType: "thor_pack_rerolled",reason: "thor_test_of_worthiness_reroll",zone: "pack",graveyardCategory: "rerolled",previousOwner: null,recoverable: true
            });
        }
        if(!result?.ok) throw new Error(`Nie udało się przelosować karty: ${card?.name || "?"}.`);
        return { removedCard: card, replacementCard: replacement, packIndex };
    }

    function resolvedThorCard(sourceCard){
        return state.resolvedJokers.get(String(sourceCard?.instanceId||""))||sourceCard;
    }

    function resolvePlanJokers(onDone){
        const plan=state.plan||{};
        const candidates=[...(plan.deckAcquisitions||[]).map(item=>item.incomingCard),plan.normalPickCard]
            .filter(card=>card?.joker&&!state.resolvedJokers.has(String(card?.instanceId||"")));
        const sourceCard=candidates[0];
        if(!sourceCard){onDone?.();return true;}
        state.committing=true;
        const opened=global.JokerV2UI?.resolveForEffect?.(sourceCard,{
            playerIndex:state.playerIndex,
            sourceZone:"pack",
            sourcePowerId:POWER_ID,
            sourceEvent:"thor_actual_acquisition_joker",
            onResolve:resolved=>{
                state.resolvedJokers.set(String(sourceCard.instanceId||""),resolved);
                state.committing=false;
                resolvePlanJokers(onDone);
            },
            onCancel:()=>{
                state.committing=false;
                rollbackAndReset("thor_joker_resolution_cancelled");
            }
        });
        if(!opened){
            state.committing=false;
            throw new Error("Jokera nie można teraz rozstrzygnąć.");
        }
        return true;
    }

    function acquirePackCardToDeck(incomingCard, replacementIndex, refillSlot){
        const packIndex = currentPackList().indexOf(incomingCard);
        if(packIndex < 0) throw new Error(flowText(`Wybrana karta zniknęła z paczki: ${incomingCard?.name || "?"}.`,`Wybrana karta opuściła nurt: ${incomingCard?.name || "?"}.`));
        global.clearDoctorStrangeLockForCard?.(incomingCard, "thor_pack_to_deck");
        let refillCard = null;
        if(global.GalacticCurrentSuperpowerBridge?.isModeEnabled?.()){
            if(refillSlot){
                refillCard = createRerolledPackCard(incomingCard, state.selectedCards);
                const replaced=global.GalacticCurrentSuperpowerBridge.replaceLiveCard?.(packIndex,refillCard,{source:"thor_pack_refill",inheritFlowAge:true,render:false});
                if(!replaced?.ok) throw new Error(`Nie udało się uzupełnić nurtu po ${incomingCard?.name || "?"}.`);
                global.MysterioUI?.transferIllusion?.(incomingCard, refillCard, {reason:"thor_pack_refill",targetPosition:packIndex});
            }else{
                const consumed=global.GalacticCurrentSuperpowerBridge.consumeLiveCard?.(packIndex,{refill:true,source:"thor_pack_loot",generationKind:"thor_pack_loot_refill",render:false});
                if(!consumed?.ok) throw new Error(`Nie udało się wyjąć ${incomingCard?.name || "?"} z nurtu.`);
                refillCard=consumed.refillCard||null;
            }
        }else if(refillSlot){
            refillCard = createRerolledPackCard(incomingCard, state.selectedCards);
            currentPack[packIndex] = refillCard;
            global.MysterioUI?.transferIllusion?.(incomingCard, refillCard, {reason:"thor_pack_refill",targetPosition:packIndex});
        } else {
            currentPack.splice(packIndex, 1);
        }
        const resolvedCard=resolvedThorCard(incomingCard);
        const result = (global.acquireCardToDeck || global.DraftFoundation?.acquireCardToDeck)?.({
            playerIndex: state.playerIndex,
            sourceCard: incomingCard,
            resolvedCard:resolvedCard===incomingCard?null:resolvedCard,
            preserveInstance: true,
            replacementIndex,
            sourceZone: "pack",
            acquisitionType: "thor_pack_to_deck",
            reason: "thor_test_of_worthiness_deck_acquisition",
            powerId: POWER_ID,
            eventType: "thor_card_acquired_to_deck",
            graveyardCategory: "replaced",
            recoverable: true,
            graveyardMetadata: { sourcePowerId: POWER_ID }
        });
        if(!result?.ok) throw new Error(`Nie udało się wprowadzić ${incomingCard?.name || "?"} do decku.`);
        global.archivePendingJokerRejections?.(result.resultCard,{source:"thor_actual_acquisition_joker",powerId:POWER_ID});
        global.updateRocketBombCardZone?.(result.resultCard, "deck", { ownerIndex: state.playerIndex, playerIndex: state.playerIndex, source:"thor_pack_to_deck" });
        return { result, refillCard };
    }

    function takePackCardAsNormalPick(card){
        const packIndex = currentPackList().indexOf(card);
        if(packIndex < 0) throw new Error(`Nie udało się pobrać normalnego picku: ${card?.name || "?"}.`);
        global.clearDoctorStrangeLockForCard?.(card, "thor_normal_pick");
        const resolvedCard=resolvedThorCard(card);
        let rocketResult=null;
        if(global.GalacticCurrentSuperpowerBridge?.isModeEnabled?.()){
            const result=global.GalacticCurrentSuperpowerBridge.resolveExternalNormalPick?.(packIndex,state.playerIndex,resolvedCard,{powerId:POWER_ID,render:false,allowDeferredTurn:true});
            if(!result?.ok) throw new Error(result?.reason||`Nie udało się pobrać normalnego picku: ${card?.name || "?"}.`);
            rocketResult=result.rocketResult||null;
        }else{
            const questPackSnapshotBeforePick=global.DraftQuestEngine?.capturePackSnapshot?.(currentPackList())||null;
            global.finalizeSpiderManPackPick?.(state.playerIndex, card);
            global.DraftFoundation?.resolvePackCardLifecycle?.("acquire",card,{fromZone:"pack",toZone:"deck",reason:"thor_normal_pick",powerId:POWER_ID});
            (decks?.[state.playerIndex] || []).push(resolvedCard);
            global.consumeProfessorXControl?.(state.playerIndex, resolvedCard);
            currentPack.splice(packIndex, 1);
            global.recordDraftPickEvent?.(state.playerIndex, resolvedCard, packIndex, "pack", { data:{ source:"thor_normal_pick" }, resultCard: resolvedCard, sourceCard: card, questContext:{packSnapshotBeforePick:questPackSnapshotBeforePick,pickedPackIndex:packIndex} });
            rocketResult = global.resolveRocketBombAfterPick?.(state.playerIndex, card,resolvedCard);
        }
        global.archivePendingJokerRejections?.(resolvedCard,{source:"thor_normal_pick_joker",powerId:POWER_ID});
        consumeThorPick();
        return { pickedCard: resolvedCard, rocketResult };
    }

    function queueRocketResult(result){
        if(result?.triggered) state.pendingRocketQueue.push(result);
    }

    function commitPlan(){
        if(state.committing) return;
        const plan=state.plan||{};
        const hasUnresolvedJoker=[...(plan.deckAcquisitions||[]).map(item=>item.incomingCard),plan.normalPickCard]
            .some(card=>card?.joker&&!state.resolvedJokers.has(String(card?.instanceId||"")));
        if(hasUnresolvedJoker){
            try{return resolvePlanJokers(()=>commitPlan());}catch(error){rollbackAndReset("thor_joker_resolution_failed");global.SuperpowerFeedback?.error?.(POWER_ID,"MJOLNIR PRZERWAŁ PRÓBĘ",error.message||"Nie udało się rozstrzygnąć Jokera.");return false;}
        }
        state.committing = true;
        const rerolls = [];
        const deckAdds = [];
        let normalPick = null;
        try{
            (plan.rerollCards || []).forEach(card => rerolls.push(rerollPackCard(card)));
            (plan.deckAcquisitions || []).forEach(entry => {
                const acquired = acquirePackCardToDeck(entry.incomingCard, entry.replacementIndex, Boolean(entry.refillSlot));
                deckAdds.push({
                    incomingCard: acquired.result.resultCard || entry.incomingCard,
                    replacedCard: acquired.result.previousCard,
                    replacementIndex: entry.replacementIndex,
                    packIndex: currentPackList().indexOf(acquired.refillCard),
                    refillCard: acquired.refillCard || null
                });
                queueRocketResult(acquired.result.rocketResult);
            });
            if(plan.normalPickCard){
                const picked = takePackCardAsNormalPick(plan.normalPickCard);
                normalPick = { card:picked.pickedCard };
                state.pendingNormalPickCard = picked.pickedCard;
                queueRocketResult(picked.rocketResult);
            }

            state.returningCards = [
                ...deckAdds.map(item => item.incomingCard?.name).filter(Boolean),
                ...(normalPick?.card?.name ? [normalPick.card.name] : [])
            ];

            const verdict = currentVerdict();
            const payload = {
                roll: state.roll,
                naturalRoll: state.naturalRoll,
                boosted: state.boostUsed,
                verdict: verdict.title,
                selectedCards: state.selectedCards.map(card => card?.name).filter(Boolean),
                rerolledCards: rerolls.map(item => ({ from:item.removedCard?.name, to:item.replacementCard?.name })),
                deckAcquisitions: deckAdds.map(item => ({ gained:item.incomingCard?.name, lost:item.replacedCard?.name, refill:item.refillCard?.name||null, index:item.replacementIndex })),
                normalPick: normalPick?.card?.name || null,
                packNumber: (packStartIndex || 0) + 1,
                pickIndex: currentPickIndex,
                movedPickToEnd: state.rollShiftInfo ? { from: state.rollShiftInfo.from, to: state.rollShiftInfo.to, current: state.rollShiftInfo.current } : null
            };
            const engineResult = global.SuperpowerEngine?.completeActivation?.(state.playerName, POWER_ID, payload);
            if(engineResult?.ok === false) throw new Error(engineResult.reason || "Silnik odrzucił Test Godności Mjolnira.");

            const stored = global.draftSuperpowers?.[state.playerName];
            if(stored){ stored.used = true; stored.status = "used"; }
            global.superpowerLog = global.superpowerLog || [];
            global.superpowerLog.push({
                type: "superpower_activation",
                event: "thor_test_of_worthiness",
                powerId: POWER_ID,
                playerName: state.playerName,
                playerIndex: state.playerIndex,
                roll: state.roll,
                naturalRoll: state.naturalRoll,
                boosted: state.boostUsed,
                verdict: verdict.title,
                selectedCards: state.selectedCards.map(card => card?.name).filter(Boolean),
                rerolledCards: rerolls.map(item => ({ from:item.removedCard?.name, to:item.replacementCard?.name })),
                deckAcquisitions: deckAdds.map(item => ({ gained:item.incomingCard?.name, lost:item.replacedCard?.name, refill:item.refillCard?.name||null, index:item.replacementIndex })),
                normalPick: normalPick?.card?.name || null,
                packNumber: (packStartIndex || 0) + 1,
                pickIndex: currentPickIndex,
                movedPickToEnd: state.rollShiftInfo ? { from: state.rollShiftInfo.from, to: state.rollShiftInfo.to, current: state.rollShiftInfo.current } : null,
                timestamp: new Date().toISOString()
            });

            if(state.transactionId && global.DraftFoundation?.commitTransaction){
                global.DraftFoundation.commitTransaction(state.transactionId, { powerId: POWER_ID, roll: state.roll, verdict: verdict.title });
            }
            state.transactionId = null;
            state.phase = "summary";
            state.summaryHtml = buildSummaryHtml(verdict, rerolls, deckAdds, normalPick);
            state.committing = false;
            hidePackHud();
            closeOverlay();
            if(global.GalacticCurrentSuperpowerBridge?.isModeEnabled?.()) global.GalacticCurrent?.refresh?.();
            else global.showPack?.(false);
            const asgardPackChanges = [
                ...rerolls.map(item=>item.packIndex),
                ...deckAdds.filter(item=>item.refillCard).map(item=>item.packIndex)
            ];
            global.requestAnimationFrame?.(()=>playImpactOnCardIndices(asgardPackChanges));
            const reducedMotion=Boolean(global.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
            global.setTimeout?.(()=>showSummary(),reducedMotion?180:900);
        } catch(error){
            console.error("Thor rollback:", error);
            if(state.transactionId && global.DraftFoundation?.rollbackTransaction){
                global.DraftFoundation.rollbackTransaction(state.transactionId, { powerId: POWER_ID, reason:"thor_commit_failed", message:error.message });
                state.transactionId = null;
            }
            rollbackAndReset("thor_commit_failed");
            global.SuperpowerFeedback?.error?.(POWER_ID,"⚡ MJOLNIR PRZERWAŁ PRÓBĘ","Test nie mógł zostać dokończony. Spróbuj ponownie.");
        }
    }

    function buildSummaryHtml(verdict, rerolls, deckAdds, normalPick){
        const queueNote = state.rollShiftInfo
            ? `<span>⚡ ${escapeHtml(flowText("Twój najbliższy pick przesuwa się na koniec paczki.","Twój najbliższy wybór przesuwa się na koniec aktualnej kolejki."))}</span>`
            : "";
        const packChanges = [
            ...rerolls.map(item=>({from:item.removedCard?.name,to:item.replacementCard?.name})),
            ...deckAdds.filter(item=>item.refillCard).map(item=>({from:item.incomingCard?.name,to:item.refillCard?.name}))
        ];
        return `
            <div class="spx-thor-verdict"><strong>${escapeHtml(verdict.title)}</strong><span>${escapeHtml(verdict.odin)}</span></div>
            <div class="spx-thor-summary">
                <div class="spx-thor-summary-box"><b>NAZNACZONE KARTY</b>${state.selectedCards.map(card => `<span>${escapeHtml(card.name)}</span>`).join("")}</div>
                <div class="spx-thor-summary-box"><b>🌩️ ${escapeHtml(flowText("PACZKA","NURT"))}</b>${packChanges.length ? packChanges.map(item => `<span>${escapeHtml(item.from||"?")} → ${escapeHtml(item.to||"?")}</span>`).join("") : `<span>${escapeHtml(flowText("Paczka pozostała bez zmian.","Nurt pozostał bez zmian."))}</span>`}</div>
                <div class="spx-thor-summary-box"><b>⚡ ŁUP ASGARDU</b>${normalPick ? `<span>Thor zdobył ${escapeHtml(normalPick.card.name)} zamiast normalnego picku.</span>` : `<span>Thor zachowuje swoje normalne picki.</span>`}${deckAdds.length ? deckAdds.map(item => `<span>Thor zdobył ${escapeHtml(item.incomingCard?.name || "?")}. ${escapeHtml(item.replacedCard?.name || "?")} trafia na Cmentarzysko.</span>`).join("") : ""}${queueNote}</div>
            </div>
            <div class="spx-thor-mini-note"><b>⚡ ASGARD DOKONAŁ OSĄDU I PRZELOSOWAŁ KARTY.</b> ${escapeHtml(verdict.summary)} ${state.shouldAdvanceAfterSummary ? "Po zamknięciu okna kolejka popłynie dalej." : flowText("Po zamknięciu okna wrócisz do aktualnej paczki.","Po zamknięciu okna wrócisz do aktualnego nurtu.")}</div>`;
    }

    function resolveRocketQueue(done){
        const queue = (state.pendingRocketQueue || []).filter(entry => entry?.triggered);
        let index = 0;
        const next = () => {
            if(index >= queue.length){ done?.(); return; }
            const item = queue[index++];
            if(global.SuperpowerUI?.resolveRocketBomb){
                global.SuperpowerUI.resolveRocketBomb(item, next);
            } else {
                next();
            }
        };
        next();
    }

    function showSummary(){
        setFrame({
            title: currentVerdict().title,
            lead: `Mjolnir wraca do ${state.playerName}.`,
            bodyHtml: state.summaryHtml,
            badges:[`WYNIK ${state.roll}`, currentVerdict().subtitle, "TEST ZAKOŃCZONY"],
            actions:[{ label:"WRÓĆ DO DRAFTU", className:"gold", onClick: finalizeAfterSummary }]
        });
    }

    function finalizeAfterSummary(){
        hidePackHud();
        closeOverlay();
        const shouldAdvance = Boolean(state.shouldAdvanceAfterSummary);
        const finish = () => {
            global.showDecks?.();
            global.showPack?.(false);
            global.updateRoundQueueDisplay?.();
            const stillAdvance = shouldAdvance;
            resetInternal();
            global.GraveyardUI?.refreshButton?.();
            if(stillAdvance){
                if(global.GalacticCurrentSuperpowerBridge?.isModeEnabled?.()) global.GalacticCurrentSuperpowerBridge.advanceExternalTurn?.();
                else global.nextPickOrPack?.();
            }else {
                global.showDecks?.();
                global.showPack?.(false);
                global.updateRoundQueueDisplay?.();
            }
        };
        const continueAfterFlight = () => resolveRocketQueue(finish);
        playReturnToDeck(continueAfterFlight);
    }

    global.ThorUI = {
        start,
        isBusy,
        isSelectingPack,
        getLockReason,
        handlePackCardClick,
        afterPackRendered,
        reset: ()=>rollbackAndReset("thor_manual_reset")
    };
})(window);
