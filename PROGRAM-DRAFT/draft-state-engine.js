(function(global){
    "use strict";

    const VERSION = "0.4.1";
    const PACK_STATUSES = ["closed", "prepared", "open", "completed"];
    const GRAVEYARD_CATEGORIES = [
        "unpicked",
        "rerolled",
        "destroyedByPower",
        "replaced",
        "jokerRejected",
        "portal",
        "limbo",
        "devoured",
        "sacrificed",
        "transformedEcho",
        "digested",
        "temporaryRemoved",
        "riverEscaped",
        "riverFaded",
        "riverEndRemainder"
    ];

    let sequence = 0;
    let cardInstanceSequence = 0;
    let effectSequence = 0;
    let graveyardEntrySequence = 0;
    let transactionSequence = 0;
    let state = createEmptyState();

    function createEmptyState(){
        return {
            version: VERSION,
            initialized: false,
            config: {
                snapshotsEnabled: false
            },
            packs: [],
            activePackIndex: -1,
            eventLog: [],
            snapshots: [],
            transactions: [],
            graveyard: Object.fromEntries(
                GRAVEYARD_CATEGORIES.map(category => [category, []])
            )
        };
    }

    function safeClone(value){
        if(value === undefined) return undefined;
        if(typeof structuredClone === "function"){
            try{ return structuredClone(value); }catch(error){}
        }
        return JSON.parse(JSON.stringify(value));
    }

    function slugify(value){
        const slug = String(value || "card")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
        return slug || "card";
    }

    function normalizeCard(card){
        if(!card) return null;
        return {
            instanceId: card.instanceId || null,
            cardId: card.cardId || card.id || slugify(card.name),
            name: String(card.name || ""),
            cost: Number(card.cost ?? 0),
            power: Number(card.power ?? 0),
            joker: Boolean(card.joker),
            type: card.type || null,
            id: card.id ?? null
        };
    }

    function createCardInstance(card, metadata={}){
        if(!card || typeof card !== "object") return card;

        const forceNew = metadata.forceNew !== false;
        const clone = safeClone(card);
        const existingInstanceId = String(card.instanceId || "").trim();
        const originPackId = metadata.packId || clone.instanceMeta?.packId || null;
        const origin = metadata.origin || clone.instanceMeta?.origin || "draft";

        if(!forceNew && existingInstanceId){
            clone.instanceId = existingInstanceId;
        }else{
            cardInstanceSequence += 1;
            const prefix = originPackId || origin || "draft";
            clone.instanceId = `${slugify(prefix)}-card-${cardInstanceSequence}`;
        }

        clone.cardId = clone.cardId || clone.id || slugify(clone.name);
        clone.instanceMeta = {
            ...(clone.instanceMeta && typeof clone.instanceMeta === "object"
                ? clone.instanceMeta
                : {}),
            origin,
            packId: originPackId,
            createdAt: Number(metadata.createdAt || Date.now()),
            sourcePowerId: metadata.sourcePowerId || null,
            sourceEvent: metadata.sourceEvent || null
        };
        return clone;
    }

    function ensureCardInstance(card, metadata={}){
        if(!card || typeof card !== "object") return card;
        if(card.instanceId) return card;
        return createCardInstance(card, {...metadata, forceNew:true});
    }

    function log(type,payload={}){
        const event = {
            sequence: ++sequence,
            type: String(type || "unknown"),
            packNumber: Number(payload.packNumber ?? state.activePackIndex + 1) || null,
            packId: payload.packId || getPack(state.activePackIndex)?.packId || null,
            pickIndex: Number.isFinite(Number(payload.pickIndex))
                ? Number(payload.pickIndex)
                : null,
            playerIndex: Number.isInteger(payload.playerIndex)
                ? payload.playerIndex
                : null,
            player: payload.player ?? null,
            sourceCard: normalizeCard(payload.sourceCard),
            resultCard: normalizeCard(payload.resultCard),
            reason: payload.reason || null,
            timestamp: Date.now(),
            data: safeClone(payload.data || {})
        };
        state.eventLog.push(event);
        return event;
    }

    function reset(){
        sequence = 0;
        cardInstanceSequence = 0;
        effectSequence = 0;
        graveyardEntrySequence = 0;
        transactionSequence = 0;
        state = createEmptyState();
        return state;
    }

    function init(config={}){
        reset();
        state.initialized = true;
        state.config = {
            snapshotsEnabled: false,
            ...safeClone(config)
        };
        log("draft_initialized",{
            packNumber:null,
            packId:null,
            data:state.config
        });
        return state;
    }

    function setPackPlan(packs=[]){
        state.packs = (Array.isArray(packs) ? packs : []).map((pack,index)=>{
            const packId = String(pack.packId || `pack-${index + 1}`);
            const cards = (Array.isArray(pack.cards) ? pack.cards : []).map(card=>
                createCardInstance(card,{
                    forceNew:true,
                    origin:"pack_generation",
                    packId
                })
            );
            const metadata = {
                ...(pack.metadata && typeof pack.metadata === "object"
                    ? safeClone(pack.metadata)
                    : {}),
                customPackId: pack.customPackId || null,
                customDefinition: pack.customDefinition
                    ? safeClone(pack.customDefinition)
                    : null
            };

            return {
                packId,
                index,
                number:index + 1,
                name:pack.name || "STANDARD PACK",
                type:pack.type || "cosmic",
                status:PACK_STATUSES.includes(pack.status)
                    ? pack.status
                    : "prepared",
                originalCards:safeClone(cards),
                cards,
                effects:Array.isArray(pack.effects)
                    ? safeClone(pack.effects)
                    : [],
                metadata,

                // Pola kompatybilności z PATCH 35 i istniejącym kodem.
                customPackId:metadata.customPackId,
                customDefinition:metadata.customDefinition,
                remaindersArchived:Boolean(pack.remaindersArchived),
                openedAtEventId:null,
                completedAtEventId:null
            };
        });
        log("pack_plan_generated",{
            packNumber:null,
            packId:null,
            data:{
                count:state.packs.length,
                packs:state.packs.map(pack=>({
                    packId:pack.packId,
                    number:pack.number,
                    name:pack.name,
                    type:pack.type,
                    status:pack.status,
                    cardCount:pack.cards.length
                }))
            }
        });
        return state.packs;
    }

    function getPack(index){
        if(typeof index !== "number" || !Number.isInteger(index)) return null;
        return state.packs[index] || null;
    }

    function getPackById(packId){
        const normalized = String(packId || "");
        return state.packs.find(pack=>pack.packId === normalized) || null;
    }

    function resolvePackReference(packRef){
        if(typeof packRef === "string") return getPackById(packRef);
        if(typeof packRef === "number" && Number.isInteger(packRef)){
            return getPack(packRef);
        }
        if(packRef && typeof packRef === "object" && packRef.packId){
            return getPackById(packRef.packId);
        }
        return null;
    }

    function activatePack(index){
        const pack = getPack(index);
        if(!pack) return null;
        state.activePackIndex = Number(index);
        pack.status = "open";
        const event = log("pack_activated",{
            packNumber:pack.number,
            packId:pack.packId,
            data:{
                name:pack.name,
                type:pack.type,
                status:pack.status,
                cardCount:pack.cards.length
            }
        });
        pack.openedAtEventId = event.sequence;
        return pack;
    }

    function updatePack(packRef,patch={}){
        const pack = resolvePackReference(packRef);
        if(!pack || !patch || typeof patch !== "object") return null;

        if(patch.name != null) pack.name = String(patch.name);
        if(patch.type != null) pack.type = String(patch.type);
        if(PACK_STATUSES.includes(patch.status)) pack.status = patch.status;
        if(patch.remaindersArchived != null){
            pack.remaindersArchived = Boolean(patch.remaindersArchived);
        }
        if(patch.metadata && typeof patch.metadata === "object"){
            pack.metadata = {
                ...(pack.metadata || {}),
                ...safeClone(patch.metadata)
            };
            pack.customPackId = pack.metadata.customPackId || null;
            pack.customDefinition = pack.metadata.customDefinition || null;
        }
        return pack;
    }

    function completePack(packRef,metadata={}){
        const pack = resolvePackReference(packRef);
        if(!pack) return null;
        if(pack.status === "completed" && pack.completedAtEventId) return pack;

        pack.status = "completed";
        const event = log("pack_completed",{
            packNumber:pack.number,
            packId:pack.packId,
            pickIndex:metadata.pickIndex ?? null,
            reason:metadata.reason || "pack_end",
            data:{
                unpickedCount:Number(metadata.unpickedCount ?? pack.cards.length),
                ...safeClone(metadata.data || {})
            }
        });
        pack.completedAtEventId = event.sequence;
        return pack;
    }

    function normalizeEffect(pack,effect={}){
        effectSequence += 1;
        return {
            effectId:String(effect.effectId || `${pack.packId}-effect-${effectSequence}`),
            type:String(effect.type || "unknown"),
            status:String(effect.status || "active"),
            sourcePowerId:effect.sourcePowerId || null,
            sourcePlayerIndex:Number.isInteger(effect.sourcePlayerIndex)
                ? effect.sourcePlayerIndex
                : null,
            targetPackId:effect.targetPackId || pack.packId,
            targetCardInstanceId:effect.targetCardInstanceId || null,
            targetPosition:Number.isInteger(effect.targetPosition)
                ? effect.targetPosition
                : null,
            createdAtEventId:effect.createdAtEventId || null,
            resolvedAtEventId:effect.resolvedAtEventId || null,
            expiresAtEventId:effect.expiresAtEventId || null,
            data:safeClone(effect.data || {})
        };
    }

    function addPackEffect(packRef,effect={}){
        const pack = resolvePackReference(packRef);
        if(!pack) return null;
        const record = normalizeEffect(pack,effect);
        pack.effects.push(record);
        const event = log("pack_effect_added",{
            packNumber:pack.number,
            packId:pack.packId,
            playerIndex:record.sourcePlayerIndex,
            reason:record.type,
            data:{effect:safeClone(record)}
        });
        record.createdAtEventId = event.sequence;
        return record;
    }

    function updatePackEffect(packRef,effectId,patch={}){
        const pack = resolvePackReference(packRef);
        if(!pack) return null;
        const effect = pack.effects.find(entry=>entry.effectId === String(effectId));
        if(!effect) return null;
        Object.assign(effect,safeClone(patch));
        log("pack_effect_updated",{
            packNumber:pack.number,
            packId:pack.packId,
            reason:effect.type,
            data:{effectId:effect.effectId,patch:safeClone(patch)}
        });
        return effect;
    }

    function removePackEffect(packRef,effectId,reason="removed"){
        const pack = resolvePackReference(packRef);
        if(!pack) return null;
        const effect = pack.effects.find(entry=>entry.effectId === String(effectId));
        if(!effect) return null;
        effect.status = "removed";
        const event = log("pack_effect_removed",{
            packNumber:pack.number,
            packId:pack.packId,
            reason,
            data:{effectId:effect.effectId,type:effect.type}
        });
        effect.resolvedAtEventId = event.sequence;
        return effect;
    }

    function getPackEffects(packRef,filters={}){
        const pack = resolvePackReference(packRef);
        if(!pack) return [];
        return pack.effects.filter(effect=>{
            if(filters.status && effect.status !== filters.status) return false;
            if(filters.type && effect.type !== filters.type) return false;
            if(
                filters.targetCardInstanceId &&
                effect.targetCardInstanceId !== filters.targetCardInstanceId
            ) return false;
            return true;
        });
    }

    function setSnapshotsEnabled(enabled){
        state.config.snapshotsEnabled = Boolean(enabled);
        return state.config.snapshotsEnabled;
    }

    function captureSnapshot(reason,draftState){
        if(!state.config.snapshotsEnabled) return null;
        const snapshot = {
            sequence:sequence,
            reason:String(reason || "manual"),
            timestamp:Date.now(),
            state:safeClone(draftState)
        };
        state.snapshots.push(snapshot);
        log("snapshot_created",{
            reason:snapshot.reason,
            data:{snapshotIndex:state.snapshots.length - 1}
        });
        return snapshot;
    }

    function popSnapshot(){
        const snapshot = state.snapshots.pop() || null;
        if(snapshot){
            log("snapshot_removed",{
                reason:"manual_remove",
                data:{snapshotSequence:snapshot.sequence}
            });
        }
        return snapshot;
    }

    function addToGraveyard(category,card,metadata={}){
        if(!card || typeof card!=="object") return null;
        const target = GRAVEYARD_CATEGORIES.includes(category)
            ? category
            : "temporaryRemoved";
        graveyardEntrySequence += 1;
        const record = {
            graveyardEntryId:`grave-${graveyardEntrySequence}`,
            sequence:++sequence,
            category:target,
            status:"available",
            instanceId:card?.instanceId || null,
            card:safeClone(card),
            previousOwner:metadata.previousOwner ?? null,
            source:metadata.source || null,
            packNumber:metadata.packNumber ?? state.activePackIndex + 1,
            packId:metadata.packId || getPack(state.activePackIndex)?.packId || null,
            pickIndex:metadata.pickIndex ?? null,
            powerId:metadata.powerId || null,
            recoverable:metadata.recoverable !== false && metadata.manualEdit !== true,
            consumedAt:null,
            consumedBy:null,
            timestamp:Date.now(),
            metadata:safeClone(metadata)
        };
        state.graveyard[target].push(record);
        global.GraveyardUI?.refreshButton?.();
        log("card_added_to_graveyard",{
            packNumber:record.packNumber,
            packId:record.packId,
            pickIndex:record.pickIndex,
            playerIndex:Number.isInteger(record.previousOwner) ? record.previousOwner : null,
            sourceCard:card,
            reason:record.source||target,
            data:{
                graveyardEntryId:record.graveyardEntryId,
                category:target,
                recoverable:record.recoverable,
                powerId:record.powerId
            }
        });
        return record;
    }

    function getAllGraveyardEntries(){
        return GRAVEYARD_CATEGORIES.flatMap(category=>state.graveyard[category]||[]);
    }

    function getGraveyardEntry(entryId){
        const id=String(entryId||"");
        if(!id) return null;
        return getAllGraveyardEntries().find(entry=>entry?.graveyardEntryId===id)||null;
    }

    function listGraveyardEntries(filters={}){
        const categories=Array.isArray(filters.categories)
            ? new Set(filters.categories.map(String))
            : null;
        const status=filters.status===undefined ? "available" : filters.status;
        return getAllGraveyardEntries().filter(entry=>{
            if(categories && !categories.has(entry.category)) return false;
            if(status!==null && entry.status!==status) return false;
            if(filters.recoverable!==undefined && entry.recoverable!==Boolean(filters.recoverable)) return false;
            if(filters.previousOwner!==undefined && entry.previousOwner!==filters.previousOwner) return false;
            if(typeof filters.predicate==="function" && !filters.predicate(entry)) return false;
            return true;
        }).map(safeClone);
    }

    function consumeGraveyardEntry(entryId,metadata={}){
        const entry=getGraveyardEntry(entryId);
        if(!entry || entry.status!=="available") return null;
        entry.status="consumed";
        entry.consumedAt=Date.now();
        entry.consumedBy=metadata.consumer||metadata.powerId||metadata.reason||null;
        entry.metadata={...(entry.metadata||{}),consumption:safeClone(metadata)};
        global.GraveyardUI?.refreshButton?.();
        log("graveyard_entry_consumed",{
            packNumber:metadata.packNumber ?? state.activePackIndex+1,
            packId:metadata.packId || getPack(state.activePackIndex)?.packId || null,
            pickIndex:metadata.pickIndex ?? null,
            playerIndex:Number.isInteger(metadata.playerIndex) ? metadata.playerIndex : null,
            sourceCard:entry.card,
            reason:metadata.reason||"graveyard_consume",
            data:{graveyardEntryId:entry.graveyardEntryId,powerId:metadata.powerId||null}
        });
        return safeClone(entry);
    }

    function restoreGraveyardEntry(entryId,metadata={}){
        const entry=getGraveyardEntry(entryId);
        if(!entry || entry.status!=="consumed") return null;
        entry.status="available";
        entry.consumedAt=null;
        entry.consumedBy=null;
        entry.metadata={...(entry.metadata||{}),restored:safeClone(metadata)};
        global.GraveyardUI?.refreshButton?.();
        return safeClone(entry);
    }

    function beginTransaction(reason,payload={}){
        const transaction={
            transactionId:`tx-${++transactionSequence}`,
            reason:String(reason||"draft_transaction"),
            status:"open",
            createdAt:Date.now(),
            payload:safeClone(payload)
        };
        state.transactions.push(transaction);
        log("transaction_started",{reason:transaction.reason,data:{transactionId:transaction.transactionId}});
        return safeClone(transaction);
    }

    function getTransaction(transactionId){
        return state.transactions.find(tx=>tx?.transactionId===transactionId)||null;
    }

    function commitTransaction(transactionId,metadata={}){
        const tx=getTransaction(transactionId);
        if(!tx || tx.status!=="open") return null;
        tx.status="committed";
        tx.completedAt=Date.now();
        tx.commitMetadata=safeClone(metadata);
        tx.payload=null;
        log("transaction_committed",{reason:tx.reason,data:{transactionId:tx.transactionId}});
        return safeClone(tx);
    }

    function rollbackTransaction(transactionId,metadata={}){
        const tx=getTransaction(transactionId);
        if(!tx || tx.status!=="open") return null;
        const payload=safeClone(tx.payload);
        tx.status="rolled_back";
        tx.completedAt=Date.now();
        tx.rollbackMetadata=safeClone(metadata);
        tx.payload=null;
        log("transaction_rolled_back",{reason:tx.reason,data:{transactionId:tx.transactionId}});
        return payload;
    }

    function restoreState(nextState){
        if(!nextState || typeof nextState!=="object") return false;
        state=safeClone(nextState);
        state.transactions=Array.isArray(state.transactions) ? state.transactions : [];
        state.snapshots=Array.isArray(state.snapshots) ? state.snapshots : [];
        state.eventLog=Array.isArray(state.eventLog) ? state.eventLog : [];
        state.packs=Array.isArray(state.packs) ? state.packs : [];
        state.config=state.config&&typeof state.config==="object" ? state.config : {snapshotsEnabled:false};
        state.graveyard=state.graveyard&&typeof state.graveyard==="object" ? state.graveyard : {};
        GRAVEYARD_CATEGORIES.forEach(category=>{
            if(!Array.isArray(state.graveyard[category])) state.graveyard[category]=[];
        });
        const entries=getAllGraveyardEntries();
        const numericSuffix=(value,marker)=>{
            const match=String(value||"").match(new RegExp(`${marker}(\\d+)$`));
            return match ? Number(match[1])||0 : 0;
        };
        graveyardEntrySequence=Math.max(
            Number(graveyardEntrySequence)||0,
            0,
            ...entries.map(entry=>numericSuffix(entry?.graveyardEntryId,"grave-"))
        );
        entries.forEach(entry=>{
            if(!entry.graveyardEntryId) entry.graveyardEntryId=`grave-${++graveyardEntrySequence}`;
            if(!entry.status) entry.status="available";
            if(entry.recoverable===undefined) entry.recoverable=true;
            if(entry.consumedAt===undefined) entry.consumedAt=null;
            if(entry.consumedBy===undefined) entry.consumedBy=null;
        });
        transactionSequence=Math.max(
            Number(transactionSequence)||0,
            0,
            ...state.transactions.map(tx=>numericSuffix(tx?.transactionId,"tx-"))
        );
        const cards=[
            ...state.packs.flatMap(pack=>[
                ...(Array.isArray(pack?.originalCards)?pack.originalCards:[]),
                ...(Array.isArray(pack?.cards)?pack.cards:[])
            ]),
            ...entries.map(entry=>entry?.card),
            ...state.eventLog.flatMap(event=>[event?.sourceCard,event?.resultCard])
        ].filter(Boolean);
        cardInstanceSequence=Math.max(
            Number(cardInstanceSequence)||0,
            0,
            ...cards.map(card=>numericSuffix(card?.instanceId,"-card-"))
        );
        const effects=state.packs.flatMap(pack=>Array.isArray(pack?.effects)?pack.effects:[]);
        effectSequence=Math.max(
            Number(effectSequence)||0,
            0,
            ...effects.map(effect=>numericSuffix(effect?.effectId,"-effect-"))
        );
        sequence=Math.max(
            Number(sequence)||0,
            0,
            ...state.eventLog.map(event=>Number(event?.sequence)||0),
            ...entries.map(entry=>Number(entry?.sequence)||0)
        );
        return true;
    }

    function exportState(){
        return safeClone(state);
    }

    global.DraftStateEngine = Object.freeze({
        VERSION,
        PACK_STATUSES:[...PACK_STATUSES],
        GRAVEYARD_CATEGORIES:[...GRAVEYARD_CATEGORIES],
        reset,
        init,
        log,
        setPackPlan,
        getPack,
        getPackById,
        activatePack,
        updatePack,
        completePack,
        createCardInstance,
        ensureCardInstance,
        addPackEffect,
        updatePackEffect,
        removePackEffect,
        getPackEffects,
        setSnapshotsEnabled,
        captureSnapshot,
        popSnapshot,
        addToGraveyard,
        getAllGraveyardEntries,
        getGraveyardEntry,
        listGraveyardEntries,
        consumeGraveyardEntry,
        restoreGraveyardEntry,
        beginTransaction,
        commitTransaction,
        rollbackTransaction,
        restoreState,
        exportState,
        getState:()=>state
    });
})(window);
