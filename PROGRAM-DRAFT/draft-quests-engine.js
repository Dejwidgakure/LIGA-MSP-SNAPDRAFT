(function(global){
    "use strict";

    const VERSION="1.0.0-new-quests-v1";
    const EXTENSION_ID="draft_quests";
    const DISPLAY_NAME="Kosmiczne Questy";
    const SUPPORTED_EVALUATORS=new Set([
        // Legacy seed names (kept for restore/backward compatibility).
        "pickedCardHasTag",
        "pickedCardMatchesCostBucket",
        "pickedCardPowerAtLeast",
        "pickedCardIsPackEdge",
        "pickedCardDoesNotHaveTag",
        "deckHasDistinctCostBuckets",
        "deckHasTagCount",
        "pickedCardsContainSameCostPair",
        "pickedCardsCostGapAtLeast",
        "pickedCardsAveragePowerAtLeast",
        "pickedCardsContainSamePowerPair",
        "pickedCardsStrictCostDirection",
        "pickedCardsHaveDistinctCosts",
        "pickedCardsCoverCostBands",
        "pickedCardCostBelow",

        // Master Registry 1.0.0-rc1 names currently implemented by the alpha engine.
        "pickedSourceCardIsPackEdge",
        "pickedCardAvoidsTag",
        "windowContainsPairSameCostBucket",
        "twoPickCostDifferenceAtLeast",
        "windowAveragePowerAtLeast",
        "windowContainsPairSamePower",
        "threePickStrictCostDirection",
        "threeDistinctCostBuckets",
        "threePickLowMidHighCost",
        "allPicksCostAtMost",
        "pickedCardHasAnyTag",
        "windowContainsPairSharingArchetype",
        "pickedCardHasSeries",
        "twoPicksShareAnyAbilityType",

        // Quest Wave 2 — generic evaluators.
        "pickedCardPowerComparedToCost",
        "windowFieldSumAtLeast",
        "windowFieldSumAtMost",
        "deckAverageFieldAtMost",
        "deckAverageFieldAtLeast",
        "pickedCardHasAbilityTypeMissingFromDeck",
        "deckHasSameFieldCount",
        "deckHasDistinctTagCount",
        "deckHasCostPolarization",
        "deckAverageFieldBetween",

        // New Quests V1 — pack/deck delta/event evaluators.
        "pickedSourceCardIsPackExtremeCost",
        "pickedSourceCardIsPackHighestPower",
        "deckDistinctCostBucketDeltaAtLeast",
        "deckNewAbilityTypesAddedAtLeast",
        "deckDominantArchetypeGrowthAtLeast",
        "shopPurchaseBeforeNormalPick",
        "shopPurchaseLeavesBalanceAtMost",
        "tradeMarketTransactionCompleted"
    ]);
    const EARLY_RESOLVABLE_AGGREGATES=new Set([
        "pickedCardsContainSameCostPair",
        "windowContainsPairSameCostBucket",
        "pickedCardsContainSamePowerPair",
        "windowContainsPairSamePower",
        "windowContainsPairSharingArchetype",
        "twoPicksShareAnyAbilityType"
    ]);

    const FALLBACK_COST_BUCKETS=Object.freeze([
        Object.freeze({id:"0-1",label:"0–1",min:0,max:1}),
        Object.freeze({id:"2",label:"2",min:2,max:2}),
        Object.freeze({id:"3",label:"3",min:3,max:3}),
        Object.freeze({id:"4",label:"4",min:4,max:4}),
        Object.freeze({id:"5",label:"5",min:5,max:5}),
        Object.freeze({id:"6+",label:"6+",min:6,max:null})
    ]);

    let runtimeRng=Math.random;
    let runtimeEventsBound=false;
    let state=createEmptyState();

    function createEmptyState(){
        return {
            version:VERSION,
            extensionId:EXTENSION_ID,
            displayName:DISPLAY_NAME,
            started:false,
            enabled:false,
            players:[],
            playerStates:[],
            questSequence:0,
            eventSequence:0,
            eventLog:[],
            initialized:false,
            registryVersion:getRegistryVersion(),
            startedAt:null
        };
    }

    function safeClone(value){
        if(value===undefined) return undefined;
        if(typeof structuredClone==="function"){
            try{return structuredClone(value);}catch(error){}
        }
        return JSON.parse(JSON.stringify(value));
    }

    function random(){
        const value=Number(runtimeRng?.());
        return Number.isFinite(value)?Math.max(0,Math.min(.999999999,value)):Math.random();
    }

    function randomItem(items){
        const list=Array.isArray(items)?items:[];
        return list.length?list[Math.floor(random()*list.length)]:null;
    }

    function shuffle(items){
        const result=[...(Array.isArray(items)?items:[])];
        for(let i=result.length-1;i>0;i--){
            const j=Math.floor(random()*(i+1));
            [result[i],result[j]]=[result[j],result[i]];
        }
        return result;
    }

    function normalize(value){return String(value??"").trim().toLowerCase();}
    function number(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}

    function registry(){return global.DraftQuestRegistry||{};}
    function getRegistryVersion(){return registry()?.version||registry()?.meta?.version||null;}
    function slotDefinitions(){
        const master=registry()?.meta?.startingQuestSlots;
        if(Array.isArray(master)&&master.length){
            return master.map((entry,index)=>({
                slot:entry?.slot||`slot_${index+1}`,
                tier:entry?.tier||["street","avengers","celestial"][index%3],
                freeRerolls:Math.max(0,number(entry?.freeRerolls,1))
            }));
        }
        const ext=registry()?.extension||{};
        const count=Math.max(1,number(ext.startingQuestSlots,3));
        const mix=Array.isArray(ext.intendedTierMix)&&ext.intendedTierMix.length?ext.intendedTierMix:["street","avengers","celestial"];
        const free=Math.max(0,number(ext.freeRerollsPerSlot,1));
        return Array.from({length:count},(_,index)=>({slot:`slot_${index+1}`,tier:mix[index%mix.length],freeRerolls:free}));
    }
    function initialRerollsBySlot(){return slotDefinitions().map(entry=>entry.freeRerolls);}
    function costBuckets(){
        const configured=registry()?.costBuckets;
        return Array.isArray(configured)&&configured.length?configured:FALLBACK_COST_BUCKETS;
    }
    function activationProfile(definition){return registry()?.activationProfiles?.[definition?.activationProfile]||null;}
    function normalPickCap(){
        return Math.max(1,number(registry()?.windows?.draftEnd?.normalPickCap,12));
    }
    function activationAllowed(definition,phase,playerState){
        const profile=activationProfile(definition);
        if(phase==="start"&&profile?.startPool===false) return false;
        if(phase==="reroll"&&profile?.rerollPool===false) return false;
        const completed=Math.max(0,number(playerState?.normalPicksCompleted,0));
        const min=Math.max(0,number(profile?.minCompletedNormalPicks,0));
        if(completed<min) return false;
        if(profile?.maxCompletedNormalPicks!==undefined&&profile?.maxCompletedNormalPicks!==null){
            const max=Math.max(0,number(profile.maxCompletedNormalPicks,normalPickCap()));
            if(completed>max) return false;
        }
        const windowDef=registry()?.windows?.[definition?.window];
        if(phase==="reroll"&&windowDef?.type==="relativeNormalPicks"&&completed+number(windowDef?.count,0)>normalPickCap()) return false;
        if(phase==="reroll"&&windowDef?.type==="globalNormalPickCheckpoint"&&completed>=number(windowDef?.pickNumber,0)) return false;
        return true;
    }
    function normalizedEvaluation(definition){
        if(definition?.evaluation) return String(definition.evaluation);
        const resolution=String(definition?.resolution||"");
        if(resolution==="checkpoint") return "checkpoint";
        if(resolution==="windowEnd") return "aggregate";
        if(resolution==="immediate") return "hit";
        return "hit";
    }
    function resolveWindowEndPick(windowDef,startPick){
        if(windowDef?.type==="relativeNormalPicks") return startPick+number(windowDef?.count,0);
        if(windowDef?.type==="globalNormalPickCheckpoint") return number(windowDef?.pickNumber,12);
        if(windowDef?.type==="mainDraftEnd") return number(windowDef?.normalPickNumber,12);
        if(windowDef?.type==="draftEnd") return number(windowDef?.normalPickCap,12);
        return 12;
    }
    function directionLabel(value){return value==="descending"?"malejący":value==="ascending"?"rosnący":String(value||"");}

    function bridgeContext(){
        try{return global.DraftQuestBridge?.getContext?.()||{};}catch(error){return {};}
    }

    function economyEnabled(){return Boolean(global.EconomyEngine?.isEnabled?.());}
    function isEnabled(){return Boolean(state.started&&state.enabled&&economyEnabled());}

    function ensurePlayerState(playerIndex){
        const p=Number(playerIndex);
        if(!Number.isInteger(p)||p<0) return null;
        if(!state.playerStates[p]){
            state.playerStates[p]={
                playerIndex:p,
                playerName:state.players[p]||`Gracz ${p+1}`,
                normalPicksCompleted:0,
                rerollsRemainingBySlot:initialRerollsBySlot(),
                quests:[],
                completed:0,
                failed:0,
                jeffCoinsEarned:0
            };
        }
        return state.playerStates[p];
    }

    function log(type,payload={}){
        const event={
            sequence:++state.eventSequence,
            type:String(type||"quest_event"),
            questRuntimeId:payload.questRuntimeId||null,
            questCode:payload.questCode||null,
            playerIndex:Number.isInteger(payload.playerIndex)?payload.playerIndex:null,
            playerName:Number.isInteger(payload.playerIndex)?state.players[payload.playerIndex]||null:null,
            data:safeClone(payload.data||{}),
            timestamp:Date.now()
        };
        state.eventLog.push(event);
        try{
            global.DraftStateEngine?.log?.(`quest_${type}`,{
                packNumber:payload.packNumber??null,
                pickIndex:payload.pickIndex??null,
                playerIndex:event.playerIndex,
                player:event.playerName,
                reason:`quest_${type}`,
                data:{questRuntimeId:event.questRuntimeId,questCode:event.questCode,...safeClone(event.data)}
            });
        }catch(error){}
        try{global.dispatchEvent?.(new CustomEvent("snapdraft:quest-change",{detail:safeClone(event)}));}catch(error){}
        return event;
    }

    function beginDraft(players,options={}){
        state=createEmptyState();
        state.started=true;
        state.players=(Array.isArray(players)?players:[]).map((entry,index)=>String(typeof entry==="string"?entry:entry?.name||`Gracz ${index+1}`));
        state.enabled=Boolean(options.enabled&&economyEnabled());
        state.playerStates=state.players.map((name,index)=>({
            playerIndex:index,
            playerName:name,
            normalPicksCompleted:0,
            rerollsRemainingBySlot:initialRerollsBySlot(),
            quests:[],
            completed:0,
            failed:0,
            jeffCoinsEarned:0
        }));
        state.registryVersion=getRegistryVersion();
        state.startedAt=Date.now();
        log("started",{data:{enabled:state.enabled,players:state.players.length,registryVersion:state.registryVersion}});
        refreshLobbyDependency();
        return exportState();
    }

    function reset(){
        state=createEmptyState();
        refreshLobbyDependency();
        return exportState();
    }

    function capturePackSnapshot(cards){
        return (Array.isArray(cards)?cards:[]).filter(Boolean).map((card,index)=>({
            index,
            instanceId:card?.instanceId||null,
            name:card?.name||null,
            cost:Number.isFinite(Number(card?.cost))?Number(card.cost):null,
            power:Number.isFinite(Number(card?.power))?Number(card.power):null,
            tags:Array.isArray(card?.tags)?card.tags.map(String):[],
            joker:Boolean(card?.joker)
        }));
    }

    function activePool(){
        const ctx=bridgeContext();
        const banned=new Set((ctx.bannedCards||[]).map(card=>normalize(card?.name||card)));
        return (Array.isArray(ctx.cardDatabase)?ctx.cardDatabase:[]).filter(card=>{
            const name=normalize(card?.name);
            return Boolean(name&&!banned.has(name)&&!card?.joker);
        });
    }

    function getTagDefinitions(category){
        try{
            if(typeof TAGS!=="undefined"&&TAGS&&Array.isArray(TAGS[category])) return TAGS[category];
        }catch(error){}
        return [];
    }

    function tagName(tagId,category){
        const id=normalize(tagId);
        const def=getTagDefinitions(category).find(entry=>normalize(entry?.id)===id);
        return def?.name||String(tagId||"");
    }

    function cardTags(card){return new Set((Array.isArray(card?.tags)?card.tags:[]).map(normalize).filter(Boolean));}
    function cardHasTag(card,tag){return cardTags(card).has(normalize(tag));}

    function bucketById(id){return costBuckets().find(bucket=>bucket.id===id)||null;}
    function costMatchesBucket(cost,bucket){
        const value=Number(cost);
        if(!Number.isFinite(value)||!bucket) return false;
        if(value<Number(bucket.min)) return false;
        return bucket.max===null||bucket.max===undefined?true:value<=Number(bucket.max);
    }
    function costBucketId(cost){
        return costBuckets().find(bucket=>costMatchesBucket(cost,bucket))?.id||null;
    }

    function shareMatching(pool,predicate){
        if(!pool.length) return 0;
        return pool.filter(predicate).length/pool.length;
    }

    function eligibleTagValues(parameter,pool){
        const category=parameter?.category;
        const min=Number(parameter?.eligibility?.minActivePoolShare??0);
        const max=Number(parameter?.eligibility?.maxActivePoolShare??1);
        const minCount=Math.max(0,Number(parameter?.eligibility?.minActivePoolCount??0));
        const allowed=Array.isArray(parameter?.allowed)?new Set(parameter.allowed.map(normalize)):null;
        return getTagDefinitions(category).map(def=>({id:def.id,label:def.name||def.id})).filter(entry=>{
            if(allowed&&!allowed.has(normalize(entry.id))) return false;
            const count=pool.filter(card=>cardHasTag(card,entry.id)).length;
            const share=pool.length?count/pool.length:0;
            return count>=minCount&&share>=min&&share<=max;
        });
    }

    function tagIdsForCategory(category){
        return new Set(getTagDefinitions(category).map(def=>normalize(def?.id)).filter(Boolean));
    }

    function historyEntryTags(entry,category){
        const allowed=tagIdsForCategory(category);
        return new Set((entry?.tags||[]).map(normalize).filter(tag=>allowed.has(tag)));
    }

    function materializeParameters(definition){
        const pool=activePool();
        const params={};
        const source=definition?.parameters||{};
        for(const [key,raw] of Object.entries(source)){
            if(Array.isArray(raw)){
                params[key]=safeClone(raw);
                continue;
            }
            if(!raw||typeof raw!=="object"){
                params[key]=raw;
                continue;
            }
            if(raw.source==="tagCategory"){
                const values=eligibleTagValues(raw,pool);
                const chosen=randomItem(values);
                if(!chosen) return null;
                params[key]=chosen.id;
                params[`${key}Name`]=chosen.label;
                continue;
            }
            if(raw.source==="twoCompatibleTags"){
                const minEach=Number(raw?.eligibility?.minEachActivePoolShare??0);
                const minCombined=Number(raw?.eligibility?.minCombinedActivePoolShare??0);
                const values=eligibleTagValues({
                    ...raw,
                    eligibility:{...(raw.eligibility||{}),minActivePoolShare:Math.max(minEach,Number(raw?.eligibility?.minActivePoolShare??0))}
                },pool);
                const pairs=[];
                for(let a=0;a<values.length;a++){
                    for(let b=a+1;b<values.length;b++){
                        const first=values[a],second=values[b];
                        const combined=shareMatching(pool,card=>cardHasTag(card,first.id)||cardHasTag(card,second.id));
                        if(combined>=minCombined) pairs.push([first,second]);
                    }
                }
                const chosen=randomItem(pairs);
                if(!chosen) return null;
                params[key]=chosen.map(entry=>entry.id);
                params.targetTagA=chosen[0].id;
                params.targetTagB=chosen[1].id;
                params.targetTagAName=chosen[0].label;
                params.targetTagBName=chosen[1].label;
                continue;
            }
            if(raw.source==="costBuckets"){
                const min=Number(raw?.eligibility?.minActivePoolShare??0);
                const candidates=(raw.values||[]).map(id=>bucketById(id)).filter(Boolean).filter(bucket=>shareMatching(pool,card=>costMatchesBucket(card?.cost,bucket))>=min);
                const chosen=randomItem(candidates);
                if(!chosen) return null;
                params[key]=chosen.id;
                params[`${key}Label`]=chosen.label;
                continue;
            }
            if(!raw.source&&Array.isArray(raw.values)){
                let values=[...raw.values];
                if(key==="targetPower"&&raw.eligibility?.minActivePoolShare!==undefined){
                    const min=Number(raw.eligibility.minActivePoolShare||0);
                    values=values.filter(value=>shareMatching(pool,card=>number(card?.power,-999)>=Number(value))>=min);
                }
                const chosen=randomItem(values);
                if(chosen===null||chosen===undefined) return null;
                if(chosen&&typeof chosen==="object"){
                    params[key]=chosen.id??chosen.value??chosen;
                    if(chosen.label!==undefined) params[`${key}Label`]=chosen.label;
                }else{
                    params[key]=chosen;
                    if(key==="direction") params[`${key}Label`]=directionLabel(chosen);
                }
                continue;
            }
            if(raw.source==="values"){
                let values=[...(raw.values||[])];
                if(key==="targetPower"&&raw.eligibility?.minActivePoolShare!==undefined){
                    const min=Number(raw.eligibility.minActivePoolShare||0);
                    values=values.filter(value=>shareMatching(pool,card=>number(card?.power,-999)>=Number(value))>=min);
                }
                if(key==="targetAveragePower"&&raw.eligibility?.minimumReasonableOpportunity!==undefined){
                    const min=Number(raw.eligibility.minimumReasonableOpportunity||0);
                    values=values.filter(value=>shareMatching(pool,card=>number(card?.power,-999)>=Number(value))>=Math.min(.8,min));
                }
                const chosen=randomItem(values);
                if(chosen===null||chosen===undefined) return null;
                params[key]=chosen;
                continue;
            }
            if(raw.source==="enum"){
                const chosen=randomItem(raw.values||[]);
                if(chosen===null||chosen===undefined) return null;
                if(chosen&&typeof chosen==="object"){
                    params[key]=chosen.id;
                    params[`${key}Label`]=chosen.label||chosen.id;
                }else{
                    params[key]=chosen;
                    params[`${key}Label`]=key==="direction"?directionLabel(chosen):String(chosen);
                }
                continue;
            }
            params[key]=safeClone(raw);
        }
        return params;
    }

    function renderQuestText(definition,params){
        const values={...params};
        if(values.targetTag&&!values.targetTagName){
            const raw=definition?.parameters?.targetTag;
            values.targetTagName=tagName(values.targetTag,raw?.category);
        }
        if(Array.isArray(values.targetTags)&&values.targetTags.length>=2){
            const raw=definition?.parameters?.targetTags;
            if(!values.targetTagA) values.targetTagA=values.targetTags[0];
            if(!values.targetTagB) values.targetTagB=values.targetTags[1];
            if(!values.targetTagAName) values.targetTagAName=tagName(values.targetTagA,raw?.category);
            if(!values.targetTagBName) values.targetTagBName=tagName(values.targetTagB,raw?.category);
        }
        if(values.targetCost&&!values.targetCostLabel) values.targetCostLabel=bucketById(values.targetCost)?.label||values.targetCost;
        if(values.targetSeries&&!values.targetSeriesName) values.targetSeriesName=tagName(values.targetSeries,"series")||String(values.targetSeries);
        if(values.direction&&!values.directionLabel){
            const options=definition?.parameters?.direction?.values||[];
            const objectMatch=options.find(entry=>entry&&typeof entry==="object"&&entry.id===values.direction);
            values.directionLabel=objectMatch?.label||directionLabel(values.direction);
        }
        return String(definition?.textTemplate||definition?.name||"Quest").replace(/\{([^}]+)\}/g,(_,key)=>values[key]??`{${key}}`);
    }

    function extensionEnabled(key){
        const normalizedKey=String(key||"").trim();
        if(!normalizedKey) return false;
        if(normalizedKey==="economy") return economyEnabled();

        const ctx=bridgeContext();
        const sources=[
            ctx?.extensions,
            ctx?.draftConfigV2?.extensions,
            ctx?.config?.extensions,
            global?.draftConfigV2?.extensions,
            global?.DraftConfigV2?.extensions
        ];
        for(const source of sources){
            const entry=source?.[normalizedKey];
            if(entry===true) return true;
            if(entry&&typeof entry==="object"&&entry.enabled===true) return true;
        }

        if(normalizedKey==="galacticMarket"){
            try{
                if(global.TradeMarketEngine?.isEnabled?.()===true) return true;
                if(global.GalacticMarketEngine?.isEnabled?.()===true) return true;
            }catch(error){}
        }

        if(typeof document!=="undefined"){
            const ids={
                galacticMarket:["enableGalacticMarket","enableTradeMarket","enableMarket","enableGalacticTradeMarket"]
            }[normalizedKey]||[];
            for(const id of ids){
                const node=document.getElementById(id);
                if(node?.checked===true) return true;
            }
            const generic=document.querySelector?.(
                `[data-extension-id="${normalizedKey}"] input[type="checkbox"],`+
                `[data-extension="${normalizedKey}"] input[type="checkbox"]`
            );
            if(generic?.checked===true) return true;
        }
        return false;
    }

    function modeExcluded(definition){
        const ctx=bridgeContext();
        const excluded=definition?.requirements?.excludedModes||[];
        if(excluded.includes("galacticCurrent")&&ctx.modes?.galacticCurrent) return true;
        if((definition?.requirements?.packLayout||definition?.requirements?.classicPackLayout||definition?.requirements?.classicPackFlow)&&ctx.modes?.galacticCurrent) return true;
        if(definition?.requirements?.pokerDraft===false&&ctx.modes?.pokerDraft) return true;
        if(definition?.requirements?.economyEnabled&&!economyEnabled()) return true;
        const requiredExtensions=Array.isArray(definition?.requirements?.extensions)?definition.requirements.extensions:[];
        if(requiredExtensions.some(key=>!extensionEnabled(key))) return true;
        return false;
    }

    function inferProgressTarget(definition,params,windowDef){
        const explicit=Number(definition?.progress?.target||params?.[definition?.progress?.targetParameter]||0);
        if(explicit>0) return explicit;
        const evaluator=String(definition?.evaluator||"");
        if(evaluator==="deckHasDistinctCostBuckets") return Number(params?.requiredBuckets||4);
        if(evaluator==="deckHasTagCount") return Number(params?.requiredCards||3);
        if(evaluator==="deckHasSameFieldCount") return Number(params?.requiredCards||4);
        if(evaluator==="deckHasDistinctTagCount") return Number(params?.requiredDistinct||0);
        if(evaluator==="deckHasCostPolarization") return Number(params?.requiredLow||0)+Number(params?.requiredHigh||0);
        if(["windowFieldSumAtLeast","windowFieldSumAtMost"].includes(evaluator)) return Number(params?.targetSum||0);
        if(["deckAverageFieldAtMost","deckAverageFieldAtLeast"].includes(evaluator)) return Number(params?.targetAverage||0);
        if(evaluator==="deckAverageFieldBetween") return 1;
        if(evaluator==="deckDistinctCostBucketDeltaAtLeast") return Number(params?.requiredIncrease||2);
        if(evaluator==="deckNewAbilityTypesAddedAtLeast") return Number(params?.requiredNewTypes||2);
        if(evaluator==="deckDominantArchetypeGrowthAtLeast") return Number(params?.requiredGrowth||2);
        if(["shopPurchaseBeforeNormalPick","shopPurchaseLeavesBalanceAtMost","tradeMarketTransactionCompleted"].includes(evaluator)) return 1;
        if(["pickedCardHasTag","pickedCardHasAnyTag","pickedCardHasSeries","pickedCardMatchesCostBucket","pickedCardPowerAtLeast","pickedCardIsPackEdge","pickedSourceCardIsPackEdge","pickedCardPowerComparedToCost","pickedCardHasAbilityTypeMissingFromDeck","pickedSourceCardIsPackExtremeCost","pickedSourceCardIsPackHighestPower"].includes(evaluator)) return 1;
        if(["pickedCardsContainSameCostPair","windowContainsPairSameCostBucket","pickedCardsContainSamePowerPair","windowContainsPairSamePower","windowContainsPairSharingArchetype","twoPicksShareAnyAbilityType"].includes(evaluator)) return 2;
        if(["pickedCardsStrictCostDirection","threePickStrictCostDirection","pickedCardsHaveDistinctCosts","threeDistinctCostBuckets","threePickLowMidHighCost"].includes(evaluator)) return 3;
        if(["pickedCardsCostGapAtLeast","twoPickCostDifferenceAtLeast"].includes(evaluator)) return Number(params?.minCostGap||params?.minDifference||3);
        if(["pickedCardsAveragePowerAtLeast","windowAveragePowerAtLeast"].includes(evaluator)) return Number(params?.targetAveragePower||0);
        if(["pickedCardDoesNotHaveTag","pickedCardAvoidsTag","pickedCardCostBelow","allPicksCostAtMost"].includes(evaluator)&&windowDef?.type==="relativeNormalPicks") return Number(windowDef.count||0);
        return 0;
    }

    function questFieldValue(entry,field){
        if(field==="baseCost") return number(entry?.baseCost??entry?.cost,0);
        if(field==="basePower") return number(entry?.basePower??entry?.power,0);
        return number(entry?.[field],0);
    }

    function captureActivationContext(definition,playerState){
        const deck=bridgeContext()?.decks?.[playerState?.playerIndex]||[];
        const cards=Array.isArray(deck)?deck:[];
        const evaluator=String(definition?.evaluator||"");
        const result={deckSize:cards.length};

        const abilityTypes=new Set();
        cards.forEach(card=>{
            cardTags(card).forEach(tag=>{
                if(tagIdsForCategory("abilityTypes").has(tag)) abilityTypes.add(tag);
            });
        });

        if(["pickedCardHasAbilityTypeMissingFromDeck","deckNewAbilityTypesAddedAtLeast"].includes(evaluator)){
            result.deckAbilityTypes=[...abilityTypes];
        }

        if(evaluator==="deckDistinctCostBucketDeltaAtLeast"){
            result.deckCostBuckets=[...new Set(cards.map(card=>costBucketId(card?.cost)).filter(Boolean))];
        }

        if(evaluator==="deckDominantArchetypeGrowthAtLeast"){
            const archetypes=tagIdsForCategory("deckArchetypes");
            const counts=new Map();
            cards.forEach(card=>cardTags(card).forEach(tag=>{
                if(archetypes.has(tag)) counts.set(tag,(counts.get(tag)||0)+1);
            }));
            const best=Math.max(0,...counts.values());
            const leaders=[...counts.entries()].filter(([,count])=>count===best&&count>0).map(([tag])=>tag);
            const chosen=randomItem(leaders);
            if(chosen){
                result.targetArchetype=chosen;
                result.targetArchetypeName=tagName(chosen,"deckArchetypes")||chosen;
                result.targetArchetypeBaseline=Number(counts.get(chosen)||0);
            }
        }

        return result;
    }

    function materializeQuest(definition,playerState){
        if(!definition||modeExcluded(definition)) return null;
        const params=materializeParameters(definition);
        if(params===null) return null;
        const windowDef=registry()?.windows?.[definition.window]||null;
        const startPick=Number(playerState.normalPicksCompleted||0);
        const endPick=resolveWindowEndPick(windowDef,startPick);
        const activationContext=captureActivationContext(definition,playerState);
        const evaluator=String(definition?.evaluator||"");

        // Deck-reactive quests must have a real baseline and a legal path to success.
        if(evaluator==="pickedCardHasAbilityTypeMissingFromDeck"&&!(activationContext.deckAbilityTypes||[]).length) return null;

        if(evaluator==="deckDistinctCostBucketDeltaAtLeast"){
            const baseline=new Set(activationContext.deckCostBuckets||[]);
            const required=Math.max(1,Number(params.requiredIncrease||2));
            if(costBuckets().length-baseline.size<required) return null;
        }

        if(evaluator==="deckNewAbilityTypesAddedAtLeast"){
            const baseline=new Set((activationContext.deckAbilityTypes||[]).map(normalize));
            const required=Math.max(1,Number(params.requiredNewTypes||2));
            const available=new Set();
            activePool().forEach(card=>cardTags(card).forEach(tag=>{
                if(tagIdsForCategory("abilityTypes").has(tag)&&!baseline.has(tag)) available.add(tag);
            }));
            if(available.size<required) return null;
        }

        if(evaluator==="deckDominantArchetypeGrowthAtLeast"){
            if(!activationContext.targetArchetype) return null;
            const required=Math.max(1,Number(params.requiredGrowth||2));
            const poolCount=activePool().filter(card=>cardHasTag(card,activationContext.targetArchetype)).length;
            if(poolCount<required) return null;
            params.targetArchetype=activationContext.targetArchetype;
            params.targetArchetypeName=activationContext.targetArchetypeName;
        }

        return {
            runtimeId:`quest-${++state.questSequence}`,
            code:definition.code,
            id:definition.id,
            name:definition.name,
            family:definition.family,
            tier:definition.tier,
            rewardJC:Number(definition.rewardJC||registry()?.tiers?.[definition.tier]?.defaultRewardJC||registry()?.tiers?.[definition.tier]?.rewardJC||0),
            evaluation:normalizedEvaluation(definition),
            evaluator:definition.evaluator,
            window:definition.window,
            windowLabel:windowDef?.label||definition.window,
            failureRule:definition.failure,
            parameters:safeClone(params),
            activationContext:safeClone(activationContext),
            text:renderQuestText(definition,params),
            status:"active",
            assignedAtNormalPick:startPick,
            endsAtNormalPick:endPick,
            progress:{current:0,target:inferProgressTarget(definition,params,windowDef),meta:{}},
            history:[],
            completedAtNormalPick:null,
            failedAtNormalPick:null,
            rewardGranted:false
        };
    }

    function questDefinitions(){return Array.isArray(global.DraftQuestRegistry?.quests)?global.DraftQuestRegistry.quests:[];}
    function definitionSupported(definition){
        return Boolean(definition&&SUPPORTED_EVALUATORS.has(String(definition.evaluator||"")));
    }

    function chooseQuestForTier(tier,playerState,excludedCodes=new Set(),phase="start"){
        const candidates=shuffle(questDefinitions().filter(def=>definitionSupported(def)&&activationAllowed(def,phase,playerState)&&def?.tier===tier&&!excludedCodes.has(def.code)&&!modeExcluded(def)));
        for(const def of candidates){
            const quest=materializeQuest(def,playerState);
            if(quest) return quest;
        }
        return null;
    }

    function ensureInitialQuests(){
        if(!isEnabled()) return {ok:false,reason:"disabled"};
        if(state.initialized) return {ok:true,alreadyInitialized:true};
        const slotDefs=slotDefinitions();
        const tierMix=slotDefs.map(entry=>entry.tier);
        const slots=slotDefs.length;
        state.playerStates.forEach(playerState=>{
            const used=new Set();
            const assigned=[];
            for(let slot=0;slot<slots;slot++){
                const tier=tierMix[slot%tierMix.length];
                let quest=chooseQuestForTier(tier,playerState,used,"start");
                if(!quest){
                    const fallback=shuffle(questDefinitions().filter(def=>definitionSupported(def)&&activationAllowed(def,"start",playerState)&&!used.has(def.code)&&!modeExcluded(def)));
                    for(const def of fallback){quest=materializeQuest(def,playerState);if(quest) break;}
                }
                if(quest){quest.slotIndex=slot;used.add(quest.code);assigned.push(quest);}
            }
            playerState.quests=assigned;
            assigned.forEach(quest=>log("assigned",{playerIndex:playerState.playerIndex,questRuntimeId:quest.runtimeId,questCode:quest.code,data:{tier:quest.tier,text:quest.text,rewardJC:quest.rewardJC,endsAtNormalPick:quest.endsAtNormalPick}}));
        });
        state.initialized=true;
        log("initialized",{data:{players:state.playerStates.length,slots}});
        return {ok:true,players:state.playerStates.length};
    }

    function getQuestDefinition(quest){return questDefinitions().find(def=>def.code===quest?.code)||null;}

    function pickedCardFromContext(context){return context?.resultCard||context?.sourceCard||context?.card||null;}

    function pickedSnapshotEntry(context,card){
        const snapshot=Array.isArray(context?.packSnapshotBeforePick)?context.packSnapshotBeforePick:[];
        const sourceId=context?.pickedPackCardInstanceId||context?.sourceCard?.instanceId||card?.instanceId||null;
        if(sourceId!==null&&sourceId!==undefined){
            const found=snapshot.find(entry=>entry?.instanceId===sourceId);
            if(found) return found;
        }
        const sourceName=normalize(context?.sourceCard?.name||card?.name);
        return snapshot.find(entry=>normalize(entry?.name)===sourceName)||null;
    }

    function updateProgress(quest,context,playerState){
        const def=getQuestDefinition(quest);
        const card=pickedCardFromContext(context);
        const history=quest.history;
        const params=quest.parameters||{};
        const deck=bridgeContext()?.decks?.[playerState.playerIndex]||[];
        let success=false;
        let failEarly=false;
        let current=quest.progress?.current||0;

        switch(quest.evaluator){
            case "pickedCardHasTag":
                success=cardHasTag(card,params.targetTag); current=success?1:0; break;
            case "pickedCardHasAnyTag":{
                const targets=Array.isArray(params.targetTags)?params.targetTags:[params.targetTagA,params.targetTagB].filter(Boolean);
                success=targets.some(tag=>cardHasTag(card,tag)); current=success?1:0; break;
            }
            case "pickedCardHasSeries":
                success=cardHasTag(card,params.targetSeries); current=success?1:0; break;
            case "pickedCardMatchesCostBucket":
                success=costMatchesBucket(card?.cost,bucketById(params.targetCost)); current=success?1:0; break;
            case "pickedCardPowerAtLeast":
                success=number(card?.power,-999)>=Number(params.targetPower); current=success?1:0; break;
            case "pickedCardIsPackEdge":
            case "pickedSourceCardIsPackEdge":{
                const snapshot=context?.packSnapshotBeforePick||[];
                const sourceId=context?.pickedPackCardInstanceId||context?.sourceCard?.instanceId||card?.instanceId||null;
                const index=snapshot.findIndex(entry=>entry?.instanceId===sourceId);
                success=index>=0&&(index===0||index===snapshot.length-1);
                current=success?1:0;
                quest.progress.meta.packSnapshotAvailable=Boolean(snapshot.length);
                break;
            }
            case "pickedCardDoesNotHaveTag":
            case "pickedCardAvoidsTag":
                success=!cardHasTag(card,params.targetTag); failEarly=!success; current=success?history.length:Math.max(0,history.length-1); break;
            case "deckHasDistinctCostBuckets":{
                const distinct=new Set(deck.map(entry=>costBucketId(entry?.cost)).filter(Boolean));
                current=distinct.size; success=current>=Number(params.requiredBuckets||4); break;
            }
            case "deckHasTagCount":
                current=deck.filter(entry=>cardHasTag(entry,params.targetTag)).length; success=current>=Number(params.requiredCards||3); break;
            case "pickedCardsContainSameCostPair":{
                const counts=new Map(); history.forEach(entry=>counts.set(entry.baseCost,(counts.get(entry.baseCost)||0)+1));
                current=Math.max(0,...counts.values()); success=current>=Number(params.requiredMatchingCards||2); break;
            }
            case "windowContainsPairSameCostBucket":{
                const counts=new Map(); history.forEach(entry=>{const bucket=costBucketId(entry.baseCost);if(bucket) counts.set(bucket,(counts.get(bucket)||0)+1);});
                current=Math.max(0,...counts.values()); success=current>=2; break;
            }
            case "pickedCardsCostGapAtLeast":
                if(history.length>=2){current=Math.abs(number(history[0].baseCost)-number(history[1].baseCost));success=current>=Number(params.minCostGap||3);} break;
            case "twoPickCostDifferenceAtLeast":
                if(history.length>=2){current=Math.abs(number(history[0].baseCost)-number(history[1].baseCost));success=current>=Number(params.minDifference||3);} break;
            case "pickedCardsAveragePowerAtLeast":
            case "windowAveragePowerAtLeast":
                current=history.length?history.reduce((sum,entry)=>sum+number(entry.basePower),0)/history.length:0;
                success=history.length>=3&&current>=Number(params.targetAveragePower||0); break;
            case "pickedCardsContainSamePowerPair":
            case "windowContainsPairSamePower":{
                const counts=new Map(); history.forEach(entry=>counts.set(entry.basePower,(counts.get(entry.basePower)||0)+1));
                current=Math.max(0,...counts.values()); success=current>=Number(params.requiredMatchingCards||2); break;
            }
            case "windowContainsPairSharingArchetype":{
                let found=false;
                for(let a=0;a<history.length&&!found;a++){
                    const left=historyEntryTags(history[a],"deckArchetypes");
                    if(!left.size) continue;
                    for(let b=a+1;b<history.length&&!found;b++){
                        const right=historyEntryTags(history[b],"deckArchetypes");
                        found=[...left].some(tag=>right.has(tag));
                    }
                }
                success=found;
                current=found?2:Math.min(1,history.length);
                break;
            }
            case "twoPicksShareAnyAbilityType":{
                if(history.length>=2){
                    const left=historyEntryTags(history[history.length-2],"abilityTypes");
                    const right=historyEntryTags(history[history.length-1],"abilityTypes");
                    success=[...left].some(tag=>right.has(tag));
                }
                current=success?2:Math.min(1,history.length);
                break;
            }
            case "pickedCardsStrictCostDirection":
            case "threePickStrictCostDirection":{
                current=history.length;
                if(history.length>=2){
                    const previous=number(history[history.length-2].baseCost);
                    const latest=number(history[history.length-1].baseCost);
                    const ok=params.direction==="descending"?latest<previous:latest>previous;
                    if(!ok) failEarly=true;
                }
                success=!failEarly&&history.length>=3;
                break;
            }
            case "pickedCardsHaveDistinctCosts":{
                const values=history.map(entry=>entry.baseCost);
                const distinct=new Set(values);
                current=distinct.size;
                if(distinct.size<values.length) failEarly=true;
                success=!failEarly&&distinct.size>=Number(params.requiredDistinctCosts||3);
                break;
            }
            case "threeDistinctCostBuckets":{
                const distinct=new Set(history.map(entry=>costBucketId(entry.baseCost)).filter(Boolean));
                current=distinct.size;
                success=history.length>=3&&distinct.size>=3;
                break;
            }
            case "pickedCardsCoverCostBands":{
                const bands=def?.parameters?.bands||[];
                const covered=new Set();
                history.forEach(entry=>bands.forEach(band=>{if(costMatchesBucket(entry.baseCost,band)) covered.add(band.id);}));
                current=covered.size; success=covered.size>=bands.length&&bands.length>0; break;
            }
            case "threePickLowMidHighCost":{
                const covered=new Set();
                history.forEach(entry=>{const c=number(entry.baseCost,-1);if(c>=0&&c<=2) covered.add("low");else if(c>=3&&c<=4) covered.add("mid");else if(c>=5) covered.add("high");});
                current=covered.size; success=history.length>=3&&covered.size===3; break;
            }
            case "pickedCardCostBelow":
                success=number(card?.cost,999)<Number(params.forbiddenCostAtLeast||5); failEarly=!success; current=success?history.length:Math.max(0,history.length-1); break;
            case "allPicksCostAtMost":
                success=number(card?.cost,999)<=Number(params.maxCost??4); failEarly=!success; current=success?history.length:Math.max(0,history.length-1); break;
            case "pickedCardPowerComparedToCost":{
                const power=number(card?.power,-999);
                const cost=number(card?.cost,999);
                const relation=String(params.relation||"greater");
                success=relation==="equal"?power===cost:relation==="less"?power<cost:power>cost;
                current=success?1:0;
                break;
            }
            case "windowFieldSumAtLeast":
            case "windowFieldSumAtMost":{
                const field=String(params.field||"basePower");
                current=history.reduce((sum,entry)=>sum+questFieldValue(entry,field),0);
                const target=Number(params.targetSum||0);
                success=quest.evaluator==="windowFieldSumAtMost"?current<=target:current>=target;
                quest.progress.meta.field=field;
                break;
            }
            case "deckAverageFieldAtMost":
            case "deckAverageFieldAtLeast":{
                const field=String(params.field||"baseCost");
                const values=(Array.isArray(deck)?deck:[]).map(entry=>questFieldValue(entry,field));
                current=values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;
                const target=Number(params.targetAverage||0);
                success=values.length>0&&(quest.evaluator==="deckAverageFieldAtMost"?current<=target:current>=target);
                quest.progress.meta.average=current;
                quest.progress.meta.field=field;
                break;
            }
            case "pickedCardHasAbilityTypeMissingFromDeck":{
                const existing=new Set((quest.activationContext?.deckAbilityTypes||[]).map(normalize));
                const abilityTags=tagIdsForCategory("abilityTypes");
                const picked=[...cardTags(card)].filter(tag=>abilityTags.has(tag));
                success=picked.some(tag=>!existing.has(tag));
                current=success?1:0;
                quest.progress.meta.activationAbilityTypes=[...existing];
                break;
            }
            case "deckHasSameFieldCount":{
                const field=String(params.field||"basePower");
                const counts=new Map();
                (Array.isArray(deck)?deck:[]).forEach(entry=>{
                    const value=questFieldValue(entry,field);
                    counts.set(value,(counts.get(value)||0)+1);
                });
                current=Math.max(0,...counts.values());
                success=current>=Number(params.requiredCards||4);
                quest.progress.meta.field=field;
                break;
            }
            case "deckHasDistinctTagCount":{
                const category=String(params.category||"deckArchetypes");
                const allowed=tagIdsForCategory(category);
                const distinct=new Set();
                (Array.isArray(deck)?deck:[]).forEach(entry=>cardTags(entry).forEach(tag=>{if(allowed.has(tag)) distinct.add(tag);}));
                current=distinct.size;
                success=current>=Number(params.requiredDistinct||0);
                quest.progress.meta.category=category;
                break;
            }
            case "deckHasCostPolarization":{
                const lowMax=Number(params.lowMax??2);
                const highMin=Number(params.highMin??5);
                const low=(Array.isArray(deck)?deck:[]).filter(entry=>number(entry?.cost,999)<=lowMax).length;
                const high=(Array.isArray(deck)?deck:[]).filter(entry=>number(entry?.cost,-999)>=highMin).length;
                const requiredLow=Number(params.requiredLow||0);
                const requiredHigh=Number(params.requiredHigh||0);
                current=Math.min(low,requiredLow)+Math.min(high,requiredHigh);
                success=low>=requiredLow&&high>=requiredHigh;
                quest.progress.meta.low=low;
                quest.progress.meta.high=high;
                break;
            }
            case "deckAverageFieldBetween":{
                const field=String(params.field||"baseCost");
                const values=(Array.isArray(deck)?deck:[]).map(entry=>questFieldValue(entry,field));
                const average=values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;
                const min=Number(params.minAverage??-Infinity);
                const max=Number(params.maxAverage??Infinity);
                success=values.length>0&&average>=min&&average<=max;
                current=success?1:0;
                quest.progress.meta.average=average;
                quest.progress.meta.range=[min,max];
                quest.progress.meta.field=field;
                break;
            }
            case "pickedSourceCardIsPackExtremeCost":{
                const snapshot=Array.isArray(context?.packSnapshotBeforePick)?context.packSnapshotBeforePick:[];
                const picked=pickedSnapshotEntry(context,card);
                const costs=snapshot.map(entry=>Number(entry?.cost)).filter(Number.isFinite);
                const pickedCost=Number(picked?.cost);
                const direction=String(params.direction||"highest");
                if(costs.length&&Number.isFinite(pickedCost)){
                    const extreme=direction==="lowest"?Math.min(...costs):Math.max(...costs);
                    success=pickedCost===extreme;
                    quest.progress.meta.extremeCost=extreme;
                    quest.progress.meta.pickedCost=pickedCost;
                }
                current=success?1:0;
                break;
            }
            case "pickedSourceCardIsPackHighestPower":{
                const snapshot=Array.isArray(context?.packSnapshotBeforePick)?context.packSnapshotBeforePick:[];
                const picked=pickedSnapshotEntry(context,card);
                const powers=snapshot.map(entry=>Number(entry?.power)).filter(Number.isFinite);
                const pickedPower=Number(picked?.power);
                if(powers.length&&Number.isFinite(pickedPower)){
                    const highest=Math.max(...powers);
                    success=pickedPower===highest;
                    quest.progress.meta.highestPower=highest;
                    quest.progress.meta.pickedPower=pickedPower;
                }
                current=success?1:0;
                break;
            }
            case "deckDistinctCostBucketDeltaAtLeast":{
                const baseline=new Set(quest.activationContext?.deckCostBuckets||[]);
                const now=new Set((Array.isArray(deck)?deck:[]).map(entry=>costBucketId(entry?.cost)).filter(Boolean));
                const added=[...now].filter(bucket=>!baseline.has(bucket));
                current=added.length;
                success=current>=Number(params.requiredIncrease||2);
                quest.progress.meta.addedBuckets=added;
                break;
            }
            case "deckNewAbilityTypesAddedAtLeast":{
                const baseline=new Set((quest.activationContext?.deckAbilityTypes||[]).map(normalize));
                const allowed=tagIdsForCategory("abilityTypes");
                const currentTypes=new Set();
                (Array.isArray(deck)?deck:[]).forEach(entry=>cardTags(entry).forEach(tag=>{
                    if(allowed.has(tag)) currentTypes.add(tag);
                }));
                const added=[...currentTypes].filter(tag=>!baseline.has(tag));
                current=added.length;
                success=current>=Number(params.requiredNewTypes||2);
                quest.progress.meta.addedAbilityTypes=added;
                break;
            }
            case "deckDominantArchetypeGrowthAtLeast":{
                const target=normalize(quest.activationContext?.targetArchetype||params.targetArchetype);
                const baseline=Number(quest.activationContext?.targetArchetypeBaseline||0);
                const now=(Array.isArray(deck)?deck:[]).filter(entry=>cardHasTag(entry,target)).length;
                current=Math.max(0,now-baseline);
                success=current>=Number(params.requiredGrowth||2);
                quest.progress.meta.targetArchetype=target;
                quest.progress.meta.baseline=baseline;
                quest.progress.meta.currentCount=now;
                break;
            }
            case "shopPurchaseBeforeNormalPick":
            case "shopPurchaseLeavesBalanceAtMost":
            case "tradeMarketTransactionCompleted":
                current=Number(quest.progress?.meta?.matchedEvents||0);
                success=current>=1;
                break;
            default:
                quest.progress.meta.unsupportedEvaluator=quest.evaluator||null;
                break;
        }
        quest.progress.current=current;
        return {success,failEarly};
    }

    function updateEventProgress(quest,eventType,eventContext,playerState){
        const params=quest.parameters||{};
        const normalizedType=normalize(eventType);
        let success=false;

        switch(quest.evaluator){
            case "shopPurchaseBeforeNormalPick":{
                if(normalizedType!=="shop_purchase") break;
                const beforePick=Math.max(1,Number(params.beforePick||7));
                success=Number(playerState.normalPicksCompleted||0)<beforePick;
                break;
            }
            case "shopPurchaseLeavesBalanceAtMost":{
                if(normalizedType!=="shop_purchase") break;
                const maxBalance=Number(params.maxBalance??1);
                const balance=Number(eventContext?.balanceAfter);
                success=Number.isFinite(balance)&&balance<=maxBalance;
                break;
            }
            case "tradeMarketTransactionCompleted":{
                if(!["trade_completed","market_transaction_completed","trade_market_transaction_completed"].includes(normalizedType)) break;
                success=eventContext?.success!==false;
                break;
            }
            default:
                return {handled:false,success:false};
        }

        if(success){
            quest.progress.meta.matchedEvents=Number(quest.progress.meta.matchedEvents||0)+1;
            quest.progress.current=quest.progress.meta.matchedEvents;
            quest.history.push({
                event:true,
                type:normalizedType,
                normalPick:Number(playerState.normalPicksCompleted||0),
                timestamp:Date.now(),
                data:safeClone(eventContext||{})
            });
        }
        return {handled:true,success};
    }

    function onDraftEvent(eventType,eventContext={}){
        if(!isEnabled()) return {ok:false,reason:"disabled"};
        ensureInitialQuests();
        const p=Number(eventContext.playerIndex);
        const playerState=ensurePlayerState(p);
        if(!playerState) return {ok:false,reason:"invalid_player"};

        let matched=0;
        playerState.quests.forEach(quest=>{
            if(quest.status!=="active"||quest.evaluation!=="event") return;
            const outcome=updateEventProgress(quest,eventType,eventContext,playerState);
            if(outcome.handled&&outcome.success){
                matched++;
                completeQuest(playerState,quest,eventContext);
            }
        });

        if(matched){
            log("external_event_processed",{
                playerIndex:p,
                packNumber:eventContext.packNumber,
                pickIndex:eventContext.pickIndex,
                data:{eventType:String(eventType||""),matched}
            });
        }
        return {ok:true,matched};
    }

    function normalizedMarketEvent(detail={}){
        const marker=normalize([
            detail.type,
            detail.event,
            detail.action,
            detail.status,
            detail.result,
            detail.reason
        ].filter(Boolean).join(" "));
        if(!marker) return null;
        if(/reject|declin|fail|cancel|abort/.test(marker)) return null;
        if(!/complete|completed|success|accepted|signed|deal|trade/.test(marker)) return null;
        return "trade_market_transaction_completed";
    }

    function handleEconomyChange(event){
        const detail=event?.detail||{};
        if(String(detail.type||"")!=="purchase") return;
        const playerIndex=Number(detail.playerIndex);
        if(!Number.isInteger(playerIndex)||playerIndex<0) return;
        let balanceAfter=null;
        try{
            const wallet=global.EconomyEngine?.getWallet?.(playerIndex);
            const balance=Number(wallet?.balance);
            if(Number.isFinite(balance)) balanceAfter=balance;
        }catch(error){}
        onDraftEvent("shop_purchase",{
            playerIndex,
            productId:detail.productId||null,
            price:Number(detail.price||0),
            balanceAfter
        });
    }

    function handleMarketChange(event){
        const detail=event?.detail||{};
        const normalizedEvent=normalizedMarketEvent(detail);
        if(!normalizedEvent) return;

        const participants=[
            detail.playerIndex,
            detail.buyerPlayerIndex,
            detail.sellerPlayerIndex,
            detail.fromPlayerIndex,
            detail.toPlayerIndex,
            detail.ownerPlayerIndex,
            detail.targetPlayerIndex
        ].map(Number).filter((value,index,array)=>Number.isInteger(value)&&value>=0&&array.indexOf(value)===index);

        participants.forEach(playerIndex=>onDraftEvent(normalizedEvent,{
            ...safeClone(detail),
            playerIndex,
            success:true
        }));
    }

    function bindRuntimeEvents(){
        if(runtimeEventsBound||typeof global.addEventListener!=="function") return;
        runtimeEventsBound=true;
        global.addEventListener("snapdraft:economy-change",handleEconomyChange);

        // Market implementations from different patch generations can use
        // slightly different public event names. The quest engine accepts
        // all known/generic variants and also exposes onDraftEvent().
        [
            "snapdraft:trade-market-change",
            "snapdraft:trade-market-event",
            "snapdraft:market-change",
            "snapdraft:galactic-market-change"
        ].forEach(name=>global.addEventListener(name,handleMarketChange));
    }

    function grantReward(playerState,quest,context={}){
        if(quest.rewardGranted) return true;
        const amount=Math.max(0,Number(quest.rewardJC||0));
        if(!amount){quest.rewardGranted=true;return true;}
        const result=global.EconomyEngine?.credit?.(playerState.playerIndex,amount,{
            kind:"bonus",
            reason:"draft_quest_completed",
            packNumber:context.packNumber,
            pickIndex:context.pickIndex,
            data:{questRuntimeId:quest.runtimeId,questCode:quest.code,questTier:quest.tier}
        });
        if(!result?.ok) return false;
        quest.rewardGranted=true;
        playerState.jeffCoinsEarned=Number(playerState.jeffCoinsEarned||0)+amount;
        return true;
    }

    function completeQuest(playerState,quest,context={}){
        if(quest.status!=="active") return false;
        quest.status="completed";
        quest.completedAtNormalPick=playerState.normalPicksCompleted;
        // PATCH100H: ukończenie Próby odblokowuje nagrodę, ale nie wypłaca jej automatycznie.
        // Gracz odbiera JC ręcznie z panelu Kosmicznych Questów.
        quest.rewardGranted=false;
        quest.rewardClaimedAt=null;
        playerState.completed=Number(playerState.completed||0)+1;
        log("completed",{playerIndex:playerState.playerIndex,questRuntimeId:quest.runtimeId,questCode:quest.code,packNumber:context.packNumber,pickIndex:context.pickIndex,data:{rewardJC:quest.rewardJC,text:quest.text,progress:safeClone(quest.progress),claimable:true}});
        return true;
    }

    function claimQuestReward(playerIndex,questRuntimeId,context={}){
        if(!isEnabled()) return {ok:false,reason:"disabled"};
        ensureInitialQuests();
        const playerState=ensurePlayerState(playerIndex);
        if(!playerState) return {ok:false,reason:"invalid_player"};
        const quest=(playerState.quests||[]).find(entry=>entry.runtimeId===questRuntimeId);
        if(!quest) return {ok:false,reason:"quest_not_found"};
        if(quest.status!=="completed") return {ok:false,reason:"quest_not_completed"};
        if(quest.rewardGranted) return {ok:false,reason:"already_claimed",quest:safeClone(quest)};
        const amount=Math.max(0,Number(quest.rewardJC||0));
        if(!grantReward(playerState,quest,context)) return {ok:false,reason:"economy_credit_failed"};
        quest.rewardClaimedAt=Date.now();
        log("reward_claimed",{
            playerIndex:playerState.playerIndex,
            questRuntimeId:quest.runtimeId,
            questCode:quest.code,
            packNumber:context.packNumber,
            pickIndex:context.pickIndex,
            data:{rewardJC:amount,text:quest.text,tier:quest.tier}
        });
        return {ok:true,amount,quest:safeClone(quest),playerState:safeClone(playerState)};
    }

    function failQuest(playerState,quest,context={},reason="window_expired"){
        if(quest.status!=="active") return false;
        quest.status="failed";
        quest.failedAtNormalPick=playerState.normalPicksCompleted;
        playerState.failed=Number(playerState.failed||0)+1;
        log("failed",{playerIndex:playerState.playerIndex,questRuntimeId:quest.runtimeId,questCode:quest.code,packNumber:context.packNumber,pickIndex:context.pickIndex,data:{reason,text:quest.text,progress:safeClone(quest.progress)}});
        return true;
    }

    function evaluateQuestAfterPick(playerState,quest,context){
        if(quest.status!=="active") return;
        const card=pickedCardFromContext(context);
        quest.history.push({
            normalPick:playerState.normalPicksCompleted,
            cardInstanceId:card?.instanceId||null,
            cardName:card?.name||null,
            baseCost:Number.isFinite(Number(card?.cost))?Number(card.cost):null,
            basePower:Number.isFinite(Number(card?.power))?Number(card.power):null,
            tags:Array.isArray(card?.tags)?card.tags.map(String):[]
        });
        const outcome=updateProgress(quest,context,playerState);
        const reachedWindow=playerState.normalPicksCompleted>=Number(quest.endsAtNormalPick||Infinity);

        if(outcome.failEarly){failQuest(playerState,quest,context,"condition_broken");return;}
        if(quest.evaluation==="hit"&&outcome.success){completeQuest(playerState,quest,context);return;}
        if(quest.evaluation==="sequence"){
            if(reachedWindow){
                outcome.success?completeQuest(playerState,quest,context):failQuest(playerState,quest,context,"sequence_missed");
            }
            return;
        }
        if(quest.evaluation==="aggregate"){
            if(outcome.success&&EARLY_RESOLVABLE_AGGREGATES.has(quest.evaluator)){completeQuest(playerState,quest,context);return;}
            if(reachedWindow){outcome.success?completeQuest(playerState,quest,context):failQuest(playerState,quest,context,"aggregate_missed");}
            return;
        }
        if(quest.evaluation==="checkpoint"){
            if(reachedWindow){outcome.success?completeQuest(playerState,quest,context):failQuest(playerState,quest,context,"checkpoint_missed");}
            return;
        }
        if(reachedWindow&&quest.status==="active") failQuest(playerState,quest,context,"window_expired");
    }

    function onNormalPickCompleted(context={}){
        if(!isEnabled()) return {ok:false,reason:"disabled"};
        ensureInitialQuests();
        const p=Number(context.playerIndex);
        const playerState=ensurePlayerState(p);
        if(!playerState) return {ok:false,reason:"invalid_player"};
        playerState.normalPicksCompleted=Math.max(0,Number(playerState.normalPicksCompleted||0))+1;
        playerState.quests.forEach(quest=>evaluateQuestAfterPick(playerState,quest,context));
        log("pick_processed",{playerIndex:p,packNumber:context.packNumber,pickIndex:context.pickIndex,data:{normalPicksCompleted:playerState.normalPicksCompleted,cardName:pickedCardFromContext(context)?.name||null}});
        return {ok:true,playerIndex:p,normalPicksCompleted:playerState.normalPicksCompleted,quests:safeClone(playerState.quests)};
    }

    function rerollQuest(playerIndex,questRuntimeId){
        if(!isEnabled()) return {ok:false,reason:"disabled"};
        ensureInitialQuests();
        const playerState=ensurePlayerState(playerIndex);
        if(!playerState) return {ok:false,reason:"invalid_player"};
        const index=playerState.quests.findIndex(quest=>quest.runtimeId===questRuntimeId&&quest.status==="active");
        if(index<0) return {ok:false,reason:"quest_not_active"};
        const previous=playerState.quests[index];
        const slotIndex=Number.isInteger(Number(previous.slotIndex))?Number(previous.slotIndex):index;
        playerState.rerollsRemainingBySlot=Array.isArray(playerState.rerollsRemainingBySlot)
            ? playerState.rerollsRemainingBySlot
            : Array.from({length:Math.max(3,playerState.quests.length)},()=>1);
        if(Number(playerState.rerollsRemainingBySlot[slotIndex]||0)<=0) return {ok:false,reason:"slot_reroll_used"};
        const used=new Set(playerState.quests.filter((_,i)=>i!==index).map(quest=>quest.code));
        const candidates=shuffle(questDefinitions().filter(def=>
            definitionSupported(def)&&
            activationAllowed(def,"reroll",playerState)&&
            def.tier===previous.tier&&
            !used.has(def.code)&&
            def.code!==previous.code&&
            !modeExcluded(def)
        ));
        let replacement=null;
        for(const def of candidates){replacement=materializeQuest(def,playerState);if(replacement) break;}
        if(!replacement) return {ok:false,reason:"no_legal_replacement"};
        replacement.slotIndex=slotIndex;
        playerState.quests[index]=replacement;
        playerState.rerollsRemainingBySlot[slotIndex]=Math.max(0,Number(playerState.rerollsRemainingBySlot[slotIndex]||0)-1);
        const totalRemaining=playerState.rerollsRemainingBySlot.reduce((sum,value)=>sum+Math.max(0,Number(value)||0),0);
        log("rerolled",{playerIndex:playerState.playerIndex,questRuntimeId:replacement.runtimeId,questCode:replacement.code,data:{previousQuestCode:previous.code,slotIndex,rerollsRemainingBySlot:safeClone(playerState.rerollsRemainingBySlot),totalRemaining}});
        return {ok:true,previous:safeClone(previous),quest:safeClone(replacement),slotIndex,rerollsRemainingBySlot:safeClone(playerState.rerollsRemainingBySlot),totalRemaining};
    }

    function onDraftFinished(){
        if(!isEnabled()) return false;
        state.playerStates.forEach(playerState=>playerState.quests.forEach(quest=>{
            if(quest.status!=="active") return;
            const def=getQuestDefinition(quest);
            if(def?.window==="draftEnd"){
                // Długie questy survival/restriction (np. przyszłe globalne unikanie)
                // przegrywają natychmiast przy złamaniu warunku podczas picków.
                // Jeśli dotrwały aktywne do końca draftu, próba została zaliczona.
                if(quest.evaluation==="sequence"||quest.evaluation==="aggregate"&&def.family==="restriction"||def.family==="restriction"){
                    completeQuest(playerState,quest,{});
                    return;
                }
                const outcome=updateProgress(quest,{resultCard:null},playerState);
                outcome.success?completeQuest(playerState,quest,{}):failQuest(playerState,quest,{},"draft_end_missed");
            }else{
                failQuest(playerState,quest,{},"draft_finished");
            }
        }));
        return true;
    }

    function getPlayerState(playerIndex){
        const playerState=ensurePlayerState(playerIndex);
        return playerState?safeClone(playerState):null;
    }

    function getActiveQuests(playerIndex){return (getPlayerState(playerIndex)?.quests||[]).filter(quest=>quest.status==="active");}

    function getPlayerStates(){
        return safeClone(state.playerStates||[]);
    }

    function getUiState(){
        return {
            enabled:isEnabled(),
            initialized:Boolean(state.initialized),
            players:safeClone(state.playerStates||[]),
            registryVersion:state.registryVersion,
            version:VERSION
        };
    }

    function exportState(){return safeClone(state);}
    function restoreState(payload){
        if(!payload||typeof payload!=="object") return false;
        state={...createEmptyState(),...safeClone(payload)};
        state.players=Array.isArray(state.players)?state.players:[];
        state.playerStates=Array.isArray(state.playerStates)?state.playerStates:[];
        state.playerStates.forEach(playerState=>{
            const slots=slotDefinitions().length;
            if(!Array.isArray(playerState.rerollsRemainingBySlot)){
                playerState.rerollsRemainingBySlot=initialRerollsBySlot().slice(0,slots);
            }
            playerState.quests=(Array.isArray(playerState.quests)?playerState.quests:[]).map((quest,index)=>({slotIndex:Number.isInteger(Number(quest?.slotIndex))?Number(quest.slotIndex):index,...quest}));
        });
        state.eventLog=Array.isArray(state.eventLog)?state.eventLog:[];
        refreshLobbyDependency();
        return true;
    }

    function getReferenceData(){
        return safeClone(global.DraftQuestRegistry||null);
    }

    function getExportData(){
        return {
            enabled:isEnabled(),
            id:EXTENSION_ID,
            name:DISPLAY_NAME,
            version:VERSION,
            registryVersion:state.registryVersion,
            initialized:Boolean(state.initialized),
            players:safeClone(state.playerStates),
            events:safeClone(state.eventLog)
        };
    }

    function refreshLobbyDependency(){
        if(typeof document==="undefined") return;
        const economy=document.getElementById("enableEconomy");
        const quests=document.getElementById("enableDraftQuests");
        const poker=document.getElementById("enablePokerDraft");
        if(!quests) return;
        const option=quests.closest?.(".modeOption");
        const blocked=Boolean(poker?.checked||!economy?.checked);
        quests.disabled=blocked;
        if(blocked&&quests.checked) quests.checked=false;
        option?.classList.toggle("quests-requires-economy",blocked);
        option?.classList.toggle("quests-active",Boolean(quests.checked&&!blocked));
    }

    function bindLobbyCompatibility(){
        if(typeof document==="undefined") return;
        const economy=document.getElementById("enableEconomy");
        const quests=document.getElementById("enableDraftQuests");
        const poker=document.getElementById("enablePokerDraft");
        if(!quests) return;
        quests.addEventListener("change",refreshLobbyDependency);
        economy?.addEventListener("change",()=>{
            if(!economy.checked&&quests.checked) quests.checked=false;
            refreshLobbyDependency();
        });
        poker?.addEventListener("change",refreshLobbyDependency);
        refreshLobbyDependency();
    }

    global.DraftQuestEngine=Object.freeze({
        VERSION,EXTENSION_ID,DISPLAY_NAME,
        beginDraft,reset,isEnabled,ensureInitialQuests,onNormalPickCompleted,onDraftFinished,onDraftEvent,
        rerollQuest,claimQuestReward,getPlayerState,getActiveQuests,getPlayerStates,getUiState,capturePackSnapshot,getReferenceData,
        getSupportedEvaluatorNames:()=>[...SUPPORTED_EVALUATORS],
        exportState,restoreState,getExportData,refreshLobbyDependency,
        _setRngForTests(fn){runtimeRng=typeof fn==="function"?fn:Math.random;}
    });

    bindRuntimeEvents();

    if(typeof document!=="undefined"){
        const boot=()=>bindLobbyCompatibility();
        if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot,{once:true});
        else boot();
    }
})(typeof window!=="undefined"?window:globalThis);
