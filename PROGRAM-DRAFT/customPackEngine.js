/* ============================================================
   MSP SNAP DRAFT — CUSTOM PACK ENGINE
   Version 1.20

   LEGACY SUPPORT:
   - tags[] (OR)
   - minCost / maxCost
   - minPower / maxPower
   - nameIncludes
   - fillMode: random / half / duplicate

   ADVANCED FILTERS:
   - filter.cost.min/max/exact
   - filter.power.min/max/exact
   - filter.tags.allOf/anyOf/noneOf
   - filter.relations
   - filter.tagCounts
       • { category:"deckArchetypes", min:3 }
       • lub jawne { tags:[...], min:2 }

   ENVIRONMENT COMPOSITION:
   - composition.mode = "cycle"
   - composition.mode = "tag-rainbow"

   Paczki kompozycyjne tworzą cały skład środowiska draftowego,
   więc celowo nie stosują legacy fillMode "half".
============================================================ */

function shuffleArray(arr){
    const copy=[...(Array.isArray(arr) ? arr : [])];
    for(let i=copy.length-1;i>0;i--){
        const j=Math.floor(Math.random()*(i+1));
        [copy[i],copy[j]]=[copy[j],copy[i]];
    }
    return copy;
}

function normalizeCustomPackName(value){
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g,"")
        .toLowerCase()
        .trim();
}

function normalizeCustomPackTag(value){
    return String(value || "").trim().toLowerCase();
}

function getCustomPackCategoryTagIds(category){
    try{
        if(typeof TAGS!=="object" || !TAGS) return [];
        const list=TAGS?.[category];
        if(!Array.isArray(list)) return [];
        return list
            .map(item=>normalizeCustomPackTag(item?.id))
            .filter(Boolean);
    }catch(error){
        return [];
    }
}

function getCustomPackUnavailableNames(){
    return new Set(
        (Array.isArray(bannedCards) ? bannedCards : [])
            .map(normalizeCustomPackName)
            .filter(Boolean)
    );
}

function isCustomPackCardAvailable(card, unavailableNames=getCustomPackUnavailableNames()){
    return !!(
        card &&
        !card.joker &&
        card.name &&
        !unavailableNames.has(normalizeCustomPackName(card.name))
    );
}

function getCustomPackCardCost(card){
    const value=Number(card?.cost);
    return Number.isFinite(value) ? value : null;
}

function getCustomPackCardPower(card){
    const value=Number(card?.power);
    return Number.isFinite(value) ? value : null;
}

function customPackCardHasTag(card,tag){
    const wanted=normalizeCustomPackTag(tag);
    return !!wanted && Array.isArray(card?.tags) &&
        card.tags.some(value=>normalizeCustomPackTag(value)===wanted);
}

function normalizeCustomPackStatRule(rule){
    if(rule===null || rule===undefined) return null;

    if(typeof rule==="number"){
        return {min:Number(rule),max:Number(rule)};
    }

    if(typeof rule!=="object") return null;

    const exact=Number(rule.exact);
    const min=Number(rule.min);
    const max=Number(rule.max);

    const normalized={
        min:Number.isFinite(exact) ? exact : (Number.isFinite(min) ? min : null),
        max:Number.isFinite(exact) ? exact : (Number.isFinite(max) ? max : null)
    };

    if(normalized.min===null && normalized.max===null) return null;
    return normalized;
}

function customPackPassesStat(value,rule){
    const normalized=normalizeCustomPackStatRule(rule);
    if(!normalized || !Number.isFinite(value)) return false;

    if(normalized.min!==null && value<normalized.min) return false;
    if(normalized.max!==null && value>normalized.max) return false;
    return true;
}

