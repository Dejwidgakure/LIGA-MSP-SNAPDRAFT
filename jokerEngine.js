/* MSP SNAP DRAFT — JOKER ENGINE v3.20 — Dynamic Pool Hardening */
const jokerSettings = {

    enabled: false,

    mode: "classic", // classic / rare / madness / custom

    /*
       NOWY SYSTEM JOKERÓW
       jokerPackMode:
       - "fixed"  = dokładnie N paczek Jokerowych w drafcie
       - "chance" = każda standardowa paczka osobno losuje szansę

       Custom Packi mają priorytet. Joker może wejść tylko w STANDARD PACK.
    */
    jokerPackMode: "fixed",
    fixedJokerPacks: 2,
    packChance: 0.40,

    // Liczba Jokerów w paczce Jokerowej względem liczby graczy
    jokerIntensity: 0.5,

    // Maksymalny procent kart w paczce, które mogą zostać Jokerami
    maxJokerPackRatio: 0.60,

    surpriseOptionsCount: 3,
    minSurprisePoolSize: 3,

    modePresets: {
        classic: {
            jokerPackMode: "fixed",
            fixedJokerPacks: 2,
            packChance: 0.25,
            jokerIntensity: 0.5,
            maxJokerPackRatio: 0.60
        },
        rare: {
            jokerPackMode: "chance",
            fixedJokerPacks: 2,
            packChance: 0.40,
            jokerIntensity: 0.75,
            maxJokerPackRatio: 0.60
        },
        madness: {
            jokerPackMode: "fixed",
            fixedJokerPacks: 4,
            packChance: 0.55,
            jokerIntensity: 1.0,
            maxJokerPackRatio: 0.70
        }
    },

    allowedTypes: [
        "choice",
        "surprise"
    ],

    // Choice daje pełną kontrolę nad pulą, dlatego pojawia się rzadziej.
    typeChances: {
        choice: 40,
        surprise: 60
    },

    // Osobne wagi rzadkości dla obu sposobów rozstrzygnięcia.
    // Choice i Surprise mają własną filozofię rarity:
    // - Choice: szeroka/flexible pula podnosi wartość; wąskie dziwne Choice mogą być Rare.
    // - Surprise: szeroka/noisy pula obniża wartość; mała spójna pula może być Epic.
    rarityChancesByType: {
        choice: {
            rare: 45,
            epic: 50,
            legendary: 5
        },
        surprise: {
            rare: 62,
            epic: 34,
            legendary: 4
        }
    },

    // Fallback dla starych konfiguracji / presetów.
    rarityChances: {
        rare: 60,
        epic: 35,
        legendary: 5
    }

};

let jokerPackPlan = [];
let jokerPackPlanBuilt = false;
let jokerPackPlanInfo = null;

