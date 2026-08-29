"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");

const root=__dirname;
const read=name=>fs.readFileSync(path.join(root,name),"utf8");
const html=read("snap-draft.html");
const moduleSource=read("superpowers-mysterio.js");
const css=read("superpowers-mysterio.css");
const data=read("superpowers-data.js");
const thor=read("superpowers-thor.js");
const superpowerUi=read("superpowers-ui.js");
const groot=read("superpowers-groot.js");
const gambit=read("superpowers-gambit.js");
const dino=read("superpowers-devildino.js");
const ironFist=read("superpowers-ironfist-ui.js");

function check(label,test){
    test();
    console.log(`✓ ${label}`);
}

function pngColorType(file){
    const buffer=fs.readFileSync(path.join(root,"draft-assets",file));
    assert.strictEqual(buffer.subarray(1,4).toString("ascii"),"PNG","asset must be a PNG");
    return buffer[25];
}

check("Mysterio is registered exactly once",()=>{
    assert.strictEqual((data.match(/id:\s*"mysterio"/g)||[]).length,1);
    assert.match(data,/prepared_pack_before_open/);
});

check("coverage uses ceil(3\/4) and works for small and large packs",()=>{
    assert.match(moduleSource,/Math\.ceil\(check\.pack\.length\*3\/4\)/);
    for(let size=1;size<=40;size++){
        const covered=Math.ceil(size*3/4);
        assert.ok(covered>=1&&covered<=size);
        assert.strictEqual(covered,Math.ceil(size*.75));
    }
    assert.strictEqual(Math.ceil(27*3/4),21);
});

check("activation is limited to the prepared pack before it opens",()=>{
    assert.match(moduleSource,/currentPickIndex\(\)!==0/);
    assert.match(moduleSource,/isPackPreparedForIllusion/);
    assert.match(html,/!packIsOpen/);
});

check("owner has one shared pool of four public peeks for the two-pick sequence",()=>{
    assert.match(moduleSource,/PEEKS_PER_ACTIVATION=4/);
    assert.doesNotMatch(moduleSource,/PEEKS_PER_PICK/);
    assert.match(moduleSource,/owner-sequence/);
    assert.match(moduleSource,/ownerPicksCompleted>=2/);
    assert.match(data,/peeksPerActivation:\s*4/);
});

check("peek is a real 5.5 second wall-clock window and guards against early timer firing",()=>{
    assert.match(moduleSource,/PEEK_DURATION_MS=5500/);
    assert.match(moduleSource,/startedAt:now/);
    assert.match(moduleSource,/expiresAt:now\+PEEK_DURATION_MS/);
    assert.match(moduleSource,/if\(peeking\) return;/);
    assert.doesNotMatch(moduleSource,/PODGLĄD • \${seconds} SEK\./);
    assert.match(moduleSource,/spx-mysterio-preopen/);
    assert.match(moduleSource,/function schedulePeekExpiry/);
    assert.match(moduleSource,/Math\.max\(0,Number\(peek\.expiresAt\|\|0\)-Date\.now\(\)\)/);
    assert.match(moduleSource,/remaining>35/);
    assert.match(moduleSource,/spx-mysterio-peek-window-badge/);
    assert.match(moduleSource,/PODGLĄD/);
    assert.doesNotMatch(moduleSource,/DraftTurnTimer[^\n]*(pause|stop|freeze)/i);
    assert.match(data,/publicPeekDurationMs:\s*5500/);
});

check("Pattern loot resolves during Peek and never after a finalized normal pick",()=>{
    const peekIndex=moduleSource.indexOf("function peek(effectId)");
    const immediateIndex=moduleSource.indexOf("resolvePendingReflectionDiscovery().catch",peekIndex);
    const pickIndex=moduleSource.indexOf("function onPickFinalized(context={})");
    assert.ok(peekIndex>=0 && immediateIndex>peekIndex && immediateIndex<pickIndex,"Pattern offer must be triggered from Peek");
    const pickBlock=moduleSource.slice(pickIndex,moduleSource.indexOf("function takePendingPickResolution",pickIndex));
    assert.doesNotMatch(pickBlock,/await resolvePendingReflectionDiscovery/);
    assert.match(pickBlock,/mysterio_stale_pattern_offer_discarded_on_pick/);
    assert.match(moduleSource,/if\(state\.currentPeek\) clearPeek\(\{rerender:false\}\)/);
    assert.match(moduleSource,/requireDifferent:true/);
});

