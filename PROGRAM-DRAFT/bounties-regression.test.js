const fs=require('fs');
const vm=require('vm');
const assert=require('assert');

const economyCode=fs.readFileSync(__dirname+'/economy-engine.js','utf8');
const bountyCode=fs.readFileSync(__dirname+'/bounties-engine.js','utf8');
const html=fs.readFileSync(__dirname+'/snap-draft.html','utf8');
const current=fs.readFileSync(__dirname+'/galactic-current.js','utf8');

function makeSandbox(){
  const listeners=new Map();
  const sandbox={console,setTimeout,clearTimeout,Math,Date};
  sandbox.window=sandbox;
  sandbox.CustomEvent=function(type,init){this.type=type;this.detail=init?.detail;};
  sandbox.addEventListener=(type,handler)=>{
    if(!listeners.has(type)) listeners.set(type,[]);
    listeners.get(type).push(handler);
  };
  sandbox.dispatchEvent=(event)=>{
    for(const handler of listeners.get(event?.type)||[]) handler(event);
    return true;
  };
  sandbox.DraftStateEngine={log:()=>({})};
  sandbox.DraftEconomyBridge={canShopPlayer:()=>({ok:true})};
  vm.createContext(sandbox);
  vm.runInContext(economyCode,sandbox,{filename:'economy-engine.js'});
  vm.runInContext(bountyCode,sandbox,{filename:'bounties-engine.js'});
  return sandbox;
}

function card(name,id,cost=3){
  return {name,cost,power:5,instanceId:id,instanceMeta:{}};
}

function registerPick(s,playerIndex,key,sourceCard=card('Picked '+key,'picked-'+key)){
  s.EconomyEngine.registerNormalPickCompleted({playerIndex,completionKey:key});
  return s.BountyEngine.onNormalPickCompleted({playerIndex,sourceCard,resultCard:sourceCard,packNumber:1,pickIndex:key});
}

