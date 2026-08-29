/* ============================================================
   MSP SNAP DRAFT — CEREBRO AUTOPILOT
   PATCH 60 • Version 1.2

   Zakres pierwszej wersji:
   - wybór graczy sterowanych przez Cerebro w lobby,
   - przejęcie / oddanie kontroli bezpośrednio na decku,
   - automatyczne zwykłe picki oraz rozstrzyganie Jokerów,
   - bez automatycznego używania Supermocy,
   - scoring: archetypy > mechaniki > brakujące koszty,
   - tagi drużynowe, tematyczne, serii i specjalne są ignorowane.
============================================================ */
(function(){
    "use strict";

    const VERSION = "1.4.0-tags-v2-galactic-current";
    const CONTROL_HUMAN = "human";
    const CONTROL_CEREBRO = "cerebro";
    const PICK_DELAY_MS = 1900;
    const DECISION_PREVIEW_MS = 1450;
    const BUSY_RETRY_MS = 850;
    const PICK_COMMIT_CHECK_MS = 1700;
    const JOKER_MODAL_SETTLE_MS = 1200;
    const JOKER_OPTION_PREVIEW_MS = 1400;
    const JOKER_CONFIRM_DELAY_MS = 850;

    const lobbyControlByName = new Map();
    let runtimeControlByPlayer = [];
    let pendingTimer = null;
    let pendingTurnKey = null;
    let featureEnabled = false;
    let patched = false;
    let toastTimer = null;
    let manualOverrideGuardInstalled = false;
    const failedEntriesByTurn = new Map();

    const CATEGORY_WEIGHTS = Object.freeze({
        deckArchetypes: 1,
        mechanicFamilies: 1,
        subtypes: 1,
        abilityTypes: 1
    });

    const JOKER_RARITY_SCORE = Object.freeze({
        rare: 24,
        epic: 52,
        legendary: 86
    });

    function getPlayers(){
        return typeof players !== "undefined" && Array.isArray(players)
            ? players
            : (Array.isArray(window.players) ? window.players : []);
    }

    function getDecks(){
        return typeof decks !== "undefined" && Array.isArray(decks)
            ? decks
            : (Array.isArray(window.decks) ? window.decks : []);
    }

    function getLobbyPlayers(){
        return typeof draftPlayers !== "undefined" && Array.isArray(draftPlayers)
            ? draftPlayers
            : (Array.isArray(window.draftPlayers) ? window.draftPlayers : []);
    }

    function getPack(){
        const current=window.GalacticCurrent?.getState?.();
        if(current?.active && Array.isArray(current.cards)) return current.cards;
        return typeof currentPack !== "undefined" && Array.isArray(currentPack)
            ? currentPack
            : (Array.isArray(window.currentPack) ? window.currentPack : []);
    }

    function getPickIndex(){
        return typeof currentPickIndex !== "undefined"
            ? Number(currentPickIndex || 0)
            : Number(window.currentPickIndex || 0);
    }

    function getPackIndex(){
        return typeof packStartIndex !== "undefined"
            ? Number(packStartIndex || 0)
            : Number(window.packStartIndex || 0);
    }

    function getPickOrder(){
        return typeof pickOrder !== "undefined" && Array.isArray(pickOrder)
            ? pickOrder
            : (Array.isArray(window.pickOrder) ? window.pickOrder : []);
    }

    function getDraftFinished(){
        return typeof draftFinished !== "undefined"
            ? Boolean(draftFinished)
            : Boolean(window.draftFinished);
    }

    function getPackIsOpen(){
        return typeof packIsOpen !== "undefined"
            ? Boolean(packIsOpen)
            : Boolean(window.packIsOpen);
    }

    function getPackOpeningInProgress(){
        return typeof packOpeningInProgress !== "undefined"
            ? Boolean(packOpeningInProgress)
            : Boolean(window.packOpeningInProgress);
    }

    function getPackEnding(){
        return typeof packEnding !== "undefined"
            ? Boolean(packEnding)
            : Boolean(window.packEnding);
    }

    function normalizeName(name){
        return String(name || "")
            .trim()
            .toLocaleLowerCase("pl")
            .replace(/\s+/g, " ");
    }

    function getFeatureEnabled(){
        return Boolean(featureEnabled);
    }

    function getLobbyControl(name){
        if(!featureEnabled) return CONTROL_HUMAN;
        return lobbyControlByName.get(normalizeName(name)) || CONTROL_HUMAN;
    }

    function setLobbyControl(name, mode){
        if(!featureEnabled) return;
        const key = normalizeName(name);
        if(!key) return;
        lobbyControlByName.set(
            key,
            mode === CONTROL_CEREBRO ? CONTROL_CEREBRO : CONTROL_HUMAN
        );
    }

    function refreshAllDecorations(){
        decorateLobby();
        decorateDeckControls();
        decorateQueue();
        decorateCurrentBanner();
    }

    function setFeatureEnabled(enabled, options={}){
        featureEnabled = Boolean(enabled);
        const checkbox = document.getElementById("enableCerebro");
        if(checkbox && checkbox.checked !== featureEnabled){
            checkbox.checked = featureEnabled;
        }

        if(!featureEnabled){
            lobbyControlByName.clear();
            runtimeControlByPlayer = getPlayers().map(() => CONTROL_HUMAN);
            clearPendingPick();
        }

        if(!options.silent){
            if(typeof window.renderDraftPlayers === "function" && getLobbyPlayers().length){
                window.renderDraftPlayers();
            }
            if(typeof window.showDecks === "function" && getPlayers().length){
                window.showDecks();
            }
            if(typeof window.updateRoundQueueDisplay === "function"){
                window.updateRoundQueueDisplay();
            }
        }
        refreshAllDecorations();
        if(featureEnabled) scheduleCurrentTurn("feature_enabled");
    }

    function bindFeatureToggle(){
        const checkbox = document.getElementById("enableCerebro");
        if(!checkbox) return;
        featureEnabled = Boolean(checkbox.checked);
        if(checkbox.dataset.cerebroBound === "true") return;
        checkbox.dataset.cerebroBound = "true";
        checkbox.addEventListener("change", () => {
            setFeatureEnabled(checkbox.checked);
        });
    }

    function initializeRuntimeControls(){
        bindFeatureToggle();
        window.cerebroLog = [];
        runtimeControlByPlayer = featureEnabled
            ? getPlayers().map(name => getLobbyControl(name))
            : getPlayers().map(() => CONTROL_HUMAN);
        clearPendingPick();
        decorateDeckControls();
        decorateQueue();
        decorateCurrentBanner();
        scheduleCurrentTurn("draft_start");
    }

    function getPlayerMode(playerIndex){
        if(!featureEnabled) return CONTROL_HUMAN;
        const index = Number(playerIndex);
        if(!Number.isInteger(index)) return CONTROL_HUMAN;
        return runtimeControlByPlayer[index] || CONTROL_HUMAN;
    }

    function setPlayerMode(playerIndex, mode, options={}){
        if(!featureEnabled) return;
        const index = Number(playerIndex);
        const livePlayers = getPlayers();
        if(!Number.isInteger(index) || !livePlayers[index]) return;
        const normalizedMode = mode === CONTROL_CEREBRO ? CONTROL_CEREBRO : CONTROL_HUMAN;
        runtimeControlByPlayer[index] = normalizedMode;
        setLobbyControl(livePlayers[index], normalizedMode);
        logCerebroEvent("cerebro_control_changed",{
            playerIndex:index,
            player:livePlayers[index],
            control:normalizedMode
        });

        if(normalizedMode === CONTROL_HUMAN){
            clearPendingPick();
            showToast(`STEROWANIE ODDANE: ${livePlayers[index]}`, "human");
        }else{
            showToast(`CEREBRO PRZEJMUJE: ${livePlayers[index]}`, "cerebro");
        }

        if(!options.silent){
            if(typeof window.showDecks === "function") window.showDecks();
            if(typeof window.updateRoundQueueDisplay === "function") window.updateRoundQueueDisplay();
        }
        scheduleCurrentTurn("control_changed");
    }

    function togglePlayerMode(playerIndex){
        setPlayerMode(
            playerIndex,
            getPlayerMode(playerIndex) === CONTROL_CEREBRO
                ? CONTROL_HUMAN
                : CONTROL_CEREBRO
        );
    }

    function toggleLobbyMode(playerIndex){
        if(!featureEnabled) return;
        const lobbyPlayers = getLobbyPlayers();
        if(!lobbyPlayers.length) return;
        const name = lobbyPlayers[playerIndex];
        if(!name) return;
        const next = getLobbyControl(name) === CONTROL_CEREBRO
            ? CONTROL_HUMAN
            : CONTROL_CEREBRO;
        setLobbyControl(name, next);
        if(typeof window.renderDraftPlayers === "function"){
            window.renderDraftPlayers();
        }
    }

    function buildTagCategoryIndex(){
        const index = new Map();
        if(typeof TAGS !== "object" || !TAGS) return index;
        Object.entries(TAGS).forEach(([categoryId, entries]) => {
            if(!Array.isArray(entries)) return;
            entries.forEach(entry => {
                if(entry?.id){
                    index.set(String(entry.id).toLowerCase(), categoryId);
                }
            });
        });
        return index;
    }

    function getCostBucketIdLocal(cost){
        const value = Number(cost);
        if(value <= 1) return "0-1";
        if(value === 2) return "2";
        if(value === 3) return "3";
        if(value === 4) return "4";
        if(value === 5) return "5";
        return "6+";
    }

    function buildDeckProfile(deck){
        const safeDeck = Array.isArray(deck) ? deck.filter(Boolean) : [];
        const tagCategoryIndex = buildTagCategoryIndex();
        const tagCounts = new Map();
        const archetypeCounts = new Map();
        const costCounts = new Map([
            ["0-1",0], ["2",0], ["3",0], ["4",0], ["5",0], ["6+",0]
        ]);
        const names = new Set();

        safeDeck.forEach(card => {
            names.add(String(card?.name || "").toLocaleLowerCase("pl"));
            const bucket = getCostBucketIdLocal(card?.cost);
            costCounts.set(bucket, (costCounts.get(bucket) || 0) + 1);
            (Array.isArray(card?.tags) ? card.tags : []).forEach(rawTag => {
                const tag = String(rawTag).toLowerCase();
                const category = tagCategoryIndex.get(tag);
                if(!CATEGORY_WEIGHTS[category]) return;
                tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
                if(category === "deckArchetypes"){
                    archetypeCounts.set(tag, (archetypeCounts.get(tag) || 0) + 1);
                }
            });
        });

        const dominantArchetypes = [...archetypeCounts.entries()]
            .sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .slice(0,3)
            .map(([tag]) => tag);

        return {
            deck: safeDeck,
            size: safeDeck.length,
            names,
            tagCategoryIndex,
            tagCounts,
            archetypeCounts,
            dominantArchetypes,
            costCounts
        };
    }

    function formatTag(tag){
        return String(tag || "").replace(/-/g, " ").toUpperCase();
    }

    function scoreNormalCard(card, profile){
        if(!card || card.joker){
            return {score:-Infinity,reasons:["nieprawidłowa karta"]};
        }

        const normalizedName = String(card.name || "").toLocaleLowerCase("pl");
        if(profile.names.has(normalizedName)){
            return {score:-10000,reasons:["duplikat w decku"]};
        }

        let score = 0;
        const reasons = [];
        let archetypeMatches = 0;
        let subtypeMatches = 0;
        let abilityMatches = 0;
        const matchedArchetypes = [];
        const matchedMechanics = [];
        let relevantTagCount = 0;

        (Array.isArray(card.tags) ? card.tags : []).forEach(rawTag => {
            const tag = String(rawTag).toLowerCase();
            const category = profile.tagCategoryIndex.get(tag);
            if(!CATEGORY_WEIGHTS[category]) return;
            relevantTagCount++;
            const frequency = profile.tagCounts.get(tag) || 0;

            if(category === "deckArchetypes"){
                if(frequency > 0){
                    const tagScore = 24 + Math.min(4, frequency) * 12;
                    score += tagScore;
                    archetypeMatches++;
                    matchedArchetypes.push(`${formatTag(tag)} ×${frequency}`);
                    if(profile.dominantArchetypes.includes(tag)) score += 10;
                }else if(profile.size <= 1){
                    score += 2;
                }
                return;
            }

            if(category === "mechanicFamilies" && frequency > 0){
                score += 14 + Math.min(4, frequency) * 7;
                subtypeMatches++;
                matchedMechanics.push(formatTag(tag));
                return;
            }

            if(category === "subtypes" && frequency > 0){
                score += 9 + Math.min(4, frequency) * 4;
                subtypeMatches++;
                matchedMechanics.push(formatTag(tag));
                return;
            }

            if(category === "abilityTypes" && frequency > 0){
                score += 4 + Math.min(3, frequency) * 2;
                abilityMatches++;
                matchedMechanics.push(formatTag(tag));
            }
        });

        if(archetypeMatches > 1) score += (archetypeMatches - 1) * 10;
        if(subtypeMatches > 1) score += (subtypeMatches - 1) * 4;
        if(abilityMatches > 1) score += (abilityMatches - 1) * 2;

        if(matchedArchetypes.length){
            reasons.push(matchedArchetypes.slice(0,3).join(" • "));
        }else if(matchedMechanics.length){
            reasons.push(`mechanika: ${matchedMechanics.slice(0,3).join(" • ")}`);
        }

        // Dopiero po synergiach i mechanikach Cerebro uzupełnia krzywą kosztów.
        const bucket = getCostBucketIdLocal(card.cost);
        const currentBucketCount = profile.costCounts.get(bucket) || 0;
        const targetPerBucket = 2;
        if(currentBucketCount === 0){
            const gapScore = profile.size >= 8 ? 28 : 22;
            score += gapScore;
            reasons.push(`brakujący koszt ${bucket}`);
        }else if(currentBucketCount < targetPerBucket){
            score += 9;
            reasons.push(`uzupełnia koszt ${bucket}`);
        }else if(currentBucketCount >= 4){
            score -= (currentBucketCount - 3) * 7;
        }

        // Mały tie-break jakości — nie może przebić prawdziwej synergii.
        const cost = Number(card.cost) || 0;
        const power = Number(card.power) || 0;
        score += Math.max(-4, Math.min(9, power - cost)) * 0.7;
        score += Math.min(6, relevantTagCount) * 0.45;

        if(!reasons.length){
            reasons.push(currentBucketCount === 0 ? `brakujący koszt ${bucket}` : "najlepszy wynik ogólny");
        }

        return {
            score:Number(score.toFixed(3)),
            reasons,
            details:{archetypeMatches,subtypeMatches,abilityMatches,bucket}
        };
    }

    function getJokerModeLocal(joker){
        if(typeof window.getJokerMode === "function") return window.getJokerMode(joker);
        return String(joker?.type || joker?.mode || "choice").toLowerCase();
    }

    function getJokerRarityLocal(joker){
        if(typeof window.getJokerRarity === "function") return window.getJokerRarity(joker);
        return String(joker?.rarity || "rare").toLowerCase();
    }

    function scoreJoker(joker){
        const rarity = getJokerRarityLocal(joker);
        const mode = getJokerModeLocal(joker);
        const score = 280
            + (JOKER_RARITY_SCORE[rarity] || 0)
            + (mode === "choice" ? 18 : 0);
        return {
            score,
            reasons:[`JOKER ${mode.toUpperCase()} • ${rarity.toUpperCase()}`],
            details:{rarity,mode}
        };
    }

    function scoreEntry(card, profile){
        return card?.joker ? scoreJoker(card) : scoreNormalCard(card, profile);
    }

    function isJokerPoolLegal(joker){
        if(typeof window.getJokerAvailableCards !== "function") return true;
        const pool = window.getJokerAvailableCards(joker);
        const mode = getJokerModeLocal(joker);
        return Array.isArray(pool) && pool.length >= (mode === "surprise" ? 3 : 1);
    }

    function isPackEntryLegal(card, index, playerIndex){
        if(!card) return false;
        if(card.joker && !isJokerPoolLegal(card)) return false;

        if(typeof window.getDoctorStrangeLockedEffect === "function"){
            const lock = window.getDoctorStrangeLockedEffect(card);
            if(lock && Number(lock.data?.forbiddenPlayerIndex) === playerIndex){
                return false;
            }
        }

        if(typeof window.checkSpiderManPackClick === "function"){
            const result = window.checkSpiderManPackClick({card,index,playerIndex});
            if(result && result.allowed === false) return false;
        }else if(typeof window.isSpiderManCardAvailableToPlayer === "function"){
            if(!window.isSpiderManCardAvailableToPlayer(card,playerIndex,getPickIndex())){
                return false;
            }
        }

        return true;
    }

    function getCurrentTurnKey(){
        const playerIndex = typeof window.getCurrentPlayerIndex === "function"
            ? window.getCurrentPlayerIndex()
            : getPickOrder()[getPickIndex()];
        if(!Number.isInteger(playerIndex)) return null;
        const current=window.GalacticCurrent?.getState?.();
        if(current?.active){
            const instances=getPack().map(card=>String(card?.instanceId||card?.id||card?.name||"")).join("|");
            return [
                "gc",
                Number(current.round||0),
                Number(current.pickNumber||0),
                getPickIndex(),
                playerIndex,
                instances
            ].join(":");
        }
        return [
            "classic",
            getPackIndex(),
            getPickIndex(),
            playerIndex,
            getPack().length
        ].join(":");
    }

    function rankCurrentPack(playerIndex){
        const liveDecks = getDecks();
        const deck = Array.isArray(liveDecks[playerIndex]) ? liveDecks[playerIndex] : [];
        const profile = buildDeckProfile(deck);
        const turnKey = getCurrentTurnKey();
        const failed = failedEntriesByTurn.get(turnKey) || new Set();
        const ranked = [];

        getPack().forEach((card,index) => {
            const entryKey = card?.instanceId || `${card?.name || "entry"}@${index}`;
            if(failed.has(entryKey)) return;
            if(!isPackEntryLegal(card,index,playerIndex)) return;
            // Cerebro może analizować wyłącznie informacje widoczne graczowi.
            // Przy Wielkiej Iluzji Mysterio score dostaje publiczny decoy snapshot,
            // a prawdziwa instancja służy wyłącznie do wykonania kliknięcia.
            const publicCard = window.MysterioUI?.getPublicCardSnapshot?.(card) || card;
            const result = scoreEntry(publicCard,profile);
            ranked.push({card,publicCard,index,entryKey,...result});
        });

        return ranked.sort((a,b) =>
            b.score - a.score
            || Number(b.publicCard?.power || 0) - Number(a.publicCard?.power || 0)
            || String(a.publicCard?.name || a.publicCard?.id || "").localeCompare(String(b.publicCard?.name || b.publicCard?.id || ""),"pl")
        );
    }

    function isRevealAnimationActive(){
        const pack = document.getElementById("pack");
        return Boolean(
            pack && (
                pack.classList.contains("pre-reveal") ||
                pack.classList.contains("revealing") ||
                pack.classList.contains("clearing")
            )
        );
    }

    function isVisibleBlockingElement(element){
        if(!element || element.hidden) return false;
        if(element.getAttribute?.("aria-hidden")==="true") return false;
        const style=window.getComputedStyle?.(element);
        if(style && (style.display==="none" || style.visibility==="hidden" || Number(style.opacity)===0)) return false;
        const rect=element.getBoundingClientRect?.();
        return !rect || rect.width>0 || rect.height>0;
    }

    function hasVisibleBlockingDialog(){
        const nodes=new Set();
        const selectors=[
            '[aria-modal="true"]',
            '#reshuffleOverlay',
            '#surpriseJokerModal',
            '[id^="spx"][id$="Overlay"]',
            '[id^="spx"][id$="Modal"]'
        ];
        selectors.forEach(selector=>{
            document.querySelectorAll(selector).forEach(node=>nodes.add(node));
        });
        for(const node of nodes){
            if(isVisibleBlockingElement(node)) return true;
        }
        return false;
    }

    function getBusyReason(playerIndex){
        if(getDraftFinished()) return "draft_finished";
        if(!getPackIsOpen() || getPackOpeningInProgress() || getPackEnding()) return "pack_closed";
        if(isRevealAnimationActive()) return "pack_reveal";
        const current=window.GalacticCurrent?.getState?.();
        if(current?.active && (current.isResolving || current.isFinishing)) return "galactic_current_busy";
        if(window.JokerV2UI?.isBusy?.()) return "joker_busy";
        if(window.SuperpowerUI?.isBusy?.() || window.SuperpowerUI?.isDraftMutationLocked?.()) return "superpower_busy";
        if(window.DraftFoundation?.hasOpenTransaction?.()) return "draft_transaction";
        if(window.BountyEngine?.hasPendingPresentations?.()) return "bounty_presentation";
        if(window.GraveyardUI?.isOpen?.()) return "graveyard_open";
        if(hasVisibleBlockingDialog()) return "modal_open";
        if(typeof window.getProfessorXControlForPlayer === "function"){
            const control = window.getProfessorXControlForPlayer(playerIndex);
            if(control) return "professor_x_control";
        }
        return null;
    }

    function clearPendingPick(){
        if(pendingTimer){
            window.clearTimeout(pendingTimer);
            pendingTimer = null;
        }
        pendingTurnKey = null;
    }

    function installManualOverrideGuard(){
        if(manualOverrideGuardInstalled) return;
        manualOverrideGuardInstalled = true;
        document.addEventListener("click",event => {
            if(!featureEnabled || !event.isTrusted) return;
            const packEntry = event.target?.closest?.("#pack [data-pack-index]");
            if(!packEntry) return;
            const playerIndex = typeof window.getCurrentPlayerIndex === "function"
                ? window.getCurrentPlayerIndex()
                : null;
            if(!Number.isInteger(playerIndex) || getPlayerMode(playerIndex) !== CONTROL_CEREBRO) return;
            const turnKey = getCurrentTurnKey();
            if(!turnKey) return;
            clearPendingPick();
            failedEntriesByTurn.delete(turnKey);
            logCerebroEvent("cerebro_manual_override",{
                playerIndex,
                player:getPlayers()[playerIndex] || null,
                cardIndex:Number(packEntry.dataset.packIndex),
                reason:"trusted_manual_pack_click"
            });
            showToast(`STEROWANIE RĘCZNE • ${getPlayers()[playerIndex]} WYBIERA PRZED CEREBRO`,"human");
            window.setTimeout(() => {
                if(!featureEnabled) return;
                if(getCurrentTurnKey() !== turnKey) return;
                if(getPlayerMode(playerIndex) !== CONTROL_CEREBRO) return;
                scheduleCurrentTurn("manual_override_not_committed");
            },PICK_COMMIT_CHECK_MS);
        },true);
    }

    function scheduleCurrentTurn(reason="state_change"){
        if(!featureEnabled || !getPlayers().length) return;
        if(getDraftFinished()){
            clearPendingPick();
            return;
        }
        const playerIndex = typeof window.getCurrentPlayerIndex === "function"
            ? window.getCurrentPlayerIndex()
            : null;
        if(!Number.isInteger(playerIndex)) return;
        if(getPlayerMode(playerIndex) !== CONTROL_CEREBRO) return;

        const turnKey = getCurrentTurnKey();
        if(!turnKey || pendingTurnKey === turnKey) return;
        clearPendingPick();
        pendingTurnKey = turnKey;
        pendingTimer = window.setTimeout(() => {
            pendingTimer = null;
            const expected = pendingTurnKey;
            pendingTurnKey = null;
            executeCurrentTurn(expected,reason);
        }, PICK_DELAY_MS);
    }

    function executeCurrentTurn(expectedTurnKey, reason){
        const playerIndex = typeof window.getCurrentPlayerIndex === "function"
            ? window.getCurrentPlayerIndex()
            : null;
        if(!Number.isInteger(playerIndex)) return;
        if(getPlayerMode(playerIndex) !== CONTROL_CEREBRO) return;
        if(getCurrentTurnKey() !== expectedTurnKey) return;

        const busyReason = getBusyReason(playerIndex);
        if(busyReason){
            if(busyReason === "draft_finished"){
                clearPendingPick();
                return;
            }
            if(busyReason === "professor_x_control"){
                showToast(`CEREBRO WSTRZYMANE • ${getPlayers()[playerIndex]} — RUCH KONTROLUJE PROFESSOR X`,"warning");
                return;
            }
            window.setTimeout(() => scheduleCurrentTurn(`retry_${busyReason}`), BUSY_RETRY_MS);
            return;
        }

        const ranked = rankCurrentPack(playerIndex);
        if(!ranked.length){
            showToast(`CEREBRO NIE MA LEGALNEGO WYBORU DLA ${getPlayers()[playerIndex]}`,"warning");
            return;
        }

        const chosen = ranked[0];
        logDecision(playerIndex,chosen,ranked,reason);
        showDecision(playerIndex,chosen,ranked);

        pendingTurnKey = expectedTurnKey;
        pendingTimer = window.setTimeout(() => {
            pendingTimer = null;
            pendingTurnKey = null;
            if(!featureEnabled) return;
            if(getCurrentTurnKey() !== expectedTurnKey) return;
            if(getPlayerMode(playerIndex) !== CONTROL_CEREBRO) return;

            const delayedBusyReason = getBusyReason(playerIndex);
            if(delayedBusyReason){
                scheduleCurrentTurn("preview_retry_" + delayedBusyReason);
                return;
            }

            if(chosen.card?.joker){
                resolveJokerAutomatically(playerIndex,chosen,expectedTurnKey);
                return;
            }
            clickPackEntry(chosen,expectedTurnKey);
        }, DECISION_PREVIEW_MS);
    }

    function clickPackEntry(chosen, expectedTurnKey){
        const selector = `[data-pack-index="${chosen.index}"]`;
        const button = document.querySelector(`#pack ${selector}`);
        if(!button){
            markFailedAndRetry(chosen,expectedTurnKey,"missing_button");
            return;
        }
        button.click();
        window.setTimeout(() => {
            if(getCurrentTurnKey() === expectedTurnKey && !window.JokerV2UI?.isBusy?.()){
                markFailedAndRetry(chosen,expectedTurnKey,"pick_not_committed");
            }
        }, PICK_COMMIT_CHECK_MS);
    }

    function markFailedAndRetry(chosen,turnKey,reason){
        if(!turnKey) return;
        const failed = failedEntriesByTurn.get(turnKey) || new Set();
        failed.add(chosen.entryKey);
        failedEntriesByTurn.set(turnKey,failed);
        logCerebroEvent("cerebro_pick_retry",{
            reason,
            card:chosen.publicCard?.name || chosen.publicCard?.id || chosen.card?.name || chosen.card?.id || "Joker",
            score:chosen.score
        });
        scheduleCurrentTurn("retry_failed_entry");
    }

    function findCardTemplateByName(name){
        const normalized = String(name || "").toLocaleLowerCase("pl");
        return Array.isArray(window.cardDatabase)
            ? window.cardDatabase.find(card => String(card?.name || "").toLocaleLowerCase("pl") === normalized)
            : (typeof cardDatabase !== "undefined" && Array.isArray(cardDatabase)
                ? cardDatabase.find(card => String(card?.name || "").toLocaleLowerCase("pl") === normalized)
                : null);
    }

    function dispatchInput(input){
        if(typeof Event === "function"){
            input.dispatchEvent(new Event("input",{bubbles:true}));
            return;
        }
        const event = document.createEvent("Event");
        event.initEvent("input",true,true);
        input.dispatchEvent(event);
    }

    function resolveJokerAutomatically(playerIndex, chosen, expectedTurnKey){
        if(!window.JokerV2UI?.open){
            markFailedAndRetry(chosen,expectedTurnKey,"joker_ui_missing");
            return;
        }

        const opened = window.JokerV2UI.open(chosen.card,chosen.index);
        if(!opened){
            markFailedAndRetry(chosen,expectedTurnKey,"joker_open_failed");
            return;
        }

        showToast(`CEREBRO • ${getPlayers()[playerIndex]} OTWIERA JOKERA I ANALIZUJE OPCJE…`,"joker");

        window.setTimeout(() => {
            const modal = document.getElementById("jokerV2ResolveModal");
            if(!modal || modal.hidden){
                markFailedAndRetry(chosen,expectedTurnKey,"joker_modal_missing");
                return;
            }

            const mode = getJokerModeLocal(chosen.card);
            let optionCards = [];
            if(mode === "choice" && typeof window.getJokerAvailableCards === "function"){
                optionCards = window.getJokerAvailableCards(chosen.card) || [];
            }else{
                optionCards = [...modal.querySelectorAll(".joker-v2-card-option")]
                    .map(button => findCardTemplateByName(button.dataset.cardName))
                    .filter(Boolean);
            }

            const profile = buildDeckProfile(getDecks()[playerIndex] || []);
            const mandatorySurprise = mode === "surprise";
            const rankedOptions = optionCards
                .map(card => ({card,...scoreNormalCard(card,profile)}))
                .filter(entry => Number.isFinite(entry.score) && (mandatorySurprise || entry.score > -9999))
                .sort((a,b) => b.score - a.score || String(a.card.name).localeCompare(String(b.card.name),"pl"));

            const best = rankedOptions[0];
            if(!best){
                if(mandatorySurprise){
                    showToast(`CEREBRO • ${getPlayers()[playerIndex]}: SURPRISE CZEKA NA OBOWIĄZKOWY WYBÓR`,"joker");
                    return;
                }
                window.JokerV2UI.close?.();
                markFailedAndRetry(chosen,expectedTurnKey,"joker_no_legal_option");
                return;
            }

            if(mode === "choice"){
                const search = modal.querySelector("#jokerV2Search");
                if(search){
                    search.value = best.card.name;
                    dispatchInput(search);
                }
            }

            showToast(`CEREBRO • ${getPlayers()[playerIndex]} WSKAZUJE: ${best.card.name}`,"joker");

            window.setTimeout(() => {
                const optionButton = [...modal.querySelectorAll(".joker-v2-card-option")]
                    .find(button => button.dataset.cardName === best.card.name);
                if(!optionButton){
                    if(mandatorySurprise){
                        showToast(`CEREBRO • ${getPlayers()[playerIndex]}: SURPRISE CZEKA NA OBOWIĄZKOWY WYBÓR`,"joker");
                        return;
                    }
                    window.JokerV2UI.close?.();
                    markFailedAndRetry(chosen,expectedTurnKey,"joker_option_button_missing");
                    return;
                }

                optionButton.click();
                logCerebroEvent("cerebro_joker_option_selected",{
                    playerIndex,
                    player:getPlayers()[playerIndex] || null,
                    jokerId:chosen.card?.id || null,
                    jokerRarity:getJokerRarityLocal(chosen.card),
                    jokerType:mode,
                    resultCard:best.card.name,
                    score:best.score,
                    reasons:best.reasons
                });
                showToast(`CEREBRO • ${getPlayers()[playerIndex]}: JOKER → ${best.card.name}`,"joker");

                window.setTimeout(() => {
                    const confirm = modal.querySelector("#jokerV2Confirm");
                    if(confirm && !confirm.disabled){
                        confirm.click();
                    }else if(mandatorySurprise){
                        showToast(`CEREBRO • ${getPlayers()[playerIndex]}: SURPRISE CZEKA NA POTWIERDZENIE`,"joker");
                    }else{
                        window.JokerV2UI.close?.();
                        markFailedAndRetry(chosen,expectedTurnKey,"joker_confirm_unavailable");
                    }
                },JOKER_CONFIRM_DELAY_MS);
            },JOKER_OPTION_PREVIEW_MS);
        },JOKER_MODAL_SETTLE_MS);
    }

    function logCerebroEvent(event,data={}){
        window.cerebroLog = Array.isArray(window.cerebroLog) ? window.cerebroLog : [];
        const payload = {
            event,
            packNumber:getPackIndex() + 1,
            pickIndex:getPickIndex(),
            timestamp:new Date().toISOString(),
            ...data
        };
        window.cerebroLog.push(payload);
        if(window.DraftStateEngine?.log){
            window.DraftStateEngine.log(event,{
                packNumber:payload.packNumber,
                pickIndex:payload.pickIndex,
                playerIndex:Number.isInteger(payload.playerIndex) ? payload.playerIndex : null,
                player:payload.player || null,
                reason:"cerebro_autopilot",
                data:payload
            });
        }
        return payload;
    }

    function logDecision(playerIndex,chosen,ranked,reason){
        logCerebroEvent("cerebro_pick_decision",{
            playerIndex,
            player:getPlayers()[playerIndex] || null,
            card:chosen.publicCard?.name || chosen.publicCard?.id || chosen.card?.name || chosen.card?.id || "Joker",
            cardInstanceId:chosen.card?.instanceId || null,
            isJoker:Boolean(chosen.publicCard?.joker ?? chosen.card?.joker),
            score:chosen.score,
            reasons:chosen.reasons,
            trigger:reason,
            topCandidates:ranked.slice(0,3).map(entry => ({
                card:entry.publicCard?.name || entry.publicCard?.id || entry.card?.name || entry.card?.id || "Joker",
                score:entry.score,
                reasons:entry.reasons
            }))
        });
    }

    function ensureToast(){
        let toast = document.getElementById("cerebroStatusToast");
        if(toast) return toast;
        toast = document.createElement("div");
        toast.id = "cerebroStatusToast";
        toast.className = "cerebro-status-toast";
        toast.setAttribute("aria-live","polite");
        document.body.appendChild(toast);
        return toast;
    }

    function showToast(message,type="cerebro"){
        const toast = ensureToast();
        toast.dataset.type = type;
        toast.textContent = message;
        toast.classList.add("is-visible");
        if(toastTimer) window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"),6500);
    }

    function showDecision(playerIndex,chosen,ranked){
        const reason = chosen.reasons?.[0] || "najwyższa ocena";
        showToast(
            `CEREBRO • ${getPlayers()[playerIndex]} WYBIERA: ${chosen.publicCard?.name || chosen.card?.name || "JOKER"} — ${reason}`,
            (chosen.publicCard?.joker ?? chosen.card?.joker) ? "joker" : "cerebro"
        );
        highlightChosenPackEntry(chosen.index);
    }

    function highlightChosenPackEntry(index){
        document.querySelectorAll("#pack .cerebro-choice-preview")
            .forEach(element => element.classList.remove("cerebro-choice-preview"));
        const button = document.querySelector(`#pack [data-pack-index="${index}"]`);
        if(button) button.classList.add("cerebro-choice-preview");
    }

    function decorateLobby(){
        const list = document.getElementById("playersList");
        const lobbyPlayers = getLobbyPlayers();
        if(!list) return;
        if(!featureEnabled){
            list.querySelectorAll(".cerebro-lobby-controls").forEach(node => node.remove());
            list.querySelectorAll(".cerebro-lobby-active").forEach(node => node.classList.remove("cerebro-lobby-active"));
            return;
        }
        if(!lobbyPlayers.length) return;
        [...list.children].forEach((chip,index) => {
            const name = lobbyPlayers[index];
            if(!name || chip.querySelector(".cerebro-lobby-toggle")) return;
            const remove = chip.querySelector(".playerChipRemove");
            const controls = document.createElement("span");
            controls.className = "cerebro-lobby-controls";
            const button = document.createElement("button");
            button.type = "button";
            button.className = "cerebro-lobby-toggle";
            button.dataset.active = getLobbyControl(name) === CONTROL_CEREBRO ? "true" : "false";
            button.title = button.dataset.active === "true"
                ? "Cerebro wybierze karty za tego gracza. Kliknij, aby oddać sterowanie."
                : "Kliknij, aby przekazać wybory gracza do Cerebro.";
            button.innerHTML = button.dataset.active === "true"
                ? `<span>🧠</span><b>CEREBRO</b>`
                : `<span>👤</span><b>GRACZ</b>`;
            button.addEventListener("click",event => {
                event.preventDefault();
                event.stopPropagation();
                toggleLobbyMode(index);
            });
            controls.appendChild(button);
            if(remove) chip.insertBefore(controls,remove);
            else chip.appendChild(controls);
            chip.classList.toggle("cerebro-lobby-active",button.dataset.active === "true");
        });
    }

    function decorateDeckControls(){
        const root = document.getElementById("decks");
        if(!root) return;
        if(!featureEnabled){
            root.querySelectorAll(".cerebro-deck-toggle").forEach(node => node.remove());
            root.querySelectorAll(".cerebro-controlled-deck").forEach(node => node.classList.remove("cerebro-controlled-deck"));
            return;
        }
        if(!getPlayers().length) return;
        [...root.querySelectorAll(".deck-section")].forEach((section,index) => {
            const active = getPlayerMode(index) === CONTROL_CEREBRO;
            section.classList.toggle("cerebro-controlled-deck",active);
            let button = section.querySelector(".cerebro-deck-toggle");
            if(!button){
                button = document.createElement("button");
                button.type = "button";
                button.className = "cerebro-deck-toggle";
                button.addEventListener("click",event => {
                    event.stopPropagation();
                    togglePlayerMode(index);
                });
                section.appendChild(button);
            }
            button.dataset.active = active ? "true" : "false";
            button.innerHTML = active
                ? `<span aria-hidden="true">🧠</span>`
                : `<span aria-hidden="true">👤</span>`;
            button.title = active
                ? "Cerebro steruje tym graczem — kliknij, aby oddać kontrolę"
                : "Sterowanie gracza — kliknij, aby włączyć Cerebro";
            button.setAttribute("aria-label",button.title);
        });
    }

    function decorateQueue(){
        const queue = document.getElementById("roundQueue");
        const livePickOrder = getPickOrder();
        if(!queue) return;
        if(!featureEnabled){
            queue.querySelectorAll(".cerebro-queue-badge").forEach(node => node.remove());
            queue.querySelectorAll(".cerebro-queue-player").forEach(node => node.classList.remove("cerebro-queue-player"));
            return;
        }
        if(!livePickOrder.length) return;
        [...queue.children].forEach((entry,queueIndex) => {
            const playerIndex = livePickOrder[queueIndex];
            const active = getPlayerMode(playerIndex) === CONTROL_CEREBRO;
            entry.classList.toggle("cerebro-queue-player",active);
            const existingBadge = entry.querySelector(".cerebro-queue-badge");
            if(active && !existingBadge){
                const badge = document.createElement("span");
                badge.className = "cerebro-queue-badge";
                badge.textContent = "🧠";
                badge.title = "Sterowanie Cerebro";
                entry.appendChild(badge);
            }else if(!active && existingBadge){
                existingBadge.remove();
            }
        });
    }

    function decorateCurrentBanner(){
        const banner = document.getElementById("currentPickerBanner");
        if(banner && !featureEnabled){
            banner.classList.remove("cerebro-current-banner");
            banner.querySelectorAll(".cerebro-current-badge").forEach(node => node.remove());
            return;
        }
        const playerIndex = typeof window.getCurrentPlayerIndex === "function"
            ? window.getCurrentPlayerIndex()
            : null;
        if(!banner || !Number.isInteger(playerIndex)) return;
        const active = getPlayerMode(playerIndex) === CONTROL_CEREBRO;
        banner.classList.toggle("cerebro-current-banner",active);
        const existingBadge = banner.querySelector(".cerebro-current-badge");
        if(active && !existingBadge){
            const badge = document.createElement("span");
            badge.className = "cerebro-current-badge";
            badge.textContent = "🧠 CEREBRO ANALIZUJE";
            banner.appendChild(badge);
        }else if(!active && existingBadge){
            existingBadge.remove();
        }
    }

    function patchGlobalFunction(name,after){
        const original = window[name];
        if(typeof original !== "function") return false;
        window[name] = function(...args){
            const result = original.apply(this,args);
            after?.(...args);
            return result;
        };
        return true;
    }

    function installPatches(){
        if(patched) return;
        patched = true;

        installManualOverrideGuard();
        patchGlobalFunction("renderDraftPlayers",decorateLobby);
        patchGlobalFunction("showDecks",decorateDeckControls);
        patchGlobalFunction("updateCurrentPickerBanner",decorateCurrentBanner);
        patchGlobalFunction("updateRoundQueueDisplay",() => {
            decorateQueue();
            decorateCurrentBanner();
            scheduleCurrentTurn("queue_rendered");
        });

        const originalStartDraft = window.startDraft;
        if(typeof originalStartDraft === "function"){
            window.startDraft = function(...args){
                const result = originalStartDraft.apply(this,args);
                initializeRuntimeControls();
                return result;
            };
        }
    }

    function getExportData(){
        return {
            version:VERSION,
            players:getPlayers().map((name,index) => ({
                name,
                control:getPlayerMode(index)
            })),
            log:[...(window.cerebroLog || [])]
        };
    }

    function init(){
        bindFeatureToggle();
        installPatches();
        decorateLobby();
        decorateDeckControls();
        decorateQueue();
        decorateCurrentBanner();
    }

    window.CerebroAutopilot = Object.freeze({
        VERSION,
        HUMAN:CONTROL_HUMAN,
        isEnabled:getFeatureEnabled,
        setEnabled:setFeatureEnabled,
        CEREBRO:CONTROL_CEREBRO,
        init,
        getPlayerMode,
        setPlayerMode,
        togglePlayerMode,
        getLobbyControl,
        setLobbyControl,
        scheduleCurrentTurn,
        rankCurrentPack,
        scoreCard:(card,deck=[]) => scoreEntry(card,buildDeckProfile(deck)),
        buildDeckProfile,
        getExportData,
        _test:Object.freeze({
            scoreNormalCard,
            scoreJoker,
            getCostBucketId:getCostBucketIdLocal,
            buildTagCategoryIndex,
            getBusyReason,
            hasVisibleBlockingDialog
        })
    });

    if(document.readyState === "loading"){
        document.addEventListener("DOMContentLoaded",init,{once:true});
    }else{
        init();
    }
})();