function clampNumber(value, min, max, fallback){
    const n = Number(value);
    if(!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
}

function getJokerPreset(){
    return jokerSettings.modePresets[jokerSettings.mode] || jokerSettings.modePresets.classic;
}

function getJokerPackMode(){
    return jokerSettings.jokerPackMode === "chance" ? "chance" : "fixed";
}

function getFixedJokerPacks(){
    return Math.round(clampNumber(jokerSettings.fixedJokerPacks, 0, 6, getJokerPreset().fixedJokerPacks || 2));
}

function getJokerPackChance(){
    return clampNumber(jokerSettings.packChance, 0, 1, getJokerPreset().packChance || 0.25);
}

function getJokerIntensity(){
    return clampNumber(jokerSettings.jokerIntensity, 0.1, 5, getJokerPreset().jokerIntensity || 0.5);
}

function getMaxJokerPackRatio(){
    return clampNumber(jokerSettings.maxJokerPackRatio, 0.1, 1, getJokerPreset().maxJokerPackRatio || 0.6);
}

function resetJokerPackPlan(){
    jokerPackPlan = [];
    jokerPackPlanBuilt = false;
    jokerPackPlanInfo = null;
}

function shuffleCopy(arr){
    const out = [...arr];
    for(let i = out.length - 1; i > 0; i--){
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

function prepareJokerPackPlan(totalPacks, customSlots){
    const count = Math.max(0, Number(totalPacks) || 0);
    const customPlan = Array.isArray(customSlots)
        ? customSlots.slice(0, count)
        : [];

    while(customPlan.length < count){
        customPlan.push(null);
    }

    const standardIndexes = [];

    for(let i = 0; i < count; i++){
        if(!customPlan[i]) standardIndexes.push(i);
    }

    const plan = new Array(count).fill(false);
    const mode = getJokerPackMode();

    if(mode === "fixed"){
        const desired = Math.min(getFixedJokerPacks(), standardIndexes.length);
        const picked = shuffleCopy(standardIndexes).slice(0, desired);
        picked.forEach(index => plan[index] = true);
    }else{
        const chance = getJokerPackChance();
        standardIndexes.forEach(index => {
            plan[index] = Math.random() < chance;
        });
    }

    jokerPackPlan = plan;
    jokerPackPlanBuilt = true;
    jokerPackPlanInfo = {
        totalPacks: count,
        customSlots: customPlan,
        standardSlots: standardIndexes,
        mode,
        fixedJokerPacks: getFixedJokerPacks(),
        packChance: getJokerPackChance(),
        jokerIntensity: getJokerIntensity(),
        maxJokerPackRatio: getMaxJokerPackRatio(),
        plan: [...plan]
    };

    console.log("[JOKER PLAN]", jokerPackPlanInfo);

    return jokerPackPlanInfo;
}

function shouldInjectJokersForPack(packIndex, isStandardPack){
    if(!jokerSettings.enabled) return false;
    if(!isStandardPack) return false;

    const index = Number(packIndex);
    if(!Number.isFinite(index)) return false;

    // Jeśli plan nie zdążył się zbudować, zachowujemy bezpieczny fallback: pojedynczy roll.
    if(!jokerPackPlanBuilt){
        return Math.random() < getJokerPackChance();
    }

    return !!jokerPackPlan[index];
}

function getJokerPackPlanDebug(){
    return jokerPackPlanInfo || {
        built: false,
        plan: [...jokerPackPlan]
    };
}

function cloneJokerObject(joker){
    if(typeof structuredClone === "function"){
        return structuredClone(joker);
    }

    return JSON.parse(JSON.stringify(joker));
}

function getDraftPlayersCountFallback(pack){
    if(typeof numPlayers === "number" && Number.isFinite(numPlayers) && numPlayers > 0){
        return numPlayers;
    }

    return Math.max(1, Math.floor(((pack && pack.length) || 1) / 2));
}

function getCardCostSafe(card){
    const value = Number(card && card.cost);
    return Number.isFinite(value) ? value : 0;
}

function getCardPowerSafe(card){
    const value = Number(card && card.power);
    return Number.isFinite(value) ? value : 0;
}

function normalizeTag(tag){
    return String(tag || "").trim().toLowerCase();
}

const JOKER_TAG_ALIASES = Object.freeze({
    destro: "destroy",
    cardgen: "card-generation",
    spell: "spells",
    // Tag Schema V2 — normalize legacy filter/save IDs to current canonical IDs.
    "silver-surfer": "surfer-buff",
    surfer: "surfer-buff",
    "victoria-hand": "victoria-hand-big-hand",
    "darkhawk-rocks": "darkhawk-ronan",
    "sauron-nightmare": "sauron-skaar"
});

const JOKER_COMPOSITE_TAGS = Object.freeze({
    "card-generation": [
        "card-generation",
        "hand-gen",
        "deck-generator",
        "board-generator"
    ],
    // Tag Schema V2 migration aliases. These keep Joker pools functional while
    // cards.js is being migrated from the legacy tag IDs to the new canonical split.
    "location-control":["location-control","location"],
    "location-points":["location-points","location"],
    "energy":["energy","energy-ramp"],
    "ramp":["ramp","wiccan","energy-ramp"],
    "spectrum-ongoing":["spectrum-ongoing","ongoing-combo"],
    "tribunal-ongoing":["tribunal-ongoing","ongoing-combo"],
    "zombie-horde":["zombie-horde","zombie"],
    "zombies":["zombies","zombie"],
    "mister-negative":["mister-negative","negative"],
    "prio-control":["prio-control","priority-control"],
    "small-buff":["small-buff","shou-lao"],
    "destroy-combo":["destroy-combo","nimrod-phoenix"],
    "surfer-buff":["surfer-buff","silver-surfer","surfer"],
    "downside":["downside","zero-downsides"],
    "victoria-hand-big-hand":["victoria-hand-big-hand","victoria-hand"],
    "darkhawk-ronan":["darkhawk-ronan","darkhawk-rocks"],
    "sauron-skaar":["sauron-skaar","sauron-nightmare","zero-downsides"]
});

function normalizeJokerTag(tag){
    const normalized = normalizeTag(tag);
    return JOKER_TAG_ALIASES[normalized] || normalized;
}

function cardHasTag(card, tag){
    const wanted = normalizeJokerTag(tag);
    if(!wanted || wanted === "any") return true;

    const tags = Array.isArray(card && card.tags)
        ? card.tags.map(normalizeJokerTag)
        : [];

    if(Array.isArray(JOKER_COMPOSITE_TAGS[wanted])){
        return JOKER_COMPOSITE_TAGS[wanted].some(candidate =>
            tags.includes(candidate)
        );
    }

    return tags.includes(wanted);
}

function cardPassesVirtualJokerTag(card, tag){
    const cost = getCardCostSafe(card);
    const power = getCardPowerSafe(card);

    switch(normalizeTag(tag)){
        case "cost-greater-than-power":
            return cost > power;

        case "power-greater-than-cost":
            return power > cost;

        case "equal-cost-power":
            return cost === power;

        case "exact-2-power":
            return power === 2;

        case "exact-6-6":
            return cost === 6 && power === 6;

        case "power-4-above-cost":
            return power >= cost + 4;

        default:
            return null;
    }
}


/* ============================================================
   JOKER SPECIAL ZONE SOURCES — v2.70
   Dynamic pools used by jokers.js -> poolSource.
   These sources COPY a canonical card template into Joker resolution.
   They do not consume the original deck/graveyard/pack instance.
============================================================ */

function normalizeJokerSourceName(value){
    return String(value||"").trim().toLowerCase();
}

function getActiveJokerPlayerIndex(){
    try{
        const index=Number(pickOrder?.[currentPickIndex]);
        return Number.isInteger(index) ? index : null;
    }catch(error){
        return null;
    }
}

function getCanonicalJokerSourceCard(card){
    if(!card || card.joker || !card.name) return null;
    const wanted=normalizeJokerSourceName(card.name);
    if(!wanted) return null;
    return (Array.isArray(cardDatabase) ? cardDatabase : []).find(template=>
        normalizeJokerSourceName(template?.name)===wanted
    ) || null;
}

function dedupeJokerSourcePool(cards){
    const seen=new Set();
    const result=[];
    (Array.isArray(cards) ? cards : []).forEach(card=>{
        const canonical=getCanonicalJokerSourceCard(card);
        if(!canonical) return;
        const key=normalizeJokerSourceName(canonical.name);
        if(!key || seen.has(key)) return;
        seen.add(key);
        result.push(canonical);
    });
    return result;
}

function excludeActivePlayerDeckFromJokerPool(pool){
    const playerIndex=getActiveJokerPlayerIndex();
    if(!Number.isInteger(playerIndex)) return pool;
    let ownDeck=[];
    try{
        ownDeck=Array.isArray(decks?.[playerIndex]) ? decks[playerIndex] : [];
    }catch(error){}
    const occupied=new Set(
        ownDeck.map(card=>normalizeJokerSourceName(card?.name)).filter(Boolean)
    );
    return pool.filter(card=>!occupied.has(normalizeJokerSourceName(card?.name)));
}

function getJokerSpecialSourcePool(joker){
    const source=joker?.poolSource;
    if(!source || typeof source!=="object") return null;

    const kind=String(source.kind||"").toLowerCase();
    let pool=[];

    if(kind==="banned-cards"){
        const banned=new Set(
            (Array.isArray(bannedCards) ? bannedCards : [])
                .map(normalizeJokerSourceName)
                .filter(Boolean)
        );
        pool=(Array.isArray(cardDatabase) ? cardDatabase : []).filter(card=>
            banned.has(normalizeJokerSourceName(card?.name))
        );
    }

    else if(kind==="drafted-by-others"){
        const active=getActiveJokerPlayerIndex();
        try{
            (Array.isArray(decks) ? decks : []).forEach((deck,index)=>{
                if(Number.isInteger(active) && index===active) return;
                if(Array.isArray(deck)) pool.push(...deck);
            });
        }catch(error){}
    }

    else if(kind==="graveyard"){
        const categories=Array.isArray(source.categories) ? source.categories : undefined;
        const status=source.status===undefined ? "available" : source.status;
        const entries=window.DraftStateEngine?.listGraveyardEntries?.({
            categories,
            status
        }) || [];
        pool=entries.map(entry=>entry?.card).filter(Boolean);
    }

    else if(kind==="completed-packs"){
        const state=window.DraftStateEngine?.getState?.();
        const packs=Array.isArray(state?.packs) ? state.packs : [];
        packs
            .filter(pack=>pack?.status==="completed")
            .forEach(pack=>{
                const cards=Array.isArray(pack?.originalCards)
                    ? pack.originalCards
                    : [];
                pool.push(...cards);
            });
    }

    else if(kind==="current-pack"){
        try{
            pool=Array.isArray(currentPack) ? [...currentPack] : [];
        }catch(error){
            pool=[];
        }
    }

    else{
        return [];
    }

    if(source.excludeJokers!==false){
        pool=pool.filter(card=>!card?.joker);
    }

    pool=dedupeJokerSourcePool(pool);

    // Optional hard blacklist for a specific dynamic Joker source.
    // Used by banned-card Jokers to prevent special/problematic cards
    // from becoming legal merely because they appear on the ban list.
    if(Array.isArray(source.excludeNames) && source.excludeNames.length){
        const blocked=new Set(
            source.excludeNames
                .map(normalizeJokerSourceName)
                .filter(Boolean)
        );
        pool=pool.filter(card=>!blocked.has(normalizeJokerSourceName(card?.name)));
    }

    if(source.excludeOwnDeck){
        pool=excludeActivePlayerDeckFromJokerPool(pool);
    }

    return pool;
}


function getLegalCardPool(){
    let pool = Array.isArray(cardDatabase) ? [...cardDatabase] : [];

    pool = pool.filter(card =>
        card &&
        card.name &&
        Number.isFinite(Number(card.cost)) &&
        Number.isFinite(Number(card.power))
    );

    if(Array.isArray(bannedCards) && bannedCards.length){
        const banned = new Set(bannedCards.map(name => String(name).trim().toLowerCase()));
        pool = pool.filter(card => !banned.has(String(card.name).trim().toLowerCase()));
    }

    return pool;
}

function getJokerMode(joker){
    return String(joker?.mode || joker?.type || "choice").toLowerCase();
}

function getJokerRarity(joker){
    const rarity = String(joker?.rarity || "rare").toLowerCase();
    return rarity === "common" ? "rare" : rarity;
}

function normalizeJokerRelation(relation){
    if(!relation || typeof relation !== "object") return null;

    const allowedFields = new Set(["cost", "power"]);
    const operatorAliases = {
        "==": "=",
        "===": "=",
        "=>": ">=",
        "=<": "<="
    };
    const left = String(relation.left || "").toLowerCase();
    const right = String(relation.right || "").toLowerCase();
    const rawOperator = String(relation.operator || "=").trim();
    const operator = operatorAliases[rawOperator] || rawOperator;
    const allowedOperators = new Set([">", ">=", "<", "<=", "="]);

    if(!allowedFields.has(left) || !allowedFields.has(right) || !allowedOperators.has(operator)){
        return null;
    }

    const offsetNumber = Number(relation.offset ?? 0);
    const rightMultiplierNumber = Number(relation.rightMultiplier ?? 1);

    return {
        left,
        operator,
        right,
        offset: Number.isFinite(offsetNumber) ? offsetNumber : 0,
        rightMultiplier: Number.isFinite(rightMultiplierNumber) ? rightMultiplierNumber : 1,
        label: relation.label ? String(relation.label) : null
    };
}


function normalizeJokerStatConstraint(rule){
    if(rule === null || rule === undefined) return null;

    if(typeof rule === "number"){
        return { min: Number(rule), max: Number(rule) };
    }

    if(typeof rule !== "object") return null;

    const exact = Number(rule.exact);
    const min = Number(rule.min);
    const max = Number(rule.max);

    const normalized = {
        min: Number.isFinite(exact)
            ? exact
            : (Number.isFinite(min) ? min : null),
        max: Number.isFinite(exact)
            ? exact
            : (Number.isFinite(max) ? max : null)
    };

    if(normalized.min === null && normalized.max === null) return null;
    return normalized;
}

function cardPassesJokerStatConstraint(value, rule){
    const normalized=normalizeJokerStatConstraint(rule);
    if(!normalized || !Number.isFinite(value)) return false;

    if(normalized.min !== null && value < normalized.min) return false;
    if(normalized.max !== null && value > normalized.max) return false;
    return true;
}

function normalizeJokerTagCount(rule){
    if(!rule || typeof rule !== "object") return null;

    const tags=(Array.isArray(rule.tags) ? rule.tags : [])
        .map(normalizeJokerTag)
        .filter(Boolean);

    if(!tags.length) return null;

    const exact=Number(rule.exact);
    const min=Number(rule.min);
    const max=Number(rule.max);

    return {
        tags:[...new Set(tags)],
        min:Number.isFinite(exact) ? exact : (Number.isFinite(min) ? min : null),
        max:Number.isFinite(exact) ? exact : (Number.isFinite(max) ? max : null)
    };
}

function cardPassesJokerTagCount(card, rule){
    const normalized=normalizeJokerTagCount(rule);
    if(!normalized) return false;

    const count=normalized.tags.reduce(
        (sum, tag)=>sum + (cardHasTag(card, tag) ? 1 : 0),
        0
    );

    if(normalized.min !== null && count < normalized.min) return false;
    if(normalized.max !== null && count > normalized.max) return false;
    return true;
}

function getJokerFilterConfig(joker){
    const filter = joker?.filter && typeof joker.filter === "object"
        ? joker.filter
        : {};
    const cost = filter.cost && typeof filter.cost === "object"
        ? filter.cost
        : {};
    const power = filter.power && typeof filter.power === "object"
        ? filter.power
        : {};
    const tagFilter = filter.tags && typeof filter.tags === "object"
        ? filter.tags
        : {};
    const legacyTags = Array.isArray(joker?.tags)
        ? joker.tags.map(normalizeJokerTag).filter(tag => tag && tag !== "any")
        : [];

    return {
        minCost: cost.min ?? cost.exact ?? joker?.minCost ?? null,
        maxCost: cost.max ?? cost.exact ?? joker?.maxCost ?? null,
        minPower: power.min ?? power.exact ?? joker?.minPower ?? null,
        maxPower: power.max ?? power.exact ?? joker?.maxPower ?? null,
        allOf: [
            ...legacyTags,
            ...(Array.isArray(tagFilter.allOf) ? tagFilter.allOf : [])
        ].map(normalizeJokerTag).filter(Boolean),
        anyOf: (Array.isArray(tagFilter.anyOf) ? tagFilter.anyOf : [])
            .map(normalizeJokerTag)
            .filter(Boolean),
        noneOf: (Array.isArray(tagFilter.noneOf) ? tagFilter.noneOf : [])
            .map(normalizeJokerTag)
            .filter(Boolean),
        predicates: (Array.isArray(filter.predicates) ? filter.predicates : [])
            .map(normalizeTag)
            .filter(Boolean),
        relations: (Array.isArray(filter.relations) ? filter.relations : [])
            .map(normalizeJokerRelation)
            .filter(Boolean),
        costAnyOf: (Array.isArray(cost.anyOf) ? cost.anyOf : [])
            .map(normalizeJokerStatConstraint)
            .filter(Boolean),
        powerAnyOf: (Array.isArray(power.anyOf) ? power.anyOf : [])
            .map(normalizeJokerStatConstraint)
            .filter(Boolean),
        tagCounts: (Array.isArray(filter.tagCounts) ? filter.tagCounts : [])
            .map(normalizeJokerTagCount)
            .filter(Boolean)
    };
}

function getJokerStatValue(card, field){
    if(field === "cost") return getCardCostSafe(card);
    if(field === "power") return getCardPowerSafe(card);
    return NaN;
}

function cardPassesJokerRelation(card, relation){
    const normalized = normalizeJokerRelation(relation);
    if(!normalized) return false;

    const left = getJokerStatValue(card, normalized.left);
    const right = (
        getJokerStatValue(card, normalized.right) * normalized.rightMultiplier
    ) + normalized.offset;
    if(!Number.isFinite(left) || !Number.isFinite(right)) return false;

    switch(normalized.operator){
        case ">": return left > right;
        case ">=": return left >= right;
        case "<": return left < right;
        case "<=": return left <= right;
        case "=": return left === right;
        default: return false;
    }
}

function cardPassesJokerCriterion(card, criterion){
    const virtualResult = cardPassesVirtualJokerTag(card, criterion);
    return virtualResult !== null
        ? virtualResult
        : cardHasTag(card, criterion);
}

function applyJokerFilters(pool, joker){
    let filtered = Array.isArray(pool) ? [...pool] : [];
    const config = getJokerFilterConfig(joker);

    /* COST FILTER */

    if(config.minCost !== null && config.minCost !== undefined){
        filtered = filtered.filter(card =>
            getCardCostSafe(card) >= Number(config.minCost)
        );
    }

    if(config.maxCost !== null && config.maxCost !== undefined){
        filtered = filtered.filter(card =>
            getCardCostSafe(card) <= Number(config.maxCost)
        );
    }

    /* POWER FILTER */

    if(config.minPower !== null && config.minPower !== undefined){
        filtered = filtered.filter(card =>
            getCardPowerSafe(card) >= Number(config.minPower)
        );
    }

    if(config.maxPower !== null && config.maxPower !== undefined){
        filtered = filtered.filter(card =>
            getCardPowerSafe(card) <= Number(config.maxPower)
        );
    }

    /* STAT OR FILTERS */

    if(config.costAnyOf.length){
        filtered = filtered.filter(card =>
            config.costAnyOf.some(rule =>
                cardPassesJokerStatConstraint(getCardCostSafe(card), rule)
            )
        );
    }

    if(config.powerAnyOf.length){
        filtered = filtered.filter(card =>
            config.powerAnyOf.some(rule =>
                cardPassesJokerStatConstraint(getCardPowerSafe(card), rule)
            )
        );
    }

    /* TAG FILTERS + PREDICATES */

    if(config.allOf.length){
        filtered = filtered.filter(card =>
            config.allOf.every(criterion => cardPassesJokerCriterion(card, criterion))
        );
    }

    if(config.anyOf.length){
        filtered = filtered.filter(card =>
            config.anyOf.some(criterion => cardPassesJokerCriterion(card, criterion))
        );
    }

    if(config.noneOf.length){
        filtered = filtered.filter(card =>
            config.noneOf.every(criterion => !cardPassesJokerCriterion(card, criterion))
        );
    }

    if(config.predicates.length){
        filtered = filtered.filter(card =>
            config.predicates.every(predicate => cardPassesVirtualJokerTag(card, predicate) === true)
        );
    }

    if(config.tagCounts.length){
        filtered = filtered.filter(card =>
            config.tagCounts.every(rule => cardPassesJokerTagCount(card, rule))
        );
    }

    if(config.relations.length){
        filtered = filtered.filter(card =>
            config.relations.every(relation => cardPassesJokerRelation(card, relation))
        );
    }

    /* REMOVE DUPLICATES */

    filtered = [...new Map(
        filtered.map(card => [card.name, card])
    ).values()];

    return filtered;
}

let jokerPoolCache=new Map();
let jokerPoolCacheContext="";

function getJokerPoolCacheContext(){
    const bannedKey=Array.isArray(bannedCards)
        ? bannedCards.map(name=>String(name||"").trim().toLowerCase()).sort().join("|")
        : "";
    const databaseSize=Array.isArray(cardDatabase) ? cardDatabase.length : 0;
    return `${databaseSize}::${bannedKey}`;
}

function resetJokerPoolCache(){
    jokerPoolCache.clear();
    jokerPoolCacheContext=getJokerPoolCacheContext();
}

function getJokerAvailableCards(joker){
    const context=getJokerPoolCacheContext();
    if(context!==jokerPoolCacheContext){
        jokerPoolCache.clear();
        jokerPoolCacheContext=context;
    }

    const specialSource=getJokerSpecialSourcePool(joker);
    const isDynamicSource=Array.isArray(specialSource);

    // Dynamic zone pools change during the draft, so they must never use
    // the static cardDatabase/bans cache.
    if(isDynamicSource){
        return applyJokerFilters(specialSource,joker);
    }

    const cacheKey=String(joker?.id||"");
    if(cacheKey && jokerPoolCache.has(cacheKey)){
        return [...jokerPoolCache.get(cacheKey)];
    }

    const pool=applyJokerFilters(getLegalCardPool(),joker);
    if(cacheKey) jokerPoolCache.set(cacheKey,pool);
    return [...pool];
}

function getSurprisePoolSize(joker){
    if(!joker || getJokerMode(joker) !== "surprise") return Infinity;
    return getJokerAvailableCards(joker).length;
}

function getRequiredJokerPoolSize(joker){
    if(!joker) return Infinity;
    if(getJokerMode(joker)!=="surprise") return 1;

    const minPool=Math.max(1,Number(jokerSettings.minSurprisePoolSize)||3);
    const options=Math.max(1,Number(jokerSettings.surpriseOptionsCount)||3);

    // Surprise musi mieć dość kart, aby faktycznie pokazać pełną liczbę opcji.
    return Math.max(minPool,options);
}

function isJokerPlayable(joker){
    if(!joker) return false;
    return getJokerAvailableCards(joker).length >= getRequiredJokerPoolSize(joker);
}

/* ============================================================
   LATE VALIDATION / DYNAMIC-POOL HARDENING — v3.20

   Dynamiczne źródła (Bany, Graveyard, drafted-by-others,
   completed packs, current pack) mogą zmienić się między momentem
   spawnu Jokera a momentem jego kliknięcia.

   Zasada:
   - nigdy NIE dobijamy brakującej puli losowymi zwykłymi kartami,
   - przy zbyt małej puli rerollujemy definicję Jokera,
   - preferujemy ten sam TYPE + tę samą RARITY,
   - jeśli to niemożliwe: ten sam TYPE + dowolna legalna rarity,
   - nie zmieniamy Surprise w Choice ani Choice w Surprise.
============================================================ */

const JOKER_DEFINITION_KEYS = [
    "id",
    "type",
    "rarity",
    "family",
    "hybridType",
    "name",
    "desc",
    "sourceCategories",
    "filter",
    "poolSource"
];

function replaceJokerDefinitionInPlace(target,replacement){
    if(!target || !replacement) return target;

    // Zachowujemy runtime/instance fields:
    // joker, instanceId, instanceMeta, premium, Jeff/Groot/Rocket attachments itd.
    JOKER_DEFINITION_KEYS.forEach(key=>{
        try{ delete target[key]; }catch(error){}
    });

    const cloned=cloneJokerObject(replacement);
    JOKER_DEFINITION_KEYS.forEach(key=>{
        if(Object.prototype.hasOwnProperty.call(cloned,key)){
            target[key]=cloned[key];
        }
    });

    target.type=getJokerMode(target);
    target.rarity=getJokerRarity(target);
    return target;
}

function getResolutionFallbackJoker(joker){
    if(!joker) return null;

    const wantedType=getJokerMode(joker);
    const wantedRarity=getJokerRarity(joker);
    const excludedId=String(joker.id||"");

    let pool=jokers.filter(candidate=>
        getJokerMode(candidate)===wantedType &&
        getJokerRarity(candidate)===wantedRarity &&
        candidate.id!==excludedId &&
        isJokerPlayable(candidate)
    );

    if(!pool.length){
        pool=jokers.filter(candidate=>
            getJokerMode(candidate)===wantedType &&
            candidate.id!==excludedId &&
            isJokerPlayable(candidate)
        );
    }

    if(!pool.length) return null;

    return cloneJokerObject(
        pool[Math.floor(Math.random()*pool.length)]
    );
}

function ensureJokerPlayableForResolution(joker){
    if(!joker) return null;

    const required=getRequiredJokerPoolSize(joker);
    const currentPool=getJokerAvailableCards(joker);

    if(currentPool.length>=required){
        return {
            joker,
            pool:currentPool,
            rerolled:false,
            fromId:joker.id||null,
            toId:joker.id||null
        };
    }

    const fromId=joker.id||null;
    const fallback=getResolutionFallbackJoker(joker);

    if(!fallback){
        console.warn(
            "Joker nie ma wystarczającej puli przy rozstrzyganiu i nie znaleziono bezpiecznego rerollu:",
            fromId,
            "type:",
            getJokerMode(joker),
            "rarity:",
            getJokerRarity(joker),
            "pool:",
            currentPool.length,
            "required:",
            required
        );
        return null;
    }

    replaceJokerDefinitionInPlace(joker,fallback);

    const fallbackPool=getJokerAvailableCards(joker);
    const fallbackRequired=getRequiredJokerPoolSize(joker);

    if(fallbackPool.length<fallbackRequired){
        console.warn(
            "Awaryjny Joker również ma zbyt małą pulę:",
            joker.id,
            "pool:",
            fallbackPool.length,
            "required:",
            fallbackRequired
        );
        return null;
    }

    console.warn(
        "Dynamiczna pula Jokera skurczyła się przed rozstrzygnięciem. Joker został bezpiecznie przelosowany:",
        fromId,
        "->",
        joker.id
    );

    return {
        joker,
        pool:fallbackPool,
        rerolled:true,
        fromId,
        toId:joker.id||null
    };
}

/*
   Choice resolver helper.
   UI może użyć tej funkcji zamiast bezpośredniego getJokerAvailableCards().
   Dzięki temu Choice z dynamicznym źródłem również dostaje late-validation.
*/
function getCardsForChoiceJoker(joker){
    if(!joker || getJokerMode(joker)!=="choice") return [];

    const resolved=ensureJokerPlayableForResolution(joker);
    return resolved ? [...resolved.pool] : [];
}

/* =========================
   LOSOWANIE RARITY
========================= */

function weightedRandomKey(weights, allowedKeys){
    const entries = Object.entries(weights || {})
        .filter(([key, weight]) =>
            (!Array.isArray(allowedKeys) || allowedKeys.includes(key)) &&
            Number(weight) > 0
        );
    const total = entries.reduce((sum, [, weight]) => sum + Number(weight), 0);
    if(!entries.length || total <= 0) return null;

    let roll = Math.random() * total;
    for(const [key, weight] of entries){
        roll -= Number(weight);
        if(roll <= 0) return key;
    }
    return entries[entries.length - 1][0];
}

function getRandomJokerType(excludedIds=[]){
    const excluded = new Set(excludedIds);
    const availableTypes = jokerSettings.allowedTypes.filter(type =>
        jokers.some(joker =>
            getJokerMode(joker) === type &&
            !excluded.has(joker.id) &&
            isJokerPlayable(joker)
        )
    );
    return weightedRandomKey(jokerSettings.typeChances, availableTypes)
        || availableTypes[0]
        || null;
}

function getRandomRarity(type, excludedIds=[]){
    const excluded = new Set(excludedIds);
    const rarityWeights = jokerSettings.rarityChancesByType?.[type]
        || jokerSettings.rarityChances;
    const availableRarities = Object.keys(rarityWeights || {}).filter(rarity =>
        jokers.some(joker =>
            getJokerMode(joker) === type &&
            getJokerRarity(joker) === rarity &&
            !excluded.has(joker.id) &&
            isJokerPlayable(joker)
        )
    );
    return weightedRandomKey(rarityWeights, availableRarities)
        || availableRarities[0]
        || null;
}

/* =========================
   LOSOWANIE JOKERA
========================= */

function getRandomJoker(excludedIds=[]){
    const excluded = new Set(excludedIds);
    const type = getRandomJokerType(excludedIds);
    const rarity = getRandomRarity(type, excludedIds);

    let pool = jokers.filter(j =>
        getJokerMode(j) === type &&
        getJokerRarity(j) === rarity &&
        !excluded.has(j.id) &&
        isJokerPlayable(j)
    );

    /* emergency fallback */

    if(pool.length === 0){
        pool = jokers.filter(j =>
            jokerSettings.allowedTypes.includes(getJokerMode(j)) &&
            !excluded.has(j.id) &&
            isJokerPlayable(j)
        );
    }

    if(pool.length === 0){
        return {
            id:"emergency_choice_any",
            type:"choice",
            rarity:"epic",
            family:"special",
            sourceCategories:["special"],
            name:"Joker Awaryjny",
            desc:"Dowolna karta",
            filter:{}
        };
    }

    const selected = cloneJokerObject(
        pool[Math.floor(Math.random()*pool.length)]
    );
    selected.type = getJokerMode(selected);
    selected.rarity = getJokerRarity(selected);
    return selected;

}

/* =========================
   DODAWANIE DO PACZKI
========================= */

function injectJokersIntoPack(pack){

    const newPack = [...pack];

    if(!newPack.length) return newPack;

    const playersCount = getDraftPlayersCountFallback(newPack);
    const intensity = getJokerIntensity();

    let jokerCount = Math.round(playersCount * intensity);
    jokerCount = Math.max(1, jokerCount);

    const maxByRatio = Math.max(1, Math.floor(newPack.length * getMaxJokerPackRatio()));
    jokerCount = Math.min(jokerCount, maxByRatio, newPack.length);

    const usedIndexes = new Set();
    const usedJokerIds = new Set();

    for(let i=0;i<jokerCount;i++){

        let index = -1;
        let guard = 0;

        while(guard < 200){
            const candidate = Math.floor(Math.random()*newPack.length);

            if(!usedIndexes.has(candidate)){
                index = candidate;
                usedIndexes.add(candidate);
                break;
            }

            guard++;
        }

        if(index < 0) break;

        const selectedJoker = getRandomJoker([...usedJokerIds]);
        if(selectedJoker?.id){
            usedJokerIds.add(selectedJoker.id);
        }

        newPack[index] = {

            joker: true,

            ...selectedJoker

        };

    }

    return newPack;

}

/* =========================
   PREMIUM JOKER DLA JEFFA
   Działa niezależnie od włączonego Trybu Jokerów.
========================= */

function getPremiumJoker(options={}){
    const surpriseOnly=Boolean(options.surpriseOnly);
    const exactRarity=String(options.exactRarity||"").toLowerCase();
    const minimumRarity=String(options.minimumRarity||"rare");
    const rarityOrder=["rare","epic","legendary"];
    const minimumIndex=Math.max(0,rarityOrder.indexOf(minimumRarity));
    const allowedRarities=rarityOrder.includes(exactRarity)
        ? [exactRarity]
        : rarityOrder.slice(minimumIndex);

    let pool=jokers.filter(j=>
        allowedRarities.includes(getJokerRarity(j)) &&
        (!surpriseOnly || getJokerMode(j)==="surprise") &&
        jokerSettings.allowedTypes.includes(getJokerMode(j)) &&
        isJokerPlayable(j)
    );

    if(!pool.length && surpriseOnly){
        pool=jokers.filter(j=>
            allowedRarities.includes(getJokerRarity(j)) &&
            getJokerMode(j)==="surprise" &&
            isJokerPlayable(j)
        );
    }

    if(!pool.length&&exactRarity) return null;
    if(!pool.length) return {joker:true,...getRandomJoker()};

    const weights={
        rare:60,
        epic:30,
        legendary:10
    };
    const availableRarities=allowedRarities.filter(rarity=>
        pool.some(joker=>getJokerRarity(joker)===rarity)
    );
    const selectedRarity=weightedRandomKey(weights,availableRarities)
        || availableRarities[0];
    const rarityPool=pool.filter(joker=>getJokerRarity(joker)===selectedRarity);
    const selected=rarityPool[Math.floor(Math.random()*rarityPool.length)];
    const cloned=cloneJokerObject(selected);
    cloned.type=getJokerMode(cloned);
    cloned.rarity=getJokerRarity(cloned);

    return {
        joker:true,
        premium:true,
        jeffWave:true,
        ...cloned
    };
}

/* =========================
   SURPRISE JOKER
========================= */

function getCardsForSurpriseJoker(joker){

    if(!joker || getJokerMode(joker)!=="surprise") return [];

    const resolved=ensureJokerPlayableForResolution(joker);

    if(!resolved){
        // Nie dokładamy żadnych zwykłych kart jako fillera.
        return [];
    }

    const shuffled=shuffleCopy(resolved.pool);
    return shuffled.slice(0, jokerSettings.surpriseOptionsCount || 3);

}

/* =========================
   DEBUG / AUDYT
   Możesz odpalić w konsoli:
   auditSurpriseJokers()
   getJokerPackPlanDebug()
========================= */

function auditSurpriseJokers(){
    return jokers
        .filter(j => getJokerMode(j) === "surprise")
        .map(j => ({
            id: j.id,
            rarity: getJokerRarity(j),
            family: j.family || null,
            desc: j.desc,
            filter: getJokerFilterConfig(j),
            poolSize: getSurprisePoolSize(j),
            active: isJokerPlayable(j)
        }));
}

function getCanonicalJokerTagIds(){
    const ids=new Set();
    if(typeof TAGS!=="object" || !TAGS) return ids;
    Object.values(TAGS).forEach(group=>{
        if(!Array.isArray(group)) return;
        group.forEach(tag=>{
            if(tag?.id) ids.add(normalizeJokerTag(tag.id));
        });
    });
    return ids;
}

function buildJokerPoolSignature(joker){
    return getJokerAvailableCards(joker)
        .map(card => String(card?.name || "").trim().toLowerCase())
        .filter(Boolean)
        .sort((a,b)=>a.localeCompare(b,"pl"))
        .join("|");
}

function auditJokers(){
    const canonicalTags=getCanonicalJokerTagIds();
    const knownVirtualTags=new Set([
        "cost-greater-than-power",
        "power-greater-than-cost",
        "equal-cost-power",
        "exact-2-power",
        "exact-6-6",
        "power-4-above-cost"
    ]);
    const seenIds=new Set();
    const poolSignatureCounts=new Map();

    jokers.forEach(joker=>{
        const key=`${getJokerMode(joker)}::${buildJokerPoolSignature(joker)}`;
        poolSignatureCounts.set(key,(poolSignatureCounts.get(key)||0)+1);
    });

    return jokers.map(joker=>{
        const config=getJokerFilterConfig(joker);
        const referencedTags=[
            ...config.allOf,
            ...config.anyOf,
            ...config.noneOf
        ].filter(tag=>tag!=="any" && !knownVirtualTags.has(tag));
        const unknownTags=[...new Set(
            referencedTags.filter(tag=>canonicalTags.size && !canonicalTags.has(tag))
        )];
        const rawRelations=Array.isArray(joker?.filter?.relations)
            ? joker.filter.relations
            : [];
        const invalidRelations=rawRelations.filter(relation=>!normalizeJokerRelation(relation));
        const duplicateId=seenIds.has(joker.id);
        seenIds.add(joker.id);
        const poolSize=getJokerAvailableCards(joker).length;
        const requiredPool=getJokerMode(joker)==="surprise"
            ? (jokerSettings.minSurprisePoolSize||3)
            : 1;
        const signatureKey=`${getJokerMode(joker)}::${buildJokerPoolSignature(joker)}`;
        const duplicatePool=(poolSignatureCounts.get(signatureKey)||0)>1;
        const validFamily=["tag","statistics","hybrid","special"].includes(joker?.family);
        const validRarity=["rare","epic","legendary"].includes(getJokerRarity(joker));
        const validDescription=typeof joker?.desc==="string" && joker.desc.trim().length>0;
        const hasError=duplicateId || unknownTags.length || invalidRelations.length || poolSize<requiredPool || !validFamily || !validRarity || !validDescription;

        return {
            id:joker.id,
            type:getJokerMode(joker),
            rarity:getJokerRarity(joker),
            family:joker?.family||null,
            hybridType:joker?.hybridType||null,
            poolSize,
            active:poolSize>=requiredPool,
            duplicateId,
            duplicatePool,
            unknownTags,
            invalidRelations,
            validFamily,
            validRarity,
            validDescription,
            status:hasError
                ? "error"
                : duplicatePool || poolSize<6
                    ? "warning"
                    : "ok"
        };
    });
}

function getJokerCatalogSummary(){
    const audit=auditJokers();
    const summary={
        version:typeof JOKER_CATALOG_VERSION!=="undefined" ? JOKER_CATALOG_VERSION : null,
        total:audit.length,
        active:audit.filter(row=>row.active).length,
        errors:audit.filter(row=>row.status==="error").length,
        warnings:audit.filter(row=>row.status==="warning").length,
        byType:{},
        byRarity:{},
        byFamily:{}
    };
    audit.forEach(row=>{
        summary.byType[row.type]=(summary.byType[row.type]||0)+1;
        summary.byRarity[row.rarity]=(summary.byRarity[row.rarity]||0)+1;
        summary.byFamily[row.family]=(summary.byFamily[row.family]||0)+1;
    });
    return summary;
}

if(typeof window!=="undefined"){
    window.auditJokers=auditJokers;
    window.auditSurpriseJokers=auditSurpriseJokers;
    window.getJokerCatalogSummary=getJokerCatalogSummary;
    window.resetJokerPoolCache=resetJokerPoolCache;
    window.getJokerAvailableCards=getJokerAvailableCards;
    window.getJokerFilterConfig=getJokerFilterConfig;
    window.getJokerMode=getJokerMode;
    window.getJokerRarity=getJokerRarity;
}