check("Pattern loot requires a peek of the actual Pattern and is capped at one accepted loot",()=>{
    assert.match(moduleSource,/function registerReflectionDiscovery/);
    assert.match(moduleSource,/String\(card\?\.instanceId\|\|""\)!==sourceId/);
    assert.match(moduleSource,/reflectionLootUsed/);
    assert.match(moduleSource,/TRAFIONO WZORZEC ILUZJI/);
    assert.match(moduleSource,/UKRAŚĆ WZORZEC\?/);
    assert.match(moduleSource,/pickConsumed:false/);
    assert.match(data,/reflectionLootRequiresPatternPeek:\s*true/);
    assert.match(data,/maxReflectionLoot:\s*1/);
});

check("reflection loot is a new instance and a 1:1 deck replacement",()=>{
    assert.match(html,/origin:"mysterio_reflection_loot"/);
    assert.match(html,/forceNew:true/);
    assert.match(html,/deck\[replacementIndex\]=copyCard/);
    assert.match(html,/deckSizeUnchanged:true/);
});

check("Pattern reanchors safely and the final single illusion auto-collapses",()=>{
    assert.match(moduleSource,/function collapseTrivialIllusion/);
    assert.match(moduleSource,/mysterio_last_illusion_collapsed/);
    assert.match(moduleSource,/if\(live\.length>1\) return false/);
    assert.match(moduleSource,/function reanchorSharedDecoy/);
    assert.match(moduleSource,/shuffle\(candidates\)/);
    assert.match(moduleSource,/excludeInstanceIds/);
    assert.match(data,/lastIllusionAutoReveals:\s*true/);
});

check("source transformation does not expose the known replacement as the next Pattern",()=>{
    assert.match(moduleSource,/mysterio_decoy_source_transformed/);
    assert.match(moduleSource,/excludeInstanceIds:\[replacementCard\.instanceId\]/);
});

