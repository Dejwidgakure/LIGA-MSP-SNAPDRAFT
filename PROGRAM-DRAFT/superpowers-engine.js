/**
 * MSP SnapDraft - Superpowers Engine
 * Version adapted to MSP SnapDraft player model (players are strings).
 * PATCH 39.3 FOUNDATION: runtime assets and transactional state export/restore.
 */

const SuperpowerEngine = (()=>{

    const registry = new Map();
    const playerData = new Map();
    const runtimeAssets = new Map();
    let runtimeAssetSequence = 0;

    const state = {
        players: [],
        enabled:false,
        round:1
    };

    function init(players=[]){
        state.players=[...players];
        state.enabled=true;
        playerData.clear();
        runtimeAssets.clear();
        runtimeAssetSequence=0;
    }

    function register(power){
        if(!power?.id) throw new Error("Power requires id");
        registry.set(power.id,power);
    }

    function getRegisteredPowers(){
        return [...registry.values()];
    }

    function assignRandom(){
        const powers=getRegisteredPowers();
        if(!powers.length) return;

        state.players.forEach(name=>{
            const p=powers[Math.floor(Math.random()*powers.length)];
            playerData.set(name,{
                player:name,
                powerId:p.id,
                powerName:p.name,
                description:p.description||"",
                timingLabel:p.timingLabel||"",
                used:false,
                cooldown:0,
                definition:p,
                data:{}
            });
        });
    }

    function assign(assignments={}){
        if(!assignments || typeof assignments!=="object") return false;

        playerData.clear();
        let assignedCount=0;

        state.players.forEach(name=>{
            const rawAssignment=assignments[name];
            const powerId=typeof rawAssignment==="string"
                ? rawAssignment
                : rawAssignment?.powerId;
            const power=registry.get(powerId);
            if(!power) return;

            playerData.set(name,{
                player:name,
                powerId:power.id,
                powerName:power.power || power.name,
                heroName:power.name,
                description:power.description||"",
                timingLabel:power.timingLabel||"",
                used:false,
                cooldown:0,
                definition:power,
                data:{}
            });
            assignedCount++;
        });

        return assignedCount===state.players.length;
    }

    function getAssignments(){
        return Object.fromEntries(
            [...playerData.entries()].map(([playerName,data])=>[
                playerName,
                {
                    powerId:data.powerId,
                    heroName:data.heroName,
                    powerName:data.powerName,
                    used:Boolean(data.used),
                    cooldown:Number(data.cooldown||0),
                    data:data.data ? JSON.parse(JSON.stringify(data.data)) : {}
                }
            ])
        );
    }

    function getPlayerData(name){
        return playerData.get(name);
    }

    function canActivate(playerName,powerId){
        const data=getPlayerData(playerName);
        if(!state.enabled){
            return {ok:false,reason:"Superpowers engine is disabled."};
        }
        if(!data){
            return {ok:false,reason:"Player has no assigned superpower."};
        }
        if(powerId && data.powerId!==powerId){
            return {ok:false,reason:"Assigned superpower does not match."};
        }
        if(data.used){
            return {ok:false,reason:"Superpower has already been used."};
        }
        return {ok:true,data};
    }

    function trigger(eventName, playerName, payload={}){
        const data=getPlayerData(playerName);
        if(!data) return;
        const fn=data.definition?.[eventName];
        if(typeof fn==="function"){
            return fn({
                playerName,
                power:data,
                ...payload
            });
        }
    }

    function markRechargeSpentIfReady(data,payload={}){
        const recharge=data?.data?.recharge;
        if(!recharge || recharge.status!=="ready") return false;
        recharge.status="spent";
        recharge.spentAt=Date.now();
        recharge.spentByActivation={
            packNumber:payload?.packNumber??null,
            pickIndex:payload?.pickIndex??payload?.armedAtPickIndex??null
        };
        try{
            const stored=typeof window!=="undefined"?window.draftSuperpowers?.[data.player]:null;
            if(stored?.recharge){
                stored.recharge.status="spent";
                stored.recharge.spentAt=recharge.spentAt;
            }
        }catch(_){ }
        return true;
    }

    function activate(playerName){
        const check=canActivate(playerName);
        if(!check.ok) return false;
        const data=check.data;
        trigger("activate",playerName);
        markRechargeSpentIfReady(data);
        data.used=true;
        return true;
    }

    function completeActivation(playerName,powerId,payload={}){
        const check=canActivate(playerName,powerId);
        if(!check.ok) return check;

        const data=check.data;
        markRechargeSpentIfReady(data,payload);
        data.used=true;
        data.data={
            ...(data.data||{}),
            lastActivation:payload
        };
        trigger("afterActivate",playerName,payload);

        return {ok:true,data};
    }


    function createRuntimeAsset(owner,type,data={}){
        const asset={
            assetId:`asset-${++runtimeAssetSequence}`,
            owner:String(owner||""),
            type:String(type||"runtime_asset"),
            status:"active",
            createdAt:Date.now(),
            data:JSON.parse(JSON.stringify(data||{}))
        };
        runtimeAssets.set(asset.assetId,asset);
        return JSON.parse(JSON.stringify(asset));
    }

    function getRuntimeAssets(filters={}){
        return [...runtimeAssets.values()]
            .filter(asset=>{
                if(filters.owner!==undefined && asset.owner!==String(filters.owner)) return false;
                if(filters.type!==undefined && asset.type!==String(filters.type)) return false;
                if(filters.status!==undefined && asset.status!==String(filters.status)) return false;
                return true;
            })
            .map(asset=>JSON.parse(JSON.stringify(asset)));
    }

    function updateRuntimeAsset(assetId,patch={}){
        const asset=runtimeAssets.get(String(assetId||""));
        if(!asset) return null;
        if(patch.status!==undefined) asset.status=String(patch.status);
        if(patch.data&&typeof patch.data==="object") asset.data={...asset.data,...JSON.parse(JSON.stringify(patch.data))};
        asset.updatedAt=Date.now();
        return JSON.parse(JSON.stringify(asset));
    }

    function consumeRuntimeAsset(assetId,metadata={}){
        return updateRuntimeAsset(assetId,{status:"consumed",data:{consumption:metadata}});
    }

    function exportState(){
        return {
            state:JSON.parse(JSON.stringify(state)),
            players:[...playerData.entries()].map(([name,data])=>[name,{
                ...data,
                definitionId:data?.definition?.id||data?.powerId||null,
                definition:undefined
            }]),
            runtimeAssets:[...runtimeAssets.entries()].map(([id,asset])=>[id,JSON.parse(JSON.stringify(asset))]),
            runtimeAssetSequence
        };
    }

    function restoreState(snapshot){
        if(!snapshot||typeof snapshot!=="object") return false;
        Object.assign(state,JSON.parse(JSON.stringify(snapshot.state||{})));
        playerData.clear();
        (Array.isArray(snapshot.players)?snapshot.players:[]).forEach(([name,raw])=>{
            const power=registry.get(raw?.powerId||raw?.definitionId);
            playerData.set(name,{...raw,definition:power});
        });
        runtimeAssets.clear();
        (Array.isArray(snapshot.runtimeAssets)?snapshot.runtimeAssets:[]).forEach(([id,asset])=>runtimeAssets.set(id,asset));
        runtimeAssetSequence=Number(snapshot.runtimeAssetSequence)||0;
        return true;
    }

    function debugTable(){
        console.table(
            [...playerData.values()].map(x=>({
                Player:x.player,
                Superpower:x.powerName,
                Used:x.used
            }))
        );
    }

    return {
        init,
        register,
        getRegisteredPowers,
        assignRandom,
        assign,
        getAssignments,
        getPlayerData,
        canActivate,
        activate,
        completeActivation,
        trigger,
        createRuntimeAsset,
        getRuntimeAssets,
        updateRuntimeAsset,
        consumeRuntimeAsset,
        exportState,
        restoreState,
        debugTable,
        state
    };

})();

// PATCH 0.7 - udostępnienie engine dla modala SnapDraft
window.SuperpowerEngine = SuperpowerEngine;