function normalizeCustomPackRelation(relation){
    if(!relation || typeof relation!=="object") return null;

    const fields=new Set(["cost","power"]);
    const aliases={"==":"=","===":"=","=>":">=","=<":"<="};
    const left=String(relation.left||"").toLowerCase();
    const right=String(relation.right||"").toLowerCase();
    const rawOperator=String(relation.operator||"=").trim();
    const operator=aliases[rawOperator]||rawOperator;
    const allowed=new Set([">",">=","<","<=","="]);

    if(!fields.has(left) || !fields.has(right) || !allowed.has(operator)){
        return null;
    }

    const offset=Number(relation.offset??0);
    const multiplier=Number(relation.rightMultiplier??1);

    return {
        left,
        right,
        operator,
        offset:Number.isFinite(offset) ? offset : 0,
        rightMultiplier:Number.isFinite(multiplier) ? multiplier : 1
    };
}

function customPackPassesRelation(card,relation){
    const normalized=normalizeCustomPackRelation(relation);
    if(!normalized) return false;

    const left=normalized.left==="cost"
        ? getCustomPackCardCost(card)
        : getCustomPackCardPower(card);

    const rightRaw=normalized.right==="cost"
        ? getCustomPackCardCost(card)
        : getCustomPackCardPower(card);

    if(!Number.isFinite(left) || !Number.isFinite(rightRaw)) return false;

    const right=(rightRaw*normalized.rightMultiplier)+normalized.offset;

    if(normalized.operator===">") return left>right;
    if(normalized.operator===">=") return left>=right;
    if(normalized.operator==="<") return left<right;
    if(normalized.operator==="<=") return left<=right;
    return left===right;
}

function normalizeCustomPackTagCount(rule){
    if(!rule || typeof rule!=="object") return null;

    let tags=[];
    if(Array.isArray(rule.tags)){
        tags=rule.tags;
    }else if(rule.category){
        tags=getCustomPackCategoryTagIds(rule.category);
    }

    tags=[...new Set(
        tags.map(normalizeCustomPackTag).filter(Boolean)
    )];

    if(!tags.length) return null;

    const exact=Number(rule.exact);
    const min=Number(rule.min);
    const max=Number(rule.max);

    return {
        tags,
        min:Number.isFinite(exact) ? exact : (Number.isFinite(min) ? min : null),
        max:Number.isFinite(exact) ? exact : (Number.isFinite(max) ? max : null)
    };
}

function customPackPassesTagCount(card,rule){
    const normalized=normalizeCustomPackTagCount(rule);
    if(!normalized) return false;

    const count=normalized.tags.reduce(
        (sum,tag)=>sum+(customPackCardHasTag(card,tag)?1:0),
        0
    );

    if(normalized.min!==null && count<normalized.min) return false;
    if(normalized.max!==null && count>normalized.max) return false;
    return true;
}

function getLegacyCustomPackFilter(packConfig){
    const filter={};

    if(Array.isArray(packConfig?.tags) && packConfig.tags.length){
        filter.tags={anyOf:[...packConfig.tags]};
    }

    if(packConfig?.minCost!=null || packConfig?.maxCost!=null){
        filter.cost={};
        if(packConfig.minCost!=null) filter.cost.min=packConfig.minCost;
        if(packConfig.maxCost!=null) filter.cost.max=packConfig.maxCost;
    }

    if(packConfig?.minPower!=null || packConfig?.maxPower!=null){
        filter.power={};
        if(packConfig.minPower!=null) filter.power.min=packConfig.minPower;
        if(packConfig.maxPower!=null) filter.power.max=packConfig.maxPower;
    }

    if(packConfig?.nameIncludes){
        filter.nameIncludes=String(packConfig.nameIncludes);
    }

    return filter;
}