(async()=>{
  // Dependency: Bounties cannot become active without Economy.
  {
    const s=makeSandbox();
    s.EconomyEngine.beginDraft(['A'],{enabled:false});
    s.BountyEngine.beginDraft(['A'],{enabled:true,rng:()=>0});
    assert.equal(s.BountyEngine.isEnabled(),false,'Bounties require Economy');
  }

  // B3 round gate: first pack is too fresh. After one completed pick per player, round can trigger.
  {
    const s=makeSandbox();
    s.EconomyEngine.beginDraft(['A','B','C'],{enabled:true});
    s.BountyEngine.beginDraft(['A','B','C'],{enabled:true,rng:()=>0});
    const first=Array.from({length:7},(_,i)=>card('P1-'+i,'p1-'+i));
    const firstResult=s.BountyEngine.onClassicPackOpened({packNumber:1,cards:first});
    assert.equal(firstResult.triggered,false);
    assert.equal(firstResult.reason,'draft_too_fresh');

    registerPick(s,0,'g1');
    registerPick(s,1,'g2');
    registerPick(s,2,'g3');

    const second=Array.from({length:7},(_,i)=>card('P2-'+i,'p2-'+i));
    const secondResult=s.BountyEngine.onClassicPackOpened({packNumber:2,cards:second});
    assert.equal(secondResult.triggered,true,'eligible deterministic Bounty Round should trigger');
    assert.equal(secondResult.assigned.length,1,'7-card pack gets exactly one Bounty in B3');
    assert.equal(second.filter(c=>s.BountyEngine.hasBounty(c)).length,1);

    // 3-4 players => hard cap 1 Bounty Round.
    const third=Array.from({length:7},(_,i)=>card('P3-'+i,'p3-'+i));
    registerPick(s,0,'g4'); registerPick(s,1,'g5'); registerPick(s,2,'g6');
    const thirdResult=s.BountyEngine.onClassicPackOpened({packNumber:3,cards:third});
    assert.equal(thirdResult.triggered,false);
    assert.equal(thirdResult.reason,'round_cap');
  }

  // Scaling is deterministic by real table size: 7/11/17/23/24 => 1/2/3/4/5.
  {
    const expected=[[7,1],[11,2],[17,3],[23,4],[24,5]];
    for(const [size,count] of expected){
      const players=13; // cap high enough for isolated test
      const s=makeSandbox();
      const names=Array.from({length:players},(_,i)=>'P'+i);
      s.EconomyEngine.beginDraft(names,{enabled:true});
      s.BountyEngine.beginDraft(names,{enabled:true,rng:()=>0});
      for(let i=0;i<players;i++) registerPick(s,i,'scale-'+size+'-'+i);
      const cards=Array.from({length:size},(_,i)=>card('C'+i,'scale-'+size+'-'+i));
      const result=s.BountyEngine.onClassicPackOpened({packNumber:2,cards});
      assert.equal(result.triggered,true);
      assert.equal(result.assigned.length,count,`size ${size}`);
    }
  }

  // Reserved Spider-Man card cannot receive a newly generated bounty.
  {
    const s=makeSandbox();
    s.getSpiderManReservationForCard=(c)=>c?.instanceId==='reserved'?{ownerIndex:0}:null;
    s.EconomyEngine.beginDraft(['A'],{enabled:true});
    s.BountyEngine.beginDraft(['A'],{enabled:true,rng:()=>0});
    const reserved=card('Reserved','reserved');
    assert.equal(s.BountyEngine.assignBounty(reserved,'aged'),null);
  }

  // Cash bounty pays into the real Economy wallet only after normal pick completion.
  {
    const s=makeSandbox();
    s.EconomyEngine.beginDraft(['A'],{enabled:true});
    s.BountyEngine.beginDraft(['A'],{enabled:true,rng:()=>0.5});
    const target=card('Cash Target','cash-1');
    s.BountyEngine.assignBounty(target,'round',{reward:{kind:'jeffcoins',amount:3,label:'+3 JC'}});
    s.EconomyEngine.registerNormalPickCompleted({playerIndex:0,completionKey:'p1'});
    assert.equal(s.EconomyEngine.getWallet(0).balance,1);
    const claim=s.BountyEngine.onNormalPickCompleted({playerIndex:0,sourceCard:target,resultCard:target,packNumber:1,pickIndex:1});
    assert.equal(claim.claimed,true);
    assert.equal(s.EconomyEngine.getWallet(0).balance,4,'1 passive + 3 bounty');
    assert.equal(s.BountyEngine.hasBounty(target),false,'claimed bounty disappears');
  }

  // Flash Sale applies to next qualifying purchase, uses ceil(50%), ignores fixed price, and is one-shot.
  {
    const s=makeSandbox();
    s.EconomyEngine.beginDraft(['A'],{enabled:true});
    s.BountyEngine.beginDraft(['A'],{enabled:true,rng:()=>0.5});
    s.EconomyEngine.registerProduct({id:'eligible',name:'Eligible',prices:{early:7,late:7},resolve:async()=>({ok:true})});
    s.EconomyEngine.registerProduct({id:'fixed',name:'Fixed',prices:{early:10,late:10},metadata:{fixedPrice:true,priceModifiersAllowed:false},resolve:async()=>({ok:true})});
    s.EconomyEngine.registerNormalPickCompleted({playerIndex:0,completionKey:'p1'});
    s.EconomyEngine.credit(0,20,{kind:'bonus',reason:'test'});
    const target=card('Discount Target','discount-1');
    s.BountyEngine.assignBounty(target,'round',{reward:{kind:'flash_sale',factor:0.5,label:'FLASH SALE 50%'}});
    const claim=s.BountyEngine.onNormalPickCompleted({playerIndex:0,sourceCard:target,resultCard:target,packNumber:1,pickIndex:1});
    assert.equal(claim.claimed,true);
    assert.equal(s.EconomyEngine.getActivePriceModifiers(0).length,1);
    assert.equal(s.EconomyEngine.quoteProductPrice(0,'eligible').price,4,'7 JC -> ceil(3.5) = 4');
    assert.equal(s.EconomyEngine.quoteProductPrice(0,'fixed').price,10,'fixed-price product ignores discount');
    const purchase=await s.EconomyEngine.purchase(0,'eligible');
    assert.equal(purchase.ok,true);
    assert.equal(purchase.price,4);
    assert.equal(s.EconomyEngine.getActivePriceModifiers(0).length,0,'Flash Sale is consumed by successful eligible purchase');
    assert.equal(s.BountyEngine.getPlayerSummary(0).flashSalesUsed,1,'used promo is tracked');
    assert.equal(s.BountyEngine.getExportData().telemetry.flashSaleUsed,1);
  }

  // An unused Flash Sale expires when the player's next normal pick is completed.
  {
    const s=makeSandbox();
    s.EconomyEngine.beginDraft(['A'],{enabled:true});
    s.BountyEngine.beginDraft(['A'],{enabled:true,rng:()=>0.5});
    s.EconomyEngine.registerNormalPickCompleted({playerIndex:0,completionKey:'e1'});
    const target=card('Expire Target','expire-1');
    s.BountyEngine.assignBounty(target,'round',{reward:{kind:'flash_sale',factor:0.5,label:'FLASH SALE 50%'}});
    s.BountyEngine.onNormalPickCompleted({playerIndex:0,sourceCard:target,resultCard:target});
    assert.equal(s.EconomyEngine.getActivePriceModifiers(0).length,1);
    s.EconomyEngine.registerNormalPickCompleted({playerIndex:0,completionKey:'e2'});
    assert.equal(s.EconomyEngine.getActivePriceModifiers(0).length,0);
    assert.equal(s.BountyEngine.getPlayerSummary(0).flashSalesExpired,1);
  }

  // Flash Sale claimed on the 12th/final normal pick converts to +3 JC.
  {
    const s=makeSandbox();
    s.EconomyEngine.beginDraft(['A'],{enabled:true});
    s.BountyEngine.beginDraft(['A'],{enabled:true,rng:()=>0.5});
    for(let i=1;i<=11;i++) s.EconomyEngine.registerNormalPickCompleted({playerIndex:0,completionKey:'p'+i});
    const target=card('Final Discount','final-1');
    s.BountyEngine.assignBounty(target,'round',{reward:{kind:'flash_sale',factor:0.5,label:'FLASH SALE 50%'}});
    s.EconomyEngine.registerNormalPickCompleted({playerIndex:0,completionKey:'p12'});
    const before=s.EconomyEngine.getWallet(0).balance;
    const claim=s.BountyEngine.onNormalPickCompleted({playerIndex:0,sourceCard:target,resultCard:target,packNumber:6,pickIndex:12});
    assert.equal(claim.claimed,true);
    assert.equal(claim.reward.kind,'jeffcoins');
    assert.equal(claim.reward.amount,3);
    assert.equal(s.EconomyEngine.getWallet(0).balance,before+3);
    assert.equal(s.EconomyEngine.getActivePriceModifiers(0).length,0);
  }

  // Aging: threshold scales with players; old bounty starts at +2 and grows after every 2 survived picks to max +4.
  {
    const s=makeSandbox();
    s.EconomyEngine.beginDraft(['A','B','C','D'],{enabled:true});
    s.BountyEngine.beginDraft(['A','B','C','D'],{enabled:true,rng:()=>0,config:{agedCheckChance:1}});
    const cards=[card('Old 1','old-1'),card('Old 2','old-2'),card('Old 3','old-3')];
    let result;
    result=s.BountyEngine.onTableAdvanced({mode:'classic',cards,tableKey:'classic:1',initialCardCount:7,packNumber:1,pickIndex:1,remainingPicks:6});
    assert.equal(result.assigned,null);
    result=s.BountyEngine.onTableAdvanced({mode:'classic',cards,tableKey:'classic:1',initialCardCount:7,packNumber:1,pickIndex:2,remainingPicks:5});
    assert.equal(result.assigned,null);
    result=s.BountyEngine.onTableAdvanced({mode:'classic',cards,tableKey:'classic:1',initialCardCount:7,packNumber:1,pickIndex:3,remainingPicks:4});
    assert.ok(result.assigned,'age 3 is eligible at a four-player table');
    const marked=cards.find(c=>s.BountyEngine.hasBounty(c));
    assert.equal(s.BountyEngine.getBounty(marked).reward.amount,2);

    s.BountyEngine.onTableAdvanced({mode:'classic',cards,tableKey:'classic:1',packNumber:1,pickIndex:4,remainingPicks:3});
    s.BountyEngine.onTableAdvanced({mode:'classic',cards,tableKey:'classic:1',packNumber:1,pickIndex:5,remainingPicks:2});
    assert.equal(s.BountyEngine.getBounty(marked).reward.amount,3,'surviving two more picks increases bounty');
    s.BountyEngine.onTableAdvanced({mode:'classic',cards,tableKey:'classic:1',packNumber:1,pickIndex:6,remainingPicks:1});
    s.BountyEngine.onTableAdvanced({mode:'classic',cards,tableKey:'classic:1',packNumber:1,pickIndex:7,remainingPicks:1});
    assert.equal(s.BountyEngine.getBounty(marked).reward.amount,4,'aging bounty caps at +4 JC');

    const removed=s.BountyEngine.invalidateCard(marked,'reroll');
    assert.equal(removed.removed,true);
    assert.equal(s.BountyEngine.hasBounty(marked),false);
    assert.ok(s.BountyEngine.getExportData().telemetry.expired>=1);
  }

  // First Aging Bounty is guaranteed by the 3rd eligible aging check if the pack lives long enough.
  {
    const s=makeSandbox();
    s.EconomyEngine.beginDraft(['A','B','C','D'],{enabled:true});
    s.BountyEngine.beginDraft(['A','B','C','D'],{enabled:true,rng:()=>0.99});
    const cards=[card('Runner 1','runner-1'),card('Runner 2','runner-2'),card('Runner 3','runner-3')];
    let result;
    result=s.BountyEngine.onTableAdvanced({mode:'classic',cards,tableKey:'classic:guarantee',initialCardCount:7,packNumber:1,pickIndex:1,remainingPicks:6});
    assert.equal(result.assigned,null);
    result=s.BountyEngine.onTableAdvanced({mode:'classic',cards,tableKey:'classic:guarantee',initialCardCount:7,packNumber:1,pickIndex:2,remainingPicks:5});
    assert.equal(result.assigned,null);
    result=s.BountyEngine.onTableAdvanced({mode:'classic',cards,tableKey:'classic:guarantee',initialCardCount:7,packNumber:1,pickIndex:3,remainingPicks:4});
    assert.equal(result.assigned,null,'first eligible aging check may miss');
    result=s.BountyEngine.onTableAdvanced({mode:'classic',cards,tableKey:'classic:guarantee',initialCardCount:7,packNumber:1,pickIndex:4,remainingPicks:3});
    assert.equal(result.assigned,null,'second eligible aging check may miss');
    result=s.BountyEngine.onTableAdvanced({mode:'classic',cards,tableKey:'classic:guarantee',initialCardCount:7,packNumber:1,pickIndex:5,remainingPicks:2});
    assert.ok(result.assigned,'third eligible aging check guarantees the first runaway bounty');
    assert.equal(result.guaranteedFirst,true);
    assert.equal(result.assigned.reward.amount,2);
  }

  // Bounty Round reward distribution contract: only round bounties can naturally roll Flash Sale; aging stays cash.
  {
    const s=makeSandbox();
    s.EconomyEngine.beginDraft(['A'],{enabled:true});
    s.BountyEngine.beginDraft(['A'],{enabled:true,rng:()=>0.999});
    const aged=card('Aged','aged-cash');
    const agedBounty=s.BountyEngine.assignBounty(aged,'aged');
    assert.equal(agedBounty.reward.kind,'jeffcoins');
    assert.equal(agedBounty.reward.amount,2);
    const round=card('Round','round-flash');
    const roundBounty=s.BountyEngine.assignBounty(round,'round');
    assert.equal(roundBounty.reward.kind,'flash_sale');
  }

  // Player/global telemetry is exported for future stats and balancing.
  {
    const s=makeSandbox();
    s.EconomyEngine.beginDraft(['A'],{enabled:true});
    s.BountyEngine.beginDraft(['A'],{enabled:true,rng:()=>0.5});
    const target=card('Telemetry Target','telemetry-1');
    s.BountyEngine.assignBounty(target,'round',{reward:{kind:'jeffcoins',amount:4,label:'+4 JC'}});
    s.EconomyEngine.registerNormalPickCompleted({playerIndex:0,completionKey:'telemetry-p1'});
    s.BountyEngine.onNormalPickCompleted({playerIndex:0,sourceCard:target,resultCard:target,packNumber:1,pickIndex:1});
    const summary=s.BountyEngine.getPlayerSummary(0);
    assert.equal(summary.bountiesClaimed,1);
    assert.equal(summary.jeffCoinsEarned,4);
    const exported=s.BountyEngine.getExportData();
    assert.equal(exported.players[0].jeffCoinsEarned,4);
    assert.equal(exported.globalNormalPicksCompleted,1);
    assert.equal(exported.telemetry.claimed,1);
    assert.equal(exported.telemetry.jeffCoinsAwarded,4);
  }

  // Static integration contracts.
  assert.match(html,/id="enableBounties"/);
  assert.match(html,/ŁOWCY NAGRÓD/);
  assert.match(bountyCode,/const DISPLAY_NAME="Łowcy Nagród"/);
  assert.match(html,/bounties-engine\.js\?v=1\.4\.0/);
  assert.match(html,/bounties\.css\?v=1\.4\.0/);
  assert.match(html,/BountyEngine\?\.onClassicPackOpened/);
  assert.match(html,/BountyEngine\?\.onNormalPickCompleted/);
  assert.match(html,/function resolvePackCardLifecycle[\s\S]*BountyEngine\?\.invalidateCard/);
  assert.match(html,/function archiveCardToGraveyard[\s\S]*BountyEngine\?\.invalidateCard/);
  assert.match(html,/doctor_strange_card_sent_to_future[\s\S]*BountyEngine\?\.invalidateCard|BountyEngine\?\.invalidateCard[\s\S]*doctor_strange_card_sent_to_future/);
  assert.match(html,/\.pack-stage\.draft-finished \.draft-finish-panel\{[\s\S]*translate:-50% -50%/,'final screen gets extension-safe centering');
  assert.match(current,/BountyEngine\?\.onGalacticOrbitStarted/);
  assert.match(current,/BountyEngine\?\.onTableAdvanced/);
  assert.match(current,/bountiesEnabled:Boolean\(window\.BountyEngine\?\.isEnabled/);

  console.log('Bounty Hunters B5 polish + hardening regression OK');
})().catch(error=>{
  console.error(error);
  process.exitCode=1;
});
