(function(global){
    "use strict";

    const POWER_ID="black_cat";
    const ASSET_ROOT="draft-assets/";
    const GALLERY_WALLS=Object.freeze([
        `${ASSET_ROOT}blackcat_gallery_corridor_05.png`,
        `${ASSET_ROOT}blackcat_gallery_corridor_06.png`,
        `${ASSET_ROOT}blackcat_gallery_corridor_09.png`
    ]);
    const CONFIG=Object.freeze({rows:5,cols:7,maxMoves:14,laserCount:7,rewardCount:13,startRow:4,startCol:3});
    const GEM_DEFS=Object.freeze({
        echo:{label:"KLEJNOT ECHA",short:"ECHO",weight:25,icon:`${ASSET_ROOT}blackcat_gem_echo.png`,tooltip:"KLEJNOT ECHA: przywraca kopie dwóch pierwszych normalnych pików aktualnego draftu. Wybierz odbicie albo zostań przy zwykłej karcie."},
        prism:{label:"KLEJNOT PRYZMATU",short:"PRYZMAT",weight:22,icon:`${ASSET_ROOT}blackcat_gem_prism.png`,tooltip:"KLEJNOT PRYZMATU: wskaż kartę z tej paczki i wybierz jedno z dwóch odbić o tym samym Koszcie."},
        synergy:{label:"KLEJNOT SYNERGII",short:"SYNERGIA",weight:18,icon:`${ASSET_ROOT}blackcat_gem_synergy.png`,tooltip:"KLEJNOT SYNERGII: szuka po Rodzinach Mechanik, Mechanikach szczegółowych oraz Archetypach Deckowych / Paczkach Twojego decku Black Cat."},
        necromancer:{label:"KLEJNOT NEKROMANTY",short:"NEKROMANTA",weight:15,icon:`${ASSET_ROOT}blackcat_gem_necromancer.png`,tooltip:"KLEJNOT NEKROMANTY: przywraca do wyboru dwie karty z Graveyardu, które mogą wrócić do historii draftu."},
        future:{label:"KLEJNOT PRZYSZŁOŚCI",short:"PRZYSZŁOŚĆ",weight:10,icon:`${ASSET_ROOT}blackcat_gem_future.png`,tooltip:"KLEJNOT PRZYSZŁOŚCI: pokazuje dwie kopie kart z następnej paczki, bez zabierania oryginału z przyszłego pika."},
        shadow:{label:"KLEJNOT CIENIA",short:"CIEŃ",weight:10,icon:`${ASSET_ROOT}blackcat_gem_shadow.png`,tooltip:"KLEJNOT CIENIA: cieniem odbija kopie dwóch ostatnich normalnych pików aktualnego draftu."}
    });
    const REWARD_DEFS=Object.freeze({
        coin_1:{type:"coin_1",label:"1 JEFFCOIN",short:"+1 JC",quality:1,icon:`${ASSET_ROOT}jeffcoin.png`,tooltip:"Dodaje 1 JeffCoina do portfela Black Cat."},
        coin_2:{type:"coin_2",label:"2 JEFFCOINY",short:"+2 JC",quality:2,icon:`${ASSET_ROOT}jeffcoin.png`,tooltip:"Dodaje 2 JeffCoiny do portfela Black Cat."},
        safe_key:{type:"safe_key",label:"KOCI KLUCZ",short:"KLUCZ",quality:3,icon:`${ASSET_ROOT}blackcat_safe_key.png`,tooltip:"Podkrada 1 JeffCoina losowemu rywalowi; gdy nikt go nie ma, daje 1 JC."},
        stolen_access:{type:"stolen_access",label:"SKRADZIONY DOSTĘP",short:"DOSTĘP",quality:0,icon:`${ASSET_ROOT}blackcat_stolen_access.png`,tooltip:"Odsłania gabloty w większym obszarze muzeum."},
        gem:{type:"gem",label:"KOSMICZNY KLEJNOT",short:"KLEJNOT",quality:4,tooltip:"Otwiera dodatkowy wybór przy jednym z kolejnych normalnych picków."},
        exhibit:{type:"exhibit",label:"GŁÓWNY EKSPONAT",short:"EKSPONAT",quality:5,tooltip:"Skradziona karta trafia do Black Cat i natychmiast kończy napad."}
    });

    const safeClone=value=>{
        if(value===undefined) return undefined;
        if(typeof structuredClone==="function"){
            try{return structuredClone(value);}catch(error){}
        }
        return JSON.parse(JSON.stringify(value));
    };
    const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
    const esc=value=>String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
    const norm=value=>String(value||"").trim().toLocaleLowerCase("pl-PL");
    const cardCost=card=>Number.isFinite(Number(card?.cost))?Number(card.cost):0;
    const cardPower=card=>Number.isFinite(Number(card?.power))?Number(card.power):0;
    const inGalacticCurrent=()=>Boolean(global.GalacticCurrent?.getState?.()?.active);
    const flowSurfaceGenitive=()=>inGalacticCurrent()?"nurtu":"paczki";
    const flowSurfaceLocative=()=>inGalacticCurrent()?"nurcie":"paczce";
    function gemTooltip(def){
        const base=String(def?.tooltip||"");
        if(!inGalacticCurrent()) return base;
        if(def?.type==="prism") return "KLEJNOT PRYZMATU: wskaż kartę z aktualnego nurtu i wybierz jedno z dwóch odbić o tym samym Koszcie.";
        if(def?.type==="future") return "KLEJNOT PRZYSZŁOŚCI: pokazuje dwie kopie kart z przyszłego dopływu Gwiezdnego Prądu, bez zabierania oryginałów z kolejki.";
        return base;
    }
    const indexOf=(row,col,cols=CONFIG.cols)=>row*cols+col;
    const coords=(index,cols=CONFIG.cols)=>({row:Math.floor(Number(index)/cols),col:Number(index)%cols});
    const distance=(a,b,cols=CONFIG.cols)=>{const pa=coords(a,cols),pb=coords(b,cols);return Math.abs(pa.row-pb.row)+Math.abs(pa.col-pb.col);};
    const neighbors=(index,rows=CONFIG.rows,cols=CONFIG.cols,diagonal=false)=>{
        const {row,col}=coords(index,cols),list=[];
        for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){
            if(!dr&&!dc) continue;
            if(!diagonal&&Math.abs(dr)+Math.abs(dc)!==1) continue;
            const nr=row+dr,nc=col+dc;
            if(nr>=0&&nr<rows&&nc>=0&&nc<cols) list.push(indexOf(nr,nc,cols));
        }
        return list;
    };
    const shuffled=(values,rng=Math.random)=>{
        const result=[...(values||[])];
        for(let i=result.length-1;i>0;i--){
            const j=Math.floor(clamp(Number(rng())||0,0,.999999)*(i+1));
            [result[i],result[j]]=[result[j],result[i]];
        }
        return result;
    };
    const uniqueCards=cards=>{
        const seen=new Set();
        return (cards||[]).filter(card=>{const key=norm(card?.name);if(!key||seen.has(key)) return false;seen.add(key);return true;});
    };
    function weightedGem(rng=Math.random,excluded=new Set()){
        const available=Object.entries(GEM_DEFS).filter(([type])=>!excluded.has(type));
        const entries=available.length?available:Object.entries(GEM_DEFS),total=entries.reduce((sum,[,def])=>sum+def.weight,0);
        let roll=(Number(rng())||0)*total;
        for(const [type,def] of entries){roll-=def.weight;if(roll<0) return {type,...def};}
        const [type,def]=entries[0];return {type,...def};
    }
    function buildPath(start,end,cols,rng=Math.random){
        const path=[start];let current=start;
        while(current!==end){
            const from=coords(current,cols),to=coords(end,cols),choices=[];
            if(from.row>to.row) choices.push(indexOf(from.row-1,from.col,cols));
            if(from.row<to.row) choices.push(indexOf(from.row+1,from.col,cols));
            if(from.col>to.col) choices.push(indexOf(from.row,from.col-1,cols));
            if(from.col<to.col) choices.push(indexOf(from.row,from.col+1,cols));
            current=choices[Math.floor((Number(rng())||0)*choices.length)]??choices[0];
            path.push(current);
        }
        return path;
    }
    function drawFromZone(zone,count,used,rng){
        const available=shuffled(zone.filter(index=>!used.has(index)),rng),picked=available.slice(0,count);
        picked.forEach(index=>used.add(index));
        return picked;
    }
    function revealRadius(session,index,radius=1){
        const center=coords(index,session.cols);
        for(let row=0;row<session.rows;row++) for(let col=0;col<session.cols;col++){
            // Pole widzenia jest krzyżem korytarzy, nie kwadratem 3×3: po skosie
            // nie podglądamy gablot ani ścieżki. Nawet rozszerzony dostęp otwiera
            // wyłącznie pola w tym samym wierszu lub kolumnie.
            const sameCorridor=row===center.row||col===center.col;
            if(sameCorridor&&Math.abs(row-center.row)+Math.abs(col-center.col)<=radius) session.revealed.add(indexOf(row,col,session.cols));
        }
    }
    function createSession(options={}){
        const rows=CONFIG.rows,cols=CONFIG.cols,maxMoves=clamp(Number(options.maxMoves)||CONFIG.maxMoves,10,18);
        const rng=typeof options.rng==="function"?options.rng:Math.random;
        const startIndex=indexOf(CONFIG.startRow,CONFIG.startCol,cols),all=Array.from({length:rows*cols},(_,index)=>index);
        const zones={
            near:all.filter(i=>i!==startIndex&&distance(startIndex,i,cols)<=3),
            mid:all.filter(i=>distance(startIndex,i,cols)>=4&&distance(startIndex,i,cols)<=5),
            far:all.filter(i=>distance(startIndex,i,cols)>=6)
        };
        const used=new Set([startIndex]);
        const exhibitIndex=drawFromZone(zones.far.length?zones.far:zones.mid,1,used,rng)[0];
        const rewardIndices=[
            ...drawFromZone(zones.near,4,used,rng),
            ...drawFromZone(zones.mid,5,used,rng),
            ...drawFromZone(zones.far,3,used,rng)
        ];
        while(rewardIndices.length<12){const next=drawFromZone(all,1,used,rng)[0];if(next===undefined) break;rewardIndices.push(next);}
        const economyEnabled=Boolean(options.economyEnabled);
        const rewardQueue=economyEnabled
            ? ["coin_1","coin_1","coin_1","coin_1","coin_1","coin_2","coin_2","safe_key",...Array(4).fill("gem")]
            : [...Array(8).fill("stolen_access"),...Array(4).fill("gem")];
        const mixedRewards=shuffled(rewardQueue,rng),usedGemTypes=new Set();
        const cells=all.map(index=>({index,...coords(index,cols),kind:"empty",reward:null,collected:false}));
        cells[exhibitIndex].kind="exhibit";
        rewardIndices.forEach((index,position)=>{
            const type=mixedRewards[position];
            const reward={...REWARD_DEFS[type],rewardId:`loot-${position+1}`};
            if(type==="gem"){
                const gem=weightedGem(rng,usedGemTypes);usedGemTypes.add(gem.type);
                Object.assign(reward,{gemType:gem.type,label:gem.label,short:gem.short,icon:gem.icon,tooltip:gemTooltip(gem)});
            }
            cells[index].kind="reward";cells[index].reward=reward;
        });
        const laserIndices=drawFromZone(all,CONFIG.laserCount,used,rng);
        laserIndices.forEach(index=>{cells[index].kind="laser";});
        const safePath=buildPath(startIndex,exhibitIndex,cols,rng);
        const pathLasers=safePath.filter(index=>cells[index]?.kind==="laser");
        if(pathLasers.length>1){
            const swapCandidates=shuffled(all.filter(index=>cells[index].kind==="empty"&&index!==startIndex&&!safePath.includes(index)),rng);
            pathLasers.slice(1).forEach((laserIndex,offset)=>{
                const replacement=swapCandidates[offset];if(replacement===undefined) return;
                cells[laserIndex].kind="empty";cells[replacement].kind="laser";
            });
        }
        const session={
            version:2,rows,cols,maxMoves,movesRemaining:maxMoves,startIndex,currentIndex:startIndex,exhibitIndex,
            cells,safePath,visited:new Set([startIndex]),revealed:new Set(),scouted:new Set(),collected:[],finalLoot:[],laserHits:0,
            lanternAvailable:true,lanternRadius:2,
            alarmActive:false,status:"active",economyEnabled,target:safeClone(options.target||null),createdAt:Date.now(),
            events:[{type:"entry",index:startIndex}]
        };
        return session;
    }
    function isReachable(session,index){
        const targetIndex=Number(index),cell=session?.cells?.[targetIndex];
        if(cell?.kind==="laser"&&session.visited?.has(targetIndex)) return false;
        return Boolean(session?.status==="active"&&neighbors(session.currentIndex,session.rows,session.cols,false).includes(targetIndex));
    }
    function move(session,index){
        const targetIndex=Number(index);
        if(!session||session.status!=="active") return {ok:false,reason:"Napad nie oczekuje teraz na ruch."};
        if(!isReachable(session,targetIndex)) return {ok:false,reason:"Black Cat może skoczyć tylko na sąsiednie pole."};
        const backtrack=session.visited.has(targetIndex);
        session.currentIndex=targetIndex;
        if(backtrack){
            const event={ok:true,index:targetIndex,kind:"backtrack",backtrack:true,movesRemaining:session.movesRemaining};
            session.events.push({type:"backtrack",...event});return event;
        }
        session.visited.add(targetIndex);session.scouted.add(targetIndex);session.movesRemaining=Math.max(0,session.movesRemaining-1);
        const cell=session.cells[targetIndex];
        const event={ok:true,index:targetIndex,kind:cell.kind,movesRemaining:session.movesRemaining};
        if(cell.kind==="reward"&&cell.reward&&!cell.collected){
            cell.collected=true;
            const reward=safeClone(cell.reward);event.reward=reward;
            if(reward.type==="stolen_access"){
                revealRadius(session,targetIndex,2);event.accessReveal=true;
            }else session.collected.push(reward);
        }else if(cell.kind==="laser"){
            session.laserHits+=1;session.alarmActive=true;event.laserHit=session.laserHits;
            if(session.laserHits===1){event.luckyEscape=true;}
            else{session.status="caught";session.finalLoot=safeClone(session.collected);event.caught=true;}
        }else if(cell.kind==="exhibit"){
            session.status="success";session.finalLoot=safeClone(session.collected);event.success=true;
        }
        if(session.status==="active"&&session.movesRemaining<=0){session.status="exhausted";session.finalLoot=safeClone(session.collected);event.exhausted=true;}
        session.events.push({type:"move",...safeClone(event)});return event;
    }
    function useLantern(session){
        if(!session||session.status!=="active") return {ok:false,reason:"Kocia latarka działa tylko podczas aktywnego napadu."};
        if(!session.lanternAvailable) return {ok:false,reason:"Kocia latarka została już użyta."};
        session.lanternAvailable=false;
        const center=coords(session.currentIndex,session.cols),indices=[],rewardIndices=[];
        for(let row=Math.max(0,center.row-1);row<=Math.min(session.rows-1,center.row+1);row++){
            for(let col=Math.max(0,center.col-1);col<=Math.min(session.cols-1,center.col+1);col++){
                if(row===center.row&&col===center.col) continue;
                const index=indexOf(row,col,session.cols),cell=session.cells[index];
                indices.push(index);session.revealed.add(index);
                if(cell&&["reward","exhibit"].includes(cell.kind)){session.scouted.add(index);rewardIndices.push(index);}
            }
        }
        const event={ok:true,kind:"lantern",radius:1,indices,rewardIndices,movesRemaining:session.movesRemaining};
        session.events.push({type:"lantern",...safeClone(event)});return event;
    }
    function cashOut(session){
        if(!session||session.status!=="active") return {ok:false,reason:"Nie można teraz zakończyć napadu."};
        if(!session.collected.length) return {ok:false,reason:"Najpierw zdobądź co najmniej jeden łup."};
        session.status="cashed_out";session.finalLoot=safeClone(session.collected);
        const event={ok:true,status:session.status,loot:safeClone(session.finalLoot)};session.events.push({type:"cash_out",...event});return event;
    }
    function snapshot(session){
        if(!session) return null;
        const raw=safeClone({...session,visited:[...session.visited],revealed:[...session.revealed]});
        raw.reachableIndices=session.status==="active"
            ?neighbors(session.currentIndex,session.rows,session.cols,false).filter(index=>isReachable(session,index))
            :[];
        return raw;
    }
    const Engine=Object.freeze({CONFIG,GEM_DEFS,REWARD_DEFS,createSession,move,useLantern,cashOut,snapshot,isReachable});
    global.BlackCatHeistEngine=Engine;
    if(!global.document) return;

    const state={
        active:false,phase:"idle",playerName:"",playerIndex:-1,targets:[],sacrifices:[],selectedTarget:null,selectedSacrifice:null,session:null,
        processing:false,activationCommitted:false,stolenCard:null,replacementCard:null,sacrificedCard:null,mainResult:null,
        rewardResults:[],notice:"",settled:false,wallVariant:0
    };
    const portal={active:null,tooltipLocked:null};
    const playersList=()=>typeof players!=="undefined"&&Array.isArray(players)?players:[];
    const decksList=()=>typeof decks!=="undefined"&&Array.isArray(decks)?decks:[];
    const cardsList=()=>typeof cardDatabase!=="undefined"&&Array.isArray(cardDatabase)?cardDatabase:[];
    const bannedList=()=>typeof bannedCards!=="undefined"&&Array.isArray(bannedCards)?bannedCards:[];
    const assignment=playerName=>typeof getSuperpowerRuntimeAssignment==="function"?getSuperpowerRuntimeAssignment(playerName):global.SuperpowerEngine?.getPlayerData?.(playerName);
    const notify=(kind,title,message)=>global.SuperpowerFeedback?.[kind]?.(POWER_ID,title,message);
    const economyEnabled=()=>Boolean(global.EconomyEngine?.isEnabled?.());
    function makeCard(template,metadata={}){
        return typeof createDraftCardInstance==="function"
            ? createDraftCardInstance(template,{origin:"black_cat_gem_portal",sourcePowerId:POWER_ID,sourceEvent:"black_cat_gem_portal",forceNew:true,...metadata})
            : safeClone(template);
    }
    function isCardMutable(playerIndex,cardIndex,effect="replace",actorPlayerIndex=playerIndex){
        const card=decksList()[playerIndex]?.[cardIndex];
        if(!card||card?.joker||card?.instanceMeta?.locked||card?.instanceMeta?.cannotReplace) return false;
        if(!Number.isFinite(Number(card.cost))||!Number.isFinite(Number(card.power))) return false;
        return typeof canSuperpowerTargetDeckCard!=="function"||canSuperpowerTargetDeckCard({actorPlayerIndex,targetPlayerIndex:playerIndex,targetCardIndex:cardIndex,effect})!==false;
    }
    function replacementTemplates(playerIndex,cardIndex,sourceCard,count=99){
        const occupied=new Set((decksList()[playerIndex]||[]).filter((_,index)=>index!==cardIndex).map(card=>norm(card?.name)).filter(Boolean));
        const banned=new Set(bannedList().map(norm)),sourceName=norm(sourceCard?.name);
        return shuffled(cardsList().filter(card=>{
            const name=norm(card?.name);
            return Boolean(name&&!card?.joker&&name!==sourceName&&!occupied.has(name)&&!banned.has(name)&&cardCost(card)===cardCost(sourceCard)&&Number.isFinite(Number(card?.power)));
        })).slice(0,count);
    }
    function eligibleTargets(playerIndex){
        const ownerNames=new Set((decksList()[playerIndex]||[]).map(card=>norm(card?.name)).filter(Boolean)),result=[];
        playersList().forEach((playerName,targetPlayerIndex)=>{
            if(targetPlayerIndex===playerIndex) return;
            (decksList()[targetPlayerIndex]||[]).forEach((card,targetCardIndex)=>{
                if(ownerNames.has(norm(card?.name))) return;
                if(!isCardMutable(targetPlayerIndex,targetCardIndex,"replace",playerIndex)) return;
                if(!replacementTemplates(targetPlayerIndex,targetCardIndex,card,1).length) return;
                result.push({targetPlayerIndex,targetPlayerName:playerName,targetCardIndex,targetCardInstanceId:card.instanceId||"",card:safeClone(card)});
            });
        });
        return result;
    }
    function eligibleSacrifices(playerIndex){
        const playerName=playersList()[playerIndex]||"Black Cat";
        return (decksList()[playerIndex]||[]).map((card,cardIndex)=>({
            playerIndex,playerName,cardIndex,cardInstanceId:card?.instanceId||"",card:safeClone(card)
        })).filter(entry=>isCardMutable(playerIndex,entry.cardIndex,"replace",playerIndex));
    }
    function preflight(playerName){
        const playerIndex=playersList().indexOf(String(playerName||"")),data=assignment(playerName);
        if(state.active) return {ok:false,message:"KOCI HEIST jest już w toku."};
        if(playerIndex<0||data?.powerId!==POWER_ID) return {ok:false,message:"Black Cat nie jest przypisana do tego gracza."};
        if(data.used) return {ok:false,message:"KOCI HEIST został już wykorzystany."};
        if(typeof draftFinished!=="undefined"&&draftFinished) return {ok:false,message:"Draft jest już zakończony."};
        if(global.DraftFoundation?.hasOpenTransaction?.()) return {ok:false,message:"Najpierw dokończ bieżące rozstrzygnięcie draftu."};
        if(global.SuperpowerUI?.isOwnBusy?.()) return {ok:false,message:"Najpierw dokończ aktywną sekwencję Supermocy."};
        const competing=[global.GambitUI,global.WolverineUI,global.DevilDinoUI,global.GrootUI,global.ThorUI,global.IronFistUI,global.JokerV2UI,global.MysterioUI];
        if(competing.some(module=>module?.isBusy?.())) return {ok:false,message:"Najpierw dokończ inną aktywną sekwencję draftu."};
        const targets=eligibleTargets(playerIndex);
        if(!targets.length) return {ok:false,message:"W deckach rywali nie ma eksponatu z dostępnym zamiennikiem o tym samym Koszcie."};
        const sacrifices=eligibleSacrifices(playerIndex);
        if(!sacrifices.length) return {ok:false,message:"W galerii Black Cat nie ma karty, którą można przeznaczyć na miejsce dla głównego eksponatu."};
        return {ok:true,playerIndex,targets,sacrifices};
    }
    function ensureOverlay(){
        let overlay=document.getElementById("spxBlackCatOverlay");
        if(overlay) overlay.remove();
        overlay=document.createElement("div");overlay.id="spxBlackCatOverlay";overlay.className="spx-blackcat-overlay spx-blackcat-v7";overlay.hidden=true;
        overlay.innerHTML=`<section class="spx-blackcat-modal" role="dialog" aria-modal="true" aria-labelledby="spxBlackCatTitle">
            <header class="spx-blackcat-header"><div class="spx-blackcat-brand"><img src="draft-assets/blackcatpowerslogo.png?v=3-bolt" alt=""><div><span>BLACK CAT // NOCNA OPERACJA</span><h2 id="spxBlackCatTitle">KOCI HEIST</h2><p id="spxBlackCatLead"></p></div></div><div class="spx-blackcat-header-gems" aria-hidden="true"><img src="draft-assets/blackcat_gem_shadow.png" alt=""><img src="draft-assets/blackcat_gem_echo.png" alt=""><img src="draft-assets/blackcat_gem_prism.png" alt=""></div><div class="spx-blackcat-header-status" id="spxBlackCatHeaderStatus"></div><button type="button" class="spx-blackcat-close" id="spxBlackCatClose" aria-label="Zamknij">×</button></header>
            <main class="spx-blackcat-content" id="spxBlackCatContent"></main>
            <footer class="spx-blackcat-footer"><div id="spxBlackCatHint"></div><div class="spx-blackcat-actions" id="spxBlackCatActions"></div></footer>
            <div class="spx-blackcat-event" id="spxBlackCatEvent" hidden></div>
        </section>`;
        document.body.appendChild(overlay);overlay.querySelector("#spxBlackCatClose").addEventListener("click",attemptClose);return overlay;
    }
    function overlay(){return document.getElementById("spxBlackCatOverlay")||ensureOverlay();}
    function setOverlayMode(mode){
        const modal=overlay().querySelector(".spx-blackcat-modal");
        if(!modal) return;
        modal.classList.toggle("is-heist",mode==="heist");
        modal.classList.toggle("is-target",mode==="target");
        modal.classList.toggle("is-summary",mode==="summary");
    }
    function setHeader(lead,status=""){overlay().querySelector("#spxBlackCatLead").textContent=lead||"";overlay().querySelector("#spxBlackCatHeaderStatus").innerHTML=status||"";}
    function setHint(text){const root=overlay(),target=root.querySelector(".spx-blackcat-modal.is-heist #spxBlackCatHeistHint")||root.querySelector("#spxBlackCatHint");if(target) target.textContent=text||"";}
    function setActions(actions=[]){
        const root=overlay(),target=root.querySelector(".spx-blackcat-modal.is-heist #spxBlackCatHeistActions")||root.querySelector("#spxBlackCatActions");if(!target)return;target.innerHTML="";
        actions.forEach(action=>{const button=document.createElement("button");button.type="button";button.className=`spx-blackcat-action ${action.className||""}`;button.disabled=Boolean(action.disabled);button.addEventListener("click",action.onClick);if(String(action.className||"").split(/\s+/).includes("lantern-action")){const icon=document.createElement("img");icon.src=`${ASSET_ROOT}blackcat_cat_lantern.png`;icon.alt="";icon.setAttribute("aria-hidden","true");const label=document.createElement("span");label.textContent=action.label;button.append(icon,label);}else button.textContent=action.label;target.appendChild(button);});
    }
    function cardMarkup(card,extraClass=""){
        return `<article class="spx-blackcat-card ${extraClass}"><div class="spx-blackcat-card-orb cost"><span>${esc(cardCost(card))}</span></div><div class="spx-blackcat-card-art"><i></i></div><strong>${esc(card?.name||"Nieznana karta")}</strong><div class="spx-blackcat-card-orb power"><span>${esc(cardPower(card))}</span></div></article>`;
    }
    function buildDisplayPackCard(card,extraClass=""){
        let button=typeof buildPackCardButton==="function"?buildPackCardButton(card,0):null;
        if(!button){
            button=document.createElement("button");button.type="button";button.className="pack-card-btn";
            button.innerHTML=`<div class="pack-card-inner"><div class="pack-icon pack-planet">${esc(cardCost(card))}</div><div class="pack-card-name">${esc(card?.name||"Nieznana karta")}</div><div class="pack-icon pack-star">${esc(cardPower(card))}</div></div>`;
        }
        button.type="button";button.tabIndex=-1;button.classList.add("spx-blackcat-display-pack-card");
        String(extraClass||"").split(/\s+/).filter(Boolean).forEach(name=>button.classList.add(name));
        button.setAttribute("aria-label",`${card?.name||"Nieznana karta"}, Koszt ${cardCost(card)}, Siła ${cardPower(card)}`);
        button.onclick=event=>event?.preventDefault?.();return button;
    }
    function targetKey(target){return `${target.targetPlayerIndex}:${target.targetCardInstanceId||target.targetCardIndex}`;}
    function sacrificeKey(sacrifice){return `${sacrifice.playerIndex}:${sacrifice.cardInstanceId||sacrifice.cardIndex}`;}
    function buildTargetCardButton(target,targetIndex){
        const key=targetKey(target),selected=state.selectedTarget&&targetKey(state.selectedTarget)===key;
        let button=typeof buildPackCardButton==="function"?buildPackCardButton(target.card,targetIndex):null;
        if(!button){
            button=document.createElement("button");button.type="button";button.className="pack-card-btn";
            button.innerHTML=`<div class="pack-card-inner"><div class="pack-icon pack-planet">${esc(cardCost(target.card))}</div><div class="pack-card-name">${esc(target.card?.name||"Nieznana karta")}</div><div class="pack-icon pack-star">${esc(cardPower(target.card))}</div></div>`;
        }
        button.type="button";button.classList.add("spx-blackcat-target-card-native");
        if(selected) button.classList.add("is-selected");
        button.setAttribute("aria-pressed",selected?"true":"false");
        button.dataset.key=key;button.setAttribute("aria-label",`Galeria gracza: ${target.targetPlayerName||"rywal"}, karta ${target.card?.name||"Nieznana karta"}`);
        button.onclick=event=>{event?.preventDefault?.();event?.stopPropagation?.();state.selectedTarget=state.targets.find(candidate=>targetKey(candidate)===key)||null;renderTargetSelection();};
        const marker=document.createElement("img");marker.className="spx-blackcat-target-marker";marker.src="draft-assets/blackcatpowerslogo.png?v=3-bolt";marker.alt="";marker.setAttribute("aria-hidden","true");button.appendChild(marker);
        const label=document.createElement("span");label.className="spx-blackcat-target-card-label";label.textContent=selected?"WYBRANY EKSPONAT":"OZNACZ EKSPONAT";button.appendChild(label);
        return button;
    }
    function buildSacrificeCardButton(sacrifice,sacrificeIndex){
        const key=sacrificeKey(sacrifice),selected=state.selectedSacrifice&&sacrificeKey(state.selectedSacrifice)===key;
        let button=typeof buildPackCardButton==="function"?buildPackCardButton(sacrifice.card,sacrificeIndex):null;
        if(!button){
            button=document.createElement("button");button.type="button";button.className="pack-card-btn";
            button.innerHTML=`<div class="pack-card-inner"><div class="pack-icon pack-planet">${esc(cardCost(sacrifice.card))}</div><div class="pack-card-name">${esc(sacrifice.card?.name||"Nieznana karta")}</div><div class="pack-icon pack-star">${esc(cardPower(sacrifice.card))}</div></div>`;
        }
        button.type="button";button.classList.add("spx-blackcat-target-card-native","is-own-sacrifice");
        if(selected) button.classList.add("is-selected");
        button.setAttribute("aria-pressed",selected?"true":"false");
        button.dataset.sacrificeKey=key;button.setAttribute("aria-label",`Twoja galeria, karta ${sacrifice.card?.name||"Nieznana karta"}. ${selected?"Wybrana do warunkowej podmiany":"Oznacz do warunkowej podmiany"}.`);
        button.onclick=event=>{event?.preventDefault?.();event?.stopPropagation?.();state.selectedSacrifice=state.sacrifices.find(candidate=>sacrificeKey(candidate)===key)||null;renderTargetSelection();};
        const marker=document.createElement("img");marker.className="spx-blackcat-target-marker";marker.src="draft-assets/blackcatpowerslogo.png?v=3-bolt";marker.alt="";marker.setAttribute("aria-hidden","true");button.appendChild(marker);
        const cross=document.createElement("span");cross.className="spx-blackcat-sacrifice-x";cross.textContent="×";cross.setAttribute("aria-hidden","true");button.appendChild(cross);
        const label=document.createElement("span");label.className="spx-blackcat-target-card-label";label.textContent=selected?"KARTA DO PODMIANY":"POŚWIĘĆ PRZY SUKCESIE";button.appendChild(label);
        return button;
    }
    function renderTargetSelection(){
        state.phase="target";
        setOverlayMode("target");
        setHeader(`${state.playerName}: wybierz własną kartę do warunkowej podmiany i bezcenny eksponat rywala.`,`<span><small>FAZA</small><b>REKONESANS</b></span>`);
        const groups=playersList().map((name,index)=>({name,index,targets:state.targets.filter(target=>target.targetPlayerIndex===index)})).filter(group=>group.targets.length);
        const content=overlay().querySelector("#spxBlackCatContent");
        content.innerHTML=`<section class="spx-blackcat-target-stage"><div class="spx-blackcat-target-copy"><img src="draft-assets/blackcatpowershero.png?v=2-alpha" alt="Black Cat"><div><span>BLACK CAT CZEKA NA SKOK</span><h3>ZAPLANUJ KOCI HEIST</h3><p>Wybierz kartę ze swojej kolekcji oraz główny eksponat rywala. Twoja karta zostanie poświęcona tylko wtedy, gdy Black Cat dotrze do najgłębszej gabloty.</p></div></div><div class="spx-blackcat-target-groups"><section class="spx-blackcat-player-gallery spx-blackcat-own-gallery gallery-variant-1" style="--bc-wall:url('${GALLERY_WALLS[0]}')"><h4><span>TWOJA GALERIA:</span> <b>${esc(state.playerName)}</b><small>CO POŚWIĘCISZ ZE SWOJEJ KOLEKCJI?</small></h4><div class="spx-blackcat-target-cards" data-own-gallery aria-label="Twoje karty do warunkowej podmiany"></div></section>${groups.map((group,groupIndex)=>`<section class="spx-blackcat-player-gallery gallery-variant-${((groupIndex+1)%GALLERY_WALLS.length)+1}" style="--bc-wall:url('${GALLERY_WALLS[(groupIndex+1)%GALLERY_WALLS.length]}')"><h4><span>GALERIA GRACZA:</span> <b>${esc(group.name)}</b></h4><div class="spx-blackcat-target-cards" data-gallery-player="${group.index}" aria-label="Karty gracza ${esc(group.name)}"></div></section>`).join("")}</div></section>`;
        const ownRoot=content.querySelector("[data-own-gallery]");state.sacrifices.forEach((sacrifice,index)=>ownRoot?.appendChild(buildSacrificeCardButton(sacrifice,index)));
        groups.forEach(group=>{const root=content.querySelector(`[data-gallery-player="${group.index}"]`);group.targets.forEach((target,targetIndex)=>root?.appendChild(buildTargetCardButton(target,targetIndex)));});
        setHint("Karta rywala zostanie podmieniona na początku napadu. Twoja wybrana karta pozostaje bezpieczna, jeśli Black Cat nie zdobędzie głównego eksponatu.");
        setActions([{label:"ROZPOCZNIJ KOCI HEIST",className:"primary",disabled:!state.selectedTarget||!state.selectedSacrifice,onClick:confirmTarget}]);
    }
    function locateSelectedTarget(){
        const target=state.selectedTarget,deck=decksList()[target?.targetPlayerIndex]||[];
        let index=target?.targetCardInstanceId?deck.findIndex(card=>card?.instanceId===target.targetCardInstanceId):-1;
        if(index<0&&deck[target?.targetCardIndex]&&norm(deck[target.targetCardIndex]?.name)===norm(target.card?.name)) index=target.targetCardIndex;
        return {deck,index,card:index>=0?deck[index]:null};
    }
    function locateSelectedSacrifice(){
        const sacrifice=state.selectedSacrifice,deck=decksList()[state.playerIndex]||[];
        let index=sacrifice?.cardInstanceId?deck.findIndex(card=>card?.instanceId===sacrifice.cardInstanceId):-1;
        if(index<0&&deck[sacrifice?.cardIndex]&&norm(deck[sacrifice.cardIndex]?.name)===norm(sacrifice.card?.name)) index=sacrifice.cardIndex;
        return {deck,index,card:index>=0?deck[index]:null};
    }
    function commitImmediateDisruption(){
        const live=locateSelectedTarget();
        if(!live.card||!isCardMutable(state.selectedTarget.targetPlayerIndex,live.index,"replace",state.playerIndex)) return {ok:false,reason:"Wybrany eksponat zmienił się przed rozpoczęciem napadu."};
        const sacrifice=locateSelectedSacrifice();
        if(!sacrifice.card||!isCardMutable(state.playerIndex,sacrifice.index,"replace",state.playerIndex)) return {ok:false,reason:"Wybrana karta z galerii Black Cat nie jest już dostępna do podmiany."};
        const candidates=replacementTemplates(state.selectedTarget.targetPlayerIndex,live.index,live.card,99),template=shuffled(candidates)[0];
        if(!template) return {ok:false,reason:"Nie ma już dostępnego zamiennika o tym samym Koszcie."};
        const activation=global.SuperpowerEngine?.completeActivation?.(state.playerName,POWER_ID,{result:"heist_started",targetPlayer:state.selectedTarget.targetPlayerName,targetCard:live.card.name,sacrificeCard:sacrifice.card.name,economyEnabled:economyEnabled(),packNumber:typeof packStartIndex!=="undefined"?packStartIndex+1:null,pickIndex:typeof currentPickIndex!=="undefined"?currentPickIndex:null})||{ok:false,reason:"Silnik Supermocy jest niedostępny."};
        if(!activation.ok) return activation;
        const replacement=makeCard(template,{origin:"black_cat_soft_landing",sourceEvent:"black_cat_same_cost_replacement"}),stolen=live.card;
        replacement.instanceMeta={...(replacement.instanceMeta||{}),blackCatSoftLanding:true,replacedStolenInstanceId:stolen.instanceId||null};
        stolen.instanceMeta={...(stolen.instanceMeta||{}),blackCatStolen:true,stolenFromPlayerIndex:state.selectedTarget.targetPlayerIndex,stolenFromPlayerName:state.selectedTarget.targetPlayerName,heistOwner:state.playerName};
        live.deck[live.index]=replacement;state.stolenCard=stolen;state.replacementCard=replacement;state.activationCommitted=true;
        const stored=global.draftSuperpowers?.[state.playerName];if(stored){stored.used=true;stored.status="used";}
        global.DevilDinoUI?.notifyHostileDeckChange?.({targetPlayerIndex:state.selectedTarget.targetPlayerIndex,targetCardInstanceId:replacement.instanceId||null,previousCardInstanceId:stolen.instanceId||null,previousCardName:stolen.name,replacementCardName:replacement.name,powerId:POWER_ID,reason:"black_cat_heist"});
        global.DraftStateEngine?.log?.("black_cat_exhibit_swapped",{packNumber:typeof packStartIndex!=="undefined"?packStartIndex+1:null,pickIndex:typeof currentPickIndex!=="undefined"?currentPickIndex:null,playerIndex:state.playerIndex,player:state.playerName,sourceCard:stolen,resultCard:replacement,reason:"black_cat_heist",data:{victimPlayerIndex:state.selectedTarget.targetPlayerIndex,victimPlayerName:state.selectedTarget.targetPlayerName,sameCost:cardCost(stolen)}});
        if(typeof showDecks==="function") showDecks();
        return {ok:true,stolen,replacement};
    }
    function confirmTarget(){
        if(!state.selectedTarget||!state.selectedSacrifice||state.processing) return;state.processing=true;
        const result=commitImmediateDisruption();state.processing=false;
        if(!result.ok){notify("error","NIE UDAŁO SIĘ PRZYGOTOWAĆ NAPADU",result.reason||"Spróbuj ponownie.");state.targets=eligibleTargets(state.playerIndex);state.sacrifices=eligibleSacrifices(state.playerIndex);state.selectedTarget=null;state.selectedSacrifice=null;renderTargetSelection();return;}
        state.session=Engine.createSession({economyEnabled:economyEnabled(),target:state.stolenCard});state.notice=`${state.stolenCard.name} czeka w głównej gablocie. Światło pokazuje łupy, ale lasery pozostają niewidoczne.`;renderHeist();
    }
    function rewardIcon(reward){return reward?.icon||REWARD_DEFS[reward?.type]?.icon||"";}
    function rewardVitrine(reward,collected=false){
        if(!reward) return "";
        return `<span class="spx-blackcat-vitrine ${collected?"is-collected":""}"><img src="draft-assets/blackcat_heist_vitrine.png" alt=""><span>${rewardIcon(reward)?`<img src="${esc(rewardIcon(reward))}" alt="">`:`<b>✦</b>`}<small>${esc(reward.short||reward.label)}</small></span>${collected?`<em>W TORBIE</em>`:""}</span>`;
    }
    function legendItems(){
        const base=state.session?.economyEnabled
            ? [REWARD_DEFS.coin_1,REWARD_DEFS.coin_2,REWARD_DEFS.safe_key]
            : [REWARD_DEFS.stolen_access];
        return [...base,REWARD_DEFS.exhibit,...Object.entries(GEM_DEFS).map(([type,def])=>({...def,type:"gem",gemType:type}))];
    }
    function tooltipButton(item,extra=""){
        const icon=item.icon||rewardIcon(item);return `<button type="button" class="spx-blackcat-legend-item ${extra}" data-tooltip="${esc(item.tooltip||"")}" aria-label="${esc(item.label)}: ${esc(item.tooltip||"")}">${icon?`<img src="${esc(icon)}" alt="">`:`<b>★</b>`}<span>${esc(item.short||item.label)}</span></button>`;
    }
    function legendVitrineItem(item){
        const isExhibit=item.type==="exhibit",icon=item.icon||rewardIcon(item);
        const art=isExhibit&&state.stolenCard?`<span class="spx-blackcat-legend-card-slot"></span>`:icon?`<img src="${esc(icon)}" alt="">`:`<b>★</b>`;
        return `<button type="button" class="spx-blackcat-legend-item spx-blackcat-legend-vitrine-item ${item.gemType?`gem-${esc(item.gemType)}`:""}" data-tooltip="${esc(item.tooltip||"")}" aria-label="${esc(item.label)}: ${esc(item.tooltip||"")}"><span class="spx-blackcat-legend-vitrine-art"><img class="spx-blackcat-legend-case" src="draft-assets/blackcat_heist_vitrine.png" alt=""><span class="spx-blackcat-legend-reward">${art}</span></span><span class="spx-blackcat-legend-copy"><b>${esc(item.label||item.short)}</b><small>${esc(item.tooltip||"")}</small></span></button>`;
    }
    function coinAmount(item){
        if(!item) return 0;
        if(item.type==="coin_1") return 1;
        if(item.type==="coin_2") return 2;
        return item.type==="coin_stack"?Math.max(0,Number(item.amount)||0):0;
    }
    function coinLabel(amount){
        const value=Math.max(0,Number(amount)||0);
        if(value===1) return "1 JEFFCOIN";
        if(value>=2&&value<=4) return `${value} JEFFCOINY`;
        return `${value} JEFFCOINÓW`;
    }
    function stackedCoinReward(amount){
        const value=Math.max(0,Number(amount)||0);
        return {...REWARD_DEFS.coin_1,type:"coin_stack",amount:value,label:coinLabel(value),short:`+${value} JC`,tooltip:`Łącznie ${value} JeffCoin${value===1?"":"ów"} zdobytych podczas tego napadu.`};
    }
    function stackLootItems(items=[]){
        let coins=0;const other=[];
        (items||[]).forEach(item=>{const amount=coinAmount(item);if(amount) coins+=amount;else other.push(item);});
        return coins?[stackedCoinReward(coins),...other]:other;
    }
    function stackRewardResults(results=[]){
        let coins=0;const other=[];
        (results||[]).forEach(result=>{const amount=coinAmount(result?.reward);if(amount&&result.ok!==false) coins+=amount;else other.push(result);});
        return coins?[{ok:true,reward:stackedCoinReward(coins),label:`+${coins} JC`} ,...other]:other;
    }
    function floatingTooltip(){
        let tip=document.getElementById("spxBlackCatFloatingTooltip");
        if(!tip){tip=document.createElement("div");tip.id="spxBlackCatFloatingTooltip";tip.className="spx-blackcat-floating-tooltip";tip.setAttribute("role","tooltip");tip.hidden=true;document.body.appendChild(tip);}
        return tip;
    }
    function hideFloatingTooltip(force=false){
        const tip=document.getElementById("spxBlackCatFloatingTooltip");
        if(!tip||(!force&&tip.dataset.locked==="true")) return;
        tip.hidden=true;tip.dataset.locked="false";tip.textContent="";
    }
    function showFloatingTooltip(button,locked=false){
        const message=String(button?.dataset?.tooltip||"").trim();if(!message)return;
        const tip=floatingTooltip(),rect=button.getBoundingClientRect(),gutter=14;
        tip.textContent=message;tip.hidden=false;tip.dataset.locked=locked?"true":"false";
        const measured=tip.getBoundingClientRect();
        let left=rect.left-measured.width-12;
        if(left<gutter) left=rect.right+12;
        left=clamp(left,gutter,Math.max(gutter,global.innerWidth-measured.width-gutter));
        const top=clamp(rect.top+(rect.height-measured.height)/2,gutter,Math.max(gutter,global.innerHeight-measured.height-gutter));
        tip.style.left=`${Math.round(left)}px`;tip.style.top=`${Math.round(top)}px`;
    }
    function bindTooltips(root=overlay()){
        hideFloatingTooltip(true);
        root.querySelectorAll("[data-tooltip]").forEach(button=>{
            const floating=Boolean(button.closest(".spx-blackcat-legend-panel,.spx-blackcat-loot"));
            if(floating){
                button.classList.add("has-floating-tooltip");
                button.addEventListener("mouseenter",()=>showFloatingTooltip(button,false));
                button.addEventListener("mouseleave",()=>hideFloatingTooltip(false));
                button.addEventListener("focus",()=>showFloatingTooltip(button,false));
                button.addEventListener("blur",()=>hideFloatingTooltip(false));
            }
            button.addEventListener("click",event=>{
                event.stopPropagation();const locked=button.classList.toggle("is-tooltip-locked");
                root.querySelectorAll("[data-tooltip].is-tooltip-locked").forEach(other=>{if(other!==button)other.classList.remove("is-tooltip-locked");});
                if(floating){if(locked)showFloatingTooltip(button,true);else hideFloatingTooltip(true);}
                else if(!locked)button.blur();
            });
        });
    }
    function renderHeist(){
        state.phase="heist";const session=state.session,snap=Engine.snapshot(session),alarm=session.alarmActive;
        setOverlayMode("heist");
        setHeader(alarm?"Alarm pulsuje. Drugi laser zakończy ucieczkę — zdobyty łup zostanie w torbie.":"Każdy nowy krok kosztuje ruch. Powrót po odkrytej bezpiecznej trasie jest darmowy.",`<div class="spx-blackcat-heist-header-tools"><span class="spx-blackcat-heist-phase ${alarm?"is-alarm":""}"><small>FAZA</small><b>${alarm?"ALARM":"NAPAD"}</b></span></div>`);
        const cells=session.cells.map(cell=>{
            const visited=session.visited.has(cell.index),revealed=session.revealed.has(cell.index),scouted=session.scouted?.has(cell.index),reachable=snap.reachableIndices.includes(cell.index),current=cell.index===session.currentIndex;
            let content="";
            if(cell.kind==="laser"&&visited) content=`<img class="spx-blackcat-laser" src="draft-assets/blackcat_heist_laser.png" alt="Laser">`;
            if(cell.kind==="reward"&&(scouted||cell.collected)) content=rewardVitrine(cell.reward,cell.collected);
            if(cell.kind==="exhibit"&&(scouted||visited)) content=`<span class="spx-blackcat-main-vitrine"><span class="spx-blackcat-board-main-card-slot"></span><small>GŁÓWNY</small></span>`;
            return `<button type="button" class="spx-blackcat-cell ${visited?"is-visited":""} ${revealed?"is-lit":""} ${scouted?"is-scouted":""} ${reachable?"is-reachable":""} ${current?"is-current":""}" data-index="${cell.index}" ${reachable?"":"disabled"}>${content}<span class="spx-blackcat-fog"></span></button>`;
        }).join("");
        const loot=session.collected;
        overlay().querySelector("#spxBlackCatContent").innerHTML=`<section class="spx-blackcat-heist-layout"><div class="spx-blackcat-board-column"><div class="spx-blackcat-board-frame"><img class="spx-blackcat-museum" src="draft-assets/blackcat_heist_museum_topdown.png" alt="Kosmiczne muzeum z góry"><div class="spx-blackcat-grid" style="--bc-rows:${session.rows};--bc-cols:${session.cols}">${cells}</div><span class="spx-blackcat-token-light" style="--bc-row:${coords(session.currentIndex,session.cols).row};--bc-col:${coords(session.currentIndex,session.cols).col};--bc-rows:${session.rows};--bc-cols:${session.cols}"></span><img class="spx-blackcat-token" style="--bc-row:${coords(session.currentIndex,session.cols).row};--bc-col:${coords(session.currentIndex,session.cols).col};--bc-rows:${session.rows};--bc-cols:${session.cols}" src="draft-assets/blackcat_heist_token.png" alt="Black Cat"></div><div class="spx-blackcat-legend"><span>MOŻLIWY ŁUP</span><div>${legendItems().map(item=>tooltipButton(item,item.gemType?`gem-${item.gemType}`:"")).join("")}</div></div></div><aside class="spx-blackcat-heist-sidebar"><section class="spx-blackcat-objective spx-blackcat-curtain-panel"><span>GŁÓWNY EKSPONAT</span><div class="spx-blackcat-objective-card-slot"></div><small>${esc(state.selectedTarget.targetPlayerName)} dostał już ${esc(state.replacementCard.name)}.</small></section><section class="spx-blackcat-security"><span>NOCNY LIMIT</span><b>${session.movesRemaining}</b><p>Pierwszy laser: automatyczny unik. Drugi: ucieczka z całym zebranym łupem.</p></section><section class="spx-blackcat-loot spx-blackcat-curtain-panel"><span>TORBA BLACK CAT</span><ul>${stackLootItems(loot).map(item=>`<li data-tooltip="${esc(item.tooltip||item.label||"")}" aria-label="${esc(item.label)}: ${esc(item.tooltip||"")}">${rewardIcon(item)?`<img src="${esc(rewardIcon(item))}" alt="">`:`<b>✦</b>`}<span>${esc(item.label)}</span></li>`).join("")||`<li class="empty">Torba jest jeszcze pusta.</li>`}</ul></section></aside></section>`;
        const heistRoot=overlay(),heistLayout=heistRoot.querySelector(".spx-blackcat-heist-layout"),boardColumn=heistRoot.querySelector(".spx-blackcat-board-column"),heistSidebar=heistRoot.querySelector(".spx-blackcat-heist-sidebar"),legend=heistRoot.querySelector(".spx-blackcat-legend");
        heistRoot.querySelector(".spx-blackcat-objective-card-slot")?.appendChild(buildDisplayPackCard(state.stolenCard,"spx-blackcat-objective-pack-card"));
        heistRoot.querySelector(".spx-blackcat-board-main-card-slot")?.appendChild(buildDisplayPackCard(state.stolenCard,"spx-blackcat-board-main-pack-card"));
        if(heistLayout&&boardColumn&&heistSidebar){
            heistSidebar.querySelector(".spx-blackcat-security")?.remove();
            const leftRail=document.createElement("aside");
            leftRail.className="spx-blackcat-heist-rail spx-blackcat-heist-left-rail";
            leftRail.innerHTML=`<section class="spx-blackcat-museum-tile"><span>KROKI</span><b>${session.movesRemaining}</b><small>Każdy nowy skok kosztuje ruch.</small></section><section class="spx-blackcat-museum-tile ${alarm?"is-alarm":""}"><span>ALARM</span><b>${alarm?"AKTYWNY":"CICHO"}</b><small>${alarm?"Drugi laser kończy napad z zachowanym łupem.":"Pierwsza wiązka uruchomi kocią zwinność."}</small></section><button type="button" class="spx-blackcat-lantern-tool" aria-label="${session.lanternAvailable?"Użyj Kociej Latarki":"Kocia Latarka została zużyta"}" ${session.lanternAvailable?"":"disabled"}><img src="${ASSET_ROOT}blackcat_cat_lantern.png" alt=""><span>${session.lanternAvailable?"KOCIA LATARKA":"LATARKA ZUŻYTA"}</span></button><section class="spx-blackcat-rail-note"><span>TRASA MUZEUM</span><p>Świecą tylko możliwe skręty i przebyta droga. Zawartość sąsiednich gablot pokaże wyłącznie latarka.</p></section>`;
            heistLayout.insertBefore(leftRail,boardColumn);
            leftRail.querySelector(".spx-blackcat-lantern-tool")?.addEventListener("click",activateLantern);
        }
        if(heistSidebar&&legend){
            legend.className="spx-blackcat-legend-panel";
            legend.innerHTML=`<span>MOŻLIWY ŁUP</span><div>${legendItems().map(item=>legendVitrineItem(item)).join("")}</div>`;
            legend.querySelector(".spx-blackcat-legend-card-slot")?.appendChild(buildDisplayPackCard(state.stolenCard,"spx-blackcat-legend-pack-card"));
            heistSidebar.appendChild(legend);
            const controls=document.createElement("section");
            controls.className="spx-blackcat-heist-controls";
            controls.innerHTML='<p id="spxBlackCatHeistHint"></p>';
            heistSidebar.appendChild(controls);
        }
        overlay().querySelectorAll(".spx-blackcat-cell.is-reachable").forEach(button=>button.addEventListener("click",()=>performMove(Number(button.dataset.index))));bindTooltips();
        setHint(state.notice||"Odkryta gablota pokazuje łup, ale zdobywasz go dopiero po wejściu na dokładne pole.");
    }
    function showEvent(kind,title,message,actions=[]){
        const layer=overlay().querySelector("#spxBlackCatEvent");layer.hidden=false;const laserVariant=kind==="laser"?(String(title||"").includes("SUPER")?" laser-dodge":" laser-hit"):"";layer.className=`spx-blackcat-event ${kind||""}${laserVariant}`;
        const image=kind==="laser"?"draft-assets/blackcat_heist_laser.png":"draft-assets/blackcatpowerslogo.png?v=3-bolt";
        const visual=kind==="success"&&state.stolenCard
            ?`<div class="spx-blackcat-event-exhibit"><img src="draft-assets/blackcat_heist_vitrine.png" alt=""><span class="spx-blackcat-event-card-slot"></span></div>`
            :`<img src="${image}" alt="">`;
        layer.innerHTML=`<section>${visual}<span>KOCI HEIST</span><h3>${esc(title)}</h3><p>${esc(message)}</p><div class="spx-blackcat-event-actions"></div></section>`;
        layer.querySelector(".spx-blackcat-event-card-slot")?.appendChild(buildDisplayPackCard(state.stolenCard,"spx-blackcat-event-pack-card"));
        const root=layer.querySelector(".spx-blackcat-event-actions");actions.forEach(action=>{const button=document.createElement("button");button.type="button";button.className=`spx-blackcat-action ${action.className||""}`;button.textContent=action.label;button.addEventListener("click",()=>{layer.hidden=true;action.onClick?.();});root.appendChild(button);});
    }
    function animateLootPickup(index,reward){
        const source=overlay().querySelector(`.spx-blackcat-cell[data-index="${Number(index)}"]`),rect=source?.getBoundingClientRect?.();
        if(!rect)return;
        const ghost=document.createElement("span");ghost.className="spx-blackcat-loot-flight";
        const icon=rewardIcon(reward);ghost.innerHTML=icon?`<img src="${esc(icon)}" alt="">`:`<b>✦</b>`;
        ghost.style.setProperty("--bc-from-x",`${rect.left+rect.width/2}px`);ghost.style.setProperty("--bc-from-y",`${rect.top+rect.height/2}px`);
        ghost.style.setProperty("--bc-to-x",`${Math.max(60,global.innerWidth-170)}px`);ghost.style.setProperty("--bc-to-y",`${Math.max(100,global.innerHeight*.56)}px`);
        document.body.appendChild(ghost);global.setTimeout(()=>ghost.remove(),920);
    }
    function showLootPickup(reward){
        if(!reward) return;
        const modal=overlay().querySelector(".spx-blackcat-modal");if(!modal)return;
        modal.querySelector(".spx-blackcat-loot-pop")?.remove();
        const pop=document.createElement("div");pop.className="spx-blackcat-loot-pop";
        const icon=rewardIcon(reward);
        pop.innerHTML=`<div class="spx-blackcat-loot-pop-card"><span>ŁUP ZDOBYTY</span>${icon?`<img src="${esc(icon)}" alt="">`:`<b>✦</b>`}<strong>${esc(reward.label||reward.short||"TROFEUM")}</strong><small>${esc(reward.tooltip||"Trofeum trafia do torby Black Cat.")}</small></div>`;
        modal.appendChild(pop);global.setTimeout(()=>pop.remove(),2350);
    }
    function activateLantern(){
        if(state.processing||!state.session) return;
        const result=Engine.useLantern(state.session);
        if(!result.ok){state.notice=result.reason;renderHeist();return;}
        state.notice="Kocia latarka na stałe oznaczyła osiem sąsiednich pól i ujawniła znajdujące się tam nagrody. Lasery pozostały niewidoczne.";
        renderHeist();
    }
    function performMove(index){
        if(state.processing) return;state.processing=true;const event=Engine.move(state.session,index);state.processing=false;
        if(!event.ok){state.notice=event.reason;renderHeist();return;}
        if(event.backtrack) state.notice="Black Cat wraca po własnych śladach — licznik ruchów nie spada.";
        else if(event.reward){animateLootPickup(index,event.reward);state.notice=event.accessReveal?"Skradziony dostęp rozświetla dalsze gabloty.":`Łup zdobyty: ${event.reward.label}.`;}
        else if(event.kind==="empty") state.notice="Cichy krok. W świetle lampy nie ma gabloty.";
        renderHeist();
        if(event.reward) showLootPickup(event.reward);
        if(event.luckyEscape) showEvent("laser","SUPER REFLEKS!","Pierwsza wiązka musnęła futro. Black Cat przeskakuje nad laserem, alarm zaczyna pulsować, ale niczego nie traci.",[{label:"BIEGNĘ DALEJ",className:"primary",onClick:()=>renderHeist()}]);
        else if(event.caught) showEvent("laser","DRUGI LASER — UCIECZKA!","Muzeum zamyka korytarze. Black Cat wymyka się przez dach i zachowuje wszystko, co już trafiło do torby.",[{label:"PODSUMUJ ŁUP",className:"danger",onClick:beginSettlement}]);
        else if(event.success) showEvent("success","GŁÓWNY EKSPONAT ZDOBYTY","Najgłębsza gablota pęka. Skradziona karta należy do Black Cat — czas zniknąć w świetle księżyca.",[{label:"OTWÓRZ TORBĘ",className:"primary",onClick:beginSettlement}]);
        else if(event.exhausted) showEvent("","CZAS MINĄŁ","Black Cat opuszcza muzeum z całym zdobytym łupem. Główny eksponat pozostaje w nocnej galerii.",[{label:"PODSUMUJ ŁUP",className:"primary",onClick:beginSettlement}]);
    }
    function requestCashOut(){
        const result=Engine.cashOut(state.session);if(!result.ok){state.notice=result.reason;renderHeist();return;}
        showEvent("success","CICHY ODWRÓT",`Black Cat znika z ${result.loot.length} zdobytymi trofeami.`,[{label:"OTWÓRZ TORBĘ",className:"primary",onClick:beginSettlement}]);
    }
    function archiveMuseumCard(reason){
        if(!state.stolenCard||state.mainResult?.ok) return null;
        return typeof archiveCardToGraveyard==="function"?archiveCardToGraveyard("temporaryRemoved",state.stolenCard,{source:"black_cat_museum",reason,powerId:POWER_ID,previousOwner:state.selectedTarget.targetPlayerIndex,recoverable:false,skipGrootHarvest:true,metadata:{heistOwner:state.playerName,mainExhibitMissed:true}}):null;
    }
    function secureMainExhibit(){
        const actorDeck=decksList()[state.playerIndex];if(!Array.isArray(actorDeck)||!state.stolenCard) return {ok:false,reason:"Główny eksponat nie jest dostępny."};
        const stolen=state.stolenCard;
        if(actorDeck.some(card=>norm(card?.name)===norm(stolen.name))) return {ok:false,reason:"Black Cat ma już kartę o tej nazwie."};
        const sacrifice=locateSelectedSacrifice();
        if(!sacrifice.card||!isCardMutable(state.playerIndex,sacrifice.index,"replace",state.playerIndex)) return {ok:false,reason:"Wybrana karta do poświęcenia nie jest już dostępna."};
        const displaced=sacrifice.card;
        if(typeof archiveCardToGraveyard==="function") archiveCardToGraveyard("sacrificed",displaced,{source:"black_cat_main_exhibit",reason:"black_cat_chosen_sacrifice",powerId:POWER_ID,previousOwner:state.playerIndex,recoverable:true,metadata:{replacementCardInstanceId:stolen.instanceId||null,chosenBeforeHeist:true}});
        actorDeck[sacrifice.index]=stolen;state.sacrificedCard=displaced;
        global.DraftStateEngine?.log?.("black_cat_main_exhibit_secured",{packNumber:typeof packStartIndex!=="undefined"?packStartIndex+1:null,pickIndex:typeof currentPickIndex!=="undefined"?currentPickIndex:null,playerIndex:state.playerIndex,player:state.playerName,sourceCard:displaced,resultCard:stolen,reason:"black_cat_heist",data:{victimPlayerIndex:state.selectedTarget.targetPlayerIndex,sacrificedCardName:displaced.name,sacrificedCardInstanceId:displaced.instanceId||null,sacrificeIndex:sacrifice.index,deckSize:actorDeck.length}});
        return {ok:true,stolenCard:stolen,replacementCard:state.replacementCard,sacrificedCard:displaced};
    }
    function applyCoin(amount,reward){
        const result=global.EconomyEngine?.credit?.(state.playerIndex,amount,{kind:"bonus",reason:"black_cat_heist",packNumber:typeof packStartIndex!=="undefined"?packStartIndex+1:null,pickIndex:typeof currentPickIndex!=="undefined"?currentPickIndex:null,data:{powerId:POWER_ID,rewardId:reward.rewardId}});
        return result?.ok?{ok:true,label:`+${amount} JC`}:{ok:false,reason:result?.reason||"Economy jest wyłączone."};
    }
    function applySafeKey(reward){
        const wallets=playersList().map((name,index)=>({name,index,wallet:global.EconomyEngine?.getWallet?.(index)})).filter(entry=>entry.index!==state.playerIndex&&Number(entry.wallet?.balance||0)>=1);
        const victim=shuffled(wallets)[0];
        if(victim){
            const debit=global.EconomyEngine?.debit?.(victim.index,1,{reason:"black_cat_safe_key",data:{powerId:POWER_ID,thiefPlayerIndex:state.playerIndex}});
            if(debit?.ok){global.EconomyEngine?.credit?.(state.playerIndex,1,{kind:"bonus",reason:"black_cat_safe_key",data:{powerId:POWER_ID,victimPlayerIndex:victim.index}});return {ok:true,label:`+1 JC dla Black Cat • ${victim.name} traci 1 JC`};}
        }
        return applyCoin(1,reward).ok?{ok:true,label:"+1 JC z pustego sejfu"}:{ok:false,reason:"Nie udało się otworzyć sejfu."};
    }
    function applyGem(reward){
        const asset=global.SuperpowerEngine?.createRuntimeAsset?.(state.playerName,"black_cat_gem",{powerId:POWER_ID,playerIndex:state.playerIndex,gemType:reward.gemType,label:reward.label,icon:reward.icon,tooltip:reward.tooltip,rewardId:reward.rewardId,createdPack:typeof packStartIndex!=="undefined"?packStartIndex+1:null});
        return asset?{ok:true,label:`${reward.label} czeka przy kolejnym picku.`,assetId:asset.assetId}:{ok:false,reason:"Nie udało się schować klejnotu."};
    }
    function beginSettlement(){
        if(state.settled||state.phase==="summary") return;state.settled=true;state.phase="settlement";
        state.mainResult=state.session.status==="success"?secureMainExhibit():{ok:false,reason:"Główny eksponat pozostał w muzeum."};
        if(!state.mainResult.ok) archiveMuseumCard(state.session.status);
        state.rewardResults=(state.session.finalLoot||[]).map(reward=>{
            let result;if(reward.type==="coin_1") result=applyCoin(1,reward);else if(reward.type==="coin_2") result=applyCoin(2,reward);else if(reward.type==="safe_key") result=applySafeKey(reward);else if(reward.type==="gem") result=applyGem(reward);else result={ok:true,label:"Rozliczono"};
            return {reward,...result};
        });
        global.superpowerLog=global.superpowerLog||[];global.superpowerLog.push({type:"superpower_activation",event:"black_cat_heist",playerName:state.playerName,playerIndex:state.playerIndex,powerId:POWER_ID,powerName:"KOCI HEIST",outcome:state.session.status,mainExhibit:state.mainResult.ok?state.stolenCard?.name:null,sacrificedCard:state.mainResult.ok?state.sacrificedCard?.name:null,targetPlayer:state.selectedTarget.targetPlayerName,loot:state.rewardResults.map(item=>item.reward.type),economyEnabled:state.session.economyEnabled,timestamp:new Date().toISOString()});
        if(typeof showDecks==="function") showDecks();showSummary();
    }
    function bagItems(){
        const items=stackRewardResults(state.rewardResults).filter(result=>result.ok).map(result=>result.reward);if(state.mainResult?.ok) items.push({...REWARD_DEFS.exhibit,icon:null});return items;
    }
    function animateReturnToDraft(){
        const modal=overlay().querySelector(".spx-blackcat-modal");if(!modal||modal.querySelector(".spx-blackcat-return-streak")) return;
        const streak=document.createElement("div");streak.className="spx-blackcat-return-streak";
        streak.innerHTML=`<span class="spx-blackcat-return-trail"></span><img class="spx-blackcat-return-cat" src="draft-assets/blackcat_heist_token.png" alt="Black Cat"><img class="spx-blackcat-return-loot loot-1" src="draft-assets/jeffcoin.png" alt=""><img class="spx-blackcat-return-loot loot-2" src="draft-assets/blackcat_gem_echo.png" alt=""><img class="spx-blackcat-return-loot loot-3" src="draft-assets/jeffcoin.png" alt=""><img class="spx-blackcat-return-loot loot-4" src="draft-assets/blackcat_gem_shadow.png" alt="">`;
        modal.appendChild(streak);global.setTimeout(reset,1050);
    }
    function showSummary(){
        state.phase="summary";const mainOk=Boolean(state.mainResult?.ok),items=bagItems(),escaped=state.session.status!=="success";
        setOverlayMode("summary");
        setHeader(mainOk?"Black Cat znika z bezcennym eksponatem.":"Black Cat wymyka się z tym, co zdążyła schować.",`<span><small>WYNIK</small><b>${mainOk?"WIELKI ŁUP":"UCIECZKA"}</b></span>`);
        const resultRows=stackRewardResults(state.rewardResults).map(result=>`<li class="${result.ok?"ok":"miss"}" data-tooltip="${esc(result.reward.tooltip||result.label||result.reason||"")}">${rewardIcon(result.reward)?`<img src="${esc(rewardIcon(result.reward))}" alt="">`:`<b>✦</b>`}<span>${esc(result.reward.label)}<small>${esc(result.label||result.reason||"")}</small></span></li>`).join("");
        const bagLoot=items.map((item,index)=>rewardIcon(item)?`<img class="${item.type==="gem"?"is-gem":""}" src="${esc(rewardIcon(item))}" alt="" style="--loot-i:${index}">`:mainOk?`<span class="spx-blackcat-bag-card-slot"></span>`:"").join("");
        overlay().querySelector("#spxBlackCatContent").innerHTML=`<section class="spx-blackcat-summary ${escaped?"is-escape":"is-vault"}" style="--bc-summary-bg:url('draft-assets/blackcat_escape_night_museum.png')"><div class="spx-blackcat-summary-copy"><span>OPERACJA ZAKOŃCZONA</span><h3>${mainOk?"GŁÓWNY EKSPONAT ZDOBYTY":"NOCNY ŁUP OCALONY"}</h3>${mainOk?`<div class="spx-blackcat-main-result"><div class="spx-blackcat-summary-card-slot"></div><p><b>${esc(state.stolenCard.name)}</b> zastępuje w galerii Black Cat kartę <b>${esc(state.sacrificedCard?.name||"")}</b>. <b>${esc(state.selectedTarget.targetPlayerName)}</b> ma już zamiennik: <b>${esc(state.replacementCard.name)}</b>.</p></div>`:`<p class="spx-blackcat-main-miss">${esc(state.mainResult.reason)} Wybrana karta <b>${esc(state.selectedSacrifice?.card?.name||"")}</b> pozostaje w Twojej galerii.</p>`}<ul>${resultRows||`<li class="miss"><b>—</b><span>Torba jest pusta</span></li>`}</ul></div><div class="spx-blackcat-summary-safe-art" aria-hidden="true"><img src="draft-assets/blackcat_heist_vault_success.png" alt=""></div><div class="spx-blackcat-summary-bag"><img src="draft-assets/blackcat_loot_bag.png" alt="Torba Black Cat"><div class="spx-blackcat-bag-loot">${bagLoot}</div><strong>${items.length?`${items.length} TROFEÓW`:"PUSTA TORBA"}</strong></div></section>`;
        if(mainOk){
            overlay().querySelector(".spx-blackcat-summary-card-slot")?.appendChild(buildDisplayPackCard(state.stolenCard,"spx-blackcat-summary-pack-card"));
            overlay().querySelector(".spx-blackcat-bag-card-slot")?.appendChild(buildDisplayPackCard(state.stolenCard,"spx-blackcat-bag-pack-card"));
        }
        bindTooltips();setHint("Zwinna kotka zdążyła wybiec z muzeum z tym, co schowała po drodze.");setActions([{label:"WRÓĆ DO DRAFTU",className:"primary",onClick:animateReturnToDraft}]);
        if(typeof showDecks==="function")showDecks();if(typeof updateRoundQueueDisplay==="function")updateRoundQueueDisplay();if(typeof updateInfoPanel==="function")updateInfoPanel();
    }
    function attemptClose(){
        if(!state.active) return;
        if(state.phase==="target"){reset();return;}
        if(state.phase==="summary"){reset();return;}
        notify("warning","NAPAD TRWA","Po podmianie eksponatu Black Cat musi dokończyć trasę albo uciec ze zdobytym łupem.");
    }
    function reset(){
        const node=document.getElementById("spxBlackCatOverlay");if(node)node.hidden=true;hideFloatingTooltip(true);document.body.classList.remove("spx-blackcat-active");
        Object.assign(state,{active:false,phase:"idle",playerName:"",playerIndex:-1,targets:[],sacrifices:[],selectedTarget:null,selectedSacrifice:null,session:null,processing:false,activationCommitted:false,stolenCard:null,replacementCard:null,sacrificedCard:null,mainResult:null,rewardResults:[],notice:"",settled:false,wallVariant:0});
        if(typeof showDecks==="function")showDecks();
    }
    function start(playerName){
        const check=preflight(playerName);if(!check.ok){notify("warning","MUZEUM POZOSTAJE ZAMKNIĘTE",check.message);return false;}
        Object.assign(state,{active:true,phase:"target",playerName:String(playerName),playerIndex:check.playerIndex,targets:check.targets,sacrifices:check.sacrifices,selectedTarget:null,selectedSacrifice:null,activationCommitted:false,sacrificedCard:null,settled:false});
        const node=ensureOverlay();node.hidden=false;document.body.classList.add("spx-blackcat-active");renderTargetSelection();return true;
    }

    function eventLog(){return global.DraftStateEngine?.getState?.()?.eventLog||global.DraftStateEngine?.exportState?.()?.eventLog||[];}
    function actorDeck(playerIndex){return decksList()[playerIndex]||[];}
    function legalTemplates(playerIndex){
        const owned=new Set(actorDeck(playerIndex).map(card=>norm(card?.name))),banned=new Set(bannedList().map(norm));
        return cardsList().filter(card=>card&&!card.joker&&card.name&&!owned.has(norm(card.name))&&!banned.has(norm(card.name))&&Number.isFinite(Number(card.cost))&&Number.isFinite(Number(card.power)));
    }
    let synergyAllowedTagIdsCache=null;
    function synergyAllowedTagIds(){
        if(synergyAllowedTagIdsCache)return synergyAllowedTagIdsCache;
        const allowed=new Set(),source=typeof TAGS!=="undefined"&&TAGS&&typeof TAGS==="object"?TAGS:global.TAGS;
        ["mechanicFamilies","subtypes","deckArchetypes"].forEach(category=>{
            (Array.isArray(source?.[category])?source[category]:[]).forEach(entry=>{
                const id=norm(typeof entry==="string"?entry:entry?.id);
                if(id)allowed.add(id);
            });
        });
        return synergyAllowedTagIdsCache=allowed;
    }
    function synergyTagValues(card){
        const allowed=synergyAllowedTagIds(),values=[];
        const add=value=>{
            if(Array.isArray(value)){value.forEach(add);return;}
            const id=norm(value);if(id&&allowed.has(id)&&!values.includes(id))values.push(id);
        };
        add(Array.isArray(card?.tags)?card.tags:[]);add(card?.archetype);add(card?.archetypes);add(card?.subtype);add(card?.subtypes);
        return values;
    }
    function tagSet(card){return new Set(synergyTagValues(card));}
    function cardTagLabels(card){
        const labels=synergyTagValues(card),seen=new Set();
        return labels.map(label=>String(label||"").trim()).filter(label=>{const key=norm(label);if(!key||seen.has(key))return false;seen.add(key);return true;});
    }
    function strongestSharedTag(card,anchors){
        const counts=new Map();
        (anchors||[]).forEach(anchor=>cardTagLabels(anchor).forEach(label=>{const key=norm(label);counts.set(key,(counts.get(key)||0)+1);}));
        return cardTagLabels(card).filter(label=>counts.has(norm(label))).sort((a,b)=>(counts.get(norm(b))||0)-(counts.get(norm(a))||0))[0]||"";
    }
    function scoreShared(card,anchors){
        const tags=tagSet(card);let score=0;(anchors||[]).forEach(anchor=>{tagSet(anchor).forEach(tag=>{if(tags.has(tag))score+=4;});if(cardCost(card)===cardCost(anchor))score+=1;});return score+Math.random();
    }
    function isNormalPickEvent(event){return event?.type==="card_picked"||event?.type==="draft_card_picked"||event?.type==="galactic_current_pick";}
    function normalPicksChronological(){return eventLog().filter(isNormalPickEvent);}
    function recentNormalPicks(){return [...normalPicksChronological()].reverse();}
    function pickCopyCandidates(events,source,reasonPrefix){
        const candidates=[];
        for(const event of events){
            const card=event?.resultCard;if(!card?.name||card.joker)continue;
            const sourcePlayerIndex=Number(event?.playerIndex);
            const sourcePlayerName=event?.player||playersList()[sourcePlayerIndex]||`GRACZ ${Number.isInteger(sourcePlayerIndex)?sourcePlayerIndex+1:"?"}`;
            candidates.push({card,source,sourcePlayerName,reason:`${reasonPrefix}: ${sourcePlayerName}`});
            if(candidates.length===2)break;
        }
        return candidates;
    }
    function visibleGraveyardEntries(){
        const visible=global.GraveyardUI?.getAvailableEntries?.();
        if(Array.isArray(visible)) return visible;
        const visibleCategories=new Set(["unpicked","rerolled","destroyedByPower","replaced","jokerRejected","devoured","sacrificed","transformedEcho","digested","riverEscaped","riverFaded","riverEndRemainder"]);
        return (global.DraftStateEngine?.listGraveyardEntries?.({status:"available",recoverable:true})||[]).filter(entry=>visibleCategories.has(entry?.category)&&!entry?.metadata?.manualEdit&&entry?.card?.name);
    }
    function gemCandidates(gemType,playerIndex,context={}){
        const legal=legalTemplates(playerIndex),deck=actorDeck(playerIndex);
        if(gemType==="prism"){
            const anchor=context.anchorCard;if(!anchor)return [];
            return shuffled(legal.filter(card=>cardCost(card)===cardCost(anchor))).slice(0,2).map(card=>({card,source:"prism",reason:`ODBICIE KOSZTU ${cardCost(anchor)}`}));
        }
        if(gemType==="echo"){
            return pickCopyCandidates(normalPicksChronological(),"echo_copy","ECHO PIERWSZEGO PIKA");
        }
        if(gemType==="synergy"){
            if(!deck.length)return shuffled(legal).slice(0,2).map(card=>({card,source:"synergy",reason:"PIERWSZA SYNERGIA DECKU"}));
            return legal.map(card=>({card,score:scoreShared(card,deck)})).sort((a,b)=>b.score-a.score).slice(0,2).map(entry=>{const tag=strongestSharedTag(entry.card,deck);return {card:entry.card,source:"synergy",reason:tag?`DUŻA SYNERGIA: ${tag}`:"NAJLEPSZE DOPASOWANIE DO DECKU"};});
        }
        if(gemType==="shadow"){
            return pickCopyCandidates(recentNormalPicks(),"shadow_copy","CIEŃ OSTATNIEGO PIKA");
        }
        if(gemType==="necromancer"){
            return shuffled(visibleGraveyardEntries().filter(entry=>entry?.card&&!entry.card.joker&&!deck.some(card=>norm(card?.name)===norm(entry.card?.name)))).slice(0,2).map(entry=>({card:entry.card,source:"necromancer",graveyardEntryId:entry.graveyardEntryId,reason:"WSKRZESZENIE Z CMENTARZYSKA"}));
        }
        if(gemType==="future"){
            let future=[];const currentState=global.GalacticCurrent?.getState?.();
            if(currentState?.active) future=(currentState.drawQueue||[]).slice(0,8);
            else if(typeof packStartIndex!=="undefined") future=global.DraftStateEngine?.getPack?.(packStartIndex+1)?.cards||[];
            return shuffled(uniqueCards(future).filter(card=>card&&!card.joker&&!deck.some(owned=>norm(owned.name)===norm(card.name)))).slice(0,2).map(card=>({card,source:"future_copy",reason:inGalacticCurrent()?"KOPIA Z PRZYSZŁEGO DOPŁYWU":"KOPIA Z NASTĘPNEJ PACZKI"}));
        }
        return [];
    }
    function activeGemForPlayer(playerIndex){
        const owner=playersList()[playerIndex];if(!owner)return null;
        return (global.SuperpowerEngine?.getRuntimeAssets?.({owner,type:"black_cat_gem",status:"active"})||[]).sort((a,b)=>Number(a.createdAt||0)-Number(b.createdAt||0)||String(a.assetId).localeCompare(String(b.assetId)))[0]||null;
    }
    function currentPickerIndex(){
        if(typeof pickOrder==="undefined"||typeof currentPickIndex==="undefined") return -1;
        return Number(pickOrder[currentPickIndex]);
    }
    function removePortal(){document.getElementById("spxBlackCatGemPortal")?.remove();portal.active=null;}
    function renderPortal(){
        const data=portal.active;if(!data)return;let root=document.getElementById("spxBlackCatGemPortal");if(!root){root=document.createElement("aside");root.id="spxBlackCatGemPortal";document.getElementById("packStage")?.appendChild(root);}
        const def=GEM_DEFS[data.gemType],needsAnchor=data.gemType==="prism"&&!data.anchorCard;
        const surfaceGenitive=flowSurfaceGenitive(),surfaceLocative=flowSurfaceLocative();
        root.className=`spx-blackcat-gem-portal gem-${data.gemType}`;root.innerHTML=`<div class="spx-blackcat-portal-mist"></div><div class="spx-blackcat-portal-beam" aria-hidden="true"></div><div class="spx-blackcat-portal-crystal"><img src="${def.icon}" alt="${esc(def.label)}"></div><div class="spx-blackcat-portal-copy"><h3>${def.label}</h3><p>${needsAnchor?`WSKAŻ KARTĘ Z ${surfaceGenitive.toUpperCase()}, ABY OTWORZYĆ DWA ODBICIA O TYM SAMYM KOSZCIE.`:data.candidates.length?`WYBIERZ ODBICIE ALBO ZABIERZ ZWYKŁĄ KARTĘ Z ${surfaceGenitive.toUpperCase()}.`:"BRAK BEZPIECZNYCH ODBIĆ — KLEJNOT CZEKA NA KOLEJNY PICK."}</p></div>${data.candidates.length?`<div class="spx-blackcat-portal-cards"></div>`:""}${needsAnchor?`<p class="spx-blackcat-portal-instruction">Kliknij kartę w ${surfaceLocative}, aby aktywować promień.</p>`:""}`;
        const cardsRoot=root.querySelector(".spx-blackcat-portal-cards");
        if(cardsRoot) data.candidates.forEach((candidate,index)=>{
            const button=typeof buildPackCardButton==="function"?buildPackCardButton(candidate.card,index):null;
            if(!button)return;
            const option=document.createElement("div");option.className="spx-blackcat-portal-card-option";option.dataset.candidateIndex=String(index);
            const reason=document.createElement("small");reason.className="spx-blackcat-portal-card-reason";reason.id=`spxBlackCatGemReason${index}`;reason.textContent=candidate.reason||"ODBICIE KLEJNOTU";
            button.classList.add("spx-blackcat-portal-card");button.removeAttribute("data-pack-index");button.setAttribute("aria-describedby",reason.id);button.onclick=event=>{event?.preventDefault?.();event?.stopPropagation?.();choosePortalCandidate(index);};option.append(button,reason);cardsRoot.appendChild(option);
        });
    }
    function afterPackRendered(context={}){
        if(state.active) return;
        const playerIndex=currentPickerIndex(),gem=activeGemForPlayer(playerIndex);
        if(!gem){removePortal();return;}
        const gemType=gem.data?.gemType;if(!GEM_DEFS[gemType]){removePortal();return;}
        const mode=global.GalacticCurrent?.getState?.()?.active?"galactic_current":"classic";
        const same=portal.active?.asset?.assetId===gem.assetId&&portal.active?.playerIndex===playerIndex;
        if(!same) portal.active={asset:gem,gemType,playerIndex,mode,commit:context.commit||portal.active?.commit||null,anchorCard:null,candidates:gemType==="prism"?[]:gemCandidates(gemType,playerIndex)};
        else if(context.commit) portal.active.commit=context.commit;
        renderPortal();
    }
    function handlePackCardClick(context={}){
        const playerIndex=currentPickerIndex(),gem=activeGemForPlayer(playerIndex);if(!gem)return false;
        if(!portal.active||portal.active.asset.assetId!==gem.assetId) afterPackRendered({commit:context.commit});
        const data=portal.active;if(!data)return false;if(context.commit)data.commit=context.commit;
        if(data.gemType==="prism"&&!data.anchorCard){data.anchorCard=safeClone(context.card);data.candidates=gemCandidates("prism",playerIndex,{anchorCard:context.card});renderPortal();return true;}
        if(!data.candidates.length) return false;
        data.commit?.(Number(context.index),{normal:true,blackCatGem:{assetId:gem.assetId,gemType:data.gemType}});return true;
    }
    function currentPackCards(){
        const current=global.GalacticCurrent?.getState?.();if(current?.active)return current.cards||[];
        return typeof currentPack!=="undefined"&&Array.isArray(currentPack)?currentPack:[];
    }
    function choosePortalCandidate(candidateIndex){
        const data=portal.active,candidate=data?.candidates?.[candidateIndex];if(!data||!candidate||typeof data.commit!=="function")return;
        if(data.committing)return;
        const available=currentPackCards().map((card,index)=>({card,index})).filter(entry=>entry.card);
        const source=shuffled(available)[0];if(!source)return;
        const resultCard=data.gemType==="necromancer"
            ? safeClone(candidate.card)
            : makeCard(candidate.card,{origin:`black_cat_${data.gemType}`,sourceEvent:`black_cat_gem_${data.gemType}`});
        if(data.gemType==="necromancer") resultCard.instanceMeta={...(resultCard.instanceMeta||{}),blackCatResurrected:true,sourcePowerId:POWER_ID};
        const override={card:resultCard,portal:true,blackCatGem:{assetId:data.asset.assetId,gemType:data.gemType,graveyardEntryId:candidate.graveyardEntryId||null,source:candidate.source||data.gemType},portalSourceCard:source.card};
        data.committing=true;const root=document.getElementById("spxBlackCatGemPortal"),option=root?.querySelector(`[data-candidate-index="${Number(candidateIndex)}"]`);
        root?.classList.add("is-selecting");option?.classList.add("is-chosen");
        global.setTimeout(()=>{root?.classList.remove("is-selecting");root?.classList.add("is-committing");data.commit(source.index,override);},520);
    }
    function finalizeGemPick(override,context={}){
        const gem=override?.blackCatGem;if(!gem?.assetId)return;
        if(gem.graveyardEntryId) global.DraftStateEngine?.consumeGraveyardEntry?.(gem.graveyardEntryId,{reason:"black_cat_necromancer_gem",playerIndex:context.playerIndex,powerId:POWER_ID});
        global.SuperpowerEngine?.consumeRuntimeAsset?.(gem.assetId,{reason:override.portal?"black_cat_portal_pick":"black_cat_normal_pick",playerIndex:context.playerIndex,gemType:gem.gemType,sourceCard:context.sourceCard?.name||null,resultCard:context.resultCard?.name||null});
        global.DraftStateEngine?.log?.("black_cat_gem_consumed",{packNumber:typeof packStartIndex!=="undefined"?packStartIndex+1:null,pickIndex:typeof currentPickIndex!=="undefined"?currentPickIndex:null,playerIndex:context.playerIndex,sourceCard:context.sourceCard,resultCard:context.resultCard,reason:gem.gemType,data:{portal:Boolean(override.portal),gemType:gem.gemType}});
        removePortal();
    }
    function onQueuePrepared(){return false;}

    global.BlackCatUI=Object.freeze({start,reset,onQueuePrepared,afterPackRendered,handlePackCardClick,finalizeGemPick,isBusy:()=>state.active,getLockReason:()=>state.active?"Dokończ KOCI HEIST Black Cat.":"",getState:()=>safeClone({...state,session:state.session?Engine.snapshot(state.session):null}),getPortalState:()=>safeClone(portal.active)});
})(typeof window!=="undefined"?window:globalThis);