function mergeCustomPackFilters(base,extra){
    const result={
        ...(base && typeof base==="object" ? base : {}),
        ...(extra && typeof extra==="object" ? extra : {})
    };

    if(base?.tags || extra?.tags){
        result.tags={
            ...(base?.tags||{}),
            ...(extra?.tags||{})
        };
    }

    if(base?.cost || extra?.cost){
        result.cost={
            ...(base?.cost||{}),
            ...(extra?.cost||{})
        };
    }

    if(base?.power || extra?.power){
        result.power={
            ...(base?.power||{}),
            ...(extra?.power||{})
        };
    }

    const baseRelations=Array.isArray(base?.relations) ? base.relations : [];
    const extraRelations=Array.isArray(extra?.relations) ? extra.relations : [];
    if(baseRelations.length || extraRelations.length){
        result.relations=[...baseRelations,...extraRelations];
    }

    const baseCounts=Array.isArray(base?.tagCounts) ? base.tagCounts : [];
    const extraCounts=Array.isArray(extra?.tagCounts) ? extra.tagCounts : [];
    if(baseCounts.length || extraCounts.length){
        result.tagCounts=[...baseCounts,...extraCounts];
    }

    return result;
}

function getCustomPackFilter(packConfig,extraFilter=null){
    const legacy=getLegacyCustomPackFilter(packConfig||{});
    const advanced=packConfig?.filter && typeof packConfig.filter==="object"
        ? packConfig.filter
        : {};
    return mergeCustomPackFilters(
        mergeCustomPackFilters(legacy,advanced),
        extraFilter||{}
    );
}

function cardPassesCustomPackFilter(card,filter){
    if(!filter || typeof filter!=="object") return true;

    const cost=getCustomPackCardCost(card);
    const power=getCustomPackCardPower(card);

    if(filter.cost && !customPackPassesStat(cost,filter.cost)) return false;
    if(filter.power && !customPackPassesStat(power,filter.power)) return false;

    const tags=filter.tags||{};
    const allOf=Array.isArray(tags.allOf) ? tags.allOf : [];
    const anyOf=Array.isArray(tags.anyOf) ? tags.anyOf : [];
    const noneOf=Array.isArray(tags.noneOf) ? tags.noneOf : [];

    if(allOf.length && !allOf.every(tag=>customPackCardHasTag(card,tag))) return false;
    if(anyOf.length && !anyOf.some(tag=>customPackCardHasTag(card,tag))) return false;
    if(noneOf.length && noneOf.some(tag=>customPackCardHasTag(card,tag))) return false;

    const relations=Array.isArray(filter.relations) ? filter.relations : [];
    if(relations.length && !relations.every(rel=>customPackPassesRelation(card,rel))){
        return false;
    }

    const tagCounts=Array.isArray(filter.tagCounts) ? filter.tagCounts : [];
    if(tagCounts.length && !tagCounts.every(rule=>customPackPassesTagCount(card,rule))){
        return false;
    }

    const needle=String(filter.nameIncludes||"").trim().toLowerCase();
    if(needle && !String(card?.name||"").toLowerCase().includes(needle)){
        return false;
    }

    return true;
}

function getCustomPackPool(packConfig,extraFilter=null){
    const unavailable=getCustomPackUnavailableNames();
    const filter=getCustomPackFilter(packConfig,extraFilter);

    return (Array.isArray(cardDatabase) ? cardDatabase : []).filter(card=>
        isCustomPackCardAvailable(card,unavailable) &&
        cardPassesCustomPackFilter(card,filter)
    );
}

function getCustomPackCompositionBuckets(packConfig){
    const composition=packConfig?.composition;
    if(!composition || typeof composition!=="object") return [];

    if(composition.mode==="cycle"){
        return (Array.isArray(composition.buckets) ? composition.buckets : [])
            .map((bucket,index)=>({
                id:String(bucket?.id||`bucket_${index}`),
                label:String(bucket?.label||`BUCKET ${index+1}`),
                filter:bucket?.filter||{}
            }));
    }

    if(composition.mode==="tag-rainbow"){
        const category=String(composition.category||"");
        return getCustomPackCategoryTagIds(category).map(tag=>({
            id:tag,
            label:tag,
            filter:{tags:{allOf:[tag]}}
        }));
    }

    return [];
}

