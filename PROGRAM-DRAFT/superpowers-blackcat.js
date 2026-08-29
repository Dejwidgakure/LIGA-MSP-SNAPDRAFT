(function(global){
    "use strict";

    const POWER_ID="black_cat";
    const CONFIG=Object.freeze({rows:5,cols:7,maxMoves:11,laserCount:7,rewardCount:8,startRow:4,startCol:3});
    const REWARD_DEFINITIONS=Object.freeze({
        jeffcoin:{type:"jeffcoin",label:"JEFFCOIN",short:"+1 JC",quality:1,icon:"draft-assets/jeffcoin.png",economyOnly:true},
        queue_boost:{type:"queue_boost",label:"SKOK W KOLEJCE",short:"+1 PICK",quality:2,glyph:"⇧"},
        weakest_reroll:{type:"weakest_reroll",label:"CICHY REROLL",short:"NAJSŁABSZA",quality:2,glyph:"↻"},
        any_reroll:{type:"any_reroll",label:"WYTRYCH LOSU",short:"DOWOLNA",quality:3,glyph:"✦"},
        choice_two:{type:"choice_two",label:"PODWÓJNY ŁUP",short:"1 Z 2",quality:3,glyph:"◆"}
    });

    const safeClone=value=>{
        if(value===undefined) return undefined;
        if(typeof structuredClone==="function"){
            try{return structuredClone(value);}catch(error){}
        }
        return JSON.parse(JSON.stringify(value));
    };
    const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
    const indexOf=(row,col,cols=CONFIG.cols)=>row*cols+col;
    const coords=(index,cols=CONFIG.cols)=>({row:Math.floor(index/cols),col:index%cols});
    const neighbors=(index,rows=CONFIG.rows,cols=CONFIG.cols,diagonal=false)=>{
        const {row,col}=coords(index,cols);
        const list=[];
        for(let dr=-1;dr<=1;dr++){
            for(let dc=-1;dc<=1;dc++){
                if(!dr&&!dc) continue;
                if(!diagonal&&Math.abs(dr)+Math.abs(dc)!==1) continue;
                const nr=row+dr,nc=col+dc;
                if(nr>=0&&nr<rows&&nc>=0&&nc<cols) list.push(indexOf(nr,nc,cols));
            }
        }
        return list;
    };
    const shuffled=(values,rng=Math.random)=>{
        const result=[...values];
        for(let i=result.length-1;i>0;i--){
            const j=Math.floor(clamp(Number(rng())||0,0,0.999999)*(i+1));
            [result[i],result[j]]=[result[j],result[i]];
        }
        return result;
    };
    const rewardPool=economyEnabled=>economyEnabled
        ? ["jeffcoin","jeffcoin","queue_boost","weakest_reroll","any_reroll","choice_two","weakest_reroll","choice_two"]
        : ["queue_boost","weakest_reroll","any_reroll","choice_two","weakest_reroll","choice_two","queue_boost","any_reroll"];
    function buildSafePath(startIndex,exhibitIndex,cols,rng){
        const path=[startIndex];
        let current=startIndex;
        while(current!==exhibitIndex){
            const from=coords(current,cols),to=coords(exhibitIndex,cols);
            const choices=[];
            if(from.row<to.row) choices.push(indexOf(from.row+1,from.col,cols));
            if(from.row>to.row) choices.push(indexOf(from.row-1,from.col,cols));
            if(from.col<to.col) choices.push(indexOf(from.row,from.col+1,cols));
            if(from.col>to.col) choices.push(indexOf(from.row,from.col-1,cols));
            current=choices[Math.floor((Number(rng())||0)*choices.length)]??choices[0];
            path.push(current);
        }
        return path;
    }
    function createSession(options={}){
        const rows=clamp(Number(options.rows)||CONFIG.rows,4,7);
        const cols=clamp(Number(options.cols)||CONFIG.cols,5,9);
        const maxMoves=clamp(Number(options.maxMoves)||CONFIG.maxMoves,6,20);
        const rng=typeof options.rng==="function"?options.rng:Math.random;
        const startRow=clamp(Number(options.startRow??rows-1),0,rows-1);
        const startCol=clamp(Number(options.startCol??Math.floor(cols/2)),0,cols-1);
        const startIndex=indexOf(startRow,startCol,cols);
        const all=Array.from({length:rows*cols},(_,index)=>index);
        let exhibitCandidates=all.filter(index=>{
            if(index===startIndex) return false;
            const point=coords(index,cols);
            return Math.abs(point.row-startRow)+Math.abs(point.col-startCol)>=4;
        });
        if(!exhibitCandidates.length) exhibitCandidates=all.filter(index=>index!==startIndex);
        const exhibitIndex=shuffled(exhibitCandidates,rng)[0];
        const safePath=buildSafePath(startIndex,exhibitIndex,cols,rng);
        const safeSet=new Set(safePath);
        const cells=all.map(index=>({index,...coords(index,cols),kind:"empty",reward:null}));
        cells[exhibitIndex].kind="exhibit";
        const trapCandidates=shuffled(all.filter(index=>index!==startIndex&&index!==exhibitIndex&&!safeSet.has(index)),rng);
        const trapCount=Math.min(clamp(Number(options.laserCount)||CONFIG.laserCount,3,12),trapCandidates.length);
        trapCandidates.slice(0,trapCount).forEach(index=>{cells[index].kind="laser";});
        const rewardCandidates=shuffled(all.filter(index=>cells[index].kind==="empty"&&index!==startIndex),rng);
        const types=rewardPool(Boolean(options.economyEnabled));
        const rewardCount=Math.min(clamp(Number(options.rewardCount)||CONFIG.rewardCount,4,12),rewardCandidates.length,types.length);
        rewardCandidates.slice(0,rewardCount).forEach((index,position)=>{
            const type=types[position%types.length];
            cells[index].kind="reward";
            cells[index].reward={...REWARD_DEFINITIONS[type],rewardId:`loot-${position+1}`};
        });
        return {
            version:1,rows,cols,maxMoves,movesRemaining:maxMoves,startIndex,currentIndex:startIndex,
            exhibitIndex,cells,safePath:[...safePath],visited:[startIndex],collected:[],finalLoot:[],
            agilityUsed:false,pendingLaserIndex:null,status:"active",economyEnabled:Boolean(options.economyEnabled),
            target:safeClone(options.target||null),createdAt:Date.now(),events:[{type:"entry",index:startIndex}]
        };
    }
    function isVisited(session,index){return session.visited.includes(Number(index));}
    function isReachable(session,index){
        return Boolean(session?.status==="active"&&!isVisited(session,index)&&neighbors(session.currentIndex,session.rows,session.cols,false).includes(Number(index)));
    }
    function laserCountAround(session,index){
        return neighbors(index,session.rows,session.cols,true).filter(cellIndex=>session.cells[cellIndex]?.kind==="laser").length;
    }
    function litIndices(session){
        const lit=new Set();
        session.visited.forEach(index=>{
            lit.add(index);
            neighbors(index,session.rows,session.cols,true).forEach(next=>lit.add(next));
        });
        return [...lit];
    }
    function lowestReward(list){
        return [...(list||[])].sort((a,b)=>Number(a.quality||0)-Number(b.quality||0))[0]||null;
    }
    function move(session,index){
        const targetIndex=Number(index);
        if(!session||session.status!=="active") return {ok:false,reason:"Napad nie oczekuje teraz na ruch."};
        if(!isReachable(session,targetIndex)) return {ok:false,reason:"Black Cat może skoczyć tylko na sąsiednie, nieodkryte pole."};
        session.currentIndex=targetIndex;
        session.visited.push(targetIndex);
        session.movesRemaining=Math.max(0,session.movesRemaining-1);
        const cell=session.cells[targetIndex];
        const event={ok:true,index:targetIndex,kind:cell.kind,movesRemaining:session.movesRemaining,security:laserCountAround(session,targetIndex)};
        if(cell.kind==="reward"&&cell.reward){
            const reward=safeClone(cell.reward);
            session.collected.push(reward);
            event.reward=reward;
        }else if(cell.kind==="laser"){
            session.pendingLaserIndex=targetIndex;
            if(!session.agilityUsed&&session.collected.length){
                session.status="laser_choice";
                event.requiresAgilityChoice=true;
                event.sacrifice=lowestReward(session.collected);
            }else{
                session.status="failed";
                session.finalLoot=lowestReward(session.collected)?[safeClone(lowestReward(session.collected))]:[];
                event.failed=true;
            }
        }else if(cell.kind==="exhibit"){
            session.status="success";
            session.finalLoot=safeClone(session.collected);
            event.success=true;
        }
        if(session.status==="active"&&session.movesRemaining<=0){
            session.status="exhausted";
            session.finalLoot=safeClone(session.collected);
            event.exhausted=true;
        }
        session.events.push({type:"move",...safeClone(event)});
        return event;
    }
    function decideAgility(session,useAgility){
        if(!session||session.status!=="laser_choice") return {ok:false,reason:"Zwinność Kota nie oczekuje na decyzję."};
        const sacrifice=lowestReward(session.collected);
        if(useAgility&&sacrifice&&!session.agilityUsed){
            session.collected=session.collected.filter(item=>item.rewardId!==sacrifice.rewardId);
            session.agilityUsed=true;
            session.pendingLaserIndex=null;
            session.status=session.movesRemaining>0?"active":"exhausted";
            if(session.status==="exhausted") session.finalLoot=safeClone(session.collected);
            const event={ok:true,survived:true,sacrifice:safeClone(sacrifice),status:session.status};
            session.events.push({type:"agility",...event});
            return event;
        }
        session.status="failed";
        session.pendingLaserIndex=null;
        session.finalLoot=sacrifice?[safeClone(sacrifice)]:[];
        const event={ok:true,survived:false,kept:safeClone(session.finalLoot)};
        session.events.push({type:"alarm",...event});
        return event;
    }
    function cashOut(session){
        if(!session||session.status!=="active") return {ok:false,reason:"Nie można teraz zakończyć napadu."};
        if(!session.collected.length) return {ok:false,reason:"Najpierw zdobądź co najmniej jeden łup."};
        session.status="cashed_out";
        session.finalLoot=safeClone(session.collected);
        const event={ok:true,status:session.status,loot:safeClone(session.finalLoot)};
        session.events.push({type:"cash_out",...event});
        return event;
    }
    function snapshot(session){
        if(!session) return null;
        return {...safeClone(session),litIndices:litIndices(session),reachableIndices:session.status==="active"?neighbors(session.currentIndex,session.rows,session.cols,false).filter(index=>!isVisited(session,index)):[]};
    }

    const Engine=Object.freeze({CONFIG,REWARD_DEFINITIONS,createSession,move,decideAgility,cashOut,snapshot,isReachable,laserCountAround,litIndices,lowestReward});
    global.BlackCatHeistEngine=Engine;
    if(!global.document) return;

    const state={
        active:false,phase:"idle",playerName:"",playerIndex:-1,targets:[],selectedTarget:null,session:null,
        processing:false,activationCommitted:false,mainResult:null,rewardQueue:[],rewardResults:[],currentReward:null,
        choiceTargetIndex:-1,choiceCandidates:[],notice:"",queueApplying:false
    };
    const playersList=()=>typeof players!=="undefined"&&Array.isArray(players)?players:[];
    const decksList=()=>typeof decks!=="undefined"&&Array.isArray(decks)?decks:[];
    const cardsList=()=>typeof cardDatabase!=="undefined"&&Array.isArray(cardDatabase)?cardDatabase:[];
    const bannedList=()=>typeof bannedCards!=="undefined"&&Array.isArray(bannedCards)?bannedCards:[];
    const norm=value=>String(value||"").trim().toLocaleLowerCase("pl-PL");
    const esc=value=>String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
    const cardCost=card=>Number.isFinite(Number(card?.cost))?Number(card.cost):0;
    const cardPower=card=>Number.isFinite(Number(card?.power))?Number(card.power):0;
    const assignment=playerName=>typeof getSuperpowerRuntimeAssignment==="function"?getSuperpowerRuntimeAssignment(playerName):global.SuperpowerEngine?.getPlayerData?.(playerName);
    const notify=(kind,title,message)=>global.SuperpowerFeedback?.[kind]?.(POWER_ID,title,message);
    function isCardMutable(playerIndex,cardIndex,effect="reroll",actorPlayerIndex=playerIndex){
        const card=decksList()[playerIndex]?.[cardIndex];
        if(!card||card?.joker||card?.instanceMeta?.locked||card?.instanceMeta?.cannotReplace) return false;
        if(!Number.isFinite(Number(card.cost))||!Number.isFinite(Number(card.power))) return false;
        return typeof canSuperpowerTargetDeckCard!=="function"||canSuperpowerTargetDeckCard({actorPlayerIndex,targetPlayerIndex:playerIndex,targetCardIndex:cardIndex,effect})!==false;
    }
    function replacementTemplates(playerIndex,cardIndex,sourceCard,count=99){
        const occupied=new Set((decksList()[playerIndex]||[]).filter((_,index)=>index!==cardIndex).map(card=>norm(card?.name)).filter(Boolean));
        const banned=new Set(bannedList().map(norm));
        const sourceName=norm(sourceCard?.name);
        return shuffled(cardsList().filter(card=>{
            const name=norm(card?.name);
            return Boolean(name&&!card?.joker&&name!==sourceName&&!occupied.has(name)&&!banned.has(name)&&cardCost(card)===cardCost(sourceCard)&&Number.isFinite(Number(card?.power)));
        })).slice(0,count);
    }
    function eligibleTargets(playerIndex){
        const ownerNames=new Set((decksList()[playerIndex]||[]).map(card=>norm(card?.name)).filter(Boolean));
        const result=[];
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
    function preflight(playerName){
        const playerIndex=playersList().indexOf(String(playerName||""));
        const data=assignment(playerName);
        if(state.active) return {ok:false,message:"KOCI HEIST jest już w toku."};
        if(playerIndex<0||data?.powerId!==POWER_ID) return {ok:false,message:"Black Cat nie jest przypisana do tego gracza."};
        if(data.used) return {ok:false,message:"KOCI HEIST został już wykorzystany."};
        if(typeof draftFinished!=="undefined"&&draftFinished) return {ok:false,message:"Draft jest już zakończony."};
        if(global.DraftFoundation?.hasOpenTransaction?.()) return {ok:false,message:"Najpierw dokończ bieżące rozstrzygnięcie draftu."};
        if(global.SuperpowerUI?.isOwnBusy?.()) return {ok:false,message:"Najpierw dokończ aktywną sekwencję Supermocy."};
        const competingModules=[global.GambitUI,global.WolverineUI,global.DevilDinoUI,global.GrootUI,global.ThorUI,global.IronFistUI,global.JokerV2UI,global.MysterioUI];
        if(competingModules.some(module=>module?.isBusy?.())) return {ok:false,message:"Najpierw dokończ inną aktywną sekwencję draftu lub Supermocy."};
        const targets=eligibleTargets(playerIndex);
        if(!targets.length) return {ok:false,message:"W deckach rywali nie ma legalnego eksponatu z dostępnym zamiennikiem o tym samym Koszcie."};
        return {ok:true,playerIndex,targets};
    }
    function ensureOverlay(){
        let overlay=document.getElementById("spxBlackCatOverlay");
        if(overlay) return overlay;
        overlay=document.createElement("div");
        overlay.id="spxBlackCatOverlay";
        overlay.className="spx-blackcat-overlay";
        overlay.hidden=true;
        overlay.innerHTML=`<section class="spx-blackcat-modal" role="dialog" aria-modal="true" aria-labelledby="spxBlackCatTitle">
            <header class="spx-blackcat-header">
                <div class="spx-blackcat-brand"><img src="draft-assets/blackcatpowerslogo.png?v=2-alpha" alt=""><div><span>BLACK CAT // NOCNA OPERACJA</span><h2 id="spxBlackCatTitle">KOCI HEIST</h2><p id="spxBlackCatLead">Wybierz główny eksponat.</p></div></div>
                <div class="spx-blackcat-header-status" id="spxBlackCatHeaderStatus"></div>
                <button type="button" class="spx-blackcat-close" id="spxBlackCatClose" aria-label="Zamknij">×</button>
            </header>
            <main class="spx-blackcat-content" id="spxBlackCatContent"></main>
            <footer class="spx-blackcat-footer"><div id="spxBlackCatHint"></div><div class="spx-blackcat-actions" id="spxBlackCatActions"></div></footer>
            <div class="spx-blackcat-event" id="spxBlackCatEvent" hidden></div>
        </section>`;
        document.body.appendChild(overlay);
        overlay.querySelector("#spxBlackCatClose").addEventListener("click",()=>attemptClose());
        return overlay;
    }
    function setHeader(lead,status=""){
        const overlay=ensureOverlay();
        overlay.querySelector("#spxBlackCatLead").textContent=lead||"";
        overlay.querySelector("#spxBlackCatHeaderStatus").innerHTML=status||"";
    }
    function setActions(actions=[]){
        const root=ensureOverlay().querySelector("#spxBlackCatActions");
        root.innerHTML="";
        actions.forEach(action=>{
            const button=document.createElement("button");button.type="button";button.className=`spx-blackcat-action ${action.className||""}`;button.textContent=action.label;button.disabled=Boolean(action.disabled);button.addEventListener("click",action.onClick);root.appendChild(button);
        });
    }
    function setHint(text){ensureOverlay().querySelector("#spxBlackCatHint").textContent=text||"";}
    function cardMarkup(card,extraClass=""){
        return `<article class="spx-blackcat-card ${extraClass}"><div class="spx-blackcat-card-orb cost"><span>${esc(cardCost(card))}</span></div><div class="spx-blackcat-card-art"><i></i></div><strong>${esc(card?.name||"Nieznana karta")}</strong><div class="spx-blackcat-card-orb power"><span>${esc(cardPower(card))}</span></div></article>`;
    }
    function targetKey(target){return `${target.targetPlayerIndex}:${target.targetCardInstanceId||target.targetCardIndex}`;}
    function renderTargetSelection(){
        state.phase="target";
        setHeader(`${state.playerName}: wskaż kartę rywala, którą Black Cat ukryje jako główny eksponat.`,`<span class="spx-blackcat-economy ${global.EconomyEngine?.isEnabled?.()?"on":"off"}">${global.EconomyEngine?.isEnabled?.()?"ECONOMY: JEFFCOINY W GABLOTACH":"TRYB NIEZALEŻNY OD ECONOMY"}</span>`);
        const groups=playersList().map((name,index)=>({name,index,targets:state.targets.filter(target=>target.targetPlayerIndex===index)})).filter(group=>group.targets.length);
        ensureOverlay().querySelector("#spxBlackCatContent").innerHTML=`<section class="spx-blackcat-target-stage"><div class="spx-blackcat-target-copy"><img src="draft-assets/blackcatpowershero.png?v=2-alpha" alt="Black Cat"><div><span>FAZA 01 // REKONESANS</span><h3>WYBIERZ GŁÓWNY EKSPONAT</h3><p>Po udanym napadzie karta przejdzie do decku Black Cat. Właściciel spadnie na cztery łapy i otrzyma losowy zamiennik o identycznym Koszcie.</p></div></div><div class="spx-blackcat-target-groups">${groups.map(group=>`<section><h4>MUZEUM GRACZA <b>${esc(group.name)}</b></h4><div class="spx-blackcat-target-cards">${group.targets.map(target=>`<button type="button" class="spx-blackcat-target-button ${state.selectedTarget&&targetKey(state.selectedTarget)===targetKey(target)?"is-selected":""}" data-key="${esc(targetKey(target))}">${cardMarkup(target.card)}<span>WYBIERZ EKSPONAT</span></button>`).join("")}</div></section>`).join("")}</div></section>`;
        ensureOverlay().querySelectorAll(".spx-blackcat-target-button").forEach(button=>button.addEventListener("click",()=>{
            state.selectedTarget=state.targets.find(target=>targetKey(target)===button.dataset.key)||null;
            renderTargetSelection();
        }));
        setHint("Napad nie zużywa Supermocy, dopóki nie wejdziesz na pierwsze pole muzeum.");
        setActions([{label:"ANULUJ REKONESANS",onClick:()=>reset()},{label:"ROZPOCZNIJ WŁAMANIE",className:"primary",disabled:!state.selectedTarget,onClick:beginHeist}]);
    }
    function beginHeist(){
        if(!state.selectedTarget) return;
        state.session=Engine.createSession({economyEnabled:Boolean(global.EconomyEngine?.isEnabled?.()),target:state.selectedTarget});
        state.phase="heist";state.notice="Wejście zabezpieczone. Kliknij sąsiednie pole, żeby wykonać pierwszy skok.";
        renderHeist();
    }
    function rewardVisual(reward){
        if(reward?.icon) return `<img src="${esc(reward.icon)}" alt="">`;
        return `<b>${esc(reward?.glyph||"✦")}</b>`;
    }
    function cellMarkup(cell,snap){
        const visited=snap.visited.includes(cell.index),lit=snap.litIndices.includes(cell.index),reachable=snap.reachableIndices.includes(cell.index);
        let content="";
        if(visited&&cell.kind==="laser") content=`<img class="spx-blackcat-laser" src="draft-assets/blackcat_heist_laser.png" alt="Laser">`;
        if(visited&&cell.kind==="reward") content=`<div class="spx-blackcat-vitrine"><img src="draft-assets/blackcat_heist_vitrine.png" alt="Gablota"><span>${rewardVisual(cell.reward)}<small>${esc(cell.reward.short)}</small></span></div>`;
        if(visited&&cell.kind==="exhibit") content=`<div class="spx-blackcat-vitrine exhibit"><img src="draft-assets/blackcat_heist_vitrine.png" alt="Główna gablota"><span>${cardMarkup(state.selectedTarget.card,"mini")}</span></div>`;
        if(visited&&cell.kind==="empty"){
            const count=Engine.laserCountAround(state.session,cell.index);
            content=`<span class="spx-blackcat-security-count ${count?"hot":"safe"}">${count||"✓"}</span>`;
        }
        return `<button type="button" class="spx-blackcat-cell ${visited?"is-visited":""} ${lit?"is-lit":""} ${reachable?"is-reachable":""}" data-index="${cell.index}" ${reachable?"":"disabled"} aria-label="Pole ${cell.row+1}, ${cell.col+1}">${content}<i class="spx-blackcat-fog"></i></button>`;
    }
    function renderHeist(){
        if(!state.session) return;
        const snap=Engine.snapshot(state.session),position=coords(snap.currentIndex,snap.cols);
        setHeader(`${state.playerName}: odnajdź gablotę z kartą ${state.selectedTarget.card.name} i nie przerwij wiązki.`,`<span>RUCHY <b>${snap.movesRemaining}/${snap.maxMoves}</b></span><span>ZWINNOŚĆ <b>${snap.agilityUsed?"ZUŻYTA":"GOTOWA"}</b></span>`);
        const loot=snap.collected.map(reward=>`<li>${rewardVisual(reward)}<span>${esc(reward.label)}</span></li>`).join("")||"<li class='empty'>Gabloty czekają w ciemności.</li>";
        ensureOverlay().querySelector("#spxBlackCatContent").innerHTML=`<section class="spx-blackcat-heist-layout"><div class="spx-blackcat-board-frame"><img class="spx-blackcat-museum" src="draft-assets/blackcat_heist_museum_topdown.png?v=2-exhibits" alt="Muzeum widziane z góry"><div class="spx-blackcat-grid" style="--bc-rows:${snap.rows};--bc-cols:${snap.cols}">${snap.cells.map(cell=>cellMarkup(cell,snap)).join("")}</div><div class="spx-blackcat-token-light" style="--bc-row:${position.row};--bc-col:${position.col};--bc-rows:${snap.rows};--bc-cols:${snap.cols}"></div><img class="spx-blackcat-token" style="--bc-row:${position.row};--bc-col:${position.col};--bc-rows:${snap.rows};--bc-cols:${snap.cols}" src="draft-assets/blackcatpowershero.png?v=2-alpha" alt="Black Cat"></div><aside class="spx-blackcat-heist-sidebar"><section class="spx-blackcat-objective"><span>GŁÓWNY EKSPONAT</span>${cardMarkup(state.selectedTarget.card,"objective")}<small>WŁAŚCICIEL: ${esc(state.selectedTarget.targetPlayerName)}</small></section><section class="spx-blackcat-security"><span>CZYTNIK ZABEZPIECZEŃ</span><b>${Engine.laserCountAround(state.session,snap.currentIndex)}</b><p>Tyle laserów znajduje się na ośmiu polach wokół aktualnej pozycji. Oświetlenie pokazuje teren — nie ujawnia zawartości gablot.</p></section><section class="spx-blackcat-loot"><span>TORBA BLACK CAT</span><ul>${loot}</ul></section></aside></section>`;
        ensureOverlay().querySelectorAll(".spx-blackcat-cell.is-reachable").forEach(button=>button.addEventListener("click",()=>performMove(Number(button.dataset.index))));
        setHint(state.notice||"Poruszaj się wyłącznie po sąsiednich, nieodkrytych polach. Cyfra pokazuje liczbę laserów w sąsiedztwie.");
        setActions([{label:"WYCOFAJ SIĘ Z ŁUPEM",className:"cashout",disabled:!snap.collected.length||snap.status!=="active",onClick:requestCashOut}]);
    }
    function showEvent(kind,title,body,actions=[]){
        const layer=ensureOverlay().querySelector("#spxBlackCatEvent");
        layer.className=`spx-blackcat-event ${kind||""}`;layer.hidden=false;
        layer.innerHTML=`<section><img src="${kind==="laser"?"draft-assets/blackcat_heist_laser.png":"draft-assets/blackcatpowerslogo.png?v=3-bolt"}" alt=""><span>${esc(kind==="laser"?"ALARM MUZEUM":"KOCI HEIST")}</span><h3>${esc(title)}</h3><p>${esc(body)}</p><div class="spx-blackcat-event-actions"></div></section>`;
        const root=layer.querySelector(".spx-blackcat-event-actions");
        actions.forEach(action=>{const button=document.createElement("button");button.type="button";button.className=`spx-blackcat-action ${action.className||""}`;button.textContent=action.label;button.addEventListener("click",()=>{layer.hidden=true;action.onClick?.();});root.appendChild(button);});
    }
    function performMove(index){
        if(state.processing) return;
        state.processing=true;
        const event=Engine.move(state.session,index);
        state.processing=false;
        if(!event.ok){state.notice=event.reason;renderHeist();return;}
        if(event.reward){state.notice=`Gablota otwarta: ${event.reward.label}. Łup trafia do torby.`;}
        else if(event.kind==="empty") state.notice=event.security?`Czujniki wykrywają ${event.security} ${event.security===1?"laser":"lasery"} w pobliżu.`:"Czysto. W pobliżu nie ma laserów.";
        renderHeist();
        if(event.requiresAgilityChoice){
            const sacrifice=event.sacrifice;
            showEvent("laser","WIĄZKA PRZECINA DROGĘ",`Zwinność Kota może uratować napad, ale Black Cat musi porzucić najskromniejszy łup: ${sacrifice.label}.`,[
                {label:"UŻYJ ZWINNOŚCI KOTA",className:"primary",onClick:()=>resolveLaser(true)},
                {label:"URUCHOM ALARM I UCIEKAJ",className:"danger",onClick:()=>resolveLaser(false)}
            ]);
        }else if(event.failed){
            showEvent("laser","ALARM! BLACK CAT UCIEKA",state.session.finalLoot.length?`Napad kończy się niepowodzeniem. Black Cat zachowuje tylko: ${state.session.finalLoot[0].label}.`:"Napad kończy się niepowodzeniem. Torba pozostaje pusta.",[{label:"ROZLICZ UCIECZKĘ",className:"danger",onClick:beginSettlement}]);
        }else if(event.success){
            showEvent("success","GŁÓWNY EKSPONAT ZDOBYTY",`${state.selectedTarget.card.name} znika z muzeum. Czas otworzyć sejf i rozliczyć łup.`,[{label:"OTWÓRZ SEJF",className:"primary",onClick:beginSettlement}]);
        }else if(event.exhausted){
            showEvent("","CZAS UCIEKAĆ",state.session.finalLoot.length?"Trasa się kończy. Główny eksponat zostaje w muzeum, ale zdobyte nagrody są bezpieczne.":"Trasa się kończy bez zdobyczy.",[{label:"ZAKOŃCZ NAPAD",className:"primary",onClick:beginSettlement}]);
        }
    }
    function resolveLaser(useAgility){
        const result=Engine.decideAgility(state.session,useAgility);
        state.notice=result.survived?`Zwinność Kota działa. Porzucono: ${result.sacrifice.label}. Napad trwa dalej.`:"Alarm odcina drogę ucieczki.";
        renderHeist();
        if(result.survived&&result.status==="exhausted") beginSettlement();
        else if(!result.survived) showEvent("laser","ALARM! BLACK CAT UCIEKA",state.session.finalLoot.length?`Z torby zostaje tylko: ${state.session.finalLoot[0].label}.`:"Black Cat nie wynosi żadnego łupu.",[{label:"ROZLICZ UCIECZKĘ",className:"danger",onClick:beginSettlement}]);
    }
    function requestCashOut(){
        const result=Engine.cashOut(state.session);
        if(!result.ok){state.notice=result.reason;renderHeist();return;}
        showEvent("success","CICHY ODWRÓT",`Black Cat opuszcza muzeum z ${result.loot.length} ${result.loot.length===1?"nagrodą":"nagrodami"}. Główny eksponat pozostaje na miejscu.`,[{label:"OTWÓRZ TORBĘ",className:"primary",onClick:beginSettlement}]);
    }
    function markActivationUsed(){
        if(state.activationCommitted) return {ok:true};
        const result=global.SuperpowerEngine?.completeActivation?.(state.playerName,POWER_ID,{result:state.session?.status||"unknown",targetPlayer:state.selectedTarget?.targetPlayerName||null,targetCard:state.selectedTarget?.card?.name||null,movesUsed:(state.session?.maxMoves||0)-(state.session?.movesRemaining||0),loot:(state.session?.finalLoot||[]).map(item=>item.type),economyEnabled:Boolean(state.session?.economyEnabled),packNumber:typeof packStartIndex!=="undefined"?packStartIndex+1:null,pickIndex:typeof currentPickIndex!=="undefined"?currentPickIndex:null})||{ok:false,reason:"Silnik Supermocy jest niedostępny."};
        if(!result.ok) return result;
        const stored=global.draftSuperpowers?.[state.playerName];if(stored){stored.used=true;stored.status="used";}
        state.activationCommitted=true;
        return result;
    }
    function locateLiveTarget(){
        const deck=decksList()[state.selectedTarget.targetPlayerIndex]||[];
        let index=state.selectedTarget.targetCardInstanceId?deck.findIndex(card=>card?.instanceId===state.selectedTarget.targetCardInstanceId):-1;
        if(index<0&&deck[state.selectedTarget.targetCardIndex]&&norm(deck[state.selectedTarget.targetCardIndex]?.name)===norm(state.selectedTarget.card?.name)) index=state.selectedTarget.targetCardIndex;
        return {deck,index,card:index>=0?deck[index]:null};
    }
    function commitMainExhibit(){
        const actorDeck=decksList()[state.playerIndex],target=locateLiveTarget();
        if(!Array.isArray(actorDeck)||!target.card) return {ok:false,reason:"Główny eksponat zniknął z decku właściciela przed rozliczeniem."};
        if(!isCardMutable(state.selectedTarget.targetPlayerIndex,target.index,"replace",state.playerIndex)) return {ok:false,reason:"Nowe zabezpieczenie ochroniło główny eksponat."};
        if((actorDeck||[]).some(card=>norm(card?.name)===norm(target.card?.name))) return {ok:false,reason:"Black Cat ma już kartę o tej nazwie."};
        const candidates=replacementTemplates(state.selectedTarget.targetPlayerIndex,target.index,target.card,99);
        if(!candidates.length) return {ok:false,reason:"Nie ma legalnego zamiennika o tym samym Koszcie."};
        const replacementTemplate=candidates[Math.floor(Math.random()*candidates.length)];
        const replacement=typeof createDraftCardInstance==="function"?createDraftCardInstance(replacementTemplate,{origin:"black_cat_soft_landing",sourcePowerId:POWER_ID,sourceEvent:"black_cat_same_cost_replacement",forceNew:true}):safeClone(replacementTemplate);
        const stolen=target.card;
        replacement.instanceMeta={...(replacement.instanceMeta||{}),blackCatSoftLanding:true,replacedStolenInstanceId:stolen.instanceId||null};
        stolen.instanceMeta={...(stolen.instanceMeta||{}),blackCatStolen:true,stolenFromPlayerIndex:state.selectedTarget.targetPlayerIndex,stolenFromPlayerName:state.selectedTarget.targetPlayerName,heistOwner:state.playerName};
        target.deck[target.index]=replacement;
        actorDeck.push(stolen);
        global.DevilDinoUI?.notifyHostileDeckChange?.({targetPlayerIndex:state.selectedTarget.targetPlayerIndex,targetCardInstanceId:replacement.instanceId||null,previousCardInstanceId:stolen.instanceId||null,previousCardName:stolen.name,replacementCardName:replacement.name,powerId:POWER_ID,reason:"black_cat_heist"});
        global.DraftStateEngine?.log?.("black_cat_main_exhibit_stolen",{packNumber:typeof packStartIndex!=="undefined"?packStartIndex+1:null,pickIndex:typeof currentPickIndex!=="undefined"?currentPickIndex:null,playerIndex:state.playerIndex,player:state.playerName,sourceCard:stolen,resultCard:replacement,reason:"black_cat_heist",data:{victimPlayerIndex:state.selectedTarget.targetPlayerIndex,victimPlayerName:state.selectedTarget.targetPlayerName,sameCost:cardCost(stolen),thiefDeckSize:actorDeck.length,victimDeckSize:target.deck.length}});
        return {ok:true,stolenCard:stolen,replacementCard:replacement};
    }
    function beginSettlement(){
        if(state.phase==="settlement"||state.phase==="summary") return;
        state.phase="settlement";
        const activation=markActivationUsed();
        if(!activation.ok){notify("error","NAPAD NIE ZOSTAŁ ROZLICZONY",activation.reason||"Silnik odrzucił wynik napadu.");return;}
        state.mainResult=state.session?.status==="success"?commitMainExhibit():{ok:false,skipped:true,reason:"Główny eksponat nie został zdobyty."};
        state.rewardQueue=safeClone(state.session?.finalLoot||[]);
        state.rewardResults=[];
        global.superpowerLog=global.superpowerLog||[];
        global.superpowerLog.push({type:"superpower_activation",event:"black_cat_heist",playerName:state.playerName,playerIndex:state.playerIndex,powerId:POWER_ID,powerName:"KOCI HEIST",outcome:state.session?.status,mainExhibit:state.mainResult?.ok?state.mainResult.stolenCard?.name:null,targetPlayer:state.selectedTarget?.targetPlayerName,loot:state.rewardQueue.map(item=>item.type),economyEnabled:Boolean(state.session?.economyEnabled),timestamp:new Date().toISOString()});
        if(typeof showDecks==="function") showDecks();
        resolveNextReward();
    }
    function eligibleOwnRerolls(mode){
        const entries=(decksList()[state.playerIndex]||[]).map((card,index)=>({card,index})).filter(entry=>!entry.card?.instanceMeta?.blackCatStolen&&isCardMutable(state.playerIndex,entry.index,"reroll",state.playerIndex)&&replacementTemplates(state.playerIndex,entry.index,entry.card,1).length);
        if(mode!=="weakest_reroll"||!entries.length) return entries;
        const minimum=Math.min(...entries.map(entry=>cardPower(entry.card)));
        return entries.filter(entry=>cardPower(entry.card)===minimum);
    }
    function commitReroll(cardIndex,candidate=null,rewardType="any_reroll"){
        const card=decksList()[state.playerIndex]?.[cardIndex];
        if(!card||!isCardMutable(state.playerIndex,cardIndex,"reroll",state.playerIndex)) return {ok:false,reason:"Wybrana karta nie może już zostać przelosowana."};
        const candidates=candidate?[candidate]:replacementTemplates(state.playerIndex,cardIndex,card,99);
        const template=candidates[Math.floor(Math.random()*candidates.length)];
        if(!template) return {ok:false,reason:"Brak legalnego zamiennika o tym samym Koszcie."};
        const result=typeof replaceDeckCardWithHistory==="function"?replaceDeckCardWithHistory(state.playerIndex,cardIndex,template,{allowDuringSuperpower:true,origin:"black_cat_heist_loot",sourcePowerId:POWER_ID,sourceEvent:`black_cat_${rewardType}`,eventType:"black_cat_loot_reroll",reason:"black_cat_heist_loot",graveyardCategory:"replaced",graveyardMetadata:{rewardType}}):null;
        if(!result) return {ok:false,reason:"Przelosowanie zostało odrzucone przez draft."};
        return {ok:true,previousCard:card,resultCard:decksList()[state.playerIndex][cardIndex]};
    }
    function applyAutomaticReward(reward){
        if(reward.type==="jeffcoin"){
            const result=global.EconomyEngine?.credit?.(state.playerIndex,1,{kind:"bonus",reason:"black_cat_heist",packNumber:typeof packStartIndex!=="undefined"?packStartIndex+1:null,pickIndex:typeof currentPickIndex!=="undefined"?currentPickIndex:null,data:{powerId:POWER_ID,rewardId:reward.rewardId}});
            return result?.ok?{ok:true,label:"+1 JeffCoin"}:{ok:false,reason:result?.reason||"Economy jest wyłączone."};
        }
        if(reward.type==="queue_boost"){
            const shifted=typeof shiftGambitFuturePickByOne==="function"?shiftGambitFuturePickByOne(state.playerIndex,-1,{reason:"black_cat_heist_queue",actorPlayerIndex:state.playerIndex}):{ok:false};
            if(shifted?.shifted) return {ok:true,label:"Najbliższy pick przesunięty o 1 miejsce wcześniej."};
            const asset=global.SuperpowerEngine?.createRuntimeAsset?.(state.playerName,"black_cat_queue_boost",{powerId:POWER_ID,playerIndex:state.playerIndex,reason:"black_cat_heist",createdPack:typeof packStartIndex!=="undefined"?packStartIndex+1:null});
            return asset?{ok:true,label:"Żeton +1 do kolejki zachowany na najbliższą paczkę.",pending:true}:{ok:false,reason:"Nie udało się zachować żetonu kolejki."};
        }
        return {ok:false,reason:"Ta nagroda wymaga decyzji gracza."};
    }
    function renderRewardChoice(entries,reward,lead){
        setHeader("Sejf jest otwarty. Rozlicz kolejne trofea przed powrotem do draftu.",`<span>ŁUP <b>${state.rewardResults.length}/${state.rewardResults.length+state.rewardQueue.length+1}</b></span>`);
        ensureOverlay().querySelector("#spxBlackCatContent").innerHTML=`<section class="spx-blackcat-reward-stage"><div class="spx-blackcat-vault"><img src="draft-assets/blackcat_heist_vault_success.png" alt="Otwarty sejf"><div><span>${esc(reward.label)}</span><h3>${esc(lead)}</h3><p>Wszystkie przelosowania zachowują bazowy Koszt karty. Chronione i zablokowane karty nie są dostępne.</p></div></div><div class="spx-blackcat-reward-cards">${entries.map(entry=>`<button type="button" data-index="${entry.index}">${cardMarkup(entry.card)}<span>WYBIERZ</span></button>`).join("")}</div></section>`;
        setHint("Napad jest już rozliczany — tej fazy nie można anulować.");setActions([]);
    }
    function resolveNextReward(){
        state.choiceCandidates=[];state.choiceTargetIndex=-1;
        const reward=state.rewardQueue.shift();state.currentReward=reward||null;
        if(!reward){showSummary();return;}
        if(["jeffcoin","queue_boost"].includes(reward.type)){
            const result=applyAutomaticReward(reward);state.rewardResults.push({reward,...result});
            global.setTimeout(resolveNextReward,120);return;
        }
        if(reward.type==="choice_two"){
            const targets=eligibleOwnRerolls("any_reroll");
            if(!targets.length){state.rewardResults.push({reward,ok:false,reason:"Brak legalnej karty do przelosowania."});resolveNextReward();return;}
            const target=targets[Math.floor(Math.random()*targets.length)];state.choiceTargetIndex=target.index;
            state.choiceCandidates=replacementTemplates(state.playerIndex,target.index,target.card,2);
            if(state.choiceCandidates.length<2){state.rewardResults.push({reward,ok:false,reason:"Brak dwóch legalnych kandydatów."});resolveNextReward();return;}
            setHeader("Podwójny łup przygotował dwie drogi ucieczki.",`<span>KARTA <b>${esc(target.card.name)}</b></span>`);
            ensureOverlay().querySelector("#spxBlackCatContent").innerHTML=`<section class="spx-blackcat-reward-stage"><div class="spx-blackcat-vault compact"><img src="draft-assets/blackcat_heist_vault_success.png" alt="Sejf"><div><span>PODWÓJNY ŁUP // 1 Z 2</span><h3>${esc(target.card.name)} CZEKA NA NOWĄ TOŻSAMOŚĆ</h3><p>Wybierz jeden z dwóch zamienników o Koszcie ${cardCost(target.card)}.</p></div></div><div class="spx-blackcat-reward-cards candidates">${state.choiceCandidates.map((card,index)=>`<button type="button" data-candidate="${index}">${cardMarkup(card)}<span>WYBIERZ TĘ KARTĘ</span></button>`).join("")}</div></section>`;
            ensureOverlay().querySelectorAll("[data-candidate]").forEach(button=>button.addEventListener("click",()=>{const result=commitReroll(state.choiceTargetIndex,state.choiceCandidates[Number(button.dataset.candidate)],reward.type);state.rewardResults.push({reward,...result});if(typeof showDecks==="function")showDecks();resolveNextReward();}));
            setHint("Losowa karta z decku Black Cat otrzymuje wybór 1 z 2 zamienników o tym samym Koszcie.");setActions([]);return;
        }
        const entries=eligibleOwnRerolls(reward.type);
        if(!entries.length){state.rewardResults.push({reward,ok:false,reason:"Brak legalnej karty do przelosowania."});resolveNextReward();return;}
        renderRewardChoice(entries,reward,reward.type==="weakest_reroll"?"WYBIERZ JEDNĄ Z NAJSŁABSZYCH KART":"WYBIERZ DOWOLNĄ KARTĘ DO PRZELOSOWANIA");
        ensureOverlay().querySelectorAll(".spx-blackcat-reward-cards button").forEach(button=>button.addEventListener("click",()=>{const result=commitReroll(Number(button.dataset.index),null,reward.type);state.rewardResults.push({reward,...result});if(typeof showDecks==="function")showDecks();resolveNextReward();}));
    }
    function showSummary(){
        state.phase="summary";
        const mainOk=Boolean(state.mainResult?.ok),successes=state.rewardResults.filter(result=>result.ok);
        setHeader(mainOk?"Black Cat znika w świetle księżyca z głównym eksponatem.":"Napad zakończony. Muzeum zamyka protokół bezpieczeństwa.",`<span>WYNIK <b>${mainOk?"HEIST UDANY":"ODWRÓT"}</b></span>`);
        ensureOverlay().querySelector("#spxBlackCatContent").innerHTML=`<section class="spx-blackcat-summary"><img src="draft-assets/blackcat_heist_vault_success.png" alt="Łup Black Cat"><div class="spx-blackcat-summary-panel"><span>OPERACJA ZAKOŃCZONA</span><h3>${mainOk?"GŁÓWNY EKSPONAT ZDOBYTY":"BLACK CAT UCIEKŁA"}</h3>${mainOk?`<div class="spx-blackcat-main-result">${cardMarkup(state.mainResult.stolenCard,"summary-card")}<p><b>${esc(state.selectedTarget.targetPlayerName)}</b> otrzymuje <b>${esc(state.mainResult.replacementCard.name)}</b> — kartę o tym samym Koszcie ${cardCost(state.mainResult.stolenCard)}.</p></div>`:`<p class="spx-blackcat-main-miss">${esc(state.mainResult?.reason||"Główna gablota pozostała zamknięta.")}</p>`}<ul>${state.rewardResults.map(result=>`<li class="${result.ok?"ok":"miss"}"><b>${result.ok?"✓":"×"}</b><span>${esc(result.reward.label)}<small>${esc(result.label||result.reason||"Rozliczono")}</small></span></li>`).join("")||"<li class='miss'><b>—</b><span>Brak nagród pobocznych</span></li>"}</ul></div></section>`;
        setHint(`${successes.length} nagród pobocznych rozliczonych. Supermoc została wykorzystana.`);
        setActions([{label:"WRÓĆ DO DRAFTU",className:"primary",onClick:()=>reset()}]);
        if(typeof showDecks==="function") showDecks();
        if(typeof updateRoundQueueDisplay==="function") updateRoundQueueDisplay();
        if(typeof updateInfoPanel==="function") updateInfoPanel();
    }
    function attemptClose(){
        if(!state.active) return;
        if(state.phase==="target"||(state.phase==="heist"&&state.session?.visited?.length===1)){reset();return;}
        if(state.phase==="summary"){reset();return;}
        notify("warning","MUZEUM JEST W TOKU","Po pierwszym ruchu napad trzeba dokończyć albo wycofać się ze zdobytym łupem.");
    }
    function reset(){
        const overlay=document.getElementById("spxBlackCatOverlay");if(overlay) overlay.hidden=true;
        document.body.classList.remove("spx-blackcat-active");
        Object.assign(state,{active:false,phase:"idle",playerName:"",playerIndex:-1,targets:[],selectedTarget:null,session:null,processing:false,activationCommitted:false,mainResult:null,rewardQueue:[],rewardResults:[],currentReward:null,choiceTargetIndex:-1,choiceCandidates:[],notice:""});
        if(typeof showDecks==="function") showDecks();
    }
    function start(playerName){
        const check=preflight(playerName);
        if(!check.ok){notify("warning","MUZEUM POZOSTAJE ZAMKNIĘTE",check.message);return false;}
        state.active=true;state.playerName=String(playerName);state.playerIndex=check.playerIndex;state.targets=check.targets;state.selectedTarget=null;state.activationCommitted=false;
        const overlay=ensureOverlay();overlay.hidden=false;document.body.classList.add("spx-blackcat-active");renderTargetSelection();return true;
    }
    function onQueuePrepared(){
        if(state.queueApplying||typeof shiftGambitFuturePickByOne!=="function") return false;
        state.queueApplying=true;
        let changed=false;
        try{
            playersList().forEach((playerName,playerIndex)=>{
                const assets=global.SuperpowerEngine?.getRuntimeAssets?.({owner:playerName,type:"black_cat_queue_boost",status:"active"})||[];
                assets.forEach(asset=>{
                    const result=shiftGambitFuturePickByOne(playerIndex,-1,{reason:"black_cat_heist_pending_queue",actorPlayerIndex:playerIndex});
                    if(result?.shifted){global.SuperpowerEngine?.consumeRuntimeAsset?.(asset.assetId,{reason:"queue_boost_applied",playerIndex});changed=true;}
                });
            });
        }finally{state.queueApplying=false;}
        return changed;
    }
    global.BlackCatUI=Object.freeze({start,reset,onQueuePrepared,isBusy:()=>state.active,getLockReason:()=>state.active?"Dokończ KOCI HEIST Black Cat.":"",getState:()=>safeClone(state)});
})(typeof window!=="undefined"?window:globalThis);