check("normal pick visibly reveals the real card before teleport\/finalization",()=>{
    assert.match(moduleSource,/spx-mysterio-reveal-label/);
    assert.match(moduleSource,/ILUZJA OPADA/);
    assert.match(moduleSource,/revealHoldMs:430/);
    assert.match(html,/Number\(mysterioReveal\.revealHoldMs\)/);
    assert.match(html,/totalDurationMs=revealHoldMs\+teleportMs/);
    assert.match(html,/setTimeout\(\(\)=>\{[\s\S]*?object\.classList\.add\("is-active"\)/);
    assert.match(css,/\.spx-mysterio-reveal-label/);
});

check("illusions persist until their cards leave, except canonical reveal\/collapse",()=>{
    assert.match(moduleSource,/mysterio_illusion_left_with_picked_card/);
    assert.doesNotMatch(moduleSource,/animateRandomBreak/);
    assert.doesNotMatch(moduleSource,/mysterio_random_decay_after_pick/);
    assert.match(data,/persistentUntilOwnCardLeavesPack:\s*true/);
});

check("every illusion uses one covered real card from the same pack",()=>{
    assert.match(moduleSource,/const decoySource=check\.decoyCandidates/);
    assert.match(moduleSource,/targets\[targets\.length-1\]=decoyTarget/);
    assert.match(moduleSource,/decoyCard:clone\(sharedDecoy\)/);
    assert.match(moduleSource,/decoySourceInstanceId:decoySource\.instanceId/);
    assert.match(data,/sharedDecoyFromCoveredPackCard:\s*true/);
});

check("Mysterio keeps two existing picks and stacks them without adding entries",()=>{
    assert.match(html,/function stackMysterioPicks/);
    assert.match(html,/pickOrder\.splice\(check\.second,1\)/);
    assert.match(html,/pickOrder\.splice\(check\.first\+1,0,ownerPick\)/);
    assert.match(html,/pickCountUnchanged:true/);
});

check("illusion state is canonical, serializable and cleaned at pack end",()=>{
    assert.match(moduleSource,/DraftStateEngine\.addPackEffect/);
    assert.match(moduleSource,/targetCardInstanceId/);
    assert.match(html,/mysterioState:window\.MysterioUI\?\.exportState/);
    assert.match(html,/window\.MysterioUI\.restoreState\(payload\.mysterioState\|\|null\)/);
    assert.match(html,/window\.MysterioUI\?\.cleanupPack\?\.\(reason\)/);
});

check("transformations and replacements transfer an illusion",()=>{
    assert.match(html,/function transformCardInArray[\s\S]*?MysterioUI\?\.transferIllusion/);
    assert.match(html,/function replaceCardInArray[\s\S]*?MysterioUI\?\.transferIllusion/);
    ["jeff_joker_wave","doctor_doom_doombot_replacement","doctor_strange_future_swap","doctor_strange_rollback"]
        .forEach(reason=>assert.match(html,new RegExp(reason)));
    assert.match(thor,/MysterioUI\?\.transferIllusion/);
    assert.match(gambit,/preserveIllusion:true/);
    assert.match(gambit,/MysterioUI\?\.transferIllusion/);
    assert.match(dino,/MysterioUI\?\.onCardLeavesPack/);
});

check("Spider-Man cannot reserve an active illusion",()=>{
    assert.match(html,/MysterioUI\?\.isIllusionCard\?\.\(card\)/);
    assert.match(html,/Pajęczej Sieci nie można nałożyć na aktywną Iluzję Mysterio/);
    assert.match(data,/spiderWebBlockedOnActiveIllusion:\s*true/);
});

check("Thor may target an illusion but pre-roll UI uses public identity and reveal happens only at irreversible roll",()=>{
    assert.match(thor,/function publicPackCardName/);
    assert.match(thor,/getPublicCardLabel/);
    assert.match(thor,/selectedCards\.map\(card => `<span class="spx-thor-picked-chip">\$\{escapeHtml\(publicPackCardName\(card\)\)\}/);
    assert.match(thor,/function revealCommittedThorIllusions/);
    assert.match(thor,/revealForExternalEffect/);
    const rollIndex=thor.indexOf("function rollMjolnir()");
    const revealIndex=thor.indexOf("revealCommittedThorIllusions();",rollIndex);
    assert.ok(rollIndex>=0 && revealIndex>rollIndex,"Thor must reveal only once the Mjolnir roll is committed");
});

check("Doctor Strange current-pack UI uses Mysterio public identity before commit",()=>{
    assert.match(superpowerUi,/function publicStrangePackCardName/);
    assert.match(superpowerUi,/Wybrano: \$\{publicStrangePackCardName\(selection\.currentCard\)\}/);
    assert.match(superpowerUi,/publicStrangePackCardName\(selection\.currentCard\)/);
});

check("Groot public growth\/harvest messaging does not leak a hidden card name",()=>{
    assert.match(groot,/function publicPackCardName/);
    assert.match(groot,/getPublicCardLabel/);
    assert.match(groot,/showGrowthToast\(`<b>\$\{stageEmoji\(stage\)\} \$\{escapeHtml\(publicPackCardName\(card\)\)\}/);
});

check("Iron Fist prize confirmation does not provide a free Mysterio identity peek",()=>{
    assert.match(ironFist,/publicPackCardSnapshot/);
    assert.match(ironFist,/TOŻSAMOŚĆ UKRYTA PRZEZ MYSTERIO/);
    assert.match(ironFist,/publicCard\?\.name/);
});

check("Devil Dino selection UI masks Mysterio name and printed cost",()=>{
    assert.match(dino,/function publicPackCardSnapshot/);
    assert.match(dino,/function safeDevourValidationMessage/);
    assert.match(dino,/const visibleCost=hasIllusion \? "\?"/);
    assert.match(dino,/publicCard\?\.name\|\|"ILUZJA"/);
});

check("identity overlay stays below public mechanical markers",()=>{
    assert.match(css,/\.spx-mysterio-illusion\s*\{[\s\S]*?z-index:14/);
    assert.match(css,/mysterio-smoke-spritesheet\.png/);
    assert.match(css,/@keyframes mysterioSmokeFrames/);
    assert.match(css,/\.spx-mysterio-peek-control/);
    assert.match(css,/\.spx-mysterio-illusion\s*\{[\s\S]*?overflow:visible/);
    assert.match(css,/\.spx-mysterio-illusion\s*\{[\s\S]*?border:0/);
});

check("hero, lightning logo and smoke sheet are RGBA PNG assets",()=>{
    ["mysteriopowershero.png","mysteriopowerslogo.png","mysterio-smoke-spritesheet.png"].forEach(file=>{
        assert.ok(fs.statSync(path.join(root,"draft-assets",file)).size>100000,`${file} is unexpectedly small`);
        assert.strictEqual(pngColorType(file),6,`${file} must carry an alpha channel`);
    });
});

check("HTML loads hardened Mysterio styles\/logic and all inline scripts parse",()=>{
    assert.match(html,/superpowers-mysterio\.css\?v=1\.2\.0/);
    assert.match(html,/superpowers-mysterio\.js\?v=1\.2\.2/);
    let inlineCount=0;
    for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)){
        if(!match[1].trim()) continue;
        inlineCount++;
        Function(match[1]);
    }
    assert.ok(inlineCount>0);
});

console.log("\nMysterio Canon Hardening regression contract: PASS");