function generateComposedCustomPack(packConfig,packSize){
    const requested=Math.max(0,Number(packSize)||0);
    if(!requested) return [];

    const composition=packConfig?.composition||{};
    let buckets=getCustomPackCompositionBuckets(packConfig);

    // Remove empty buckets up-front. This makes Quick Draw future-proof:
    // while its pool is empty it is skipped; after cards are added it
    // automatically joins Ability Rainbow without another engine patch.
    buckets=buckets
        .map(bucket=>({
            ...bucket,
            pool:shuffleArray(getCustomPackPool(packConfig,bucket.filter))
        }))
        .filter(bucket=>bucket.pool.length>0);

    if(!buckets.length){
        return [];
    }

    if(composition.shuffleBuckets){
        buckets=shuffleArray(buckets);
    }

    const usedNames=new Set();
    const result=[];

    function takeFromBucket(bucket){
        if(!bucket) return null;

        for(const card of bucket.pool){
            const key=normalizeCustomPackName(card?.name);
            if(!key || usedNames.has(key)) continue;
            usedNames.add(key);
            return card;
        }
        return null;
    }

    for(let slot=0;slot<requested;slot++){
        const preferredIndex=slot%buckets.length;
        let picked=takeFromBucket(buckets[preferredIndex]);

        // If a narrow bucket is exhausted, search neighbouring buckets
        // before abandoning the composition.
        if(!picked){
            for(let offset=1;offset<buckets.length;offset++){
                const candidate=buckets[(preferredIndex+offset)%buckets.length];
                picked=takeFromBucket(candidate);
                if(picked) break;
            }
        }

        if(picked){
            result.push(picked);
        }
    }

    // Safe fallback only if the composition cannot physically provide
    // enough unique cards. Normal healthy packs should never reach this.
    if(result.length<requested){
        const fallback=shuffleArray(getCustomPackPool(packConfig))
            .filter(card=>!usedNames.has(normalizeCustomPackName(card?.name)));

        for(const card of fallback){
            if(result.length>=requested) break;
            const key=normalizeCustomPackName(card?.name);
            if(!key || usedNames.has(key)) continue;
            usedNames.add(key);
            result.push(card);
        }
    }

    return result.slice(0,requested);
}

function generateFilteredCustomPack(packConfig,packSize,fillMode="random"){
    const requested=Math.max(0,Number(packSize)||0);
    if(!requested) return [];

    const pool=shuffleArray(getCustomPackPool(packConfig));
    let pack=[];

    if(fillMode==="half"){
        const halfSize=Math.floor(requested/2);
        pack=pool.slice(0,halfSize);

        const usedNames=new Set(pack.map(card=>normalizeCustomPackName(card?.name)));
        const unavailable=getCustomPackUnavailableNames();

        const remainingPool=shuffleArray(
            (Array.isArray(cardDatabase) ? cardDatabase : []).filter(card=>
                isCustomPackCardAvailable(card,unavailable) &&
                !usedNames.has(normalizeCustomPackName(card?.name))
            )
        );

        pack=pack.concat(remainingPool.slice(0,requested-pack.length));
        return pack.slice(0,requested);
    }

    pack=pool.slice(0,requested);

    if(pack.length>=requested){
        return pack;
    }

    const missing=requested-pack.length;

    if(fillMode==="duplicate"){
        if(pool.length){
            for(let i=0;i<missing;i++){
                pack.push(pool[Math.floor(Math.random()*pool.length)]);
            }
        }
        return pack.slice(0,requested);
    }

    const usedNames=new Set(pack.map(card=>normalizeCustomPackName(card?.name)));
    const unavailable=getCustomPackUnavailableNames();

    const remainingPool=shuffleArray(
        (Array.isArray(cardDatabase) ? cardDatabase : []).filter(card=>
            isCustomPackCardAvailable(card,unavailable) &&
            !usedNames.has(normalizeCustomPackName(card?.name))
        )
    );

    pack=pack.concat(remainingPool.slice(0,missing));
    return pack.slice(0,requested);
}

function generateCustomPack(packConfig,packSize,fillMode="random"){
    if(packConfig?.composition){
        return generateComposedCustomPack(packConfig,packSize);
    }

    return generateFilteredCustomPack(packConfig,packSize,fillMode);
}
