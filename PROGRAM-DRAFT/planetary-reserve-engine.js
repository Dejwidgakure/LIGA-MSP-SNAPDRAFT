(function(root,factory){
    const api=factory();
    if(typeof module==="object"&&module.exports) module.exports=api;
    if(root) root.PlanetaryReserveEngine=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
    "use strict";

    const SIDEBOARD_SIZE=3;
    const CANDIDATE_POOL_SIZE=12;

    const normalize=value=>String(value??"").trim();
    const key=value=>normalize(value).toLocaleLowerCase("pl");
    const tagsOf=card=>Array.isArray(card?.tags)?card.tags.map(normalize).filter(Boolean):[];

    function buildTagIndex(tagDefinitions){
        const categoryById={};
        const labelById={};
        Object.entries(tagDefinitions||{}).forEach(([category,items])=>{
            (Array.isArray(items)?items:[]).forEach(item=>{
                const id=normalize(item?.id);
                if(!id) return;
                categoryById[id]=category;
                labelById[id]=normalize(item?.name)||id;
            });
        });
        return {categoryById,labelById};
    }

    function getMainDeckCards(player){
        if(Array.isArray(player)) return player.slice();
        return Array.isArray(player?.deck)?player.deck.slice():[];
    }

    function getSideboardCards(player){
        return Array.isArray(player?.sideboard)?player.sideboard.slice():[];
    }

    function getAllDraftedCards(player){
        return [...getMainDeckCards(player),...getSideboardCards(player)];
    }

    function normalizedRules(config){
        const special=config?.specialSettings||config||{};
        const pool=special.poolRules||config?.poolRules||{};
        const series=pool.seriesFilters||{};
        const tagFilters=pool.tagFilters||{};
        return {
            allowedSeries:new Set((series.allowed||series.include||[]).map(normalize).filter(Boolean)),
            excludedSeries:new Set((series.excluded||series.exclude||[]).map(normalize).filter(Boolean)),
            includedTags:new Set((tagFilters.included||tagFilters.include||[]).map(normalize).filter(Boolean)),
            excludedTags:new Set((tagFilters.excluded||tagFilters.exclude||[]).map(normalize).filter(Boolean)),
            seriesEnabled:Boolean(series.enabled),
            tagsEnabled:Boolean(tagFilters.enabled)
        };
    }

    function isLegalCard(card,context){
        if(!card||typeof card!=="object"||card.joker) return false;
        const name=normalize(card.name);
        if(!name||!Number.isFinite(Number(card.cost))||!Number.isFinite(Number(card.power))) return false;
        const type=key(card.type);
        if(type==="power"||type==="superpower"||type==="joker") return false;
        if(context.deckNames.has(key(name))||context.bans.has(key(name))) return false;
        const cardTags=new Set(tagsOf(card));
        const rules=context.rules;
        if(rules.seriesEnabled){
            const seriesTags=[...cardTags].filter(tag=>context.tagIndex.categoryById[tag]==="series");
            if(rules.allowedSeries.size&&!seriesTags.some(tag=>rules.allowedSeries.has(tag))) return false;
            if(seriesTags.some(tag=>rules.excludedSeries.has(tag))) return false;
        }
        if(rules.tagsEnabled){
            if([...cardTags].some(tag=>rules.excludedTags.has(tag))) return false;
            if(rules.includedTags.size&&![...rules.includedTags].every(tag=>cardTags.has(tag))) return false;
        }
        return true;
    }

    function categoryCounts(deck,tagIndex){
        const counts={};
        deck.forEach(card=>tagsOf(card).forEach(tag=>{
            const category=tagIndex.categoryById[tag];
            if(!category) return;
            if(!counts[category]) counts[category]={};
            counts[category][tag]=(counts[category][tag]||0)+1;
        }));
        return counts;
    }

    function orderedTags(counts,category){
        return Object.entries(counts[category]||{}).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],"pl"));
    }

    function missingCurveCost(deck){
        const counts={1:0,2:0,3:0,4:0,5:0,6:0};
        deck.forEach(card=>{
            const cost=Math.max(1,Math.min(6,Number(card?.cost)||0));
            if(counts[cost]!==undefined) counts[cost]++;
        });
        return Number(Object.entries(counts).sort((a,b)=>a[1]-b[1]||Number(a[0])-Number(b[0]))[0]?.[0]||3);
    }

    function makeRng(random){return typeof random==="function"?random:Math.random;}

    function buildCandidatePool(options={}){
        const deck=getMainDeckCards(options.deck||options.player);
        const cards=Array.isArray(options.cards)?options.cards:[];
        const tagIndex=buildTagIndex(options.tags||{});
        const context={
            deckNames:new Set(deck.map(card=>key(card?.name??card))),
            bans:new Set((options.bannedCards||[]).map(value=>key(value?.name??value))),
            rules:normalizedRules(options.config||{}),
            tagIndex
        };
        const unique=new Map();
        cards.forEach(card=>{
            if(isLegalCard(card,context)&&!unique.has(key(card.name))) unique.set(key(card.name),card);
        });
        const legal=[...unique.values()];
        const counts=categoryCounts(deck,tagIndex);
        const curveCost=missingCurveCost(deck);
        const techCount=deck.filter(card=>tagsOf(card).includes("tech")).length;
        const random=makeRng(options.random);
        const selected=[];
        const used=new Set();
        const suggestionCounts=options.suggestionCounts instanceof Map
            ? options.suggestionCounts
            : new Map(Object.entries(options.suggestionCounts||{}).map(([name,count])=>[key(name),Number(count)||0]));
        const tagLabel=id=>normalize(tagIndex.labelById?.[id])||normalize(id);

        function dominantTag(category){
            const rows=orderedTags(counts,category);
            if(!rows.length) return null;
            const max=Number(rows[0]?.[1]||0);
            const tied=rows.filter(row=>Number(row[1])===max);
            return tied[Math.min(tied.length-1,Math.floor(random()*tied.length))]?.[0]||rows[0][0];
        }

        function weightedRandom(pool){
            if(!pool.length) return null;
            const weighted=pool.map(card=>{
                const repeated=Math.max(0,Number(suggestionCounts.get(key(card.name))||0));
                return {card,weight:1/(1+repeated*1.5)};
            });
            const total=weighted.reduce((sum,row)=>sum+row.weight,0);
            let roll=random()*Math.max(total,.0001);
            for(const row of weighted){
                roll-=row.weight;
                if(roll<=0) return row.card;
            }
            return weighted[weighted.length-1].card;
        }

        function uniformRandom(pool){
            if(!pool.length) return null;
            return pool[Math.min(pool.length-1,Math.floor(random()*pool.length))]||pool[0];
        }

        function choose(reasonCode,reasonLabel,predicate,mode="weighted"){
            const pool=legal.filter(card=>!used.has(key(card.name))&&(!predicate||predicate(card)));
            const winner=mode==="uniform"?uniformRandom(pool):weightedRandom(pool);
            if(!winner) return false;
            used.add(key(winner.name));
            selected.push({card:winner,reasonCode,reason:reasonLabel,score:0,slot:selected.length+1});
            return true;
        }

        const mechanicFamily=dominantTag("mechanicFamilies");
        const detailedMechanic=dominantTag("subtypes");
        const deckArchetype=dominantTag("deckArchetypes");

        // Final Reserve V2 tag contract:
        // 1x dominant Mechanic Family, 1x dominant detailed mechanic,
        // 1x dominant Deck Archetype/Package, 1x TECH, 1x missing Cost,
        // 1x fully random cheap (Cost 1-2), remaining slots fully random.
        // Flavor-only categories (teams/themes) never drive Reserve synergy slots.
        const desiredTechCandidates=1;
        const availableTech=legal.filter(card=>tagsOf(card).includes("tech")).length;
        choose("tech_answer","UZUPEŁNIENIE: TECH",card=>tagsOf(card).includes("tech"));

        if(mechanicFamily){
            choose("mechanic_family",`RODZINA MECHANIK: ${tagLabel(mechanicFamily)}`,card=>tagsOf(card).includes(mechanicFamily));
        }
        if(detailedMechanic){
            choose("detailed_mechanic",`MECHANIKA SZCZEGÓŁOWA: ${tagLabel(detailedMechanic)}`,card=>tagsOf(card).includes(detailedMechanic));
        }
        if(deckArchetype){
            choose("deck_archetype",`ARCHETYP / PACZKA: ${tagLabel(deckArchetype)}`,card=>tagsOf(card).includes(deckArchetype));
        }
        choose("missing_curve",`BRAKUJĄCY COST: ${curveCost}`,card=>Number(card.cost)===curveCost);
        choose("cheap_random","TANIA OPCJA • COST 1–2",card=>Number(card.cost)===1||Number(card.cost)===2,"uniform");
        while(selected.length<CANDIDATE_POOL_SIZE&&choose("random_option","LOSOWA REZERWA",null,"uniform")){}

        const offeredTech=selected.filter(item=>item.reasonCode==="tech_answer").length;
        const possibleTech=Math.min(desiredTechCandidates,availableTech);
        return {
            candidates:selected.slice(0,CANDIDATE_POOL_SIZE),
            legalCount:legal.length,
            exact:selected.length===CANDIDATE_POOL_SIZE,
            techRule:{
                mainDeckTechCount:techCount,
                reserved:true,
                desired:desiredTechCandidates,
                available:availableTech,
                offered:offeredTech,
                fulfilled:offeredTech>=possibleTech,
                fullyCovered:availableTech===0||offeredTech>=desiredTechCandidates
            },
            curveCost
        };
    }

    return Object.freeze({
        SIDEBOARD_SIZE,
        CANDIDATE_POOL_SIZE,
        buildTagIndex,
        buildCandidatePool,
        getMainDeckCards,
        getSideboardCards,
        getAllDraftedCards
    });
});
